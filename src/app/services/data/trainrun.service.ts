import {Trainrun} from "../../models/trainrun.model";
import {
  LabelDto,
  LabelRef,
  NetzgrafikDto,
  TrainrunCategory,
  Direction,
  TrainrunDto,
  TrainrunFrequency,
  TrainrunTimeCategory,
} from "../../data-structures/business.data.structures";
import {EventEmitter, Injectable} from "@angular/core";
import {BehaviorSubject} from "rxjs";
import {NodeService} from "./node.service";
import {TrainrunSectionService} from "./trainrunsection.service";
import {DataService} from "./data.service";
import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {GeneralViewFunctions} from "../../view/util/generalViewFunctions";
import {
  BackwardNonStopTrainrunIterator,
  BackwardTrainrunIterator,
  NonStopTrainrunIterator,
  TrainrunIterator,
} from "../util/trainrun.iterator";
import {LogService} from "../../logger/log.service";
import {LabelService} from "./label.service";
import {FilterService} from "../ui/filter.service";
import {Transition} from "../../models/transition.model";
import {Port} from "../../models/port.model";
import {Connection} from "../../models/connection.model";
import {Operation, OperationType, TrainrunOperation} from "../../models/operation.model";

@Injectable({
  providedIn: "root",
})
export class TrainrunService {
  // Description of observable data service: https://coryrylan.com/blog/angular-observable-data-services
  trainrunsSubject = new BehaviorSubject<Trainrun[]>([]);
  readonly trainruns = this.trainrunsSubject.asObservable();

  trainrunsStore: {trainruns: Trainrun[]} = {trainruns: []}; // store the data in memory

  readonly operation = new EventEmitter<Operation>();

  private dataService: DataService = null;
  private nodeService: NodeService = null;
  private trainrunSectionService: TrainrunSectionService = null;

  constructor(
    private logService: LogService,
    private labelService: LabelService,
    private filterService: FilterService,
  ) {}

  setDataService(dataService: DataService) {
    this.dataService = dataService;
  }

  public setNodeService(nodeService: NodeService) {
    this.nodeService = nodeService;
  }

  public setTrainrunSectionService(trainrunSectionService: TrainrunSectionService) {
    this.trainrunSectionService = trainrunSectionService;
  }

  setTrainrunData(trainrunsDto: TrainrunDto[]) {
    this.trainrunsStore.trainruns = trainrunsDto.map((trainrunDto) => {
      const trainrun = new Trainrun(trainrunDto);
      trainrun.setTrainrunCategory(this.dataService.getTrainrunCategory(trainrunDto.categoryId));
      trainrun.setTrainrunFrequency(this.dataService.getTrainrunFrequency(trainrunDto.frequencyId));
      trainrun.setTrainrunTimeCategory(
        this.dataService.getTrainrunTimeCategory(trainrunDto.trainrunTimeCategoryId),
      );
      return trainrun;
    });
  }

  createNewTrainrunsFromDtoList(trainruns: TrainrunDto[]): Map<number, number> {
    const trainrunMap = new Map<number, number>();
    trainruns.forEach((trainrun) => {
      // create new trainrun and add it to trainrun map
      trainrunMap.set(trainrun.id, this.createNewTrainrunFromDto(trainrun).getId());
    });
    return trainrunMap;
  }

  mergeTrainruns(trainruns: TrainrunDto[]): Map<number, number> {
    const trainrunMap = new Map<number, number>();
    trainruns.forEach((trainrun) => {
      const equalTrainrun = this.trainrunsStore.trainruns.find(
        (tr) =>
          tr.getTitle() === trainrun.name && tr.getTrainrunCategory().id === trainrun.categoryId,
      );
      if (equalTrainrun !== undefined) {
        // just link found trainrun with existing one
        trainrunMap.set(trainrun.id, equalTrainrun.getId());
      } else {
        // create new trainrun and add it to trainrun map
        trainrunMap.set(trainrun.id, this.createNewTrainrunFromDto(trainrun).getId());
      }
    });
    return trainrunMap;
  }

  mergeLabelTrainrun(netzgrafikDto: NetzgrafikDto, trainrunMap: Map<number, number>) {
    netzgrafikDto.trainruns.forEach((trainrun) => {
      const newTrainrunId = trainrunMap.get(trainrun.id);
      const newTrainrun = this.getTrainrunFromId(newTrainrunId);
      trainrun.labelIds.forEach((labelsId) => {
        const labelDtos: LabelDto[] = netzgrafikDto.labels.filter((label) => label.id === labelsId);
        labelDtos.forEach((labelDto) => {
          const label = this.labelService.getOrCreateLabel(labelDto.label, labelDto.labelRef);
          if (!newTrainrun.getLabelIds().includes(label.getId())) {
            newTrainrun.getLabelIds().push(label.getId());
          }
        });
      });
    });
    this.labelService.labelUpdated();
  }

  getTrainrunFromId(trainrunId: number): Trainrun {
    return this.trainrunsStore.trainruns.find((trainrun) => trainrun.getId() === trainrunId);
  }

