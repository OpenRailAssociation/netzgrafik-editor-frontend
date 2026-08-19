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

  getLeftRightDirectedSectionProxies(
    trainrunSection: TrainrunSection,
    orderedNodes: Node[],
  ): {
    leftSection: DirectedTrainrunSectionProxy;
    rightSection: DirectedTrainrunSectionProxy;
  } {
    const direction = this.getDirection(trainrunSection, orderedNodes);
    const proxies = this.getDirectedTrainrunSectionProxiesGroup(
      trainrunSection,
      direction,
      orderedNodes.length === 0,
    );
    return {
      leftSection: proxies[0],
      rightSection: proxies.at(-1)!,
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
    const direction = this.getDirection(trainrunSection, orderedNodes);
    const proxies = this.getDirectedTrainrunSectionProxiesGroup(
      trainrunSection,
      direction,
      orderedNodes.length === 0,
    );
    const first = proxies[0];
    const last = proxies.at(-1)!;
    return {
      leftLock: first.getTailArrivalLock() || first.getTailDepartureLock(),
      rightLock: last.getHeadArrivalLock() || last.getHeadDepartureLock(),
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

  getLeftAndRightTimes(
    trainrunSection: TrainrunSection,
    orderedNodes: Node[],
  ): LeftAndRightTimeStructure {
    const direction = this.getDirection(trainrunSection, orderedNodes);
    const proxies = this.getDirectedTrainrunSectionProxiesGroup(
      trainrunSection,
      direction,
      orderedNodes.length === 0,
    );
    const first = proxies[0];
    const last = proxies.at(-1)!;

    const travelTime = this.getTravelTimeForProxiesGroup(proxies);
    const reverseTravelTime = this.getReverseTravelTimeForProxiesGroup(proxies);
    const totalDuration = last.getHeadArrivalConsecutive() - first.getTailDepartureConsecutive();
    const totalReverseDuration =
      first.getTailArrivalConsecutive() - last.getHeadDepartureConsecutive();

    return {
      leftDepartureTime: first.getTailDeparture(),
      leftArrivalTime: first.getTailArrival(),
      rightDepartureTime: last.getHeadDeparture(),
      rightArrivalTime: last.getHeadArrival(),
      travelTime,
      bottomTravelTime: reverseTravelTime,
      numberOfStops: this.getStopSectionsFromProxiesGroup(proxies).length,
      stopTime: totalDuration - travelTime,
      bottomStopTime: totalReverseDuration - reverseTravelTime,
    };
  }

  getLeftAndRightSymmetries(trainrunSection: TrainrunSection, orderedNodes: Node[]) {
    const direction = this.getDirection(trainrunSection, orderedNodes);
    const proxies = this.getDirectedTrainrunSectionProxiesGroup(
      trainrunSection,
      direction,
      orderedNodes.length === 0,
    );
    const first = proxies[0];
    const last = proxies.at(-1)!;
    return {
      leftSymmetry: first.getTailSymmetry(),
      rightSymmetry: last.getHeadSymmetry(),
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

  static getStopSectionsFromGroup(trainrunSections: TrainrunSection[]): TrainrunSection[] {
    // Count non-stop collapsed source nodes
    // Note: in this context, all intermediate sections are collapsed
    return trainrunSections
      .slice(1) // skip first section
      .filter((section) => !section.getSourceNode().isNonStop(section));
  }

  private getStopSectionsFromProxiesGroup(
    proxies: DirectedTrainrunSectionProxy[],
  ): DirectedTrainrunSectionProxy[] {
    // Count non-stop collapsed tail nodes
    // Note: in this context, all intermediate sections are collapsed
    return proxies
      .slice(1) // skip first
      .filter((proxy) => !proxy.getTailNode().isNonStop(proxy.trainrunSection));
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

  private getTravelTimeForProxiesGroup(
    proxies: DirectedTrainrunSectionProxy[],
    includeStopTime: boolean = false,
  ): number {
    if (proxies.length === 1) return proxies[0].getTravelTime();

    return proxies.reduce((sum, proxy, index) => {
      let proxyTime = proxy.getTravelTime();

      // Add stop time at intermediate nodes (all except the last proxy)
      if (includeStopTime && index < proxies.length - 1) {
        const nextProxy = proxies[index + 1];
        const stopTime = Math.abs(
          nextProxy.getTailDepartureConsecutive() - proxy.getHeadArrivalConsecutive(),
        );
        proxyTime += stopTime;
      }

      return sum + proxyTime;
    }, 0);
  }

  private getReverseTravelTimeForProxiesGroup(
    proxies: DirectedTrainrunSectionProxy[],
    includeStopTime: boolean = false,
  ): number {
    if (proxies.length === 1) return proxies[0].getReverseTravelTime();

    return proxies.reduce((sum, proxy, index) => {
      let proxyTime = proxy.getReverseTravelTime();

      // Add stop time at intermediate nodes (all except the last proxy)
      if (includeStopTime && index < proxies.length - 1) {
        const nextProxy = proxies[index + 1];
        const stopTime = Math.abs(
          proxy.getHeadDepartureConsecutive() - nextProxy.getTailArrivalConsecutive(),
        );
        proxyTime += stopTime;
      }

      return sum + proxyTime;
    }, 0);
  }

  private getDirection(trainrunSection: TrainrunSection, orderedNodes: Node[]) {
    let direction: "sourceToTarget" | "targetToSource";
    if (orderedNodes.length > 0) {
      direction =
        orderedNodes[0].getId() === trainrunSection.getSourceNode().getId()
          ? "sourceToTarget"
          : "targetToSource";
    } else {
      const lastLeftNode = this.getNextStopLeftNode(trainrunSection, orderedNodes);
      const bothLastNonStopNodes = this.trainrunService.getBothLastNonStopNodes(trainrunSection);
      direction =
        lastLeftNode.getId() === bothLastNonStopNodes.lastNonStopNode1.getId()
          ? "targetToSource"
          : "sourceToTarget";
    }
    return direction;
  }

  private getDirectedTrainrunSectionProxiesGroup(
    trainrunSection: TrainrunSection,
    direction: "sourceToTarget" | "targetToSource",
    allowFirstAndLastToBeNonStop: boolean,
  ) {
    const group = this.trainrunSectionService.getTrainrunSectionGroupForSection(
      trainrunSection,
      allowFirstAndLastToBeNonStop,
    );
    return group.map((section) => new DirectedTrainrunSectionProxy(section, direction));
  }
}
