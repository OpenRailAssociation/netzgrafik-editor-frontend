import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {SgSelectedTrainrun} from "../model/streckengrafik-model/sg-selected-trainrun";
import {Sg4ToggleTrackOccupierService} from "./sg-4-toggle-track-occupier.service";
import {SgPath} from "../model/streckengrafik-model/sg-path";
import {SgPathNode} from "../model/streckengrafik-model/sg-path-node";
import {SgTrainrunItem} from "../model/streckengrafik-model/sg-trainrun-item";
import {SgTrainrunNode} from "../model/streckengrafik-model/sg-trainrun-node";
import {takeUntil} from "rxjs/operators";
import {TrainrunBranchType} from "../model/enum/trainrun-branch-type-type";

@Injectable({
  providedIn: "root",
})
export class Sg5FilterService implements OnDestroy {
  private readonly sgSelectedTrainrunSubject = new BehaviorSubject<SgSelectedTrainrun>(undefined);

  private selectedTrainrun: SgSelectedTrainrun;

  private readonly destroyed$ = new Subject<void>();

  constructor(private readonly sg4ToggleTrackOccupierService: Sg4ToggleTrackOccupierService) {
    this.sg4ToggleTrackOccupierService
      .getSgSelectedTrainrun()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((selectedTrainrun) => {
        this.selectedTrainrun = selectedTrainrun;
        this.render();
      });
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  public getSgSelectedTrainrun(): Observable<SgSelectedTrainrun> {
    return this.sgSelectedTrainrunSubject.asObservable();
  }

  private render() {
    if (this.selectedTrainrun === undefined) {
      return;
    }

    this.selectedTrainrun.trainruns.forEach((trainrun) => {
      trainrun.sgTrainrunItems.forEach((trainrunItem) => {
        if (!trainrunItem.isNode() || !trainrunItem.getPathNode().filter) {
          return;
        }
        const node = trainrunItem.getTrainrunNode();
        const departureSection = node.departurePathSection;
        if (
          departureSection?.arrivalPathNode &&
          !departureSection.arrivalPathNode.getPathNode().filter &&
          departureSection.trainrunBranchType === TrainrunBranchType.Trainrun
        ) {
          departureSection.trainrunBranchType = TrainrunBranchType.ArrivalBranchFilter;
        }
        const arrivalSection = node.arrivalPathSection;
        if (
          arrivalSection?.departurePathNode &&
          !arrivalSection.departurePathNode.getPathNode().filter &&
          arrivalSection.trainrunBranchType === TrainrunBranchType.Trainrun
        ) {
          arrivalSection.trainrunBranchType = TrainrunBranchType.DepartureBranchFilter;
        }
      });
      trainrun.sgTrainrunItems = trainrun.sgTrainrunItems.filter((item) =>
        this.isTrainrunItemVisible(item),
      );
    });
    this.selectedTrainrun.paths = this.selectedTrainrun.paths.filter((path) =>
      this.isPathVisible(path),
    );

    this.sgSelectedTrainrunSubject.next(this.selectedTrainrun);
  }

  private isTrainrunItemVisible(item: SgTrainrunItem): boolean {
    if (item.isNode()) {
      return !item.getPathNode().filter;
    }
    if (item.isSection()) {
      const section = item.getTrainrunSection();
      return !this.areBothNodesFiltered(section.departurePathNode, section.arrivalPathNode);
    }
    return true;
  }

  private isPathVisible(path: SgPath): boolean {
    if (path.isNode()) {
      return !path.getPathNode().filter;
    }
    if (path.isSection()) {
      const section = path.getPathSection();
      return !this.areBothNodesFiltered(section.departurePathNode, section.arrivalPathNode);
    }
    return true;
  }

  private areBothNodesFiltered(
    departurePathNode: SgTrainrunNode | SgPathNode,
    arrivalPathNode: SgTrainrunNode | SgPathNode,
  ): boolean {
    return Boolean(
      departurePathNode?.getPathNode()?.filter && arrivalPathNode?.getPathNode()?.filter,
    );
  }
}
