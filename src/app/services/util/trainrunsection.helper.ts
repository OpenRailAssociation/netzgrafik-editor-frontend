import {TrainrunSection} from "../../models/trainrunsection.model";
import {Node} from "../../models/node.model";
import {GeneralViewFunctions} from "../../view/util/generalViewFunctions";
import {
  LeftAndRightLockStructure,
  LeftAndRightTimeStructure,
} from "../../view/dialogs/trainrun-and-section-dialog/trainrunsection-tab/trainrun-section-tab.component";
import {PartialTimeStructure} from "../data/trainrunsection.service";
import {MathUtils} from "../../utils/math";
import {TrainrunSectionText} from "../../data-structures/technical.data.structures";
import {TrainrunService} from "../data/trainrun.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";

export enum LeftAndRightElement {
  LeftDeparture,
  LeftArrival,
  RightDeparture,
  RightArrival,
  TravelTime,
  BottomTravelTime,
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
      rightDepartureTime: timeStructure.rightDepartureTime,
      rightArrivalTime: timeStructure.rightArrivalTime,
      travelTime: 0,
      bottomTravelTime: 0,
    };
  }

  static getDistributedTravelTime(
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

  // TODO: remove this method
  static getRightArrivalTime(
    timeStructure: LeftAndRightTimeStructure,
    precision = TrainrunSectionService.TIME_PRECISION,
  ): number {
    return MathUtils.round(
      (timeStructure.leftDepartureTime + (timeStructure.travelTime % 60)) % 60,
      precision,
    );
  }

  static getLeftArrivalTime(
    timeStructure: LeftAndRightTimeStructure,
    precision = TrainrunSectionService.TIME_PRECISION,
  ): number {
    return MathUtils.round(
      (timeStructure.rightDepartureTime + (timeStructure.bottomTravelTime % 60)) % 60,
      precision,
    );
  }

  // TODO: remove this method
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

  getSourceLock(
    lockStructure: LeftAndRightLockStructure,
    trainrunSection: TrainrunSection,
  ): boolean {
    const sections = this.trainrunService.getNonStopSectionsChain(trainrunSection);
    if (trainrunSection.getSourceNodeId() === sections[0].getSourceNodeId()) {
      return lockStructure.leftLock;
    }
    if (trainrunSection.getSourceNodeId() === sections[sections.length - 1].getTargetNodeId()) {
      return lockStructure.rightLock;
    }
    return undefined;
  }

  getTargetLock(
    lockStructure: LeftAndRightLockStructure,
    trainrunSection: TrainrunSection,
  ): boolean {
    const sections = this.trainrunService.getNonStopSectionsChain(trainrunSection);
    if (trainrunSection.getTargetNodeId() === sections[0].getSourceNodeId()) {
      return lockStructure.leftLock;
    }
    if (trainrunSection.getTargetNodeId() === sections[sections.length - 1].getTargetNodeId()) {
      return lockStructure.rightLock;
    }
    return undefined;
  }

  getLeftAndRightLock(
    trainrunSection: TrainrunSection,
    orderedNodes: Node[],
  ): LeftAndRightLockStructure {
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
    const isNextStopNodeSource = sourceNodeid === nextStopLeftNode.getId();

    switch (trainrunSectionSelectedText) {
      case TrainrunSectionText.SourceDeparture:
        return isNextStopNodeSource
          ? LeftAndRightElement.LeftDeparture
          : LeftAndRightElement.RightDeparture;

      case TrainrunSectionText.SourceArrival:
        return isNextStopNodeSource
          ? LeftAndRightElement.LeftArrival
          : LeftAndRightElement.RightArrival;

      case TrainrunSectionText.TargetDeparture:
        return isNextStopNodeSource
          ? LeftAndRightElement.RightDeparture
          : LeftAndRightElement.LeftDeparture;

      case TrainrunSectionText.TargetArrival:
        return isNextStopNodeSource
          ? LeftAndRightElement.RightArrival
          : LeftAndRightElement.LeftArrival;

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

      case TrainrunSectionText.TrainrunSectionBackwardTravelTime:
        return LeftAndRightElement.BottomTravelTime;

      default:
        return undefined;
    }
  }

  // TODO: refacto
  getLeftAndRightTimes(
    trainrunSection: TrainrunSection,
    orderedNodes: Node[],
    onPerlenkette: boolean,
  ): LeftAndRightTimeStructure {
    const targetIsRightOrBottom = TrainrunsectionHelper.isTargetRightOrBottom(trainrunSection);

    // Perlenkette component strictly displays the trainrunSection times, no matter if the trainrun stops at its source/target nodes
    if (onPerlenkette) {
      if (targetIsRightOrBottom) {
        return {
          leftDepartureTime: trainrunSection.getSourceNode().getDepartureTime(trainrunSection),
          leftArrivalTime: trainrunSection.getSourceNode().getArrivalTime(trainrunSection),
          rightDepartureTime: trainrunSection.getTargetNode().getDepartureTime(trainrunSection),
          rightArrivalTime: trainrunSection.getTargetNode().getArrivalTime(trainrunSection),
          travelTime: trainrunSection.getTravelTime(),
          bottomTravelTime: trainrunSection.getBackwardTravelTime(),
        };
      } else {
        return {
          leftDepartureTime: trainrunSection.getTargetNode().getDepartureTime(trainrunSection),
          leftArrivalTime: trainrunSection.getTargetNode().getArrivalTime(trainrunSection),
          rightDepartureTime: trainrunSection.getSourceNode().getDepartureTime(trainrunSection),
          rightArrivalTime: trainrunSection.getSourceNode().getArrivalTime(trainrunSection),
          travelTime: trainrunSection.getBackwardTravelTime(),
          bottomTravelTime: trainrunSection.getTravelTime(),
        };
      }
    }

    // The other components display the times a the trainrunSections chain where first and last nodes are stops for this trainrun
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

    const travelTime = targetIsRightOrBottom
      ? this.trainrunService.getCumulativeTravelTime(trainrunSection)
      : this.trainrunService.getCumulativeBackwardTravelTime(trainrunSection);
    const bottomTravelTime = targetIsRightOrBottom
      ? this.trainrunService.getCumulativeBackwardTravelTime(trainrunSection)
      : this.trainrunService.getCumulativeTravelTime(trainrunSection);

    return {
      leftDepartureTime: lastLeftNode.getDepartureTime(leftTrainrunSection),
      leftArrivalTime: lastLeftNode.getArrivalTime(leftTrainrunSection),
      rightDepartureTime: lastRightNode.getDepartureTime(rightTrainrunSection),
      rightArrivalTime: lastRightNode.getArrivalTime(rightTrainrunSection),
      travelTime,
      bottomTravelTime,
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

  // TODO: refacto using getFirstNonStopTrainrunSection
  isLeftNextStopNodeSymmetric(trainrunSection: TrainrunSection, orderedNodes: Node[]): boolean {
    const leftNode = this.getNextStopLeftNode(trainrunSection, orderedNodes);

    // find the trainrunSection where this left node is bound
    const bothLastNonStopNodes = this.trainrunService.getBothLastNonStopNodes(trainrunSection);
    const bothLastNonStopTrainrunSections =
      this.trainrunService.getBothLastNonStopTrainrunSections(trainrunSection);
    const leftTrainrunSection =
      leftNode.getId() === bothLastNonStopNodes.lastNonStopNode1.getId()
        ? bothLastNonStopTrainrunSections.lastNonStopTrainrunSection1
        : bothLastNonStopTrainrunSections.lastNonStopTrainrunSection2;

    if (leftTrainrunSection.getSourceNodeId() === leftNode.getId()) {
      return leftTrainrunSection.getSourceSymmetry();
    } else if (leftTrainrunSection.getTargetNodeId() === leftNode.getId()) {
      return leftTrainrunSection.getTargetSymmetry();
    } else {
      throw new Error("Left node is neither source nor target of its trainrun section.");
    }
  }

  // TODO: refacto using getFirstNonStopTrainrunSection
  isRightNextStopNodeSymmetric(trainrunSection: TrainrunSection, orderedNodes: Node[]): boolean {
    const rightNode = this.getNextStopRightNode(trainrunSection, orderedNodes);

    // find the trainrun section where this right node is bound
    const bothLastNonStopNodes = this.trainrunService.getBothLastNonStopNodes(trainrunSection);
    const bothLastNonStopTrainrunSections =
      this.trainrunService.getBothLastNonStopTrainrunSections(trainrunSection);
    const rightTrainrunSection =
      rightNode.getId() === bothLastNonStopNodes.lastNonStopNode1.getId()
        ? bothLastNonStopTrainrunSections.lastNonStopTrainrunSection1
        : bothLastNonStopTrainrunSections.lastNonStopTrainrunSection2;

    if (rightTrainrunSection.getSourceNodeId() === rightNode.getId()) {
      return rightTrainrunSection.getSourceSymmetry();
    } else if (rightTrainrunSection.getTargetNodeId() === rightNode.getId()) {
      return rightTrainrunSection.getTargetSymmetry();
    } else {
      throw new Error("Right node is neither source nor target of its trainrun section.");
    }
  }

  isLeftToggleDisabled(
    trainrunSection: TrainrunSection,
    lockStructure: LeftAndRightLockStructure,
    orderedNodes?: Node[],
  ): boolean {
    let isLeftSymmetric, isRightSymmetric;
    if (orderedNodes) {
      // for sbb-trainrunsection-tab component
      isLeftSymmetric = this.isLeftNextStopNodeSymmetric(trainrunSection, orderedNodes);
      isRightSymmetric = this.isRightNextStopNodeSymmetric(trainrunSection, orderedNodes);
    } else {
      // for sbb-perlenkette-section component
      isLeftSymmetric = TrainrunsectionHelper.isLeftNodeSymmetric(trainrunSection);
      isRightSymmetric = TrainrunsectionHelper.isRightNodeSymmetric(trainrunSection);
    }
    return (
      !isLeftSymmetric &&
      !trainrunSection.areTravelTimesEqual() &&
      ((lockStructure.travelTimeLock && lockStructure.rightLock) ||
        (isRightSymmetric && lockStructure.travelTimeLock))
    );
  }

  isRightToggleDisabled(
    trainrunSection: TrainrunSection,
    lockStructure: LeftAndRightLockStructure,
    orderedNodes?: Node[],
  ): boolean {
    let isLeftSymmetric, isRightSymmetric;
    if (orderedNodes) {
      // for sbb-trainrunsection-tab component
      isLeftSymmetric = this.isLeftNextStopNodeSymmetric(trainrunSection, orderedNodes);
      isRightSymmetric = this.isRightNextStopNodeSymmetric(trainrunSection, orderedNodes);
    } else {
      // for sbb-perlenkette-section component
      isLeftSymmetric = TrainrunsectionHelper.isLeftNodeSymmetric(trainrunSection);
      isRightSymmetric = TrainrunsectionHelper.isRightNodeSymmetric(trainrunSection);
    }
    return (
      !isRightSymmetric &&
      !trainrunSection.areTravelTimesEqual() &&
      ((lockStructure.travelTimeLock && lockStructure.leftLock) ||
        (isLeftSymmetric && lockStructure.travelTimeLock))
    );
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

  static isLeftSideDisplayed(trainrunSection: TrainrunSection): boolean {
    return (
      trainrunSection.getTrainrun().isRoundTrip() ||
      !TrainrunsectionHelper.isTargetRightOrBottom(trainrunSection)
    );
  }

  static isRightSideDisplayed(trainrunSection: TrainrunSection): boolean {
    return (
      trainrunSection.getTrainrun().isRoundTrip() ||
      TrainrunsectionHelper.isTargetRightOrBottom(trainrunSection)
    );
  }

  static getAdjustedTimeBasedOnSymmetry(
    isSymmetricOnNode: boolean,
    defaultTime: number,
    symmetricTime: number,
  ): number {
    if (isSymmetricOnNode) {
      return TrainrunsectionHelper.getSymmetricTime(symmetricTime);
    }
    return defaultTime;
  }

  static isLeftNodeSymmetric(trainrunSection: TrainrunSection): boolean {
    if (TrainrunsectionHelper.isTargetRightOrBottom(trainrunSection)) {
      return trainrunSection.getSourceSymmetry();
    } else {
      return trainrunSection.getTargetSymmetry();
    }
  }

  static isRightNodeSymmetric(trainrunSection: TrainrunSection): boolean {
    if (TrainrunsectionHelper.isTargetRightOrBottom(trainrunSection)) {
      return trainrunSection.getTargetSymmetry();
    } else {
      return trainrunSection.getSourceSymmetry();
    }
  }
}
