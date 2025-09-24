import {
  HaltezeitFachCategories,
  NodeDto,
  TrainrunCategoryHaltezeit,
} from "../data-structures/business.data.structures";
import {
  NODE_MIN_HEIGHT,
  NODE_MIN_WIDTH,
  NODE_PIN_SPAN,
  NODE_TEXT_AREA_HEIGHT,
} from "../view/rastering/definitions";
import {Port} from "./port.model";
import {TrainrunSection} from "./trainrunsection.model";
import {Transition} from "./transition.model";
import {SimpleTrainrunSectionRouter} from "../services/util/trainrunsection.routing";
import {Trainrun} from "./trainrun.model";
import {PortAlignment, WarningDto} from "../data-structures/technical.data.structures";
import {Connection} from "./connection.model";
import {ConnectionValidator} from "../services/util/connection.validator";
import {VisAVisPortPlacement} from "../services/util/node.port.placement";
import {DataMigration} from "../utils/data-migration";

export class Node {
  private static currentId = 0;
  private id: number;
  private betriebspunktName: string;
  private fullName: string;
  private positionX: number;
  private positionY: number;
  private ports: Port[];
  private transitions: Transition[];
  private connections: Connection[];
  private resourceId: number;
  private perronkanten: number;
  private connectionTime: number;
  private trainrunCategoryHaltezeiten: TrainrunCategoryHaltezeit;
  private symmetryAxis: number;
  private warnings: WarningDto[];
  private isSelected: boolean;
  private labelIds: number[];
  private isCollapsed: boolean;

  constructor(
    {
      id,
      betriebspunktName,
      fullName,
      positionX,
      positionY,
      ports,
      transitions,
      connections,
      resourceId,
      perronkanten,
      connectionTime,
      trainrunCategoryHaltezeiten,
      symmetryAxis,
      warnings,
      labelIds,
      isCollapsed,
    }: NodeDto = {
      id: Node.incrementId(),
      betriebspunktName: $localize`:@@app.models.node.shortNameDefault:NEW`,
      fullName: $localize`:@@app.models.node.full-name-default:New node`,
      positionX: 0,
      positionY: 0,
      ports: [],
      transitions: [],
      connections: [],
      resourceId: null,
      perronkanten: Node.getDefaultPerronKanten(),
      connectionTime: Node.getDefaultConnectionTime(),
      trainrunCategoryHaltezeiten: Node.getDefaultHaltezeit(),
      symmetryAxis: null,
      warnings: null,
      labelIds: [],
      isCollapsed: false,
    },
  ) {
    this.id = id;
    this.betriebspunktName = betriebspunktName;
    this.fullName = fullName;
    this.positionX = positionX;
    this.positionY = positionY;
    this.ports = ports.map((portDto) => new Port(portDto));
    this.transitions = transitions.map((transitionDto) => new Transition(transitionDto));
    this.connections = connections.map((connectionDto) => new Connection(connectionDto));
    this.resourceId = resourceId;
    this.perronkanten = perronkanten;
    this.connectionTime = connectionTime;
    this.trainrunCategoryHaltezeiten =
      trainrunCategoryHaltezeiten === null
        ? Node.getDefaultHaltezeit()
        : trainrunCategoryHaltezeiten;
    this.symmetryAxis = symmetryAxis;
    this.warnings = warnings;
    this.isSelected = false;
    this.labelIds = labelIds;
    this.isCollapsed = isCollapsed;

    if (Node.currentId < this.id) {
      Node.currentId = this.id;
    }

    DataMigration.migrateNodeLabelIds(this);

    this.updateTransitionsRouting();
    this.updateConnectionsRouting();
  }

  static getDefaultHaltezeit(): TrainrunCategoryHaltezeit {
    return {
      [HaltezeitFachCategories.IPV]: {haltezeit: 3, no_halt: false},
      [HaltezeitFachCategories.A]: {haltezeit: 2, no_halt: false},
      [HaltezeitFachCategories.B]: {haltezeit: 2, no_halt: false},
      [HaltezeitFachCategories.C]: {haltezeit: 1, no_halt: false},
      [HaltezeitFachCategories.D]: {haltezeit: 1, no_halt: false},
      [HaltezeitFachCategories.Uncategorized]: {haltezeit: 0, no_halt: true},
    };
  }

