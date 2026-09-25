import {Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {Trainrun} from "../../models/trainrun.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Transition} from "../../models/transition.model";
import {Direction} from "../../data-structures/business.data.structures";

interface SectionTrackEstimateInput {
  departureMinute: number;
  arrivalMinute: number;
  backward: boolean;
  frequencyMinutes: number;
  sectionHeadwayMinutes: number;
}

type TrainrunSectionDirection = "forward" | "backward";

interface NodeTrackTrainrunOccurrence {
  node: Node;
  trainrun: Trainrun;
  arrivalSection?: TrainrunSection;
  arrivalDirection?: TrainrunSectionDirection;
  departureSection?: TrainrunSection;
  departureDirection?: TrainrunSectionDirection;
  transition?: Transition;
  separateByDirection?: boolean;
  unrollOnlyEvenFrequencyOffsets?: number;
  maxUnrollOnlyEvenFrequencyOffsets?: number;
  occurrenceIndex: number;
}

interface NodeTrackEstimatorOptions {
  windowMinutes?: number;
  separateForwardBackwardTracks?: boolean;
}

interface NodeTrackOccupancy {
  arrivalMinute: number;
  departureMinute: number;
  headwayUntilMinute: number;
  trainrunId: number;
  transitionId?: number;
  direction: Direction;
  travelDirection?: TrainrunSectionDirection;
  separateByDirection: boolean;
  occurrenceIndex: number;
}

interface NodeTrackEstimate {
  track: number;
  occupancies: NodeTrackOccupancy[];
}

@Injectable({providedIn: "root"})
export class InfrastructureEstimatorService {
  static readonly DEFAULT_DISTANCE_RESOLUTION = 15;
  static readonly DEFAULT_TIME_RESOLUTION = 15;
  static readonly DEFAULT_MINIMUM_HEADWAY_TIME = 0;

  estimateSectionTracks(
    fromNode: Node,
    toNode: Node,
    trainrunSections: TrainrunSection[],
    minHeadwayTime = InfrastructureEstimatorService.DEFAULT_MINIMUM_HEADWAY_TIME,
  ): [number, number, number][] {
    const matchingSections = this.findMatchingSections(fromNode, toNode, trainrunSections);
    if (matchingSections.length === 0) {
      return [];
    }

    const sections = this.createDirectionalTrackInputs(
      fromNode,
      toNode,
      matchingSections,
      minHeadwayTime,
    );
    const maximumFrequencyMinutes = this.getMaximumFrequency(sections);
    const maximumTravelTimeMinutes = this.getMaximumTravelTime(sections);
    const maximumUnrollingWindowMinutes = Math.max(
      maximumFrequencyMinutes,
      maximumTravelTimeMinutes,
    );
    const maximumFrequencyOffsetWindowMinutes = this.getMaximumFrequencyOffsetWindow(
      sections,
      maximumUnrollingWindowMinutes,
    );
    if (maximumUnrollingWindowMinutes <= 0 || maximumFrequencyMinutes <= 0) {
      return [];
    }
    return this.estimateTrackSegments(
      sections,
      maximumFrequencyMinutes,
      maximumFrequencyOffsetWindowMinutes,
    );
  }

  estimateNodeTracks(
    node: Node,
    trainrunSections: TrainrunSection[],
    options: NodeTrackEstimatorOptions,
  ): NodeTrackEstimate[];
  estimateNodeTracks(
    occurrences: NodeTrackTrainrunOccurrence[],
    options: NodeTrackEstimatorOptions,
  ): NodeTrackEstimate[];
  estimateNodeTracks(
    nodeOrOccurrences: Node | NodeTrackTrainrunOccurrence[],
    sectionsOrOptions: TrainrunSection[] | NodeTrackEstimatorOptions,
    nodeOptions?: NodeTrackEstimatorOptions,
  ): NodeTrackEstimate[] {
    const occurrences = Array.isArray(nodeOrOccurrences)
      ? nodeOrOccurrences
      : this.createNodeTrackOccurrences(nodeOrOccurrences, sectionsOrOptions as TrainrunSection[]);
    const options = Array.isArray(nodeOrOccurrences)
      ? (sectionsOrOptions as NodeTrackEstimatorOptions)
      : nodeOptions;
    const windowMinutes = options.windowMinutes ?? this.getNodeTrackWindow(occurrences);
    if (windowMinutes <= 0) {
      return [];
    }

    const occupancies = occurrences.flatMap((occurrence) =>
      this.createNodeTrackOccupancies(occurrence, windowMinutes),
    );
    const separateForwardBackwardTracks = options.separateForwardBackwardTracks ?? true;
    const tracks: Array<{
      direction?: TrainrunSectionDirection;
      occupancies: NodeTrackOccupancy[];
    }> = [];

    if (
      separateForwardBackwardTracks &&
      occupancies.some(
        (occupancy) => occupancy.separateByDirection && occupancy.travelDirection !== undefined,
      )
    ) {
      tracks.push({direction: "forward", occupancies: []});
      tracks.push({direction: "backward", occupancies: []});
    }

    const occupanciesByOccurrence = new Map<number, NodeTrackOccupancy[]>();
    occupancies.forEach((occupancy) => {
      const occurrenceOccupancies = occupanciesByOccurrence.get(occupancy.occurrenceIndex) ?? [];
      occurrenceOccupancies.push(occupancy);
      occupanciesByOccurrence.set(occupancy.occurrenceIndex, occurrenceOccupancies);
    });

    Array.from(occupanciesByOccurrence.values())
      .sort((a, b) => a[0].arrivalMinute - b[0].arrivalMinute)
      .forEach((occurrenceOccupancies) => {
        const occupancy = occurrenceOccupancies[0];
        const trackIndex = tracks.findIndex((track) => {
          if (
            separateForwardBackwardTracks &&
            occupancy.separateByDirection &&
            occupancy.travelDirection !== undefined &&
            track.direction !== undefined &&
            track.direction !== occupancy.travelDirection
          ) {
            return false;
          }
          return occurrenceOccupancies.every((candidate) =>
            track.occupancies.every(
              (existing) =>
                candidate.headwayUntilMinute <= existing.arrivalMinute ||
                existing.headwayUntilMinute <= candidate.arrivalMinute,
            ),
          );
        });
        const targetTrack = trackIndex >= 0 ? tracks[trackIndex] : undefined;
        if (targetTrack !== undefined) {
          targetTrack.occupancies.push(...occurrenceOccupancies);
          return;
        }
        tracks.push({
          direction: separateForwardBackwardTracks && occupancy.separateByDirection
            ? occupancy.travelDirection
            : undefined,
          occupancies: occurrenceOccupancies,
        });
      });

    return tracks.map((track, index) => ({track: index + 1, occupancies: track.occupancies}));
  }

  private createNodeTrackOccurrences(
    node: Node,
    trainrunSections: TrainrunSection[],
  ): NodeTrackTrainrunOccurrence[] {
    const sectionsByTrainrun = new Map<number, TrainrunSection[]>();
    trainrunSections.forEach((section) => {
      if (section.getSourceNodeId() !== node.getId() && section.getTargetNodeId() !== node.getId()) {
        return;
      }
      const sections = sectionsByTrainrun.get(section.getTrainrunId()) ?? [];
      sections.push(section);
      sectionsByTrainrun.set(section.getTrainrunId(), sections);
    });

    return Array.from(sectionsByTrainrun.values()).map((sections, occurrenceIndex) => {
      const trainrun = sections[0].getTrainrun();
      const arrivalSection = sections.find((section) => section.getTargetNodeId() === node.getId());
      const departureSection = sections.find(
        (section) => section.getSourceNodeId() === node.getId(),
      );
      const isRoundTrip = trainrun.getDirection() === Direction.ROUND_TRIP;
      const effectiveArrivalSection = arrivalSection ?? (isRoundTrip ? departureSection : undefined);
      const effectiveDepartureSection = departureSection ?? (isRoundTrip ? arrivalSection : undefined);
      const arrivalDirection = arrivalSection
        ? this.getNodeSectionDirection(node, arrivalSection)
        : isRoundTrip
          ? this.getOppositeNodeSectionDirection(
              departureSection ? this.getNodeSectionDirection(node, departureSection) : undefined,
            )
          : undefined;
      const departureDirection = departureSection
        ? this.getNodeSectionDirection(node, departureSection)
        : isRoundTrip
          ? this.getOppositeNodeSectionDirection(
              arrivalSection ? this.getNodeSectionDirection(node, arrivalSection) : undefined,
            )
          : undefined;

      return {
        node,
        trainrun,
        arrivalSection: effectiveArrivalSection,
        arrivalDirection,
        departureSection: effectiveDepartureSection,
        departureDirection,
        transition: node.getTransition(
          effectiveDepartureSection?.getId() ?? effectiveArrivalSection?.getId(),
        ),
        separateByDirection:
          arrivalDirection !== undefined &&
          departureDirection !== undefined &&
          arrivalDirection === departureDirection,
        occurrenceIndex,
      };
    });
  }

  private getNodeSectionDirection(
    node: Node,
    section: TrainrunSection,
  ): TrainrunSectionDirection {
    return section.getSourceNodeId() === node.getId() ? "forward" : "backward";
  }

  private getOppositeNodeSectionDirection(
    direction: TrainrunSectionDirection | undefined,
  ): TrainrunSectionDirection | undefined {
    return direction === "forward" ? "backward" : direction === "backward" ? "forward" : undefined;
  }

  private getNodeTrackWindow(occurrences: NodeTrackTrainrunOccurrence[]): number {
    const period = occurrences.reduce((window, occurrence) => {
      const frequency = occurrence.trainrun.getFrequency();
      return frequency > 0 ? this.leastCommonMultiple(window, frequency) : window;
    }, 1);
    const maximumTime = occurrences.reduce((maximum, occurrence) => {
      const times = this.getNodeTrackTimes(occurrence);
      return Math.max(
        maximum,
        times?.arrivalMinute ?? 0,
        times?.departureMinute ?? 0,
        times?.headwayUntilMinute ?? 0,
      );
    }, 60);
    return maximumTime + period;
  }

  private leastCommonMultiple(first: number, second: number): number {
    return (first * second) / this.greatestCommonDivisor(first, second);
  }

  private greatestCommonDivisor(first: number, second: number): number {
    let left = Math.abs(first);
    let right = Math.abs(second);
    while (right !== 0) {
      const remainder = left % right;
      left = right;
      right = remainder;
    }
    return left || 1;
  }

  private createNodeTrackOccupancies(
    occurrence: NodeTrackTrainrunOccurrence,
    windowMinutes: number,
  ): NodeTrackOccupancy[] {
    const times = this.getNodeTrackTimes(occurrence);
    if (times === undefined) {
      return [];
    }

    const frequency = occurrence.trainrun.getFrequency();
    if (frequency <= 0) {
      return [];
    }

    const occupancies: NodeTrackOccupancy[] = [];
    const firstOffset = Math.floor(
      (-windowMinutes - times.headwayUntilMinute) / frequency,
    ) - 1;
    const lastOffset = Math.ceil(
      (2 * windowMinutes - times.arrivalMinute) / frequency,
    ) + 1;
    for (let offset = firstOffset; offset <= lastOffset; offset++) {
      if (!this.isNodeTrackOffsetAllowed(occurrence, offset)) {
        continue;
      }
      const arrivalMinute = times.arrivalMinute + offset * frequency;
      const headwayUntilMinute = times.headwayUntilMinute + offset * frequency;
      const clippedArrival = Math.max(0, arrivalMinute);
      const clippedHeadway = Math.min(windowMinutes, headwayUntilMinute);
      if (clippedArrival < windowMinutes && clippedHeadway > 0) {
        occupancies.push({
          arrivalMinute: clippedArrival,
          departureMinute: Math.min(windowMinutes, times.departureMinute + offset * frequency),
          headwayUntilMinute: clippedHeadway,
          trainrunId: occurrence.trainrun.getId(),
          transitionId: occurrence.transition?.getId(),
          direction: occurrence.trainrun.getDirection(),
          travelDirection: occurrence.separateByDirection === false
            ? undefined
            : occurrence.departureDirection ?? occurrence.arrivalDirection,
          separateByDirection: occurrence.separateByDirection !== false,
          occurrenceIndex: occurrence.occurrenceIndex,
        });
      }
    }
    return occupancies;
  }

  private isNodeTrackOffsetAllowed(
    occurrence: NodeTrackTrainrunOccurrence,
    offset: number,
  ): boolean {
    const maximumOffset = occurrence.maxUnrollOnlyEvenFrequencyOffsets ?? 0;
    if (maximumOffset < 1) {
      return true;
    }
    const normalizedOffset =
      (offset + Math.abs(Math.floor(Math.min(0, offset) / 24) * 24)) %
      (maximumOffset + 1);
    return normalizedOffset === (occurrence.unrollOnlyEvenFrequencyOffsets ?? 0);
  }

  private getNodeTrackTimes(occurrence: NodeTrackTrainrunOccurrence):
    | {
        arrivalMinute: number;
        departureMinute: number;
        headwayUntilMinute: number;
      }
    | undefined {
    const arrivalMinute = this.getNodeArrivalTime(
      occurrence.node,
      occurrence.arrivalSection,
      occurrence.arrivalDirection,
    );
    const departureMinute = this.getNodeDepartureTime(
      occurrence.node,
      occurrence.departureSection,
      occurrence.departureDirection,
    );
    const haltezeit = this.getNodeHaltezeit(occurrence.node, occurrence.trainrun);
    const category = occurrence.trainrun.getTrainrunCategory();

    if (occurrence.trainrun.getDirection() === Direction.ONE_WAY) {
      const startTime = departureMinute ?? (arrivalMinute === undefined ? undefined : arrivalMinute);
      const endTime = arrivalMinute ?? (departureMinute === undefined ? undefined : departureMinute);
      if (startTime === undefined || endTime === undefined) {
        return undefined;
      }
      const isStart = occurrence.arrivalSection === undefined;
      const isEnd = occurrence.departureSection === undefined;
      return {
        arrivalMinute: isStart ? startTime - haltezeit : endTime,
        departureMinute: isEnd ? endTime + haltezeit : startTime,
        headwayUntilMinute: isEnd ? endTime + haltezeit : startTime,
      };
    }

    if (arrivalMinute === undefined || departureMinute === undefined) {
      return undefined;
    }
    const frequency = occurrence.trainrun.getFrequency();
    let consecutiveDepartureMinute =
      frequency > 0
        ? departureMinute +
          Math.ceil(Math.max(0, arrivalMinute - departureMinute) / frequency) * frequency
        : departureMinute;
    const nodeHeadway = this.getNodeHeadway(occurrence, category);
    const turnaroundTime = consecutiveDepartureMinute - arrivalMinute;
    if (
      frequency > 0 &&
      turnaroundTime > 0 &&
      turnaroundTime < category.minimalTurnaroundTime
    ) {
      consecutiveDepartureMinute += frequency;
    }
    return {
      arrivalMinute,
      departureMinute: consecutiveDepartureMinute,
      headwayUntilMinute: Math.max(
        consecutiveDepartureMinute + nodeHeadway,
        arrivalMinute + category.minimalTurnaroundTime,
      ),
    };
  }

  private getNodeArrivalTime(
    node: Node,
    section: TrainrunSection | undefined,
    direction: TrainrunSectionDirection | undefined,
  ): number | undefined {
    if (section === undefined || direction === undefined) {
      return undefined;
    }
    if (direction === "forward" && section.getTargetNodeId() === node.getId()) {
      return section.getTargetArrivalConsecutiveTime();
    }
    if (direction === "backward" && section.getSourceNodeId() === node.getId()) {
      return section.getSourceArrivalConsecutiveTime();
    }
    return undefined;
  }

  private getNodeDepartureTime(
    node: Node,
    section: TrainrunSection | undefined,
    direction: TrainrunSectionDirection | undefined,
  ): number | undefined {
    if (section === undefined || direction === undefined) {
      return undefined;
    }
    if (direction === "forward" && section.getSourceNodeId() === node.getId()) {
      return section.getSourceDepartureConsecutiveTime();
    }
    if (direction === "backward" && section.getTargetNodeId() === node.getId()) {
      return section.getTargetDepartureConsecutiveTime();
    }
    return undefined;
  }

  private getNodeHaltezeit(node: Node, trainrun: Trainrun): number {
    const haltezeit = node
      .getTrainrunCategoryHaltezeit()
      [trainrun.getTrainrunCategory().fachCategory]?.haltezeit;
    return typeof haltezeit === "number" && Number.isFinite(haltezeit) ? Math.max(0, haltezeit) : 0;
  }

  private getNodeHeadway(
    occurrence: NodeTrackTrainrunOccurrence,
    category: Trainrun["trainrunCategory"],
  ): number {
    return occurrence.transition?.getIsNonStopTransit()
      ? category.nodeHeadwayNonStop
      : category.nodeHeadwayStop;
  }

  private findMatchingSections(
    fromNode: Node,
    toNode: Node,
    trainrunSections: TrainrunSection[],
  ): TrainrunSection[] {
    const fromNodeId = fromNode.getId();
    const toNodeId = toNode.getId();
    return Array.from(
      new Map(
        trainrunSections
          .filter(
            (section) =>
              (section.getSourceNodeId() === fromNodeId &&
                section.getTargetNodeId() === toNodeId) ||
              (section.getSourceNodeId() === toNodeId && section.getTargetNodeId() === fromNodeId),
          )
          .map((section) => [section.getId(), section] as const),
      ).values(),
    );
  }

  private getMaximumFrequency(sections: SectionTrackEstimateInput[]): number {
    return sections.reduce((maximum, section) => Math.max(maximum, section.frequencyMinutes), 0);
  }

  private getMaximumTravelTime(sections: SectionTrackEstimateInput[]): number {
    return sections.reduce(
      (maximum, section) =>
        Math.max(maximum, Math.round(section.arrivalMinute - section.departureMinute)),
      0,
    );
  }

  private getMaximumFrequencyOffsetWindow(
    sections: SectionTrackEstimateInput[],
    minimumWindowMinutes: number,
  ): number {
    return sections.reduce((maximum, section) => {
      if (section.frequencyMinutes <= 0) {
        return maximum;
      }
      const sectionWindow =
        Math.ceil(minimumWindowMinutes / section.frequencyMinutes) * section.frequencyMinutes;
      return Math.max(maximum, sectionWindow);
    }, minimumWindowMinutes);
  }

  private createDirectionalTrackInputs(
    fromNode: Node,
    toNode: Node,
    trainrunSections: TrainrunSection[],
    minHeadwayTime: number,
  ): SectionTrackEstimateInput[] {
    return trainrunSections.flatMap((section) => {
      const isForward =
        section.getSourceNodeId() === fromNode.getId() &&
        section.getTargetNodeId() === toNode.getId();
      const frequencyMinutes = section.getTrainrun().getFrequency();
      const categorySectionHeadway = section.getTrainrun().getTrainrunCategory()?.sectionHeadway;
      const sectionHeadwayMinutes =
        typeof categorySectionHeadway === "number" && Number.isFinite(categorySectionHeadway)
          ? Math.max(minHeadwayTime, categorySectionHeadway)
          : minHeadwayTime;
      const forward = this.createTrackInput(
        isForward
          ? section.getSourceDepartureConsecutiveTime()
          : section.getTargetDepartureConsecutiveTime(),
        isForward
          ? section.getTargetArrivalConsecutiveTime()
          : section.getSourceArrivalConsecutiveTime(),
        false,
        frequencyMinutes,
        sectionHeadwayMinutes,
      );
      const backward = this.createTrackInput(
        isForward
          ? section.getTargetDepartureConsecutiveTime()
          : section.getSourceDepartureConsecutiveTime(),
        isForward
          ? section.getSourceArrivalConsecutiveTime()
          : section.getTargetArrivalConsecutiveTime(),
        true,
        frequencyMinutes,
        sectionHeadwayMinutes,
      );
      if (section.getTrainrun().getDirection() === Direction.ONE_WAY) {
        return isForward ? [forward] : [backward];
      }
      return [forward, backward];
    });
  }

  private createTrackInput(
    departureMinute: number,
    arrivalMinute: number,
    backward: boolean,
    frequencyMinutes: number,
    sectionHeadwayMinutes: number,
  ): SectionTrackEstimateInput {
    return {
      departureMinute,
      arrivalMinute,
      backward,
      frequencyMinutes,
      sectionHeadwayMinutes,
    };
  }

  private estimateTrackSegments(
    sections: SectionTrackEstimateInput[],
    maximumFrequencyMinutes: number,
    maximumFrequencyOffsetWindowMinutes: number,
  ): [number, number, number][] {
    const distanceResolution = InfrastructureEstimatorService.DEFAULT_DISTANCE_RESOLUTION;
    const timeResolution = InfrastructureEstimatorService.DEFAULT_TIME_RESOLUTION;

    if (
      maximumFrequencyMinutes <= 0 ||
      maximumFrequencyOffsetWindowMinutes <= 0 ||
      distanceResolution <= 0 ||
      timeResolution <= 0
    ) {
      return [];
    }

    const maximumTravelTime = Math.max(this.getMaximumTravelTime(sections), 1);
    const distanceCells = distanceResolution * maximumTravelTime;
    const timeCells = timeResolution * 2 * maximumFrequencyOffsetWindowMinutes;
    const dataMatrix = Array.from({length: distanceCells}, () =>
      new Array<number>(timeCells).fill(0),
    );
    const tracksMatrix = new Array<number>(distanceCells).fill(0);

    sections.forEach((section) =>
      this.projectSectionIntoMatrices(
        section,
        distanceCells,
        timeCells,
        timeResolution,
        maximumFrequencyMinutes,
        maximumFrequencyOffsetWindowMinutes,
        dataMatrix,
        tracksMatrix,
      ),
    );

    return InfrastructureEstimatorService.mergeTracks(tracksMatrix, distanceCells);
  }

  private projectSectionIntoMatrices(
    section: SectionTrackEstimateInput,
    distanceCells: number,
    timeCells: number,
    timeResolution: number,
    maximumFrequencyMinutes: number,
    maximumFrequencyOffsetWindowMinutes: number,
    dataMatrix: number[][],
    tracksMatrix: number[],
  ): void {
    if (section.frequencyMinutes <= 0) {
      return;
    }

    const travelTime = section.arrivalMinute - section.departureMinute;
    for (let distanceCell = 0; distanceCell < distanceCells; distanceCell++) {
      for (
        let frequencyOffset =
          -Math.ceil(maximumFrequencyOffsetWindowMinutes / section.frequencyMinutes) *
          section.frequencyMinutes;
        frequencyOffset <=
        Math.ceil(maximumFrequencyOffsetWindowMinutes / section.frequencyMinutes) *
          section.frequencyMinutes;
        frequencyOffset += section.frequencyMinutes
      ) {
        for (
          let bandOffset = 0;
          bandOffset < timeResolution * section.sectionHeadwayMinutes;
          bandOffset++
        ) {
          const matrixDistanceCell = section.backward
            ? distanceCells - distanceCell - 1
            : distanceCell;
          let timeCell =
            (section.departureMinute % maximumFrequencyMinutes) +
            (travelTime * distanceCell) / (distanceCells - 0.5) +
            frequencyOffset;
          timeCell = bandOffset + Math.round(timeResolution * timeCell);

          if (timeCell >= 0 && timeCell < timeCells) {
            dataMatrix[matrixDistanceCell][timeCell]++;
            tracksMatrix[matrixDistanceCell] = Math.max(
              tracksMatrix[matrixDistanceCell],
              dataMatrix[matrixDistanceCell][timeCell],
            );
          }
        }
      }
    }
  }

  private static mergeTracks(
    tracksMatrix: number[],
    distanceCells: number,
  ): [number, number, number][] {
    if (distanceCells === 0) {
      return [];
    }

    const tracks: [number, number, number][] = [];
    let from = 0;
    for (let distanceCell = 0; distanceCell < distanceCells; distanceCell++) {
      const to = (distanceCell + 1) / distanceCells;
      tracks.push([from, Math.min(to, 1), tracksMatrix[distanceCell]]);
      from = to;
    }

    const compactTracks: [number, number, number][] = [];
    let start = 0;
    let end = 0;
    let value = tracks[0][2];

    tracks.forEach((track) => {
      if (track[2] !== value) {
        compactTracks.push([start, end, value]);
        start = end;
        value = track[2];
      }
      end = track[1];
    });
    compactTracks.push([start, 1, value]);

    return compactTracks;
  }
}
