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
import {LeftAndRightTimeStructure} from "../../view/dialogs/trainrun-and-section-dialog/trainrunsection-tab/trainrun-section-tab.component";
import {TrainrunsectionHelper} from "../util/trainrunsection.helper";
import {LogService} from "../../logger/log.service";
import {Transition} from "../../models/transition.model";
import {takeUntil} from "rxjs/operators";
import {FilterService} from "../ui/filter.service";
import {TrainrunSectionNodePair} from "../util/trainrun.iterator";
import {Operation, OperationType, TrainrunOperation} from "../../models/operation.model";

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

export interface PartialLeftAndRightTimeStructure {
  departureTime: number;
  travelTime: number;
  arrivalTime: number;
}

@Injectable({
  providedIn: "root",
})
export class TrainrunSectionService implements OnDestroy {
  // Description of observable data service: https://coryrylan.com/blog/angular-observable-data-services
  trainrunSectionsSubject = new BehaviorSubject<TrainrunSection[]>([]);
  readonly trainrunSections = this.trainrunSectionsSubject.asObservable();
  trainrunSectionsStore: {trainrunSections: TrainrunSection[]} = {
    trainrunSections: [],
  }; // store the data in memory

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

  // TODO: refacto
  static computeArrivalAndDeparture(
    previousNodeArrival: number,
    trainrunSection: TrainrunSection,
    nonStop: boolean,
    halteZeiten: TrainrunCategoryHaltezeit,
    precision: number = 10,
  ): DepartureAndArrivalTimes {
    let haltezeit =
      halteZeiten[trainrunSection.getTrainrun().getTrainrunCategory().fachCategory].haltezeit;
    haltezeit = nonStop ? 0 : haltezeit;
    const fromDepartureTime = MathUtils.round((previousNodeArrival + haltezeit) % 60, precision);
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

  propagateTimesAtTrainrunSectionCreation(trainrunSection: TrainrunSection) {
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

  setTrainrunSectionAsSelected(trainrunSectionId: number) {
    this.trainrunSectionsStore.trainrunSections.forEach((tr) => tr.unselect());
    this.getTrainrunSectionFromId(trainrunSectionId)?.select();
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
      TrainrunSectionValidator.validateTravelTime(trainrunSection);
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

  initializeTrainrunSectionRouting() {
    this.trainrunSectionsStore.trainrunSections.forEach((trainrunSection) => {
      if (trainrunSection.isPathInvalid()) {
        trainrunSection.routeEdgeAndPlaceText();
      }
    });
  }

  updateTrainrunSectionNumberOfStops(trs: TrainrunSection, numberOfStops: number) {
    const trainrunSection = this.getTrainrunSectionFromId(trs.getId());
    trainrunSection.setNumberOfStops(numberOfStops);
    this.trainrunSectionsUpdated();
    this.operation.emit(new TrainrunOperation(OperationType.update, trainrunSection.getTrainrun()));
  }

  updateTrainrunSectionTime(
    trsId: number,
    sourceArrivalTime: number,
    sourceDeparture: number,
    targetArrival: number,
    targetDeparture: number,
    travelTime: number,
    backwardTravelTime: number,
    emit: boolean = true,
  ) {
    const trainrunSection = this.getTrainrunSectionFromId(trsId);
    trainrunSection.setSourceArrival(sourceArrivalTime);
    trainrunSection.setSourceDeparture(sourceDeparture);
    trainrunSection.setTargetArrival(targetArrival);
    trainrunSection.setTargetDeparture(targetDeparture);
    trainrunSection.setTravelTime(travelTime);
    trainrunSection.setBackwardTravelTime(backwardTravelTime);
    TrainrunSectionValidator.validateOneSection(trainrunSection);
    this.trainrunService.propagateConsecutiveTimesForTrainrun(trainrunSection.getId());
    this.nodeService.validateConnections(trainrunSection.getSourceNode());
    this.nodeService.validateConnections(trainrunSection.getTargetNode());
    if (emit) {
      this.operation.emit(
        new TrainrunOperation(OperationType.update, trainrunSection.getTrainrun()),
      );
    }
  }

  updateSourceSymmetry(trainrunSectionId: number, isSourceNodeSymmetric: boolean) {
    const trainrunSection = this.getTrainrunSectionFromId(trainrunSectionId);
    trainrunSection.setSourceSymmetry(isSourceNodeSymmetric);
    this.trainrunSectionsUpdated();
    this.operation.emit(new TrainrunOperation(OperationType.update, trainrunSection.getTrainrun()));
  }

  updateTargetSymmetry(trainrunSectionId: number, isTargetNodeSymmetric: boolean) {
    const trainrunSection = this.getTrainrunSectionFromId(trainrunSectionId);
    trainrunSection.setTargetSymmetry(isTargetNodeSymmetric);
    this.trainrunSectionsUpdated();
    this.operation.emit(new TrainrunOperation(OperationType.update, trainrunSection.getTrainrun()));
  }

  private findTrainrunSectionForStopNode(
    trainrunSection: TrainrunSection,
    node: Node,
    stopNodeId: number,
  ) {
    const iterator = this.trainrunService.getNonStopIterator(node, trainrunSection);
    while (iterator.hasNext()) {
      iterator.next();
      if (iterator.current().node.getId() === stopNodeId) {
        return iterator.current().trainrunSection.getId();
      }
    }
    return undefined;
  }

  propagateTimes(
    startTrainrunSectionId: number,
    sourceToTarget: boolean,
    nextStopNodeId: number,
    nonStopIterator: boolean,
  ) {
    const startTrainrunSection = this.getTrainrunSectionFromId(startTrainrunSectionId);
    const startNode = sourceToTarget
      ? startTrainrunSection.getSourceNode()
      : startTrainrunSection.getTargetNode();

    let actualStartTrainrunSectionId = startTrainrunSectionId;

    // Non-stop chain case: if the start node is not the next stop node,
    // we need to find the trainrun section that connects to the actual stop node
    if (startNode.getId() !== nextStopNodeId) {
      const foundTrainrunSectionId = this.findTrainrunSectionForStopNode(
        startTrainrunSection,
        startNode,
        nextStopNodeId,
      );

      if (foundTrainrunSectionId !== undefined) {
        actualStartTrainrunSectionId = foundTrainrunSectionId;
      }
    }

    this.iterateAlongTrainrunAndPropagateTimes(
      startNode,
      actualStartTrainrunSectionId,
      sourceToTarget,
      nonStopIterator,
    );
    this.trainrunSectionsUpdated();
  }

  propagateTimesSourceToTarget(
    previousPair: TrainrunSectionNodePair | null,
    pair: TrainrunSectionNodePair,
    forward: boolean,
  ) {
    // Update source times
    let newSourceDepartureTime;
    if (previousPair) {
      if (forward) {
        newSourceDepartureTime = MathUtils.round(
          (previousPair.trainrunSection.getTargetArrival() +
            this.getPairsHaltezeit(previousPair, pair)) %
            60,
          TrainrunSectionService.TIME_PRECISION,
        );
      } else {
        if (pair.trainrunSection.getSourceSymmetry()) {
          newSourceDepartureTime = TrainrunsectionHelper.getSymmetricTime(
            pair.trainrunSection.getSourceArrival(),
          );
        } else {
          if (pair.trainrunSection.getTargetSymmetry()) {
            newSourceDepartureTime = MathUtils.round(
              (TrainrunsectionHelper.getSymmetricTime(pair.trainrunSection.getTargetDeparture()) -
                (pair.trainrunSection.getTravelTime() % 60) +
                60) %
                60,
              TrainrunSectionService.TIME_PRECISION,
            );
          } else {
            newSourceDepartureTime = MathUtils.round(
              (previousPair.trainrunSection.getTargetArrival() +
                this.getPairsHaltezeit(previousPair, pair)) %
                60,
              TrainrunSectionService.TIME_PRECISION,
            );
          }
        }
      }
    } else {
      // start of trainrun case
      newSourceDepartureTime = pair.trainrunSection.getSourceSymmetry()
        ? TrainrunsectionHelper.getSymmetricTime(pair.trainrunSection.getSourceArrival())
        : pair.trainrunSection.getSourceDeparture();
    }
    pair.trainrunSection.setSourceDeparture(newSourceDepartureTime);

    // Update target times if possible
    if (!pair.trainrunSection.getTargetArrivalLock()) {
      const newTargetArrivalTime = MathUtils.round(
        (newSourceDepartureTime + pair.trainrunSection.getTravelTime()) % 60,
        TrainrunSectionService.TIME_PRECISION,
      );
      pair.trainrunSection.setTargetArrival(newTargetArrivalTime);
    }

    // Update travel times otherwise
    if (!pair.trainrunSection.getTravelTimeLock()) {
      let newTravelTime = pair.trainrunSection.getTargetArrival() - newSourceDepartureTime;
      newTravelTime += Math.floor(pair.trainrunSection.getTravelTime() / 60) * 60;
      while (newTravelTime < 0.0) {
        newTravelTime += 60;
      }
      pair.trainrunSection.setTravelTime(newTravelTime);
    }
  }

  propagateTimesTargetToSource(
    previousPair: TrainrunSectionNodePair | null,
    pair: TrainrunSectionNodePair,
    forward: boolean,
  ) {
    // Update target times
    let newTargetDepartureTime;
    if (previousPair) {
      if (forward) {
        newTargetDepartureTime = MathUtils.round(
          (previousPair.trainrunSection.getSourceArrival() +
            this.getPairsHaltezeit(previousPair, pair)) %
            60,
          TrainrunSectionService.TIME_PRECISION,
        );
      } else {
        if (pair.trainrunSection.getTargetSymmetry()) {
          newTargetDepartureTime = TrainrunsectionHelper.getSymmetricTime(
            pair.trainrunSection.getTargetArrival(),
          );
        } else {
          if (pair.trainrunSection.getSourceSymmetry()) {
            newTargetDepartureTime = MathUtils.round(
              (TrainrunsectionHelper.getSymmetricTime(pair.trainrunSection.getSourceDeparture()) -
                (pair.trainrunSection.getBackwardTravelTime() % 60) +
                60) %
                60,
              TrainrunSectionService.TIME_PRECISION,
            );
          } else {
            // section is fully non-symmetric
            newTargetDepartureTime = MathUtils.round(
              (previousPair.trainrunSection.getSourceArrival() +
                this.getPairsHaltezeit(previousPair, pair)) %
                60,
              TrainrunSectionService.TIME_PRECISION,
            );
          }
        }
      }
    } else {
      // end of trainrun case
      newTargetDepartureTime = pair.trainrunSection.getTargetSymmetry()
        ? TrainrunsectionHelper.getSymmetricTime(pair.trainrunSection.getTargetArrival())
        : pair.trainrunSection.getTargetDeparture();
    }
    pair.trainrunSection.setTargetDeparture(newTargetDepartureTime);

    // Update source times if possible
    if (!pair.trainrunSection.getSourceArrivalLock()) {
      const newSourceArrivalTime = MathUtils.round(
        (newTargetDepartureTime + pair.trainrunSection.getBackwardTravelTime()) % 60,
        TrainrunSectionService.TIME_PRECISION,
      );
      pair.trainrunSection.setSourceArrival(newSourceArrivalTime);
    }

    // Update travel times otherwise
    if (!pair.trainrunSection.getTravelTimeLock()) {
      let newBackwardTravelTime = pair.trainrunSection.getSourceArrival() - newTargetDepartureTime;
      newBackwardTravelTime += Math.floor(pair.trainrunSection.getBackwardTravelTime() / 60) * 60;
      while (newBackwardTravelTime < 0.0) {
        newBackwardTravelTime += 60;
      }
      pair.trainrunSection.setBackwardTravelTime(newBackwardTravelTime);
    }
  }

  iterateAlongTrainrunAndPropagateTimes(
    startNode: Node,
    startTrainrunSectionId: number,
    sourceToTarget: boolean,
    nonStopIterator: boolean,
  ) {
    const startTrainrunSection = this.getTrainrunSectionFromId(startTrainrunSectionId);

    if (sourceToTarget) {
      // Forward iteration: source to target direction
      const forwardIterator = nonStopIterator
        ? this.trainrunService.getNonStopIterator(startNode, startTrainrunSection)
        : this.trainrunService.getIterator(startNode, startTrainrunSection);
      const forwardSections: TrainrunSectionNodePair[] = [];
      forwardSections.push(forwardIterator.next());
      while (forwardIterator.hasNext()) {
        const pair = forwardIterator.next();
        forwardSections.push(pair);
      }

      // Forward propagation: source to target
      // first section is not propagated, because it is the one that has been changed by the user
      let previousForwardPair = forwardSections[0];
      TrainrunSectionValidator.validateOneSection(previousForwardPair.trainrunSection);
      forwardSections.shift();
      for (const currentPair of forwardSections) {
        if (currentPair.trainrunSection.getSourceDepartureLock()) {
          break; // Stop propagation when lock is encountered
        }
        this.propagateTimesSourceToTarget(previousForwardPair, currentPair, true);
        TrainrunSectionValidator.validateOneSection(currentPair.trainrunSection);
        previousForwardPair = currentPair;
      }

      // Backward propagation: target to source
      // first backward section is propagated, but has no previous section, special case
      let previousBackwardPair: TrainrunSectionNodePair | null = null;
      for (const currentPair of forwardSections.toReversed()) {
        if (currentPair.trainrunSection.getTargetDepartureLock()) {
          break; // Stop propagation when lock is encountered
        }
        this.propagateTimesTargetToSource(previousBackwardPair, currentPair, false);
        TrainrunSectionValidator.validateOneSection(currentPair.trainrunSection);
        previousBackwardPair = currentPair;
      }
    } else {
      // Backward iteration: target to source direction
      const backwardIterator = nonStopIterator
        ? this.trainrunService.getBackwardNonStopIterator(startNode, startTrainrunSection)
        : this.trainrunService.getBackwardIterator(startNode, startTrainrunSection);
      const backwardSections: TrainrunSectionNodePair[] = [];
      backwardSections.push(backwardIterator.next());
      while (backwardIterator.hasNext()) {
        const pair = backwardIterator.next();
        backwardSections.push(pair);
      }

      // Forward propagation: target to source (in the context of backward iteration)
      // first section is not propagated, because it is the one that has been changed by the user
      let previousForwardPair = backwardSections[0];
      TrainrunSectionValidator.validateOneSection(previousForwardPair.trainrunSection);
      backwardSections.shift();
      for (const currentPair of backwardSections) {
        if (currentPair.trainrunSection.getTargetDepartureLock()) {
          break; // Stop propagation when lock is encountered
        }
        this.propagateTimesTargetToSource(previousForwardPair, currentPair, true);
        TrainrunSectionValidator.validateOneSection(currentPair.trainrunSection);
        previousForwardPair = currentPair;
      }

      // Backward propagation: source to target (in the context of backward iteration)
      // first backward section is propagated, but has no previous section, special case
      let previousBackwardPair: TrainrunSectionNodePair | null = null;
      for (const currentPair of backwardSections.toReversed()) {
        if (currentPair.trainrunSection.getSourceDepartureLock()) {
          break; // Stop propagation when lock is encountered
        }
        this.propagateTimesSourceToTarget(previousBackwardPair, currentPair, false);
        TrainrunSectionValidator.validateOneSection(currentPair.trainrunSection);
        previousBackwardPair = currentPair;
      }
    }

    if (startTrainrunSection !== undefined) {
      this.trainrunService.propagateConsecutiveTimesForTrainrun(startTrainrunSection.getId());
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

  updateTrainrunSectionRouting(node: Node, enforceUpdate = true) {
    this.trainrunSectionsStore.trainrunSections.forEach((trainrunSection) => {
      if (
        node.getId() === trainrunSection.getSourceNodeId() ||
        node.getId() === trainrunSection.getTargetNodeId()
      ) {
        trainrunSection.routeEdgeAndPlaceText();
      }
    });

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
      trainrunSection.setTravelTime(
        this.retrieveTravelTime(sourceNodeId, targetNodeId, trainrunSection.getTrainrun()),
      );
    }

    const sourceNode = this.nodeService.getNodeFromId(sourceNodeId);
    const targetNode = this.nodeService.getNodeFromId(targetNodeId);

    trainrunSection.setSourceAndTargetNodeReference(sourceNode, targetNode);
    this.trainrunSectionsStore.trainrunSections.push(trainrunSection);

    this.handleNodeAndTrainrunSectionDetails(sourceNode, targetNode, trainrunSection);

    this.setTrainrunSectionAsSelected(trainrunSection.getId());

    // Ensure consistent section direction considering the previous ones
    this.enforceConsistentSectionDirection(trainrunSection.getTrainrunId());

    this.propagateTimesAtTrainrunSectionCreation(trainrunSection);

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
    nodeToOld.updateTransitionsAndConnections();
    TrainrunSectionService.setToNode(sourceNodeId, trainrunSection, nodeToNew, targetNodeId);

    this.updateTrainrunSectionRouting(nodeToOld, false);
    nodeToNew.addPortWithRespectToOppositeNode(nodeFrom, trainrunSection);
    if (this.nodeService.isConditionToAddTransitionFullfilled(nodeToNew, trainrunSection)) {
      this.nodeService.addTransitionAndComputeRoutingFromFreePorts(
        nodeToNew,
        trainrunSection.getTrainrun(),
      );
    }
    nodeFrom.reAlignPortWithRespectToOppositeNode(nodeToNew, trainrunSection);

    trainrunSection.routeEdgeAndPlaceText();
    this.reRouteAffectedTrainrunSections(nodeFrom.getId(), nodeToNew.getId());

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
      this.nodeService.nodesUpdated();
      this.nodeService.connectionsUpdated();
      this.nodeService.transitionsUpdated();
      this.trainrunSectionsUpdated();
    }
    this.operation.emit(new TrainrunOperation(OperationType.update, trainrunSection.getTrainrun()));
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

  deleteTrainrunSection(trainrunSectionId: number, enforceUpdate = true) {
    const trainrunSection = this.getTrainrunSectionFromId(trainrunSectionId);
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
    if (enforceUpdate) {
      this.nodeService.transitionsUpdated();
      this.nodeService.connectionsUpdated();
      this.trainrunSectionsUpdated();
    }
    if (this.getTrainrunSections().length) {
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

  setTimeStructureToTrainrunSections(
    chainTimeStructure: LeftAndRightTimeStructure,
    updatedTrainrunSection: TrainrunSection,
    precision = 0,
  ) {
    // Get all pairs [ [node(stop) --ts--] [node(non-stop) --ts--] [...] node(stop) ]
    // and initialize their time structures
    const firstTrainrunSection =
      this.trainrunService.getFirstNonStopTrainrunSection(updatedTrainrunSection);
    const iterator = this.trainrunService.getNonStopIterator(
      firstTrainrunSection.getSourceNode(),
      firstTrainrunSection,
    );
    const pairs: TrainrunSectionNodePair[] = [];
    const pairTimeStructures: Map<TrainrunSectionNodePair, LeftAndRightTimeStructure> = new Map();
    while (iterator.hasNext()) {
      const nextPair = iterator.next();
      pairs.push(nextPair);
      pairTimeStructures.set(nextPair, {
        leftDepartureTime: null,
        leftArrivalTime: null,
        rightDepartureTime: null,
        rightArrivalTime: null,
        travelTime: null,
        bottomTravelTime: null,
      });
    }

    // Notes:
    // - travelTimeFactor: get the sum of the travel times of all the sections from the non-stop sections chain
    // and compare it to the total cumulative travel time to the end of the non-stop sections chain (from the start of the trainrun)
    // - backwardTravelTimeFactor: get the sum of the backward travel times of all the sections from the non-stop sections chain
    // and compare it to the total cumulative travel time to the end of the reversed non-stop sections chain (from the start of the reversed trainrun)
    if (
      TrainrunsectionHelper.isTargetRightOrBottomSectionsChain(
        firstTrainrunSection,
        iterator.current().trainrunSection,
      )
    ) {
      // Left (source) --chain--> Right (target)
      const totalCumulativeTravelTime =
        this.trainrunService.getCumulativeTravelTime(updatedTrainrunSection);
      const travelTimeFactor = chainTimeStructure.travelTime / totalCumulativeTravelTime;
      const subTimeStructure: PartialLeftAndRightTimeStructure = {
        departureTime:
          TrainrunsectionHelper.getDefaultTimeStructure(chainTimeStructure).leftDepartureTime,
        travelTime: null,
        arrivalTime: null,
      };
      let summedTravelTime = 0;
      pairs.forEach((pair) => {
        const finalTimeStructure = pairTimeStructures.get(pair);
        subTimeStructure.travelTime = TrainrunsectionHelper.getDistributedTravelTime(
          chainTimeStructure.travelTime,
          summedTravelTime,
          travelTimeFactor,
          pair.trainrunSection.getTravelTime(),
          pair.node.isNonStop(pair.trainrunSection),
          precision,
        );
        subTimeStructure.arrivalTime = TrainrunsectionHelper.getArrivalTime(
          subTimeStructure,
          precision,
        );
        if (TrainrunsectionHelper.isTargetRightOrBottom(pair.trainrunSection)) {
          finalTimeStructure.leftDepartureTime = subTimeStructure.departureTime;
          finalTimeStructure.travelTime = subTimeStructure.travelTime;
          finalTimeStructure.rightArrivalTime = subTimeStructure.arrivalTime;
        } else {
          finalTimeStructure.rightDepartureTime = subTimeStructure.departureTime;
          finalTimeStructure.bottomTravelTime = subTimeStructure.travelTime;
          finalTimeStructure.leftArrivalTime = subTimeStructure.arrivalTime;
        }
        // next section departure inherits from the previous arrival
        subTimeStructure.departureTime = subTimeStructure.arrivalTime;
        summedTravelTime += subTimeStructure.travelTime;
      });

      subTimeStructure.departureTime =
        TrainrunsectionHelper.getDefaultTimeStructure(chainTimeStructure).rightDepartureTime;
      subTimeStructure.travelTime = null;
      subTimeStructure.arrivalTime = null;

      // Left (source) <--chain-- Right (target)
      const backwardPairs = pairs.toReversed();
      const totalCumulativeBackwardTravelTime =
        this.trainrunService.getCumulativeBackwardTravelTime(backwardPairs[0].trainrunSection);
      const backwardTravelTimeFactor =
        chainTimeStructure.bottomTravelTime / totalCumulativeBackwardTravelTime;
      let summedBackwardTravelTime = 0;
      backwardPairs.forEach((pair) => {
        const finalTimeStructure = pairTimeStructures.get(pair);
        // check for opposite node stop instead since we iterate backward on a regular iterator
        subTimeStructure.travelTime = TrainrunsectionHelper.getDistributedTravelTime(
          chainTimeStructure.bottomTravelTime,
          summedBackwardTravelTime,
          backwardTravelTimeFactor,
          pair.trainrunSection.getBackwardTravelTime(),
          pair.node.getOppositeNode(pair.trainrunSection).isNonStop(pair.trainrunSection),
          precision,
        );
        subTimeStructure.arrivalTime = TrainrunsectionHelper.getArrivalTime(
          subTimeStructure,
          precision,
        );
        if (TrainrunsectionHelper.isTargetRightOrBottom(pair.trainrunSection)) {
          finalTimeStructure.rightDepartureTime = subTimeStructure.departureTime;
          finalTimeStructure.bottomTravelTime = subTimeStructure.travelTime;
          finalTimeStructure.leftArrivalTime = subTimeStructure.arrivalTime;
        } else {
          finalTimeStructure.leftDepartureTime = subTimeStructure.departureTime;
          finalTimeStructure.travelTime = subTimeStructure.travelTime;
          finalTimeStructure.rightArrivalTime = subTimeStructure.arrivalTime;
        }
        // next section inherits from the previous arrival
        subTimeStructure.departureTime = subTimeStructure.arrivalTime;
        summedBackwardTravelTime += subTimeStructure.travelTime;
      });
    } else {
      // Left (target) <--chain-- Right (source)
      const totalCumulativeTravelTime =
        this.trainrunService.getCumulativeTravelTime(updatedTrainrunSection);
      const travelTimeFactor = chainTimeStructure.bottomTravelTime / totalCumulativeTravelTime; //
      const subTimeStructure: PartialLeftAndRightTimeStructure = {
        departureTime:
          TrainrunsectionHelper.getDefaultTimeStructure(chainTimeStructure).rightDepartureTime, //
        travelTime: null,
        arrivalTime: null,
      };
      let summedTravelTime = 0;
      pairs.forEach((pair) => {
        const finalTimeStructure = pairTimeStructures.get(pair);
        subTimeStructure.travelTime = TrainrunsectionHelper.getDistributedTravelTime(
          chainTimeStructure.bottomTravelTime, //
          summedTravelTime,
          travelTimeFactor,
          pair.trainrunSection.getTravelTime(),
          pair.node.isNonStop(pair.trainrunSection),
          precision,
        );
        subTimeStructure.arrivalTime = TrainrunsectionHelper.getArrivalTime(
          subTimeStructure,
          precision,
        );
        if (TrainrunsectionHelper.isTargetRightOrBottom(pair.trainrunSection)) {
          finalTimeStructure.leftDepartureTime = subTimeStructure.departureTime;
          finalTimeStructure.travelTime = subTimeStructure.travelTime;
          finalTimeStructure.rightArrivalTime = subTimeStructure.arrivalTime;
        } else {
          finalTimeStructure.rightDepartureTime = subTimeStructure.departureTime;
          finalTimeStructure.bottomTravelTime = subTimeStructure.travelTime;
          finalTimeStructure.leftArrivalTime = subTimeStructure.arrivalTime;
        }
        // next section departure inherits from the previous arrival
        subTimeStructure.departureTime = subTimeStructure.arrivalTime;
        summedTravelTime += subTimeStructure.travelTime;
      });

      subTimeStructure.departureTime =
        TrainrunsectionHelper.getDefaultTimeStructure(chainTimeStructure).leftDepartureTime; //
      subTimeStructure.travelTime = null;
      subTimeStructure.arrivalTime = null;

      // Left (target) --chain--> Right (source)
      const backwardPairs = pairs.toReversed();
      const totalCumulativeBackwardTravelTime =
        this.trainrunService.getCumulativeBackwardTravelTime(backwardPairs[0].trainrunSection);
      const backwardTravelTimeFactor =
        chainTimeStructure.travelTime / totalCumulativeBackwardTravelTime; //
      let summedBackwardTravelTime = 0;
      backwardPairs.forEach((pair) => {
        const finalTimeStructure = pairTimeStructures.get(pair);
        // check for opposite node stop instead since we iterate backward on a regular iterator
        subTimeStructure.travelTime = TrainrunsectionHelper.getDistributedTravelTime(
          chainTimeStructure.travelTime, //
          summedBackwardTravelTime,
          backwardTravelTimeFactor,
          pair.trainrunSection.getBackwardTravelTime(),
          pair.node.getOppositeNode(pair.trainrunSection).isNonStop(pair.trainrunSection),
          precision,
        );
        subTimeStructure.arrivalTime = TrainrunsectionHelper.getArrivalTime(
          subTimeStructure,
          precision,
        );
        if (TrainrunsectionHelper.isTargetRightOrBottom(pair.trainrunSection)) {
          finalTimeStructure.rightDepartureTime = subTimeStructure.departureTime;
          finalTimeStructure.bottomTravelTime = subTimeStructure.travelTime;
          finalTimeStructure.leftArrivalTime = subTimeStructure.arrivalTime;
        } else {
          finalTimeStructure.leftDepartureTime = subTimeStructure.departureTime;
          finalTimeStructure.travelTime = subTimeStructure.travelTime;
          finalTimeStructure.rightArrivalTime = subTimeStructure.arrivalTime;
        }
        // next section inherits from the previous arrival
        subTimeStructure.departureTime = subTimeStructure.arrivalTime;
        summedBackwardTravelTime += subTimeStructure.travelTime;
      });
    }

    // then when all time structures are filled, update all trainrun sections
    pairs.forEach((pair) => {
      const rightIsTarget = TrainrunsectionHelper.isTargetRightOrBottom(pair.trainrunSection);
      const timeStructure = pairTimeStructures.get(pair);
      this.updateTrainrunSectionTime(
        pair.trainrunSection.getId(),
        rightIsTarget ? timeStructure.leftArrivalTime : timeStructure.rightArrivalTime,
        rightIsTarget ? timeStructure.leftDepartureTime : timeStructure.rightDepartureTime,
        rightIsTarget ? timeStructure.rightArrivalTime : timeStructure.leftArrivalTime,
        rightIsTarget ? timeStructure.rightDepartureTime : timeStructure.leftDepartureTime,
        rightIsTarget ? timeStructure.travelTime : timeStructure.bottomTravelTime,
        rightIsTarget ? timeStructure.bottomTravelTime : timeStructure.travelTime,
        false,
      );
    });

    this.trainrunSectionsUpdated();
    this.nodeService.connectionsUpdated();
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

  replaceIntermediateStopWithNode(trainrunSectionId: number, stopIndex: number, nodeId: number) {
    const trainrunSection1 = this.getTrainrunSectionFromId(trainrunSectionId);
    if (
      trainrunSection1.getSourceNodeId() === nodeId ||
      trainrunSection1.getTargetNodeId() === nodeId
    ) {
      return;
    }
    const origTravelTime = trainrunSection1.getTravelTime();
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

    trainrunSection1.setTargetNode(nodeIntermediate);
    nodeIntermediate.addPortWithRespectToOppositeNode(node1, trainrunSection1);
    node1.reAlignPortWithRespectToOppositeNode(nodeIntermediate, trainrunSection1);

    trainrunSection2.setSourceNode(nodeIntermediate);
    trainrunSection2.setTargetNode(node2);
    nodeIntermediate.addPortWithRespectToOppositeNode(node2, trainrunSection2);
    node2.reAlignPortWithRespectToOppositeNode(nodeIntermediate, trainrunSection2);

    this.reRouteAffectedTrainrunSections(node1.getId(), nodeIntermediate.getId());
    this.reRouteAffectedTrainrunSections(node2.getId(), nodeIntermediate.getId());

    this.nodeService.addTransitionToNodeForTrainrunSections(
      nodeIntermediate.getId(),
      trainrunSection1,
      trainrunSection2,
    );
    this.trainrunService.propagateConsecutiveTimesForTrainrun(trainrunSection1.getId());

    const numberOfStops = trainrunSection1.getNumberOfStops();
    trainrunSection1.setNumberOfStops(stopIndex);
    trainrunSection2.setNumberOfStops(numberOfStops - stopIndex - 1);

    const minHalteZeitFromNode = this.nodeService.getHaltezeit(
      nodeId,
      trainrunSection1.getTrainrun().getTrainrunCategory(),
    );
    let travelTime1 =
      trainrunSection1.getTargetDepartureConsecutiveTime() -
      trainrunSection1.getSourceDepartureConsecutiveTime();
    let travelTime2 =
      trainrunSection1.getSourceArrivalConsecutiveTime() -
      trainrunSection1.getTargetDepartureConsecutiveTime();
    travelTime1 = travelTime1 < 0 ? travelTime2 : travelTime1;
    travelTime2 = travelTime2 < 0 ? travelTime1 : travelTime2;
    const calculatedTravelTime = Math.min(travelTime1, travelTime2);
    const halteZeit = Math.min(minHalteZeitFromNode, Math.max(0, calculatedTravelTime - 2));
    const travelTimeIssue = travelTime1 === travelTime2 || minHalteZeitFromNode !== halteZeit;
    const travelTime = Math.max(trainrunSection1.getTravelTime() - halteZeit, 2);
    const halfTravelTime = Math.floor(travelTime / 2);
    trainrunSection1.setTravelTime(Math.max(1, travelTime - halfTravelTime));
    trainrunSection2.setTravelTime(Math.max(1, halfTravelTime));

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
      minHalteZeitFromNode < halteZeit ||
      trainrunSection1.getTravelTime() + trainrunSection2.getTravelTime() + halteZeit !==
        origTravelTime ||
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

    this.nodeService.transitionsUpdated();
    this.nodeService.connectionsUpdated();
    this.nodeService.nodesUpdated();
    this.trainrunSectionsUpdated();
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
    trainrunSection.setSourceSymmetry(
      JSON.parse(JSON.stringify(existingTrainrunSection.getSourceSymmetry())),
    );
    trainrunSection.setTargetSymmetry(
      JSON.parse(JSON.stringify(existingTrainrunSection.getTargetSymmetry())),
    );
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

    trainrunSection.routeEdgeAndPlaceText();
    this.reRouteAffectedTrainrunSections(sourceNode.getId(), targetNode.getId());
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
    this.reRouteAffectedTrainrunSections(
      trainrunSection.getSourceNodeId(),
      trainrunSection.getTargetNodeId(),
    );
    this.checkMissingTransitionsAfterDeletion(trainrunSection.getTrainrun());
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

  private checkMissingTransitionsAfterDeletion(trainrun: Trainrun) {
    const trainrunSections = this.getAllTrainrunSectionsForTrainrun(trainrun.getId());
    trainrunSections.forEach((ts) => {
      const sourceNode = ts.getSourceNode();
      const targetNode = ts.getTargetNode();

      const srcPortsWithoutTransitions = sourceNode
        .getPorts()
        .filter(
          (port) =>
            port.getTrainrunSection().getTrainrunId() === trainrun.getId() &&
            sourceNode.getTransitionFromPortId(port.getId()) === undefined,
        );
      const trgPortsWithoutTransitions = targetNode
        .getPorts()
        .filter(
          (port) =>
            port.getTrainrunSection().getTrainrunId() === trainrun.getId() &&
            targetNode.getTransitionFromPortId(port.getId()) === undefined,
        );

      if (srcPortsWithoutTransitions.length > 1) {
        this.nodeService.addTransitionToNodes(
          sourceNode.getId(),
          targetNode.getId(),
          srcPortsWithoutTransitions[0].getTrainrunSection(),
        );
      }

      if (trgPortsWithoutTransitions.length > 1) {
        this.nodeService.addTransitionToNodes(
          sourceNode.getId(),
          targetNode.getId(),
          trgPortsWithoutTransitions[0].getTrainrunSection(),
        );
      }
    });
  }

  private reRouteAffectedTrainrunSections(sourceNodeId: number, targetNodeId: number) {
    this.trainrunSectionsStore.trainrunSections.forEach((e) => {
      if (
        e.getSourceNodeId() === sourceNodeId ||
        e.getSourceNodeId() === targetNodeId ||
        e.getTargetNodeId() === sourceNodeId ||
        e.getTargetNodeId() === targetNodeId
      ) {
        e.routeEdgeAndPlaceText();
      }
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
    trainrunSection.routeEdgeAndPlaceText();
    this.reRouteAffectedTrainrunSections(sourceNode.getId(), targetNode.getId());
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

    // Update visuals and geometry
    trainrunSection.routeEdgeAndPlaceText();
    trainrunSection.convertVec2DToPath();
  }

  private getPairsHaltezeit(
    previousPair: TrainrunSectionNodePair,
    pair: TrainrunSectionNodePair,
  ): number {
    return previousPair.node.isNonStop(pair.trainrunSection)
      ? 0
      : previousPair.node.getTrainrunCategoryHaltezeit()[
          pair.trainrunSection.getTrainrun().getTrainrunCategory().fachCategory
        ].haltezeit;
  }
}