  static getDefaultPerronKanten(): number {
    return 5;
  }

  static getDefaultConnectionTime(): number {
    return 3;
  }

  static orderPortsTrainrunSectionId(a: Port, b: Port): number {
    if (a.getTrainrunSection().getId() > b.getTrainrunSection().getId()) {
      return 1;
    } else {
      return -1;
    }
  }

  static orderPortsTrainrunId(a: Port, b: Port): number {
    if (
      a.getTrainrunSection().getTrainrun().getId() > b.getTrainrunSection().getTrainrun().getId()
    ) {
      return 1;
    } else if (
      a.getTrainrunSection().getTrainrun().getId() === b.getTrainrunSection().getTrainrun().getId()
    ) {
      return Node.orderPortsTrainrunSectionId(a, b);
    } else {
      return -1;
    }
  }

  static orderPortsAlphabetically(a: Port, b: Port): number {
    if (
      a.getTrainrunSection().getTrainrun().getTitle() >
      b.getTrainrunSection().getTrainrun().getTitle()
    ) {
      return 1;
    } else if (
      a.getTrainrunSection().getTrainrun().getTitle() ===
      b.getTrainrunSection().getTrainrun().getTitle()
    ) {
      return Node.orderPortsTrainrunId(a, b);
    } else {
      return -1;
    }
  }

  static orderPortsTrainCategory(a: Port, b: Port): number {
    if (
      a.getTrainrunSection().getTrainrun().getCategoryOrder() >
      b.getTrainrunSection().getTrainrun().getCategoryOrder()
    ) {
      return 1;
    } else if (
      a.getTrainrunSection().getTrainrun().getCategoryOrder() ===
      b.getTrainrunSection().getTrainrun().getCategoryOrder()
    ) {
      return Node.orderPortsAlphabetically(a, b);
    } else {
      return -1;
    }
  }

  private static incrementId(): number {
    return ++Node.currentId;
  }

  initializePortsWithReferencesToTrainrunSections(trainrunSections: TrainrunSection[]) {
    this.ports.forEach((port) => {
      const trainrunSection = trainrunSections.find(
        (ts) => ts.getId() === port.getTrainrunSectionId(),
      );
      if (trainrunSection !== undefined) {
        port.setTrainrunSection(trainrunSection);
      } else {
        // In some cases the exported json contains ports with references to trainrunsections that do not exist,
        // unfortunately we don't know how this could happen
        // the fix implemented here deletes these ports
        console.error(
          "ERROR-fix: initializePortsWithReferencesToTrainrunSections",
          port,
          port.getTrainrunSectionId(),
          trainrunSection,
        );
        this.ports = this.ports.filter((p) => p.getId() !== port.getId());
      }
    });
  }

  initializeTransitionsWithTrainruns() {
    this.transitions.forEach((transition) => {
      const portId1 = transition.getPortId1();
      const port1 = this.getPort(portId1);
      transition.setTrainrun(port1.getTrainrunSection().getTrainrun());
    });
  }

  getId(): number {
    return this.id;
  }

  getResourceId(): number {
    return this.resourceId;
  }

  setResourceId(resourceId: number) {
    this.resourceId = resourceId;
  }

  getBetriebspunktName(): string {
    return this.betriebspunktName;
  }

  setBetriebspunktName(name: string) {
    this.betriebspunktName = name;
  }

  getFullName(): string {
    return this.fullName;
  }

  setFullName(name: string) {
    this.fullName = name;
  }

  getConnectionTime(): number {
    return this.connectionTime;
  }

  setConnectionTime(connectionTime: number) {
    this.connectionTime = connectionTime;
  }

  getLabelIds(): number[] {
    return this.labelIds;
  }

  setLabelIds(labelIds: number[]) {
    this.labelIds = labelIds;
  }

