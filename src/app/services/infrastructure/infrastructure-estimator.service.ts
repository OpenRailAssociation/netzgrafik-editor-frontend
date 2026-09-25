import {Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {Trainrun} from "../../models/trainrun.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Transition} from "../../models/transition.model";
import {Port} from "../../models/port.model";
import {Direction} from "../../data-structures/business.data.structures";
import {PortAlignment} from "../../data-structures/technical.data.structures";

interface SectionTrackEstimateInput {
  departureMinute: number;
  arrivalMinute: number;
  backward: boolean;
  frequencyMinutes: number;
  sectionHeadwayMinutes: number;
}

type TrainrunSectionDirection = "forward" | "backward";
type NodeTrackPass = 1 | 2 | 3;
type NodeTrackTransit = "stop" | "non-stop" | "endpoint";

interface NodeTrackTrainrunOccurrence {
  node: Node;
  trainrun: Trainrun;
  arrivalSection?: TrainrunSection;
  arrivalDirection?: TrainrunSectionDirection;
  departureSection?: TrainrunSection;
  departureDirection?: TrainrunSectionDirection;
  transition?: Transition;
  separateByDirection?: boolean;
  trackGroupId?: string;
  unrollOnlyEvenFrequencyOffsets?: number;
  maxUnrollOnlyEvenFrequencyOffsets?: number;
  // 1 = runs through the node, 2 = round-trip turnaround, 3 = one-way start or end.
  pass: NodeTrackPass;
  occurrenceIndex: number;
}

interface NodeTrackEstimatorOptions {
  windowMinutes?: number;
  windowStartMinutes?: number;
  separateForwardBackwardTracks?: boolean;
}

interface NodeTrackOccupancy {
  arrivalMinute: number;
  departureMinute: number;
  headwayUntilMinute: number;
  trainrunId: number;
  arrivalSectionId?: number;
  departureSectionId?: number;
  transitionId?: number;
  direction: Direction;
  travelDirection?: TrainrunSectionDirection;
  separateByDirection: boolean;
  trackGroupId?: string;
  occurrenceIndex: number;
}

interface NodeTrackEstimate {
  track: number;
  occupancies: NodeTrackOccupancy[];
}

interface NodeTrackBlock {
  occurrenceIndex: number;
  pass: NodeTrackPass;
  trackGroupId?: string;
  corridorKey: string;
  transit: NodeTrackTransit;
  occupancies: NodeTrackOccupancy[];
  categoryOrder: number;
  categoryShortName: string;
  trainrunTitle: string;
  firstArrival: number;
}

interface NodeTrackEstimationWindow {
  maximumFrequency: number;
  windowMinutes: number;
  calculationStartMinutes: number;
  cycleStart: number;
  representativeRoundTrips: boolean;
}

interface NodeTrackTimes {
  arrivalMinute: number;
  departureMinute: number;
  headwayUntilMinute: number;
}

interface NodeTrackDebugDecision {
  candidates: Array<{track: NodeTrackEstimate; conflicts: number[]}>;
  selectedTrack: NodeTrackEstimate;
  reason: string;
}

export interface NodeTrackAssignment {
  trainrunId: number;
  arrivalSectionId?: number;
  departureSectionId?: number;
  track: number;
  occupancies: Array<{
    arrivalMinute: number;
    departureMinute: number;
    headwayUntilMinute: number;
  }>;
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

  private nodeTrackDebugDecisions = new Map<NodeTrackBlock, NodeTrackDebugDecision>();

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
    const unrollingWindow = Math.max(maximumFrequency, maximumTravelTime);
    const frequencyOffsetWindow = this.getMaximumFrequencyOffsetWindow(sections, unrollingWindow);
    if (unrollingWindow <= 0 || maximumFrequency <= 0) {
      return [];
    }
    return this.estimateTrackSegments(sections, maximumFrequency, frequencyOffsetWindow);
  }

  estimateNodeTracks(
    node: Node,
    trainrunSections: TrainrunSection[],
    options: NodeTrackEstimatorOptions = {},
  ): NodeTrackEstimate[] {
    const occurrences = this.createNodeTrackOccurrences(node, trainrunSections);
    return this.estimateNodeTracksForNode(occurrences, options);
  }

  private estimateNodeTracksForNode(
    occurrences: NodeTrackTrainrunOccurrence[],
    options: NodeTrackEstimatorOptions,
  ): NodeTrackEstimate[] {
    const maximumFrequency = this.getMaximumNodeTrackFrequency(occurrences);
    if (maximumFrequency === 0) {
      return [];
    }

    const window = this.getNodeTrackEstimationWindow(options, maximumFrequency);
    const blocks = this.createSortedNodeTrackBlocks(occurrences, window);
    const tracks = this.allocateNodeTracks(blocks, options);
    return this.createNodeTrackEstimates(tracks);
  }

  private getMaximumNodeTrackFrequency(occurrences: NodeTrackTrainrunOccurrence[]): number {
    return occurrences.reduce(
      (maximum, occurrence) => Math.max(maximum, occurrence.trainrun.getFrequency()),
      0,
    );
  }

  private getNodeTrackEstimationWindow(
    options: NodeTrackEstimatorOptions,
    maximumFrequency: number,
  ): NodeTrackEstimationWindow {
    // Keep extra cycles around the requested range; the viewport owns final culling.
    const requestedWindowMinutes = Math.max(
      options.windowMinutes ?? maximumFrequency,
      maximumFrequency,
    );
    const cycleStart = options.windowStartMinutes ?? requestedWindowMinutes - maximumFrequency;
    const expansionMinutes = 2 * maximumFrequency;
    return {
      maximumFrequency,
      windowMinutes: requestedWindowMinutes + expansionMinutes,
      calculationStartMinutes: cycleStart - expansionMinutes,
      cycleStart,
      representativeRoundTrips: options.windowStartMinutes === undefined,
    };
  }

  private createSortedNodeTrackBlocks(
    occurrences: NodeTrackTrainrunOccurrence[],
    window: NodeTrackEstimationWindow,
  ): NodeTrackBlock[] {
    // Build every occurrence first; allocation happens only after the order is stable.
    return occurrences
      .flatMap((occurrence) => this.createNodeTrackBlocks(occurrence, window))
      .sort((first, second) => this.compareNodeTrackBlocks(first, second));
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

  private allocateNodeTracks(
    blocks: NodeTrackBlock[],
    options: NodeTrackEstimatorOptions,
  ): NodeTrackEstimate[] {
    const separateDirections = options.separateForwardBackwardTracks ?? true;
    return separateDirections
      ? this.allocateDirectionalNodeTracks(blocks)
      : this.allocateSharedNodeTracks(blocks);
  }

  private createNodeTrackEstimates(tracks: NodeTrackEstimate[]): NodeTrackEstimate[] {
    return tracks.map((track, index) => ({
      track: index + 1,
      occupancies: track.occupancies.sort(
        (first, second) => first.arrivalMinute - second.arrivalMinute,
      ),
    }));
  }

  private allocateSharedNodeTracks(blocks: NodeTrackBlock[]): NodeTrackEstimate[] {
    const tracks: NodeTrackEstimate[] = [];
    this.appendNodeTrackBlocks(tracks, this.filterNodeTrackBlocksByPass(blocks, 1));
    this.appendNodeTrackBlocks(tracks, this.filterNodeTrackBlocksByPass(blocks, 2));
    this.appendNodeTrackBlocks(tracks, this.filterNodeTrackBlocksByPass(blocks, 3));
    return tracks;
  }

  private allocateDirectionalNodeTracks(blocks: NodeTrackBlock[]): NodeTrackEstimate[] {
    const corridorGroups = this.groupNodeTrackBlocksByCorridor(blocks);
    const tracks = corridorGroups.flatMap((corridorGroup) => {
      const directionalGroups = this.groupNodeTrackBlocksByDirection(corridorGroup);
      const forwardTracks = this.allocateDirectionalBlockGroups(directionalGroups[0] ?? []);
      const backwardTracks = this.allocateDirectionalBlockGroups(directionalGroups[1] ?? []);
      return [...forwardTracks, ...backwardTracks.reverse()];
    });

    // Turnarounds and one-way endpoints use the tracks created by through-trains.
    this.appendNodeTrackBlocks(tracks, this.filterNodeTrackBlocksByPass(blocks, 2).reverse());
    this.appendNodeTrackBlocks(tracks, this.filterNodeTrackBlocksByPass(blocks, 3));
    return tracks;
  }

  private groupNodeTrackBlocksByCorridor(blocks: NodeTrackBlock[]): NodeTrackBlock[][] {
    const corridorGroups = new Map<string, NodeTrackBlock[]>();
    this.filterNodeTrackBlocksByPass(blocks, 1).forEach((block) => {
      corridorGroups.set(block.corridorKey, [
        ...(corridorGroups.get(block.corridorKey) ?? []),
        block,
      ]);
    });
    return Array.from(corridorGroups.values()).sort(
      (first, second) =>
        this.getFirstNodeTrackOccurrenceIndex(first) -
        this.getFirstNodeTrackOccurrenceIndex(second),
    );
  }

  private groupNodeTrackBlocksByDirection(blocks: NodeTrackBlock[]): NodeTrackBlock[][] {
    const directionGroups = new Map<string, NodeTrackBlock[]>();
    blocks.forEach((block) => {
      if (block.trackGroupId === undefined) {
        return;
      }
      directionGroups.set(block.trackGroupId, [
        ...(directionGroups.get(block.trackGroupId) ?? []),
        block,
      ]);
    });
    return Array.from(directionGroups.values()).sort(
      (first, second) =>
        this.getFirstNodeTrackOccurrenceIndex(first) -
        this.getFirstNodeTrackOccurrenceIndex(second),
    );
  }

  private allocateDirectionalBlockGroups(blocks: NodeTrackBlock[]): NodeTrackEstimate[] {
    const tracks: NodeTrackEstimate[] = [];
    const stopBlocks = blocks.filter((block) => block.transit === "stop");
    this.appendNodeTrackBlocks(tracks, stopBlocks);

    // Non-stop movements do not share the stop-train allocation block.
    blocks
      .filter((block) => block.transit !== "stop")
      .forEach((block) => this.appendNodeTrackBlocks(tracks, [block]));
    return tracks;
  }

  private getFirstNodeTrackOccurrenceIndex(blocks: NodeTrackBlock[]): number {
    return Math.min(...blocks.map((block) => block.occurrenceIndex));
  }

  private filterNodeTrackBlocksByPass(
    blocks: NodeTrackBlock[],
    pass: NodeTrackPass,
  ): NodeTrackBlock[] {
    return blocks.filter((block) => block.pass === pass);
  }

  private appendNodeTrackBlocks(tracks: NodeTrackEstimate[], blocks: NodeTrackBlock[]): void {
    blocks.forEach((block) => {
      const firstFitIndex = tracks.findIndex((candidate) =>
        this.canPlaceNodeTrackBlock(candidate, block),
      );
      const consideredTracks = tracks.slice(0, firstFitIndex >= 0 ? firstFitIndex + 1 : undefined);
      const track = firstFitIndex >= 0 ? tracks[firstFitIndex] : undefined;
      const selectedTrack = track ?? {
        track: tracks.length + 1,
        occupancies: [...block.occupancies],
      };
      this.nodeTrackDebugDecisions.set(block, {
        candidates: consideredTracks.map((candidate) => ({
          track: candidate,
          conflicts: this.getNodeTrackBlockConflicts(candidate, block),
        })),
        selectedTrack,
        reason: firstFitIndex >= 0 ? "first-fit" : "new-track",
      });
      if (track === undefined) {
        tracks.push(selectedTrack);
        return;
      }
      track.occupancies.push(...block.occupancies);
    });
  }

  private createNodeTrackBlocks(
    occurrence: NodeTrackTrainrunOccurrence,
    window: NodeTrackEstimationWindow,
  ): NodeTrackBlock[] {
    const times = this.getNodeTrackTimes(occurrence);
    const frequency = occurrence.trainrun.getFrequency();
    if (times === undefined || frequency <= 0) {
      return [];
    }

    const pass = occurrence.pass;
    const offsets = this.getNodeTrackOffsets(occurrence, times, frequency, window);
    const strandCount = this.getNodeTrackStrandCount(times, frequency);
    const strands = this.groupNodeTrackOccupanciesByStrand(
      occurrence,
      times,
      frequency,
      offsets,
      strandCount,
      pass,
    );
    return this.createBlocksFromNodeTrackStrands(occurrence, strands, pass, window);
  }

  private getNodeTrackOffsets(
    occurrence: NodeTrackTrainrunOccurrence,
    times: NodeTrackTimes,
    frequency: number,
    window: NodeTrackEstimationWindow,
  ): number[] {
    const firstOffset = Math.floor(
      (window.calculationStartMinutes - times.headwayUntilMinute) / frequency,
    );
    const lastOffset = Math.ceil((window.windowMinutes - times.arrivalMinute) / frequency);
    return Array.from({length: lastOffset - firstOffset + 1}, (_, index) => firstOffset + index)
      .filter((offset) => this.isNodeTrackOffsetAllowed(occurrence, offset))
      .filter((offset) => {
        const shiftedArrival = times.arrivalMinute + offset * frequency;
        const shiftedHeadway = times.headwayUntilMinute + offset * frequency;
        return (
          shiftedHeadway > window.calculationStartMinutes && shiftedArrival < window.windowMinutes
        );
      });
  }

  private getNodeTrackStrandCount(times: NodeTrackTimes, frequency: number): number {
    // A block longer than one frequency cycle needs more than one physical strand.
    return Math.max(1, Math.ceil((times.headwayUntilMinute - times.arrivalMinute) / frequency));
  }

  private groupNodeTrackOccupanciesByStrand(
    occurrence: NodeTrackTrainrunOccurrence,
    times: NodeTrackTimes,
    frequency: number,
    offsets: number[],
    strandCount: number,
    pass: NodeTrackPass,
  ): Map<number, NodeTrackOccupancy[]> {
    const strands = new Map<number, NodeTrackOccupancy[]>();
    offsets.forEach((offset) => {
      const strand = this.modulo(offset + (pass === 2 ? 1 : 0), strandCount);
      const occupancies = strands.get(strand) ?? [];
      occupancies.push({
        arrivalMinute: times.arrivalMinute + offset * frequency,
        departureMinute: times.departureMinute + offset * frequency,
        headwayUntilMinute: times.headwayUntilMinute + offset * frequency,
        trainrunId: occurrence.trainrun.getId(),
        arrivalSectionId: occurrence.arrivalSection?.getId(),
        departureSectionId: occurrence.departureSection?.getId(),
        transitionId: occurrence.transition?.getId(),
        direction: occurrence.trainrun.getDirection(),
        travelDirection: occurrence.departureDirection ?? occurrence.arrivalDirection,
        separateByDirection: occurrence.separateByDirection !== false,
        trackGroupId: occurrence.trackGroupId,
        occurrenceIndex: occurrence.occurrenceIndex,
      });
      strands.set(strand, occupancies);
    });
    return strands;
  }

  private createBlocksFromNodeTrackStrands(
    occurrence: NodeTrackTrainrunOccurrence,
    strands: Map<number, NodeTrackOccupancy[]>,
    pass: NodeTrackPass,
    window: NodeTrackEstimationWindow,
  ): NodeTrackBlock[] {
    return Array.from(strands.entries())
      .sort(([firstStrand], [secondStrand]) => firstStrand - secondStrand)
      .map(([, occupancies]) =>
        window.representativeRoundTrips && pass === 2
          ? occupancies
              .filter((occupancy) => occupancy.arrivalMinute >= window.cycleStart - 1)
              .slice(0, 1)
          : occupancies,
      )
      .filter((occupancies) => occupancies.length > 0)
      .map((occupancies) => ({
        occurrenceIndex: occurrence.occurrenceIndex,
        pass,
        trackGroupId: occurrence.trackGroupId,
        corridorKey: this.getNodeTrackCorridorKey(occurrence),
        transit:
          occurrence.transition === undefined
            ? "endpoint"
            : occurrence.transition.getIsNonStopTransit()
              ? "non-stop"
              : "stop",
        occupancies,
        categoryOrder: occurrence.trainrun.getTrainrunCategory().order,
        categoryShortName: occurrence.trainrun.getCategoryShortName(),
        trainrunTitle: occurrence.trainrun.getTitle(),
        firstArrival: Math.min(...occupancies.map((occupancy) => occupancy.arrivalMinute)),
      }));
  }

  /** Undirected neighbour pair of a movement, so A -> X -> B and B -> X -> A share one space. */
  private getNodeTrackCorridorKey(occurrence: NodeTrackTrainrunOccurrence): string {
    const fromNodeId = this.getOppositeNodeId(occurrence.node, occurrence.arrivalSection);
    const toNodeId = this.getOppositeNodeId(occurrence.node, occurrence.departureSection);
    if (fromNodeId === undefined || toNodeId === undefined) {
      return `${fromNodeId ?? "start"}-${toNodeId ?? "end"}`;
    }
    return `${Math.min(fromNodeId, toNodeId)}-${Math.max(fromNodeId, toNodeId)}`;
  }

  private getOppositeNodeId(node: Node, section: TrainrunSection | undefined): number | undefined {
    return section === undefined ? undefined : node.getOppositeNode(section)?.getId();
  }

  private modulo(value: number, divisor: number): number {
    return ((value % divisor) + divisor) % divisor;
  }

  private canPlaceNodeTrackBlock(track: NodeTrackEstimate, block: NodeTrackBlock): boolean {
    return this.getNodeTrackBlockConflicts(track, block).length === 0;
  }

  private getNodeTrackBlockConflicts(track: NodeTrackEstimate, block: NodeTrackBlock): number[] {
    return Array.from(
      new Set(
        block.occupancies.flatMap((candidate) =>
          track.occupancies
            .filter(
              (existing) =>
                candidate.headwayUntilMinute > existing.arrivalMinute &&
                existing.headwayUntilMinute > candidate.arrivalMinute,
            )
            .map((existing) => existing.occurrenceIndex),
        ),
      ),
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
    const pass = this.getNodeTrackOccurrencePass(trainrun, transition);
    const arrivalDirection =
      arrivalSection === undefined
        ? undefined
        : this.getNodeArrivalSectionDirection(node, arrivalSection);
    const departureDirection =
      departureSection === undefined
        ? undefined
        : this.getNodeDepartureSectionDirection(node, departureSection);
    occurrences.push(
      this.createNodeTrackOccurrence(
        node,
        trainrun,
        pass,
        arrivalSection,
        arrivalDirection,
        departureSection,
        departureDirection,
        transition,
        occurrences.length,
      ),
    );
  }

  private getNodeTrackOccurrencePass(
    trainrun: Trainrun,
    transition: Transition | undefined,
  ): NodeTrackPass {
    // A transition means the train passes through the node.
    if (transition !== undefined) {
      return 1;
    }
    // Without a transition, distinguish a round-trip from a one-way endpoint.
    return trainrun.getDirection() === Direction.ONE_WAY ? 3 : 2;
  }

  private createNodeTrackOccurrences(
    node: Node,
    trainrunSections: TrainrunSection[],
  ): NodeTrackTrainrunOccurrence[] {
    const nodeId = node.getId();
    const allowedSectionIds = new Set(trainrunSections.map((section) => section.getId()));

    const occurrences: NodeTrackTrainrunOccurrence[] = [];

    const orderedPorts = this.getOrderedNodePorts(node);

    const visitedTransitionIds = new Set<number>();
    const endingRoundTrip: TrainrunSection[] = [];
    const endingOneWay: TrainrunSection[] = [];

    // Step 1: create occurrences for every connected transition.
    for (const port of orderedPorts) {
      const section1 = this.getNodeTrackSection(port, allowedSectionIds);
      if (section1 === undefined) {
        continue;
      }
      const transition = node.getTransitionFromPortId(port.getId());
      if (transition === undefined) {
        if (section1.getTrainrun().getDirection() === Direction.ONE_WAY) {
          endingOneWay.push(section1);
        } else {
          endingRoundTrip.push(section1);
        }
        continue;
      }
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
      // A -> X -> B: the incoming section is the one ending at X.
      const incoming = section1.getTargetNodeId() === nodeId ? section1 : section2;
      const outgoing = incoming === section1 ? section2 : section1;
      const trainrun = incoming.getTrainrun();
      this.addNodeTrackOccurrence(occurrences, node, trainrun, incoming, outgoing, transition);
      if (trainrun.getDirection() !== Direction.ONE_WAY) {
        this.addNodeTrackOccurrence(occurrences, node, trainrun, outgoing, incoming, transition);
      }
    }

    // Step 2: add round-trip trains that turn around at an unconnected port.
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

    // Step 3: add one-way trains that start or end at this node.
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

  private getOrderedNodePorts(node: Node): ReturnType<Node["getPorts"]> {
    // Stable port order keeps track allocation reproducible across runs.
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

  private createNodeTrackOccurrence(
    node: Node,
    trainrun: Trainrun,
    pass: NodeTrackPass,
    arrivalSection: TrainrunSection | undefined,
    arrivalDirection: TrainrunSectionDirection | undefined,
    departureSection: TrainrunSection | undefined,
    departureDirection: TrainrunSectionDirection | undefined,
    transition: Transition | undefined,
    occurrenceIndex: number,
  ): NodeTrackTrainrunOccurrence {
    return {
      node,
      trainrun,
      arrivalSection,
      arrivalDirection,
      departureSection,
      departureDirection,
      transition,
      // Only trains running through the node are bound to a travel direction.
      separateByDirection: pass === 1,
      trackGroupId: this.getNodeTrackGroupId(node, arrivalSection, departureSection),
      pass,
      occurrenceIndex,
    };
  }

  private getNodeArrivalSectionDirection(
    node: Node,
    section: TrainrunSection,
  ): TrainrunSectionDirection {
    return section.getTargetNodeId() === node.getId() ? "forward" : "backward";
  }

  private getNodeDepartureSectionDirection(
    node: Node,
    section: TrainrunSection,
  ): TrainrunSectionDirection {
    return section.getSourceNodeId() === node.getId() ? "forward" : "backward";
  }

  private getNodeTrackGroupId(
    node: Node,
    arrivalSection: TrainrunSection | undefined,
    departureSection: TrainrunSection | undefined,
  ): string | undefined {
    if (arrivalSection === undefined && departureSection === undefined) {
      return undefined;
    }
    const nodeId = node.getId();
    const incomingNodeId =
      arrivalSection === undefined
        ? undefined
        : arrivalSection.getTargetNodeId() === nodeId
          ? arrivalSection.getSourceNodeId()
          : arrivalSection.getTargetNodeId();
    const outgoingNodeId =
      departureSection === undefined
        ? undefined
        : departureSection.getSourceNodeId() === nodeId
          ? departureSection.getTargetNodeId()
          : departureSection.getSourceNodeId();
    return `${incomingNodeId ?? "start"}->${nodeId}->${outgoingNodeId ?? "end"}`;
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
      (offset + Math.abs(Math.floor(Math.min(0, offset) / 24) * 24)) % (maximumOffset + 1);
    return normalizedOffset === (occurrence.unrollOnlyEvenFrequencyOffsets ?? 0);
  }

  private getNodeTrackTimes(occurrence: NodeTrackTrainrunOccurrence): NodeTrackTimes | undefined {
    // Step 1: resolve the timetable values at this node.
    const sectionTimes = this.getNodeSectionTimes(occurrence);
    const haltezeit = this.getNodeHaltezeit(occurrence.node, occurrence.trainrun);
    const category = occurrence.trainrun.getTrainrunCategory();
    const nodeHeadway = this.getNodeHeadway(occurrence, category);
    const endpoint = this.getNodeEndpointTimes(occurrence, sectionTimes, haltezeit, nodeHeadway);
    if (endpoint !== undefined) {
      return endpoint;
    }
    if (sectionTimes.arrivalMinute === undefined || sectionTimes.departureMinute === undefined) {
      return undefined;
    }

    // Step 2: align departure with arrival in the train's frequency cycle.
    const frequency = occurrence.trainrun.getFrequency();
    const consecutiveDepartureMinute = this.getConsecutiveDepartureMinute(
      sectionTimes.arrivalMinute,
      sectionTimes.departureMinute,
      frequency,
    );
    // Step 3: apply the turnaround rule for node-track estimation.
    return this.getTurnaroundNodeTrackTimes(
      occurrence,
      sectionTimes.arrivalMinute,
      consecutiveDepartureMinute,
      haltezeit,
      nodeHeadway,
      category.minimalTurnaroundTime,
      frequency,
    );
  }

  private getNodeSectionTimes(occurrence: NodeTrackTrainrunOccurrence): {
    arrivalMinute: number | undefined;
    departureMinute: number | undefined;
  } {
    return {
      arrivalMinute: this.getNodeArrivalTime(
        occurrence.node,
        occurrence.arrivalSection,
        occurrence.arrivalDirection,
      ),
      departureMinute: this.getNodeDepartureTime(
        occurrence.node,
        occurrence.departureSection,
        occurrence.departureDirection,
      ),
    };
  }

  private getNodeEndpointTimes(
    occurrence: NodeTrackTrainrunOccurrence,
    sectionTimes: {arrivalMinute: number | undefined; departureMinute: number | undefined},
    haltezeit: number,
    nodeHeadway: number,
  ): NodeTrackTimes | undefined {
    const isStart =
      occurrence.departureSection !== undefined && occurrence.arrivalSection === undefined;
    const isEnd =
      occurrence.arrivalSection !== undefined && occurrence.departureSection === undefined;
    if (!isStart && !isEnd) {
      return undefined;
    }

    const startTime = sectionTimes.departureMinute ?? sectionTimes.arrivalMinute;
    const endTime = sectionTimes.arrivalMinute ?? sectionTimes.departureMinute;
    if (startTime === undefined || endTime === undefined) {
      return undefined;
    }
    const releaseTime = isEnd ? endTime + haltezeit : startTime;
    return {
      arrivalMinute: isStart ? startTime - haltezeit : endTime,
      departureMinute: releaseTime,
      headwayUntilMinute: releaseTime + nodeHeadway,
    };
  }

  private getConsecutiveDepartureMinute(
    arrivalMinute: number,
    departureMinute: number,
    frequency: number,
  ): number {
    return frequency > 0
      ? departureMinute +
          Math.ceil(Math.max(0, arrivalMinute - departureMinute) / frequency) * frequency
      : departureMinute;
  }

  private getTurnaroundNodeTrackTimes(
    occurrence: NodeTrackTrainrunOccurrence,
    arrivalMinute: number,
    departureMinute: number,
    haltezeit: number,
    nodeHeadway: number,
    categoryMinimalTurnaroundTime: number,
    frequency: number,
  ): NodeTrackTimes {
    const isTurnaround = occurrence.transition === undefined;
    const adjustedDeparture = this.adjustTurnaroundDeparture(
      occurrence,
      arrivalMinute,
      departureMinute,
      categoryMinimalTurnaroundTime,
      haltezeit,
      frequency,
    );
    const minimalTurnaroundTime =
      Number.isFinite(categoryMinimalTurnaroundTime) && categoryMinimalTurnaroundTime > 0
        ? categoryMinimalTurnaroundTime
        : haltezeit;
    return {
      arrivalMinute,
      departureMinute: adjustedDeparture,
      headwayUntilMinute: isTurnaround
        ? Math.max(adjustedDeparture + nodeHeadway, arrivalMinute + minimalTurnaroundTime)
        : adjustedDeparture + nodeHeadway,
    };
  }

  private adjustTurnaroundDeparture(
    occurrence: NodeTrackTrainrunOccurrence,
    arrivalMinute: number,
    departureMinute: number,
    categoryMinimalTurnaroundTime: number,
    haltezeit: number,
    frequency: number,
  ): number {
    if (occurrence.transition !== undefined || frequency <= 0) {
      return departureMinute;
    }
    let adjustedDeparture = departureMinute;
    if (occurrence.pass === 2 && adjustedDeparture <= arrivalMinute) {
      const cyclesUntilAfterArrival =
        Math.floor((arrivalMinute - adjustedDeparture) / frequency) + 1;
      adjustedDeparture += cyclesUntilAfterArrival * frequency;
    }
    const minimalTurnaroundTime =
      Number.isFinite(categoryMinimalTurnaroundTime) && categoryMinimalTurnaroundTime > 0
        ? categoryMinimalTurnaroundTime
        : haltezeit;
    const turnaroundTime = adjustedDeparture - arrivalMinute;
    if (turnaroundTime > 0 && turnaroundTime < minimalTurnaroundTime) {
      adjustedDeparture +=
        Math.ceil((minimalTurnaroundTime - turnaroundTime) / frequency) * frequency;
    }
    return adjustedDeparture;
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
    const haltezeit =
      node.getTrainrunCategoryHaltezeit()[trainrun.getTrainrunCategory().fachCategory]?.haltezeit;
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

  private static mergeTracks(tracksMatrix: number[]): [number, number, number][] {
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
