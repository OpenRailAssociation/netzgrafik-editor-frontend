import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {LogService} from "../../logger/log.service";

export class TrainrunSectionNodePair {
  constructor(
    readonly node: Node,
    readonly trainrunSection: TrainrunSection,
  ) {}
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
    this.currentElement = Object.assign({}, this.pointerElement);
    this.visitedNodes.push(this.currentElement);
  }

  public current(): TrainrunSectionNodePair {
    return this.currentElement;
  }

  public next(): TrainrunSectionNodePair {
    this.currentElement = Object.assign({}, this.pointerElement);
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
      this.currentElement = Object.assign({}, this.pointerElement);
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
    const currentElement = Object.assign({}, this.pointerElement);
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
      this.currentElement = Object.assign({}, this.pointerElement);
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
      this.currentElement = Object.assign({}, this.pointerElement);
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
      this.currentElement = Object.assign({}, this.pointerElement);
      this.pointerElement = new TrainrunSectionNodePair(undefined, undefined);
      return this.currentElement;
    }
    return super.next();
  }
}
