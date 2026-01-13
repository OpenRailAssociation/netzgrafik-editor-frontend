import {DirectedTrainrunSectionProxy} from "./trainrun.iterator";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Node} from "../../models/node.model";
import {GeneralViewFunctions} from "../../view/util/generalViewFunctions";
import {MathUtils} from "../../utils/math";
import {TrainrunSectionText} from "../../data-structures/technical.data.structures";
import {TrainrunService} from "../data/trainrun.service";
import {TrainrunSectionService, PartialTimeStructure} from "../data/trainrunsection.service";
import {
  LeftAndRightLockStructure,
  LeftAndRightTimeStructure,
} from "../data/trainrun-section-times.service";

export enum LeftAndRightElement {
  LeftDeparture,
  LeftArrival,
  RightDeparture,
  RightArrival,
  TravelTime,
  LeftRightTrainrunName,
  RightLeftTrainrunName,
}

export class TrainrunsectionHelper {
  constructor(private trainrunService: TrainrunService) {}

  static getSymmetricTime(time: number) {
    return time === 0 ? 0 : 60 - time;
  }

  static getDefaultTimeStructure(
    timeStructure: LeftAndRightTimeStructure,
  ): LeftAndRightTimeStructure {
    return {
      leftDepartureTime: timeStructure.leftDepartureTime,
      leftArrivalTime: timeStructure.leftArrivalTime,
      rightDepartureTime: 0,
      rightArrivalTime: 0,
      travelTime: 0,
      bottomTravelTime: 0,
    };
  }

  static getTravelTime(
    totalTravelTime: number,
    summedTravelTime: number,
    travelTimeFactor: number,
    trsTravelTime: number,
    isRightNodeNonStopTransit: boolean,
    precision = TrainrunSectionService.TIME_PRECISION,
  ): number {
    if (isRightNodeNonStopTransit) {
      return Math.max(
        MathUtils.round(trsTravelTime * travelTimeFactor, precision),
        1.0 / Math.pow(10, precision),
      );
    } else {
      return Math.max(
        MathUtils.round(totalTravelTime - summedTravelTime, precision),
        1.0 / Math.pow(10, precision),
      );
    }
  }

  static getRightArrivalTime(
    timeStructure: LeftAndRightTimeStructure,
    precision = TrainrunSectionService.TIME_PRECISION,
  ): number {
    return MathUtils.round(
      (timeStructure.leftDepartureTime + (timeStructure.travelTime % 60)) % 60,
      precision,
    );
  }

  static getRightDepartureTime(
    timeStructure: LeftAndRightTimeStructure,
    precision = TrainrunSectionService.TIME_PRECISION,
  ): number {
    return MathUtils.round(this.getSymmetricTime(timeStructure.rightArrivalTime), precision);
  }

  static getArrivalTime(
    timeStructure: PartialTimeStructure,
    precision = TrainrunSectionService.TIME_PRECISION,
  ): number {
    return MathUtils.round(
      (timeStructure.departureTime + (timeStructure.travelTime % 60)) % 60,
      precision,
    );
  }

  getLeftBetriebspunkt(trainrunSection: TrainrunSection, orderedNodes: Node[]): string[] {
    const nextStopLeftNode = this.getNextStopLeftNode(trainrunSection, orderedNodes);
    return [nextStopLeftNode.getBetriebspunktName(), "(" + nextStopLeftNode.getFullName() + ")"];
  }

  getRightBetriebspunkt(trainrunSection: TrainrunSection, orderedNodes: Node[]): string[] {
    const nextStopRightNode = this.getNextStopRightNode(trainrunSection, orderedNodes);
    return [nextStopRightNode.getBetriebspunktName(), "(" + nextStopRightNode.getFullName() + ")"];
  }

  getLeftRightSections(trainrunSection: TrainrunSection) {
    const bothLastNonStopTransitNodes =
      this.trainrunService.getBothLastNonStopNodes(trainrunSection);

    const startForwardBackwardNode = GeneralViewFunctions.getStartForwardAndBackwardNode(
      bothLastNonStopTransitNodes.lastNonStopNode1,
      bothLastNonStopTransitNodes.lastNonStopNode2,
    );
    const lastLeftNode = startForwardBackwardNode.startForwardNode;
    const lastRightNode = startForwardBackwardNode.startBackwardNode;

    const towardsSource = this.trainrunService.getLastNonStopTrainrunSection(
      trainrunSection.getSourceNode(),
      trainrunSection,
    );
    const towradsTarget = this.trainrunService.getLastNonStopTrainrunSection(
      trainrunSection.getTargetNode(),
      trainrunSection,
    );

    let leftSection = towradsTarget;
    let rightSection = towardsSource;
    if (
      towardsSource.getSourceNodeId() === lastLeftNode.getId() ||
      towardsSource.getTargetNodeId() === lastLeftNode.getId()
    ) {
      leftSection = towardsSource;
      rightSection = towradsTarget;
    }
    return {
      leftSection: leftSection,
      rightSection: rightSection,
      lastLeftNode: lastLeftNode,
      lastRightNode: lastRightNode,
    };
  }