  setHaltezeit(haltezeit: TrainrunCategoryHaltezeit) {
    this.trainrunCategoryHaltezeiten = haltezeit;
  }

  getPositionX(): number {
    return this.positionX;
  }

  getPositionY(): number {
    return this.positionY;
  }

  setPosition(x: number, y: number) {
    this.positionX = x;
    this.positionY = y;
  }

  getNodeWidth(): number {
    let maxIndex = 0;
    this.ports.forEach((port) => {
      if (
        port.getPositionAlignment() === PortAlignment.Top ||
        port.getPositionAlignment() === PortAlignment.Bottom
      ) {
        if (maxIndex <= port.getPositionIndex()) {
          maxIndex = port.getPositionIndex() + 1;
        }
      }
    });
    return Math.max(NODE_MIN_WIDTH, maxIndex * NODE_PIN_SPAN);
  }

  getNodeHeight(): number {
    let maxIndex = 0;
    this.ports.forEach((port) => {
      if (
        port.getPositionAlignment() === PortAlignment.Left ||
        port.getPositionAlignment() === PortAlignment.Right
      ) {
        if (maxIndex <= port.getPositionIndex()) {
          maxIndex = port.getPositionIndex() + 1;
        }
      }
    });
    return Math.max(NODE_MIN_HEIGHT, maxIndex * NODE_PIN_SPAN + NODE_TEXT_AREA_HEIGHT);
  }

  getPort(portId: number): Port {
    return this.ports.find((p) => p.getId() === portId);
  }

  getNextFreePinPositionIndex(alignment: PortAlignment): number {
    let currentMaxIndex = 0;
    this.ports.forEach((port) => {
      if (port.getPositionAlignment() === alignment) {
        if (currentMaxIndex <= port.getPositionIndex()) {
          currentMaxIndex = port.getPositionIndex() + 1;
        }
      }
    });
    return currentMaxIndex;
  }

  getIsCollapsed(): boolean {
    return this.isCollapsed;
  }

  setIsCollapsed(isCollapsed: boolean) {
    this.isCollapsed = isCollapsed;
  }

  computeTransitionRouting(transition: Transition) {
    const port1 = this.getPort(transition.getPortId1());
    const port2 = this.getPort(transition.getPortId2());
    transition.setPath(SimpleTrainrunSectionRouter.routeTransition(this, port1, port2));
  }

  computeConnectionRouting(connection: Connection) {
    const port1 = this.getPort(connection.getPortId1());
    const port2 = this.getPort(connection.getPortId2());
    connection.setPath(SimpleTrainrunSectionRouter.routeConnection(this, port1, port2));
  }

  addPort(alignment: PortAlignment, trainrunSection: TrainrunSection): number {
    const port = new Port();
    port.setPositionAlignment(alignment);
    port.setPositionIndex(this.getNextFreePinPositionIndex(alignment));
    port.setTrainrunSection(trainrunSection);
    this.ports.push(port);
    return port.getId();
  }

  getOppositeNode(trainrunSection: TrainrunSection): Node | undefined {
    if (this.getId() === trainrunSection.getSourceNodeId()) {
      return trainrunSection.getTargetNode();
    } else if (this.getId() === trainrunSection.getTargetNodeId()) {
      return trainrunSection.getSourceNode();
    }
    return undefined;
  }

  getTransition(trainrunSectionId: number): Transition {
    return this.getTransitions().find((trans: Transition) => {
      const port = this.getPortOfTrainrunSection(trainrunSectionId);
      if (port === undefined) {
        return false;
      }
      return trans.getPortId1() === port.getId() || trans.getPortId2() === port.getId();
    });
  }

