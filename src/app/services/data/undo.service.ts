import {Injectable, OnDestroy} from "@angular/core";
import {Subject, Subscription} from "rxjs";
import {DataService, NetzgrafikLoadedInfo} from "./data.service";
import {NetzgrafikDto} from "../../data-structures/business.data.structures";
import {takeUntil} from "rxjs/operators";
import {NodeService} from "./node.service";
import {NoteService} from "./note.service";
import {TrainrunService} from "./trainrun.service";
import {FilterService} from "../ui/filter.service";

@Injectable({
  providedIn: "root",
})
export class UndoService implements OnDestroy {
  private static readonly MAX_UNDOABLE_CHANGES = 100;
  private changesSubscription: Subscription = undefined;
  private readonly destroyed$ = new Subject<void>();
  private currentNetzgrafikJSON: string;
  private changeHistoryStack: NetzgrafikDto[] = [];
  private netzgrafikIsLoading = false;
  private undoNetzgrafikIsLoading = false;
  private currentVariantId: number = undefined;
  private undoRecordingStopped = false;
  private ignoreNextPushCurrentVersionCall = false;

  constructor(
    private readonly dataService: DataService,
    private readonly nodeService: NodeService,
    private readonly noteService: NoteService,
    private readonly trainrunService: TrainrunService,
    private readonly filterService: FilterService,
  ) {
    this.startUndoRecording();
    this.dataService
      .getNetzgrafikLoadedInfo()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((info: NetzgrafikLoadedInfo) => {
        this.netzgrafikIsLoading = info.load;
        if (!info.load && !this.undoNetzgrafikIsLoading) {
          this.currentNetzgrafikJSON = JSON.stringify(this.dataService.getNetzgrafikDto());
          if (!info.preview) {
            this.changeHistoryStack = [];
            this.changeHistoryStack.push(JSON.parse(this.currentNetzgrafikJSON));
          }
        }
      });
    this.subscribeSnapshots();
  }

  ngOnDestroy() {
    if (this.changesSubscription !== undefined) {
      this.changesSubscription.unsubscribe();
    }
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  pauseUndoRecording() {
    this.undoRecordingStopped = true;
  }

  startUndoRecording() {
    this.undoRecordingStopped = false;
  }

  setIgnoreNextPushCurrentVersionCall() {
    // performance improvement: pan, ... should only be used when the data doesn't change
    // - such as when changing the viewBox, etc. which requires a redrawing/update
    this.ignoreNextPushCurrentVersionCall = true;
  }

  private subscribeSnapshots() {
    if (this.changesSubscription !== undefined) {
      this.changesSubscription.unsubscribe();
    }
    this.changesSubscription = this.dataService
      .getNetzgrafikChangesObservable(10)
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        if (this.undoRecordingStopped) {
          return;
        }
        if (this.netzgrafikIsLoading || this.undoNetzgrafikIsLoading) {
          return;
        }
        this.pushCurrentVersion();
      });
  }

  public pushCurrentVersion(enforce = false) {
    if (this.ignoreNextPushCurrentVersionCall && !enforce) {
      this.ignoreNextPushCurrentVersionCall = false;
      return;
    }
    this.ignoreNextPushCurrentVersionCall = false;
    this.internalPushCurrentVersion(enforce);
  }

  private internalPushCurrentVersion(enforce = false) {
    const newNetzgrafikJson = JSON.stringify(this.dataService.getNetzgrafikDto());
    const modified = newNetzgrafikJson !== this.currentNetzgrafikJSON;
    if (modified || enforce) {
      this.changeHistoryStack.push(JSON.parse(newNetzgrafikJson));
      this.currentNetzgrafikJSON = newNetzgrafikJson;
      if (this.changeHistoryStack.length > UndoService.MAX_UNDOABLE_CHANGES) {
        this.changeHistoryStack.shift();
      }
    }
  }

  public undo() {
    if (this.changeHistoryStack.length > 1) {
      this.changeHistoryStack.pop();
      const data = this.changeHistoryStack.pop();
      this.currentNetzgrafikJSON = JSON.stringify(data);
      this.undoNetzgrafikIsLoading = true;
      const selectedTrainrun = this.trainrunService.getSelectedTrainrun();
      const filterSetting = this.filterService.getActiveFilterSetting();
      this.dataService.loadNetzgrafikDto(data);
      if (selectedTrainrun) {
        this.trainrunService.setTrainrunAsSelected(selectedTrainrun.getId());
      }
      if (filterSetting) {
        this.filterService.setActiveFilterSetting(filterSetting);
      }
      this.changeHistoryStack.push(data);
      this.undoNetzgrafikIsLoading = false;
    }
  }

  public reset(variantId: number) {
    if (this.currentVariantId !== variantId) {
      this.currentNetzgrafikJSON = JSON.stringify(this.dataService.getNetzgrafikDto());
      this.changeHistoryStack = [];
      this.changeHistoryStack.push(JSON.parse(this.currentNetzgrafikJSON));
    }
    this.currentVariantId = variantId;
  }

  public getCurrentVariantId(): number {
    return this.currentVariantId;
  }
}