  getSelectedOrNewTrainrun(): Trainrun {
    let trainrun = this.trainrunsStore.trainruns.find((tr) => tr.selected());
    if (trainrun === undefined) {
      trainrun = new Trainrun();
      trainrun.setTrainrunCategory(
        this.dataService.getTrainrunCategory(Trainrun.DEFAULT_TRAINRUN_CATEGORY),
      );
      trainrun.setTrainrunFrequency(
        this.dataService.getTrainrunFrequency(Trainrun.DEFAULT_TRAINRUN_FREQUENCY),
      );
      trainrun.setTrainrunTimeCategory(
        this.dataService.getTrainrunTimeCategory(Trainrun.DEFAULT_TRAINRUN_TIME_CATEGORY),
      );
      trainrun.select();
      this.trainrunsStore.trainruns.push(trainrun);
    }
    return trainrun;
  }

  deleteTrainrun(trainrun: Trainrun, enforceUpdate = true) {
    const deletetLabelIds = this.labelService.clearLabel(
      trainrun.getLabelIds(),
      this.makeLabelIDCounterMap(this.getTrainruns()),
    );
    this.filterService.clearDeletetFilterTrainrunLabels(deletetLabelIds);
    this.trainrunsStore.trainruns.forEach((tr) => tr.unselect());
    this.trainrunsStore.trainruns = this.trainrunsStore.trainruns.filter(
      (tr) => tr.getId() !== trainrun.getId(),
    );
    if (enforceUpdate) {
      this.trainrunsUpdated();
    }
    this.operation.emit(new TrainrunOperation(OperationType.delete, trainrun));
  }

  getSelectedTrainrun(): Trainrun {
    const selectedTrainrun: Trainrun = this.trainrunsStore.trainruns.find((tr) => tr.selected());
    if (selectedTrainrun !== undefined) {
      return selectedTrainrun;
    } else {
      return null;
    }
  }

  setTrainrunAsSelected(trainrunId: number, enforceUpdate = true) {
    this.trainrunsStore.trainruns.forEach((tr) => tr.unselect());
    const trainrun = this.getTrainrunFromId(trainrunId);
    if (trainrun !== undefined) {
      trainrun.select();
      if (enforceUpdate) {
        this.trainrunsUpdated();
      }
    }
  }

  unselectAllTrainruns(enforceUpdate = true) {
    this.trainrunsStore.trainruns.forEach((trainrun) => trainrun.unselect());
    if (enforceUpdate) {
      this.trainrunsUpdated();
    }
  }

  isAnyTrainrunSelected(): boolean {
    const selectedTrainrun = this.trainrunsStore.trainruns.find((trainrun) => trainrun.selected());
    return selectedTrainrun !== undefined;
  }

  updateTrainrunFrequency(
    trainrun: Trainrun,
    frequency: TrainrunFrequency,
    offset: number,
  ): number {
    const oldFreq = trainrun.getFrequency();
    const newFreq = frequency.frequency;

    const freqOffset = (frequency.offset + offset) % newFreq;

    if (trainrun.getTrainrunFrequency().id === frequency.id) {
      // no update needed
      return freqOffset;
    }

    this.getTrainrunFromId(trainrun.getId()).setTrainrunFrequency(frequency);

    this.trainrunSectionService
      .getAllTrainrunSectionsForTrainrun(trainrun.getId())
      .forEach((ts: TrainrunSection) => {
        const sourceDeparture = (60 + ts.getSourceDeparture() + freqOffset) % 60;
        const targetArrival = (60 + ts.getTargetArrival() + freqOffset) % 60;
        this.trainrunSectionService.updateTrainrunSectionTime(
          ts.getId(),
          (60 - sourceDeparture) % 60,
          sourceDeparture,
          targetArrival,
          (60 - targetArrival) % 60,
          ts.getTravelTime(),
          ts.getBackwardTravelTime(),
          false, // disable event emission since UpdateTrainrunOperation is emitted below
        );
      });

    this.nodeService.reorderPortsOnNodesForTrainrun(trainrun, false);
    this.propagateTrainrunInitialConsecutiveTimes(trainrun);
    this.trainrunsUpdated();
    this.operation.emit(new TrainrunOperation(OperationType.update, trainrun));
    return freqOffset;
  }

  updateTrainrunCategory(trainrun: Trainrun, category: TrainrunCategory) {
    if (trainrun.getTrainrunCategory().id === category.id) {
      // no update needed
      return;
    }
    this.getTrainrunFromId(trainrun.getId()).setTrainrunCategory(category);
    this.nodeService.reorderPortsOnNodesForTrainrun(trainrun, false);
    this.trainrunsUpdated();
    this.operation.emit(new TrainrunOperation(OperationType.update, trainrun));
  }

  updateTrainrunTimeCategory(trainrun: Trainrun, timeCategory: TrainrunTimeCategory) {
    if (trainrun.getTrainrunTimeCategory().id === timeCategory.id) {
      // no update needed
      return;
    }

    this.getTrainrunFromId(trainrun.getId()).setTrainrunTimeCategory(timeCategory);
    this.nodeService.reorderPortsOnNodesForTrainrun(trainrun, false);
    this.trainrunsUpdated();
    this.operation.emit(new TrainrunOperation(OperationType.update, trainrun));
  }