  getLeftRightDirectedSectionProxies(trainrunSection: TrainrunSection, orderedNodes: Node[]) {
    if (orderedNodes.length > 0) {
      const direction =
        orderedNodes[0].getId() === trainrunSection.getSourceNode().getId()
          ? "sourceToTarget"
          : "targetToSource";
      const section = new DirectedTrainrunSectionProxy(trainrunSection, direction);
      return {leftSection: section, rightSection: section};
    }

    const {leftSection, rightSection, lastLeftNode, lastRightNode} =
      this.getLeftRightSections(trainrunSection);

    return {
      leftSection: new DirectedTrainrunSectionProxy(
        leftSection,
        leftSection.getSourceNode().getId() === lastLeftNode.getId()
          ? "sourceToTarget"
          : "targetToSource",
      ),
      rightSection: new DirectedTrainrunSectionProxy(
        rightSection,
        rightSection.getTargetNode().getId() === lastRightNode.getId()
          ? "sourceToTarget"
          : "targetToSource",
      ),
    };
  }

  getSourceLock(
    lockStructure: LeftAndRightLockStructure,
    trainrunSection: TrainrunSection,
  ): boolean {
    const leftRight = this.getLeftRightSections(trainrunSection);
    if (trainrunSection.getSourceNodeId() === leftRight.lastLeftNode.getId()) {
      return lockStructure.leftLock;
    }
    if (trainrunSection.getSourceNodeId() === leftRight.lastRightNode.getId()) {
      return lockStructure.rightLock;
    }
    return undefined;
  }

  getTargetLock(
    lockStructure: LeftAndRightLockStructure,
    trainrunSection: TrainrunSection,
  ): boolean {
    const leftRight = this.getLeftRightSections(trainrunSection);
    if (trainrunSection.getTargetNodeId() === leftRight.lastLeftNode.getId()) {
      return lockStructure.leftLock;
    }
    if (trainrunSection.getTargetNodeId() === leftRight.lastRightNode.getId()) {
      return lockStructure.rightLock;
    }
    return undefined;
  }

  getLeftAndRightLock(
    trainrunSection: TrainrunSection,
    orderedNodes: Node[],
  ): LeftAndRightLockStructure {
    if (orderedNodes.length > 0) {
      const leftIsSource = orderedNodes[0].getId() === trainrunSection.getSourceNode().getId();
      const sourceLock =
        trainrunSection.getSourceDepartureLock() || trainrunSection.getSourceArrivalLock();
      const targetLock =
        trainrunSection.getTargetDepartureLock() || trainrunSection.getTargetArrivalLock();
      return {
        leftLock: leftIsSource ? sourceLock : targetLock,
        rightLock: leftIsSource ? targetLock : sourceLock,
        travelTimeLock: trainrunSection.getTravelTimeLock(),
      };
    }

    const lastLeftNode = this.getNextStopLeftNode(trainrunSection, orderedNodes);
    const lastRightNode = this.getNextStopRightNode(trainrunSection, orderedNodes);

    const towardsSource = this.trainrunService.getLastNonStopTrainrunSection(
      trainrunSection.getSourceNode(),
      trainrunSection,
    );
    const towradsTarget = this.trainrunService.getLastNonStopTrainrunSection(
      trainrunSection.getTargetNode(),
      trainrunSection,
    );
    let leftSection = towradsTarget;
    let rightSection = towardsSource;
    if (
      towardsSource.getSourceNodeId() === lastLeftNode.getId() ||
      towardsSource.getTargetNodeId() === lastLeftNode.getId()
    ) {
      leftSection = towardsSource;
      rightSection = towradsTarget;
    }

    return {
      leftLock:
        leftSection.getSourceNodeId() === lastLeftNode.getId()
          ? leftSection.getSourceArrivalLock() || leftSection.getSourceDepartureLock()
          : leftSection.getTargetArrivalLock() || leftSection.getTargetDepartureLock(),
      rightLock:
        rightSection.getSourceNodeId() === lastRightNode.getId()
          ? rightSection.getSourceArrivalLock() || rightSection.getSourceDepartureLock()
          : rightSection.getTargetArrivalLock() || rightSection.getTargetDepartureLock(),
      travelTimeLock: trainrunSection.getTravelTimeLock(),
    };
  }

