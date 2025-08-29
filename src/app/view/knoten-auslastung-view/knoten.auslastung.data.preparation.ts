import {Transition} from "../../models/transition.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Node} from "../../models/node.model";
import {ResourceService} from "../../services/data/resource.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {TrainrunService} from "../../services/data/trainrun.service";
import {Direction} from "src/app/data-structures/business.data.structures";

export class KnotenAuslastungDataPreparation {
  static MAX_NR_MINUTES = 60;
  static MAX_NR_TRACKS = 50;

  private nbrUsedOfTrackFound = -1;
  private nodeDatas = [];
  private resourceDatas = [];
  private matrix: number[][];

  constructor(
    private trainrunService: TrainrunService,
    private resourceService: ResourceService,
    private trainrunSectionService: TrainrunSectionService,
  ) {}

  static getTrainrunLabel(trainrunSection: TrainrunSection): string {
    let trainrunName = trainrunSection.getTrainrun().getCategoryShortName();
    trainrunName += trainrunSection.getTrainrun().getTitle();
    return trainrunName;
  }

  addExtremitySectionToMatrix(trainrunSection: TrainrunSection, node: Node, isTargetNode: boolean) {
    let directionLoops: number[] = [0, 1];
    if (!trainrunSection.getTrainrun().isRoundTrip()) {
      directionLoops = isTargetNode ? [0] : [1];
    }

    for (const directionLoop of directionLoops) {
      const haltezeit = node.getTrainrunCategoryHaltezeit();
      const delta = Math.floor(
        haltezeit[trainrunSection.getTrainrun().getTrainrunCategory().fachCategory].haltezeit,
      );
      let arrivalTime = isTargetNode
        ? trainrunSection.getTargetArrivalConsecutiveTime()
        : trainrunSection.getSourceArrivalConsecutiveTime();
      let targetNode = isTargetNode
        ? trainrunSection.getTargetNode()
        : trainrunSection.getSourceNode();
      if (directionLoop === 0) {
        arrivalTime =
          (isTargetNode
            ? trainrunSection.getTargetDepartureConsecutiveTime()
            : trainrunSection.getSourceDepartureConsecutiveTime()) -
          delta +
          60;
        targetNode = isTargetNode
          ? trainrunSection.getSourceNode()
          : trainrunSection.getTargetNode();
      }

      let freq = trainrunSection.getFrequency();
      if (freq === null) {
        freq = 60;
      }
      for (let freqLoop = 0; freqLoop < 60; freqLoop += freq) {
        const freqArrivalTime = Math.round(arrivalTime + freqLoop) % 60;
        const freqDeparturetime = Math.round(freqArrivalTime + delta);
        let freeIdx = 0;
        for (let uLoop = freqArrivalTime; uLoop <= freqDeparturetime; uLoop += 1) {
          while (freeIdx < KnotenAuslastungDataPreparation.MAX_NR_TRACKS - 1) {
            if (this.matrix[uLoop % 60][freeIdx] === undefined) {
              break;
            }
            freeIdx += 1;
          }
        }
        for (let uLoop = freqArrivalTime; uLoop <= freqDeparturetime; uLoop += 1) {
          this.matrix[uLoop % 60][freeIdx] = trainrunSection.getTrainrunId();
        }
        this.nbrUsedOfTrackFound = Math.max(this.nbrUsedOfTrackFound, freeIdx);
        this.nodeDatas.push({
          trainrunSection: trainrunSection,
          name: KnotenAuslastungDataPreparation.getTrainrunLabel(trainrunSection),
          tooltip: this.getTrainrunTooltip(trainrunSection, targetNode),
          color: freeIdx,
          startAngle: (freqArrivalTime / 60) * (2 * Math.PI),
          endAngle: (freqDeparturetime / 60) * (2 * Math.PI),
          innerRadius: freeIdx,
          outerRadius: freeIdx,
        });
      }
    }
  }

