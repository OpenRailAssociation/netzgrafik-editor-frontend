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
        return sourceNodeid === nextStopLeftNode.getId() || trainrunSection.areTravelTimesEqual()
          ? LeftAndRightElement.TravelTime
          : LeftAndRightElement.BottomTravelTime;

      case TrainrunSectionText.TrainrunSectionBackwardTravelTime:
        return targetNodeid === nextStopLeftNode.getId() || trainrunSection.areTravelTimesEqual()
          ? LeftAndRightElement.TravelTime
          : LeftAndRightElement.BottomTravelTime;
    }
    return undefined;
  }

  // pour trainrun section tab = group section [noeud expanded stop -> noeud expanded stop]
  // pour perlenkette = group sections [noeud expanded -> noeud expanded]
  getLeftAndRightTimes(
    trainrunSection: TrainrunSection,
    orderedNodes: Node[],
  ): LeftAndRightTimeStructure {
    // const group = this.trainrunSectionService.getTrainrunSectionsGroupOrientedBasedOnPort(
    //   leftTrainrunSection.getSourceNode().getPort(trainrunSection.getSourcePortId()),
    // );
    const group = this.trainrunSectionService.getTrainrunSectionGroupForSection(trainrunSection);

    const bothLastNonStopNodes = this.trainrunService.getBothLastNonStopNodes(trainrunSection);
    const bothLastNonStopTrainrunSections =
      this.trainrunService.getBothLastNonStopTrainrunSections(trainrunSection);
    const lastLeftNode = this.getNextStopLeftNode(trainrunSection, orderedNodes);
    const lastRightNode = this.getNextStopRightNode(trainrunSection, orderedNodes);

    let lastLeftTrainrunSection =
      lastLeftNode.getId() === bothLastNonStopNodes.lastNonStopNode1.getId()
        ? bothLastNonStopTrainrunSections.lastNonStopTrainrunSection1
        : bothLastNonStopTrainrunSections.lastNonStopTrainrunSection2;
    let lastRightTrainrunSection =
      lastRightNode.getId() === bothLastNonStopNodes.lastNonStopNode1.getId()
        ? bothLastNonStopTrainrunSections.lastNonStopTrainrunSection1
        : bothLastNonStopTrainrunSections.lastNonStopTrainrunSection2;

    if (lastLeftNode.getId() === lastRightNode.getId()) {
      // special case : when start and end node are equal and no non-stop node in between,
      // the last non-stop trainrun section is the same for both sides, so we need to determine
      // the left and right section based on the order of the nodes
      lastLeftTrainrunSection =
        this.trainrunService.getFirstNonStopTrainrunSection(trainrunSection);
      lastRightTrainrunSection = this.trainrunService.getLastNonStopTrainrunSection(
        lastLeftTrainrunSection.getSourceNode(),
        lastLeftTrainrunSection,
      );
    }

    const cumulativeTravelTime = this.trainrunService.getCumulativeTravelTime(
      trainrunSection,
      lastLeftNode.getId() === bothLastNonStopNodes.lastNonStopNode1.getId()
        ? "targetToSource"
        : "sourceToTarget",
    );
    const cumulativeBottomTravelTime = this.trainrunService.getCumulativeTravelTime(
      trainrunSection,
      lastRightNode.getId() === bothLastNonStopNodes.lastNonStopNode1.getId()
        ? "targetToSource"
        : "sourceToTarget",
    );

    const totalForwardDuration =
      lastRightNode.getArrivalTime(lastRightTrainrunSection) -
      lastLeftNode.getDepartureTime(lastLeftTrainrunSection);
    const totalBackwardDuration =
      lastLeftNode.getArrivalTime(lastLeftTrainrunSection) -
      lastRightNode.getDepartureTime(lastRightTrainrunSection);

    const isTargetRight =
      orderedNodes.length > 0
        ? group![0].getSourceNode().getId() === orderedNodes[0].getId()
        : true;
    const leftTrainrunSection = isTargetRight ? group![0] : group.at(-1);
    const rightTrainrunSection = isTargetRight ? group.at(-1) : group![0];

    const timeStructure = {
      leftDepartureTime: lastLeftNode.getDepartureTime(
        leftTrainrunSection ?? lastLeftTrainrunSection,
      ),
      leftArrivalTime: lastLeftNode.getArrivalTime(leftTrainrunSection ?? lastLeftTrainrunSection),
      rightDepartureTime: lastRightNode.getDepartureTime(
        rightTrainrunSection ?? lastRightTrainrunSection,
      ),
      rightArrivalTime: lastRightNode.getArrivalTime(
        rightTrainrunSection ?? lastRightTrainrunSection,
      ),
      // leftDepartureTime: group![0].getSourceNode().getDepartureTime(leftTrainrunSection),
      // leftArrivalTime: group![0].getSourceNode().getArrivalTime(leftTrainrunSection),
      // rightDepartureTime: group!.at(-1).getTargetNode().getDepartureTime(rightTrainrunSection),
      // rightArrivalTime: group!.at(-1).getTargetNode().getArrivalTime(rightTrainrunSection),
      travelTime: TrainrunsectionHelper.getTravelTimeForSectionGroup(group),
      bottomTravelTime: TrainrunsectionHelper.getBackwardTravelTimeForSectionGroup(group),
      numberOfStops: TrainrunsectionHelper.getStopSectionsFromGroup(group).length,
      stopTime: MathUtils.mod60(totalForwardDuration - cumulativeTravelTime),
      bottomStopTime: MathUtils.mod60(totalBackwardDuration - cumulativeBottomTravelTime),
    };
    console.log(timeStructure);
    return timeStructure;
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

    if (!bothNodesFound) {
      return GeneralViewFunctions.getLeftOrTopNode(
        bothLastNonStopNodes.lastNonStopNode1,
        bothLastNonStopNodes.lastNonStopNode2,
      );
    }

    return GeneralViewFunctions.getLeftNodeAccordingToOrder(
      orderedNodes,
      bothLastNonStopNodes.lastNonStopNode1,
      bothLastNonStopNodes.lastNonStopNode2,
    )!;
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

    if (!bothNodesFound) {
      return GeneralViewFunctions.getRightOrBottomNode(
        bothLastNonStopNodes.lastNonStopNode1,
        bothLastNonStopNodes.lastNonStopNode2,
      );
    }

    return GeneralViewFunctions.getRightNodeAccordingToOrder(
      orderedNodes,
      bothLastNonStopNodes.lastNonStopNode1,
      bothLastNonStopNodes.lastNonStopNode2,
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
