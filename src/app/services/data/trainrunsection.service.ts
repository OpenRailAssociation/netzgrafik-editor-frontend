import {TrainrunSection} from "../../models/trainrunsection.model";
import {
  NodeDto,
  TrainrunCategoryHaltezeit,
  TrainrunSectionDto,
} from "../../data-structures/business.data.structures";
import {Node} from "../../models/node.model";
import {EventEmitter, Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Subject} from "rxjs";
import {TrainrunService} from "./trainrun.service";
import {NodeService} from "./node.service";
import {TrainrunSectionValidator} from "../util/trainrunsection.validator";
import {Trainrun} from "../../models/trainrun.model";
import {MathUtils} from "../../utils/math";
import {GeneralViewFunctions} from "../../view/util/generalViewFunctions";
import {LeftAndRightTimeStructure} from "./trainrun-section-times.service";
import {TrainrunsectionHelper} from "../util/trainrunsection.helper";
import {LogService} from "../../logger/log.service";
import {Transition} from "../../models/transition.model";
import {takeUntil} from "rxjs/operators";
import {FilterService} from "../ui/filter.service";
import {DirectedTrainrunSectionProxy, TrainrunIterator} from "../util/trainrun.iterator";
import {Operation, OperationType, TrainrunOperation} from "../../models/operation.model";
import {Port} from "src/app/models/port.model";
import {Vec2D} from "src/app/utils/vec2D";

interface DepartureAndArrivalTimes {
  nodeFromDepartureTime: number;
  nodeFromArrivalTime: number;
  nodeToArrivalTime: number;
  nodeToDepartureTime: number;
}

export interface InformSelectedTrainrunClick {
  trainrunSectionId: number;
  open: boolean;
}

@Injectable({providedIn: "root"})
export class TrainrunSectionService implements OnDestroy {
  // Description of observable data service: https://coryrylan.com/blog/angular-observable-data-services
  trainrunSectionsSubject = new BehaviorSubject<TrainrunSection[]>([]);
  readonly trainrunSections = this.trainrunSectionsSubject.asObservable();
  trainrunSectionsStore: {trainrunSections: TrainrunSection[]} = {trainrunSections: []}; // store the data in memory

  readonly operation = new EventEmitter<Operation>();

  informSelectedTrainrunClickSubject = new BehaviorSubject<InformSelectedTrainrunClick>({
    trainrunSectionId: undefined,
    open: true,
  });
  readonly informSelectedTrainrunClick = this.informSelectedTrainrunClickSubject.asObservable();

  private nodeService: NodeService = null;
  private destroyed = new Subject<void>();