  getNextTrainrunSection(trainrunSection: TrainrunSection): TrainrunSection {
    let transition = this.getTransitions().find((trans: Transition) => {
      const t = this.getPortOfTrainrunSection(trainrunSection.getId());
      if (t === undefined) {
        return false;
      }
      return trans.getPortId1() === t.getId();
    });
    if (transition !== undefined) {
      return this.getPort(transition.getPortId2()).getTrainrunSection();
    }

    transition = this.getTransitions().find((trans: Transition) => {
      const t = this.getPortOfTrainrunSection(trainrunSection.getId());
      if (t === undefined) {
        return false;
      }
      return trans.getPortId2() === t.getId();
    });
    if (transition !== undefined) {
      return this.getPort(transition.getPortId1()).getTrainrunSection();
    }

    return undefined;
  }

  isEndNode(trainrunSection: TrainrunSection): boolean {
    const port = this.getPortOfTrainrunSection(trainrunSection.getId());
    if (port === undefined) {
      return true;
    }
    const portId = port.getId();
    return (
      this.getTransitions().find(
        (transition: Transition) =>
          transition.getPortId1() === portId || transition.getPortId2() === portId,
      ) === undefined
    );
  }

  getStartTrainrunSection(trainrunId: number, returnForwardStartNode = true): TrainrunSection {
    const portsForTrainrun = this.ports.filter(
      (port) => port.getTrainrunSection().getTrainrunId() === trainrunId,
    );

    // ports with no transition maximally two can be available - in common trainrun paths, there
    // will be no or max one starting/ending port (node)
    const portsWithNoTransition = portsForTrainrun.filter(
      (port) =>
        this.transitions.find(
          (transition) =>
            transition.getPortId1() === port.getId() || transition.getPortId2() === port.getId(),
        ) === undefined,
    );
    if (portsWithNoTransition === undefined || portsWithNoTransition.length === 0) {
      return undefined;
    }
    // Does the system has one or more ports found (with no transitions -> Start/Ending Ports)?
    // If no return first found otherwise check whether there is the forward (start node) of
    // interest - or the backward (end node)
    if (portsWithNoTransition.length === 1 || returnForwardStartNode) {
      // forward
      return portsWithNoTransition[0].getTrainrunSection();
    }
    // backward
    return portsWithNoTransition[1].getTrainrunSection();
  }

  reorderAllPorts() {
    this.sortPorts();
    this.resetPositionIndex(PortAlignment.Top);
    this.resetPositionIndex(PortAlignment.Bottom);
    this.resetPositionIndex(PortAlignment.Left);
    this.resetPositionIndex(PortAlignment.Right);
  }

  sortPorts() {
    this.ports.sort((a, b) => {
      if (a.getPositionAlignment() > b.getPositionAlignment()) {
        return 1;
      } else {
        if (a.getPositionAlignment() === b.getPositionAlignment()) {
          if (
            a.getPositionAlignment() === PortAlignment.Left ||
            a.getPositionAlignment() === PortAlignment.Right
          ) {
            if (
              a.getOppositeNodePosition(this.getId()).getY() >
              b.getOppositeNodePosition(this.getId()).getY()
            ) {
              return 1;
            } else if (
              a.getOppositeNodePosition(this.getId()).getY() ===
              b.getOppositeNodePosition(this.getId()).getY()
            ) {
              return Node.orderPortsTrainCategory(a, b);
            } else {
              return -1;
            }
          } else {
            if (
              a.getOppositeNodePosition(this.getId()).getX() >
              b.getOppositeNodePosition(this.getId()).getX()
            ) {
              return 1;
            } else if (
              a.getOppositeNodePosition(this.getId()).getX() ===
              b.getOppositeNodePosition(this.getId()).getX()
            ) {
              return Node.orderPortsTrainCategory(a, b);
            } else {
              return -1;
            }
          }
        } else {
          return -1;
        }
      }
    });
  }

  resetPositionIndex(alignment: PortAlignment) {
    let positionIndex = 0;
    this.ports.forEach((port) => {
      if (port.getPositionAlignment() === alignment) {
        port.setPositionIndex(positionIndex++);
      }
    });
  }

  getTransitions(): Transition[] {
    return this.transitions;
  }

  getTransitionFromPortId(portId) {
    return this.transitions.find(
      (t: Transition) => t.getPortId1() === portId || t.getPortId2() === portId,
    );
  }

