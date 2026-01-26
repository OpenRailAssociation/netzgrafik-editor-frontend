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
  private readonly sgSelectedTrainrun$ = this.sgSelectedTrainrunSubject.asObservable();

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
    return this.sgSelectedTrainrun$;
  }

  private render() {
    if (!this.selectedTrainrun) {
      return;
    }
    if (!this.trainrunItems) {
      return;
    }
    this.selectedTrainrun.trainruns = [];
    this.trainrunItems.forEach((trainrunItem) => {
      if (trainrunItem === undefined) {
        return;
      }
      const trainrun = new SgTrainrun(
        trainrunItem.trainrunId,
        trainrunItem.frequency,
        trainrunItem.frequencyOffset,
        trainrunItem.startTime,
        trainrunItem.endTime,
        trainrunItem.title,
        trainrunItem.categoryShortName,
        trainrunItem.colorRef,
        [],
        this.selectedTrainrun,
      );
      const trainrunItems: SgTrainrunItem[] = [];

      trainrunItem.pathItems.forEach((pathItem) => {
        if (
          trainrunItem.direction === Direction.ONE_WAY &&
          pathItem.backward === trainrunItem.leftToRight
        ) {
          return;
        }
        // Node items
        if (pathItem.isNode()) {
          const matchingSelectedPathNodes: SgPathNode[] = this.searchAllPathNodes(
            pathItem.getPathNode(),
          );

          const isEndNode = this.checkIsEndNode(pathItem);
          let departureTime = pathItem.departureTime;
          let arrivalTime = pathItem.arrivalTime;

          const pathNode = pathItem.getPathNode();
          const pathNodeHaltezeit = pathNode.haltezeit;

          matchingSelectedPathNodes.forEach((matchingSelectedPathNode: SgPathNode) => {
            /**
             * For one-way trains, adjust extremity nodes occupation times to use only the stop time
             * (haltezeit), instead of the default 1-hour occupation time used for round-trip
             * trains:
             * - Departure node: occupation from (departure - haltezeit) to departure
             * - Arrival node: occupation from arrival to (arrival + haltezeit)
             *
             * Also, don't use matchingSelectedPathNode (which is related to the path of
             * selectedTrainrun), but use pathItem = pathItem.getPathNode() instead (which is
             * related to the proper trainrunItem):
             */
            if (trainrunItem.direction === Direction.ONE_WAY) {
              if (trainrunItem.leftToRight) {
                if (pathNode.departurePathSection === undefined) {
                  departureTime = pathItem.arrivalTime + pathNodeHaltezeit;
                }
                if (pathNode.arrivalPathSection === undefined) {
                  arrivalTime = pathItem.departureTime - pathNodeHaltezeit;
                }
              } else {
                if (pathNode.departurePathSection === undefined) {
                  arrivalTime = pathItem.departureTime - pathNodeHaltezeit;
                }
                if (pathNode.arrivalPathSection === undefined) {
                  departureTime = pathItem.arrivalTime + pathNodeHaltezeit;
                }
              }
            }

            const trainrunNode = new SgTrainrunNode(
              matchingSelectedPathNode.index,
              matchingSelectedPathNode.nodeId,
              matchingSelectedPathNode.nodeShortName,
              trainrunItem.trainrunId,
              departureTime,
              arrivalTime,
              pathItem.backward,
              new TrackData(this.getTrack(pathItem)),
              matchingSelectedPathNode,
              isEndNode,
            );
            matchingSelectedPathNode.trainrunNodes.push(trainrunNode);
            trainrunItems.push(trainrunNode);
          });
        }

        // Section items
        let isAddSection = false;
        if (pathItem.isSection()) {
          const pathSection = pathItem.getPathSection();
          const pathSections: SgPathSection[] = this.searchAllPathSection(pathSection);
          pathSections.forEach((sgpathSection) => {
            const trainrunSection = new SgTrainrunSection(
              sgpathSection.index,
              pathItem.getPathSection().trainrunSectionId,
              pathItem.departureTime,
              pathItem.arrivalTime,
              pathItem.getPathSection().departurePathNode.nodeId,
              pathItem.getPathSection().arrivalPathNode.nodeId,
              this.getNodeShortName(pathItem.getPathSection().departurePathNode),
              this.getNodeShortName(pathItem.getPathSection().arrivalPathNode),
              this.getNodeShortName(pathItem.getPathSection().departureBranchEndNode),
              this.getNodeShortName(pathItem.getPathSection().arrivalBranchEndNode),
              pathItem.backward,
              pathItem.getPathSection().numberOfStops,
              new TrackData(this.getTrack(pathItem)),
              sgpathSection,
              TrainrunBranchType.Trainrun,
            );

            /**** Adrian Egli (adrian.egli@sbb.ch)
              TODO - This trainrunSection.changeOrientation() is might just a hot fix for special case if there is a trainrun running from
              [ A - B - C - B - D | A - B - B - C | .... or ... ] -> passes two times same node
              There is sill an issue in the CODE - if the trainrun passes the second time a node, the in-/out
              branching edge will not all be rendered!
               */
            if (
              this.isInDirectedPath(pathSection, sgpathSection) !==
              this.isInPath(pathSection, sgpathSection)
            ) {
              trainrunSection.changeOrientation();
            }
            sgpathSection.trainrunSections.push(trainrunSection);
            trainrunItems.push(trainrunSection);
            isAddSection = true;
          });
          if (!isAddSection) {
            // ----- all arrival path section with incoming section
            const arravebelPathSectionWithSection: SgPathSection[] =
              this.searchAllArrivalPathSectionBranchWithSection(pathSection);
            arravebelPathSectionWithSection.forEach((pathSectionBranch) => {
              const trainrunSection = new SgTrainrunSection(
                pathSectionBranch.index,
                pathItem.getPathSection().trainrunSectionId,
                pathItem.departureTime,
                pathItem.arrivalTime,
                pathItem.getPathSection().departurePathNode.nodeId,
                pathItem.getPathSection().arrivalPathNode.nodeId,
                this.getNodeShortName(pathItem.getPathSection().departurePathNode),
                this.getNodeShortName(pathItem.getPathSection().arrivalPathNode),
                this.getNodeShortName(pathItem.getPathSection().departureBranchEndNode),
                this.getNodeShortName(pathItem.getPathSection().arrivalBranchEndNode),
                pathItem.backward,
                pathItem.getPathSection().numberOfStops,
                new TrackData(this.getTrack(pathItem)),
                pathSectionBranch,
                TrainrunBranchType.ArrivalBranchWithSection,
              );

              pathSectionBranch.trainrunSections.push(trainrunSection);
              trainrunItems.push(trainrunSection);
            });

            // ----- all departure path section with outgoing section
            const departurePathSectionBranchWithSection: SgPathSection[] =
              this.searchAllDeparturePathSectionBranchWithSection(pathSection);
            departurePathSectionBranchWithSection.forEach((pathSectionBranch) => {
              const trainrunSection = new SgTrainrunSection(
                pathSectionBranch.index,
                pathItem.getPathSection().trainrunSectionId,
                pathItem.departureTime,
                pathItem.arrivalTime,
                pathItem.getPathSection().departurePathNode.nodeId,
                pathItem.getPathSection().arrivalPathNode.nodeId,
                this.getNodeShortName(pathItem.getPathSection().departurePathNode),
                this.getNodeShortName(pathItem.getPathSection().arrivalPathNode),
                this.getNodeShortName(pathItem.getPathSection().departureBranchEndNode),
                this.getNodeShortName(pathItem.getPathSection().arrivalBranchEndNode),
                pathItem.backward,
                pathItem.getPathSection().numberOfStops,
                new TrackData(this.getTrack(pathItem)),
                pathSectionBranch,
                TrainrunBranchType.DepartureBranchWithSection,
              );

              pathSectionBranch.trainrunSections.push(trainrunSection);
              trainrunItems.push(trainrunSection);
            });

            // ----- all arrival path section (branch only)
            const arrivalPathSectionBranchOnly: SgPathSection[] =
              this.searchAllArrivalPathSectionBranchOnly(pathSection);
            arrivalPathSectionBranchOnly.forEach((pathSectionBranch) => {
              const trainrunSection = new SgTrainrunSection(
                pathSectionBranch.index,
                pathItem.getPathSection().trainrunSectionId,
                pathItem.departureTime,
                pathItem.arrivalTime,
                pathItem.getPathSection().departurePathNode.nodeId,
                pathItem.getPathSection().arrivalPathNode.nodeId,
                this.getNodeShortName(pathItem.getPathSection().departurePathNode),
                this.getNodeShortName(pathItem.getPathSection().arrivalPathNode),
                this.getNodeShortName(pathItem.getPathSection().departureBranchEndNode),
                this.getNodeShortName(pathItem.getPathSection().arrivalBranchEndNode),
                pathItem.backward,
                pathItem.getPathSection().numberOfStops,
                new TrackData(this.getTrack(pathItem)),
                pathSectionBranch,
                TrainrunBranchType.ArrivalBranchOnly,
              );
              pathSectionBranch.trainrunSections.push(trainrunSection);
              trainrunItems.push(trainrunSection);
            });

            // ----- all depature path section (branch only)
            const departurePathSectionBranchOnly: SgPathSection[] =
              this.searchAllDeparturePathSectionBranchOnly(pathSection);
            departurePathSectionBranchOnly.forEach((pathSectionBranch) => {
              const trainrunSection = new SgTrainrunSection(
                pathSectionBranch.index,
                pathSection.trainrunSectionId,
                pathItem.departureTime,
                pathItem.arrivalTime,
                pathItem.getPathSection().departurePathNode.nodeId,
                pathItem.getPathSection().arrivalPathNode.nodeId,
                this.getNodeShortName(pathItem.getPathSection().departurePathNode),
                this.getNodeShortName(pathItem.getPathSection().arrivalPathNode),
                this.getNodeShortName(pathItem.getPathSection().departureBranchEndNode),
                this.getNodeShortName(pathItem.getPathSection().arrivalBranchEndNode),
                pathItem.backward,
                pathItem.getPathSection().numberOfStops,
                new TrackData(this.getTrack(pathItem)),
                pathSectionBranch,
                TrainrunBranchType.DepartureBranchOnly,
              );
              pathSectionBranch.trainrunSections.push(trainrunSection);
              trainrunItems.push(trainrunSection);
            });
          }
        }
      });
      trainrunItems.forEach((trainrunItem) => {
        trainrun.sgTrainrunItems.push(trainrunItem);
      });
      this.addNodesSectionRelation(trainrun);
      this.selectedTrainrun.trainruns.push(trainrun);
    });
    this.sgSelectedTrainrunSubject.next(this.selectedTrainrun);
  }

  private getNodeShortName(pathNode: PathNode) {
    if (pathNode) {
      return pathNode.nodeShortName;
    }
    return undefined;
  }

  private checkIsEndNode(path: PathItem): boolean {
    if (!path.isNode()) {
      return false;
    }
    const pn = path.getPathNode();
    if (pn.departurePathSection !== undefined && pn.arrivalPathSection !== undefined) {
      return pn.departurePathSection.backward !== pn.arrivalPathSection.backward;
    }
    return pn.arrivalPathSection !== undefined || pn.departurePathSection !== undefined;
  }

  private getTrack(path: PathItem) {
    if (path.backward) {
      return 2;
    } else {
      return 1;
    }
  }

  private searchAllPathNodes(pathNode: PathNode): SgPathNode[] {
    const path: SgPathNode[] = [];
    this.selectedTrainrun.paths.forEach((sgPath) => {
      if (sgPath.isNode()) {
        const sgPathNode = sgPath.getPathNode();
        if (sgPathNode.nodeId === pathNode.getPathNode().nodeId) {
          path.push(sgPathNode);
        }
      }
    });
    return path;
  }

  private searchAllPathSection(pathSection: PathSection): SgPathSection[] {
    const path: SgPathSection[] = [];
    this.selectedTrainrun.paths.forEach((sgPath) => {
      if (sgPath.isSection()) {
        const sgPathSection = sgPath.getPathSection();
        if (this.isInPath(pathSection, sgPathSection)) {
          path.push(sgPathSection);
        }
      }
    });
    return path;
  }

  isInDirectedPath(pathSection: PathSection, sgPathSection: SgPathSection): boolean {
    return (
      (!pathSection.backward &&
        sgPathSection.arrivalNodeId === pathSection.arrivalPathNode.nodeId &&
        sgPathSection.departureNodeId === pathSection.departurePathNode.nodeId) ||
      (pathSection.backward &&
        sgPathSection.arrivalNodeId === pathSection.departurePathNode.nodeId &&
        sgPathSection.departureNodeId === pathSection.arrivalPathNode.nodeId)
    );
  }

  isInPath(pathSection: PathSection, sgPathSection: SgPathSection): boolean {
    return (
      (sgPathSection.arrivalNodeId === pathSection.arrivalPathNode.nodeId &&
        sgPathSection.departureNodeId === pathSection.departurePathNode.nodeId) ||
      (sgPathSection.arrivalNodeId === pathSection.departurePathNode.nodeId &&
        sgPathSection.departureNodeId === pathSection.arrivalPathNode.nodeId)
    );
  }

  private searchAllArrivalPathSectionBranchWithSection(pathSection: PathSection): SgPathSection[] {
    const paths: SgPathSection[] = [];
    this.selectedTrainrun.paths.forEach((path) => {
      if (path.isSection()) {
        const sgPathSection = path.getPathSection();
        if (this.isNextArrivalPathSectionBranch(pathSection, sgPathSection)) {
          paths.push(sgPathSection);
        }
      }
    });
    return paths;
  }

  isNextArrivalPathSectionBranch(pathSection: PathSection, sgPathSection: SgPathSection): boolean {
    if (
      !pathSection.backward &&
      sgPathSection.arrivalNodeId === pathSection.arrivalPathNode.nodeId
    ) {
      if (
        pathSection.arrivalPathNode.departurePathSection &&
        pathSection.arrivalPathNode.departurePathSection.arrivalPathNode
      ) {
        if (
          sgPathSection.arrivalPathNode.departurePathSection &&
          sgPathSection.arrivalPathNode.departurePathSection.arrivalPathNode
        ) {
          if (
            pathSection.arrivalPathNode.departurePathSection.arrivalPathNode.nodeId ===
            sgPathSection.arrivalPathNode.departurePathSection.arrivalPathNode.nodeId
          ) {
            return true;
          }
        }
      }
    }
    if (
      pathSection.backward &&
      sgPathSection.departureNodeId === pathSection.arrivalPathNode.nodeId
    ) {
      if (
        pathSection.arrivalPathNode.departurePathSection &&
        pathSection.arrivalPathNode.departurePathSection.arrivalPathNode
      ) {
        if (
          sgPathSection.departurePathNode.arrivalPathSection &&
          sgPathSection.departurePathNode.arrivalPathSection.departurePathNode
        ) {
          if (
            pathSection.arrivalPathNode.departurePathSection.arrivalPathNode.nodeId ===
            sgPathSection.departurePathNode.arrivalPathSection.departurePathNode.nodeId
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private searchAllDeparturePathSectionBranchWithSection(
    pathSection: PathSection,
  ): SgPathSection[] {
    const paths: SgPathSection[] = [];
    this.selectedTrainrun.paths.forEach((path) => {
      if (path.isSection()) {
        const sgPathSection = path.getPathSection();
        if (this.getNextDeparturePathSectionBranch(pathSection, sgPathSection)) {
          paths.push(sgPathSection);
        }
      }
    });
    return paths;
  }

  getNextDeparturePathSectionBranch(
    pathSection: PathSection,
    sgPathSection: SgPathSection,
  ): boolean {
    if (
      pathSection.backward &&
      sgPathSection.arrivalNodeId === pathSection.departurePathNode.nodeId
    ) {
      if (
        pathSection.departurePathNode.arrivalPathSection &&
        pathSection.departurePathNode.arrivalPathSection.departurePathNode
      ) {
        if (
          sgPathSection.arrivalPathNode.departurePathSection &&
          sgPathSection.arrivalPathNode.departurePathSection.arrivalPathNode
        ) {
          if (
            pathSection.departurePathNode.arrivalPathSection.departurePathNode.nodeId ===
            sgPathSection.arrivalPathNode.departurePathSection.arrivalPathNode.nodeId
          ) {
            return true;
          }
        }
      }
    }
    if (
      !pathSection.backward &&
      sgPathSection.departureNodeId === pathSection.departurePathNode.nodeId
    ) {
      if (
        pathSection.departurePathNode.arrivalPathSection &&
        pathSection.departurePathNode.arrivalPathSection.departurePathNode
      ) {
        if (
          sgPathSection.departurePathNode.arrivalPathSection &&
          sgPathSection.departurePathNode.arrivalPathSection.departurePathNode
        ) {
          if (
            pathSection.departurePathNode.arrivalPathSection.departurePathNode.nodeId ===
            sgPathSection.departurePathNode.arrivalPathSection.departurePathNode.nodeId
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private searchAllDeparturePathSectionBranchOnly(pathSection: PathSection): SgPathSection[] {
    const paths: SgPathSection[] = [];
    this.selectedTrainrun.paths.forEach((path) => {
      if (path.isSection()) {
        const sgPathSection = path.getPathSection();
        if (this.isDeparturePathNodeInBranchOnly(pathSection, sgPathSection)) {
          paths.push(sgPathSection);
        }
      }
    });
    return paths;
  }

  isDeparturePathNodeInBranchOnly(pathSection: PathSection, sgPathSection: SgPathSection): boolean {
    return (
      (pathSection.backward &&
        sgPathSection.arrivalNodeId === pathSection.departurePathNode.nodeId) ||
      (!pathSection.backward &&
        sgPathSection.departureNodeId === pathSection.departurePathNode.nodeId)
    );
  }

  private searchAllArrivalPathSectionBranchOnly(pathSection: PathSection): SgPathSection[] {
    const paths: SgPathSection[] = [];
    this.selectedTrainrun.paths.forEach((path) => {
      if (path.isSection()) {
        const sgPathSection = path.getPathSection();
        if (this.isArrivalPathNodePathNodeInBranchOnly(pathSection, sgPathSection)) {
          paths.push(sgPathSection);
        }
      }
    });
    return paths;
  }

  isArrivalPathNodePathNodeInBranchOnly(
    pathSection: PathSection,
    sgPathSection: SgPathSection,
  ): boolean {
    return (
      (!pathSection.backward &&
        sgPathSection.arrivalNodeId === pathSection.arrivalPathNode.nodeId) ||
      (pathSection.backward && sgPathSection.departureNodeId === pathSection.arrivalPathNode.nodeId)
    );
  }

  private addNodesSectionRelation(trainrun: SgTrainrun) {
    trainrun.sgTrainrunItems.forEach((sgTrainrunItems, index) => {
      if (sgTrainrunItems.isNode()) {
        const pathNode = sgTrainrunItems.getTrainrunNode();
        pathNode.arrivalPathSection = this.getPreviousTrainrunSection(
          trainrun.sgTrainrunItems,
          index,
        );
        pathNode.departurePathSection = this.getNextTrainrunSection(
          trainrun.sgTrainrunItems,
          index,
        );
      }
      if (sgTrainrunItems.isSection()) {
        const pathSection = sgTrainrunItems.getTrainrunSection();
        pathSection.departurePathNode = this.getLastPathNode(trainrun.sgTrainrunItems, index);
        pathSection.arrivalPathNode = this.getPreviousPathNode(trainrun.sgTrainrunItems, index);
      }
    });
  }

  private getPreviousTrainrunSection(paths: SgTrainrunItem[], i: number): SgTrainrunSection {
    if (i > 0) {
      const path = paths[i - 1];
      if (path instanceof SgTrainrunSection) {
        return path;
      } else {
        return this.getPreviousTrainrunSection(paths, i - 1);
      }
    }
    return undefined;
  }

  private getNextTrainrunSection(paths: SgTrainrunItem[], i: number): SgTrainrunSection {
    if (i + 1 < paths.length) {
      const path = paths[i + 1];
      if (path instanceof SgTrainrunSection) {
        return path;
      } else {
        return this.getNextTrainrunSection(paths, i + 1);
      }
    }
    return undefined;
  }

  private getLastPathNode(paths: SgTrainrunItem[], i: number): SgTrainrunNode {
    if (i > 0) {
      const path = paths[i - 1];
      if (path instanceof SgTrainrunNode) {
        return path;
      }
    }
    return undefined;
  }

  private getPreviousPathNode(paths: SgTrainrunItem[], i: number): SgTrainrunNode {
    if (i + 1 < paths.length) {
      const path = paths[i + 1];
      if (path instanceof SgTrainrunNode) {
        return path;
      }
    }
    return undefined;
  }
}
