import {Injectable, OnDestroy} from "@angular/core";
import {Trainrun} from "../../models/trainrun.model";
import {TrainrunItem} from "../model/trainrunItem";
import {PathItem} from "../model/pathItem";
import {GeneralViewFunctions} from "../../view/util/generalViewFunctions";
import {PathNode} from "../model/pathNode";
import {PathSection} from "../model/pathSection";
import {Node} from "../../models/node.model";
import {TrainrunIterator} from "../../services/util/trainrun.iterator";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {TrainrunService} from "../../services/data/trainrun.service";
import {FilterService} from "../../services/ui/filter.service";
import {takeUntil} from "rxjs/operators";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {TrackData} from "../model/trackData";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {EditorMode} from "../../view/editor-menu/editor-mode";
import {TrainrunTemplatePathAlignmentType} from "../model/enum/trainrun-template-path-alignment-type";
import {IsTrainrunSelectedService} from "../../services/data/is-trainrun-section.service";
import {NodeService} from "../../services/data/node.service";
import {TrainrunBranchType} from "../model/enum/trainrun-branch-type-type";
import {MultiSelectNodeGraph} from "../../utils/multi-select-node-graph";
import {Direction} from "src/app/data-structures/business.data.structures";
import {TrainrunsectionHelper} from "src/app/services/util/trainrunsection.helper";

@Injectable({
  providedIn: "root",
})
export class Sg1LoadTrainrunItemService implements OnDestroy {
  private readonly trainrunItemSubject = new BehaviorSubject<TrainrunItem>(undefined);
  private readonly trainrunItem$ = this.trainrunItemSubject.asObservable();

  private readonly trainrunItemsSubject = new BehaviorSubject<TrainrunItem[]>(undefined);
  private readonly trainrunItems$ = this.trainrunItemsSubject.asObservable();

  trainruns: Trainrun[];
  trainrunSections: TrainrunSection[];
  trainrunIdSelectedByClick: number;
  private cachedTrainrunItems: TrainrunItem = undefined;

  private readonly destroyed$ = new Subject<void>();
  private forwardTrainrunSectionGroup: TrainrunSectionGroup[];

  private doInit = true;

