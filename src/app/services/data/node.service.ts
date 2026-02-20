import {EventEmitter, Injectable, OnDestroy} from "@angular/core";
import {Node} from "../../models/node.model";
import {
  LabelDto,
  LabelRef,
  NetzgrafikDto,
  NodeDto,
  TrainrunCategory,
  TrainrunCategoryHaltezeit,
} from "../../data-structures/business.data.structures";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {VisAVisPortPlacement} from "../util/node.port.placement";
import {BehaviorSubject, Subject} from "rxjs";
import {TrainrunService} from "./trainrun.service";
import {TrainrunSectionService} from "./trainrunsection.service";
import {Trainrun} from "../../models/trainrun.model";
import {Stammdaten} from "../../models/stammdaten.model";
import {TransitionValidator} from "../util/transition.validator";
import {DataService} from "./data.service";
import {Transition} from "../../models/transition.model";
import {Connection} from "../../models/connection.model";
import {ResourceService} from "./resource.service";
import {Resource} from "../../models/resource.model";
import {LogService} from "../../logger/log.service";
import {Port} from "../../models/port.model";
import {takeUntil} from "rxjs/operators";
import {Vec2D} from "../../utils/vec2D";
import {NODE_POSITION_BASIC_RASTER} from "../../view/rastering/definitions";
import {MathUtils} from "../../utils/math";
import {LabelService} from "./label.service";
import {FilterService} from "../ui/filter.service";
import {ConnectionDto} from "../../data-structures/technical.data.structures";
import {TrainrunSectionValidator} from "../util/trainrunsection.validator";
import {
  NodeOperation,
  Operation,
  OperationType,
  TrainrunOperation,
} from "../../models/operation.model";

@Injectable({providedIn: "root"})
export class NodeService implements OnDestroy {
  // Description of observable data service: https://coryrylan.com/blog/angular-observable-data-services
  nodesSubject = new BehaviorSubject<Node[]>([]);
  readonly nodes = this.nodesSubject.asObservable();
  nodesStore: {nodes: Node[]} = {nodes: []}; // store the data in memory
  transitionsSubject = new BehaviorSubject<Transition[]>([]);
  readonly transitions = this.transitionsSubject.asObservable();
  connectionsSubject = new BehaviorSubject<Connection[]>([]);
  readonly connections = this.connectionsSubject.asObservable();

  readonly operation = new EventEmitter<Operation>();

  private dataService: DataService = null;
  private destroyed = new Subject<void>();

