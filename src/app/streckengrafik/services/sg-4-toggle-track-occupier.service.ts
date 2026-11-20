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

  private readonly trackOccupierOnOffSubject = new BehaviorSubject<void>(null);

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
        path.trackOccupier = this.nodeIdMap.get(path.getPathNode().nodeId) ?? false;
      }
    });
    this.sgSelectedTrainrunSubject.next(this.selectedTrainrun);
  }

  public getSgSelectedTrainrun(): Observable<SgSelectedTrainrun> {
    return this.sgSelectedTrainrunSubject.asObservable();
  }

  public getTrackOccupierOnOff(): Observable<void> {
    return this.trackOccupierOnOffSubject.asObservable();
  }

  toggleTrackOccupier(nodeId: number) {
    this.nodeIdMap.set(nodeId, !this.nodeIdMap.get(nodeId));
    this.render();
    this.trackOccupierOnOffSubject.next();
  }

  public expandAllPathNode() {
    this.setAllPathNodes(true);
  }

  public collapseAllPathNode() {
    this.setAllPathNodes(false);
  }

  private setAllPathNodes(open: boolean): void {
    if (!this.selectedTrainrun) {
      return;
    }
    this.selectedTrainrun.paths
      .filter((path: SgPath) => path.isNode())
      .filter((path) => path.getPathNode().trackOccupier !== open)
      .forEach((path) => this.toggleTrackOccupier(path.getPathNode().nodeId));
  }

  allPathNodeClosed(): boolean {
    return !this.selectedTrainrun.paths.some(
      (path: SgPath) => path.isNode() && path.getPathNode().trackOccupier,
    );
  }
}