  getTransitionFromId(transitionId: number): Transition {
    return this.transitions.find((t: Transition) => t.getId() === transitionId);
  }

  getConnectionFromId(connectionId: number): Connection {
    return this.connections.find((c: Connection) => c.getId() === connectionId);
  }

  getConnections(): Connection[] {
    return this.connections;
  }

  getFreePortsForTrainrun(trainrunId: number): Port[] {
    const portsForTrainrun = this.ports.filter(
      (port) => port.getTrainrunSection().getTrainrunId() === trainrunId,
    );
    return portsForTrainrun.filter(
      (port) =>
        this.transitions.find(
          (transition) =>
            transition.getPortId1() === port.getId() || transition.getPortId2() === port.getId(),
        ) === undefined,
    );
  }

  getPortOfTrainrunSection(trainrunSectionId: number): Port {
    return this.ports.find((port) => port.getTrainrunSectionId() === trainrunSectionId);
  }

  addTransitionAndComputeRouting(
    port1: Port,
    port2: Port,
    trainrun: Trainrun,
    isNonStop = false,
  ): Transition {
    const transition: Transition = new Transition();
    transition.setPort1Id(port1.getId());
    transition.setPort2Id(port2.getId());
    transition.setIsNonStopTransit(
      isNonStop
        ? true
        : this.trainrunCategoryHaltezeiten[trainrun.getTrainrunCategory().fachCategory].no_halt,
    );
    transition.setTrainrun(trainrun);
    this.computeTransitionRouting(transition);
    this.transitions.push(transition);
    return transition;
  }

  addConnectionAndComputeRouting(port1: Port, port2: Port) {
    const connection: Connection = new Connection();
    connection.setPort1Id(port1.getId());
    connection.setPort2Id(port2.getId());
    this.computeConnectionRouting(connection);
    ConnectionValidator.validateConnection(connection, this);
    this.connections.push(connection);
  }

  updateTransitionsAndConnections() {
    this.reorderAllPorts();
    this.updateTransitionsRouting();
    this.updateConnectionsRouting();
  }

  updateTransitionsRouting() {
    this.transitions.forEach((transition) => {
      this.computeTransitionRouting(transition);
    });
  }

  updateConnectionsRouting() {
    this.connections.forEach((connection) => {
      this.computeConnectionRouting(connection);
      ConnectionValidator.validateConnection(connection, this);
    });
  }

  toggleNonStop(transitionid: number) {
    this.getTransitionFromId(transitionid).toggleIsNonStopTransit();
    this.updateTransitionsAndConnections();
  }

  getIsNonStop(transitionid: number): boolean {
    return this.getTransitionFromId(transitionid).getIsNonStopTransit();
  }

  removePort(trainrunSection: TrainrunSection) {
    let portId = trainrunSection.getSourcePortId();
    if (this.getId() === trainrunSection.getTargetNodeId()) {
      portId = trainrunSection.getTargetPortId();
    }
    this.ports = this.ports.filter((port) => port.getId() !== portId);
  }

  removeTransition(trainrunSection: TrainrunSection) {
    let portId = trainrunSection.getSourcePortId();
    if (this.getId() === trainrunSection.getTargetNodeId()) {
      portId = trainrunSection.getTargetPortId();
    }
    this.transitions = this.transitions.filter(
      (transition) => transition.getPortId1() !== portId && transition.getPortId2() !== portId,
    );
  }

  removeTransitionFromId(t: Transition) {
    this.transitions = this.transitions.filter((transition) => transition.getId() !== t.getId());
  }

  removeConnectionFromTrainrunSection(trainrunSection: TrainrunSection) {
    let portId = trainrunSection.getSourcePortId();
    if (this.getId() === trainrunSection.getTargetNodeId()) {
      portId = trainrunSection.getTargetPortId();
    }
    this.connections = this.connections.filter(
      (connection) => connection.getPortId1() !== portId && connection.getPortId2() !== portId,
    );
  }

  removeConnection(connectionId: number) {
    this.connections = this.connections.filter(
      (connection) => !(connection.getId() === connectionId),
    );
  }

