import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {LogService} from "../../logger/log.service";

/**
 * A pair of trainrun section and node, obtained while iterating on a trainrun.
 *
 * The node will be traversed at the next iteration (ie, the node is not the
 * one which got traversed at the previous iteration).
 */
export class TrainrunSectionNodePair {
  constructor(
    readonly node: Node,
    readonly trainrunSection: TrainrunSection,
  ) {}

  /**
   * Obtain a directed trainrun section proxy with the iteration direction.
   */
  getDirectedTrainrunSectionProxy(): DirectedTrainrunSectionProxy {
    const direction =
      this.trainrunSection.getTargetNodeId() === this.node.getId()
        ? "sourceToTarget"
        : "targetToSource";
    return new DirectedTrainrunSectionProxy(this.trainrunSection, direction);
  }
}

/**
 * A proxy for a trainrun section, seen in a given direction.
 *
 * Trainrun sections have a source node and a target node. Thus they have a
 * "natural" iteration order. However, NGE algorithms often need to operate in
 * one direction or the other, depending on the relative position of nodes
 * (left/right, top/bottom) or end user needs (arrow button).
 *
 * To avoid duplicating logic, this class provides a proxy object which wraps a
 * trainrun section and introduces abstract "head" and "tail" nodes:
 *
 *     ┌──────┐           ┌──────┐
 *     │      │  Section  │      │
 *     │ Tail ├──────────►│ Head │
 *     │      │           │      │
 *     └──────┘           └──────┘
 *
 * When operating on the section in the source-to-target order, the tail is the
 * source and the head is the target. When operating in target-to-source order,
 * the tail is the target and the head is the source.
 */
export class DirectedTrainrunSectionProxy {
  constructor(
    readonly trainrunSection: TrainrunSection,
    readonly direction: "sourceToTarget" | "targetToSource",
  ) {}

  getTailNode(): Node {
    return this.direction === "sourceToTarget"
      ? this.trainrunSection.getSourceNode()
      : this.trainrunSection.getTargetNode();
  }

  getHeadNode(): Node {
    return this.direction === "sourceToTarget"
      ? this.trainrunSection.getTargetNode()
      : this.trainrunSection.getSourceNode();
  }

  getTailDeparture(): number {
    return this.direction === "sourceToTarget"
      ? this.trainrunSection.getSourceDeparture()
      : this.trainrunSection.getTargetDeparture();
  }

  getTailArrival(): number {
    return this.direction === "sourceToTarget"
      ? this.trainrunSection.getSourceArrival()
      : this.trainrunSection.getTargetArrival();
  }

  getHeadDeparture(): number {
    return this.direction === "sourceToTarget"
      ? this.trainrunSection.getTargetDeparture()
      : this.trainrunSection.getSourceDeparture();
  }

  getHeadArrival(): number {
    return this.direction === "sourceToTarget"
      ? this.trainrunSection.getTargetArrival()
      : this.trainrunSection.getSourceArrival();
  }

  getTravelTime(): number {
    return this.direction === "sourceToTarget"
      ? this.trainrunSection.getTravelTime()
      : this.trainrunSection.getBackwardTravelTime();
  }

  getReverseTravelTime(): number {
    return this.direction === "sourceToTarget"
      ? this.trainrunSection.getBackwardTravelTime()
      : this.trainrunSection.getTravelTime();
  }

  setTailDeparture(time: number) {
    if (this.direction === "sourceToTarget") {
      this.trainrunSection.setSourceDeparture(time);
    } else {
      this.trainrunSection.setTargetDeparture(time);
    }
  }

  setTailArrival(time: number) {
    if (this.direction === "sourceToTarget") {
      this.trainrunSection.setSourceArrival(time);
    } else {
      this.trainrunSection.setTargetArrival(time);
    }
  }

  setHeadDeparture(time: number) {
    if (this.direction === "sourceToTarget") {
      this.trainrunSection.setTargetDeparture(time);
    } else {
      this.trainrunSection.setSourceDeparture(time);
    }
  }

  setHeadArrival(time: number) {
    if (this.direction === "sourceToTarget") {
      this.trainrunSection.setTargetArrival(time);
    } else {
      this.trainrunSection.setSourceArrival(time);
    }
  }

  setTravelTime(time: number) {
    if (this.direction === "sourceToTarget") {
      this.trainrunSection.setTravelTime(time);
    } else {
      this.trainrunSection.setBackwardTravelTime(time);
    }
  }

  setReverseTravelTime(time: number) {
    if (this.direction === "sourceToTarget") {
      this.trainrunSection.setBackwardTravelTime(time);
    } else {
      this.trainrunSection.setTravelTime(time);
    }
  }

  getTailDepartureLock(): boolean {
    return this.direction === "sourceToTarget"
      ? this.trainrunSection.getSourceDepartureLock()
      : this.trainrunSection.getTargetDepartureLock();
  }

  getTailArrivalLock(): boolean {
    return this.direction === "sourceToTarget"
      ? this.trainrunSection.getSourceArrivalLock()
      : this.trainrunSection.getTargetArrivalLock();
  }

  getHeadDepartureLock(): boolean {
    return this.direction === "sourceToTarget"
      ? this.trainrunSection.getTargetDepartureLock()
      : this.trainrunSection.getSourceDepartureLock();
  }