  constructor(
    private logger: LogService,
    private trainrunService: TrainrunService,
    private filterService: FilterService,
  ) {
    this.trainrunService.setTrainrunSectionService(this);
    this.trainrunService.trainruns.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.trainrunSectionsUpdated();
    });
  }

  static TIME_PRECISION = 10;

  static computeArrivalAndDeparture(
    nodeArrival: number,
    trainrunSection: TrainrunSection,
    nonStop: boolean,
    halteZeiten: TrainrunCategoryHaltezeit,
    precision: number = 10,
  ): DepartureAndArrivalTimes {
    let haltezeit =
      halteZeiten[trainrunSection.getTrainrun().getTrainrunCategory().fachCategory].haltezeit;
    haltezeit = nonStop ? 0 : haltezeit;
    const fromDepartureTime = MathUtils.round((nodeArrival + haltezeit) % 60, precision);
    const fromArrivalTime = MathUtils.round(
      TrainrunsectionHelper.getSymmetricTime(fromDepartureTime),
      precision,
    );
    const toArrivalTime = MathUtils.round(
      (fromDepartureTime + (trainrunSection.getTravelTime() % 60)) % 60,
      precision,
    );
    const toDepartureTime = MathUtils.round(
      TrainrunsectionHelper.getSymmetricTime(toArrivalTime),
      precision,
    );

    return {
      nodeFromDepartureTime: fromDepartureTime,
      nodeFromArrivalTime: fromArrivalTime,
      nodeToArrivalTime: toArrivalTime,
      nodeToDepartureTime: toDepartureTime,
    };
  }

  static boundMinutesToOneHour(time: number) {
    while (time >= 60) {
      time -= 60;
    }
    while (time < 0) {
      time += 60;
    }
    return time;
  }

  private static setToNode(
    sourceNodeId: number,
    trainrunSection: TrainrunSection,
    nodeToNew: Node,
    targetNodeId: number,
  ) {
    if (sourceNodeId === trainrunSection.getSourceNodeId()) {
      trainrunSection.setTargetNode(nodeToNew);
    } else if (targetNodeId === trainrunSection.getSourceNodeId()) {
      trainrunSection.setTargetNode(nodeToNew);
    } else if (sourceNodeId === trainrunSection.getTargetNodeId()) {
      trainrunSection.setSourceNode(nodeToNew);
    } else if (targetNodeId === trainrunSection.getTargetNodeId()) {
      trainrunSection.setSourceNode(nodeToNew);
    }
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  propagateTimesForNewTrainrunSection(trainrunSection: TrainrunSection) {
    let nodeFrom = trainrunSection.getSourceNode();
    let previousTrainrunSection = nodeFrom.getNextTrainrunSection(trainrunSection);
    if (previousTrainrunSection === undefined) {
      nodeFrom = trainrunSection.getTargetNode();
      previousTrainrunSection = nodeFrom.getNextTrainrunSection(trainrunSection);
    }
    if (previousTrainrunSection !== undefined) {
      const previousNodeArrival = nodeFrom.getArrivalTime(previousTrainrunSection);
      const halteZeit = nodeFrom.getTrainrunCategoryHaltezeit();
      const arrivalDepartureTimes = TrainrunSectionService.computeArrivalAndDeparture(
        previousNodeArrival,
        trainrunSection,
        false,
        halteZeit,
        TrainrunSectionService.TIME_PRECISION,
      );

      if (trainrunSection.getSourceNodeId() === nodeFrom.getId()) {
        trainrunSection.setSourceDeparture(arrivalDepartureTimes.nodeFromDepartureTime);
        trainrunSection.setSourceArrival(arrivalDepartureTimes.nodeFromArrivalTime);
        trainrunSection.setTargetDeparture(arrivalDepartureTimes.nodeToDepartureTime);
        trainrunSection.setTargetArrival(arrivalDepartureTimes.nodeToArrivalTime);
      } else {
        trainrunSection.setTargetDeparture(arrivalDepartureTimes.nodeFromDepartureTime);
        trainrunSection.setTargetArrival(arrivalDepartureTimes.nodeFromArrivalTime);
        trainrunSection.setSourceDeparture(arrivalDepartureTimes.nodeToDepartureTime);
        trainrunSection.setSourceArrival(arrivalDepartureTimes.nodeToArrivalTime);
      }
    } else {
      // first or unconnected section - special case
      const targetArrivalTime = MathUtils.round(
        (trainrunSection.getSourceDeparture() + (trainrunSection.getTravelTime() % 60)) % 60,
        TrainrunSectionService.TIME_PRECISION,
      );
      const targetDepartureTime = MathUtils.round(
        TrainrunsectionHelper.getSymmetricTime(targetArrivalTime),
        TrainrunSectionService.TIME_PRECISION,
      );
      trainrunSection.setTargetDeparture(targetDepartureTime);
      trainrunSection.setTargetArrival(targetArrivalTime);
    }

    this.trainrunService.propagateConsecutiveTimesForTrainrun(trainrunSection.getId());
  }

  public setNodeService(nodeService: NodeService) {
    this.nodeService = nodeService;
  }

  getTrainrunSectionFromId(trainrunSectionId: number) {
    return this.trainrunSectionsStore.trainrunSections.find(
      (tr) => tr.getId() === trainrunSectionId,
    );
  }

  getAllSelectedTrainrunSections(): TrainrunSection[] {
    return this.trainrunSectionsStore.trainrunSections.filter((ts) => ts.selected());
  }

  unselectAllTrainrunSections(enforceUpdate = true) {
    this.trainrunSectionsStore.trainrunSections.forEach((tr) => tr.unselect());
    if (enforceUpdate) {
      this.trainrunSectionsUpdated();
    }
  }

  unselectTrainrunSection(trainrunSectionId: number, enforceUpdate = true) {
    this.getTrainrunSectionFromId(trainrunSectionId).unselect();
    if (enforceUpdate) {
      this.trainrunSectionsUpdated();
    }
  }

  setTrainrunSectionAsSelected(trainrunSectionId: number) {
    this.unselectAllTrainrunSections(false);
    this.getTrainrunSectionFromId(trainrunSectionId)?.select();
    this.trainrunSectionsUpdated();
  }

  getSelectedTrainrunSection(): TrainrunSection {
    const selectedTrainrunSection = this.trainrunSectionsStore.trainrunSections.find((tr) =>
      tr.selected(),
    );
    if (selectedTrainrunSection !== undefined) {
      return selectedTrainrunSection;
    } else {
      return null;
    }
  }

  setTrainrunSectionsDataAndValidate(trainrunSections: TrainrunSectionDto[]) {
    this.trainrunSectionsStore.trainrunSections = trainrunSections.map(
      (trainrunSectionDto) => new TrainrunSection(trainrunSectionDto),
    );

    this.trainrunSectionsStore.trainrunSections.forEach((trainrunSection) => {
      TrainrunSectionValidator.validateOneSection(trainrunSection);
      TrainrunSectionValidator.validateTravelTime(
        trainrunSection,
        this.filterService.getTimeDisplayPrecision(),
      );
    });
  }

  createNewTrainrunSectionsFromDtoList(
    trainrunSections: TrainrunSectionDto[],
    nodeMap: Map<number, number>,
    trainrunMap: Map<number, number>,
    nodes: NodeDto[],
    enforceUpdate = true,
  ): Map<number, number> {
    const trainrunSectionMap: Map<number, number> = new Map<number, number>();
    trainrunSections.forEach((trainrunSection) => {
      const newTrainrunSection = this.createNewTrainrunSectionFromDto(
        trainrunSection,
        nodeMap,
        trainrunMap,
        nodes,
        enforceUpdate,
      );
      trainrunSectionMap.set(trainrunSection.id, newTrainrunSection.getId());
    });
    if (enforceUpdate) {
      this.trainrunSectionsUpdated();
    }
    return trainrunSectionMap;
  }

  mergeTrainrunSections(
    trainrunSections: TrainrunSectionDto[],
    nodeMap: Map<number, number>,
    trainrunMap: Map<number, number>,
    nodes: NodeDto[],
  ) {
    trainrunSections.forEach((trainrunSection) => {
      const trainrunId = trainrunMap.get(trainrunSection.trainrunId);
      const existingTrainrunSection = this.trainrunSectionsStore.trainrunSections.find(
        (ts: TrainrunSection) =>
          (ts.getTrainrunId() === trainrunId &&
            ts.getSourceNodeId() === trainrunSection.sourceNodeId &&
            ts.getTargetNodeId() === trainrunSection.targetNodeId) ||
          (ts.getTrainrunId() === trainrunId &&
            ts.getSourceNodeId() === trainrunSection.targetNodeId &&
            ts.getTargetNodeId() === trainrunSection.sourceNodeId),
      );
      if (existingTrainrunSection === undefined) {
        this.createNewTrainrunSectionFromDto(trainrunSection, nodeMap, trainrunMap, nodes);
      }
    });
    this.trainrunSectionsUpdated();
  }

  initializeTrainrunSectionsWithReferencesToNodesAndTrainruns() {
    this.trainrunSectionsStore.trainrunSections.forEach((trainrunSection) =>
      trainrunSection.setSourceAndTargetNodeReference(
        this.nodeService.getNodeFromId(trainrunSection.getSourceNodeId()),
        this.nodeService.getNodeFromId(trainrunSection.getTargetNodeId()),
      ),
    );
    this.trainrunSectionsStore.trainrunSections.forEach((trainrunSection) =>
      trainrunSection.setTrainrun(
        this.trainrunService.getTrainrunFromId(trainrunSection.getTrainrunId()),
      ),
    );
  }

  updateTrainrunSectionTime(
    trsId: number,
    sourceArrivalTime: number,
    sourceDeparture: number,
    targetArrival: number,
    targetDeparture: number,
    travelTime: number,
    backwardTravelTime: number,
  ) {
    const trainrunSection = this.getTrainrunSectionFromId(trsId);
    trainrunSection.setSourceArrival(sourceArrivalTime);
    trainrunSection.setSourceDeparture(sourceDeparture);
    trainrunSection.setTargetArrival(targetArrival);
    trainrunSection.setTargetDeparture(targetDeparture);
    trainrunSection.setTravelTime(travelTime);
    trainrunSection.setBackwardTravelTime(backwardTravelTime);
    this.trainrunSectionTimesUpdated(trainrunSection);
  }

  private updateTrainrunSectionLeftAndRightTimes(
    section: DirectedTrainrunSectionProxy,
    timeStructure: LeftAndRightTimeStructure,
  ) {
    section.setTailDeparture(timeStructure.leftDepartureTime);
    section.setTailArrival(timeStructure.leftArrivalTime);
    section.setHeadDeparture(timeStructure.rightDepartureTime);
    section.setHeadArrival(timeStructure.rightArrivalTime);
    section.setTravelTime(timeStructure.travelTime);
    section.setReverseTravelTime(timeStructure.bottomTravelTime);
    this.trainrunSectionTimesUpdated(section.trainrunSection);
  }

  private trainrunSectionTimesUpdated(trainrunSection: TrainrunSection) {
    TrainrunSectionValidator.validateOneSection(trainrunSection);
    this.trainrunService.propagateConsecutiveTimesForTrainrun(trainrunSection.getId());
    this.nodeService.validateConnections(trainrunSection.getSourceNode());
    this.nodeService.validateConnections(trainrunSection.getTargetNode());
  }

  private findTrainrunSectionForStopNode(
    trainrunSection: TrainrunSection,
    node: Node,
    stopNodeId: number,
  ) {
    const iterator = this.trainrunService.getNextExpandedStopIterator(node, trainrunSection);
    while (iterator.hasNext()) {
      iterator.next();
      if (iterator.current().node.getId() === stopNodeId) {
        return iterator.current().trainrunSection.getId();
      }
    }
    return undefined;
  }

  propagateTimeAlongTrainrun(trainrunSectionId: number, fromNodeIdOn: number) {
    const trainrunSection = this.getTrainrunSectionFromId(trainrunSectionId);

    let fromNode =
      fromNodeIdOn === trainrunSection.getSourceNodeId()
        ? trainrunSection.getSourceNode()
        : trainrunSection.getTargetNode();
    let fromTrainrunSectionId: number | undefined = trainrunSectionId;

    if (fromNode.getId() !== fromNodeIdOn) {
      fromNode = this.nodeService.getNodeFromId(fromNodeIdOn);
      fromTrainrunSectionId = this.findTrainrunSectionForStopNode(
        trainrunSection,
        trainrunSection.getSourceNode(),
        fromNodeIdOn,
      );
      if (fromTrainrunSectionId === undefined) {
        fromTrainrunSectionId = this.findTrainrunSectionForStopNode(
          trainrunSection,
          trainrunSection.getTargetNode(),
          fromNodeIdOn,
        );
      }
      if (fromTrainrunSectionId === undefined) {
        return;
      }
    }

    this.iterateAlongTrainrunUntilEndAndPropagateTime(fromNode, fromTrainrunSectionId);
    this.trainrunSectionsUpdated();
    this.operation.emit(new TrainrunOperation(OperationType.update, trainrunSection.getTrainrun()));
  }

  propagateTrainrunSectionTime(
    previousSection: DirectedTrainrunSectionProxy,
    section: DirectedTrainrunSectionProxy,
  ) {
    const halteZeit = this.getTrainrunSectionHaltezeit(
      previousSection.getHeadNode(),
      section.trainrunSection,
    );

    // Try to update the section (based on previous section)
    if (section.getTailDepartureLock()) {
      // The tail element is locked - no changes allowed!
      return;
    }

    // Update tail arrival time
    const newTailDeparture = MathUtils.round(
      (previousSection.getHeadArrival() + halteZeit) % 60,
      TrainrunSectionService.TIME_PRECISION,
    );
    let newTailArrival;
    if (section.getTailSymmetry()) {
      newTailArrival = MathUtils.round(
        TrainrunsectionHelper.getSymmetricTime(newTailDeparture),
        TrainrunSectionService.TIME_PRECISION,
      );
    } else if (section.getHeadSymmetry()) {
      // TODO: de-duplicate with logic below
      let newHeadDeparture;
      if (!section.getHeadArrivalLock()) {
        const newHeadArrival = MathUtils.mod60(newTailDeparture + section.getTravelTime());
        newHeadDeparture = TrainrunsectionHelper.getSymmetricTime(newHeadArrival);
      } else {
        newHeadDeparture = section.getHeadDeparture();
      }
      newTailArrival = MathUtils.round(
        MathUtils.mod60(newHeadDeparture + section.getReverseTravelTime()),
        TrainrunSectionService.TIME_PRECISION,
      );
    } else {
      newTailArrival = MathUtils.round(
        MathUtils.mod60(previousSection.getHeadDeparture() - halteZeit),
        TrainrunSectionService.TIME_PRECISION,
      );
    }
    section.setTailDeparture(newTailDeparture);
    section.setTailArrival(newTailArrival);

    // Use travel time to update the head times - if allowed
    if (!section.getHeadArrivalLock()) {
      // Target is not locked -> update the Target Arrival Time
      const newHeadArrival = MathUtils.round(
        (newTailDeparture + section.getTravelTime()) % 60,
        TrainrunSectionService.TIME_PRECISION,
      );
      let newHeadDeparture;
      if (section.getHeadSymmetry()) {
        newHeadDeparture = MathUtils.round(
          TrainrunsectionHelper.getSymmetricTime(newHeadArrival),
          TrainrunSectionService.TIME_PRECISION,
        );
      } else {
        newHeadDeparture = MathUtils.round(
          MathUtils.mod60(newTailArrival - section.getReverseTravelTime()),
          TrainrunSectionService.TIME_PRECISION,
        );
      }
      section.setHeadArrival(newHeadArrival);
      section.setHeadDeparture(newHeadDeparture);

      return;
    }

    // Update travel time if possible
    if (section.getTravelTimeLock()) {
      return;
    }

    let newTravelTime = MathUtils.mod60(section.getHeadArrival() - newTailDeparture);
    newTravelTime += Math.floor(section.getTravelTime() / 60) * 60;
    section.setTravelTime(newTravelTime);

    let newReverseTravelTime = MathUtils.mod60(newTailArrival - section.getHeadDeparture());
    newReverseTravelTime += Math.floor(section.getReverseTravelTime() / 60) * 60;
    section.setReverseTravelTime(newReverseTravelTime);
  }

  private getTrainrunSectionHaltezeit(node: Node, trainrunSection: TrainrunSection): number {
    if (node.isNonStop(trainrunSection)) {
      return 0;
    }
    const trainrunCategoryHaltezeit = node.getTrainrunCategoryHaltezeit();
    const fachCategory = trainrunSection.getTrainrun().getTrainrunCategory().fachCategory;
    return trainrunCategoryHaltezeit[fachCategory].haltezeit;
  }

  iterateAlongTrainrunUntilEndAndPropagateTime(nodeFrom: Node, trainrunSectionId: number) {
    const trainrunSection = this.getTrainrunSectionFromId(trainrunSectionId);

    const iterator = this.trainrunService.getIterator(nodeFrom, trainrunSection);
    let previousPair = iterator.next();

    TrainrunSectionValidator.validateOneSection(previousPair.trainrunSection);

    while (iterator.hasNext()) {
      const pair = iterator.next();

      const previousSection = previousPair.getDirectedTrainrunSectionProxy();
      const section = pair.getDirectedTrainrunSectionProxy();
      this.propagateTrainrunSectionTime(previousSection, section);
      TrainrunSectionValidator.validateOneSection(pair.trainrunSection);

      if (
        pair.trainrunSection.getSourceDepartureLock() ||
        pair.trainrunSection.getTargetDepartureLock()
      ) {
        break;
      }
      previousPair = pair;
    }

    if (trainrunSection !== undefined) {
      this.trainrunService.propagateConsecutiveTimesForTrainrun(trainrunSection.getId());
    }
  }

  updateTrainrunSectionTimeLock(
    trsId: number,
    sourceLock: boolean,
    targetLock: boolean,
    travelTimeLock: boolean,
    enforceUpdate = true,
  ) {
    const trainrunSection = this.getTrainrunSectionFromId(trsId);
    if (sourceLock !== undefined) {
      trainrunSection.setSourceArrivalLock(sourceLock);
      trainrunSection.setSourceDepartureLock(sourceLock);
    }
    if (targetLock !== undefined) {
      trainrunSection.setTargetArrivalLock(targetLock);
      trainrunSection.setTargetDepartureLock(targetLock);
    }
    if (travelTimeLock !== undefined) {
      trainrunSection.setTravelTimeLock(travelTimeLock);
      trainrunSection.setBackwardTravelTimeLock(travelTimeLock);
    }
    if (enforceUpdate) {
      this.trainrunSectionsUpdated();
    }
  }

  retrieveTravelTime(sourceNodeId: number, targetNodeId: number, trainrun: Trainrun): number {
    const foundTrainruns = this.getTrainrunSections().filter(
      (ts) =>
        (ts.getSourceNodeId() === sourceNodeId && ts.getTargetNodeId() === targetNodeId) ||
        (ts.getSourceNodeId() === targetNodeId && ts.getTargetNodeId() === sourceNodeId),
    );
    if (foundTrainruns.length === 0) {
      return 1;
    }

    const sameTrainCat = foundTrainruns.filter(
      (ts) => ts.getTrainrun().getTrainrunCategory().id === trainrun.getTrainrunCategory().id,
    );
    if (sameTrainCat.length === 0) {
      return foundTrainruns
        .reduce((a, b) => (a.getTravelTime() > b.getTravelTime() ? a : b))
        .getTravelTime();
    }

    return sameTrainCat
      .reduce((a, b) => (a.getTravelTime() > b.getTravelTime() ? a : b))
      .getTravelTime();
  }

  createTrainrunSection(
    sourceNodeId: number,
    targetNodeId: number,
    retrieveTravelTimeFromEdge: boolean = false,
  ): TrainrunSection {
    const trainrunSection: TrainrunSection = new TrainrunSection();
    const initialTrainrunsLength = this.trainrunService.trainrunsStore.trainruns.length;

    trainrunSection.setTrainrun(this.trainrunService.getSelectedOrNewTrainrun());

    if (retrieveTravelTimeFromEdge) {
      const travelTime = this.retrieveTravelTime(
        sourceNodeId,
        targetNodeId,
        trainrunSection.getTrainrun(),
      );
      trainrunSection.setTravelTime(travelTime);
      trainrunSection.setBackwardTravelTime(travelTime);
    }

    const sourceNode = this.nodeService.getNodeFromId(sourceNodeId);
    const targetNode = this.nodeService.getNodeFromId(targetNodeId);

    trainrunSection.setSourceAndTargetNodeReference(sourceNode, targetNode);
    this.trainrunSectionsStore.trainrunSections.push(trainrunSection);

    this.handleNodeAndTrainrunSectionDetails(sourceNode, targetNode, trainrunSection);

    this.setTrainrunSectionAsSelected(trainrunSection.getId());
    this.propagateTimesForNewTrainrunSection(trainrunSection);

    // Ensure consistent section direction considering the previous ones
    this.enforceConsistentSectionDirection(trainrunSection.getTrainrunId());

    //this.trainrunSectionsUpdated();
    this.trainrunService.trainrunsUpdated();

    if (initialTrainrunsLength !== this.trainrunService.trainrunsStore.trainruns.length) {
      this.operation.emit(
        new TrainrunOperation(OperationType.create, trainrunSection.getTrainrun()),
      );
    } else {
      this.operation.emit(
        new TrainrunOperation(OperationType.update, trainrunSection.getTrainrun()),
      );
    }

    return trainrunSection;
  }

  reconnectTrainrunSection(
    sourceNodeId: number,
    targetNodeId: number,
    existingTrainrunSectionId: number,
    existingTrainrunSectionTargetNodeId: number,
    existingTrainrunSectionSourceNodeId: number,
    enforceUpdate = true,
    emit = true,
  ) {
    // swap source and target
    if (
      sourceNodeId === existingTrainrunSectionTargetNodeId ||
      targetNodeId === existingTrainrunSectionSourceNodeId
    ) {
      const tmp = targetNodeId;
      targetNodeId = sourceNodeId;
      sourceNodeId = tmp;
    }

    // early return -> if the user drops the trainrunsection to the same pin as before
    if (
      sourceNodeId === existingTrainrunSectionSourceNodeId &&
      targetNodeId === existingTrainrunSectionTargetNodeId
    ) {
      return;
    }

    const trainrunSection: TrainrunSection =
      this.getTrainrunSectionFromId(existingTrainrunSectionId);

    const {nodeFrom, nodeToNew, nodeToOld} = this.getFromAndToNode(
      sourceNodeId,
      trainrunSection,
      targetNodeId,
    );
    const previousTrainrunSection = nodeToOld.getNextTrainrunSection(trainrunSection);

    nodeToOld.removeTransition(trainrunSection);
    nodeToOld.removeConnectionFromTrainrunSection(trainrunSection);
    nodeToOld.removePort(trainrunSection);
    nodeToOld.updateTransitionsAndConnections(this.nodeService.getCurrentOrderingAlgorithm());
    TrainrunSectionService.setToNode(sourceNodeId, trainrunSection, nodeToNew, targetNodeId);

    const orderingType = this.nodeService.getCurrentOrderingAlgorithm();
    nodeToNew.addPortWithRespectToOppositeNode(nodeFrom, trainrunSection, orderingType);
    if (this.nodeService.isConditionToAddTransitionFullfilled(nodeToNew, trainrunSection)) {
      this.nodeService.addTransitionAndComputeRoutingFromFreePorts(
        nodeToNew,
        trainrunSection.getTrainrun(),
      );
    }
    nodeFrom.reAlignPortWithRespectToOppositeNode(nodeToNew, trainrunSection, orderingType);

    if (previousTrainrunSection !== undefined) {
      this.nodeService.checkAndFixMissingTransitions(
        previousTrainrunSection.getSourceNodeId(),
        previousTrainrunSection.getTargetNodeId(),
        previousTrainrunSection.getId(),
        false,
      );
    }

    this.trainrunService.propagateConsecutiveTimesForTrainrun(trainrunSection.getId());

    if (enforceUpdate) {
      this.nodeService.initPortOrdering();
      this.nodeService.nodesUpdated();
      this.nodeService.connectionsUpdated();
      this.nodeService.transitionsUpdated();
      this.trainrunSectionsUpdated();
    }
    if (emit) {
      this.operation.emit(
        new TrainrunOperation(OperationType.update, trainrunSection.getTrainrun()),
      );
    }
  }

  deleteListOfTrainrunSections(trainrunSections: TrainrunSection[], enforceUpdate = true) {
    trainrunSections.forEach((trainrunSection) => {
      this.deleteTrainrunSectionAndCleanupNodes(trainrunSection, false);
    });
    if (enforceUpdate) {
      this.nodeService.transitionsUpdated();
      this.nodeService.connectionsUpdated();
      this.trainrunService.trainrunsUpdated();
      this.trainrunSectionsUpdated();
    }
  }

  deleteAllVisibleTrainrunSections(enforceUpdate = true) {
    const allTrainrunSections = this.trainrunSectionsStore.trainrunSections;
    allTrainrunSections.forEach((trainrunSection: TrainrunSection) => {
      if (this.filterService.filterTrainrunsection(trainrunSection)) {
        this.deleteTrainrunSectionAndCleanupNodes(trainrunSection, false);
      }
    });
    if (enforceUpdate) {
      this.nodeService.transitionsUpdated();
      this.nodeService.connectionsUpdated();
      this.trainrunService.trainrunsUpdated();
      this.trainrunSectionsUpdated();
    }
  }

  deleteAllNonVisibleTrainrunSections(enforceUpdate = true) {
    const allTrainrunSections = this.trainrunSectionsStore.trainrunSections;
    allTrainrunSections.forEach((trainrunSection: TrainrunSection) => {
      if (!this.filterService.filterTrainrunsection(trainrunSection)) {
        this.deleteTrainrunSectionAndCleanupNodes(trainrunSection, false);
      }
    });
    if (enforceUpdate) {
      this.nodeService.transitionsUpdated();
      this.nodeService.connectionsUpdated();
      this.trainrunService.trainrunsUpdated();
      this.trainrunSectionsUpdated();
    }
  }

  deleteTrainrunSection(
    trainrunSectionId: number,
    enforceUpdate = true,
    checkAllTransitions = false,
    emit = true,
  ) {
    const trainrunSection = this.getTrainrunSectionFromId(trainrunSectionId);
    const trainrun = trainrunSection.getTrainrun();
    const sourceNodeId = trainrunSection.getSourceNodeId();
    const targetNodeId = trainrunSection.getTargetNodeId();
    this.deleteTrainrunSectionAndCleanupNodes(trainrunSection, false);
    this.getTrainrunSections()
      .filter(
        (ts: TrainrunSection) =>
          ts.getSourceNodeId() === sourceNodeId ||
          ts.getSourceNodeId() === targetNodeId ||
          ts.getTargetNodeId() === sourceNodeId ||
          ts.getTargetNodeId() === targetNodeId,
      )
      .forEach((ts: TrainrunSection) => {
        this.nodeService.checkAndFixMissingTransitions(
          sourceNodeId,
          targetNodeId,
          ts.getId(),
          false,
        );
      });
    if (
      checkAllTransitions &&
      this.getAllTrainrunSectionsForTrainrun(trainrun.getId()).length > 0
    ) {
      this.checkMissingTransitionsAfterDeletion(trainrun);
    }
    if (enforceUpdate) {
      this.nodeService.transitionsUpdated();
      this.nodeService.connectionsUpdated();
      this.trainrunSectionsUpdated();
    }
    if (this.getAllTrainrunSectionsForTrainrun(trainrun.getId()).length && emit) {
      this.operation.emit(
        new TrainrunOperation(OperationType.update, trainrunSection.getTrainrun()),
      );
    }
  }

  getDtos() {
    return this.trainrunSectionsStore.trainrunSections.map((trainrunSection) =>
      trainrunSection.getDto(),
    );
  }

  getTrainrunSections(): TrainrunSection[] {
    return Object.assign({}, this.trainrunSectionsStore).trainrunSections;
  }

  getAllTrainrunSectionsForTrainrun(trainrunID: number): TrainrunSection[] {
    const trainrunSections = this.trainrunSectionsStore.trainrunSections.filter(
      (t: TrainrunSection) => t.getTrainrunId() === trainrunID,
    );
    if (trainrunSections === undefined) {
      return [];
    }
    return trainrunSections;
  }

  deleteAllTrainrunSectionsOfTrainrun(trainrunId: number) {
    const filterTS = this.getAllTrainrunSectionsForTrainrun(trainrunId);
    const lastTrs = filterTS.pop();
    filterTS.forEach((trs: TrainrunSection) => {
      this.deleteTrainrunSectionAndCleanupNodes(trs, false);
    });
    if (lastTrs !== undefined) {
      this.deleteTrainrunSectionAndCleanupNodes(lastTrs, false);
      this.nodeService.transitionsUpdated();
      this.nodeService.connectionsUpdated();
      this.trainrunService.trainrunsUpdated();
    }
  }

  setTimeStructureToSingleTrainrunSection(
    section: DirectedTrainrunSectionProxy,
    timeStructure: LeftAndRightTimeStructure,
  ) {
    this.updateTrainrunSectionLeftAndRightTimes(section, timeStructure);
    this.operation.emit(
      new TrainrunOperation(OperationType.update, section.trainrunSection.getTrainrun()),
    );
  }

  setTimeStructureToTrainrunSections(
    timeStructure: LeftAndRightTimeStructure,
    trainrunSection: TrainrunSection,
    precision = 0,
  ) {
    const firstTrainrunSection =
      this.trainrunService.getFirstNonStopTrainrunSection(trainrunSection);
    const firstSourceNode = firstTrainrunSection.getSourceNode();
    const lastTrainrunSection = this.trainrunService.getLastNonStopTrainrunSection(
      firstSourceNode,
      firstTrainrunSection,
    );
    const lastTargetNode = lastTrainrunSection.getTargetNode();

    // Get rid of left/right paradigm
    const isTargetRightOrBottom =
      GeneralViewFunctions.getRightOrBottomNode(firstSourceNode, lastTargetNode) === lastTargetNode;
    let sourceDepartureTime, travelTime, targetDepartureTime, backwardTravelTime;
    if (isTargetRightOrBottom) {
      sourceDepartureTime = timeStructure.leftDepartureTime;
      targetDepartureTime = timeStructure.rightDepartureTime;
      travelTime = timeStructure.travelTime;
      backwardTravelTime = timeStructure.bottomTravelTime;
    } else {
      sourceDepartureTime = timeStructure.rightDepartureTime;
      targetDepartureTime = timeStructure.leftDepartureTime;
      travelTime = timeStructure.bottomTravelTime;
      backwardTravelTime = timeStructure.travelTime;
    }

    // Source to target
    const totalCumulativeTravelTime = this.trainrunService.getCumulativeTravelTime(
      firstTrainrunSection,
      "sourceToTarget",
    );
    this.setTimeStructureInDirection({
      chainDepartureTime: sourceDepartureTime,
      chainTravelTime: travelTime,
      iterator: this.trainrunService.getNextExpandedStopIterator(
        firstSourceNode,
        firstTrainrunSection,
      ),
      totalCumulativeTravelTime: totalCumulativeTravelTime,
      precision,
    });

    // Target to source
    const totalCumulativeBackwardTravelTime = this.trainrunService.getCumulativeTravelTime(
      lastTrainrunSection,
      "targetToSource",
    );
    this.setTimeStructureInDirection({
      chainDepartureTime: targetDepartureTime,
      chainTravelTime: backwardTravelTime,
      iterator: this.trainrunService.getNextExpandedStopIterator(
        lastTargetNode,
        lastTrainrunSection,
      ),
      totalCumulativeTravelTime: totalCumulativeBackwardTravelTime,
      precision,
    });

    const iterator = this.trainrunService.getNextExpandedStopIterator(
      firstSourceNode,
      firstTrainrunSection,
    );
    while (iterator.hasNext()) {
      const pair = iterator.next();
      this.trainrunSectionTimesUpdated(pair.trainrunSection);
    }

    this.trainrunSectionsUpdated();
    this.nodeService.connectionsUpdated();
    this.operation.emit(new TrainrunOperation(OperationType.update, trainrunSection.getTrainrun()));
  }

  private setTimeStructureInDirection({
    chainDepartureTime,
    chainTravelTime,
    iterator,
    totalCumulativeTravelTime,
    precision,
  }: {
    chainDepartureTime: number;
    chainTravelTime: number;
    iterator: TrainrunIterator;
    totalCumulativeTravelTime: number;
    precision: number;
  }) {
    const travelTimeFactor = chainTravelTime / totalCumulativeTravelTime;
    let departureTime = chainDepartureTime;
    let summedTravelTime = 0;
    let stopTime = 0;
    let previousHeadArrival = null;
    while (iterator.hasNext()) {
      const pair = iterator.next();
      const section = pair.getDirectedTrainrunSectionProxy();

      if (previousHeadArrival !== null) {
        stopTime = MathUtils.mod60(section.getTailDeparture() - previousHeadArrival);
      }
      previousHeadArrival = section.getHeadArrival();

      const isIntermediateNode =
        pair.node.isNonStop(pair.trainrunSection) || pair.node.getIsCollapsed();
      const travelTime = isIntermediateNode
        ? TrainrunsectionHelper.getSectionDistributedTravelTime(
            section.getTravelTime(),
            travelTimeFactor,
            precision,
          )
        : TrainrunsectionHelper.getLastSectionTravelTime(
            chainTravelTime,
            summedTravelTime,
            precision,
          );
      departureTime = departureTime + stopTime;
      const arrivalTime = MathUtils.round((departureTime + travelTime) % 60, precision);

      section.setTailDeparture(departureTime);
      section.setTravelTime(travelTime);
      section.setHeadArrival(arrivalTime);

      // Next section departure inherits from the previous arrival
      departureTime = arrivalTime;
      summedTravelTime += travelTime;
    }
  }

  trainrunSectionsUpdated() {
    this.trainrunSectionsSubject.next(
      Object.assign({}, this.trainrunSectionsStore).trainrunSections,
    );
  }

  copyAllTrainrunSectionsForTrainrun(trainrunIdToCopyFrom: number, newTrainrunId: number) {
    const trainrunSections = this.getAllTrainrunSectionsForTrainrun(trainrunIdToCopyFrom);
    trainrunSections.forEach((trainrunSection) => {
      const newSection = this.copyTrainrunSectionAndAddToNodes(trainrunSection, newTrainrunId);
      if (trainrunSection.selected()) {
        trainrunSection.unselect();
        newSection.select();
      }
    });
  }

  // this function is no longer used for its original purpose (drag a node that only existed inside numberOfStops and create it inside the real graph)
  replaceIntermediateStopWithNode(
    trainrunSectionId: number,
    nodeId: number,
    stopDuration?: number,
    enforceUpdate = true,
  ) {
    const trainrunSection1 = this.getTrainrunSectionFromId(trainrunSectionId);
    if (
      trainrunSection1.getSourceNodeId() === nodeId ||
      trainrunSection1.getTargetNodeId() === nodeId
    ) {
      return {};
    }
    const origTravelTime = trainrunSection1.getTravelTime();
    const origBackwardTravelTime = trainrunSection1.getBackwardTravelTime();
    const trainrunSection2 = this.copyTrainrunSection(
      trainrunSection1,
      trainrunSection1.getTrainrunId(),
    );
    const node1 = trainrunSection1.getSourceNode();
    const node2 = trainrunSection1.getTargetNode();
    const nodeIntermediate = this.nodeService.getNodeFromId(nodeId);
    const transition1: Transition = node1.getTransition(trainrunSection1.getId());
    const nonStop1 = transition1 !== undefined ? transition1.getIsNonStopTransit() : false;
    const transition2: Transition = node2.getTransition(trainrunSection1.getId());
    const nonStop2 = transition2 !== undefined ? transition2.getIsNonStopTransit() : false;

    node2.replaceTrainrunSectionOnPort(trainrunSection1, trainrunSection2);

    const portOrderingType = this.nodeService.getCurrentOrderingAlgorithm();
    trainrunSection1.setTargetNode(nodeIntermediate);
    nodeIntermediate.addPortWithRespectToOppositeNode(node1, trainrunSection1, portOrderingType);
    node1.reAlignPortWithRespectToOppositeNode(
      nodeIntermediate,
      trainrunSection1,
      portOrderingType,
    );

    trainrunSection2.setSourceNode(nodeIntermediate);
    trainrunSection2.setTargetNode(node2);
    nodeIntermediate.addPortWithRespectToOppositeNode(node2, trainrunSection2, portOrderingType);
    node2.reAlignPortWithRespectToOppositeNode(
      nodeIntermediate,
      trainrunSection2,
      portOrderingType,
    );

    this.nodeService.addTransitionToNodeForTrainrunSections(
      nodeIntermediate.getId(),
      trainrunSection1,
      trainrunSection2,
    );
    this.trainrunService.propagateConsecutiveTimesForTrainrun(trainrunSection1.getId());

    const minHalteZeitFromNode = this.nodeService.getHaltezeit(
      nodeId,
      trainrunSection1.getTrainrun().getTrainrunCategory(),
    );
    let travelTime1 =
      trainrunSection1.getTargetArrivalConsecutiveTime() -
      trainrunSection1.getSourceDepartureConsecutiveTime();
    let travelTime2 =
      trainrunSection1.getSourceArrivalConsecutiveTime() -
      trainrunSection1.getTargetDepartureConsecutiveTime();
    travelTime1 = travelTime1 < 0 ? travelTime2 : travelTime1;
    travelTime2 = travelTime2 < 0 ? travelTime1 : travelTime2;
    const calculatedTravelTime = Math.min(travelTime1, travelTime2);
    const halteZeit =
      stopDuration ?? Math.min(minHalteZeitFromNode, Math.max(0, calculatedTravelTime - 2));
    const travelTimeIssue = !travelTime1 || !travelTime2;
    const halteZeitIssue = minHalteZeitFromNode < halteZeit;
    const travelTime = Math.max(trainrunSection1.getTravelTime() - halteZeit, 0);
    const backwardTravelTime = Math.max(trainrunSection1.getBackwardTravelTime() - halteZeit, 0);
    const halfTravelTime = travelTime / 2;
    const halfBackwardTravelTime = backwardTravelTime / 2;
    trainrunSection1.setTravelTime(travelTime - halfTravelTime);
    trainrunSection1.setBackwardTravelTime(backwardTravelTime - halfBackwardTravelTime);
    trainrunSection2.setTravelTime(halfTravelTime);
    trainrunSection2.setBackwardTravelTime(halfBackwardTravelTime);

    trainrunSection1.setTargetArrival(
      TrainrunSectionService.boundMinutesToOneHour(
        trainrunSection1.getSourceDeparture() + trainrunSection1.getTravelTime(),
      ),
    );
    trainrunSection2.setSourceArrival(
      TrainrunSectionService.boundMinutesToOneHour(
        trainrunSection1.getTargetDeparture() + trainrunSection2.getTravelTime(),
      ),
    );
    trainrunSection1.setTargetDeparture(
      TrainrunSectionService.boundMinutesToOneHour(halteZeit + trainrunSection2.getSourceArrival()),
    );
    trainrunSection2.setSourceDeparture(
      TrainrunSectionService.boundMinutesToOneHour(halteZeit + trainrunSection1.getTargetArrival()),
    );

    if (
      halteZeitIssue ||
      trainrunSection1.getTravelTime() + trainrunSection2.getTravelTime() + halteZeit !==
        origTravelTime ||
      trainrunSection1.getBackwardTravelTime() +
        trainrunSection2.getBackwardTravelTime() +
        halteZeit !==
        origBackwardTravelTime ||
      travelTimeIssue
    ) {
      const title = $localize`:@@app.services.data.trainrunsection.intermediate-stop-replacement.title:Intermediate stop replacement`;
      const description = $localize`:@@app.services.data.trainrunsection.intermediate-stop-replacement.description:Intermediate stop replacement led to inconsistencies in the allocation of times!`;
      trainrunSection1.setTargetArrivalWarning(title, description);
      trainrunSection1.setTargetDepartureWarning(title, description);
      trainrunSection2.setSourceArrivalWarning(title, description);
      trainrunSection2.setSourceDepartureWarning(title, description);
    }

    const transitionNew1 = node1.getTransition(trainrunSection1.getId());
    if (transitionNew1 !== undefined) {
      transitionNew1.setIsNonStopTransit(nonStop1);
    }
    const transitionNew2 = node2.getTransition(trainrunSection2.getId());
    if (transitionNew2 !== undefined) {
      transitionNew2.setIsNonStopTransit(nonStop2);
    }

    this.trainrunService.propagateConsecutiveTimesForTrainrun(trainrunSection1.getId());

    if (enforceUpdate) {
      this.nodeService.initPortOrdering();
      this.nodeService.transitionsUpdated();
      this.nodeService.connectionsUpdated();
      this.trainrunSectionsUpdated();
    }
    return {
      existingTrainrunSection: trainrunSection1,
      newTrainrunSection: trainrunSection2,
    };
  }

  addIntermediateStopOnTrainrunSection(trainrunSection: TrainrunSection) {
    const sourceNode = trainrunSection.getSourceNode();
    const targetNode = trainrunSection.getTargetNode();
    const interpolatedPosition = new Vec2D(
      sourceNode.getPositionX() + (targetNode.getPositionX() - sourceNode.getPositionX()) * 0.5,
      sourceNode.getPositionY() + (targetNode.getPositionY() - sourceNode.getPositionY()) * 0.5,
    );

    const newNode = this.nodeService.addEmptyNode(
      interpolatedPosition.getX(),
      interpolatedPosition.getY(),
    );

    this.replaceIntermediateStopWithNode(trainrunSection.getId(), newNode.getId(), 0);
    this.operation.emit(new TrainrunOperation(OperationType.update, trainrunSection.getTrainrun()));
  }

  removeIntermediateStopOnTrainrunSection(initialTrainrunSection: TrainrunSection): boolean {
    // look for the end of the trainrun sections chain
    const forwardIterator = this.trainrunService.getNextExpandedIterator(
      initialTrainrunSection.getSourceNode(),
      initialTrainrunSection,
    );
    while (forwardIterator.hasNext()) forwardIterator.next();
    const lastExpandedPair = forwardIterator.current();

    // traverse the chain and look for a node to remove
    let nodeRemoved = false;
    const backwardIterator = this.trainrunService.getBackwardNextExpandedIterator(
      lastExpandedPair.node,
      lastExpandedPair.trainrunSection,
    );
    while (backwardIterator.hasNext() && !nodeRemoved) {
      backwardIterator.next();
      const {node, trainrunSection} = backwardIterator.current();
      if (!node.isEmpty()) break;
      if (!node.isNonStopNode() && node.getIsCollapsed()) {
        // undock the empty node of the trainrun
        const mergedSection = this.nodeService.undockTransition(
          node.getId(),
          node.getTransition(trainrunSection.getId()).getId(),
        );
        if (mergedSection) {
          mergedSection.setNumberOfStops(Math.max(0, mergedSection.getNumberOfStops() - 1));
        }
        // remove node only if it is not used anymore
        if (node.getTransitions().length === 0) {
          // unselect details
          if (this.nodeService.isNodeSelected(node.getId())) {
            this.nodeService.unselectNode(node.getId());
            // TODO: also call UiInteractionService.closeNodeStammdaten() if opened
          }
          this.nodeService.deleteNode(node.getId());
        }
        nodeRemoved = true;
      }
    }
    return nodeRemoved;
  }

  setWarningOnNode(
    trainrunSectionId: number,
    nodeId: number,
    warningTitle: string,
    warningDescription: string,
  ) {
    const trainrunSection = this.getTrainrunSectionFromId(trainrunSectionId);
    if (trainrunSection.getSourceNodeId() === nodeId) {
      trainrunSection.setSourceArrivalWarning(warningTitle, warningDescription);
      trainrunSection.setSourceDepartureWarning(warningTitle, warningDescription);
    } else {
      trainrunSection.setTargetArrivalWarning(warningTitle, warningDescription);
      trainrunSection.setTargetDepartureWarning(warningTitle, warningDescription);
    }
  }

  clickSelectedTrainrunSection(informSelectedTrainrunClick: InformSelectedTrainrunClick) {
    this.informSelectedTrainrunClickSubject.next(informSelectedTrainrunClick);
  }

  invertTrainrunSectionsSourceAndTarget(trainrunId: number) {
    this.getAllTrainrunSectionsForTrainrun(trainrunId).forEach((trainrunSection) => {
      this.invertTrainrunSectionSourceAndTarget(trainrunSection);
    });
  }

  isTrainrunSymmetric(trainrunId: number): boolean {
    return this.getAllTrainrunSectionsForTrainrun(trainrunId).every((section) =>
      section.isSymmetric(),
    );
  }

  private copyTrainrunSection(
    existingTrainrunSection: TrainrunSection,
    newTrainrunId: number,
  ): TrainrunSection {
    const trainrunSection: TrainrunSection = new TrainrunSection();
    trainrunSection.setTrainrun(this.trainrunService.getTrainrunFromId(newTrainrunId));
    trainrunSection.setTravelTimeDto(
      JSON.parse(JSON.stringify(existingTrainrunSection.getTravelTimeDto())),
    );
    trainrunSection.setBackwardTravelTimeDto(
      JSON.parse(JSON.stringify(existingTrainrunSection.getBackwardTravelTimeDto())),
    );
    trainrunSection.setSourceSymmetry(existingTrainrunSection.getSourceSymmetry());
    trainrunSection.setTargetSymmetry(existingTrainrunSection.getTargetSymmetry());
    trainrunSection.setSourceArrivalDto(
      JSON.parse(JSON.stringify(existingTrainrunSection.getSourceArrivalDto())),
    );
    trainrunSection.setSourceDepartureDto(
      JSON.parse(JSON.stringify(existingTrainrunSection.getSourceDepartureDto())),
    );
    trainrunSection.setTargetArrivalDto(
      JSON.parse(JSON.stringify(existingTrainrunSection.getTargetArrivalDto())),
    );
    trainrunSection.setTargetDepartureDto(
      JSON.parse(JSON.stringify(existingTrainrunSection.getTargetDepartureDto())),
    );
    trainrunSection.setNumberOfStops(existingTrainrunSection.getNumberOfStops());
    this.trainrunSectionsStore.trainrunSections.push(trainrunSection);
    return trainrunSection;
  }

  private copyTrainrunSectionAndAddToNodes(
    existingTrainrunSection: TrainrunSection,
    newTrainrunId: number,
  ): TrainrunSection {
    const trainrunSection = this.copyTrainrunSection(existingTrainrunSection, newTrainrunId);
    const sourceNode = this.nodeService.getNodeFromId(existingTrainrunSection.getSourceNodeId());
    const targetNode = this.nodeService.getNodeFromId(existingTrainrunSection.getTargetNodeId());
    trainrunSection.setSourceAndTargetNodeReference(sourceNode, targetNode);

    this.nodeService.addPortsToNodes(sourceNode.getId(), targetNode.getId(), trainrunSection);
    this.nodeService.addTransitionToNodes(sourceNode.getId(), targetNode.getId(), trainrunSection);
    this.nodeService.copyTransitionProperties(
      sourceNode.getId(),
      trainrunSection,
      existingTrainrunSection,
    );
    this.nodeService.copyTransitionProperties(
      targetNode.getId(),
      trainrunSection,
      existingTrainrunSection,
    );

    this.trainrunService.propagateConsecutiveTimesForTrainrun(trainrunSection.getId());

    return trainrunSection;
  }

  private deleteTrainrunSectionAndCleanupNodes(
    trainrunSection: TrainrunSection,
    enforceUpdate = true,
  ) {
    this.nodeService.removeTransitionsFromNodes(trainrunSection);
    this.nodeService.removeConnectionsFromNodes(trainrunSection);
    this.nodeService.removePortsFromNodes(trainrunSection);
    this.nodeService.updateTransitionsAndConnectionsOnNodes(trainrunSection);
    if (enforceUpdate) {
      //this.nodeService.nodesUpdated();
      this.nodeService.transitionsUpdated();
      this.nodeService.connectionsUpdated();
    }
    this.trainrunSectionsStore.trainrunSections =
      this.trainrunSectionsStore.trainrunSections.filter(
        (e) => e.getId() !== trainrunSection.getId(),
      );
    this.nodeService.checkAndFixMissingTransitions(
      trainrunSection.getSourceNodeId(),
      trainrunSection.getTargetNodeId(),
      trainrunSection.getId(),
      enforceUpdate,
    );
    this.deleteTrainrunIfNotUsedAnymore(trainrunSection.getTrainrun(), false);

    if (
      this.getTrainrunSections().find(
        (ts) => ts.getTrainrunId() === trainrunSection.getTrainrunId(),
      ) !== undefined
    ) {
      // special case - not last trainrun section deletion
      this.trainrunService.propagateTrainrunInitialConsecutiveTimes(trainrunSection.getTrainrun());
      if (enforceUpdate) {
        this.trainrunService.trainrunsUpdated();
      }
    }
  }

  checkMissingTransitionsAfterDeletion(trainrun: Trainrun) {
    const trainrunSections = this.getAllTrainrunSectionsForTrainrun(trainrun.getId());

    const nodesSeen = new Map<number, Node>();
    trainrunSections.forEach((ts) => {
      nodesSeen.set(ts.getSourceNode().getId(), ts.getSourceNode());
      nodesSeen.set(ts.getTargetNode().getId(), ts.getTargetNode());
    });

    nodesSeen.forEach((node) => {
      const freePorts = node.getFreePortsForTrainrun(trainrun.getId());
      if (freePorts.length !== 2) return;

      const ts1 = freePorts[0].getTrainrunSection();
      const ts2 = freePorts[1].getTrainrunSection();

      // Skip natural terminal nodes of circular paths (e.g. A in A-B-C-A):
      // if the trainrun still forms a cycle, no transition should be created.
      if (this.trainrunService.isStartEqualsEndNode(ts1.getId())) return;

      this.nodeService.addTransitionToNodeForTrainrunSections(node.getId(), ts1, ts2);
    });
  }

  private getFromAndToNode(
    sourceNodeId: number,
    trainrunSection: TrainrunSection,
    targetNodeId: number,
  ) {
    let nodeFrom: Node = null;
    let nodeToNew: Node = null;
    let nodeToOld: Node = null;

    if (sourceNodeId === trainrunSection.getSourceNodeId()) {
      nodeFrom = this.nodeService.getNodeFromId(sourceNodeId);
      nodeToNew = this.nodeService.getNodeFromId(targetNodeId);
      nodeToOld = this.nodeService.getNodeFromId(trainrunSection.getTargetNodeId());
    } else if (targetNodeId === trainrunSection.getSourceNodeId()) {
      nodeFrom = this.nodeService.getNodeFromId(targetNodeId);
      nodeToNew = this.nodeService.getNodeFromId(sourceNodeId);
      nodeToOld = this.nodeService.getNodeFromId(trainrunSection.getTargetNodeId());
    } else if (sourceNodeId === trainrunSection.getTargetNodeId()) {
      nodeFrom = this.nodeService.getNodeFromId(sourceNodeId);
      nodeToNew = this.nodeService.getNodeFromId(targetNodeId);
      nodeToOld = this.nodeService.getNodeFromId(trainrunSection.getSourceNodeId());
    } else if (targetNodeId === trainrunSection.getTargetNodeId()) {
      nodeFrom = this.nodeService.getNodeFromId(targetNodeId);
      nodeToNew = this.nodeService.getNodeFromId(sourceNodeId);
      nodeToOld = this.nodeService.getNodeFromId(trainrunSection.getSourceNodeId());
    }
    return {nodeFrom, nodeToNew, nodeToOld};
  }

  private deleteTrainrunIfNotUsedAnymore(trainrun: Trainrun, enforceUpdate = true) {
    const trainrunSectionWithTrainrun = this.trainrunSectionsStore.trainrunSections.find(
      (trs) => trs.getTrainrun() === trainrun,
    );
    if (trainrunSectionWithTrainrun === undefined) {
      this.trainrunService.deleteTrainrun(trainrun, enforceUpdate);
    }
  }

  private handleNodeAndTrainrunSectionDetails(
    sourceNode: Node,
    targetNode: Node,
    trainrunSection: TrainrunSection,
    sourceIsNonStop = false,
    targetIsNonStop = false,
    enforceUpdate = true,
  ) {
    this.nodeService.addPortsToNodes(sourceNode.getId(), targetNode.getId(), trainrunSection);
    this.nodeService.addTransitionToNodes(
      sourceNode.getId(),
      targetNode.getId(),
      trainrunSection,
      sourceIsNonStop,
      targetIsNonStop,
    );
    if (enforceUpdate) {
      this.nodeService.nodesUpdated();
      this.nodeService.transitionsUpdated();
    }
  }

  private createNewTrainrunSectionFromDto(
    trainrunSection: TrainrunSectionDto,
    nodeMap: Map<number, number>,
    trainrunMap: Map<number, number>,
    nodes: NodeDto[],
    enforceUpdate = true,
  ) {
    const trainrunId = trainrunMap.get(trainrunSection.trainrunId);
    const trainrun = this.trainrunService.getTrainrunFromId(trainrunId);

    const newTrainrunSection: TrainrunSection = new TrainrunSection();
    newTrainrunSection.setTrainrun(trainrun);

    const sourceNodeId = nodeMap.get(trainrunSection.sourceNodeId);
    const sourceNode = this.nodeService.getNodeFromId(sourceNodeId);
    const targetNodeId = nodeMap.get(trainrunSection.targetNodeId);
    const targetNode = this.nodeService.getNodeFromId(targetNodeId);
    newTrainrunSection.setSourceAndTargetNodeReference(sourceNode, targetNode);

    newTrainrunSection.setSourceSymmetry(trainrunSection.sourceSymmetry);
    newTrainrunSection.setTargetSymmetry(trainrunSection.targetSymmetry);
    newTrainrunSection.setSourceArrivalDto(trainrunSection.sourceArrival);
    newTrainrunSection.setTargetArrivalDto(trainrunSection.targetArrival);
    newTrainrunSection.setSourceDepartureDto(trainrunSection.sourceDeparture);
    newTrainrunSection.setTargetDepartureDto(trainrunSection.targetDeparture);
    newTrainrunSection.setTravelTimeDto(trainrunSection.travelTime);
    newTrainrunSection.setBackwardTravelTimeDto(trainrunSection.backwardTravelTime);
    newTrainrunSection.setNumberOfStops(trainrunSection.numberOfStops);
    this.trainrunSectionsStore.trainrunSections.push(newTrainrunSection);
    const sourceIsNonStop = this.getIsNonStop(
      trainrunSection.sourceNodeId,
      trainrunSection.sourcePortId,
      nodes,
    );
    const targetIsNonStop = this.getIsNonStop(
      trainrunSection.targetNodeId,
      trainrunSection.targetPortId,
      nodes,
    );
    this.handleNodeAndTrainrunSectionDetails(
      sourceNode,
      targetNode,
      newTrainrunSection,
      sourceIsNonStop,
      targetIsNonStop,
      enforceUpdate,
    );
    return newTrainrunSection;
  }

  private getIsNonStop(nodeId: number, portId: number, nodes: NodeDto[]) {
    let returnValue = false;
    const filtertNodes = nodes.filter((n) => n.id === nodeId);
    filtertNodes.forEach((node) => {
      const filtertTransitions = node.transitions.filter(
        (transition) => transition.port1Id === portId || transition.port2Id === portId,
      );
      filtertTransitions.forEach((transition) => {
        if (transition.isNonStopTransit === true) {
          returnValue = true;
        }
      });
    });
    return returnValue;
  }

  private findConnectedPortId(node: Node, portId: number): number | null {
    const transition = node
      .getTransitions()
      .find((tr) => tr.getPortId1() === portId || tr.getPortId2() === portId);
    if (!transition) {
      return null;
    }
    return transition.getPortId1() === portId ? transition.getPortId2() : transition.getPortId1();
  }

  /**
   * Ensure all sections for a trainrun sections chain is [source → target] [source → target]
   * consistent and invert sections if needed.
   */
  enforceConsistentSectionDirection(trainrunId: number) {
    const sections = this.getAllTrainrunSectionsForTrainrun(trainrunId);
    if (sections.length < 2) return;

    // Build a map of sections keyed by the outgoing port ID they are connected to.
    // Find the leaf (departure/arrival) sections: these are the ones without
    // a transition for their source or target port.
    const sectionsByConnectedPortId = new Map<number, TrainrunSection>();
    const leafSectionsAndNodes: [TrainrunSection, number][] = [];

    for (const section of sections) {
      const sourceNode = section.getSourceNode();
      const targetNode = section.getTargetNode();

      const sourceConnectedPortId = this.findConnectedPortId(sourceNode, section.getSourcePortId());
      const targetConnectedPortId = this.findConnectedPortId(targetNode, section.getTargetPortId());

      if (sourceConnectedPortId !== null && sourceConnectedPortId !== undefined) {
        sectionsByConnectedPortId.set(sourceConnectedPortId, section);
      } else {
        leafSectionsAndNodes.push([section, section.getSourceNodeId()]);
      }
      if (targetConnectedPortId !== null && targetConnectedPortId !== undefined) {
        sectionsByConnectedPortId.set(targetConnectedPortId, section);
      } else {
        leafSectionsAndNodes.push([section, section.getTargetNodeId()]);
      }
    }

    // Use first leaf as starting point and its direction as reference for the whole trainrun.
    if (leafSectionsAndNodes.length === 0) return;
    const seenSectionIds = new Set<number>();

    for (const [startSection, startNodeId] of leafSectionsAndNodes) {
      if (seenSectionIds.has(startSection.getId())) continue;

      let referenceDirection: "sourceToTarget" | "targetToSource";
      if (startSection.getSourceNodeId() === startNodeId) {
        referenceDirection = "sourceToTarget";
      } else {
        referenceDirection = "targetToSource";
      }

      // Start with a leaf node and walk over the path. Ignore any leaf node we've
      // already seen (because we've reached it at the end of a previous walk).
      // const seenSectionIds = new Set<number>();
      let section: TrainrunSection | undefined = startSection;
      let nodeId = startNodeId;
      while (section) {
        if (seenSectionIds.has(section.getId())) {
          // /!\ TODO: makes files unusable if a cycle is detected.
          throw new Error("Cycle detected in trainrun");
        }
        seenSectionIds.add(section.getId());

        if (
          (referenceDirection === "targetToSource" && section.getSourceNodeId() === nodeId) ||
          (referenceDirection === "sourceToTarget" && section.getTargetNodeId() === nodeId)
        ) {
          // Section is in the wrong direction, invert it
          this.invertTrainrunSectionSourceAndTarget(section);
        }
        nodeId =
          referenceDirection === "sourceToTarget"
            ? section.getTargetNodeId()
            : section.getSourceNodeId();
        section = sectionsByConnectedPortId.get(
          referenceDirection === "sourceToTarget"
            ? section.getTargetPortId()
            : section.getSourcePortId(),
        );
      }
    }
  }

  private invertTrainrunSectionSourceAndTarget(trainrunSection: TrainrunSection) {
    // Swap nodes
    trainrunSection.setSourceAndTargetNodeReference(
      trainrunSection.getTargetNode(),
      trainrunSection.getSourceNode(),
    );

    // Swap ports
    const oldSourcePortId = trainrunSection.getSourcePortId();
    const oldTargetPortId = trainrunSection.getTargetPortId();
    trainrunSection.setSourcePortId(oldTargetPortId);
    trainrunSection.setTargetPortId(oldSourcePortId);

    // Swap Timelocks
    const oldSourceDepartureDto = trainrunSection.getSourceDepartureDto();
    const oldTargetArrivalDto = trainrunSection.getTargetArrivalDto();
    const oldTargetDepartureDto = trainrunSection.getTargetDepartureDto();
    const oldSourceArrivalDto = trainrunSection.getSourceArrivalDto();

    // Source departure becomes target departure
    trainrunSection.setSourceDepartureDto(oldTargetDepartureDto);

    // Target arrival becomes source arrival
    trainrunSection.setTargetArrivalDto(oldSourceArrivalDto);

    // Target departure becomes source departure
    trainrunSection.setTargetDepartureDto(oldSourceDepartureDto);

    // Source arrival becomes target arrival
    trainrunSection.setSourceArrivalDto(oldTargetArrivalDto);
  }

  /**
   * Groups consecutive TrainrunSections that have collapsed nodes between them
   * into chains. Each chain starts and ends with a non-collapsed node.
   * Start and end nodes can be accessed via: sections[0].getSourceNode() and sections[sections.length - 1].getTargetNode()
   * @param trainrunSections List of TrainrunSections to group
   * @returns Array of section chains
   */
  groupTrainrunSectionsIntoChains(trainrunSections: TrainrunSection[]): TrainrunSection[][] {
    const groups: TrainrunSection[][] = [];
    const visitedSections = new Set<number>();

    trainrunSections.forEach((section) => {
      if (visitedSections.has(section.getId())) {
        return;
      }

      const backwardIterator = this.trainrunService.getBackwardIterator(
        section.getTargetNode(),
        section,
      );
      while (backwardIterator.hasNext() && backwardIterator.current().node.getIsCollapsed()) {
        backwardIterator.next();
      }
      const startNode = backwardIterator.current().node;
      const startSection = backwardIterator.current().trainrunSection;

      // Build chain using TrainrunIterator to leverage existing graph traversal
      const chain: TrainrunSection[] = [];
      const iterator = this.trainrunService.getIterator(startNode, startSection);

      // Traverse the trainrun and collect sections with collapsed intermediate nodes
      while (iterator.hasNext()) {
        const pair = iterator.next();

        if (visitedSections.has(pair.trainrunSection.getId())) {
          throw new Error(
            `Cycle detected in trainrun section chain: section ${pair.trainrunSection.getId()} already visited for trainrun ${pair.trainrunSection.getTrainrunId()}`,
          );
        }

        chain.push(pair.trainrunSection);
        visitedSections.add(pair.trainrunSection.getId());

        // Stop if we reach a non-collapsed node (end of collapsed chain)
        if (!pair.node.getIsCollapsed()) {
          break;
        }
      }

      if (chain.length > 0) {
        groups.push(chain);
      }
    });

    return groups;
  }

  getNumberOfCollapsedStops(section: TrainrunSection) {
    const backwardIterator = this.trainrunService.getBackwardNextExpandedStopIterator(
      section.getTargetNode(),
      section,
    );
    while (backwardIterator.hasNext() && backwardIterator.current().node.getIsCollapsed()) {
      backwardIterator.next();
    }
    const startNode = backwardIterator.current().node;
    const startSection = backwardIterator.current().trainrunSection;

    let numberOfCollapsedStops = 0;
    const iterator = this.trainrunService.getNextExpandedStopIterator(startNode, startSection);

    // Traverse the trainrun and collect sections with collapsed intermediate nodes
    while (iterator.hasNext()) {
      const {node, trainrunSection} = iterator.next();

      // Stop if we reach a non-collapsed node (end of collapsed chain)
      if (!node.getIsCollapsed()) break;

      // Stop if we reach the end of the trainrunsection
      const transition = node.getTransition(trainrunSection.getId());
      if (!transition) break;

      const isNonStop = transition.getIsNonStopTransit();
      if (node.getIsCollapsed() && !isNonStop) {
        numberOfCollapsedStops += 1;
      }
    }
    return numberOfCollapsedStops;
  }

  getTrainrunSectionGroupForSection(section: TrainrunSection): TrainrunSection[] {
    const sections = this.getAllTrainrunSectionsForTrainrun(section.getTrainrun().getId());
    const groups = this.groupTrainrunSectionsIntoChains(sections);
    const group = groups.find((group) => group.some((trs) => trs.getId() === section.getId()));
    return group ?? [section];
  }

  getTrainrunSectionsGroupOrientedBasedOnPort(port: Port): TrainrunSection[] | undefined {
    const group = this.getTrainrunSectionGroupForSection(port.getTrainrunSection());
    if (group === undefined) return undefined;
    if (group[0].getSourcePortId() === port.getId()) {
      return group;
    } else {
      return [...group].reverse();
    }
  }
}