  updateTrainrunTitle(trainrun: Trainrun, title: string) {
    this.getTrainrunFromId(trainrun.getId()).setTitle(title);
    this.nodeService.reorderPortsOnNodesForTrainrun(trainrun, false);
    this.trainrunsUpdated();
    this.operation.emit(new TrainrunOperation(OperationType.update, trainrun));
  }

  updateDirection(trainrun: Trainrun, direction: Direction) {
    const trainrunSection = this.getTrainrunFromId(trainrun.getId());
    trainrunSection.setDirection(direction);
    if (!trainrun.isRoundTrip()) {
      this.trainrunSectionService
        .getAllTrainrunSectionsForTrainrun(trainrun.getId())
        .forEach((ts: TrainrunSection) => ts.resetSymmetry());
    }
    this.trainrunsUpdated();
    this.operation.emit(new TrainrunOperation(OperationType.update, trainrun));
  }

  getTrainruns(): Trainrun[] {
    return Object.assign({}, this.trainrunsStore).trainruns;
  }

  getVisibleTrainruns(): Trainrun[] {
    return this.getTrainruns().filter((t) => this.filterService.filterTrainrun(t));
  }

  getAllTrainrunLabels(): string[] {
    let trainrunLabels = [];
    this.getTrainruns().forEach((t) =>
      this.labelService
        .getTextLabelsFromIds(t.getLabelIds())
        .forEach((label) => trainrunLabels.push(label)),
    );
    trainrunLabels = trainrunLabels.filter((v, i, a) => a.indexOf(v) === i);
    trainrunLabels.sort();
    return trainrunLabels;
  }

  visibleTrainrunsDeleteLabel(labelRef: string) {
    const labelObject = this.labelService.getLabelFromLabelAndLabelRef(labelRef, LabelRef.Trainrun);
    if (labelObject === undefined) {
      return;
    }
    this.getTrainruns().forEach((t: Trainrun) => {
      if (this.filterService.filterTrainrun(t)) {
        this.filterService.clearDeletetFilterTrainrunLabel(labelObject.getId());
        t.setLabelIds(t.getLabelIds().filter((labelId: number) => labelId !== labelObject.getId()));
      }
    });

    const trainruns = this.getTrainruns().find(
      (t: Trainrun) =>
        t.getLabelIds().find((labelId: number) => labelId === labelObject.getId()) !== undefined,
    );

    if (trainruns === undefined) {
      this.labelService.deleteLabel(labelObject.getId());
    }
    this.trainrunsUpdated();
  }

  visibleTrainrunsSetLabel(labelRef: string) {
    const labelObject = this.labelService.getLabelFromLabelAndLabelRef(labelRef, LabelRef.Trainrun);
    if (labelObject === undefined) {
      return;
    }
    this.getTrainruns().forEach((t) => {
      if (this.filterService.filterTrainrun(t)) {
        const labelIds: number[] = t.getLabelIds();
        labelIds.push(labelObject.getId());
        t.setLabelIds(labelIds.filter((v, i, a) => a.indexOf(v) === i));
      }
    });
    this.trainrunsUpdated();
  }

  getConnectedTrainrunIdsFirstOrder(trainrunId: number): number[] {
    const trainrunSections =
      this.trainrunSectionService.getAllTrainrunSectionsForTrainrun(trainrunId);
    let connectedTrainrunIds: number[] = [];
    for (const trainsection of trainrunSections) {
      connectedTrainrunIds = connectedTrainrunIds.concat(
        trainsection.getSourceNode().getAllConnectedTrainruns(trainsection),
      );
      connectedTrainrunIds = connectedTrainrunIds.concat(
        trainsection.getTargetNode().getAllConnectedTrainruns(trainsection),
      );
    }
    return [...new Set(connectedTrainrunIds)];
  }

  getDtos() {
    return this.trainrunsStore.trainruns.map((trainrun) => trainrun.getDto());
  }

  splitTrainrunIntoTwoParts(t: Transition) {
    const trainrun2split = t.getTrainrun();
    const portId1 = t.getPortId1();
    const portId2 = t.getPortId2();

    const node = this.nodeService.getNodeFromTransition(t);
    node.removeTransitionFromId(t);

    const port1 = node.getPort(portId1);
    const port2 = node.getPort(portId2);
    const trainrunSection2 = port2.getTrainrunSection();
    const newTrainrun = this.duplicateTrainrun(trainrunSection2.getTrainrunId(), false, "-2");

    trainrunSection2.setTrainrun(newTrainrun);
    const iterator = this.getIterator(node, trainrunSection2);
    while (iterator.hasNext()) {
      iterator.next();
      const trans = iterator
        .current()
        .node.getTransition(iterator.current().trainrunSection.getId());
      if (trans) {
        trans.setTrainrun(newTrainrun);
      }
      iterator.current().trainrunSection.setTrainrun(newTrainrun);
    }

    this.nodeService.checkAndFixMissingTransitions(
      port1.getTrainrunSection().getSourceNodeId(),
      port1.getTrainrunSection().getTargetNodeId(),
      port1.getTrainrunSection().getId(),
      false,
    );

    trainrun2split.unselect();
    newTrainrun.select();
    this.nodeService.transitionsUpdated();
    this.trainrunsUpdated();
  }