  constructor(
    private readonly nodeService: NodeService,
    private readonly trainrunService: TrainrunService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly filterService: FilterService,
    private readonly isTrainrunSelectedService: IsTrainrunSelectedService,
    private readonly uiInteractionService: UiInteractionService,
  ) {
    this.isTrainrunSelectedService
      .getTrainrunIdSelectedByClick()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((trainrunIdSelectedByClick) => {
        if (this.trainrunIdSelectedByClick !== trainrunIdSelectedByClick) {
          this.trainrunIdSelectedByClick = trainrunIdSelectedByClick;
          this.render();
        }
      });

    this.trainrunService.trainruns.pipe(takeUntil(this.destroyed$)).subscribe((trainruns) => {
      if (this.trainruns !== trainruns) {
        this.trainruns = trainruns;
        this.render();
      }
    });

    this.trainrunSectionService.trainrunSections
      .pipe(takeUntil(this.destroyed$))
      .subscribe((trainrunSections) => {
        this.trainrunSections = trainrunSections;
        this.render();
      });

    this.filterService.filter.pipe(takeUntil(this.destroyed$)).subscribe(() => {
      this.render();
    });

    this.uiInteractionService.setEditorModeObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        this.render();
      });
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  getTrainrunItem(): Observable<TrainrunItem> {
    return this.trainrunItem$;
  }

  getTrainrunItems(): Observable<TrainrunItem[]> {
    return this.trainrunItems$;
  }

  private render() {
    if (this.uiInteractionService.getEditorMode() !== EditorMode.StreckengrafikEditing) {
      return;
    }

    if (!this.trainruns) {
      return;
    }

    if (this.trainruns.length === 0) {
      return;
    }

    if (!this.trainrunSections) {
      return;
    }

    if (this.trainrunSections.length === 0) {
      return;
    }

    if (!this.uiInteractionService.isMultiSelectedNodesCorridorEnabled() || this.doInit) {
      // if 1st time called rendering, prepare data
      this.doInit = false;

      // use the selected trainrun as template (corridor)
      this.createCorridorFromSelectedTrainrun();
    }

    if (this.uiInteractionService.isMultiSelectedNodesCorridorEnabled()) {
      // use the selected nodes as template (corridor)
      this.createCorridorFromSelectedNodes();
    }

    if (this.cachedTrainrunItems !== undefined) {
      // inform all listeners that the trainrunItem (cached or loaded has changed)
      this.trainrunItemSubject.next(this.cachedTrainrunItems);
      this.trainrunItemsSubject.next(this.loadTrainrunItems(this.cachedTrainrunItems));
    }
  }

  private createCorridorFromSelectedTrainrun() {
    const selectedTrainrun: Trainrun = this.getSelectedTrainrun();
    if (selectedTrainrun) {
      if (selectedTrainrun.selected()) {
        // The template path (along which the graphical timetable is projected) does
        // not support current trains with partial cancellations.
        const ts: TrainrunSection = this.trainrunSectionService
          .getAllTrainrunSectionsForTrainrun(selectedTrainrun.getId())
          .find((ts) => true);
        const loadeddata = this.loadTrainrunItem(ts, true);
        this.cachedTrainrunItems = loadeddata.trainrunItem;
      }
    }
  }

  private createCorridorFromSelectedNodes() {
    // check whether there are selected nodes to process
    const nodes = this.nodeService.getNodes().filter((n: Node) => n.selected());
    if (nodes.length < 2) {
      return;
    }

    // create temporary cached trainrun item object (emulate a trainrun)
    this.cachedTrainrunItems = new TrainrunItem(
      undefined,
      60,
      0,
      0,
      1,
      undefined,
      undefined,
      undefined,
      [],
      false,
      Direction.ROUND_TRIP,
    );

    // create a new graph object
    const graph = new MultiSelectNodeGraph(this.nodeService, this.trainrunSectionService);

    // create graph from nodes (Netzgrafik data)
    const edgeLists = graph.convertNetzgrafikSubNodesToGraph(nodes);

    // get all starting ending nodes (degree == 1)
    const endStartingVertices = graph.getStartEndingVertices();

    // build corridor
    const corridor =
      endStartingVertices.length === 2
        ? this.createSimplePathFromStartToEndingNodes(graph, nodes, endStartingVertices)
        : this.createLongestPathFromNodes(graph, nodes);

    // convert corridor to path elements
    corridor.forEach((n, idx, nodArray) => {
      if (idx > 0) {
        const e = edgeLists.find(
          (e) =>
            (e.from === nodArray[idx - 1].getId() && e.to === nodArray[idx].getId()) ||
            (e.to === nodArray[idx - 1].getId() && e.from === nodArray[idx].getId()),
        );
        const meanTravelTime = e === undefined ? 1 : e.meanTravelTime;
        this.makePathElement(nodArray[idx - 1].getId(), nodArray[idx].getId(), meanTravelTime);
      }
    });

    // clean up
    this.trainrunService.unselectAllTrainruns(false);
    this.nodeService.unselectAllNodes(false);
  }

  private createLongestPathFromNodes(graph: MultiSelectNodeGraph, nodes: Node[]) {
    // sort from left top - down (1st draft)
    const sortedNode = nodes.sort((n1, n2) => {
      if (n1.getPositionX() === n2.getPositionX()) {
        return n1.getPositionY() - n2.getPositionY();
      }
      return n1.getPositionX() - n2.getPositionX();
    });

    let corridor = [];
    sortedNode.forEach((n1) => {
      sortedNode.forEach((n2) => {
        const p = graph.getPath(n1.getId(), n2.getId());
        if (p.end) {
          if (p.path.length > corridor.length) {
            corridor = Object.assign([], p.path);
            if (corridor.length === sortedNode.length) {
              return;
            }
          }
        }
      });
      if (corridor.length === sortedNode.length) {
        return;
      }
    });
    return corridor;
  }

  private createSimplePathFromStartToEndingNodes(
    graph: MultiSelectNodeGraph,
    nodes: Node[],
    endStartingVertices: number[],
  ): number[] {
    const n1 = nodes.find((n) => n.getId() === endStartingVertices[0]);
    const n2 = nodes.find((n) => n.getId() === endStartingVertices[1]);
    const startEndNodes = [n1, n2];
    const sortedStartEndNodes = startEndNodes.sort((n1, n2) => {
      if (n1.getPositionX() === n2.getPositionX()) {
        return n1.getPositionY() - n2.getPositionY();
      }
      return n1.getPositionX() - n2.getPositionX();
    });
    const p = graph.getPath(sortedStartEndNodes[0].getId(), sortedStartEndNodes[1].getId());
    return Object.assign([], p.path);
  }

  private makePathElement(nodeId1: number, nodeId2: number, travelTime: number) {
    const n1 = new PathNode(0, 0, nodeId1, undefined, 0, undefined, false);
    const n2 = new PathNode(travelTime, travelTime, nodeId2, undefined, 1, undefined, false);
    const node1 = this.nodeService.getNodeFromId(n1.nodeId);
    n1.nodeShortName = node1.getBetriebspunktName();
    const node2 = this.nodeService.getNodeFromId(n2.nodeId);
    n2.nodeShortName = node2.getBetriebspunktName();

    let ts12 = this.trainrunSectionService
      .getTrainrunSections()
      .find(
        (ts: TrainrunSection) =>
          (ts.getSourceNodeId() === n1.nodeId && ts.getTargetNodeId() === n2.nodeId) ||
          (ts.getSourceNodeId() === n2.nodeId && ts.getTargetNodeId() === n1.nodeId),
      );
    if (ts12 === undefined) {
      ts12 = new TrainrunSection();
      ts12.setSourceNode(node1);
      ts12.setTargetNode(node2);
      ts12.setTravelTime(travelTime);
    }
    const s12 = new PathSection(
      ts12.getId(),
      0,
      travelTime,
      0,
      undefined,
      false, //(ts12.getSourceNodeId() === n2.nodeId && ts12.getTargetNodeId() === n1.nodeId),
      true,
      undefined,
      undefined,
      TrainrunBranchType.Trainrun,
      n1,
      n2,
    );
    if (this.cachedTrainrunItems.pathItems.length === 0) {
      this.cachedTrainrunItems.pathItems.push(n1);
    }
    this.cachedTrainrunItems.pathItems.push(s12);
    this.cachedTrainrunItems.pathItems.push(n2);
  }

  private getTurnaroundStartNodeForward(
    fromNode: Node,
    trainrunSection: TrainrunSection,
    trainrun: Trainrun,
  ): number {
    const depTime = fromNode.getDepartureConsecutiveTime(trainrunSection);

    let wendeTime =
      (Math.max(trainrun.getFrequency(), 60) - 2 * fromNode.getArrivalTime(trainrunSection)) %
      trainrun.getFrequency();
    if (wendeTime < 0) {
      wendeTime += trainrun.getFrequency();
    }
    if (wendeTime < trainrun.getTrainrunCategory().minimalTurnaroundTime) {
      wendeTime += trainrun.getFrequency();
    }
    return depTime - wendeTime;
  }

  private getTurnaroundEndNodeForward(
    toNode: Node,
    trainrunSection: TrainrunSection,
    trainrun: Trainrun,
  ): number {
    const arrTime = toNode.getArrivalConsecutiveTime(trainrunSection);

    let wendeTime =
      (Math.max(trainrun.getFrequency(), 60) - 2 * toNode.getArrivalTime(trainrunSection)) %
      trainrun.getFrequency();
    if (wendeTime < 0) {
      wendeTime += trainrun.getFrequency();
    }
    if (wendeTime < trainrun.getTrainrunCategory().minimalTurnaroundTime) {
      wendeTime += trainrun.getFrequency();
    }
    return arrTime + wendeTime;
  }

  private getTurnaroundStartNodeBackward(
    fromNode: Node,
    trainrunSection: TrainrunSection,
    trainrun: Trainrun,
  ): number {
    return this.getTurnaroundStartNodeForward(fromNode, trainrunSection, trainrun);
  }

  private getTurnaroundEndNodeBackward(
    fromNode: Node,
    trainrunSection: TrainrunSection,
    trainrun: Trainrun,
  ): number {
    return this.getTurnaroundEndNodeForward(fromNode, trainrunSection, trainrun);
  }

  private determineForwardBackwardNodes(
    trainrunSection: TrainrunSection,
    onlyForward: boolean,
  ): {
    startForwardNode: Node;
    startBackwardNode: Node;
    visitedTrainrunSections: TrainrunSection[];
  } {
    let visitedTrainrunSections: TrainrunSection[] = [];
    const trainrun = trainrunSection.getTrainrun();

    const bothEndNodes = this.trainrunService.getBothEndNodesFromTrainrunPart(trainrunSection);

    const startForwardBackwardNode = GeneralViewFunctions.getStartForwardAndBackwardNode(
      bothEndNodes.endNode1,
      bothEndNodes.endNode2,
    );

    if (onlyForward) {
      const tsg = this.trainrunSectionGroup(
        trainrun.getId(),
        startForwardBackwardNode.startForwardNode,
        true,
      );
      this.forwardTrainrunSectionGroup = tsg.trainrunSectionGroups;
      visitedTrainrunSections = tsg.visitedTrainrunSections;
    } else {
      const extractedInfo = this.isTrainRunWayDirectionBackward(
        trainrun,
        startForwardBackwardNode.startForwardNode,
        startForwardBackwardNode.startBackwardNode,
        this.forwardTrainrunSectionGroup,
      );
      visitedTrainrunSections = extractedInfo.visitedTrainrunSections;
      if (extractedInfo.check) {
        const nextStartForwardNode = startForwardBackwardNode.startBackwardNode;
        const nextStartBackwardNode = startForwardBackwardNode.startForwardNode;
        startForwardBackwardNode.startForwardNode = nextStartForwardNode;
        startForwardBackwardNode.startBackwardNode = nextStartBackwardNode;
      }
    }
    return {
      startForwardNode: startForwardBackwardNode.startForwardNode,
      startBackwardNode: startForwardBackwardNode.startBackwardNode,
      visitedTrainrunSections: visitedTrainrunSections,
    };
  }

  private loadTrainrunItem(
    trainrunSection: TrainrunSection,
    onlyForward: boolean,
  ): {
    trainrunItem: TrainrunItem;
    visitedTrainrunSections: TrainrunSection[];
  } {
    let visitedTrainrunSections: TrainrunSection[] = [];
    let index = 0;
    let trainrunStartTime = 0;
    let trainrunEndTime = 0;

    const trainrun: Trainrun = this.trainrunService.getTrainrunFromId(
      trainrunSection.getTrainrunId(),
    );

    const pathItems: PathItem[] = [];
    if (this.trainrunService.getTrainrunFromId(trainrun.getId()) === undefined) {
      return undefined;
    }

    const forwardBackwardNodes = this.determineForwardBackwardNodes(trainrunSection, onlyForward);

    const tsgForward = this.trainrunSectionGroup(
      trainrun.getId(),
      forwardBackwardNodes.startForwardNode,
      true,
    );
    const forwardTrainrunSectionGroup = tsgForward.trainrunSectionGroups;
    visitedTrainrunSections = visitedTrainrunSections.concat(tsgForward.visitedTrainrunSections);

    const tsgBackward = this.trainrunSectionGroup(
      trainrun.getId(),
      forwardBackwardNodes.startBackwardNode,
      false,
    );
    const backwardTrainrunSectionGroup = tsgBackward.trainrunSectionGroups;
    visitedTrainrunSections = visitedTrainrunSections.concat(tsgBackward.visitedTrainrunSections);

    let forwardStartNode: PathNode = undefined;
    let forwardEndNode: PathNode = undefined;
    let backwardStartNode: PathNode = undefined;
    let backwardEndNode: PathNode = undefined;

    forwardTrainrunSectionGroup.forEach((trainrunSectionGroup) => {
      const trainrunSection = trainrunSectionGroup.trainrunSectionWithNodes.trainrunSection;
      const fromNode = trainrunSectionGroup.trainrunSectionWithNodes.fromNode;
      const toNode = trainrunSectionGroup.trainrunSectionWithNodes.toNode;
      const fromNodeHaltezeit = fromNode.getTrainrunCategoryHaltezeit();
      const toNodeHaltezeit = toNode.getTrainrunCategoryHaltezeit();
      const trainrunFachCategory = trainrun.getTrainrunCategory().fachCategory;
      let toTrainrunSection = undefined;
      if (trainrunSectionGroup.toTrainrunSectionWithNodes) {
        toTrainrunSection = trainrunSectionGroup.toTrainrunSectionWithNodes.trainrunSection;
      }

      // First Node;
      if (fromNode.getId() === forwardBackwardNodes.startForwardNode.getId()) {
        const sourcePathNode = new PathNode(
          fromNode.getDepartureConsecutiveTime(trainrunSection),
          this.getTurnaroundStartNodeForward(fromNode, trainrunSection, trainrun),
          fromNode.getId(),
          fromNode.getBetriebspunktName(),
          index++,
          new TrackData(1), //forward track 1
          false,
          true,
          fromNodeHaltezeit[trainrunFachCategory].haltezeit,
          !this.filterService.filterNode(fromNode),
        );
        trainrunStartTime = sourcePathNode.departureTime;
        forwardStartNode = sourcePathNode;
        pathItems.push(sourcePathNode);
      }

      const pathSection = new PathSection(
        trainrunSection.getId(),
        fromNode.getDepartureConsecutiveTime(trainrunSection),
        toNode.getArrivalConsecutiveTime(trainrunSection),
        trainrunSection.getNumberOfStops(),
        new TrackData(1),
        false,
      );
      trainrunEndTime = toNode.getArrivalConsecutiveTime(trainrunSection);
      pathItems.push(pathSection);

      let arrivalTime = toNode.getArrivalConsecutiveTime(trainrunSection);
      if (toTrainrunSection) {
        arrivalTime = toNode.getDepartureConsecutiveTime(toTrainrunSection);
      }
      const targetPathNode = new PathNode(
        arrivalTime,
        toNode.getArrivalConsecutiveTime(trainrunSection),
        toNode.getId(),
        toNode.getBetriebspunktName(),
        index++,
        new TrackData(1), // forward
        false,
        true,
        toNodeHaltezeit[trainrunFachCategory].haltezeit,
        !this.filterService.filterNode(toNode),
      );

      if (toNode.getId() === forwardBackwardNodes.startBackwardNode.getId()) {
        targetPathNode.departureTime = this.getTurnaroundEndNodeForward(
          toNode,
          trainrunSection,
          trainrun,
        );
        forwardEndNode = targetPathNode;
      }
      pathItems.push(targetPathNode);
    });
    if (!onlyForward) {
      backwardTrainrunSectionGroup.forEach((trainrunSectionGroup) => {
        const trainrunSection = trainrunSectionGroup.trainrunSectionWithNodes.trainrunSection;
        const fromNode = trainrunSectionGroup.trainrunSectionWithNodes.fromNode;
        const toNode = trainrunSectionGroup.trainrunSectionWithNodes.toNode;
        const fromNodeHaltezeit = fromNode.getTrainrunCategoryHaltezeit();
        const toNodeHaltezeit = toNode.getTrainrunCategoryHaltezeit();
        const trainrunFachCategory = trainrun.getTrainrunCategory().fachCategory;
        let toTrainrunSection = undefined;
        if (trainrunSectionGroup.toTrainrunSectionWithNodes) {
          toTrainrunSection = trainrunSectionGroup.toTrainrunSectionWithNodes.trainrunSection;
        }
        // Erster Node
        if (fromNode.getId() === forwardBackwardNodes.startBackwardNode.getId()) {
          const sourcePathNode = new PathNode(
            fromNode.getDepartureConsecutiveTime(trainrunSection),
            this.getTurnaroundStartNodeBackward(fromNode, trainrunSection, trainrun),
            fromNode.getId(),
            fromNode.getBetriebspunktName(),
            index-- - 1,
            new TrackData(2), // backward
            true,
            true,
            fromNodeHaltezeit[trainrunFachCategory].haltezeit,
            !this.filterService.filterNode(fromNode),
          );
          backwardStartNode = sourcePathNode;
          pathItems.push(sourcePathNode);
        }

        const pathSection = new PathSection(
          trainrunSection.getId(),
          fromNode.getDepartureConsecutiveTime(trainrunSection),
          toNode.getArrivalConsecutiveTime(trainrunSection),
          trainrunSection.getNumberOfStops(),
          new TrackData(1),
          true,
        );
        trainrunEndTime = toNode.getArrivalConsecutiveTime(trainrunSection);
        pathItems.push(pathSection);

        let arrivalTime = toNode.getArrivalConsecutiveTime(trainrunSection);
        if (toTrainrunSection) {
          arrivalTime = toNode.getDepartureConsecutiveTime(toTrainrunSection);
        }
        const targetPathNode = new PathNode(
          arrivalTime,
          toNode.getArrivalConsecutiveTime(trainrunSection),
          toNode.getId(),
          toNode.getBetriebspunktName(),
          index-- - 1,
          new TrackData(2), // backward
          true,
          true,
          toNodeHaltezeit[trainrunFachCategory].haltezeit,
          !this.filterService.filterNode(toNode),
        );

        if (toNode.getId() === forwardBackwardNodes.startForwardNode.getId()) {
          targetPathNode.departureTime = this.getTurnaroundEndNodeBackward(
            toNode,
            trainrunSection,
            trainrun,
          );
          backwardEndNode = targetPathNode;
        }

        pathItems.push(targetPathNode);
      });
    }

    if (forwardEndNode !== undefined && backwardStartNode !== undefined) {
      if (forwardEndNode.departureTime - forwardEndNode.arrivalTime >= trainrun.getFrequency()) {
        forwardEndNode.arrivalTime = backwardStartNode.arrivalTime + trainrun.getFrequency();
        forwardEndNode.departureTime = backwardStartNode.departureTime + trainrun.getFrequency();
      }
    }
    if (backwardEndNode !== undefined && forwardStartNode !== undefined) {
      if (backwardEndNode.departureTime - backwardEndNode.arrivalTime >= trainrun.getFrequency()) {
        backwardEndNode.arrivalTime = forwardStartNode.arrivalTime + trainrun.getFrequency();
        backwardEndNode.departureTime = forwardStartNode.departureTime + trainrun.getFrequency();
      }
    }

    pathItems.forEach((pathItem, i) => {
      if (pathItem.isNode()) {
        const pathNode = pathItem.getPathNode();
        pathNode.arrivalPathSection = this.getPreviousPathSection(pathItems, i);
        pathNode.departurePathSection = this.getNextPathSection(pathItems, i);
      }
      if (pathItem.isSection()) {
        const pathSection = pathItem.getPathSection();
        pathSection.departurePathNode = this.getPreviousPathNode(pathItems, i);
        pathSection.arrivalPathNode = this.getNextPathNode(pathItems, i);
        pathSection.isFilteredDepartureNode = this.getDepartureNodeIsFilterd(pathItems, i);
        pathSection.isFilteredArrivalNode = this.getArrivalNodeIsFilterdr(pathItems, i);
        pathSection.arrivalBranchEndNode = this.getFirstPathNode(pathItems);
        pathSection.departureBranchEndNode = this.getLastPathNode(pathItems);
      }
    });
    return {
      trainrunItem: new TrainrunItem(
        trainrun.getId(),
        trainrun.getFrequency(),
        trainrun.getFrequencyOffset(),
        trainrunStartTime,
        trainrunEndTime,
        trainrun.getTitle(),
        trainrun.getCategoryShortName(),
        trainrun.getCategoryColorRef(),
        pathItems,
        this.trainrunService.isTrainrunTargetRightOrBottom(),
        trainrun.getDirection(),
      ),
      visitedTrainrunSections: visitedTrainrunSections,
    };
  }

  public loadTrainrunItems(templateTrainrunItem: TrainrunItem): TrainrunItem[] {
    // Extract for all trainruns the sections which are part of the
    // template path (along which the graphical timetable is projected) and it does
    // support current for those trains with partial cancellations.
    const trainrunItems: TrainrunItem[] = [];
    if (this.trainruns) {
      this.trainruns.forEach((trainrun: Trainrun) => {
        if (this.filterService.filterTrainrun(trainrun)) {
          // get all trainrun section for given trainrun
          let alltrainrunsections = this.trainrunSectionService.getAllTrainrunSectionsForTrainrun(
            trainrun.getId(),
          );

          // As long not all trainrun section are visited (process) continue
          // this part of code supports partial cancellations, e.g., trainrun runs from
          // A - B - C [ partial canceled ] D - E
          while (alltrainrunsections.length > 0) {
            const ts: TrainrunSection = alltrainrunsections.find((ts) => true);
            const loadeddata = this.loadTrainrunItem(ts, false);

            // detects the one-way trainrun
            loadeddata.trainrunItem.pathItems.forEach((item) => {
              this.setActiveFlag(item, loadeddata.trainrunItem);
            });

            // correct projections directions
            this.sortTrainrunItemAndRotateAlongTemplatePath(
              trainrun,
              loadeddata.trainrunItem,
              templateTrainrunItem,
            );
            trainrunItems.push(loadeddata.trainrunItem);

            // filter all still visited trainrun sections
            alltrainrunsections = alltrainrunsections.filter(
              (ts) => loadeddata.visitedTrainrunSections.indexOf(ts) === -1,
            );
          }
        }
      });
    }
    return trainrunItems;
  }

  setActiveFlag(item: PathItem, trainrunItem: TrainrunItem) {
    // set the active flag. When true the unrolled trainrun is used.
    // this corrects one-way trainrun will not be correct : analytics/visualisation
    if (trainrunItem.direction !== Direction.ONE_WAY) {
      return;
    }

    // handle section
    if (item.isSection()) {
      const s = item.getPathSection();
      const ts = this.trainrunSectionService.getTrainrunSectionFromId(s.trainrunSectionId);
      // update active state
      item.getPathSection().active = s.departurePathNode.nodeId === ts.getSourceNodeId();
      return;
    }

    // handle node
    if (!item.isNode()) {
      // this case can not happend - but you can never know
      return;
    }
    const n = item.getPathNode();
    const trainrunSectionId =
      n.departurePathSection !== undefined
        ? n.departurePathSection.trainrunSectionId
        : n.arrivalPathSection.trainrunSectionId;
    const ts = this.trainrunSectionService.getTrainrunSectionFromId(trainrunSectionId);
    const nodeId =
      n.departurePathSection !== undefined ? ts.getSourceNodeId() : ts.getTargetNodeId();
    // update active state
    item.getPathNode().active = n.nodeId === nodeId;
  }

  sortTrainrunItemAndRotateAlongTemplatePath(
    trainrun: Trainrun,
    trainrunItem: TrainrunItem,
    templateTrainrunItem: TrainrunItem,
  ) {
    /**** Adrian Egli (adrian.egli@sbb.ch)
     TODO - This sortTrainrunItemAndRotateAlongTemplatePath is might just a hot fix for special case if there is a trainrun running from
     [ A - B - C - B - D | A - B - B - C | .... or ... ] -> passes two times same node
     There is sill an issue in the CODE - if the trainrun passes the second time a node, the in-/out
     branching edge will not all be rendered!
     */
    this.classifyPathItem(trainrun, trainrunItem, templateTrainrunItem);

    const indicesForward: number[] = [];
    const indicesBackward: number[] = [];
    let maxIndex = 0;
    trainrunItem.pathItems.forEach((item: PathItem, index: number) => {
      if (item.isSection()) {
        if (!item.backward) {
          // forward
          const section = item.getPathSection();
          if (
            section.isPartOfTemplatePath ===
            TrainrunTemplatePathAlignmentType.SectionOppositeDirection
          ) {
            indicesForward.push(index);
          }
        } else {
          // backward
          const section = item.getPathSection();
          if (
            section.isPartOfTemplatePath === TrainrunTemplatePathAlignmentType.SectionSameDirection
          ) {
            indicesBackward.push(index);
          }
        }
      }
      if (item.isNode()) {
        maxIndex = Math.max(item.getPathNode().index, maxIndex);
      }
    });

    let swapIndF: number[] = [];
    const collectRotateDirectionF: number[] = [];
    indicesForward.forEach((v) => {
      swapIndF.push(v - 2);
      swapIndF.push(v - 1);
      swapIndF.push(v);
      swapIndF.push(v + 1);
      swapIndF.push(v + 2);

      if (v > 1) {
        const predecessor = trainrunItem.pathItems[v - 2];
        if (predecessor.isSection()) {
          if (
            predecessor.getPathSection().isPartOfTemplatePath ===
            TrainrunTemplatePathAlignmentType.SectionSameDirection
          ) {
            collectRotateDirectionF.push(v);
          }
        }
      }

      if (v < trainrunItem.pathItems.length / 2 - 3) {
        const successor = trainrunItem.pathItems[v + 2];
        if (successor.isSection()) {
          if (
            successor.getPathSection().isPartOfTemplatePath ===
            TrainrunTemplatePathAlignmentType.SectionSameDirection
          ) {
            collectRotateDirectionF.push(v);
          }
        }
      }
    });

    let swapIndB: number[] = [];
    const collectRotateDirectionB: number[] = [];
    indicesBackward.forEach((v) => {
      swapIndB.push(v - 2);
      swapIndB.push(v - 1);
      swapIndB.push(v);
      swapIndB.push(v + 1);
      swapIndB.push(v + 2);

      if (v < trainrunItem.pathItems.length - 3) {
        const successor = trainrunItem.pathItems[v + 2];
        if (successor.isSection()) {
          if (
            successor.getPathSection().isPartOfTemplatePath ===
            TrainrunTemplatePathAlignmentType.SectionOppositeDirection
          ) {
            collectRotateDirectionB.push(v);
          }
        }
      }

      if (v > 1) {
        const predecessor = trainrunItem.pathItems[v - 2];
        if (predecessor.isSection()) {
          if (
            predecessor.getPathSection().isPartOfTemplatePath ===
            TrainrunTemplatePathAlignmentType.SectionOppositeDirection
          ) {
            collectRotateDirectionB.push(v);
          }
        }
      }
    });

    swapIndB = swapIndB.reverse();
    swapIndF = swapIndF.filter((v, i, a) => a.indexOf(v) === i);
    swapIndB = swapIndB.filter((v, i, a) => a.indexOf(v) === i);

    swapIndF.forEach((v, index) => {
      if (swapIndF[index] >= 0) {
        if (index === 0) {
          if (
            trainrunItem.pathItems[swapIndF[index]].isPartOfTemplatePath !==
            TrainrunTemplatePathAlignmentType.SectionNotFound
          ) {
            return;
          }
        }

        const fItem = trainrunItem.pathItems[swapIndF[index]];
        const bItem = trainrunItem.pathItems[swapIndB[index]];
        fItem.backward = true;
        bItem.backward = false;
        fItem.oppDirectionTemplatePath = true;
        bItem.oppDirectionTemplatePath = true;
        if (fItem.isSection()) {
          const dEnd = fItem.getPathSection().departureBranchEndNode;
          fItem.getPathSection().departureBranchEndNode =
            fItem.getPathSection().arrivalBranchEndNode;
          fItem.getPathSection().arrivalBranchEndNode = dEnd;
        }
        if (bItem.isSection()) {
          const dEnd = bItem.getPathSection().departureBranchEndNode;
          bItem.getPathSection().departureBranchEndNode =
            bItem.getPathSection().arrivalBranchEndNode;
          bItem.getPathSection().arrivalBranchEndNode = dEnd;
        }

        trainrunItem.pathItems[swapIndF[index]] = bItem;
        trainrunItem.pathItems[swapIndB[index]] = fItem;
      }
    });
  }

  classifyPathItem(
    trainrun: Trainrun,
    trainrunItem: TrainrunItem,
    templateTrainrunItem: TrainrunItem,
  ) {
    trainrunItem.pathItems.forEach((item: PathItem) => {
      if (item.isSection()) {
        const section = item.getPathSection();
        const found = templateTrainrunItem.pathItems.find((tempItem: PathItem) => {
          if (tempItem.isNode()) {
            return false;
          }
          const tempSection = tempItem.getPathSection();
          return (
            section.departurePathNode.nodeId === tempSection.departurePathNode.nodeId &&
            section.arrivalPathNode.nodeId === tempSection.arrivalPathNode.nodeId
          );
        });
        item.isPartOfTemplatePath =
          found !== undefined
            ? TrainrunTemplatePathAlignmentType.SectionSameDirection
            : TrainrunTemplatePathAlignmentType.SectionNotFound;

        if (found === undefined) {
          const oppFound = templateTrainrunItem.pathItems.find((tempItem: PathItem) => {
            if (tempItem.isNode()) {
              return false;
            }
            const tempSection = tempItem.getPathSection();
            return (
              section.arrivalPathNode.nodeId === tempSection.departurePathNode.nodeId &&
              section.departurePathNode.nodeId === tempSection.arrivalPathNode.nodeId
            );
          });

          item.isPartOfTemplatePath =
            oppFound !== undefined
              ? TrainrunTemplatePathAlignmentType.SectionOppositeDirection
              : TrainrunTemplatePathAlignmentType.SectionNotFound;
        }
      } else {
        const node = item.getPathNode();
        const found = templateTrainrunItem.pathItems.find((tempItem: PathItem) => {
          if (tempItem.isSection()) {
            return false;
          }
          const tempNode = tempItem.getPathNode();
          return tempNode.nodeId === node.nodeId;
        });
        item.isPartOfTemplatePath =
          found !== undefined
            ? TrainrunTemplatePathAlignmentType.NodeFound
            : TrainrunTemplatePathAlignmentType.NodeNotFound;
      }
    });

    // isPartOfTemplatePath
  }

  isTrainRunWayDirectionBackward(
    trainrun,
    startForwardNode,
    startBackwardNode,
    selectedForwardTrainrunSectionGroups: TrainrunSectionGroup[],
  ): {
    check: boolean;
    visitedTrainrunSections: TrainrunSection[];
  } {
    let visitedTrainrunSections: TrainrunSection[] = [];

    const tsgForward = this.trainrunSectionGroup(trainrun.getId(), startForwardNode, true);
    const forwardTrainrunSectionGroups = tsgForward.trainrunSectionGroups;
    visitedTrainrunSections = visitedTrainrunSections.concat(tsgForward.visitedTrainrunSections);

    const tsgBackward = this.trainrunSectionGroup(trainrun.getId(), startBackwardNode, false);
    const backwardTrainrunSectionGroups = tsgBackward.trainrunSectionGroups;
    visitedTrainrunSections = visitedTrainrunSections.concat(tsgBackward.visitedTrainrunSections);

    const selectedPaths = this.betriebspunktNamePaths(selectedForwardTrainrunSectionGroups);
    const forwardPaths = this.betriebspunktNamePaths(forwardTrainrunSectionGroups);
    const backwardPaths = this.betriebspunktNamePaths(backwardTrainrunSectionGroups);

    let rateForward = this.ratePath(
      selectedPaths,
      this.removeNoMatchinNodeName(selectedPaths, forwardPaths),
    );
    let rateBackward = this.ratePath(
      selectedPaths,
      this.removeNoMatchinNodeName(selectedPaths, backwardPaths),
    );
    if (rateForward === rateBackward) {
      rateForward = this.ratePath(
        this.addStartEnde(selectedPaths),
        this.addStartEnde(forwardPaths),
      );
      rateBackward = this.ratePath(
        this.addStartEnde(selectedPaths),
        this.addStartEnde(backwardPaths),
      );
    }
    return {
      check: rateForward < rateBackward,
      visitedTrainrunSections: visitedTrainrunSections,
    };
  }

  setDataOnlyForTestPurpose() {
    this.trainruns = this.trainrunService.getTrainruns();
    this.trainrunSections = this.trainrunSectionService.getTrainrunSections();
    if (this.trainrunService.getSelectedTrainrun()) {
      this.trainrunIdSelectedByClick = this.trainrunService.getSelectedTrainrun().getId();
    }
    this.render();
  }

  private betriebspunktNamePaths(trainrunSectionGroups) {
    const paths = [];
    trainrunSectionGroups.forEach((trainrunSectionGroup) => {
      if (trainrunSectionGroup.trainrunSectionWhitheNodes) {
        if (trainrunSectionGroup.trainrunSectionWhitheNodes.fromNode) {
          paths.push(
            trainrunSectionGroup.trainrunSectionWhitheNodes.fromNode.getBetriebspunktName(),
          );
        }
        if (trainrunSectionGroup.trainrunSectionWhitheNodes.toNode) {
          paths.push(trainrunSectionGroup.trainrunSectionWhitheNodes.toNode.getBetriebspunktName());
        }
      }
    });
    return paths;
  }

  private removeNoMatchinNodeName(selectedPaths, paths) {
    const returnPaths = [];
    paths.forEach((path) => {
      let isInPaths = false;
      selectedPaths.forEach((selectedPath) => {
        if (path === selectedPath) {
          isInPaths = true;
        }
      });
      if (isInPaths) {
        returnPaths.push(path);
      }
    });
    return returnPaths;
  }

  private addStartEnde(paths) {
    const returnPaths = [];
    returnPaths.push("#St#");
    paths.forEach((path) => {
      returnPaths.push(path);
    });
    returnPaths.push("#En#");
    return returnPaths;
  }

  private ratePath(selectedPaths, paths) {
    let returnValue = 0;
    for (let pathSize = paths.length; pathSize > 0; pathSize--) {
      const selectedPathCombos = this.pathCombination(selectedPaths, pathSize);
      const pathCombos = this.pathCombination(paths, pathSize);
      pathCombos.forEach((pathCombo) => {
        selectedPathCombos.forEach((selectedPathCombo) => {
          if (selectedPathCombo === pathCombo) {
            if (pathSize > returnValue) {
              returnValue = pathSize;
            }
          }
        });
      });
    }
    return returnValue;
  }

  private pathCombination(paths, size) {
    const returnValues = [];
    for (let i = 0; i < paths.length; i++) {
      if (i + size <= paths.length) {
        let nodeValues = "";
        for (let sizeIndex = 0; sizeIndex < size; sizeIndex++) {
          if (nodeValues !== "") {
            nodeValues = nodeValues + ":";
          }
          nodeValues = nodeValues + paths[i + sizeIndex];
        }
        returnValues.push(nodeValues);
      }
    }
    return returnValues;
  }

  private getSelectedTrainrun(): Trainrun {
    let selectedTrainrun: Trainrun = undefined;
    if (this.trainruns) {
      this.trainruns.forEach((trainrun) => {
        if (trainrun.getId() === this.trainrunIdSelectedByClick) {
          selectedTrainrun = trainrun;
        }
      });
    }
    return selectedTrainrun;
  }

  private getPreviousPathSection(pathItems: PathItem[], i: number): PathSection {
    if (i > 0) {
      const pathItem = pathItems[i - 1];
      if (pathItem instanceof PathSection) {
        return pathItem;
      }
    }
    return undefined;
  }

  private getNextPathSection(pathItems: PathItem[], i: number): PathSection {
    if (i + 1 < pathItems.length) {
      const pathItem = pathItems[i + 1];
      if (pathItem instanceof PathSection) {
        return pathItem;
      }
    }
    return undefined;
  }

  private getPreviousPathNode(pathItems: PathItem[], i: number): PathNode {
    if (i > 0) {
      const pathItem = pathItems[i - 1];
      if (pathItem instanceof PathNode) {
        return pathItem;
      }
    }
    return undefined;
  }

  private getNextPathNode(pathItems: PathItem[], i: number): PathNode {
    if (i + 1 < pathItems.length) {
      const pathItem = pathItems[i + 1];
      if (pathItem instanceof PathNode) {
        return pathItem;
      }
    }
    return undefined;
  }

  private getLastPathNode(pathItems: PathItem[]): PathNode {
    if (pathItems.length > 0) {
      const onlyForwardPathItems = pathItems.filter((pathItems) => !pathItems.backward);
      if (onlyForwardPathItems.length > 0) {
        const pathItem = onlyForwardPathItems[onlyForwardPathItems.length - 1];
        if (pathItem instanceof PathNode) {
          return pathItem;
        }
      }
    }
    return undefined;
  }

  private getFirstPathNode(pathItems: PathItem[]): PathNode {
    if (pathItems.length > 0) {
      const pathItem = pathItems[0];
      if (pathItem instanceof PathNode) {
        return pathItem;
      }
    }
    return undefined;
  }

  private getDepartureNodeIsFilterd(pathItems: PathItem[], i: number): boolean {
    if (i > 0) {
      const pathItem = pathItems[i - 1];
      if (pathItem instanceof PathNode) {
        return pathItem.filter;
      }
    }
    return false;
  }

  private getArrivalNodeIsFilterdr(pathItems: PathItem[], i: number): boolean {
    if (i + 1 < pathItems.length) {
      const pathItem = pathItems[i + 1];
      if (pathItem instanceof PathNode) {
        return pathItem.filter;
      }
    }
    return false;
  }

  private trainrunSectionGroup(
    trainrunId: number,
    node: Node,
    returnForwardStartNode: boolean,
  ): {
    trainrunSectionGroups: TrainrunSectionGroup[];
    visitedTrainrunSections: TrainrunSection[];
  } {
    const visitedTrainrunSections: TrainrunSection[] = [];
    const trainrunSectionGroups: TrainrunSectionGroup[] = [];
    let trainrunSection = undefined;
    let trainrunSectionGroup: TrainrunSectionGroup = undefined;
    let fromNode = node;
    let toNode = undefined;
    const startTrainrunSection = node.getExtremityTrainrunSection(
      trainrunId,
      returnForwardStartNode,
    );
    if (startTrainrunSection === undefined) {
      return {
        trainrunSectionGroups: trainrunSectionGroups,
        visitedTrainrunSections: visitedTrainrunSections,
      };
    }
    const iterator: TrainrunIterator = this.trainrunService.getIterator(node, startTrainrunSection);
    visitedTrainrunSections.push(startTrainrunSection);
    while (iterator.hasNext()) {
      const currentTrainrunSectionNodePair = iterator.next();
      visitedTrainrunSections.push(currentTrainrunSectionNodePair.trainrunSection);

      if (trainrunSectionGroup) {
        trainrunSectionGroup.toTrainrunSectionWithNodes = new TrainrunSectionWithNodes(
          fromNode,
          currentTrainrunSectionNodePair.trainrunSection,
          currentTrainrunSectionNodePair.node,
        );
        trainrunSectionGroups.push(trainrunSectionGroup);
      }
      let fromTrainrunSectionWhitheNodes = undefined;
      if (trainrunSection) {
        fromTrainrunSectionWhitheNodes = new TrainrunSectionWithNodes(
          fromNode,
          trainrunSection,
          toNode,
        );
      }
      trainrunSection = currentTrainrunSectionNodePair.trainrunSection;
      toNode = currentTrainrunSectionNodePair.node;
      const trainrunSectionWhithNodes = new TrainrunSectionWithNodes(
        fromNode,
        trainrunSection,
        toNode,
      );
      trainrunSectionGroup = new TrainrunSectionGroup(
        fromTrainrunSectionWhitheNodes,
        trainrunSectionWhithNodes,
        undefined,
      );
      fromNode = toNode;
    }
    if (trainrunSectionGroup) {
      trainrunSectionGroups.push(trainrunSectionGroup);
    }

    return {
      trainrunSectionGroups: trainrunSectionGroups,
      visitedTrainrunSections: visitedTrainrunSections,
    };
  }
}

class TrainrunSectionGroup {
  constructor(
    public fromTrainrunSectionWithNodes: TrainrunSectionWithNodes,
    public trainrunSectionWithNodes: TrainrunSectionWithNodes,
    public toTrainrunSectionWithNodes: TrainrunSectionWithNodes,
  ) {}
}

class TrainrunSectionWithNodes {
  constructor(
    public fromNode: Node,
    public trainrunSection: TrainrunSection,
    public toNode: Node,
  ) {}
}
