import {Direction} from "../../data-structures/business.data.structures";
import {InfrastructureEstimatorService} from "./infrastructure-estimator.service";

type NodeTrackTrainrunOccurrence = Parameters<
  InfrastructureEstimatorService["estimateNodeTracks"]
>[0][number];

function createOccurrence(overrides: Partial<NodeTrackTrainrunOccurrence> = {}) {
  const category = {
    fachCategory: "HaltezeitIPV",
    minimalTurnaroundTime: 0,
    nodeHeadwayStop: 2,
    nodeHeadwayNonStop: 5,
  };
  const node = {
    getId: () => 1,
    getTrainrunCategoryHaltezeit: () => ({HaltezeitIPV: {haltezeit: 3, no_halt: false}}),
  } as any;
  const trainrun = {
    getId: () => 10,
    getFrequency: () => 10,
    getDirection: () => Direction.ROUND_TRIP,
    getTrainrunCategory: () => category,
  } as any;
  return {
    node,
    trainrun,
    occurrenceIndex: 0,
    ...overrides,
  } as NodeTrackTrainrunOccurrence;
}

function createSection(times: {
  sourceArrival?: number;
  sourceDeparture?: number;
  targetArrival?: number;
  targetDeparture?: number;
}) {
  return {
    getSourceNodeId: () => 1,
    getTargetNodeId: () => 2,
    getSourceArrivalConsecutiveTime: () => times.sourceArrival,
    getSourceDepartureConsecutiveTime: () => times.sourceDeparture,
    getTargetArrivalConsecutiveTime: () => times.targetArrival,
    getTargetDepartureConsecutiveTime: () => times.targetDeparture,
  } as any;
}

describe("InfrastructureEstimatorService node tracks", () => {
  let service: InfrastructureEstimatorService;

  beforeEach(() => {
    service = new InfrastructureEstimatorService();
  });

  it("uses the node halt time at a one-way departure endpoint", () => {
    const section = createSection({sourceDeparture: 10});
    const occurrence = createOccurrence({
      trainrun: {
        ...createOccurrence().trainrun,
        getDirection: () => Direction.ONE_WAY,
      } as any,
      departureSection: section,
      departureDirection: "forward",
    });

    const [track] = service.estimateNodeTracks([occurrence], {
      windowMinutes: 60,
      separateForwardBackwardTracks: false,
    });

    expect(track.occupancies.find((occupancy) => occupancy.arrivalMinute === 7)).toEqual(
      jasmine.objectContaining({arrivalMinute: 7, departureMinute: 10, headwayUntilMinute: 10}),
    );
  });

  it("uses the node halt time at a one-way arrival endpoint", () => {
    const section = createSection({targetArrival: 20});
    const occurrence = createOccurrence({
      node: {
        getId: () => 2,
        getTrainrunCategoryHaltezeit: () => ({HaltezeitIPV: {haltezeit: 3, no_halt: false}}),
      } as any,
      trainrun: {
        ...createOccurrence().trainrun,
        getDirection: () => Direction.ONE_WAY,
      } as any,
      arrivalSection: section,
      arrivalDirection: "forward",
    });

    const [track] = service.estimateNodeTracks([occurrence], {
      windowMinutes: 60,
      separateForwardBackwardTracks: false,
    });

    expect(track.occupancies.find((occupancy) => occupancy.arrivalMinute === 20)).toEqual(
      jasmine.objectContaining({arrivalMinute: 20, departureMinute: 23, headwayUntilMinute: 23}),
    );
  });

  it("applies the non-stop node headway for a round-trip transit", () => {
    const section = createSection({sourceArrival: 20, sourceDeparture: 22});
    const occurrence = createOccurrence({
      arrivalSection: section,
      arrivalDirection: "backward",
      departureSection: section,
      departureDirection: "forward",
      transition: {getId: () => 7, getIsNonStopTransit: () => true} as any,
    });

    const [track] = service.estimateNodeTracks([occurrence], {
      windowMinutes: 60,
      separateForwardBackwardTracks: false,
    });

    const occupancy = track.occupancies.find((item) => item.arrivalMinute === 20);
    expect(occupancy.headwayUntilMinute).toBe(27);
    expect(occupancy.transitionId).toBe(7);
  });

  it("keeps opposite directions on separate tracks when requested", () => {
    const forward = createOccurrence({
      arrivalSection: createSection({sourceArrival: 10}),
      arrivalDirection: "backward",
      departureSection: createSection({sourceDeparture: 12}),
      departureDirection: "forward",
    });
    const backward = createOccurrence({
      node: {
        getId: () => 2,
        getTrainrunCategoryHaltezeit: () => ({HaltezeitIPV: {haltezeit: 3, no_halt: false}}),
      } as any,
      trainrun: {
        ...createOccurrence().trainrun,
        getId: () => 11,
      } as any,
      occurrenceIndex: 1,
      arrivalSection: createSection({targetArrival: 10}),
      arrivalDirection: "forward",
      departureSection: createSection({targetDeparture: 12}),
      departureDirection: "backward",
    });

    const tracks = service.estimateNodeTracks([forward, backward], {
      windowMinutes: 60,
      separateForwardBackwardTracks: true,
    });

    expect(tracks.length).toBe(2);
  });
});