  mapSelectedTimeElement(
    trainrunSectionSelectedText: TrainrunSectionText,
    trainrunSection: TrainrunSection,
    orderedNodes: Node[],
    forward: boolean,
  ): LeftAndRightElement | undefined {
    const nextStopLeftNode = this.getNextStopLeftNode(trainrunSection, orderedNodes);
    const sourceNodeid = trainrunSection.getSourceNode().getId();
    const targetNodeid = trainrunSection.getTargetNode().getId();

    switch (trainrunSectionSelectedText) {
      case TrainrunSectionText.SourceDeparture:
        return sourceNodeid === nextStopLeftNode.getId()
          ? LeftAndRightElement.LeftDeparture
          : LeftAndRightElement.RightDeparture;

      case TrainrunSectionText.SourceArrival:
        return sourceNodeid === nextStopLeftNode.getId()
          ? LeftAndRightElement.LeftArrival
          : LeftAndRightElement.RightArrival;

      case TrainrunSectionText.TargetDeparture:
        return targetNodeid === nextStopLeftNode.getId()
          ? LeftAndRightElement.LeftDeparture
          : LeftAndRightElement.RightDeparture;

      case TrainrunSectionText.TargetArrival:
        return targetNodeid === nextStopLeftNode.getId()
          ? LeftAndRightElement.LeftArrival
          : LeftAndRightElement.RightArrival;

      case TrainrunSectionText.TrainrunSectionName:
        if (forward === undefined) {
          return nextStopLeftNode.getId()
            ? LeftAndRightElement.LeftRightTrainrunName
            : LeftAndRightElement.RightLeftTrainrunName;
        }
        return sourceNodeid === nextStopLeftNode.getId()
          ? forward
            ? LeftAndRightElement.LeftRightTrainrunName
            : LeftAndRightElement.RightLeftTrainrunName
          : forward
            ? LeftAndRightElement.RightLeftTrainrunName
            : LeftAndRightElement.LeftRightTrainrunName;

      case TrainrunSectionText.TrainrunSectionTravelTime:
        return LeftAndRightElement.TravelTime;
    }
    return undefined;
  }

  mapLeftAndRightTimes(
    trainrunSection: TrainrunSection,
    orderedNodes: Node[],
    timeStructure: LeftAndRightTimeStructure,
  ): LeftAndRightTimeStructure {
    const bothLastNonStopNodes = this.trainrunService.getBothLastNonStopNodes(trainrunSection);
    const leftNode = GeneralViewFunctions.getLeftOrTopNode(
      bothLastNonStopNodes.lastNonStopNode1,
      bothLastNonStopNodes.lastNonStopNode2,
    );
    const localLeftNode = this.getNextStopLeftNode(trainrunSection, orderedNodes);
    if (leftNode.getId() !== localLeftNode.getId()) {
      const mappedTimeStructure = TrainrunsectionHelper.getDefaultTimeStructure(timeStructure);
      mappedTimeStructure.rightArrivalTime = timeStructure.leftArrivalTime;
      mappedTimeStructure.leftArrivalTime = timeStructure.rightArrivalTime;
      mappedTimeStructure.rightDepartureTime = timeStructure.leftDepartureTime;
      mappedTimeStructure.leftDepartureTime = timeStructure.rightDepartureTime;
      mappedTimeStructure.travelTime = timeStructure.bottomTravelTime;
      mappedTimeStructure.bottomTravelTime = timeStructure.travelTime;
      return mappedTimeStructure;
    }
    return timeStructure;
  }

