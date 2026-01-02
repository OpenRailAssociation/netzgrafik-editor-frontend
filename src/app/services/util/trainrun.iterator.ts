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
    return this.trainrunSection.getTravelTime();
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
    this.trainrunSection.setTravelTime(time);
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
}

/**
 * A helper to iterate on trainrun sections.
 *
 * The initial node and trainrun section indicate the iteration direction: the
 * first iteration will cross the initial trainrun section starting from the
 * initial node. The first iteration yields the opposite node and the initial
 * trainrun section. The node source/target ordering doesn't have an impact on
 * the iteration direction.
 *
 * For instance, given the following trainrun:
 *
 *          ts₁        ts₂
 *     n₁ ─────── n₂ ─────── n₃
 *
 * Iterating left-to-right starting from (n₁, ts₁) will yield the following
 * pairs when calling next():
 *
 *     (n₂, ts₁)
 *     (n₃, ts₂)
 *
 * Iterating right-to-left starting from (n₃, ts₂) will yield the following
 * pairs when calling next():
 *
 *     (n₂, ts₂)
 *     (n₁, ts₁)
 */
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

/** Iterate on the trainrun sections until we find a node which is a stop of the trainrun and not collapsed */
export class NextExpandedStopIterator extends TrainrunIterator {
  public next(): TrainrunSectionNodePair {
    if (
      !this.pointerElement.node.isNonStop(this.pointerElement.trainrunSection) &&
      !this.pointerElement.node.getIsCollapsed()
    ) {
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

export class ExpandedTrainrunIterator extends TrainrunIterator {
  public next(): TrainrunSectionNodePair {
    // Continue traversing only if the current node is collapsed
    // Stop when we reach an expanded (non-collapsed) node
    if (!this.pointerElement.node.getIsCollapsed()) {
      // The trainrun has reached an expanded (non-collapsed) node and break the forward iteration
      this.currentElement = Object.assign({}, this.pointerElement);
      this.pointerElement = new TrainrunSectionNodePair(undefined, undefined);
      return this.currentElement;
    }
    return super.next();
  }
}