  addPortWithRespectToOppositeNode(oppositeNode: Node, trainrunSection: TrainrunSection) {
    const portAlignments = VisAVisPortPlacement.placePortsOnSourceAndTargetNode(this, oppositeNode);
    const portId = this.addPort(portAlignments.sourcePortPlacement, trainrunSection);
    this.updateTransitionsAndConnections();
    if (this.getId() === trainrunSection.getSourceNodeId()) {
      trainrunSection.setSourcePortId(portId);
    } else {
      trainrunSection.setTargetPortId(portId);
    }
  }

  reAlignPortWithRespectToOppositeNode(oppositeNode: Node, trainrunSection: TrainrunSection) {
    const portAlignments = VisAVisPortPlacement.placePortsOnSourceAndTargetNode(this, oppositeNode);
    const port = this.getPortOfTrainrunSection(trainrunSection.getId());
    port.setPositionAlignment(portAlignments.sourcePortPlacement);
    this.updateTransitionsAndConnections();
  }

  getConnectedTrainrunSections(): TrainrunSection[] {
    return this.ports.map((port) => port.getTrainrunSection());
  }

  getDepartureTime(trainrunSection: TrainrunSection): number {
    if (trainrunSection.getSourceNodeId() === this.getId()) {
      return trainrunSection.getSourceDeparture();
    } else {
      return trainrunSection.getTargetDeparture();
    }
  }

  getArrivalTime(trainrunSection: TrainrunSection): number {
    if (trainrunSection.getSourceNodeId() === this.getId()) {
      return trainrunSection.getSourceArrival();
    } else {
      return trainrunSection.getTargetArrival();
    }
  }

  setDepartureConsecutiveTime(trainrunSection: TrainrunSection, accumulatedTime: number) {
    if (trainrunSection.getSourceNodeId() === this.getId()) {
      trainrunSection.setSourceDepartureConsecutiveTime(accumulatedTime);
    } else {
      trainrunSection.setTargetDepartureConsecutiveTime(accumulatedTime);
    }
  }

  setArrivalConsecutiveTime(trainrunSection: TrainrunSection, accumulatedTime: number) {
    if (trainrunSection.getSourceNodeId() === this.getId()) {
      trainrunSection.setSourceArrivalConsecutiveTime(accumulatedTime);
    } else {
      trainrunSection.setTargetArrivalConsecutiveTime(accumulatedTime);
    }
  }

  getDepartureConsecutiveTime(trainrunSection: TrainrunSection): number {
    if (trainrunSection.getSourceNodeId() === this.getId()) {
      return trainrunSection.getSourceDepartureConsecutiveTime();
    }
    return trainrunSection.getTargetDepartureConsecutiveTime();
  }

  getArrivalConsecutiveTime(trainrunSection: TrainrunSection): number {
    if (trainrunSection.getSourceNodeId() === this.getId()) {
      return trainrunSection.getSourceArrivalConsecutiveTime();
    }
    return trainrunSection.getTargetArrivalConsecutiveTime();
  }

  setDepartureTime(trainrunSection: TrainrunSection, departureTime: number) {
    if (trainrunSection.getSourceNodeId() === this.getId()) {
      trainrunSection.setSourceDeparture(departureTime);
    } else {
      trainrunSection.setTargetDeparture(departureTime);
    }
  }

  setArrivalTime(trainrunSection: TrainrunSection, arrivalTime: number) {
    if (trainrunSection.getSourceNodeId() === this.getId()) {
      trainrunSection.setSourceArrival(arrivalTime);
    } else {
      trainrunSection.setTargetArrival(arrivalTime);
    }
  }

  validateAllConnections() {
    this.connections.forEach((connection) => {
      ConnectionValidator.validateConnection(connection, this);
    });
  }

  select() {
    this.isSelected = true;
  }

  unselect() {
    this.isSelected = false;
  }

  selected(): boolean {
    return this.isSelected;
  }