  combineTwoTrainruns(node: Node, port1: Port, port2: Port) {
    const trainrun1 = port1.getTrainrunSection().getTrainrun();
    const trainrun2 = port2.getTrainrunSection().getTrainrun();
    if (trainrun1.getId() === trainrun2.getId()) {
      return;
    }

    // Only the frequency position of the main train should influence the frequency position
    // of the merged train, i.e. if, for example, both trains run every 30 minutes, one is in
    // cycle position 0 and the second is in frequency position 30, e.g. 02 or 32, then the second
    // should be shifted by 30 minutes (1 frequency ) so that both are in the same cycle position,
    // i.e. 02.
    const arrivalTimeAtNode =
      node.getId() !== port1.getTrainrunSection().getSourceNodeId()
        ? port1.getTrainrunSection().getTargetArrival()
        : port1.getTrainrunSection().getSourceArrival();

    const departTimeAtNode =
      node.getId() !== port2.getTrainrunSection().getSourceNodeId()
        ? port2.getTrainrunSection().getTargetDeparture()
        : port2.getTrainrunSection().getSourceDeparture();

    let frequencyOffset = 0;
    while (60 + arrivalTimeAtNode > departTimeAtNode + frequencyOffset) {
      frequencyOffset += port1.getTrainrunSection().getFrequency();
    }

    // update trainrun references (trainrunSections and transitions)
    const trainrunSection = port2.getTrainrunSection();
    trainrunSection.setTrainrun(trainrun1);
    const iterator = this.getIterator(node, trainrunSection);
    while (iterator.hasNext()) {
      iterator.next();
      const trans = iterator
        .current()
        .node.getTransition(iterator.current().trainrunSection.getId());
      if (trans) {
        trans.setTrainrun(trainrun1);
      }
      iterator.current().trainrunSection.setTrainrun(trainrun1);
      iterator
        .current()
        .trainrunSection.shiftAllTimes(
          frequencyOffset,
          node.getId() === port2.getTrainrunSection().getSourceNodeId(),
        );
    }

    // Enforce updating all transitions. If the train run has "holes," we must also update
    // all other transitions that cannot be reached through train run iterations. However,
    // we don't need to update the times, so we can skip `shiftAllTimes`.
    this.trainrunSectionService
      .getAllTrainrunSectionsForTrainrun(trainrun2.getId())
      .forEach((ts) => {
        ts.getSourceNode().getTransition(ts.getId())?.setTrainrun(trainrun1);
        ts.getTargetNode().getTransition(ts.getId())?.setTrainrun(trainrun1);
      });

    // update trainrun references (1st transition)
    const trans1 = node.getTransitionFromPortId(port1.getId());
    const trans2 = node.getTransitionFromPortId(port2.getId());
    if (trans1 === undefined && trans2 === undefined) {
      const trans = node.addTransitionAndComputeRouting(port1, port2, trainrun1);
      if (60 + arrivalTimeAtNode === departTimeAtNode + frequencyOffset) {
        trans.setIsNonStopTransit(true);
      } else {
        trans.setIsNonStopTransit(false);
      }
    }

    // update trainrun references (connection)
    const connections2delete = node.getConnections().filter((c: Connection) => {
      return (
        (c.getPortId1() === port1.getId() && c.getPortId2() === port2.getId()) ||
        (c.getPortId1() === port2.getId() && c.getPortId2() === port1.getId())
      );
    });
    connections2delete.forEach((c: Connection) => {
      node.removeConnection(c.getId());
    });

    // unselect both trainruns
    trainrun1.unselect();
    trainrun2.unselect();

    // Change all trainrun sections' trainrunId reference from trainrun2 to trainrun1
    // There can be some other "unconnected" trainrun segments left; those have to be moved to
    // trainrun1, which will "survive".
    this.trainrunSectionService
      .getAllTrainrunSectionsForTrainrun(trainrun2.getId())
      .forEach((ts: TrainrunSection) => ts.setTrainrun(trainrun1));

    // remove empty trainrun
    this.deleteTrainrun(trainrun2, false);

    // select
    trainrun1.select();
    this.nodeService.reorderPortsOnNodesForTrainrun(trainrun1, false);

    // Ensure consistent section direction considering the previous ones
    this.trainrunSectionService.enforceConsistentSectionDirection(trainrunSection.getTrainrunId());

    // Update the cumulative times for the combined trainrun
    this.propagateConsecutiveTimesForTrainrun(port1.getTrainrunSection().getId());

    // update
    this.trainrunsUpdated();
    this.nodeService.nodesUpdated();
    this.nodeService.connectionsUpdated();
    this.nodeService.transitionsUpdated();
  }

