import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {SgSelectedTrainrun} from "../model/streckengrafik-model/sg-selected-trainrun";
import {Sg1LoadTrainrunItemService} from "./sg-1-load-trainrun-item.service";
import {TrainrunItem} from "../model/trainrunItem";
import {SgPathNode} from "../model/streckengrafik-model/sg-path-node";
import {PathNode} from "../model/pathNode";
import {PathSection} from "../model/pathSection";
import {SgPathSection} from "../model/streckengrafik-model/sg-path-section";
import {SgTrainrunNode} from "../model/streckengrafik-model/sg-trainrun-node";
import {SgTrainrunSection} from "../model/streckengrafik-model/sg-trainrun-section";
import {SgTrainrunItem} from "../model/streckengrafik-model/sg-trainrun-item";
import {SgTrainrun} from "../model/streckengrafik-model/sg-trainrun";
import {TrainrunBranchType} from "../model/enum/trainrun-branch-type-type";
import {PathItem} from "../model/pathItem";
import {TrackData} from "../model/trackData";
import {Sg2TrainrunPathService} from "./sg-2-trainrun-path.service";
import {Direction} from "src/app/data-structures/business.data.structures";

@Injectable({
  providedIn: "root",
})
export class Sg3TrainrunsService implements OnDestroy {
  private readonly sgSelectedTrainrunSubject = new BehaviorSubject<SgSelectedTrainrun>(undefined);

  private selectedTrainrun: SgSelectedTrainrun;
  private trainrunItems: TrainrunItem[];

  private readonly destroyed$ = new Subject<void>();

