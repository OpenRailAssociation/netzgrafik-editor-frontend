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
    return this.sgSelectedTrainrunSubject.asObservable();
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
    return trainrunItem.pathItems
      .map((pathItem, index) => this.createPath(pathItem, index))
      .filter((path): path is SgPath => path !== undefined);
  }

  private createPath(pathItem: PathItem, index: number): SgPath {
    if (pathItem.isSection()) {
      return this.createPathSection(pathItem, index);
    }
    if (pathItem.isNode()) {
      return this.createPathNode(pathItem, index);
    }
    return undefined;
  }

  private createPathSection(pathItem: PathItem, index: number): SgPathSection {
    const pathSection = pathItem.getPathSection();
    return new SgPathSection(
      index,
      pathSection.trainrunSectionId,
      pathSection.arrivalTime,
      pathSection.departureTime,
      pathSection.departurePathNode.nodeId,
      pathSection.arrivalPathNode.nodeId,
      pathSection.departurePathNode.nodeShortName,
      pathSection.arrivalPathNode.nodeShortName,
      new TrackData(pathSection.backward ? 2 : 1),
      pathSection.isFilterOnOneNode(),
    );
  }

  private createPathNode(pathItem: PathItem, index: number): SgPathNode {
    const pathNode = pathItem.getPathNode();
    const sgPathNode = new SgPathNode(
      index,
      pathNode.nodeId,
      pathNode.nodeShortName,
      pathNode.nodeFullName,
      pathNode.arrivalTime,
      pathNode.departureTime,
      undefined,
      undefined,
      new TrackData(pathNode.backward ? 2 : 1),
      pathNode.filter,
    );
    sgPathNode.arrivalTrainrunSectionId = pathNode.arrivalPathSection?.trainrunSectionId;
    sgPathNode.departureTrainrunSectionId = pathNode.departurePathSection?.trainrunSectionId;
    return sgPathNode;
  }

  private addNodesSegmentRelation(paths: SgPath[]) {
    paths.forEach((path, index) => {
      if (path.isNode()) {
        const pathNode = path.getPathNode();
        pathNode.arrivalPathSection = this.getPathSection(paths, index, -1);
        pathNode.departurePathSection = this.getPathSection(paths, index, 1);
      }
      if (path.isSection()) {
        const pathSection = path.getPathSection();
        pathSection.departurePathNode = this.getPathNode(paths, index, -1);
        pathSection.arrivalPathNode = this.getPathNode(paths, index, 1);
      }
    });
    return paths;
  }

  private getPathSection(paths: SgPath[], index: number, direction: -1 | 1): SgPathSection {
    const path = paths[index + direction];
    return path instanceof SgPathSection ? path : undefined;
  }

  private getPathNode(paths: SgPath[], index: number, direction: -1 | 1): SgPathNode {
    const path = paths[index + direction];
    return path instanceof SgPathNode ? path : undefined;
  }

  private addSelectedTrainrunsToPath(trainrun: SgSelectedTrainrun) {
    trainrun.paths.forEach((path) => {
      path.trainrun = trainrun;
    });
    return trainrun;
  }
}