  duplicateTrainrun(trainrunId: number, enforceUpdate = true, postfix = " COPY"): Trainrun {
    const trainrun = this.getTrainrunFromId(trainrunId);
    const copiedtrainrun = new Trainrun();
    copiedtrainrun.setTrainrunCategory(trainrun.getTrainrunCategory());
    copiedtrainrun.setTrainrunFrequency(trainrun.getTrainrunFrequency());
    copiedtrainrun.setTrainrunTimeCategory(trainrun.getTrainrunTimeCategory());
    copiedtrainrun.setDirection(trainrun.getDirection());
    copiedtrainrun.setTitle(trainrun.getTitle() + postfix);
    copiedtrainrun.setLabelIds(trainrun.getLabelIds());
    this.trainrunsStore.trainruns.push(copiedtrainrun);
    this.operation.emit(new TrainrunOperation(OperationType.create, copiedtrainrun));
    return copiedtrainrun;
  }

  duplicateTrainrunAndSections(
    trainrunId: number,
    enforceUpdate = true,
    postfix = " COPY",
  ): Trainrun {
    const copiedtrainrun = this.duplicateTrainrun(trainrunId, enforceUpdate, postfix);
    this.trainrunSectionService.copyAllTrainrunSectionsForTrainrun(
      trainrunId,
      copiedtrainrun.getId(),
    );
    this.setTrainrunAsSelected(copiedtrainrun.getId(), false);
    if (enforceUpdate) {
      this.nodeService.transitionsUpdated();
      this.nodeService.nodesUpdated();
      this.trainrunsUpdated();
    }
    return copiedtrainrun;
  }

  setLabels(trainrunId: number, labels: string[]) {
    const trainrun = this.getTrainrunFromId(trainrunId);

    // ensure uniqueness of input labels
    const uniqueLabels = Array.from(new Set(labels));
    const labelIds = uniqueLabels.map((label) =>
      this.labelService.getOrCreateLabel(label, LabelRef.Trainrun).getId(),
    );
    const deletedLabelIds = this.labelService.clearLabel(
      this.findClearedLabel(trainrun, labelIds),
      this.makeLabelIDCounterMap(this.getTrainruns()),
    );
    this.filterService.clearDeletetFilterTrainrunLabels(deletedLabelIds);
    trainrun.setLabelIds(labelIds);
    this.trainrunsUpdated();
    if (uniqueLabels.length === labels.length) {
      this.operation.emit(new TrainrunOperation(OperationType.update, trainrun));
    }
  }

  trainrunsUpdated() {
    this.trainrunsSubject.next(Object.assign({}, this.trainrunsStore).trainruns);
  }

  propagateInitialConsecutiveTimes() {
    this.trainrunsStore.trainruns.forEach((trainrun) => {
      this.propagateTrainrunInitialConsecutiveTimes(trainrun);
    });
  }

  propagateTrainrunInitialConsecutiveTimes(trainrun: Trainrun) {
    const startNode = this.getStartNodeWithTrainrunId(trainrun.getId());
    const ts = startNode.getTrainrunSection(trainrun);
    this.propagateConsecutiveTimesForTrainrun(ts.getId());
  }

  getBothEndNodesFromTrainrunPart(trainrunSection: TrainrunSection): {
    endNode1: Node;
    endNode2: Node;
  } {
    const sourceNode = trainrunSection.getSourceNode();
    const targetNode = trainrunSection.getTargetNode();
    const endNode1 = this.getEndNode(sourceNode, trainrunSection);
    const endNode2 = this.getEndNode(targetNode, trainrunSection);
    return {endNode1, endNode2};
  }

  propagateConsecutiveTimesForTrainrun(trainrunSectionId: number) {
    const inTrainrunSection =
      this.trainrunSectionService.getTrainrunSectionFromId(trainrunSectionId);
    if (inTrainrunSection === undefined) {
      return;
    }

    let alltrainrunsections = this.trainrunSectionService.getAllTrainrunSectionsForTrainrun(
      inTrainrunSection.getTrainrunId(),
    );

    while (alltrainrunsections.length > 0) {
      // propagate Consecutive Times Forward
      const trainrunSection = alltrainrunsections[0];
      const bothEndNodes = this.getBothEndNodesFromTrainrunPart(trainrunSection);

      const startForwardBackwardNode = GeneralViewFunctions.getStartForwardAndBackwardNode(
        bothEndNodes.endNode1,
        bothEndNodes.endNode2,
      );

      const propDataForward = this.propagateConsecutiveTimes(
        startForwardBackwardNode.startForwardNode,
        startForwardBackwardNode.startForwardNode.getStartTrainrunSection(
          trainrunSection.getTrainrunId(),
          true,
        ),
        trainrunSection.getFrequencyOffset(),
      );
      const arrivalTime = propDataForward.cumTime;

      // propagate Consecutive Times Backward
      const freq = trainrunSection.getTrainrun().getTrainrunFrequency().frequency;
      const restFreqArrivalTime = Math.floor(arrivalTime / freq) * freq;
      const freqDependantArrivalTime = arrivalTime - restFreqArrivalTime;
      let offset = freq - freqDependantArrivalTime;
      offset += restFreqArrivalTime;
      offset = Math.floor(offset / 60) * 60;

      const propDataBackward = this.propagateConsecutiveTimes(
        startForwardBackwardNode.startBackwardNode,
        startForwardBackwardNode.startBackwardNode.getStartTrainrunSection(
          trainrunSection.getTrainrunId(),
          false,
        ),
        offset,
      );

      // filter all still visited trainrun sections
      alltrainrunsections = alltrainrunsections.filter(
        (ts) =>
          propDataForward.visitedTrainrunSections.indexOf(ts) === -1 &&
          propDataBackward.visitedTrainrunSections.indexOf(ts) === -1,
      );
    }
  }

