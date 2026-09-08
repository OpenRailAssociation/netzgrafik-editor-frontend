import {TrainrunSection} from "../../models/trainrunsection.model";

export type SectionTrackSegment = [start: number, end: number, trackCount: number];

export interface SectionTrackRequirement {
  sourceNodeId: number;
  targetNodeId: number;
  resourceId: number;
  trackSegments: SectionTrackSegment[];
}

const DISTANCE_CELLS_PER_MINUTE = 15;
const TIME_CELLS_PER_MINUTE = 15;

/**
 * Calculates the required tracks along physical node-to-node sections. Segment
 * boundaries are normalized to [0, 1] and each tuple is [start, end, tracks].
 */
export function calculateSectionTrackRequirements(
  trainrunSections: TrainrunSection[],
  horizonMinutes = 60,
): SectionTrackRequirement[] {
  const sectionsByEdge = new Map<string, TrainrunSection[]>();
  trainrunSections.forEach((section) => {
    if (section.getResourceId() === 0) {
      return;
    }
    const key = edgeKey(section);
    const groupedSections = sectionsByEdge.get(key) ?? [];
    groupedSections.push(section);
    sectionsByEdge.set(key, groupedSections);
  });

  return [...sectionsByEdge.entries()].map(([key, sections]) => {
    const [sourceNodeId, targetNodeId, resourceId] = key.split(":").map(Number);
    return {
      sourceNodeId,
      targetNodeId,
      resourceId,
      trackSegments: calculateTrackSegments(sections, horizonMinutes),
    };
  });
}

function calculateTrackSegments(
  sections: TrainrunSection[],
  horizonMinutes: number,
): SectionTrackSegment[] {
  const distanceCellCount = Math.max(
    1,
    Math.ceil(Math.max(...sections.map(forwardTravelTime), 1) * DISTANCE_CELLS_PER_MINUTE),
  );
  const requiredTracksByCell = new Array<number>(distanceCellCount).fill(0);
  const occupancyByCell = new Array(distanceCellCount)
    .fill(undefined)
    .map(() => new Array<number>(horizonMinutes * TIME_CELLS_PER_MINUTE).fill(0));

  sections.forEach((section) => {
    const forwardIsBackward = section.getSourceNodeId() > section.getTargetNodeId();
    addDirectionOccupation(
      section,
      section.getSourceDepartureConsecutiveTime(),
      section.getTargetArrivalConsecutiveTime(),
      forwardIsBackward,
      occupancyByCell,
      requiredTracksByCell,
      horizonMinutes,
    );
    if (section.getTrainrun().isRoundTrip()) {
      addDirectionOccupation(
        section,
        section.getTargetDepartureConsecutiveTime(),
        section.getSourceArrivalConsecutiveTime(),
        !forwardIsBackward,
        occupancyByCell,
        requiredTracksByCell,
        horizonMinutes,
      );
    }
  });

  return compactTrackSegments(requiredTracksByCell);
}

function addDirectionOccupation(
  section: TrainrunSection,
  departureMinute: number,
  arrivalMinute: number,
  backward: boolean,
  occupancyByCell: number[][],
  requiredTracksByCell: number[],
  horizonMinutes: number,
) {
  const travelTime = Math.max(1, duration(departureMinute, arrivalMinute));
  const headway = section.getTrainrun().getTrainrunCategory().sectionHeadway;
  const frequency = section.getFrequency() ?? 60;
  const firstOffset = Math.floor(-(arrivalMinute + headway) / frequency);
  const lastOffset = Math.ceil((horizonMinutes - departureMinute) / frequency);

  for (let offset = firstOffset; offset <= lastOffset; offset += 1) {
    for (let cell = 0; cell < occupancyByCell.length; cell += 1) {
      const physicalCell = backward ? occupancyByCell.length - cell - 1 : cell;
      const entryMinute =
        departureMinute + (travelTime * (cell + 0.5)) / occupancyByCell.length + offset * frequency;
      requiredTracksByCell[physicalCell] = addOccupation(
        occupancyByCell[physicalCell],
        entryMinute,
        entryMinute + headway,
        horizonMinutes,
        requiredTracksByCell[physicalCell],
      );
    }
  }
}

function addOccupation(
  occupancy: number[],
  startMinute: number,
  endMinute: number,
  horizonMinutes: number,
  currentMaximum: number,
): number {
  const firstCell = Math.max(0, Math.floor(startMinute * TIME_CELLS_PER_MINUTE));
  const lastCell = Math.min(
    horizonMinutes * TIME_CELLS_PER_MINUTE,
    Math.ceil(endMinute * TIME_CELLS_PER_MINUTE),
  );
  for (let cell = firstCell; cell < lastCell; cell += 1) {
    occupancy[cell] += 1;
    currentMaximum = Math.max(currentMaximum, occupancy[cell]);
  }
  return currentMaximum;
}

function compactTrackSegments(requiredTracksByCell: number[]): SectionTrackSegment[] {
  const segments: SectionTrackSegment[] = [];
  let startCell = 0;
  let trackCount = requiredTracksByCell[0];
  for (let cell = 1; cell <= requiredTracksByCell.length; cell += 1) {
    const currentTrackCount = cell === requiredTracksByCell.length ? undefined : requiredTracksByCell[cell];
    if (currentTrackCount !== trackCount) {
      segments.push([startCell / requiredTracksByCell.length, cell / requiredTracksByCell.length, trackCount]);
      startCell = cell;
      trackCount = currentTrackCount;
    }
  }
  return segments;
}

function forwardTravelTime(section: TrainrunSection): number {
  return duration(
    section.getSourceDepartureConsecutiveTime(),
    section.getTargetArrivalConsecutiveTime(),
  );
}

function duration(departureMinute: number, arrivalMinute: number): number {
  return arrivalMinute < departureMinute ? arrivalMinute + 60 - departureMinute : arrivalMinute - departureMinute;
}

function edgeKey(section: TrainrunSection): string {
  const sourceNodeId = Math.min(section.getSourceNodeId(), section.getTargetNodeId());
  const targetNodeId = Math.max(section.getSourceNodeId(), section.getTargetNodeId());
  return `${sourceNodeId}:${targetNodeId}:${section.getResourceId()}`;
}