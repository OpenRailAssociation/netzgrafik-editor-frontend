import {DirectedTrainrunSectionProxy} from "./trainrun.iterator";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Node} from "../../models/node.model";
import {GeneralViewFunctions} from "../../view/util/generalViewFunctions";
import {MathUtils} from "../../utils/math";
import {TrainrunSectionText} from "../../data-structures/technical.data.structures";
import {TrainrunService} from "../data/trainrun.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
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
  BottomTravelTime,
  LeftRightTrainrunName,
  RightLeftTrainrunName,
}

export class TrainrunsectionHelper {
  constructor(
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
  ) {}

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
      numberOfStops: 0,
      stopTime: 0,
      bottomStopTime: 0,
    };
  }

  static getLastSectionTravelTime(
    totalTravelTime: number,
    summedTravelTime: number,
    precision = TrainrunSectionService.TIME_PRECISION,
  ): number {
    return MathUtils.round(totalTravelTime - summedTravelTime, precision);
  }

  static getSectionDistributedTravelTime(
    trsTravelTime: number,
    travelTimeFactor: number,
    precision = TrainrunSectionService.TIME_PRECISION,
  ): number {
    return MathUtils.round(trsTravelTime * travelTimeFactor, precision);
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

  getLeftBetriebspunkt(trainrunSection: TrainrunSection, orderedNodes: Node[]): string[] {
    const nextStopLeftNode = this.getAdjacentLeftNode(trainrunSection, orderedNodes);
    return [nextStopLeftNode.getBetriebspunktName(), "(" + nextStopLeftNode.getFullName() + ")"];
  }

  getRightBetriebspunkt(trainrunSection: TrainrunSection, orderedNodes: Node[]): string[] {
    const nextStopRightNode = this.getAdjacentRightNode(trainrunSection, orderedNodes);
    return [nextStopRightNode.getBetriebspunktName(), "(" + nextStopRightNode.getFullName() + ")"];
  }

  getLeftRightSections(trainrunSection: TrainrunSection) {
    const adjacentExpandedStopPairs =
      this.trainrunService.getAdjacentExpandedStopPairs(trainrunSection);

    const startForwardBackwardNode = GeneralViewFunctions.getStartForwardAndBackwardNode(
      adjacentExpandedStopPairs.sourcePair.node,
      adjacentExpandedStopPairs.targetPair.node,
    );
    const lastLeftNode = startForwardBackwardNode.startForwardNode;
    const lastRightNode = startForwardBackwardNode.startBackwardNode;

    const towardsSource = adjacentExpandedStopPairs.sourcePair.trainrunSection;
    const towradsTarget = adjacentExpandedStopPairs.targetPair.trainrunSection;

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
  ): boolean | undefined {
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
  ): boolean | undefined {
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
    // TODO: update this function to use the new getLeftRightDirectedSectionProxies function
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

    const lastLeftNode = this.getAdjacentLeftNode(trainrunSection, orderedNodes);
    const lastRightNode = this.getAdjacentRightNode(trainrunSection, orderedNodes);

    const adjacentExpandedStopPairs =
      this.trainrunService.getAdjacentExpandedStopPairs(trainrunSection);
    const towardsSource = adjacentExpandedStopPairs.sourcePair.trainrunSection;
    const towradsTarget = adjacentExpandedStopPairs.targetPair.trainrunSection;
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
    const adjacentLeftNode = this.getAdjacentLeftNode(trainrunSection, orderedNodes);
    const sourceNodeid = trainrunSection.getSourceNode().getId();
    const targetNodeid = trainrunSection.getTargetNode().getId();

    switch (trainrunSectionSelectedText) {
      case TrainrunSectionText.SourceDeparture:
        return sourceNodeid === adjacentLeftNode.getId()
          ? LeftAndRightElement.LeftDeparture
          : LeftAndRightElement.RightDeparture;

      case TrainrunSectionText.SourceArrival:
        return sourceNodeid === adjacentLeftNode.getId()
          ? LeftAndRightElement.LeftArrival
          : LeftAndRightElement.RightArrival;

      case TrainrunSectionText.TargetDeparture:
        return targetNodeid === adjacentLeftNode.getId()
          ? LeftAndRightElement.LeftDeparture
          : LeftAndRightElement.RightDeparture;

      case TrainrunSectionText.TargetArrival:
        return targetNodeid === adjacentLeftNode.getId()
          ? LeftAndRightElement.LeftArrival
          : LeftAndRightElement.RightArrival;

      case TrainrunSectionText.TrainrunSectionName:
        if (forward === undefined) {
          return adjacentLeftNode.getId()
            ? LeftAndRightElement.LeftRightTrainrunName
            : LeftAndRightElement.RightLeftTrainrunName;
        }
        return sourceNodeid === adjacentLeftNode.getId()
          ? forward
            ? LeftAndRightElement.LeftRightTrainrunName
            : LeftAndRightElement.RightLeftTrainrunName
          : forward
            ? LeftAndRightElement.RightLeftTrainrunName
            : LeftAndRightElement.LeftRightTrainrunName;

      case TrainrunSectionText.TrainrunSectionTravelTime:
        return sourceNodeid === adjacentLeftNode.getId() || trainrunSection.areTravelTimesEqual()
          ? LeftAndRightElement.TravelTime
          : LeftAndRightElement.BottomTravelTime;

      case TrainrunSectionText.TrainrunSectionBackwardTravelTime:
        return targetNodeid === adjacentLeftNode.getId() || trainrunSection.areTravelTimesEqual()
          ? LeftAndRightElement.TravelTime
          : LeftAndRightElement.BottomTravelTime;
    }
    return undefined;
  }

  getLeftAndRightTimes(
    trainrunSection: TrainrunSection,
    orderedNodes: Node[],
  ): LeftAndRightTimeStructure {
    // Differentiate between the callers:
    // - if orderedNodes is empty, the caller is the trainrun section tab, and we need to get the **adjacent expanded stop pairs**
    // - else orderedNodes is not empty, the caller is the perlenkette, and we need to get the **adjacent expanded (stop or non-stop) pairs**
    const isTimeStructureStopToStop = orderedNodes.length === 0;
    const group = this.trainrunSectionService.getTrainrunSectionGroupForSection(
      trainrunSection,
      isTimeStructureStopToStop,
    );

    // TODO : instead get a left-to-right proxies chain()

    // Get the adjacent nodes for the trainrun section
    const adjacentPairs = isTimeStructureStopToStop
      ? this.trainrunService.getAdjacentExpandedStopPairs(trainrunSection)
      : this.trainrunService.getAdjacentExpandedPairs(trainrunSection);
    const adjacentSourceNodeId = adjacentPairs.sourcePair.node.getId();
    const adjacentLeftNode = this.getAdjacentLeftNode(trainrunSection, orderedNodes);
    const adjacentRightNode = this.getAdjacentRightNode(trainrunSection, orderedNodes);

    // Get the adjacent trainrun sections for the left and right nodes:
    // - if the nodes are different, we can directly get the trainrun sections from the adjacent pairs
    // - if the nodes are equal, we need to determine the left and right section based on the order of the nodes
    const isAdjacentLeftNodeSource = adjacentLeftNode.getId() === adjacentSourceNodeId;
    const areNodesDifferent = adjacentLeftNode.getId() !== adjacentRightNode.getId();
    const adjacentLeftTrainrunSection = areNodesDifferent
      ? isAdjacentLeftNodeSource
        ? adjacentPairs.sourcePair.trainrunSection
        : adjacentPairs.targetPair.trainrunSection
      : this.trainrunService.getFirstNonStopTrainrunSection(trainrunSection);
    const adjacentRightTrainrunSection = areNodesDifferent
      ? isAdjacentLeftNodeSource
        ? adjacentPairs.targetPair.trainrunSection
        : adjacentPairs.sourcePair.trainrunSection
      : this.trainrunService.getAdjacentExpandedStopPairs(trainrunSection).sourcePair
          .trainrunSection;

    // Calculate the times of the time structure
    // - departure and arrival times
    const leftDepartureTime = adjacentLeftNode.getDepartureTime(adjacentLeftTrainrunSection);
    const leftArrivalTime = adjacentLeftNode.getArrivalTime(adjacentLeftTrainrunSection);
    const rightDepartureTime = adjacentRightNode.getDepartureTime(adjacentRightTrainrunSection);
    const rightArrivalTime = adjacentRightNode.getArrivalTime(adjacentRightTrainrunSection);

    // - travel time and bottom travel time
    const isTargetRightOrBottom = TrainrunsectionHelper.isTargetRightOrBottom(trainrunSection);
    const travelTime = isTargetRightOrBottom
      ? TrainrunsectionHelper.getTravelTimeForSectionGroup(group)
      : TrainrunsectionHelper.getBackwardTravelTimeForSectionGroup(group);
    const bottomTravelTime = isTargetRightOrBottom
      ? TrainrunsectionHelper.getBackwardTravelTimeForSectionGroup(group)
      : TrainrunsectionHelper.getTravelTimeForSectionGroup(group);

    // - number of stops, stop time and bottom stop time
    const numberOfStops = TrainrunsectionHelper.getStopSectionsFromGroup(group).length;
    const totalDuration =
      adjacentRightNode.getArrivalTime(adjacentRightTrainrunSection) -
      adjacentLeftNode.getDepartureTime(adjacentLeftTrainrunSection);
    const totalBottomDuration =
      adjacentLeftNode.getArrivalTime(adjacentLeftTrainrunSection) -
      adjacentRightNode.getDepartureTime(adjacentRightTrainrunSection);
    const cumulativeTravelTime = this.trainrunService.getCumulativeTravelTime(
      trainrunSection,
      isAdjacentLeftNodeSource ? "targetToSource" : "sourceToTarget",
    );
    const cumulativeBottomTravelTime = this.trainrunService.getCumulativeTravelTime(
      trainrunSection,
      isAdjacentLeftNodeSource ? "sourceToTarget" : "targetToSource",
    );
    const stopTime = MathUtils.mod60(totalDuration - cumulativeTravelTime);
    const bottomStopTime = MathUtils.mod60(totalBottomDuration - cumulativeBottomTravelTime);

    return {
      leftDepartureTime,
      leftArrivalTime,
      rightDepartureTime,
      rightArrivalTime,
      travelTime,
      bottomTravelTime,
      numberOfStops,
      stopTime,
      bottomStopTime,
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

  getAdjacentLeftNode(trainrunSection: TrainrunSection, orderedNodes: Node[]): Node {
    // Differentiate between the callers:
    // - if orderedNodes is empty, the caller is the trainrun section tab, and we need to get the adjacent expanded stop pairs
    // - else orderedNodes is not empty, the caller is the perlenkette, and we need to get the adjacent expanded (stop or non-stop) pairs
    const adjacentPairs =
      orderedNodes.length === 0
        ? this.trainrunService.getAdjacentExpandedStopPairs(trainrunSection)
        : this.trainrunService.getAdjacentExpandedPairs(trainrunSection);

    if (orderedNodes.length === 0) {
      return GeneralViewFunctions.getLeftOrTopNode(
        adjacentPairs.sourcePair.node,
        adjacentPairs.targetPair.node,
      );
    }
    return GeneralViewFunctions.getLeftNodeAccordingToOrder(
      orderedNodes,
      adjacentPairs.sourcePair.node,
      adjacentPairs.targetPair.node,
    )!;
  }

  getAdjacentRightNode(trainrunSection: TrainrunSection, orderedNodes: Node[]): Node {
    // Differentiate between the callers:
    // - if orderedNodes is empty, the caller is the trainrun section tab, and we need to get the adjacent expanded stop pairs
    // - else orderedNodes is not empty, the caller is the perlenkette, and we need to get the adjacent expanded (stop or non-stop) pairs
    const adjacentPairs =
      orderedNodes.length === 0
        ? this.trainrunService.getAdjacentExpandedStopPairs(trainrunSection)
        : this.trainrunService.getAdjacentExpandedPairs(trainrunSection);

    if (orderedNodes.length === 0) {
      return GeneralViewFunctions.getRightOrBottomNode(
        adjacentPairs.sourcePair.node,
        adjacentPairs.targetPair.node,
      );
    }
    return GeneralViewFunctions.getRightNodeAccordingToOrder(
      orderedNodes,
      adjacentPairs.sourcePair.node,
      adjacentPairs.targetPair.node,
    )!;
  }

  static isTargetRightOrBottom(trainrunSection: TrainrunSection): boolean {
    const sourceNode = trainrunSection.getSourceNode();
    const targetNode = trainrunSection.getTargetNode();

    return GeneralViewFunctions.getRightOrBottomNode(sourceNode, targetNode) === targetNode;
  }

  static getStopSectionsFromGroup(trainrunSections: TrainrunSection[]): TrainrunSection[] {
    // Count non-stop collapsed source nodes
    // Note: in this context, all intermediate sections are collapsed
    return trainrunSections
      .slice(1) // skip first section
      .filter((section) => !section.getSourceNode().isNonStop(section));
  }

  static getTravelTimeForSectionGroup(trainrunSections: TrainrunSection[]): number {
    if (trainrunSections.length === 1) {
      return trainrunSections[0].getTravelTime();
    }

    return trainrunSections.reduce((sum, section, index) => {
      let sectionTime = section.getTravelTime();

      // Add stop time at intermediate nodes (all except the last section)
      if (index < trainrunSections.length - 1) {
        const nextSection = trainrunSections[index + 1];
        const stopTime = Math.abs(
          nextSection.getSourceDepartureConsecutiveTime() -
            section.getTargetArrivalConsecutiveTime(),
        );
        sectionTime += stopTime;
      }

      return sum + sectionTime;
    }, 0);
  }

  static getBackwardTravelTimeForSectionGroup(trainrunSections: TrainrunSection[]): number {
    if (trainrunSections.length === 1) {
      return trainrunSections[0].getBackwardTravelTime();
    }

    return trainrunSections.reduce((sum, section, index) => {
      let sectionTime = section.getBackwardTravelTime();

      // Add stop time at intermediate nodes (all except the last section)
      if (index < trainrunSections.length - 1) {
        const nextSection = trainrunSections[index + 1];
        const stopTime = Math.abs(
          section.getTargetDepartureConsecutiveTime() -
            nextSection.getSourceArrivalConsecutiveTime(),
        );
        sectionTime += stopTime;
      }

      return sum + sectionTime;
    }, 0);
  }
}