  getStartNodeWithTrainrunId(trainrunId: number): Node {
    const bothEndNodes = this.getBothEndNodesWithTrainrunId(trainrunId);
    return GeneralViewFunctions.getLeftOrTopNode(bothEndNodes.endNode1, bothEndNodes.endNode2);
  }

  getEndNodeWithTrainrunId(trainrunId: number): Node {
    const bothEndNodes = this.getBothEndNodesWithTrainrunId(trainrunId);
    return GeneralViewFunctions.getRightOrBottomNode(bothEndNodes.endNode1, bothEndNodes.endNode2);
  }

  getEndNode(node: Node, trainrunSection: TrainrunSection): Node {
    const iterator = this.getIterator(node, trainrunSection);
    while (iterator.hasNext()) {
      iterator.next();
    }
    return iterator.current().node;
  }

  getNodePathToEnd(node: Node, trainrunSection: TrainrunSection): Node[] {
    const path: Node[] = [node];
    const iterator = this.getIterator(node, trainrunSection);
    while (iterator.hasNext()) {
      iterator.next();
      path.push(iterator.current().node);
    }
    return path;
  }

  getLastNonStopNode(node: Node, trainrunSection: TrainrunSection): Node {
    const iterator = this.getNonStopIterator(node, trainrunSection);
    while (iterator.hasNext()) {
      iterator.next();
    }
    return iterator.current().node;
  }

  getBothLastNonStopNodes(trainrunSection: TrainrunSection) {
    const sourceNode = trainrunSection.getSourceNode();
    const targetNode = trainrunSection.getTargetNode();
    return {
      lastNonStopNode1: this.getLastNonStopNode(sourceNode, trainrunSection),
      lastNonStopNode2: this.getLastNonStopNode(targetNode, trainrunSection),
    };
  }

  getLastNonStopTrainrunSection(node: Node, trainrunSection: TrainrunSection): TrainrunSection {
    const iterator = this.getNonStopIterator(node, trainrunSection);
    while (iterator.hasNext()) {
      iterator.next();
    }
    return iterator.current().trainrunSection;
  }

  getBothLastNonStopTrainrunSections(trainrunSection: TrainrunSection) {
    const sourceNode = trainrunSection.getSourceNode();
    const targetNode = trainrunSection.getTargetNode();
    return {
      lastNonStopTrainrunSection1: this.getLastNonStopTrainrunSection(sourceNode, trainrunSection),
      lastNonStopTrainrunSection2: this.getLastNonStopTrainrunSection(targetNode, trainrunSection),
    };
  }

  getFirstNonStopTrainrunSection(trainrunSection: TrainrunSection): TrainrunSection {
    // starts at the target node, goes backwards to find the first section that is not a non-stop section
    const iterator = this.getBackwardNonStopIterator(
      trainrunSection.getTargetNode(),
      trainrunSection,
    );
    while (iterator.hasNext()) {
      iterator.next();
    }
    return iterator.current().trainrunSection;
  }

  sumTravelTimeUpToLastNonStopNode(node: Node, trainrunSection: TrainrunSection): number {
    let summedTravelTime = 0;
    const iterator = this.getNonStopIterator(node, trainrunSection);
    while (iterator.hasNext()) {
      const nextPair = iterator.next();
      summedTravelTime += nextPair.trainrunSection.getTravelTime();
    }
    return summedTravelTime;
  }

  getCumulativeTravelTime(trainrunSection: TrainrunSection) {
    const iterator = this.getNonStopIterator(trainrunSection.getSourceNode(), trainrunSection);
    while (iterator.hasNext()) {
      iterator.next();
    }
    return this.sumTravelTimeUpToLastNonStopNode(
      iterator.current().node,
      iterator.current().trainrunSection,
    );
  }

  getCumSumTravelTimeNodePathToLastNonStopNode(n: Node, ts: TrainrunSection) {
    const data = [
      {
        node: n,
        sumTravelTime: 0,
        trainrunSection: ts,
      },
    ];
    let summedTravelTime = 0;
    const iterator = this.getNonStopIterator(n, ts);
    while (iterator.hasNext()) {
      const nextPair = iterator.next();
      summedTravelTime += nextPair.trainrunSection.getTravelTime();
      data.push({
        node: nextPair.node,
        sumTravelTime: summedTravelTime,
        trainrunSection: nextPair.trainrunSection,
      });
    }
    return data;
  }

