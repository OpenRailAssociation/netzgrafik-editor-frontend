import {Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";

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

  estimateSectionTracks(
    fromNode: Node,
    toNode: Node,
    trainrunSections: TrainrunSection[],
    minHeadwayTime = 2,
  ): [number, number, number][] {
    const matchingSections = this.findMatchingSections(fromNode, toNode, trainrunSections);
    const maximumFrequencyWindowMinutes = this.getMaximumFrequency(matchingSections);

    if (matchingSections.length === 0 || maximumFrequencyWindowMinutes <= 0) {
      return [];
    }

    const sections = this.createDirectionalTrackInputs(
      fromNode,
      toNode,
      matchingSections,
      minHeadwayTime,
    );
    return this.estimateTrackSegments(sections, maximumFrequencyWindowMinutes);
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

  private getMaximumFrequency(trainrunSections: TrainrunSection[]): number {
    return trainrunSections.reduce(
      (maximum, section) => Math.max(maximum, section.getTrainrun().getFrequency()),
      0,
    );
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
      const forward = this.createTrackInput(
        isForward
          ? section.getSourceDepartureConsecutiveTime()
          : section.getTargetDepartureConsecutiveTime(),
        isForward
          ? section.getTargetArrivalConsecutiveTime()
          : section.getSourceArrivalConsecutiveTime(),
        false,
        frequencyMinutes,
        minHeadwayTime,
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
        minHeadwayTime,
      );
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
    maximumFrequencyWindowMinutes: number,
  ): [number, number, number][] {
    const distanceResolution = InfrastructureEstimatorService.DEFAULT_DISTANCE_RESOLUTION;
    const timeResolution = InfrastructureEstimatorService.DEFAULT_TIME_RESOLUTION;

    if (maximumFrequencyWindowMinutes <= 0 || distanceResolution <= 0 || timeResolution <= 0) {
      return [];
    }

    const maximumTravelTime = sections.reduce(
      (maximum, section) =>
        Math.max(maximum, Math.round(section.arrivalMinute - section.departureMinute)),
      1,
    );
    const distanceCells = distanceResolution * maximumTravelTime;
    const timeCells = timeResolution * 2 * maximumFrequencyWindowMinutes;
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
        maximumFrequencyWindowMinutes,
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
    maximumFrequencyWindowMinutes: number,
    dataMatrix: number[][],
    tracksMatrix: number[],
  ): void {
    if (section.frequencyMinutes <= 0) {
      return;
    }

    const travelTime = section.arrivalMinute - section.departureMinute;
    for (let distanceCell = 0; distanceCell < distanceCells; distanceCell++) {
      for (
        let frequencyOffset = -maximumFrequencyWindowMinutes;
        frequencyOffset <= maximumFrequencyWindowMinutes;
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
            (section.departureMinute % maximumFrequencyWindowMinutes) +
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