  constructor(
    private logger: LogService,
    private resourceService: ResourceService,
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private labelService: LabelService,
    private filterService: FilterService,
  ) {
    this.trainrunSectionService.setNodeService(this);
    this.trainrunService.setNodeService(this);
    this.trainrunService.trainruns.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.transitionsUpdated();
      this.connectionsUpdated();
    });
  }

  static alginNodeToRaster(point: Vec2D, gridRaster: number = NODE_POSITION_BASIC_RASTER): Vec2D {
    const newNodePositionX = gridRaster * MathUtils.round(point.getX() / gridRaster, 0);
    const newNodePositionY = gridRaster * MathUtils.round(point.getY() / gridRaster, 0);
    return new Vec2D(newNodePositionX, newNodePositionY);
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  setDataService(dataService: DataService) {
    this.dataService = dataService;
  }

  setNodeData(nodes: NodeDto[]) {
    this.nodesStore.nodes = nodes.map((nodeDto) => {
      const node: Node = new Node(nodeDto);
      if (node.getResourceId() === null) {
        const resource: Resource = this.resourceService.createAndGetResource();
        node.setResourceId(resource.getId());
      }
      return node;
    });
  }

  mergeNodes(nodes: NodeDto[]): Map<number, number> {
    const nodeMap = new Map<number, number>();
    nodes.forEach((node) => {
      const existingNode = this.nodesStore.nodes.find(
        (n) => n.getBetriebspunktName() === node.betriebspunktName,
      );
      if (existingNode === undefined) {
        this.addNodeWithPosition(
          node.positionX,
          node.positionY,
          node.betriebspunktName,
          node.fullName,
          node.labelIds,
          node.isCollapsed,
        );
      } else {
        const existingLabels = existingNode.getLabelIds();
        const allLabels = node.labelIds.concat(existingLabels);
        existingNode.setLabelIds(allLabels.filter((v, i, a) => a.indexOf(v) === i));
      }
      const addedNode = this.nodesStore.nodes.find(
        (n) => n.getBetriebspunktName() === node.betriebspunktName,
      );
      nodeMap.set(node.id, addedNode.getId());
    });
    return nodeMap;
  }

  mergeLabelNode(netzgrafikDto: NetzgrafikDto, nodeMap: Map<number, number>) {
    netzgrafikDto.nodes.forEach((nodeDto) => {
      const newNodeId = nodeMap.get(nodeDto.id);
      const newNode = this.getNodeFromId(newNodeId);
      nodeDto.labelIds.forEach((labelsId) => {
        const labelDtos: LabelDto[] = netzgrafikDto.labels.filter((label) => label.id === labelsId);
        labelDtos.forEach((labelDto) => {
          const label = this.labelService.getOrCreateLabel(labelDto.label, labelDto.labelRef);
          if (!newNode.getLabelIds().includes(label.getId())) {
            newNode.getLabelIds().push(label.getId());
          }
        });
      });
    });
    this.labelService.labelUpdated();
  }

  mergeConnections(
    netzgrafikDto: NetzgrafikDto,
    trainrunSectionMap: Map<number, number>,
    nodeMap: Map<number, number>,
  ) {
    netzgrafikDto.nodes.forEach((n: NodeDto) => {
      n.connections.forEach((c: ConnectionDto) => {
        const port1 = n.ports.find((p) => p.id === c.port1Id);
        const port2 = n.ports.find((p) => p.id === c.port2Id);
        const mappedSectionId1 = trainrunSectionMap.get(port1.trainrunSectionId);
        const mappedSectionId2 = trainrunSectionMap.get(port2.trainrunSectionId);
        if (mappedSectionId1 !== undefined && mappedSectionId2 !== undefined) {
          const nodeId = nodeMap.get(n.id);
          if (nodeId !== undefined) {
            this.addConnectionToNode(nodeId, mappedSectionId1, mappedSectionId2);
          }
        }
      });
    });
  }

  initializePortsWithReferencesToTrainrunSections() {
    const trainrunSections = this.trainrunSectionService.getTrainrunSections();
    this.nodesStore.nodes.forEach((node) => {
      node.initializePortsWithReferencesToTrainrunSections(trainrunSections);
    });
  }

  initializeTransitionsWithReferencesToTrainrun() {
    this.nodesStore.nodes.forEach((node) => {
      node.initializeTransitionsWithTrainruns();
    });
  }

  initPortOrdering() {
    this.nodesStore.nodes.forEach((node) => {
      node.getPorts().forEach((port) => {
        const oppositeNode = node.getOppositeNode(port.getTrainrunSection());
        const portAlignments = VisAVisPortPlacement.placePortsOnSourceAndTargetNode(
          node,
          oppositeNode,
        );
        port.setPositionAlignment(portAlignments.sourcePortPlacement);
        oppositeNode
          .getPortOfTrainrunSection(port.getTrainrunSection().getId())
          .setPositionAlignment(portAlignments.targetPortPlacement);
      });

      node.updateTransitionsAndConnections();
    });
  }

  validateConnections(node: Node) {
    this.getNodeFromId(node.getId()).validateAllConnections();
  }

  validateAllConnections() {
    this.nodesStore.nodes.forEach((node) => {
      node.validateAllConnections();
    });
  }

  duplicateNode(nodeId: number, enforceUpdate = true): Node {
    const node = this.getNodeFromId(nodeId);
    const newNode = this.addNodeWithPosition(
      node.getPositionX(),
      node.getPositionY(),
      node.getBetriebspunktName(),
      node.getFullName(),
      Object.assign([], node.getLabelIds()),
    );
    newNode.setHaltezeit(JSON.parse(JSON.stringify(node.getTrainrunCategoryHaltezeit())));
    newNode.setConnectionTime(node.getConnectionTime());
    this.operation.emit(new NodeOperation(OperationType.create, newNode));
    return newNode;
  }

  addNodeWithPosition(
    positionX: number,
    positionY: number,
    betriebspunktName?: string,
    fullName?: string,
    labelIds?: number[],
    isCollapsed?: boolean,
    enforceUpdate = true,
  ): Node {
    const alignedPosition = NodeService.alginNodeToRaster(new Vec2D(positionX, positionY));
    this.nodesStore.nodes.forEach((n) => n.unselect());
    const node: Node = new Node();
    const resource: Resource = this.resourceService.createAndGetResource();
    node.setResourceId(resource.getId());
    node.setPosition(alignedPosition.getX(), alignedPosition.getY());
    node.select();
    const stammdaten = this.dataService.getBPStammdaten(node.getBetriebspunktName());
    if (stammdaten !== null) {
      node.setHaltezeit(stammdaten.getHaltezeiten());
      node.setConnectionTime(stammdaten.getConnectionTime());
    }
    if (betriebspunktName !== undefined) {
      node.setBetriebspunktName(betriebspunktName);
    }
    if (fullName !== undefined) {
      node.setFullName(fullName);
    }
    if (labelIds !== undefined) {
      node.setLabelIds(labelIds);
    }
    if (isCollapsed !== undefined) {
      node.setIsCollapsed(isCollapsed);
    }
    this.nodesStore.nodes.push(node);
    if (enforceUpdate) {
      this.nodesUpdated();
    }
    this.operation.emit(new NodeOperation(OperationType.create, node));
    return node;
  }

  addEmptyNode(positionX: number, positionY: number): Node {
    const node: Node = new Node();
    node.setPosition(positionX, positionY);
    node.setIsCollapsed(true);
    const resource: Resource = this.resourceService.createAndGetResource();
    node.setResourceId(resource.getId());
    this.nodesStore.nodes.push(node);
    this.operation.emit(new NodeOperation(OperationType.create, node));
    return node;
  }

  deleteNode(nodeId: number, enforceUpdate = true) {
    const node = this.getNodeFromId(nodeId);
    const deletetLabelIds = this.labelService.clearLabel(
      node.getLabelIds(),
      this.makeLabelIDCounterMap(this.getNodes()),
    );
    this.filterService.clearDeletetFilterNodeLabels(deletetLabelIds);
    this.deleteNodeWithoutUpdate(nodeId, enforceUpdate);
    if (enforceUpdate) {
      this.nodesUpdated();
    }
    this.operation.emit(new NodeOperation(OperationType.delete, node));
  }

  deleteNodeUndockTransitions(
    nodeId: number,
    createIntermediateStop = false,
    enforceUpdate = true,
  ) {
    const node = this.getNodeFromId(nodeId);
    node.getTransitions().forEach((tr) => {
      const ts = this.undockTransition(node.getId(), tr.getId(), false);
      if (ts && !createIntermediateStop) {
        ts.setNumberOfStops(Math.max(0, ts.getNumberOfStops() - 1));
      }
    });
    this.deleteNode(node.getId(), false);

    if (enforceUpdate) {
      this.nodesUpdated();
      this.transitionsUpdated();
      this.trainrunService.trainrunsUpdated();
      this.trainrunSectionService.trainrunSectionsUpdated();
    }
  }

  deleteAllVisibleNodes() {
    const nodes = this.nodesStore.nodes;
    nodes.forEach((node) => {
      if (this.filterService.isNodeVisible(node)) {
        const deletetLabelIds = this.labelService.clearLabel(
          node.getLabelIds(),
          this.makeLabelIDCounterMap(this.getNodes()),
        );
        this.filterService.clearDeletetFilterNodeLabels(deletetLabelIds);
        this.deleteNodeWithoutUpdate(node.getId());
      }
    });
    this.nodesUpdated();
  }

  deleteAllNonVisibleNodes() {
    const nodes = this.nodesStore.nodes;
    nodes.forEach((node) => {
      if (!this.filterService.isNodeVisible(node)) {
        const connectedTrainrunSections = node.getConnectedTrainrunSections();
        if (connectedTrainrunSections.length !== 0) {
          this.trainrunSectionService.deleteListOfTrainrunSections(connectedTrainrunSections);
        }
        const deletetLabelIds = this.labelService.clearLabel(
          node.getLabelIds(),
          this.makeLabelIDCounterMap(this.getNodes()),
        );
        this.filterService.clearDeletetFilterNodeLabels(deletetLabelIds);
        this.nodesStore.nodes = this.nodesStore.nodes.filter((n) => n.getId() !== node.getId());
      }
    });
    this.nodesUpdated();
  }

  moveSelectedNodes(
    deltaPositionX: number,
    deltaPositionY: number,
    round: number,
    dragEnd: boolean,
    enforceUpdate = true,
  ) {
    const nodesToUpdate = this.nodesStore.nodes.filter((n) => n.selected());
    nodesToUpdate.forEach((n) => {
      const newPosition = NodeService.alginNodeToRaster(
        new Vec2D(n.getPositionX() + deltaPositionX, n.getPositionY() + deltaPositionY),
        round,
      );
      this.changeNodePositionWithoutUpdate(
        n.getId(),
        newPosition.getX(),
        newPosition.getY(),
        dragEnd,
        false,
      );
    });
    if (enforceUpdate) {
      //this.nodesUpdated();
      this.connectionsUpdated();
      //this.transitionsUpdated();
      this.trainrunService.trainrunsUpdated();
    }
  }

  changeNodePosition(
    nodeId: number,
    newPositionX: number,
    newPositionY: number,
    dragEnd: boolean,
    enforceUpdate = true,
  ) {
    this.changeNodePositionWithoutUpdate(
      nodeId,
      newPositionX,
      newPositionY,
      dragEnd,
      enforceUpdate,
    );
    if (enforceUpdate) {
      this.nodesUpdated();
      this.connectionsUpdated();
      this.transitionsUpdated();
    }
  }

  undockTransition(
    nodeId: number,
    transitionId: number,
    enforceUpdate = true,
  ): TrainrunSection | undefined {
    const transition: Transition = this.getTransition(nodeId, transitionId);

    const isNonStop = transition.getIsNonStopTransit();
    const node: Node = this.getNodeFromTransition(transition);
    const port1 = node.getPort(transition.getPortId1());
    const port2 = node.getPort(transition.getPortId2());
    const trainrunSection1 = port1.getTrainrunSection();
    const trainrunSection2 = port2.getTrainrunSection();
    const timeLock1 =
      trainrunSection1.getSourceNodeId() !== node.getId()
        ? trainrunSection1.getSourceDepartureLock()
        : trainrunSection1.getTargetDepartureLock();
    const timeLock2 =
      trainrunSection2.getSourceNodeId() !== node.getId()
        ? trainrunSection2.getSourceDepartureLock()
        : trainrunSection2.getTargetDepartureLock();

    const oppNodeTrainrunSection1 = node.getOppositeNode(trainrunSection1);
    const oppNodeTrainrunSection2 = node.getOppositeNode(trainrunSection2);

    const depTime = node.getDepartureConsecutiveTime(trainrunSection2);
    const arrTime = node.getArrivalConsecutiveTime(trainrunSection1);
    const transitionTravelTime = depTime - arrTime;

    const transition1: Transition = oppNodeTrainrunSection1.getTransition(trainrunSection1.getId());
    const nonStop1 = transition1 !== undefined ? transition1.getIsNonStopTransit() : false;
    const transition2: Transition = oppNodeTrainrunSection2.getTransition(trainrunSection2.getId());
    const nonStop2 = transition2 !== undefined ? transition2.getIsNonStopTransit() : false;

    if (oppNodeTrainrunSection1.getId() === oppNodeTrainrunSection2.getId()) {
      return undefined;
    }
    this.trainrunSectionService.deleteTrainrunSection(trainrunSection2.getId(), false);

    // temporary store the source/target node information for updating the locks
    const isTargetNodeEqToNodeId = trainrunSection1.getTargetNodeId() === node.getId();

    // compute the new reconnected trainrun sections (create / fusion)
    this.trainrunSectionService.reconnectTrainrunSection(
      trainrunSection1.getTargetNodeId() === node.getId()
        ? trainrunSection1.getSourceNodeId()
        : oppNodeTrainrunSection2.getId(),
      trainrunSection1.getTargetNodeId() === node.getId()
        ? oppNodeTrainrunSection2.getId()
        : trainrunSection1.getTargetNodeId(),
      trainrunSection1.getId(),
      trainrunSection1.getTargetNodeId(),
      trainrunSection1.getSourceNodeId(),
      false,
    );

    // update the arrival and departure times
    node.setArrivalTime(trainrunSection1, trainrunSection2.getTargetArrival());
    node.setDepartureTime(trainrunSection1, trainrunSection2.getTargetDeparture());

    // update the travel time
    const travelTime =
      trainrunSection1.getTravelTime() + trainrunSection2.getTravelTime() + transitionTravelTime;
    trainrunSection1.setTravelTime(travelTime);

    // update the number of stops
    trainrunSection1.setNumberOfStops(
      trainrunSection2.getNumberOfStops() +
        trainrunSection1.getNumberOfStops() +
        (isNonStop ? 0 : 1),
    );

    // update the time Locks
    if (isTargetNodeEqToNodeId) {
      this.trainrunSectionService.updateTrainrunSectionTimeLock(
        trainrunSection1.getId(),
        timeLock1,
        timeLock2,
        trainrunSection1.getTravelTimeLock(),
        enforceUpdate,
      );
    } else {
      this.trainrunSectionService.updateTrainrunSectionTimeLock(
        trainrunSection1.getId(),
        timeLock2,
        timeLock1,
        trainrunSection1.getTravelTimeLock(),
        enforceUpdate,
      );
    }

    const transitionNew1 = oppNodeTrainrunSection1.getTransition(trainrunSection1.getId());
    if (transitionNew1 !== undefined) {
      transitionNew1.setIsNonStopTransit(nonStop1);
    }
    const transitionNew2 = oppNodeTrainrunSection2.getTransition(trainrunSection1.getId());
    if (transitionNew2 !== undefined) {
      transitionNew2.setIsNonStopTransit(nonStop2);
    }

    // re-propagte the consecutive time
    this.trainrunService.propagateConsecutiveTimesForTrainrun(trainrunSection1.getId());

    // re-validate the section after it was correctly updated (full update done)
    TrainrunSectionValidator.validateOneSection(trainrunSection1);

    if (enforceUpdate) {
      this.trainrunSectionService.trainrunSectionsUpdated();
      this.connectionsUpdated();
      this.transitionsUpdated();
      this.nodesUpdated();
    }

    return trainrunSection1;
  }

  addPortsToNodes(sourceNodeId: number, targetNodeId: number, trainrunSection: TrainrunSection) {
    const sourceNode = this.getNodeFromId(sourceNodeId);
    const targetNode = this.getNodeFromId(targetNodeId);
    const portAlignments = VisAVisPortPlacement.placePortsOnSourceAndTargetNode(
      sourceNode,
      targetNode,
    );
    const sourcePortId = sourceNode.addPort(portAlignments.sourcePortPlacement, trainrunSection);
    const targetPortId = targetNode.addPort(portAlignments.targetPortPlacement, trainrunSection);
    sourceNode.updateTransitionsAndConnections();
    targetNode.updateTransitionsAndConnections();
    trainrunSection.setSourcePortId(sourcePortId);
    trainrunSection.setTargetPortId(targetPortId);
  }

  hasPathAnyDepartureOrArrivalTimeLock(node: Node, trainrunSection: TrainrunSection): boolean {
    const iterator = this.trainrunService.getIterator(node, trainrunSection);
    while (iterator.hasNext()) {
      iterator.next();
      const currentTrainrunSection = iterator.current().trainrunSection;
      if (
        currentTrainrunSection.getSourceDepartureLock() ||
        currentTrainrunSection.getTargetArrivalLock()
      ) {
        return true;
      }
    }
    return false;
  }

  toggleNonStop(nodeId: number, transitionId: number) {
    const node = this.getNodeFromId(nodeId);
    node.toggleNonStop(transitionId);
    const trainrunSections = node.getTrainrunSections(transitionId);
    const node1 = node.getOppositeNode(trainrunSections.trainrunSection1);
    const node2 = node.getOppositeNode(trainrunSections.trainrunSection2);
    const isForwardPathLocked = this.hasPathAnyDepartureOrArrivalTimeLock(
      node1,
      trainrunSections.trainrunSection1,
    );
    const isBackwardPathLocked = this.hasPathAnyDepartureOrArrivalTimeLock(
      node2,
      trainrunSections.trainrunSection2,
    );

    if (!isForwardPathLocked) {
      this.trainrunSectionService.iterateAlongTrainrunUntilEndAndPropagateTime(
        node1,
        trainrunSections.trainrunSection1.getId(),
      );
    }
    if (!isBackwardPathLocked) {
      this.trainrunSectionService.iterateAlongTrainrunUntilEndAndPropagateTime(
        node2,
        trainrunSections.trainrunSection2.getId(),
      );
    }

    if (isForwardPathLocked && isBackwardPathLocked) {
      const warningTitle = $localize`:@@app.services.data.node.transit-modified.title:Transition changed`;
      const warningDescription = $localize`:@@app.services.data.node.transit-modified.description:Times cannot be adjusted, lock found on both sides`;
      this.trainrunSectionService.setWarningOnNode(
        trainrunSections.trainrunSection1.getId(),
        node.getId(),
        warningTitle,
        warningDescription,
      );
      this.trainrunSectionService.setWarningOnNode(
        trainrunSections.trainrunSection2.getId(),
        node.getId(),
        warningTitle,
        warningDescription,
      );
    }

    TransitionValidator.validateTransition(node, transitionId);
    this.transitionsUpdated();
    this.nodesUpdated();
    this.operation.emit(
      new TrainrunOperation(OperationType.update, trainrunSections.trainrunSection1.getTrainrun()),
    );
  }

  checkExistsNoCycleTrainrunAfterFreePortsConnecting(
    node: Node,
    port1: Port,
    port2: Port,
  ): boolean {
    const checkPort1 = this.trainrunService.isStartEqualsEndNode(
      port1.getTrainrunSection().getId(),
    );
    const checkPort2 = this.trainrunService.isStartEqualsEndNode(
      port2.getTrainrunSection().getId(),
    );
    return !checkPort1 || !checkPort2;
  }

  addTransitionAndComputeRoutingFromFreePorts(node: Node, trainrun: Trainrun, isNonStop = false) {
    const freePorts = node.getFreePortsForTrainrun(trainrun.getId());
    if (freePorts.length <= 1) {
      return;
    }
    if (this.checkExistsNoCycleTrainrunAfterFreePortsConnecting(node, freePorts[0], freePorts[1])) {
      node.addTransitionAndComputeRouting(freePorts[0], freePorts[1], trainrun, isNonStop);
    } else {
      if (freePorts.length === 3) {
        if (
          this.checkExistsNoCycleTrainrunAfterFreePortsConnecting(node, freePorts[0], freePorts[2])
        ) {
          node.addTransitionAndComputeRouting(freePorts[0], freePorts[2], trainrun, isNonStop);
        } else {
          if (
            this.checkExistsNoCycleTrainrunAfterFreePortsConnecting(
              node,
              freePorts[1],
              freePorts[2],
            )
          ) {
            node.addTransitionAndComputeRouting(freePorts[1], freePorts[2], trainrun, isNonStop);
          }
        }
      }
    }
  }

  addTransitionToNodeForTrainrunSections(
    nodeId: number,
    trainrunSection1: TrainrunSection,
    trainrunSection2: TrainrunSection,
  ) {
    const node = this.getNodeFromId(nodeId);
    const port1 = node.getPortOfTrainrunSection(trainrunSection1.getId());
    const port2 = node.getPortOfTrainrunSection(trainrunSection2.getId());
    node.addTransitionAndComputeRouting(port1, port2, trainrunSection1.getTrainrun());
  }

  addTransitionToNodes(
    sourceNodeId: number,
    targetNodeId: number,
    trainrunSection: TrainrunSection,
    sourceIsNonStop = false,
    targetIsNonStop = false,
  ) {
    const sourceNode = this.getNodeFromId(sourceNodeId);
    this.addTransitionAndComputeRoutingFromFreePorts(
      sourceNode,
      trainrunSection.getTrainrun(),
      sourceIsNonStop,
    );

    const targetNode = this.getNodeFromId(targetNodeId);
    this.addTransitionAndComputeRoutingFromFreePorts(
      targetNode,
      trainrunSection.getTrainrun(),
      targetIsNonStop,
    );
  }

  isConditionToAddTransitionFullfilled(node: Node, trainrunSection: TrainrunSection): boolean {
    const freePorts = node.getFreePortsForTrainrun(trainrunSection.getTrainrunId());
    const isStartEqualsEndNode = this.trainrunService.isStartEqualsEndNode(trainrunSection.getId());
    if (isStartEqualsEndNode && freePorts !== undefined && freePorts.length === 2) {
      return false;
    } else {
      return freePorts !== undefined && (freePorts.length === 2 || freePorts.length === 3);
    }
  }

  copyTransitionProperties(
    nodeId: number,
    trainrunSection: TrainrunSection,
    existingTrainrunSection: TrainrunSection,
  ) {
    const node = this.getNodeFromId(nodeId);
    const transitions = node.getTransitions();
    const existingTransition = transitions.find(
      (transition) => transition.getTrainrun().getId() === existingTrainrunSection.getTrainrunId(),
    );
    const newTransition = transitions.find(
      (transition) => transition.getTrainrun().getId() === trainrunSection.getTrainrunId(),
    );
    if (existingTransition !== undefined && newTransition !== undefined) {
      newTransition.setIsNonStopTransit(existingTransition.getIsNonStopTransit());
    }
  }

  addConnectionToNode(nodeId: number, trainrunSectionFromId: number, trainrunSectionToId: number) {
    const node = this.getNodeFromId(nodeId);
    const portFrom = node.getPortOfTrainrunSection(trainrunSectionFromId);
    const portTo = node.getPortOfTrainrunSection(trainrunSectionToId);
    if (portFrom !== undefined && portTo !== undefined) {
      const conFound = node
        .getConnections()
        .find(
          (c: Connection) =>
            (c.getPortId1() === portFrom.getId() && c.getPortId2() === portTo.getId()) ||
            (c.getPortId1() === portFrom.getId() && c.getPortId2() === portFrom.getId()) ||
            (c.getPortId1() === portTo.getId() && c.getPortId2() === portTo.getId()) ||
            (c.getPortId1() === portTo.getId() && c.getPortId2() === portFrom.getId()),
        );
      if (conFound !== undefined) {
        return;
      }
      node.addConnectionAndComputeRouting(portFrom, portTo);
    }
    this.connectionsUpdated();
  }

  removeTransitionsFromNodes(trainrunSection: TrainrunSection) {
    const sourceNode = this.getNodeFromId(trainrunSection.getSourceNodeId());
    const targetNode = this.getNodeFromId(trainrunSection.getTargetNodeId());
    sourceNode.removeTransition(trainrunSection);
    targetNode.removeTransition(trainrunSection);
  }

  removeConnectionsFromNodes(trainrunSection: TrainrunSection) {
    const sourceNode = this.getNodeFromId(trainrunSection.getSourceNodeId());
    const targetNode = this.getNodeFromId(trainrunSection.getTargetNodeId());
    sourceNode.removeConnectionFromTrainrunSection(trainrunSection);
    targetNode.removeConnectionFromTrainrunSection(trainrunSection);
  }

  removePortsFromNodes(trainrunSection: TrainrunSection) {
    const sourceNode = this.getNodeFromId(trainrunSection.getSourceNodeId());
    const targetNode = this.getNodeFromId(trainrunSection.getTargetNodeId());
    sourceNode.removePort(trainrunSection);
    targetNode.removePort(trainrunSection);
  }

  updateTransitionsAndConnectionsOnNodes(trainrunSection: TrainrunSection) {
    const sourceNode = this.getNodeFromId(trainrunSection.getSourceNodeId());
    const targetNode = this.getNodeFromId(trainrunSection.getTargetNodeId());
    sourceNode.updateTransitionsAndConnections();
    targetNode.updateTransitionsAndConnections();
  }

  removeConnectionFromNode(nodeId: number, connectionId: number) {
    this.getNodeFromId(nodeId).removeConnection(connectionId);
    this.connectionsUpdated();
  }

  unselectAllConnections() {
    let changed = false;
    this.getNodes().forEach((n: Node) => {
      n.getConnections().find((c: Connection) => {
        if (c.selected()) {
          c.unselect();
          changed = true;
        }
      });
    });
    if (changed) {
      this.connectionsUpdated();
    }
  }

  getAllSelectedConnections(): Connection[] {
    const cons: Connection[] = [];
    this.getNodes().forEach((n: Node) => {
      n.getConnections().find((c: Connection) => {
        if (c.selected()) {
          cons.push(c);
        }
      });
    });
    return cons;
  }

  selectConnection(connectionId: number) {
    let changed = false;
    this.getNodes().forEach((n: Node) => {
      n.getConnections().find((c: Connection) => {
        if (!c.selected()) {
          if (c.getId() === connectionId) {
            changed = true;
            c.select();
          }
        }
      });
    });
    if (changed) {
      this.connectionsUpdated();
    }
  }

  unselectConnection(connectionId: number) {
    let changed = false;
    this.getNodes().forEach((n: Node) => {
      n.getConnections().find((c: Connection) => {
        if (c.selected()) {
          if (c.getId() === connectionId) {
            changed = true;
            c.unselect();
          }
        }
      });
    });
    if (changed) {
      this.connectionsUpdated();
    }
  }

  getDtos() {
    return this.nodesStore.nodes.map((node) => node.getDto());
  }

  setSingleNodeAsSelected(nodeId: number) {
    this.nodesStore.nodes.forEach((n) => n.unselect());
    this.getNodeFromId(nodeId).select();
    this.nodesUpdated();
  }

  selectNode(nodeId: number, enforceUpdate = true) {
    this.getNodeFromId(nodeId).select();
    if (enforceUpdate) {
      this.nodesUpdated();
    }
  }

  unselectNode(nodeId: number, enforceUpdate = true) {
    this.getNodeFromId(nodeId).unselect();
    if (enforceUpdate) {
      this.nodesUpdated();
    }
  }

  isAnyNodeSelected(): boolean {
    const selectedNode = this.nodesStore.nodes.find((n: Node) => n.selected());
    return selectedNode !== undefined;
  }

  isNodeSelected(nodeId: number): boolean {
    return this.getNodeFromId(nodeId).selected();
  }

  unselectAllNodes(enforceUpdate = true) {
    this.nodesStore.nodes.forEach((n) => n.unselect());
    if (enforceUpdate) {
      this.nodesUpdated();
    }
  }

  getSelectedNode(): Node {
    const selectedNode = this.nodesStore.nodes.find((n) => n.selected());
    if (selectedNode !== undefined) {
      return selectedNode;
    } else {
      return null;
    }
  }

  getNodeFromId(nodeId: number): Node {
    return this.nodesStore.nodes.find((n: Node) => n.getId() === nodeId);
  }

  getTransition(nodeId: number, transitionId: number): Transition {
    const node: Node = this.getNodeFromId(nodeId);
    if (node === undefined) {
      return undefined;
    }
    return node.getTransitionFromId(transitionId);
  }

  getNodeFromTransition(transition: Transition): Node {
    return this.nodesStore.nodes.find(
      (n: Node) => n.getTransitionFromId(transition.getId()) !== undefined,
    );
  }

  getNodeForConnection(connection: Connection): Node {
    return this.nodesStore.nodes.find(
      (n: Node) => n.getConnectionFromId(connection.getId()) !== undefined,
    );
  }

  changeNodeBetriebspunktName(nodeId: number, name: string) {
    const node = this.getNodeFromId(nodeId);
    node.setBetriebspunktName(name);
    const stammdaten = this.dataService.getBPStammdaten(node.getBetriebspunktName());
    if (stammdaten !== null) {
      node.setHaltezeit(stammdaten.getHaltezeiten());
      node.setConnectionTime(stammdaten.getConnectionTime());
    }
    this.nodesUpdated();
    this.operation.emit(new NodeOperation(OperationType.update, node));
  }

  changeNodeFullName(nodeId: number, name: string) {
    this.getNodeFromId(nodeId).setFullName(name);
    this.nodesUpdated();
    this.operation.emit(new NodeOperation(OperationType.update, this.getNodeFromId(nodeId)));
  }

  changeConnectionTime(nodeId: number, connectionTime: number) {
    this.getNodeFromId(nodeId).setConnectionTime(connectionTime);
    this.nodesUpdated();
    this.operation.emit(new NodeOperation(OperationType.update, this.getNodeFromId(nodeId)));
  }

  changeIsCollapsed(nodeId: number, isCollapsed: boolean) {
    this.getNodeFromId(nodeId).setIsCollapsed(isCollapsed);
    this.nodesUpdated();
    this.trainrunSectionService.trainrunSectionsUpdated();
    this.connectionsUpdated();
    this.transitionsUpdated();
    this.operation.emit(new NodeOperation(OperationType.update, this.getNodeFromId(nodeId)));
  }

  changeLabels(nodeId: number, labels: string[]) {
    const node = this.getNodeFromId(nodeId);

    // ensure uniqueness of input labels
    const uniqueLabels = Array.from(new Set(labels));
    const labelIds = uniqueLabels.map((label) =>
      this.labelService.getOrCreateLabel(label, LabelRef.Node).getId(),
    );
    const deletedLabelIds = this.labelService.clearLabel(
      this.findClearedLabel(node, labelIds),
      this.makeLabelIDCounterMap(this.getNodes()),
    );
    this.filterService.clearDeletetFilterNodeLabels(deletedLabelIds);
    node.setLabelIds(labelIds);
    this.nodesUpdated();
    if (uniqueLabels.length === labels.length) {
      this.operation.emit(new NodeOperation(OperationType.update, node));
    }
  }

  visibleNodesDeleteLabel(labelRef: string) {
    const labelObject = this.labelService.getLabelFromLabelAndLabelRef(labelRef, LabelRef.Node);
    if (labelObject === undefined) {
      return;
    }
    this.getNodes().forEach((n: Node) => {
      if (this.filterService.filterNode(n)) {
        this.filterService.clearDeletetFilterNodeLabel(labelObject.getId());
        n.setLabelIds(n.getLabelIds().filter((labelId: number) => labelId !== labelObject.getId()));
      }
    });

    if (
      this.getNodes().find(
        (n: Node) =>
          n.getLabelIds().find((labelId: number) => labelId === labelObject.getId()) !== undefined,
      ) === undefined
    ) {
      this.labelService.deleteLabel(labelObject.getId());
    }
    this.nodesUpdated();
  }

  visibleNodesSetLabel(labelRef: string) {
    const labelObject = this.labelService.getLabelFromLabelAndLabelRef(labelRef, LabelRef.Node);
    if (labelObject === undefined) {
      return;
    }
    this.getNodes().forEach((n) => {
      if (this.filterService.filterNode(n)) {
        const labelIds: number[] = n.getLabelIds();
        labelIds.push(labelObject.getId());
        n.setLabelIds(labelIds.filter((v, i, a) => a.indexOf(v) === i));
      }
    });
    this.nodesUpdated();
  }

  changeHaltezeit(nodeId: number, haltezeit: TrainrunCategoryHaltezeit) {
    this.getNodeFromId(nodeId).setHaltezeit(haltezeit);
    this.nodesUpdated();
  }

  reorderPortsOnNodesForTrainrun(trainrun: Trainrun, enforceUpdate = true) {
    this.nodesStore.nodes.forEach((node) => {
      if (node.containsTrainrun(trainrun)) {
        node.updateTransitionsAndConnections();
        this.trainrunSectionService.updateTrainrunSectionRouting(node, enforceUpdate);
      }
    });
  }

  setNodePropertiesFromStammdaten(stammdaten: Stammdaten[]) {
    stammdaten.forEach((stdDaten) => {
      if (stdDaten.getErstellen() !== undefined) {
        if (stdDaten.getErstellen().trim().toLowerCase() === "ja") {
          if (
            this.nodesStore.nodes.find(
              (node) => node.getBetriebspunktName() === stdDaten.getBP(),
            ) === undefined
          ) {
            const pos = stdDaten.getPosition();
            if (pos !== undefined) {
              const labelIds: number[] = [];
              stdDaten.getFilterableLabels().forEach((strLabel) => {
                labelIds.push(this.labelService.getOrCreateLabel(strLabel, LabelRef.Node).getId());
              });
              labelIds.push(
                this.labelService
                  .getOrCreateLabel("Knoten aus CSV-Datei importiert", LabelRef.Node)
                  .getId(),
              );
              this.addNodeWithPosition(
                pos.getX(),
                pos.getY(),
                stdDaten.getBP(),
                stdDaten.getBahnhof(),
                labelIds,
              );
            }
          }
        }
      }
    });

    this.nodesStore.nodes.forEach((node) => {
      const bpStammdaten = stammdaten.find((std) => std.getBP() === node.getBetriebspunktName());
      if (bpStammdaten !== undefined) {
        node.setHaltezeit(bpStammdaten.getHaltezeiten());
        node.setConnectionTime(bpStammdaten.getConnectionTime());

        const labels = node.getLabelIds();
        bpStammdaten.getFilterableLabels().forEach((label) => {
          labels.push(this.labelService.getOrCreateLabel(label, LabelRef.Node).getId());
        });
        bpStammdaten.getRegions().forEach((region) => {
          labels.push(
            this.labelService.getOrCreateLabel("Region: " + region.trim(), LabelRef.Node).getId(),
          );
        });
        bpStammdaten.getKategorien().forEach((kategorie) => {
          labels.push(
            this.labelService
              .getOrCreateLabel("Kategorie: " + kategorie.trim(), LabelRef.Node)
              .getId(),
          );
        });
        node.setLabelIds(labels.filter((v, i, a) => a.indexOf(v) === i));
      }

      const haltezeit = node.getTrainrunCategoryHaltezeit();
      const transitions = node.getTransitions();
      transitions.forEach((transition) => {
        transition.setIsNonStopTransit(
          haltezeit[transition.getTrainrun().getTrainrunCategory().fachCategory].no_halt,
        );
      });
    });
    this.nodesUpdated();
    this.transitionsUpdated();
  }

  getHaltezeit(nodeId: number, trainrunCategory: TrainrunCategory): number {
    const node = this.getNodeFromId(nodeId);
    if (node === undefined) {
      return 0;
    }
    const halteZeit = node.getTrainrunCategoryHaltezeit()[trainrunCategory.fachCategory];
    if (halteZeit.no_halt) {
      return 0;
    }
    return halteZeit.haltezeit;
  }

  checkAndFixMissingTransitions(
    sourceNodeId: number,
    targetNodeId: number,
    trainrunSectionId: number,
    enforceUpdate = true,
  ) {
    const sourceNode = this.getNodeFromId(sourceNodeId);
    const targetNode = this.getNodeFromId(targetNodeId);
    const trainrunSection = this.trainrunSectionService.getTrainrunSectionFromId(trainrunSectionId);
    if (trainrunSection === undefined) {
      return;
    }
    const trainrun = this.trainrunService.getTrainrunFromId(trainrunSection.getTrainrunId());
    if (trainrun === undefined) {
      return;
    }
    // source node
    if (this.isConditionToAddTransitionFullfilled(sourceNode, trainrunSection)) {
      this.addTransitionAndComputeRoutingFromFreePorts(sourceNode, trainrun);
    }

    // target node
    if (this.isConditionToAddTransitionFullfilled(targetNode, trainrunSection)) {
      this.addTransitionAndComputeRoutingFromFreePorts(targetNode, trainrun);
    }
    if (enforceUpdate) {
      this.transitionsUpdated();
    }
  }

  nodesUpdated() {
    this.nodesSubject.next(Object.assign({}, this.nodesStore).nodes);
  }

  transitionsUpdated() {
    let transitions = [];
    this.nodesStore.nodes.forEach((node) => {
      transitions = transitions.concat(node.getTransitions());
    });

    this.transitionsSubject.next(Object.assign([], transitions));
  }

  connectionsUpdated() {
    let connections = [];
    this.nodesStore.nodes.forEach((node) => {
      connections = connections.concat(node.getConnections());
    });

    this.connectionsSubject.next(Object.assign([], connections));
    this.nodesUpdated();
  }

  getNodes(): Node[] {
    return Object.assign({}, this.nodesStore).nodes;
  }

  getVisibleNodes(): Node[] {
    return this.getNodes().filter((n) => this.filterService.filterNode(n));
  }

  getSelectedNodes(): Node[] {
    return this.getNodes().filter((n) => n.selected());
  }

  getAllNodeLabels(): string[] {
    let nodeLabels = [];
    this.getNodes().forEach((n) =>
      this.labelService
        .getTextLabelsFromIds(n.getLabelIds())
        .forEach((label) => nodeLabels.push(label)),
    );
    nodeLabels = nodeLabels.filter((v, i, a) => a.indexOf(v) === i);
    nodeLabels.sort();
    return nodeLabels;
  }

  getNetzgrafikBoundingBox() {
    let minX;
    let maxX;
    let minY;
    let maxY;
    this.nodesStore.nodes.forEach((n) => {
      minX = minX === undefined ? n.getPositionX() : Math.min(minX, n.getPositionX());
      maxX =
        maxX === undefined
          ? n.getPositionX() + n.getNodeWidth()
          : Math.max(maxX, n.getPositionX() + n.getNodeWidth());
      minY = minY === undefined ? n.getPositionY() : Math.min(minY, n.getPositionY());
      maxY =
        maxY === undefined
          ? n.getPositionY() + n.getNodeHeight()
          : Math.max(maxY, n.getPositionY() + n.getNodeHeight());
    });
    return {minCoordX: minX, minCoordY: minY, maxCoordX: maxX, maxCoordY: maxY};
  }

  private deleteNodeWithoutUpdate(nodeId: number, enforceUpdate = true) {
    const node = this.getNodeFromId(nodeId);
    const connectedTrainrunSections = node.getConnectedTrainrunSections();
    if (connectedTrainrunSections.length !== 0) {
      this.trainrunSectionService.deleteListOfTrainrunSections(
        node.getConnectedTrainrunSections(),
        enforceUpdate,
      );
    }
    this.resourceService.deleteResource(node.getResourceId(), enforceUpdate);
    this.nodesStore.nodes = this.nodesStore.nodes.filter((n) => n.getId() !== nodeId);
  }

  private changeNodePositionWithoutUpdate(
    nodeId: number,
    newPositionX: number,
    newPositionY: number,
    dragEnd: boolean,
    enforceUpdate = true,
  ) {
    const node = this.getNodeFromId(nodeId);
    node.setPosition(newPositionX, newPositionY);
    if (dragEnd) {
      node.getPorts().forEach((port) => {
        const oppositeNode = node.getOppositeNode(port.getTrainrunSection());
        const portAlignments = VisAVisPortPlacement.placePortsOnSourceAndTargetNode(
          node,
          oppositeNode,
        );
        port.setPositionAlignment(portAlignments.sourcePortPlacement);
        oppositeNode
          .getPortOfTrainrunSection(port.getTrainrunSection().getId())
          .setPositionAlignment(portAlignments.targetPortPlacement);
        oppositeNode.updateTransitionsAndConnections();
        this.trainrunSectionService.updateTrainrunSectionRouting(oppositeNode, enforceUpdate);
      });
      node.reorderAllPorts();
      this.operation.emit(new NodeOperation(OperationType.update, node));
    }
    node.updateTransitionsRouting();
    node.updateConnectionsRouting();
    this.trainrunSectionService.updateTrainrunSectionRouting(node, enforceUpdate);
  }

  private findClearedLabel(node: Node, labelIds: number[]) {
    return [].concat(node.getLabelIds()).filter((oldlabelId) => !labelIds.includes(oldlabelId));
  }

  private makeLabelIDCounterMap(nodes: Node[]): Map<number, number> {
    const labelIDCauntMap = new Map<number, number>();
    nodes.forEach((node) => {
      node.getLabelIds().forEach((labelId) => {
        let counter = labelIDCauntMap.get(labelId);
        if (counter === undefined) {
          counter = 0;
        }
        counter++;
        labelIDCauntMap.set(labelId, counter);
      });
    });
    return labelIDCauntMap;
  }
}