  isNonStop(trainrunSection: TrainrunSection): boolean {
    const port = this.getPortOfTrainrunSection(trainrunSection.getId());
    if (port === undefined) {
      return false;
    }
    const portId = port.getId();
    const transition = this.getTransitions().find(
      (t: Transition) => t.getPortId1() === portId || t.getPortId2() === portId,
    );
    return transition !== undefined ? transition.getIsNonStopTransit() : false;
  }

  isNonStopNode() {
    if (this.getTransitions().length === 0) {
      return false;
    }
    let transitionCheck =
      this.getTransitions().find((transition) => !transition.getIsNonStopTransit()) === undefined;
    this.ports.forEach((p) => {
      transitionCheck =
        transitionCheck && this.getNextTrainrunSection(p.getTrainrunSection()) !== undefined;
    });
    return transitionCheck;
  }

  containsTrainrun(trainrun: Trainrun): boolean {
    return (
      this.ports.find((port) => port.getTrainrunSection().getTrainrunId() === trainrun.getId()) !==
      undefined
    );
  }

  getTrainrunSection(trainrun: Trainrun): TrainrunSection {
    return this.ports
      .find((port) => port.getTrainrunSection().getTrainrunId() === trainrun.getId())
      .getTrainrunSection();
  }

  getPorts(): Port[] {
    return this.ports;
  }

  getTrainrunCategoryHaltezeit(): TrainrunCategoryHaltezeit {
    return this.trainrunCategoryHaltezeiten;
  }

  getTrainrunSections(transitionid: number) {
    const transition = this.getTransitionFromId(transitionid);
    const portId1 = transition.getPortId1();
    const portId2 = transition.getPortId2();
    const port1 = this.getPort(portId1);
    const port2 = this.getPort(portId2);
    const trainrunsection1 = port1.getTrainrunSection();
    const trainrunsection2 = port2.getTrainrunSection();
    return {
      trainrunSection1: trainrunsection1,
      trainrunSection2: trainrunsection2,
    };
  }

  getAllConnectedTrainruns(trainrunSection: TrainrunSection): number[] {
    const connectedTrainrunIds: number[] = [];
    const connections = this.getConnections();
    const port = this.getPortOfTrainrunSection(trainrunSection.getId());
    if (port === undefined) {
      return [];
    }
    connections.forEach((connection) => {
      if (connection.getPortId1() === port.getId()) {
        const oppositePort = this.getPort(connection.getPortId2());
        connectedTrainrunIds.push(oppositePort.getTrainrunSection().getTrainrunId());
      } else if (connection.getPortId2() === port.getId()) {
        const oppositePort = this.getPort(connection.getPortId1());
        connectedTrainrunIds.push(oppositePort.getTrainrunSection().getTrainrunId());
      }
    });
    return connectedTrainrunIds;
  }

  getDto(): NodeDto {
    return {
      id: this.id,
      betriebspunktName: this.betriebspunktName,
      fullName: this.fullName,
      positionX: this.positionX,
      positionY: this.positionY,
      ports: this.ports.map((port) => port.getDto()),
      transitions: this.transitions.map((transition) => transition.getDto()),
      connections: this.connections.map((connection) => connection.getDto()),
      resourceId: this.resourceId,
      perronkanten: this.perronkanten,
      connectionTime: this.connectionTime,
      trainrunCategoryHaltezeiten: this.trainrunCategoryHaltezeiten,
      symmetryAxis: this.symmetryAxis,
      warnings: this.warnings,
      labelIds: this.labelIds,
      isCollapsed: this.isCollapsed,
    };
  }

  replaceTrainrunSectionOnPort(
    trainrunSectionOld: TrainrunSection,
    trainrunSectionNew: TrainrunSection,
  ) {
    const port = this.getPortOfTrainrunSection(trainrunSectionOld.getId());
    port.setTrainrunSection(trainrunSectionNew);
    if (this.getId() === trainrunSectionOld.getSourceNodeId()) {
      trainrunSectionNew.setSourcePortId(port.getId());
    } else {
      trainrunSectionNew.setTargetPortId(port.getId());
    }
  }
}