  getLeftAndRightTimes(
    trainrunSection: TrainrunSection,
    orderedNodes: Node[],
  ): LeftAndRightTimeStructure {
    if (orderedNodes.length > 0) {
      const direction =
        orderedNodes[0].getId() === trainrunSection.getSourceNode().getId()
          ? "sourceToTarget"
          : "targetToSource";
      const section = new DirectedTrainrunSectionProxy(trainrunSection, direction);
      return {
        leftDepartureTime: section.getTailDeparture(),
        leftArrivalTime: section.getTailArrival(),
        rightDepartureTime: section.getHeadDeparture(),
        rightArrivalTime: section.getHeadArrival(),
        travelTime: section.getTravelTime(),
        bottomTravelTime: section.getReverseTravelTime(),
      };
    }

    const bothLastNonStopNodes = this.trainrunService.getBothLastNonStopNodes(trainrunSection);
    const bothLastNonStopTrainrunSections =
      this.trainrunService.getBothLastNonStopTrainrunSections(trainrunSection);
    const lastLeftNode = this.getNextStopLeftNode(trainrunSection, orderedNodes);
    const lastRightNode = this.getNextStopRightNode(trainrunSection, orderedNodes);

    const leftTrainrunSection =
      lastLeftNode.getId() === bothLastNonStopNodes.lastNonStopNode1.getId()
        ? bothLastNonStopTrainrunSections.lastNonStopTrainrunSection1
        : bothLastNonStopTrainrunSections.lastNonStopTrainrunSection2;
    const rightTrainrunSection =
      lastRightNode.getId() === bothLastNonStopNodes.lastNonStopNode1.getId()
        ? bothLastNonStopTrainrunSections.lastNonStopTrainrunSection1
        : bothLastNonStopTrainrunSections.lastNonStopTrainrunSection2;
    const cumulativeTravelTime = this.trainrunService.getCumulativeTravelTime(
      trainrunSection,
      lastLeftNode.getId() === bothLastNonStopNodes.lastNonStopNode1.getId()
        ? "targetToSource"
        : "sourceToTarget",
    );
    const cumulativeBackwardTravelTime = this.trainrunService.getCumulativeTravelTime(
      trainrunSection,
      lastRightNode.getId() === bothLastNonStopNodes.lastNonStopNode1.getId()
        ? "targetToSource"
        : "sourceToTarget",
    );

    return {
      leftDepartureTime: lastLeftNode.getDepartureTime(leftTrainrunSection),
      leftArrivalTime: lastLeftNode.getArrivalTime(leftTrainrunSection),
      rightDepartureTime: lastRightNode.getDepartureTime(rightTrainrunSection),
      rightArrivalTime: lastRightNode.getArrivalTime(rightTrainrunSection),
      travelTime: cumulativeTravelTime,
      bottomTravelTime: cumulativeBackwardTravelTime,
    };
  }

  getLeftAndRightSymmetries(trainrunSection: TrainrunSection, orderedNodes: Node[]) {
    const {leftSection, rightSection} = this.getLeftRightDirectedSectionProxies(
      trainrunSection,
      orderedNodes,
    );
    return {
      leftSymmetry: leftSection.getTailSymmetry(),
      rightSymmetry: rightSection.getHeadSymmetry(),
    };
  }

  getNextStopLeftNode(trainrunSection: TrainrunSection, orderedNodes: Node[]): Node {
    const bothLastNonStopNodes = this.trainrunService.getBothLastNonStopNodes(trainrunSection);
    const bothNodesFound =
      orderedNodes.find(
        (n: Node) => n.getId() === bothLastNonStopNodes.lastNonStopNode1.getId(),
      ) !== undefined &&
      orderedNodes.find(
        (n: Node) => n.getId() === bothLastNonStopNodes.lastNonStopNode2.getId(),
      ) !== undefined;
    let leftNode;
    if (!bothNodesFound) {
      leftNode = GeneralViewFunctions.getLeftOrTopNode(
        bothLastNonStopNodes.lastNonStopNode1,
        bothLastNonStopNodes.lastNonStopNode2,
      );
    } else {
      leftNode = GeneralViewFunctions.getLeftNodeAccordingToOrder(
        orderedNodes,
        bothLastNonStopNodes.lastNonStopNode1,
        bothLastNonStopNodes.lastNonStopNode2,
      );
    }
    return leftNode;
  }

  getNextStopRightNode(trainrunSection: TrainrunSection, orderedNodes: Node[]): Node {
    const bothLastNonStopNodes = this.trainrunService.getBothLastNonStopNodes(trainrunSection);
    const bothNodesFound =
      orderedNodes.find(
        (n: Node) => n.getId() === bothLastNonStopNodes.lastNonStopNode1.getId(),
      ) !== undefined &&
      orderedNodes.find(
        (n: Node) => n.getId() === bothLastNonStopNodes.lastNonStopNode2.getId(),
      ) !== undefined;
    let rightNode;
    if (!bothNodesFound) {
      rightNode = GeneralViewFunctions.getRightOrBottomNode(
        bothLastNonStopNodes.lastNonStopNode1,
        bothLastNonStopNodes.lastNonStopNode2,
      );
    } else {
      rightNode = GeneralViewFunctions.getRightNodeAccordingToOrder(
        orderedNodes,
        bothLastNonStopNodes.lastNonStopNode1,
        bothLastNonStopNodes.lastNonStopNode2,
      );
    }
    return rightNode;
  }

  static isTargetRightOrBottom(trainrunSection: TrainrunSection): boolean {
    const sourceNode = trainrunSection.getSourceNode();
    const targetNode = trainrunSection.getTargetNode();

    return GeneralViewFunctions.getRightOrBottomNode(sourceNode, targetNode) === targetNode;
  }

  static isChainTargetRightOrBottom(
    firstTrainrunSection: TrainrunSection,
    lastTrainrunSection: TrainrunSection,
  ): boolean {
    const sourceNode = firstTrainrunSection.getSourceNode();
    const targetNode = lastTrainrunSection.getTargetNode();

    return GeneralViewFunctions.getRightOrBottomNode(sourceNode, targetNode) === targetNode;
  }
}