  getCumulativeTravelTimeAndNodePath(trainrunSection: TrainrunSection) {
    const iterator = this.getNonStopIterator(trainrunSection.getSourceNode(), trainrunSection);
    while (iterator.hasNext()) {
      iterator.next();
    }
    return this.getCumSumTravelTimeNodePathToLastNonStopNode(
      iterator.current().node,
      iterator.current().trainrunSection,
    );
  }

  // TODO: refactor travelTime and backwardTravelTime to use the same logic
  // and use reverse iterator?
  // TODO: wip
  sumBackwardTravelTimeUpToLastNonStopNode(node: Node, trainrunSection: TrainrunSection): number {
    let summedBackwardTravelTime = 0;
    const iterator = this.getBackwardNonStopIterator(node, trainrunSection);
    while (iterator.hasNext()) {
      const nextPair = iterator.next();
      summedBackwardTravelTime += nextPair.trainrunSection.getBackwardTravelTime();
    }
    return summedBackwardTravelTime;
  }

  getCumulativeBackwardTravelTime(trainrunSection: TrainrunSection) {
    const iterator = this.getBackwardNonStopIterator(
      trainrunSection.getTargetNode(),
      trainrunSection,
    );
    while (iterator.hasNext()) {
      iterator.next();
    }
    return this.sumBackwardTravelTimeUpToLastNonStopNode(
      iterator.current().node,
      iterator.current().trainrunSection,
    );
  }

  getCumSumBackwardTravelTimeNodePathToLastNonStopNode(n: Node, ts: TrainrunSection) {
    const data = [
      {
        node: n,
        sumBackwardTravelTime: 0,
        trainrunSection: ts,
      },
    ];
    let summedBackwardTravelTime = 0;
    const iterator = this.getBackwardNonStopIterator(n, ts);
    while (iterator.hasNext()) {
      const nextPair = iterator.next();
      summedBackwardTravelTime += nextPair.trainrunSection.getBackwardTravelTime();
      data.push({
        node: nextPair.node,
        sumBackwardTravelTime: summedBackwardTravelTime,
        trainrunSection: nextPair.trainrunSection,
      });
    }
    return data;
  }

  getCumulativeBackwardTravelTimeAndNodePath(trainrunSection: TrainrunSection) {
    const iterator = this.getBackwardNonStopIterator(
      trainrunSection.getTargetNode(),
      trainrunSection,
    );
    while (iterator.hasNext()) {
      iterator.next();
    }
    return this.getCumSumBackwardTravelTimeNodePathToLastNonStopNode(
      iterator.current().node,
      iterator.current().trainrunSection,
    );
  }

  isStartEqualsEndNode(trainrunSectionId: number): boolean {
    const trainrunSection = this.trainrunSectionService.getTrainrunSectionFromId(trainrunSectionId);
    const startNode = this.getEndNode(trainrunSection.getSourceNode(), trainrunSection);
    const endNode = this.getEndNode(trainrunSection.getTargetNode(), trainrunSection);
    return startNode.getId() === endNode.getId();
  }

  public getIterator(node: Node, trainrunSection: TrainrunSection) {
    return new TrainrunIterator(this.logService, node, trainrunSection);
  }

  public getNonStopIterator(node: Node, trainrunSection: TrainrunSection) {
    return new NonStopTrainrunIterator(this.logService, node, trainrunSection);
  }

  public getBackwardIterator(node: Node, trainrunSection: TrainrunSection) {
    return new BackwardTrainrunIterator(this.logService, node, trainrunSection);
  }

  public getBackwardNonStopIterator(node: Node, trainrunSection: TrainrunSection) {
    return new BackwardNonStopTrainrunIterator(this.logService, node, trainrunSection);
  }

  // For each trainrun, get iterator from the smallest consecutiveTime.
  public getRootIterators(): Map<number, TrainrunIterator> {
    const trainrunSections = this.trainrunSectionService.getTrainrunSections();
    const iterators = new Map<number, TrainrunIterator>();
    const consecutiveTimes = new Map<number, number>();
    trainrunSections.forEach((ts) => {
      const trainrunId = ts.getTrainrunId();
      const node = ts.getSourceNode();
      const it = iterators.get(trainrunId);
      const consecutiveTime = ts.getSourceDepartureDto().consecutiveTime;
      if (it === undefined || consecutiveTimes.get(trainrunId) > consecutiveTime) {
        iterators.set(trainrunId, this.getIterator(node, ts));
        consecutiveTimes.set(trainrunId, consecutiveTime);
      }
    });
    return iterators;
  }

  getBothEndNodesWithTrainrunId(trainrunId: number) {
    const trainrunSections: TrainrunSection[] = this.trainrunSectionService.getTrainrunSections();
    const trainrunSection = trainrunSections.find((trs) => trs.getTrainrunId() === trainrunId);
    return this.getBothEndNodesFromTrainrunPart(trainrunSection);
  }

