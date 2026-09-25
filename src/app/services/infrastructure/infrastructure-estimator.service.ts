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