  constructor(
    private readonly sg2TrainrunPathService: Sg2TrainrunPathService,
    private readonly sg1LoadTrainrunItemService: Sg1LoadTrainrunItemService,
  ) {
    this.sg2TrainrunPathService
      .getSgSelectedTrainrun()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((selectedTrainrun) => {
        this.selectedTrainrun = selectedTrainrun;
        this.render();
      });

    this.sg1LoadTrainrunItemService
      .getTrainrunItems()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((trainrunItems) => {
        this.trainrunItems = trainrunItems;
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
    if (!this.selectedTrainrun || !this.trainrunItems) {
      return;
    }

    this.selectedTrainrun.trainruns = [];
    this.trainrunItems.forEach((trainrunItem) => {
      if (trainrunItem === undefined) {
        return;
      }
      this.selectedTrainrun.trainruns.push(this.createTrainrun(trainrunItem));
    });
    this.sgSelectedTrainrunSubject.next(this.selectedTrainrun);
  }

  private createTrainrun(trainrunItem: TrainrunItem): SgTrainrun {
    const trainrun = new SgTrainrun(
      trainrunItem.trainrunId,
      trainrunItem.frequency,
      trainrunItem.frequencyOffset,
      trainrunItem.startTime,
      trainrunItem.endTime,
      trainrunItem.title,
      trainrunItem.categoryShortName,
      trainrunItem.colorRef,
      this.createTrainrunItems(trainrunItem),
      this.selectedTrainrun,
    );
    this.connectTrainrunItems(trainrun);
    return trainrun;
  }

  private createTrainrunItems(trainrunItem: TrainrunItem): SgTrainrunItem[] {
    const trainrunItems: SgTrainrunItem[] = [];
    trainrunItem.pathItems.forEach((pathItem) =>
      this.addPathItem(trainrunItem, pathItem, trainrunItems),
    );
    return trainrunItems;
  }

  private addPathItem(
    trainrunItem: TrainrunItem,
    pathItem: PathItem,
    trainrunItems: SgTrainrunItem[],
  ): void {
    if (!this.isPathItemInTrainrunDirection(trainrunItem, pathItem)) {
      return;
    }
    if (pathItem.isNode()) {
      this.addTrainrunNodes(trainrunItem, pathItem, trainrunItems);
      return;
    }
    if (pathItem.isSection()) {
      this.addTrainrunSections(trainrunItem, pathItem, trainrunItems);
    }
  }

  private isPathItemInTrainrunDirection(trainrunItem: TrainrunItem, pathItem: PathItem): boolean {
    return !(
      trainrunItem.direction === Direction.ONE_WAY && pathItem.backward === trainrunItem.leftToRight
    );
  }

  private addTrainrunNodes(
    trainrunItem: TrainrunItem,
    pathItem: PathItem,
    trainrunItems: SgTrainrunItem[],
  ): void {
    const pathNode = pathItem.getPathNode();
    const {departureTime, arrivalTime} = this.getNodeTimes(trainrunItem, pathItem, pathNode);
    const isEndNode = this.isEndNode(pathNode);

    this.findPathNodes(pathNode).forEach((selectedPathNode) => {
      const trainrunNode = new SgTrainrunNode(
        selectedPathNode.index,
        selectedPathNode.nodeId,
        selectedPathNode.nodeShortName,
        trainrunItem.trainrunId,
        departureTime,
        arrivalTime,
        pathItem.backward,
        new TrackData(pathItem.backward ? 2 : 1),
        selectedPathNode,
        isEndNode,
        pathNode.departurePathSection as unknown as SgTrainrunSection,
        pathNode.arrivalPathSection as unknown as SgTrainrunSection,
      );
      selectedPathNode.trainrunNodes.push(trainrunNode);
      trainrunItems.push(trainrunNode);
    });
  }

  private getNodeTimes(
    trainrunItem: TrainrunItem,
    pathItem: PathItem,
    pathNode: PathNode,
  ): {departureTime: number; arrivalTime: number} {
    let departureTime = pathItem.departureTime;
    let arrivalTime = pathItem.arrivalTime;
    if (trainrunItem.direction !== Direction.ONE_WAY) {
      return {departureTime, arrivalTime};
    }
    if (pathNode.departurePathSection === undefined) {
      departureTime = pathNode.arrivalTime + pathNode.haltezeit;
    }
    if (pathNode.arrivalPathSection === undefined) {
      arrivalTime = pathNode.departureTime - pathNode.haltezeit;
    }
    return {departureTime, arrivalTime};
  }

  private addTrainrunSections(
    trainrunItem: TrainrunItem,
    pathItem: PathItem,
    trainrunItems: SgTrainrunItem[],
  ): void {
    const pathSection = pathItem.getPathSection();
    const pathSections = this.findPathSections(pathSection);
    if (pathSections.length > 0) {
      this.addTrainrunPathSections(pathItem, pathSection, pathSections, trainrunItems);
      return;
    }
    this.addFallbackBranchSections(trainrunItem, pathItem, pathSection, trainrunItems);
  }

  private addFallbackBranchSections(
    trainrunItem: TrainrunItem,
    pathItem: PathItem,
    pathSection: PathSection,
    trainrunItems: SgTrainrunItem[],
  ): void {
    const branches = [
      {
        type: TrainrunBranchType.ArrivalBranchWithSection,
        sections: this.findArrivalBranchSectionsWithSection(pathSection),
      },
      {
        type: TrainrunBranchType.DepartureBranchWithSection,
        sections: this.findDepartureBranchSectionsWithSection(pathSection),
      },
      {
        type: TrainrunBranchType.ArrivalBranchOnly,
        sections: this.findArrivalBranchSectionsOnly(trainrunItem, pathSection),
      },
      {
        type: TrainrunBranchType.DepartureBranchOnly,
        sections: this.findDepartureBranchSectionsOnly(trainrunItem, pathSection),
      },
    ];

    branches.forEach((branch) =>
      this.addBranchSections(pathItem, pathSection, branch.sections, branch.type, trainrunItems),
    );
  }

  private addTrainrunPathSections(
    pathItem: PathItem,
    pathSection: PathSection,
    pathSections: SgPathSection[],
    trainrunItems: SgTrainrunItem[],
  ): void {
    pathSections.forEach((sgPathSection) => {
      const trainrunSection = this.createTrainrunSection(
        pathItem,
        pathSection,
        sgPathSection,
        TrainrunBranchType.Trainrun,
      );
      this.changeOrientationIfNeeded(pathSection, sgPathSection, trainrunSection);
      sgPathSection.trainrunSections.push(trainrunSection);
      trainrunItems.push(trainrunSection);
    });
  }

  private addBranchSections(
    pathItem: PathItem,
    pathSection: PathSection,
    pathSections: SgPathSection[],
    branchType: TrainrunBranchType,
    trainrunItems: SgTrainrunItem[],
  ): void {
    pathSections.forEach((sgPathSection) => {
      const trainrunSection = this.createTrainrunSection(
        pathItem,
        pathSection,
        sgPathSection,
        branchType,
      );
      sgPathSection.trainrunSections.push(trainrunSection);
      trainrunItems.push(trainrunSection);
    });
  }

  private createTrainrunSection(
    pathItem: PathItem,
    pathSection: PathSection,
    sgPathSection: SgPathSection,
    branchType: TrainrunBranchType,
  ): SgTrainrunSection {
    return new SgTrainrunSection(
      sgPathSection.index,
      pathSection.trainrunSectionId,
      pathItem.departureTime,
      pathItem.arrivalTime,
      pathSection.departurePathNode.nodeId,
      pathSection.arrivalPathNode.nodeId,
      pathSection.departurePathNode?.nodeShortName,
      pathSection.arrivalPathNode?.nodeShortName,
      pathSection.departureBranchEndNode?.nodeShortName,
      pathSection.arrivalBranchEndNode?.nodeShortName,
      pathItem.backward,
      pathSection.numberOfStops,
      new TrackData(pathItem.backward ? 2 : 1),
      sgPathSection,
      branchType,
    );
  }

  private changeOrientationIfNeeded(
    pathSection: PathSection,
    sgPathSection: SgPathSection,
    trainrunSection: SgTrainrunSection,
  ): void {
    if (
      this.isSamePathDirection(pathSection, sgPathSection) !==
      this.isSamePath(pathSection, sgPathSection)
    ) {
      trainrunSection.changeOrientation();
    }
  }

  private isEndNode(pathNode: PathNode): boolean {
    if (pathNode.departurePathSection !== undefined && pathNode.arrivalPathSection !== undefined) {
      return pathNode.departurePathSection.backward !== pathNode.arrivalPathSection.backward;
    }
    return pathNode.arrivalPathSection !== undefined || pathNode.departurePathSection !== undefined;
  }

  private findPathNodes(pathNode: PathNode): SgPathNode[] {
    return this.selectedTrainrun.paths
      .filter((path) => path.isNode() && path.getPathNode().nodeId === pathNode.nodeId)
      .map((path) => path.getPathNode());
  }

  private findPathSections(pathSection: PathSection): SgPathSection[] {
    return this.getAllPathSections().filter((section) => this.isSamePath(pathSection, section));
  }

  private getAllPathSections(): SgPathSection[] {
    return this.selectedTrainrun.paths
      .filter((path) => path.isSection())
      .map((path) => path.getPathSection());
  }

  private isSamePathDirection(pathSection: PathSection, sgPathSection: SgPathSection): boolean {
    const departureNodeId = pathSection.backward
      ? pathSection.arrivalPathNode.nodeId
      : pathSection.departurePathNode.nodeId;
    const arrivalNodeId = pathSection.backward
      ? pathSection.departurePathNode.nodeId
      : pathSection.arrivalPathNode.nodeId;
    return this.hasEndpoints(sgPathSection, departureNodeId, arrivalNodeId);
  }

  private isSamePath(pathSection: PathSection, sgPathSection: SgPathSection): boolean {
    const firstNodeId = pathSection.departurePathNode.nodeId;
    const secondNodeId = pathSection.arrivalPathNode.nodeId;
    return (
      this.hasEndpoints(sgPathSection, firstNodeId, secondNodeId) ||
      this.hasEndpoints(sgPathSection, secondNodeId, firstNodeId)
    );
  }

  private hasEndpoints(
    pathSection: SgPathSection,
    departureNodeId: number,
    arrivalNodeId: number,
  ): boolean {
    return (
      pathSection.departureNodeId === departureNodeId && pathSection.arrivalNodeId === arrivalNodeId
    );
  }

  private findArrivalBranchSectionsWithSection(pathSection: PathSection): SgPathSection[] {
    return this.getAllPathSections().filter((section) =>
      this.isNextArrivalBranchSection(pathSection, section),
    );
  }

  private isNextArrivalBranchSection(
    pathSection: PathSection,
    sgPathSection: SgPathSection,
  ): boolean {
    const pathNode = pathSection.arrivalPathNode;
    const sgNode = pathSection.backward
      ? sgPathSection.departurePathNode
      : sgPathSection.arrivalPathNode;
    const expectedNodeId = pathNode?.departurePathSection?.arrivalPathNode?.nodeId;
    const actualNodeId = pathSection.backward
      ? sgNode?.arrivalPathSection?.departurePathNode?.nodeId
      : sgNode?.departurePathSection?.arrivalPathNode?.nodeId;
    const endpointId = pathSection.backward
      ? sgPathSection.departureNodeId
      : sgPathSection.arrivalNodeId;
    return endpointId === pathNode?.nodeId && expectedNodeId === actualNodeId;
  }

  private findDepartureBranchSectionsWithSection(pathSection: PathSection): SgPathSection[] {
    return this.getAllPathSections().filter((section) =>
      this.isNextDepartureBranchSection(pathSection, section),
    );
  }

  private isNextDepartureBranchSection(
    pathSection: PathSection,
    sgPathSection: SgPathSection,
  ): boolean {
    const pathNode = pathSection.departurePathNode;
    const sgNode = pathSection.backward
      ? sgPathSection.arrivalPathNode
      : sgPathSection.departurePathNode;
    const expectedNodeId = pathNode?.arrivalPathSection?.departurePathNode?.nodeId;
    const actualNodeId = pathSection.backward
      ? sgNode?.departurePathSection?.arrivalPathNode?.nodeId
      : sgNode?.arrivalPathSection?.departurePathNode?.nodeId;
    const endpointId = pathSection.backward
      ? sgPathSection.arrivalNodeId
      : sgPathSection.departureNodeId;
    return endpointId === pathNode?.nodeId && expectedNodeId === actualNodeId;
  }

  private findDepartureBranchSectionsOnly(
    trainrunItem: TrainrunItem,
    pathSection: PathSection,
  ): SgPathSection[] {
    if (trainrunItem.direction === Direction.ONE_WAY) {
      return [];
    }
    return this.getAllPathSections().filter((section) =>
      this.isDepartureBranchOnly(pathSection, section),
    );
  }

  private isDepartureBranchOnly(pathSection: PathSection, sgPathSection: SgPathSection): boolean {
    const endpointId = pathSection.backward
      ? sgPathSection.arrivalNodeId
      : sgPathSection.departureNodeId;
    return endpointId === pathSection.departurePathNode?.nodeId;
  }

  private findArrivalBranchSectionsOnly(
    trainrunItem: TrainrunItem,
    pathSection: PathSection,
  ): SgPathSection[] {
    if (trainrunItem.direction === Direction.ONE_WAY) {
      return [];
    }
    return this.getAllPathSections().filter((section) =>
      this.isArrivalBranchOnly(pathSection, section),
    );
  }

  private isArrivalBranchOnly(pathSection: PathSection, sgPathSection: SgPathSection): boolean {
    const endpointId = pathSection.backward
      ? sgPathSection.departureNodeId
      : sgPathSection.arrivalNodeId;
    return endpointId === pathSection.arrivalPathNode?.nodeId;
  }

  private connectTrainrunItems(trainrun: SgTrainrun) {
    trainrun.sgTrainrunItems.forEach((item, index) => {
      if (item.isNode()) {
        this.connectTrainrunNode(item.getTrainrunNode(), trainrun.sgTrainrunItems, index);
      } else if (item.isSection()) {
        this.connectTrainrunSection(item.getTrainrunSection(), trainrun.sgTrainrunItems, index);
      }
    });
  }

  private connectTrainrunNode(node: SgTrainrunNode, items: SgTrainrunItem[], index: number): void {
    node.arrivalPathSection = this.findNeighborSection(items, index, -1);
    node.departurePathSection = this.findNeighborSection(items, index, 1);
  }

  private connectTrainrunSection(
    section: SgTrainrunSection,
    items: SgTrainrunItem[],
    index: number,
  ): void {
    section.departurePathNode = this.getNeighborNode(items, index - 1);
    section.arrivalPathNode = this.getNeighborNode(items, index + 1);
  }

  private findNeighborSection(
    paths: SgTrainrunItem[],
    index: number,
    direction: -1 | 1,
  ): SgTrainrunSection {
    for (
      let currentIndex = index + direction;
      currentIndex >= 0 && currentIndex < paths.length;
      currentIndex += direction
    ) {
      const path = paths[currentIndex];
      if (path instanceof SgTrainrunSection) {
        return path;
      }
    }
    return undefined;
  }

  private getNeighborNode(paths: SgTrainrunItem[], index: number): SgTrainrunNode {
    const path = paths[index];
    return path instanceof SgTrainrunNode ? path : undefined;
  }
}