  getRealStopTime(
    trainrunSection1: TrainrunSection,
    trainrunSection2: TrainrunSection,
    node: Node,
  ): number {
    let stopTime = 0;
    if (trainrunSection1.getSourceNodeId() === node.getId()) {
      if (trainrunSection2.getSourceNodeId() === node.getId()) {
        stopTime =
          trainrunSection2.getSourceDepartureConsecutiveTime() -
          trainrunSection1.getSourceArrivalConsecutiveTime();
      } else {
        stopTime =
          trainrunSection2.getTargetDepartureConsecutiveTime() -
          trainrunSection1.getSourceArrivalConsecutiveTime();
      }
    } else {
      if (trainrunSection2.getSourceNodeId() === node.getId()) {
        stopTime =
          trainrunSection2.getSourceDepartureConsecutiveTime() -
          trainrunSection1.getTargetArrivalConsecutiveTime();
      } else {
        stopTime =
          trainrunSection2.getTargetDepartureConsecutiveTime() -
          trainrunSection1.getTargetArrivalConsecutiveTime();
      }
    }
    return Math.abs(stopTime);
  }

  computeAuslastungsMatrix(node: Node) {
    if (node === undefined) {
      return;
    }
    this.matrix = new Array(KnotenAuslastungDataPreparation.MAX_NR_MINUTES)
      .fill(undefined)
      .map(() => new Array(KnotenAuslastungDataPreparation.MAX_NR_TRACKS).fill(undefined));

    this.nbrUsedOfTrackFound = -1;
    this.nodeDatas = [];
    this.resourceDatas = [];

    const sortedTransitions = Object.assign([], node.getTransitions());
    sortedTransitions.sort((transition1: Transition, transition2: Transition) => {
      const trainrunSection11 = node.getPort(transition1.getPortId1()).getTrainrunSection();
      const trainrunSection12 = node.getPort(transition1.getPortId2()).getTrainrunSection();
      const trainrunSection21 = node.getPort(transition2.getPortId1()).getTrainrunSection();
      const trainrunSection22 = node.getPort(transition2.getPortId2()).getTrainrunSection();
      const delta1 = this.getRealStopTime(trainrunSection11, trainrunSection12, node);
      const delta2 = this.getRealStopTime(trainrunSection21, trainrunSection22, node);
      return delta2 - delta1; // sort in descending order
    });

    // Add trainrun sections that are connected to an intermediate node.
    sortedTransitions.forEach((transition: Transition) => {
      const isRoundTrip = transition.getTrainrun().isRoundTrip();
      const trainrunSection1 = node.getPort(transition.getPortId1()).getTrainrunSection();
      const trainrunSection2 = node.getPort(transition.getPortId2()).getTrainrunSection();

      const [tsFromNode, tsToNode] =
        trainrunSection1.getSourceNodeId() === node.getId()
          ? [trainrunSection1, trainrunSection2]
          : [trainrunSection2, trainrunSection1];

      const isTargetNode = tsToNode.getTargetNodeId() === node.getId();
      if (isRoundTrip || isTargetNode) {
        this.addSectionsAtTransitionToMatrix(tsToNode, tsFromNode, node.getId());
      }
      if (isRoundTrip || !isTargetNode) {
        this.addSectionsAtTransitionToMatrix(tsFromNode, tsToNode, node.getId());
      }
    });

    // Add trainrun sections that are connected to the 1st and the last nodes of the trainrun.
    this.trainrunSectionService.getTrainrunSections().forEach((ts: TrainrunSection) => {
      const isSourceNode = ts.getSourceNodeId() === node.getId();
      const isTargetNode = ts.getTargetNodeId() === node.getId();
      const isExtremitySection =
        (isSourceNode || isTargetNode) && node.getNextTrainrunSection(ts) === undefined;
      if (isExtremitySection) {
        this.addExtremitySectionToMatrix(ts, node, isTargetNode);
      }
    });

    for (let trackLoop = 0; trackLoop <= Math.max(this.nbrUsedOfTrackFound, 0); trackLoop += 1) {
      for (let timeLoop = 0; timeLoop < 60; timeLoop += 5) {
        this.resourceDatas.push({
          startAngle: ((timeLoop + 0.1) / 60) * 2 * Math.PI,
          endAngle: ((timeLoop + 4.9) / 60) * 2 * Math.PI,
          innerRadius: trackLoop,
          outerRadius: trackLoop,
          capacityLimitReached:
            trackLoop >= this.resourceService.getResource(node.getResourceId()).getCapacity(),
        });
      }
    }
  }

