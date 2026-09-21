import {Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Direction} from "../../data-structures/business.data.structures";

interface SectionTrackEstimateInput {
  departureMinute: number;
  arrivalMinute: number;
  backward: boolean;
  frequencyMinutes: number;
  sectionHeadwayMinutes: number;
}

interface TrackProjectionContext {
  distanceCells: number;
  timeCells: number;
  timeResolution: number;
  maximumFrequency: number;
  frequencyOffsetWindow: number;
  dataMatrix: number[][];
  tracksMatrix: number[];
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
    const maximumFrequency = this.getMaximumFrequency(sections);
    const maximumTravelTime = this.getMaximumTravelTime(sections);
    const unrollingWindow = Math.max(
      maximumFrequency,
      maximumTravelTime,
    );
    const frequencyOffsetWindow = this.getMaximumFrequencyOffsetWindow(
      sections,
      unrollingWindow,
    );
    if (unrollingWindow <= 0 || maximumFrequency <= 0) {
      return [];
    }
    return this.estimateTrackSegments(
      sections,
      maximumFrequency,
      frequencyOffsetWindow,
    );
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
          .filter((section) => this.connectsNodes(section, fromNodeId, toNodeId))
          .map((section) => [section.getId(), section] as const),
      ).values(),
    );
  }

  private connectsNodes(section: TrainrunSection, fromNodeId: number, toNodeId: number): boolean {
    const sourceNodeId = section.getSourceNodeId();
    const targetNodeId = section.getTargetNodeId();
    return (
      (sourceNodeId === fromNodeId && targetNodeId === toNodeId) ||
      (sourceNodeId === toNodeId && targetNodeId === fromNodeId)
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
      const departureAtFromNode = isForward
        ? section.getSourceDepartureConsecutiveTime()
        : section.getTargetDepartureConsecutiveTime();
      const arrivalAtToNode = isForward
        ? section.getTargetArrivalConsecutiveTime()
        : section.getSourceArrivalConsecutiveTime();
      const departureAtToNode = isForward
        ? section.getTargetDepartureConsecutiveTime()
        : section.getSourceDepartureConsecutiveTime();
      const arrivalAtFromNode = isForward
        ? section.getSourceArrivalConsecutiveTime()
        : section.getTargetArrivalConsecutiveTime();
      const forward = this.createTrackInput(
        departureAtFromNode,
        arrivalAtToNode,
        false,
        frequencyMinutes,
        sectionHeadwayMinutes,
      );
      const backward = this.createTrackInput(
        departureAtToNode,
        arrivalAtFromNode,
        true,
        frequencyMinutes,
        sectionHeadwayMinutes,
      );
      // A one-way trainrun contributes only in its actual travel direction.
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
      this.projectSectionIntoMatrices(section, {
        distanceCells,
        timeCells,
        timeResolution,
        maximumFrequency: maximumFrequencyMinutes,
        frequencyOffsetWindow: maximumFrequencyOffsetWindowMinutes,
        dataMatrix,
        tracksMatrix,
      }),
    );

    return InfrastructureEstimatorService.mergeTracks(tracksMatrix);
  }

  private projectSectionIntoMatrices(
    section: SectionTrackEstimateInput,
    context: TrackProjectionContext,
  ): void {
    if (section.frequencyMinutes <= 0) {
      return;
    }

    const travelTime = section.arrivalMinute - section.departureMinute;
    const maximumFrequencyOffset =
      Math.ceil(context.frequencyOffsetWindow / section.frequencyMinutes) *
      section.frequencyMinutes;
    const bandWidth = context.timeResolution * section.sectionHeadwayMinutes;
    for (let distanceCell = 0; distanceCell < context.distanceCells; distanceCell++) {
      // Backward sections are projected from the opposite end of the section.
      const matrixDistanceCell = section.backward
        ? context.distanceCells - distanceCell - 1
        : distanceCell;
      const baseTime =
        (section.departureMinute % context.maximumFrequency) +
        (travelTime * distanceCell) / (context.distanceCells - 0.5);
      for (
        let frequencyOffset = -maximumFrequencyOffset;
        frequencyOffset <= maximumFrequencyOffset;
        frequencyOffset += section.frequencyMinutes
      ) {
        // Repeat the trainrun over the frequency window and add its headway band.
        for (let bandOffset = 0; bandOffset < bandWidth; bandOffset++) {
          const timeCell =
            bandOffset + Math.round(context.timeResolution * (baseTime + frequencyOffset));

          if (timeCell >= 0 && timeCell < context.timeCells) {
            context.dataMatrix[matrixDistanceCell][timeCell]++;
            context.tracksMatrix[matrixDistanceCell] = Math.max(
              context.tracksMatrix[matrixDistanceCell],
              context.dataMatrix[matrixDistanceCell][timeCell],
            );
          }
        }
      }
    }
  }

  private static mergeTracks(
    tracksMatrix: number[],
  ): [number, number, number][] {
    if (tracksMatrix.length === 0) {
      return [];
    }

    // Convert cell-by-cell occupancy into normalized intervals and merge equal values.
    const tracks: [number, number, number][] = [];
    let from = 0;
    for (let distanceCell = 0; distanceCell < tracksMatrix.length; distanceCell++) {
      const to = (distanceCell + 1) / tracksMatrix.length;
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
