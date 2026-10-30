import {Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {Trainrun} from "../../models/trainrun.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Transition} from "../../models/transition.model";
import {Port} from "../../models/port.model";
import {Direction} from "../../data-structures/business.data.structures";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {MathUtils} from "src/app/utils/math";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Estimated track requirement along a section. `start` and `end` are normalized
 * section positions from 0 to 1; `tracks` is the required number of parallel tracks.
 */
export interface TrackSegmentEstimate {
  start: number;
  end: number;
  tracks: number;
}

/**
 * Optional inputs for node-track estimation. Time values are expressed in minutes;
 * forward and backward tracks are separated by default.
 */
export interface NodeTrackEstimatorOptions {
  windowStartMinutes?: number;
  windowEndMinutes?: number;
  separateForwardBackwardTracks?: boolean;
}

/**
 * One periodic trainrun occurrence occupying a node track. `headwayUntilMinute`
 * marks the end of the blocking interval used for track allocation.
 */
export interface NodeTrackOccupancy {
  arrivalMinute: number;
  departureMinute: number;
  headwayUntilMinute: number;
  trainrunId: number;
  arrivalSectionId?: number;
  departureSectionId?: number;
  transitionId?: number;
  direction: Direction;
  trackGroupId?: string;
  occurrenceIndex: number;
}

/** Estimated node-track occupancy, with one entry per allocated track. */
export interface NodeTrackEstimate {
  track: number;
  occupancies: NodeTrackOccupancy[];
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface SectionTrackEstimateInput {
  departureMinute: number;
  arrivalMinute: number;
  backward: boolean;
  frequencyMinutes: number;
  sectionHeadwayMinutes: number;
}

type TrainrunSectionDirection = "forward" | "backward";

/** Structural type of a trainrun occurrence at a node. */
enum NodeTrackOccurrenceType {
  TRANSIT = 1,
  ROUND_TRIP_TURNAROUND = 2,
  ONE_WAY_ENDPOINT = 3,
}

/** Node operation relevant for allocation: stopping, non-stop transit, or endpoint. */
type NodeTrackTransit = "stop" | "non-stop" | "endpoint";

/** One directed visit of a trainrun at a node, including its incoming and outgoing sections. */
interface NodeTrackTrainrunOccurrence {
  node: Node;
  trainrun: Trainrun;
  arrivalSection?: TrainrunSection;
  arrivalDirection?: TrainrunSectionDirection;
  departureSection?: TrainrunSection;
  departureDirection?: TrainrunSectionDirection;
  transition?: Transition;
  trackGroupId?: string;
  /** Classifies whether the train transits, turns around, or starts/ends here. */
  occurrenceType: NodeTrackOccurrenceType;
  occurrenceIndex: number;
}

/** Timing parameters required to calculate one node-track occupancy. */
interface NodeTimingContext {
  frequency: number;
  haltezeit: number;
  nodeHeadway: number;
  minimalTurnaround: number;
}

/** Arrival, departure, and blocking-end times for one node-track occurrence. */
interface NodeTrackTimes {
  arrivalMinute: number;
  departureMinute: number;
  headwayUntilMinute: number;
}

/**
 * Group of periodic occupancies assigned to one physical track strand,
 * including the metadata needed for track allocation.
 */
interface NodeTrackBlock {
  occurrenceIndex: number;
  occurrenceType: NodeTrackOccurrenceType;
  trackGroupId?: string;
  corridorKey: string;
  transit: NodeTrackTransit;
  occupancies: NodeTrackOccupancy[];
  categoryOrder: number;
  categoryShortName: string;
  trainrunTitle: string;
  firstArrival: number;
}

/** Expanded internal time window used to calculate node-track occupancies. */
interface NodeTrackEstimationWindow {
  calculationStartMinutes: number;
  windowEndMinutes: number;
}

/** Matrix context used to project section occupancies over distance and time. */
interface TrackProjectionContext {
  distanceCells: number;
  timeCells: number;
  timeResolution: number;
  maximumFrequency: number;
  frequencyOffsetWindow: number;
  dataMatrix: number[][];
  tracksMatrix: number[];
}

type TimeKind = "arrival" | "departure";
type TimeScale = "consecutive" | "periodic";

/** Which section end must sit on the node, and how to read the time there. */
interface TimeAccessor {
  nodeEnd: "source" | "target";
  read: (section: TrainrunSection) => number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable({providedIn: "root"})
export class InfrastructureEstimatorService {
  static readonly DEFAULT_DISTANCE_RESOLUTION = 15;
  static readonly DEFAULT_TIME_RESOLUTION = 15;
  static readonly DEFAULT_MINIMUM_HEADWAY_TIME = 1;

  // =========================================================================
  // Section tracks (corridor between two nodes)
  // =========================================================================

  /**
   * Estimates the number of tracks needed on the corridor fromNode -> toNode.
   * The calculation is oriented: from -> to is not the same as to -> from.
   * Sections are passed explicitly so the service stays stateless.
   * 
   * @param fromNode The starting node of the corridor.
   * @param toNode The ending node of the corridor.
   * @param trainrunSections The sections of trainruns traveling through the corridor.
   * @param minHeadwayTime The minimum headway time between trains on the same track.
   * @returns An array of track segment estimates for the corridor.
   */
  estimateSectionTracks(
    fromNode: Node,
    toNode: Node,
    trainrunSections: TrainrunSection[],
    minHeadwayTime = InfrastructureEstimatorService.DEFAULT_MINIMUM_HEADWAY_TIME,
  ): TrackSegmentEstimate[] {
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
    const maximumFrequency = this.maxOf(sections, (section) => section.frequencyMinutes);
    const maximumTravelTime = this.getMaximumTravelTime(sections);
    const unrollingWindow = Math.max(maximumFrequency, maximumTravelTime);
    if (unrollingWindow <= 0 || maximumFrequency <= 0) {
      return [];
    }

    const frequencyOffsetWindow = this.getMaximumFrequencyOffsetWindow(sections, unrollingWindow);
    return this.estimateTrackSegments(sections, maximumFrequency, frequencyOffsetWindow);
  }

  // =========================================================================
  // Node tracks
  // =========================================================================

  /**
   * Estimates track usage inside one node. Sections are passed explicitly.
   *
   * @param node The node for which to estimate track usage.
   * @param trainrunSections The sections of trainruns visiting the node.
   * @param options Additional options for the estimation.
   * @returns An array of node track estimates.
   */
  estimateNodeTracks(
    node: Node,
    trainrunSections: TrainrunSection[],
    options: NodeTrackEstimatorOptions = {},
  ): NodeTrackEstimate[] {
    const occurrences = this.createNodeTrackOccurrences(node, trainrunSections);
    const maximumFrequency = this.maxOf(occurrences, (o) => o.trainrun.getFrequency());
    if (maximumFrequency === 0) {
      return [];
    }

    const window = this.getNodeTrackEstimationWindow(options, maximumFrequency);
    // Build every occurrence first; allocation happens only after the order is stable.
    const blocks = occurrences
      .flatMap((occurrence) => this.createNodeTrackBlocks(occurrence, window))
      .sort((first, second) => this.compareNodeTrackBlocks(first, second));

    const separateDirections = options.separateForwardBackwardTracks ?? true;
    const tracks = separateDirections
      ? this.allocateDirectionalNodeTracks(blocks)
      : this.allocateSharedNodeTracks(blocks);

    return tracks.map((track, index) => ({
      track: index + 1,
      occupancies: track.occupancies.sort((a, b) => a.arrivalMinute - b.arrivalMinute),
    }));
  }

  private findMatchingSections(
    fromNode: Node,
    toNode: Node,
    trainrunSections: TrainrunSection[],
  ): TrainrunSection[] {
    const fromNodeId = fromNode.getId();
    const toNodeId = toNode.getId();
    const unique = new Map<number, TrainrunSection>();
    for (const section of trainrunSections) {
      const sourceNodeId = section.getSourceNodeId();
      const targetNodeId = section.getTargetNodeId();
      const connects =
        (sourceNodeId === fromNodeId && targetNodeId === toNodeId) ||
        (sourceNodeId === toNodeId && targetNodeId === fromNodeId);
      if (connects) {
        unique.set(section.getId(), section);
      }
    }
    return [...unique.values()];
  }

  private createDirectionalTrackInputs(
    fromNode: Node,
    toNode: Node,
    trainrunSections: TrainrunSection[],
    minHeadwayTime: number,
  ): SectionTrackEstimateInput[] {
    return trainrunSections.flatMap((section) => {
      const trainrun = section.getTrainrun();
      const isForward =
        section.getSourceNodeId() === fromNode.getId() &&
        section.getTargetNodeId() === toNode.getId();

      // "near" = the fromNode end of the section, "far" = the toNode end.
      const times = isForward
        ? {
            departureNear: section.getSourceDepartureConsecutiveTime(),
            arrivalFar: section.getTargetArrivalConsecutiveTime(),
            departureFar: section.getTargetDepartureConsecutiveTime(),
            arrivalNear: section.getSourceArrivalConsecutiveTime(),
          }
        : {
            departureNear: section.getTargetDepartureConsecutiveTime(),
            arrivalFar: section.getSourceArrivalConsecutiveTime(),
            departureFar: section.getSourceDepartureConsecutiveTime(),
            arrivalNear: section.getTargetArrivalConsecutiveTime(),
          };

      const forward: SectionTrackEstimateInput = {
        departureMinute: times.departureNear,
        arrivalMinute: times.arrivalFar,
        backward: false,
        frequencyMinutes: trainrun.getFrequency(),
        sectionHeadwayMinutes: this.getSectionHeadway(trainrun, minHeadwayTime),
      };
      const backward: SectionTrackEstimateInput = {
        departureMinute: times.departureFar,
        arrivalMinute: times.arrivalNear,
        backward: true,
        frequencyMinutes: trainrun.getFrequency(),
        sectionHeadwayMinutes: this.getSectionHeadway(trainrun, minHeadwayTime),
      };

      // A one-way trainrun contributes only in its actual travel direction.
      if (trainrun.getDirection() === Direction.ONE_WAY) {
        return isForward ? [forward] : [backward];
      }
      return [forward, backward];
    });
  }

  private getSectionHeadway(trainrun: Trainrun, minHeadwayTime: number): number {
    const categoryHeadway = trainrun.getTrainrunCategory()?.sectionHeadway;
    return MathUtils.isPositiveNumber(categoryHeadway)
      ? Math.max(minHeadwayTime, categoryHeadway)
      : minHeadwayTime;
  }

  private getMaximumTravelTime(sections: SectionTrackEstimateInput[]): number {
    return this.maxOf(sections, (section) =>
      Math.round(section.arrivalMinute - section.departureMinute),
    );
  }

  /** Rounds the window up to a whole multiple of every section frequency. */
  private getMaximumFrequencyOffsetWindow(
    sections: SectionTrackEstimateInput[],
    minimumWindowMinutes: number,
  ): number {
    return sections.reduce((maximum, section) => {
      if (section.frequencyMinutes <= 0) {
        return maximum;
      }
      const rounded =
        Math.ceil(minimumWindowMinutes / section.frequencyMinutes) * section.frequencyMinutes;
      return Math.max(maximum, rounded);
    }, minimumWindowMinutes);
  }

  private estimateTrackSegments(
    sections: SectionTrackEstimateInput[],
    maximumFrequencyMinutes: number,
    frequencyOffsetWindowMinutes: number,
  ): TrackSegmentEstimate[] {
    const distanceResolution = InfrastructureEstimatorService.DEFAULT_DISTANCE_RESOLUTION;
    const timeResolution = InfrastructureEstimatorService.DEFAULT_TIME_RESOLUTION;
    if (frequencyOffsetWindowMinutes <= 0 || distanceResolution <= 0 || timeResolution <= 0) {
      return [];
    }

    const maximumTravelTime = Math.max(this.getMaximumTravelTime(sections), 1);
    const distanceCells = distanceResolution * maximumTravelTime;
    const timeCells = timeResolution * 2 * frequencyOffsetWindowMinutes;

    const context: TrackProjectionContext = {
      distanceCells,
      timeCells,
      timeResolution,
      maximumFrequency: maximumFrequencyMinutes,
      frequencyOffsetWindow: frequencyOffsetWindowMinutes,
      dataMatrix: Array.from({length: distanceCells}, () => new Array<number>(timeCells).fill(0)),
      tracksMatrix: new Array<number>(distanceCells).fill(0),
    };

    sections.forEach((section) => this.projectSectionIntoMatrices(section, context));
    return this.mergeTracks(context.tracksMatrix);
  }

  /**
   * Draws one section as a diagonal band into the time/distance matrix:
   * repeated over the whole frequency window and widened by its headway.
   * Business-critical geometry - do not simplify without tests.
   */
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
        const bandStart = Math.round(context.timeResolution * (baseTime + frequencyOffset));
        for (let bandOffset = 0; bandOffset < bandWidth; bandOffset++) {
          const timeCell = bandStart + bandOffset;
          if (timeCell < 0 || timeCell >= context.timeCells) {
            continue;
          }
          const occupancy = ++context.dataMatrix[matrixDistanceCell][timeCell];
          context.tracksMatrix[matrixDistanceCell] = Math.max(
            context.tracksMatrix[matrixDistanceCell],
            occupancy,
          );
        }
      }
    }
  }

  /** Turns per-cell occupancy into normalized intervals, merging equal neighbours. */
  private mergeTracks(tracksMatrix: number[]): TrackSegmentEstimate[] {
    const cellCount = tracksMatrix.length;
    if (cellCount === 0) {
      return [];
    }

    const segments: TrackSegmentEstimate[] = [];
    let segmentStartCell = 0;
    for (let cell = 1; cell <= cellCount; cell++) {
      const isSameValue = cell < cellCount && tracksMatrix[cell] === tracksMatrix[segmentStartCell];
      if (isSameValue) {
        continue;
      }
      segments.push({
        start: segmentStartCell / cellCount,
        end: cell / cellCount,
        tracks: tracksMatrix[segmentStartCell],
      });
      segmentStartCell = cell;
    }
    return segments;
  }

  /** Expanded internal time window used to calculate node-track occupancies. */
  private getNodeTrackEstimationWindow(
    options: NodeTrackEstimatorOptions,
    maximumFrequency: number,
  ): NodeTrackEstimationWindow {
    const requestedEnd = Math.max(options.windowEndMinutes ?? maximumFrequency, maximumFrequency);
    const requestedStart = options.windowStartMinutes ?? requestedEnd - maximumFrequency;
    const expansion = 2 * maximumFrequency;
    return {
      calculationStartMinutes: requestedStart - expansion,
      windowEndMinutes: requestedEnd + expansion,
    };
  }

  // --- occurrence creation -------------------------------------------------

  private createNodeTrackOccurrences(
    node: Node,
    trainrunSections: TrainrunSection[],
  ): NodeTrackTrainrunOccurrence[] {
    const nodeId = node.getId();
    const allowedSectionIds = new Set(trainrunSections.map((section) => section.getId()));
    const occurrences: NodeTrackTrainrunOccurrence[] = [];
    const visitedTransitionIds = new Set<number>();
    const endingRoundTrip: TrainrunSection[] = [];
    const endingOneWay: TrainrunSection[] = [];

    // Step 1: one occurrence per connected transition (A -> X -> B).
    for (const port of this.getOrderedNodePorts(node)) {
      const section1 = this.getNodeTrackSection(port, allowedSectionIds);
      if (section1 === undefined) {
        continue;
      }

      if (node.isEndNode(section1)) {
        const isOneWay = section1.getTrainrun().getDirection() === Direction.ONE_WAY;
        (isOneWay ? endingOneWay : endingRoundTrip).push(section1);
        continue;
      }

      const transition = node.getTransitionFromPortId(port.getId());
      if (visitedTransitionIds.has(transition.getId())) {
        continue;
      }
      visitedTransitionIds.add(transition.getId());

      const otherPortId =
        transition.getPortId1() === port.getId()
          ? transition.getPortId2()
          : transition.getPortId1();
      const section2 = this.getNodeTrackSection(node.getPort(otherPortId), allowedSectionIds);
      if (section2 === undefined) {
        continue;
      }

      // The incoming section is the one ending at this node.
      const incoming = section1.getTargetNodeId() === nodeId ? section1 : section2;
      const outgoing = incoming === section1 ? section2 : section1;
      const trainrun = incoming.getTrainrun();

      this.addNodeTrackOccurrence(occurrences, node, trainrun, incoming, outgoing, transition);
      if (trainrun.getDirection() !== Direction.ONE_WAY) {
        this.addNodeTrackOccurrence(occurrences, node, trainrun, outgoing, incoming, transition);
      }
    }

    // Step 2: round-trip trains turning around at an unconnected port.
    for (const section of endingRoundTrip) {
      this.addNodeTrackOccurrence(
        occurrences,
        node,
        section.getTrainrun(),
        section,
        section,
        undefined,
      );
    }

    // Step 3: one-way trains starting or ending here.
    for (const section of endingOneWay) {
      const startsHere = section.getSourceNodeId() === nodeId;
      this.addNodeTrackOccurrence(
        occurrences,
        node,
        section.getTrainrun(),
        startsHere ? undefined : section,
        startsHere ? section : undefined,
        undefined,
      );
    }

    return occurrences;
  }

  /** Stable port order keeps track allocation reproducible across runs. */
  private getOrderedNodePorts(node: Node): ReturnType<Node["getPorts"]> {
    const alignmentOrder = [
      PortAlignment.Left,
      PortAlignment.Top,
      PortAlignment.Right,
      PortAlignment.Bottom,
    ];
    return [...node.getPorts()].sort(
      (first, second) =>
        alignmentOrder.indexOf(first.getPositionAlignment()) -
          alignmentOrder.indexOf(second.getPositionAlignment()) ||
        first.getPositionIndex() - second.getPositionIndex(),
    );
  }

  private getNodeTrackSection(
    port: Port,
    allowedSectionIds: Set<number>,
  ): TrainrunSection | undefined {
    const section = port.getTrainrunSection();
    return section !== null && allowedSectionIds.has(section.getId()) ? section : undefined;
  }

  private addNodeTrackOccurrence(
    occurrences: NodeTrackTrainrunOccurrence[],
    node: Node,
    trainrun: Trainrun,
    arrivalSection: TrainrunSection | undefined,
    departureSection: TrainrunSection | undefined,
    transition: Transition | undefined,
  ): void {
    const nodeId = node.getId();
    occurrences.push({
      node,
      trainrun,
      arrivalSection,
      arrivalDirection:
        arrivalSection === undefined
          ? undefined
          : arrivalSection.getTargetNodeId() === nodeId
            ? "forward"
            : "backward",
      departureSection,
      departureDirection:
        departureSection === undefined
          ? undefined
          : departureSection.getSourceNodeId() === nodeId
            ? "forward"
            : "backward",
      transition,
      trackGroupId: this.getNodeTrackGroupId(node, arrivalSection, departureSection),
      occurrenceType: this.getNodeTrackOccurrenceType(
        node,
        trainrun,
        arrivalSection ?? departureSection,
      ),
      occurrenceIndex: occurrences.length,
    });
  }

  private getNodeTrackOccurrenceType(
    node: Node,
    trainrun: Trainrun,
    sectionAtNode: TrainrunSection | undefined,
  ): NodeTrackOccurrenceType {
    if (sectionAtNode !== undefined && !node.isEndNode(sectionAtNode)) {
      return NodeTrackOccurrenceType.TRANSIT;
    }
    // Without a transition, distinguish a round-trip from a one-way endpoint.
    return trainrun.getDirection() === Direction.ONE_WAY
      ? NodeTrackOccurrenceType.ONE_WAY_ENDPOINT
      : NodeTrackOccurrenceType.ROUND_TRIP_TURNAROUND;
  }

  /** Directed identity of a movement: "<from>-><node>-><to>". */
  private getNodeTrackGroupId(
    node: Node,
    arrivalSection: TrainrunSection | undefined,
    departureSection: TrainrunSection | undefined,
  ): string | undefined {
    if (arrivalSection === undefined && departureSection === undefined) {
      return undefined;
    }
    const from = this.getOppositeNodeId(node, arrivalSection) ?? "start";
    const to = this.getOppositeNodeId(node, departureSection) ?? "end";
    return `${from}->${node.getId()}->${to}`;
  }

  /** Undirected neighbour pair, so A -> X -> B and B -> X -> A share one space. */
  private getNodeTrackCorridorKey(occurrence: NodeTrackTrainrunOccurrence): string {
    const fromNodeId = this.getOppositeNodeId(occurrence.node, occurrence.arrivalSection);
    const toNodeId = this.getOppositeNodeId(occurrence.node, occurrence.departureSection);
    if (fromNodeId === undefined || toNodeId === undefined) {
      return `${fromNodeId ?? "start"}-${toNodeId ?? "end"}`;
    }
    return `${Math.min(fromNodeId, toNodeId)}-${Math.max(fromNodeId, toNodeId)}`;
  }

  private getOppositeNodeId(node: Node, section: TrainrunSection | undefined): number | undefined {
    if (section === undefined) {
      return undefined;
    }
    const nodeId = node.getId();
    return section.getSourceNodeId() === nodeId
      ? section.getTargetNodeId()
      : section.getSourceNodeId();
  }

  // --- block creation ------------------------------------------------------

  private createNodeTrackBlocks(
    occurrence: NodeTrackTrainrunOccurrence,
    window: NodeTrackEstimationWindow,
  ): NodeTrackBlock[] {
    const timing = this.createNodeTimingContext(occurrence);
    const times = this.getNodeTrackTimes(occurrence, timing);
    if (times === undefined || timing.frequency <= 0) {
      return [];
    }

    const offsets = this.getNodeTrackOffsets(times, timing.frequency, window);
    // A block longer than one frequency cycle needs more than one physical strand.
    const strandCount = Math.max(
      1,
      Math.ceil((times.headwayUntilMinute - times.arrivalMinute) / timing.frequency),
    );

    const strands = new Map<number, NodeTrackOccupancy[]>();
    for (const offset of offsets) {
      const strand = MathUtils.modulo(
        offset +
          (occurrence.occurrenceType === NodeTrackOccurrenceType.ROUND_TRIP_TURNAROUND ? 1 : 0),
        strandCount,
      );
      this.pushToGroup(strands, strand, this.createOccupancy(occurrence, times, timing, offset));
    }

    return [...strands.entries()]
      .sort(([first], [second]) => first - second)
      .map(([, occupancies]) => this.createBlock(occurrence, occupancies));
  }

  private createOccupancy(
    occurrence: NodeTrackTrainrunOccurrence,
    times: NodeTrackTimes,
    timing: NodeTimingContext,
    offset: number,
  ): NodeTrackOccupancy {
    const shift = offset * timing.frequency;
    return {
      arrivalMinute: times.arrivalMinute + shift,
      departureMinute: times.departureMinute + shift,
      headwayUntilMinute: times.headwayUntilMinute + shift,
      trainrunId: occurrence.trainrun.getId(),
      arrivalSectionId: occurrence.arrivalSection?.getId(),
      departureSectionId: occurrence.departureSection?.getId(),
      transitionId: occurrence.transition?.getId(),
      direction: occurrence.trainrun.getDirection(),
      trackGroupId: occurrence.trackGroupId,
      occurrenceIndex: occurrence.occurrenceIndex,
    };
  }

  private createBlock(
    occurrence: NodeTrackTrainrunOccurrence,
    occupancies: NodeTrackOccupancy[],
  ): NodeTrackBlock {
    const transit: NodeTrackTransit =
      occurrence.transition === undefined
        ? "endpoint"
        : occurrence.transition.getIsNonStopTransit()
          ? "non-stop"
          : "stop";
    return {
      occurrenceIndex: occurrence.occurrenceIndex,
      occurrenceType: occurrence.occurrenceType,
      trackGroupId: occurrence.trackGroupId,
      corridorKey: this.getNodeTrackCorridorKey(occurrence),
      transit,
      occupancies,
      categoryOrder: occurrence.trainrun.getTrainrunCategory().order,
      categoryShortName: occurrence.trainrun.getCategoryShortName(),
      trainrunTitle: occurrence.trainrun.getTitle(),
      firstArrival: Math.min(...occupancies.map((occupancy) => occupancy.arrivalMinute)),
    };
  }

  /** All frequency repetitions whose occupancy overlaps the calculation window. */
  private getNodeTrackOffsets(
    times: NodeTrackTimes,
    frequency: number,
    window: NodeTrackEstimationWindow,
  ): number[] {
    const firstOffset = Math.floor(
      (window.calculationStartMinutes - times.headwayUntilMinute) / frequency,
    );
    const lastOffset = Math.ceil((window.windowEndMinutes - times.arrivalMinute) / frequency);

    const offsets: number[] = [];
    for (let offset = firstOffset; offset <= lastOffset; offset++) {
      const shift = offset * frequency;
      const overlapsWindow =
        times.headwayUntilMinute + shift > window.calculationStartMinutes &&
        times.arrivalMinute + shift < window.windowEndMinutes;
      if (overlapsWindow) {
        offsets.push(offset);
      }
    }
    return offsets;
  }

  private compareNodeTrackBlocks(first: NodeTrackBlock, second: NodeTrackBlock): number {
    return (
      first.categoryOrder - second.categoryOrder ||
      first.categoryShortName.localeCompare(second.categoryShortName) ||
      first.trainrunTitle.localeCompare(second.trainrunTitle) ||
      first.firstArrival - second.firstArrival ||
      first.occurrenceIndex - second.occurrenceIndex
    );
  }

  // --- allocation ----------------------------------------------------------

  private allocateSharedNodeTracks(blocks: NodeTrackBlock[]): NodeTrackEstimate[] {
    const tracks: NodeTrackEstimate[] = [];
    for (const occurrenceType of Object.values(NodeTrackOccurrenceType).filter(
      (occurrenceType): occurrenceType is NodeTrackOccurrenceType =>
        typeof occurrenceType === "number",
    )) {
      this.appendNodeTrackBlocks(tracks, this.byOccurrenceType(blocks, occurrenceType));
    }
    return tracks;
  }

  private allocateDirectionalNodeTracks(blocks: NodeTrackBlock[]): NodeTrackEstimate[] {
    const throughBlocks = this.byOccurrenceType(blocks, NodeTrackOccurrenceType.TRANSIT);
    const corridorGroups = this.groupBlocks(throughBlocks, (block) => block.corridorKey);

    const tracks = corridorGroups.flatMap((corridorGroup) => {
      const [forwardGroup = [], backwardGroup = []] = this.groupBlocks(
        corridorGroup,
        (block) => block.trackGroupId,
      );
      const forwardTracks = this.allocateDirectionalBlockGroup(forwardGroup);
      const backwardTracks = this.allocateDirectionalBlockGroup(backwardGroup);
      return [...forwardTracks, ...backwardTracks.reverse()];
    });

    // Turnarounds and one-way endpoints reuse the tracks created by through-trains.
    this.appendNodeTrackBlocks(
      tracks,
      this.byOccurrenceType(blocks, NodeTrackOccurrenceType.ROUND_TRIP_TURNAROUND),
    );
    this.appendNodeTrackBlocks(
      tracks,
      this.byOccurrenceType(blocks, NodeTrackOccurrenceType.ONE_WAY_ENDPOINT),
    );
    return tracks;
  }

  private allocateDirectionalBlockGroup(blocks: NodeTrackBlock[]): NodeTrackEstimate[] {
    const tracks: NodeTrackEstimate[] = [];
    this.appendNodeTrackBlocks(
      tracks,
      blocks.filter((block) => block.transit === "stop"),
    );
    // Non-stop movements do not share the stop-train allocation block.
    blocks
      .filter((block) => block.transit !== "stop")
      .forEach((block) => this.appendNodeTrackBlocks(tracks, [block]));
    return tracks;
  }

  /** First-fit placement: reuse the first track without a time overlap. */
  private appendNodeTrackBlocks(tracks: NodeTrackEstimate[], blocks: NodeTrackBlock[]): void {
    for (const block of blocks) {
      const freeTrack = tracks.find((track) => !this.overlaps(track, block));
      if (freeTrack !== undefined) {
        freeTrack.occupancies.push(...block.occupancies);
      } else {
        tracks.push({track: tracks.length + 1, occupancies: [...block.occupancies]});
      }
    }
  }

  private overlaps(track: NodeTrackEstimate, block: NodeTrackBlock): boolean {
    return block.occupancies.some((candidate) =>
      track.occupancies.some(
        (existing) =>
          candidate.headwayUntilMinute > existing.arrivalMinute &&
          existing.headwayUntilMinute > candidate.arrivalMinute,
      ),
    );
  }

  private byOccurrenceType(
    blocks: NodeTrackBlock[],
    occurrenceType: NodeTrackOccurrenceType,
  ): NodeTrackBlock[] {
    return blocks.filter((block) => block.occurrenceType === occurrenceType);
  }

  /**
   * Groups blocks by key, dropping blocks without a key, and sorts the groups
   * by their earliest occurrence index so the result is deterministic.
   */
  private groupBlocks(
    blocks: NodeTrackBlock[],
    keyOf: (block: NodeTrackBlock) => string | undefined,
  ): NodeTrackBlock[][] {
    const groups = new Map<string, NodeTrackBlock[]>();
    for (const block of blocks) {
      const key = keyOf(block);
      if (key !== undefined) {
        this.pushToGroup(groups, key, block);
      }
    }
    const firstIndex = (group: NodeTrackBlock[]) =>
      Math.min(...group.map((block) => block.occurrenceIndex));
    return [...groups.values()].sort((first, second) => firstIndex(first) - firstIndex(second));
  }

  // --- timing --------------------------------------------------------------

  private createNodeTimingContext(occurrence: NodeTrackTrainrunOccurrence): NodeTimingContext {
    const category = occurrence.trainrun.getTrainrunCategory();
    const haltezeit = this.getNodeHaltezeit(occurrence.node, occurrence.trainrun);
    const nodeHeadway = occurrence.transition?.getIsNonStopTransit()
      ? category.nodeHeadwayNonStop
      : category.nodeHeadwayStop;
    return {
      frequency: occurrence.trainrun.getFrequency(),
      haltezeit,
      nodeHeadway,
      // Fall back to the dwell time when the category has no turnaround rule.
      minimalTurnaround: MathUtils.isPositiveNumber(category.minimalTurnaroundTime)
        ? category.minimalTurnaroundTime
        : haltezeit,
    };
  }

  private getNodeHaltezeit(node: Node, trainrun: Trainrun): number {
    const haltezeit =
      node.getTrainrunCategoryHaltezeit()[trainrun.getTrainrunCategory().fachCategory]?.haltezeit;
    return MathUtils.isFiniteNumber(haltezeit) ? Math.max(0, haltezeit) : 0;
  }

  private getNodeTrackTimes(
    occurrence: NodeTrackTrainrunOccurrence,
    timing: NodeTimingContext,
  ): NodeTrackTimes | undefined {
    const arrival = this.getNodeTime(occurrence, "arrival", "consecutive");
    const departure = this.getNodeTime(occurrence, "departure", "consecutive");

    // Step 1: a train that starts or ends here only occupies one side.
    const endpointTimes = this.getNodeEndpointTimes(occurrence, arrival, departure, timing);
    if (endpointTimes !== undefined) {
      return endpointTimes;
    }
    if (arrival === undefined || departure === undefined) {
      return undefined;
    }

    // Step 2: align departure with arrival inside the frequency cycle.
    const alignedDeparture =
      this.getPeriodicTurnaroundDeparture(occurrence, arrival, timing) ??
      this.getConsecutiveDeparture(arrival, departure, timing.frequency);

    // Step 3: apply the turnaround rule.
    return this.getTurnaroundNodeTrackTimes(occurrence, arrival, alignedDeparture, timing);
  }

  private getNodeEndpointTimes(
    occurrence: NodeTrackTrainrunOccurrence,
    arrival: number | undefined,
    departure: number | undefined,
    timing: NodeTimingContext,
  ): NodeTrackTimes | undefined {
    const isStart =
      occurrence.departureSection !== undefined && occurrence.arrivalSection === undefined;
    const isEnd =
      occurrence.arrivalSection !== undefined && occurrence.departureSection === undefined;
    if (!isStart && !isEnd) {
      return undefined;
    }

    const startTime = departure ?? arrival;
    const endTime = arrival ?? departure;
    if (startTime === undefined || endTime === undefined) {
      return undefined;
    }

    const releaseTime = isEnd ? endTime + timing.haltezeit : startTime;
    return {
      arrivalMinute: isStart ? startTime - timing.haltezeit : endTime,
      departureMinute: releaseTime,
      headwayUntilMinute: releaseTime + timing.nodeHeadway,
    };
  }

  /**
   * Round-trip turnaround on a single section: the train leaves on the periodic
   * departure slot of a later cycle. Frequencies above 60 min need an extra
   * correction because the periodic times are hour-based.
   */
  private getPeriodicTurnaroundDeparture(
    occurrence: NodeTrackTrainrunOccurrence,
    arrivalMinute: number,
    timing: NodeTimingContext,
  ): number | undefined {
    const isSingleSectionTurnaround =
      occurrence.occurrenceType === NodeTrackOccurrenceType.ROUND_TRIP_TURNAROUND &&
      occurrence.arrivalSection !== undefined &&
      occurrence.arrivalSection === occurrence.departureSection;
    if (!isSingleSectionTurnaround || timing.frequency <= 0) {
      return undefined;
    }

    const periodicArrival = this.getNodeTime(occurrence, "arrival", "periodic");
    const periodicDeparture = this.getNodeTime(occurrence, "departure", "periodic");
    if (periodicArrival === undefined || periodicDeparture === undefined) {
      return undefined;
    }

    const frequencyOverHour = timing.frequency > 60 ? timing.frequency - 60 : 0;
    let departure =
      (arrivalMinute < periodicDeparture
        ? periodicDeparture + timing.frequency
        : periodicDeparture) + frequencyOverHour;

    while (departure - timing.frequency > arrivalMinute) {
      departure -= timing.frequency;
    }
    if (departure - arrivalMinute < timing.minimalTurnaround) {
      departure += timing.frequency;
    }
    return departure;
  }

  private getConsecutiveDeparture(
    arrivalMinute: number,
    departureMinute: number,
    frequency: number,
  ): number {
    if (frequency <= 0) {
      return departureMinute;
    }
    const cycles = Math.ceil(Math.max(0, arrivalMinute - departureMinute) / frequency);
    return departureMinute + cycles * frequency;
  }

  private getTurnaroundNodeTrackTimes(
    occurrence: NodeTrackTrainrunOccurrence,
    arrivalMinute: number,
    departureMinute: number,
    timing: NodeTimingContext,
  ): NodeTrackTimes {
    const isTurnaround = occurrence.transition === undefined;
    const departure = this.adjustTurnaroundDeparture(
      occurrence,
      arrivalMinute,
      departureMinute,
      timing,
    );
    return {
      arrivalMinute,
      departureMinute: departure,
      headwayUntilMinute: isTurnaround
        ? Math.max(departure + timing.nodeHeadway, arrivalMinute + timing.minimalTurnaround)
        : departure + timing.nodeHeadway,
    };
  }

  /** Pushes the departure forward in whole cycles until the turnaround is feasible. */
  private adjustTurnaroundDeparture(
    occurrence: NodeTrackTrainrunOccurrence,
    arrivalMinute: number,
    departureMinute: number,
    timing: NodeTimingContext,
  ): number {
    if (occurrence.transition !== undefined || timing.frequency <= 0) {
      return departureMinute;
    }

    let departure = departureMinute;
    if (
      occurrence.occurrenceType === NodeTrackOccurrenceType.ROUND_TRIP_TURNAROUND &&
      departure <= arrivalMinute
    ) {
      const cycles = Math.floor((arrivalMinute - departure) / timing.frequency) + 1;
      departure += cycles * timing.frequency;
    }

    const turnaroundTime = departure - arrivalMinute;
    if (turnaroundTime > 0 && turnaroundTime < timing.minimalTurnaround) {
      departure +=
        Math.ceil((timing.minimalTurnaround - turnaroundTime) / timing.frequency) *
        timing.frequency;
    }
    return departure;
  }

  /** Selects the section end and time getter for one arrival/departure context. */
  private static getTimeAccessor(
    kind: TimeKind,
    scale: TimeScale,
    direction: TrainrunSectionDirection,
  ): TimeAccessor {
    if (kind === "arrival" && scale === "consecutive") {
      return direction === "forward"
        ? {nodeEnd: "target", read: (s) => s.getTargetArrivalConsecutiveTime()}
        : {nodeEnd: "source", read: (s) => s.getSourceArrivalConsecutiveTime()};
    }

    if (kind === "arrival" && scale === "periodic") {
      return direction === "forward"
        ? {nodeEnd: "target", read: (s) => s.getTargetArrival()}
        : {nodeEnd: "source", read: (s) => s.getSourceArrival()};
    }

    if (kind === "departure" && scale === "consecutive") {
      return direction === "forward"
        ? {nodeEnd: "source", read: (s) => s.getSourceDepartureConsecutiveTime()}
        : {nodeEnd: "target", read: (s) => s.getTargetDepartureConsecutiveTime()};
    }

    if (kind === "departure" && scale === "periodic") {
      return direction === "forward"
        ? {nodeEnd: "source", read: (s) => s.getSourceDeparture()}
        : {nodeEnd: "target", read: (s) => s.getTargetDeparture()};
    }

    throw new Error(`Unsupported time accessor: ${kind}/${scale}/${direction}`);
  }

  /** Single entry point for all arrival/departure lookups, see TIME_ACCESSORS. */
  private getNodeTime(
    occurrence: NodeTrackTrainrunOccurrence,
    kind: TimeKind,
    scale: TimeScale,
  ): number | undefined {
    const section = kind === "arrival" ? occurrence.arrivalSection : occurrence.departureSection;
    const direction =
      kind === "arrival" ? occurrence.arrivalDirection : occurrence.departureDirection;
    if (section === undefined || direction === undefined) {
      return undefined;
    }

    const accessor = InfrastructureEstimatorService.getTimeAccessor(kind, scale, direction);
    const nodeIdAtEnd =
      accessor.nodeEnd === "target" ? section.getTargetNodeId() : section.getSourceNodeId();
    return nodeIdAtEnd === occurrence.node.getId() ? accessor.read(section) : undefined;
  }

  // =========================================================================
  // Small helpers
  // =========================================================================

  private maxOf<T>(items: T[], selector: (item: T) => number): number {
    return items.reduce((maximum, item) => Math.max(maximum, selector(item)), 0);
  }

  private pushToGroup<K, V>(groups: Map<K, V[]>, key: K, value: V): void {
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [value]);
    } else {
      group.push(value);
    }
  }
}
