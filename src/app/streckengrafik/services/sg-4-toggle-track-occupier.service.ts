import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {Sg3TrainrunsService} from "./sg-3-trainruns.service";
import {takeUntil} from "rxjs/operators";
import {SgSelectedTrainrun} from "../model/streckengrafik-model/sg-selected-trainrun";
import {SgPath} from "../model/streckengrafik-model/sg-path";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";

@Injectable({
  providedIn: "root",
})
export class Sg4ToggleTrackOccupierService implements OnDestroy {
  private readonly sgSelectedTrainrunSubject = new BehaviorSubject<SgSelectedTrainrun>(undefined);
  private readonly sgSelectedTrainrun$ = this.sgSelectedTrainrunSubject.asObservable();

  private readonly trackOccupierOnOffSubject = new BehaviorSubject<void>(null);
  private readonly trackOccupierOnOff$ = this.trackOccupierOnOffSubject.asObservable();

  private selectedTrainrun: SgSelectedTrainrun;

  private nodeIdMap: Map<number, boolean> = new Map();

  private readonly destroyed$ = new Subject<void>();

  constructor(
    private readonly sg3TrainrunsService: Sg3TrainrunsService,
    private readonly uiInteractionService: UiInteractionService,
  ) {
    this.sg3TrainrunsService
      .getSgSelectedTrainrun()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((selectedTrainrun) => {
        this.selectedTrainrun = selectedTrainrun;
        this.render();
      });

    this.uiInteractionService.setEditorModeObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        this.collapseAllPathNode();
      });
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  private render() {
    if (!this.selectedTrainrun) {
      return;
    }
    this.selectedTrainrun.paths.forEach((path) => {
      if (path.isNode()) {
        if (this.nodeIdMap.has(path.getPathNode().nodeId)) {
          path.trackOccupier = this.nodeIdMap.get(path.getPathNode().nodeId);
        } else {
          path.trackOccupier = false;
        }
      }
    });
    this.sgSelectedTrainrunSubject.next(this.selectedTrainrun);
  }

  public getSgSelectedTrainrun(): Observable<SgSelectedTrainrun> {
    return this.sgSelectedTrainrun$;
  }

  public getTrackOccupierOnOff(): Observable<void> {
    return this.trackOccupierOnOff$;
  }

  toggleTrackOccupier(nodeId: number) {
    if (this.nodeIdMap.has(nodeId)) {
      this.nodeIdMap.set(nodeId, !this.nodeIdMap.get(nodeId));
    } else {
      this.nodeIdMap.set(nodeId, true);
    }
    this.render();
    this.trackOccupierOnOffSubject.next();
  }

  public expandAllPathNode() {
    this.selectedTrainrun.paths.forEach((path: SgPath) => {
      if (path.isNode()) {
        const pathNode = path.getPathNode();
        if (!pathNode.trackOccupier) {
          this.toggleTrackOccupier(path.getPathNode().nodeId);
        }
      }
    });
  }

  public collapseAllPathNode() {
    if (!this.selectedTrainrun) {
      return;
    }
    this.selectedTrainrun.paths.forEach((path: SgPath) => {
      if (path.isNode()) {
        const pathNode = path.getPathNode();
        if (pathNode.trackOccupier) {
          this.toggleTrackOccupier(path.getPathNode().nodeId);
        }
      }
    });
  }

  allPathNodeClosed(): boolean {
    let retVal = false;
    this.selectedTrainrun.paths.forEach((path: SgPath) => {
      if (path.isNode()) {
        const pathNode = path.getPathNode();
        retVal = retVal || pathNode.trackOccupier;
      }
    });
    return !retVal;
  }
}
