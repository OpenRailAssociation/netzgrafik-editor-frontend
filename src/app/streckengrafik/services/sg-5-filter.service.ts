import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {SgSelectedTrainrun} from "../model/streckengrafik-model/sg-selected-trainrun";
import {Sg4ToggleTrackOccupierService} from "./sg-4-toggle-track-occupier.service";
import {takeUntil} from "rxjs/operators";
import {TrainrunBranchType} from "../model/enum/trainrun-branch-type-type";

@Injectable({
  providedIn: "root",
})
export class Sg5FilterService implements OnDestroy {
  private readonly sgSelectedTrainrunSubject = new BehaviorSubject<SgSelectedTrainrun>(undefined);
  private readonly sgSelectedTrainrun$ = this.sgSelectedTrainrunSubject.asObservable();

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
    return this.sgSelectedTrainrun$;
  }

  private render() {
    if (this.selectedTrainrun === undefined) {
      return;
    }

    this.selectedTrainrun.trainruns.forEach((trainrun) => {
      trainrun.sgTrainrunItems.forEach((trainrunItem) => {
        if (trainrunItem.isNode()) {
          if (trainrunItem.getPathNode().filter) {
            const trainrunNode = trainrunItem.getTrainrunNode();
            if (trainrunNode.departurePathSection) {
              if (trainrunNode.departurePathSection.arrivalPathNode) {
                if (!trainrunNode.departurePathSection.arrivalPathNode.getPathNode().filter) {
                  if (
                    trainrunNode.departurePathSection.trainrunBranchType ===
                    TrainrunBranchType.Trainrun
                  ) {
                    trainrunNode.departurePathSection.trainrunBranchType =
                      TrainrunBranchType.ArrivalBranchFilter;
                  }
                }
              }
            }
            if (trainrunNode.arrivalPathSection) {
              if (trainrunNode.arrivalPathSection.departurePathNode) {
                if (!trainrunNode.arrivalPathSection.departurePathNode.getPathNode().filter) {
                  if (
                    trainrunNode.arrivalPathSection.trainrunBranchType ===
                    TrainrunBranchType.Trainrun
                  ) {
                    trainrunNode.arrivalPathSection.trainrunBranchType =
                      TrainrunBranchType.DepartureBranchFilter;
                  }
                }
              }
            }
          }
        }
      });
    });

    this.selectedTrainrun.trainruns.forEach((trainrun) => {
      // Node ausfiltern
      trainrun.sgTrainrunItems = trainrun.sgTrainrunItems.filter((trainrunItem) => {
        if (trainrunItem.isNode()) {
          if (trainrunItem.getPathNode().filter) {
            return false;
          }
        }
        return true;
      });

      // Section iltern
      trainrun.sgTrainrunItems = trainrun.sgTrainrunItems.filter((trainrunItem) => {
        if (trainrunItem.isSection()) {
          const trainrunSection = trainrunItem.getTrainrunSection();
          if (
            trainrunSection.departurePathNode &&
            trainrunSection.departurePathNode.getPathNode() &&
            trainrunSection.departurePathNode.getPathNode().filter &&
            trainrunSection.arrivalPathNode &&
            trainrunSection.arrivalPathNode.getPathNode() &&
            trainrunSection.arrivalPathNode.getPathNode().filter
          ) {
            return false;
          }
        }
        return true;
      });
    });
    this.selectedTrainrun.paths = this.selectedTrainrun.paths.filter((path) => {
      if (path.isNode()) {
        if (path.getPathNode().filter) {
          return false;
        }
      }
      if (path.isSection()) {
        if (
          path.getPathSection().departurePathNode.getPathNode().filter &&
          path.getPathSection().arrivalPathNode.getPathNode().filter
        ) {
          return false;
        }
      }
      return true;
    });

    this.sgSelectedTrainrunSubject.next(this.selectedTrainrun);
  }
}