  getHeadArrivalLock(): boolean {
    return this.direction === "sourceToTarget"
      ? this.trainrunSection.getTargetArrivalLock()
      : this.trainrunSection.getSourceArrivalLock();
  }

  getTravelTimeLock(): boolean {
    return this.trainrunSection.getTravelTimeLock();
  }

  getTailSymmetry(): boolean {
    return this.direction === "sourceToTarget"
      ? this.trainrunSection.getSourceSymmetry()
      : this.trainrunSection.getTargetSymmetry();
  }

  getHeadSymmetry(): boolean {
    return this.direction === "sourceToTarget"
      ? this.trainrunSection.getTargetSymmetry()
      : this.trainrunSection.getSourceSymmetry();
  }
}

export class TrainrunIterator {
  protected currentElement: TrainrunSectionNodePair = null;
  protected pointerElement: TrainrunSectionNodePair = null;

  protected visitedNodes: TrainrunSectionNodePair[] = [];

  constructor(
    protected logService: LogService,
    private startNode: Node,
    private startTrainrunSection: TrainrunSection,
  ) {
    this.pointerElement = new TrainrunSectionNodePair(
      this.startNode.getOppositeNode(this.startTrainrunSection),
      this.startTrainrunSection,
    );
    this.currentElement = this.pointerElement;
    this.visitedNodes.push(this.currentElement);
  }

  public current(): TrainrunSectionNodePair {
    return this.currentElement;
  }

  public next(): TrainrunSectionNodePair {
    this.currentElement = this.pointerElement;
    const trainrunSection = this.pointerElement.node.getNextTrainrunSection(
      this.pointerElement.trainrunSection,
    );

    if (trainrunSection === undefined) {
      this.pointerElement = new TrainrunSectionNodePair(undefined, undefined);
      return this.currentElement;
    }

    const node = this.pointerElement.node.getOppositeNode(trainrunSection);
    this.pointerElement = new TrainrunSectionNodePair(node, trainrunSection);

    if (
      this.visitedNodes.find(
        (element) =>
          element.node.getId() === node.getId() &&
          element.trainrunSection.getId() === trainrunSection.getId(),
      ) !== undefined
    ) {
      // The trainrun has a loop -> early break the avoid unfinitiy iterating
      this.currentElement = this.pointerElement;
      this.pointerElement = new TrainrunSectionNodePair(undefined, undefined);
      // log the issue
      this.logService.error(
        $localize`:@@app.services.util.trainrun-iteration.error.infinity-loop:Iterator has detected an infinity loop. The iteration terminated early!`,
        new Error().stack,
      );
      return this.currentElement;
    }
    this.visitedNodes.push(this.currentElement);

    return this.currentElement;
  }

  public hasNext(): boolean {
    return this.pointerElement.trainrunSection !== undefined;
  }
}

export class BackwardTrainrunIterator extends TrainrunIterator {
  public next(): TrainrunSectionNodePair {
    const currentElement = this.pointerElement;
    const trainrunSection = this.pointerElement.node.getPreviousTrainrunSection(
      this.pointerElement.trainrunSection,
    );

    if (trainrunSection === undefined) {
      this.pointerElement = new TrainrunSectionNodePair(undefined, undefined);
      this.currentElement = currentElement;
      return this.currentElement;
    }

    const node = this.pointerElement.node.getOppositeNode(trainrunSection);
    this.pointerElement = new TrainrunSectionNodePair(node, trainrunSection);

    if (
      this.visitedNodes.find(
        (element) =>
          element.node.getId() === node.getId() &&
          element.trainrunSection.getId() === trainrunSection.getId(),
      ) !== undefined
    ) {
      // The trainrun has a loop -> early break the avoid unfinitiy iterating
      this.currentElement = this.pointerElement;
      this.pointerElement = new TrainrunSectionNodePair(undefined, undefined);
      // log the issue
      this.logService.error(
        $localize`:@@app.services.util.trainrun-iteration.error.infinity-loop:Iterator has detected an infinity loop. The iteration terminated early!`,
        new Error().stack,
      );
      return this.currentElement;
    }
    this.visitedNodes.push(this.currentElement);
    this.currentElement = currentElement;
    return this.currentElement;
  }
}

export class NonStopTrainrunIterator extends TrainrunIterator {
  public next(): TrainrunSectionNodePair {
    if (!this.pointerElement.node.isNonStop(this.pointerElement.trainrunSection)) {
      // The trainrun has a stop and break the forward iteration
      this.currentElement = this.pointerElement;
      this.pointerElement = new TrainrunSectionNodePair(undefined, undefined);
      return this.currentElement;
    }
    return super.next();
  }
}

export class BackwardNonStopTrainrunIterator extends BackwardTrainrunIterator {
  public next(): TrainrunSectionNodePair {
    if (!this.pointerElement.node.isNonStop(this.pointerElement.trainrunSection)) {
      // The trainrun has a stop and break the backward iteration
      this.currentElement = this.pointerElement;
      this.pointerElement = new TrainrunSectionNodePair(undefined, undefined);
      return this.currentElement;
    }
    return super.next();
  }
}
