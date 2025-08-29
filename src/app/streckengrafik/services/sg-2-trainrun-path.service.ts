import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {Sg1LoadTrainrunItemService} from "./sg-1-load-trainrun-item.service";
import {takeUntil} from "rxjs/operators";
import {SgSelectedTrainrun} from "../model/streckengrafik-model/sg-selected-trainrun";
import {TrainrunItem} from "../model/trainrunItem";
import {SgPath} from "../model/streckengrafik-model/sg-path";
import {SgPathSection} from "../model/streckengrafik-model/sg-path-section";
import {SgPathNode} from "../model/streckengrafik-model/sg-path-node";
import {PathItem} from "../model/pathItem";
import {TrackData} from "../model/trackData";
import {SgStopService} from "./sg-stop-.service";

@Injectable({
  providedIn: "root",
})
export class Sg2TrainrunPathService implements OnDestroy {
  private readonly sgSelectedTrainrunSubject = new BehaviorSubject<SgSelectedTrainrun>(undefined);
  private readonly sgSelectedTrainrun$ = this.sgSelectedTrainrunSubject.asObservable();

  private trainrunItem: TrainrunItem;

  private readonly destroyed$ = new Subject<void>();

  constructor(
    private readonly sg1LoadTrainrunItemService: Sg1LoadTrainrunItemService,
    private readonly sgStopService: SgStopService,
  ) {
    this.sg1LoadTrainrunItemService
      .getTrainrunItem()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((trainrunItem) => {
        this.trainrunItem = trainrunItem;
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
    if (!this.trainrunItem) {
      return;
    }

    const sgSelectedTrainrun = this.addSelectedTrainrunsToPath(
      this.getSelectedTrainrun(this.trainrunItem),
    );

    this.sgSelectedTrainrunSubject.next(sgSelectedTrainrun);
  }

  private getSelectedTrainrun(trainrunItem: TrainrunItem) {
    return new SgSelectedTrainrun(
      trainrunItem.trainrunId,
      trainrunItem.frequency,
      trainrunItem.frequencyOffset,
      trainrunItem.startTime,
      trainrunItem.endTime,
      trainrunItem.title,
      trainrunItem.categoryShortName,
      trainrunItem.colorRef,
      this.addNodesSegmentRelation(this.getPaths(trainrunItem)),
      [],
      this.sgStopService.countPlus(),
    );
  }

  private getPaths(trainrunItem: TrainrunItem) {
    const returnSgPath: SgPath[] = [];

    trainrunItem.pathItems.forEach((pathItem, index) => {
      if (pathItem.isSection()) {
        const pathSection = pathItem.getPathSection();
        returnSgPath.push(
          new SgPathSection(
            index,
            pathSection.trainrunSectionId,
            pathSection.arrivalTime,
            pathSection.departureTime,
            pathSection.departurePathNode.nodeId,
            pathSection.arrivalPathNode.nodeId,
            pathSection.departurePathNode.nodeShortName,
            pathSection.arrivalPathNode.nodeShortName,
            new TrackData(this.getTrack(pathSection)),
            pathSection.isFilterOnOneNode(),
          ),
        );
      }
      if (pathItem.isNode()) {
        const pathNode = pathItem.getPathNode();
        const sgPathNode = new SgPathNode(
          index,
          pathNode.nodeId,
          pathNode.nodeShortName,
          pathNode.arrivalTime,
          pathNode.departureTime,
          undefined,
          undefined,
          new TrackData(this.getTrack(pathNode)),
          pathNode.filter,
        ); // backward
        if (pathNode.arrivalPathSection) {
          sgPathNode.arrivalTrainrunSectionId = pathNode.arrivalPathSection.trainrunSectionId;
        }
        if (pathNode.departurePathSection) {
          sgPathNode.departureTrainrunSectionId = pathNode.departurePathSection.trainrunSectionId;
        }

        returnSgPath.push(sgPathNode);
      }
    });
    return returnSgPath;
  }

  private getTrack(pathItem: PathItem) {
    if (pathItem.backward) {
      return 2;
    } else {
      return 1;
    }
  }

  private addNodesSegmentRelation(paths: SgPath[]) {
    paths.forEach((path, index) => {
      if (path.isNode()) {
        const pathNode = path.getPathNode();
        pathNode.arrivalPathSection = this.getPreviousPathSection(paths, index);
        pathNode.departurePathSection = this.getNextPathSection(paths, index);
      }
      if (path.isSection()) {
        const pathSection = path.getPathSection();
        pathSection.departurePathNode = this.getPreviousPathNode(paths, index);
        pathSection.arrivalPathNode = this.getNextPathNode(paths, index);
      }
    });
    return paths;
  }

  private getPreviousPathSection(paths: SgPath[], i: number): SgPathSection {
    if (i > 0) {
      const path = paths[i - 1];
      if (path instanceof SgPathSection) {
        return path;
      }
    }
    return undefined;
  }

  private getNextPathSection(paths: SgPath[], i: number): SgPathSection {
    if (i + 1 < paths.length) {
      const path = paths[i + 1];
      if (path instanceof SgPathSection) {
        return path;
      }
    }
    return undefined;
  }

  private getPreviousPathNode(paths: SgPath[], i: number): SgPathNode {
    if (i > 0) {
      const path = paths[i - 1];
      if (path instanceof SgPathNode) {
        return path;
      }
    }
    return undefined;
  }

  private getNextPathNode(paths: SgPath[], i: number): SgPathNode {
    if (i + 1 < paths.length) {
      const path = paths[i + 1];
      if (path instanceof SgPathNode) {
        return path;
      }
    }
    return undefined;
  }

  private addSelectedTrainrunsToPath(trainrun: SgSelectedTrainrun) {
    trainrun.paths.forEach((path) => {
      path.trainrun = trainrun;
    });
    return trainrun;
  }
}
