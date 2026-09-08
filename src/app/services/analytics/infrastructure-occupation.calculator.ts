import {Node} from "../../models/node.model";
import {Resource} from "../../models/resource.model";
import {TrainrunSection} from "../../models/trainrunsection.model";

export interface NodeTrackReservation {
  nodeId: number;
  trainrunSection: TrainrunSection;
  startMinute: number;
  endMinute: number;
  trackNumber: number;
  exceedsCapacity: boolean;
}

export interface NodeTrackOccupation {
  capacity?: number;
  maximumRequiredTrackCount: number;
  capacityExceeded: boolean;
  reservations: NodeTrackReservation[];
}

export interface SectionTopologyEdge {
  sourceNodeId: number;
  targetNodeId: number;
  resourceId: number;
  capacity?: number;
  trainrunSections: TrainrunSection[];
}

export interface InfrastructureOccupation {
  horizonMinutes: number;
  nodeOccupations: Map<number, NodeTrackOccupation>;
  sectionTopology: SectionTopologyEdge[];
}

export function calculateInfrastructureAnalysisHorizon(
  trainrunSections: TrainrunSection[],
  maximumHorizonMinutes = 24 * 60,
): number {
  return trainrunSections.reduce((horizonMinutes, section) => {
    const frequency = section.getFrequency();
    if (frequency === null || frequency <= 0) {
      return horizonMinutes;
    }
    const expandedHorizon = leastCommonMultiple(horizonMinutes, frequency);
    return expandedHorizon > maximumHorizonMinutes ? maximumHorizonMinutes : expandedHorizon;
  }, 60);
}

/**
 * Calculates operational infrastructure usage without presentation-model
 * dependencies. The time horizon is cyclic, so all frequency instances that
 * overlap the horizon are allocated to the first free node track.
 */
export function calculateInfrastructureOccupation(
  nodes: Node[],
  trainrunSections: TrainrunSection[],
  resources: Resource[],
  horizonMinutes = calculateInfrastructureAnalysisHorizon(trainrunSections),
): InfrastructureOccupation {
  const resourcesById = new Map(resources.map((resource) => [resource.getId(), resource]));
  const reservationsByNodeId = new Map<number, UnallocatedReservation[]>();

  nodes.forEach((node) => {
    addTransitionReservations(node, reservationsByNodeId, horizonMinutes);
    addEndpointReservations(node, trainrunSections, reservationsByNodeId, horizonMinutes);
  });

  return {
    horizonMinutes,
    nodeOccupations: new Map(
      [...reservationsByNodeId.entries()].map(([nodeId, reservations]) => [
        nodeId,
        allocateTracks(
          reservations,
          resourcesById
            .get(nodes.find((node) => node.getId() === nodeId)?.getResourceId())
            ?.getCapacity(),
        ),
      ]),
    ),
    sectionTopology: createSectionTopology(trainrunSections, resourcesById),
  };
}

interface UnallocatedReservation {
  nodeId: number;
  trainrunSection: TrainrunSection;
  startMinute: number;
  endMinute: number;
}

function addTransitionReservations(
  node: Node,
  reservationsByNodeId: Map<number, UnallocatedReservation[]>,
  horizonMinutes: number,
) {
  node.getTransitions().forEach((transition) => {
    const {trainrunSection1, trainrunSection2} = node.getTrainrunSections(transition.getId());
    const directions = trainrunSection1.getTrainrun().isRoundTrip()
      ? [
          [trainrunSection1, trainrunSection2],
          [trainrunSection2, trainrunSection1],
        ]
      : [getShortestTransitionDirection(node, trainrunSection1, trainrunSection2)];

    directions.forEach(([arrivalSection, departureSection]) => {
      const startMinute = node.getArrivalConsecutiveTime(arrivalSection);
      const departureMinute = node.getDepartureConsecutiveTime(departureSection);
      const dwellEndMinute = departureMinute < startMinute ? departureMinute + 60 : departureMinute;
      const headway = transition.getIsNonStopTransit()
        ? arrivalSection.getTrainrun().getTrainrunCategory().nodeHeadwayNonStop
        : arrivalSection.getTrainrun().getTrainrunCategory().nodeHeadwayStop;
      addUnrolledReservation(
        reservationsByNodeId,
        {nodeId: node.getId(), trainrunSection: arrivalSection, startMinute, endMinute: dwellEndMinute + headway},
        arrivalSection.getFrequency() ?? 60,
        horizonMinutes,
      );
    });
  });
}

function getShortestTransitionDirection(
  node: Node,
  first: TrainrunSection,
  second: TrainrunSection,
): [TrainrunSection, TrainrunSection] {
  const firstDuration = transitionDuration(node, first, second);
  const secondDuration = transitionDuration(node, second, first);
  return firstDuration <= secondDuration ? [first, second] : [second, first];
}

function transitionDuration(node: Node, arrivalSection: TrainrunSection, departureSection: TrainrunSection): number {
  const arrivalMinute = node.getArrivalConsecutiveTime(arrivalSection);
  const departureMinute = node.getDepartureConsecutiveTime(departureSection);
  return departureMinute < arrivalMinute ? departureMinute + 60 - arrivalMinute : departureMinute - arrivalMinute;
}