  getFirstAndLastTrainrunSections(trainrunId: number): {
    firstTrainrunSection: TrainrunSection;
    lastTrainrunSection: TrainrunSection;
    swapped: boolean;
  } {
    const trainrunSections =
      this.trainrunSectionService.getAllTrainrunSectionsForTrainrun(trainrunId);
    const [startNode, endNode] = [
      this.getStartNodeWithTrainrunId(trainrunId),
      this.getEndNodeWithTrainrunId(trainrunId),
    ];

    // Try to find startNode → endNode
    let firstTrainrunSection = trainrunSections.find(
      (ts) => ts.getSourceNodeId() === startNode.getId(),
    );
    let lastTrainrunSection = [...trainrunSections]
      .reverse()
      .find((ts) => ts.getTargetNodeId() === endNode.getId());

    let swapped = false;
    if (!firstTrainrunSection && !lastTrainrunSection) {
      firstTrainrunSection = trainrunSections.find(
        (ts) => ts.getSourceNodeId() === endNode.getId(),
      );
      lastTrainrunSection = [...trainrunSections]
        .reverse()
        .find((ts) => ts.getTargetNodeId() === startNode.getId());
      [firstTrainrunSection, lastTrainrunSection] = [lastTrainrunSection, firstTrainrunSection];
      swapped = true;
    }

    return {
      firstTrainrunSection: firstTrainrunSection,
      lastTrainrunSection: lastTrainrunSection,
      swapped: swapped,
    };
  }

  private createNewTrainrunFromDto(trainrun: TrainrunDto): Trainrun {
    const newTrainrun = new Trainrun();
    newTrainrun.setTrainrunCategory(this.dataService.getTrainrunCategory(trainrun.categoryId));
    newTrainrun.setTrainrunFrequency(this.dataService.getTrainrunFrequency(trainrun.frequencyId));
    newTrainrun.setTrainrunTimeCategory(
      this.dataService.getTrainrunTimeCategory(trainrun.trainrunTimeCategoryId),
    );
    newTrainrun.setDirection(trainrun.direction);
    newTrainrun.setTitle(trainrun.name);
    newTrainrun.setLabelIds(trainrun.labelIds);
    this.trainrunsStore.trainruns.push(newTrainrun);
    return newTrainrun;
  }

  private propagateConsecutiveTimes(
    node: Node,
    trainrunSection: TrainrunSection,
    offset: number,
  ): {
    cumTime: number;
    visitedTrainrunSections: TrainrunSection[];
  } {
    const visitedTrainrunSections: TrainrunSection[] = [trainrunSection];
    if (trainrunSection === undefined) {
      return {
        cumTime: 0,
        visitedTrainrunSections: visitedTrainrunSections,
      };
    }
    let accumulatedTime = node.getDepartureTime(trainrunSection) + offset;
    const iterator = this.getIterator(node, trainrunSection);
    while (iterator.hasNext()) {
      const nextPair = iterator.next();
      nextPair.node
        .getOppositeNode(nextPair.trainrunSection)
        .setDepartureConsecutiveTime(nextPair.trainrunSection, accumulatedTime);

      const oppositeNodeDepartureTime = nextPair.node
        .getOppositeNode(nextPair.trainrunSection)
        .getDepartureTime(nextPair.trainrunSection);
      const arrivalTime = nextPair.node.getArrivalTime(nextPair.trainrunSection);
      const travelTime =
        arrivalTime < oppositeNodeDepartureTime
          ? arrivalTime + 60 - oppositeNodeDepartureTime
          : arrivalTime - oppositeNodeDepartureTime;
      accumulatedTime += travelTime;

      const travelTimeOffset =
        nextPair.trainrunSection.getTravelTime() - (nextPair.trainrunSection.getTravelTime() % 60);
      accumulatedTime += travelTimeOffset;

      nextPair.node.setArrivalConsecutiveTime(nextPair.trainrunSection, accumulatedTime);

      let halteZeit = 0;
      if (!nextPair.node.isEndNode(nextPair.trainrunSection)) {
        const oldArrival = nextPair.node.getArrivalTime(nextPair.trainrunSection);
        const trs = nextPair.node.getNextTrainrunSection(nextPair.trainrunSection);
        const nextDeparture = nextPair.node.isNonStop(nextPair.trainrunSection)
          ? oldArrival
          : nextPair.node.getDepartureTime(trs);
        halteZeit =
          nextDeparture < oldArrival ? nextDeparture + 60 - oldArrival : nextDeparture - oldArrival;
      }
      accumulatedTime += halteZeit;
      visitedTrainrunSections.push(nextPair.trainrunSection);
    }
    return {
      cumTime: accumulatedTime,
      visitedTrainrunSections: visitedTrainrunSections,
    };
  }

  private findClearedLabel(trainrun: Trainrun, labelIds: number[]) {
    return [].concat(trainrun.getLabelIds()).filter((oldlabelId) => !labelIds.includes(oldlabelId));
  }

  private makeLabelIDCounterMap(trainruns: Trainrun[]): Map<number, number> {
    const labelIDCauntMap = new Map<number, number>();
    trainruns.forEach((trainrun) => {
      trainrun.getLabelIds().forEach((labelId) => {
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