  getNrUsedTrackFound() {
    return this.nbrUsedOfTrackFound;
  }

  getNodesData() {
    return this.nodeDatas;
  }

  getResourcesData() {
    return this.resourceDatas;
  }

  private getTrainrunTooltip(trainrunSection: TrainrunSection, targetNode: Node): string {
    let trainrunName = trainrunSection.getTrainrun().getCategoryShortName();
    trainrunName += trainrunSection.getTrainrun().getTitle();
    const endNode1 = this.trainrunService.getEndNode(targetNode, trainrunSection);
    trainrunName += " &#x2192; " + endNode1.getBetriebspunktName();
    return trainrunName;
  }

  /** Computes occupancy data for trainrunsections that are connected to an intermediate nodes. */
  private addSectionsAtTransitionToMatrix(
    trainrunSection1: TrainrunSection,
    trainrunSection2: TrainrunSection,
    nodeId: number,
  ) {
    let targetNode = trainrunSection1.getSourceNode();
    let arrivalTime = trainrunSection1.getSourceArrivalConsecutiveTime();
    if (trainrunSection1.getSourceNode().getId() !== nodeId) {
      targetNode = trainrunSection1.getTargetNode();
      arrivalTime = trainrunSection1.getTargetArrivalConsecutiveTime();
    }
    let departureTime = trainrunSection2.getSourceDepartureConsecutiveTime();
    if (trainrunSection2.getSourceNode().getId() !== nodeId) {
      departureTime = trainrunSection2.getTargetDepartureConsecutiveTime();
    }

    const delta = Math.floor(departureTime - arrivalTime);

    let freq = trainrunSection1.getFrequency();
    if (freq === null) {
      freq = 60;
    }
    for (
      let freqLoop = 0;
      freqLoop < KnotenAuslastungDataPreparation.MAX_NR_MINUTES;
      freqLoop += freq
    ) {
      const freqArrivalTime = Math.round(arrivalTime + freqLoop) % 60;
      const freqDeparturetime = Math.round(freqArrivalTime + delta);

      let freeIdx = 0;
      for (let uLoop = freqArrivalTime; uLoop <= freqDeparturetime; uLoop += 1) {
        while (freeIdx < KnotenAuslastungDataPreparation.MAX_NR_TRACKS - 1) {
          if (this.matrix[uLoop % 60][freeIdx] === undefined) {
            break;
          }
          freeIdx += 1;
        }
      }
      for (let uLoop = freqArrivalTime; uLoop <= freqDeparturetime; uLoop += 1) {
        this.matrix[uLoop % 60][freeIdx] = trainrunSection1.getTrainrunId();
      }
      this.nbrUsedOfTrackFound = Math.max(this.nbrUsedOfTrackFound, freeIdx);
      this.nodeDatas.push({
        trainrunSection: trainrunSection1,
        name: KnotenAuslastungDataPreparation.getTrainrunLabel(trainrunSection1),
        tooltip: this.getTrainrunTooltip(trainrunSection1, targetNode),
        color: freeIdx,
        startAngle: (freqArrivalTime / 60) * (2 * Math.PI),
        endAngle: (freqDeparturetime / 60) * (2 * Math.PI),
        innerRadius: freeIdx,
        outerRadius: freeIdx,
      });
    }
  }
}