function addEndpointReservations(
  node: Node,
  trainrunSections: TrainrunSection[],
  reservationsByNodeId: Map<number, UnallocatedReservation[]>,
  horizonMinutes: number,
) {
  trainrunSections.forEach((section) => {
    if (
      (section.getSourceNodeId() !== node.getId() && section.getTargetNodeId() !== node.getId()) ||
      node.getNextTrainrunSection(section) !== undefined
    ) {
      return;
    }

    const stopTime = Math.floor(
      node.getTrainrunCategoryHaltezeit()[section.getTrainrun().getTrainrunCategory().fachCategory]
        .haltezeit,
    );
    const headway = section.getTrainrun().getTrainrunCategory().nodeHeadwayStop;
    const isSourceNode = section.getSourceNodeId() === node.getId();
    const departureMinute = node.getDepartureConsecutiveTime(section);
    const arrivalMinute = node.getArrivalConsecutiveTime(section);
    addUnrolledReservation(
      reservationsByNodeId,
      {
        nodeId: node.getId(),
        trainrunSection: section,
        startMinute: isSourceNode ? departureMinute - stopTime : arrivalMinute,
        endMinute: isSourceNode ? departureMinute + headway : arrivalMinute + stopTime + headway,
      },
      section.getFrequency() ?? 60,
      horizonMinutes,
    );
  });
}

function addUnrolledReservation(
  reservationsByNodeId: Map<number, UnallocatedReservation[]>,
  reservation: Omit<UnallocatedReservation, "startMinute" | "endMinute"> & {
    startMinute: number;
    endMinute: number;
  },
  frequency: number,
  horizonMinutes: number,
) {
  if (frequency <= 0) {
    return;
  }
  const reservations = reservationsByNodeId.get(reservation.nodeId) ?? [];
  const firstOffset = Math.floor(-reservation.endMinute / frequency);
  const lastOffset = Math.ceil((horizonMinutes - reservation.startMinute) / frequency);
  for (let offset = firstOffset; offset <= lastOffset; offset += 1) {
    const startMinute = reservation.startMinute + offset * frequency;
    const endMinute = reservation.endMinute + offset * frequency;
    if (endMinute > 0 && startMinute < horizonMinutes) {
      reservations.push({
        ...reservation,
        startMinute: Math.max(0, startMinute),
        endMinute: Math.min(horizonMinutes, endMinute),
      });
    }
  }
  reservationsByNodeId.set(reservation.nodeId, reservations);
}

function allocateTracks(
  reservations: UnallocatedReservation[],
  capacity?: number,
): NodeTrackOccupation {
  const trackEndMinutes: number[] = [];
  const allocatedReservations = [...reservations]
    .sort(
      (left, right) =>
        left.startMinute - right.startMinute ||
        left.endMinute - right.endMinute ||
        left.trainrunSection.getId() - right.trainrunSection.getId(),
    )
    .map((reservation) => {
      const freeTrack = trackEndMinutes.findIndex((endMinute) => endMinute <= reservation.startMinute);
      const trackIndex = freeTrack === -1 ? trackEndMinutes.length : freeTrack;
      trackEndMinutes[trackIndex] = reservation.endMinute;
      return {
        ...reservation,
        trackNumber: trackIndex + 1,
        exceedsCapacity: capacity !== undefined && trackIndex + 1 > capacity,
      };
    });

  const maximumRequiredTrackCount = trackEndMinutes.length;
  return {
    ...(capacity === undefined ? {} : {capacity}),
    maximumRequiredTrackCount,
    capacityExceeded: capacity !== undefined && maximumRequiredTrackCount > capacity,
    reservations: allocatedReservations,
  };
}

function createSectionTopology(
  trainrunSections: TrainrunSection[],
  resourcesById: Map<number, Resource>,
): SectionTopologyEdge[] {
  const edges = new Map<string, SectionTopologyEdge>();
  trainrunSections.forEach((section) => {
    const sourceNodeId = Math.min(section.getSourceNodeId(), section.getTargetNodeId());
    const targetNodeId = Math.max(section.getSourceNodeId(), section.getTargetNodeId());
    const resourceId = section.getResourceId();
    const key = `${sourceNodeId}:${targetNodeId}:${resourceId}`;
    const edge = edges.get(key) ?? {
      sourceNodeId,
      targetNodeId,
      resourceId,
      ...(resourcesById.has(resourceId)
        ? {capacity: resourcesById.get(resourceId).getCapacity()}
        : {}),
      trainrunSections: [],
    };
    edge.trainrunSections.push(section);
    edges.set(key, edge);
  });
  return [...edges.values()];
}

function leastCommonMultiple(left: number, right: number): number {
  return Math.abs(left * right) / greatestCommonDivisor(left, right);
}

function greatestCommonDivisor(left: number, right: number): number {
  let dividend = Math.abs(left);
  let divisor = Math.abs(right);
  while (divisor !== 0) {
    const remainder = dividend % divisor;
    dividend = divisor;
    divisor = remainder;
  }
  return dividend;
}