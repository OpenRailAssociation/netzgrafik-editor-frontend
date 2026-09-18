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

  it("builds a node occurrence from filtered trainrun sections", () => {
    const node = {
      getId: () => 1,
      getTransition: (): undefined => undefined,
      getTrainrunCategoryHaltezeit: () => ({HaltezeitIPV: {haltezeit: 3, no_halt: false}}),
    } as any;
    const trainrun = {
      ...createOccurrence().trainrun,
      getDirection: () => Direction.ONE_WAY,
    } as any;
    const section = {
      getId: () => 4,
      getTrainrunId: () => 10,
      getTrainrun: () => trainrun,
      getSourceNodeId: () => 1,
      getTargetNodeId: () => 2,
      getSourceArrivalConsecutiveTime: (): undefined => undefined,
      getSourceDepartureConsecutiveTime: () => 10,
      getTargetArrivalConsecutiveTime: () => 20,
      getTargetDepartureConsecutiveTime: (): undefined => undefined,
    } as any;

    const [track] = service.estimateNodeTracks(node, [section], {
      windowMinutes: 60,
      separateForwardBackwardTracks: false,
    });

    expect(track.occupancies[0]).toEqual(
      jasmine.objectContaining({arrivalMinute: 7, departureMinute: 10, trainrunId: 10}),
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

  it("unrolls a roundtrip departure that crosses the period boundary", () => {
    const section = createSection({targetArrival: 55, targetDeparture: 5});
    const occurrence = createOccurrence({
      node: {
        getId: () => 2,
        getTrainrunCategoryHaltezeit: () => ({HaltezeitIPV: {haltezeit: 3, no_halt: false}}),
      } as any,
      trainrun: {
        ...createOccurrence().trainrun,
        getFrequency: () => 60,
      } as any,
      arrivalSection: section,
      arrivalDirection: "forward",
      departureSection: section,
      departureDirection: "backward",
    });

    const [track] = service.estimateNodeTracks([occurrence], {
      windowMinutes: 120,
      separateForwardBackwardTracks: false,
    });

    const occupancy = track.occupancies.find((item) => item.arrivalMinute === 55);
    expect(occupancy.departureMinute).toBe(65);
    expect(occupancy.headwayUntilMinute).toBe(67);
  });

  it("waits for the next roundtrip departure when the turnaround delta is too small", () => {
    const section = createSection({sourceArrival: 10, sourceDeparture: 13});
    const occurrence = createOccurrence({
      trainrun: {
        ...createOccurrence().trainrun,
        getFrequency: () => 15,
        getTrainrunCategory: () => ({
          ...createOccurrence().trainrun.getTrainrunCategory(),
          minimalTurnaroundTime: 4,
        }),
      } as any,
      arrivalSection: section,
      arrivalDirection: "backward",
      departureSection: section,
      departureDirection: "forward",
    });

    const [track] = service.estimateNodeTracks([occurrence], {
      windowMinutes: 60,
      separateForwardBackwardTracks: false,
    });

    const occupancy = track.occupancies.find((item) => item.arrivalMinute === 10);
    expect(occupancy).toEqual(
      jasmine.objectContaining({
        arrivalMinute: 10,
        departureMinute: 28,
        headwayUntilMinute: 30,
      }),
    );
  });

  it("keeps B2 occupied from minute 59 until minute 18 after a delayed turnaround", () => {
    const section = createSection({targetArrival: 59, targetDeparture: 1});
    const occurrence = createOccurrence({
      node: {
        getId: () => 2,
        getTrainrunCategoryHaltezeit: () => ({HaltezeitIPV: {haltezeit: 0, no_halt: false}}),
      } as any,
      trainrun: {
        ...createOccurrence().trainrun,
        getFrequency: () => 15,
        getTrainrunCategory: () => ({
          ...createOccurrence().trainrun.getTrainrunCategory(),
          minimalTurnaroundTime: 4,
        }),
      } as any,
      arrivalSection: section,
      arrivalDirection: "forward",
      departureSection: section,
      departureDirection: "backward",
    });

    const [track] = service.estimateNodeTracks([occurrence], {
      windowMinutes: 120,
      separateForwardBackwardTracks: false,
    });

    const occupancy = track.occupancies.find((item) => item.arrivalMinute === 59);
    expect(occupancy).toEqual(
      jasmine.objectContaining({
        arrivalMinute: 59,
        departureMinute: 76,
        headwayUntilMinute: 78,
      }),
    );
  });

  it("clips an unrolled occupancy to the requested visible window", () => {
    const section = createSection({targetArrival: 55, targetDeparture: 5});
    const occurrence = createOccurrence({
      node: {
        getId: () => 2,
        getTrainrunCategoryHaltezeit: () => ({HaltezeitIPV: {haltezeit: 3, no_halt: false}}),
      } as any,
      trainrun: {
        ...createOccurrence().trainrun,
        getFrequency: () => 60,
      } as any,
      arrivalSection: section,
      arrivalDirection: "forward",
      departureSection: section,
      departureDirection: "backward",
    });

    const [track] = service.estimateNodeTracks([occurrence], {
      windowMinutes: 60,
      separateForwardBackwardTracks: false,
    });

    const occupancy = track.occupancies.find((item) => item.arrivalMinute === 55);
    expect(occupancy).toEqual(
      jasmine.objectContaining({
        arrivalMinute: 55,
        departureMinute: 60,
        headwayUntilMinute: 60,
      }),
    );
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

  it("keeps a minimum track for the opposite direction", () => {
    const occurrence = createOccurrence({
      arrivalSection: createSection({sourceArrival: 10}),
      arrivalDirection: "backward",
      departureSection: createSection({sourceDeparture: 12}),
      departureDirection: "forward",
    });

    const tracks = service.estimateNodeTracks([occurrence], {
      windowMinutes: 60,
      separateForwardBackwardTracks: true,
    });

    expect(tracks.length).toBe(2);
    expect(tracks[0].occupancies.length).toBeGreaterThan(0);
    expect(tracks[1].occupancies.length).toBe(0);
  });

  it("applies alternating unroll offsets for a constrained turnaround", () => {
    const occurrences = [0, 1].map((occurrenceIndex) =>
      createOccurrence({
        trainrun: {
          ...createOccurrence().trainrun,
          getFrequency: () => 15,
        } as any,
        arrivalSection: createSection({sourceArrival: 10}),
        arrivalDirection: "backward",
        departureSection: createSection({sourceDeparture: 12}),
        departureDirection: "forward",
        unrollOnlyEvenFrequencyOffsets: occurrenceIndex,
        maxUnrollOnlyEvenFrequencyOffsets: 1,
        occurrenceIndex,
      }),
    );

    const tracks = service.estimateNodeTracks(occurrences, {
      windowMinutes: 60,
      separateForwardBackwardTracks: false,
    });

    expect(tracks.length).toBe(1);
    expect(tracks[0].occupancies.map((occupancy) => occupancy.arrivalMinute).sort((a, b) => a - b)).toEqual([
      10,
      25,
      40,
      55,
    ]);
  });

  it("creates a separate track for every simultaneous incompatible occupancy", () => {
    const occurrences = [0, 1, 2].map((occurrenceIndex) =>
      createOccurrence({
        trainrun: {
          ...createOccurrence().trainrun,
          getId: () => 10 + occurrenceIndex,
        } as any,
        arrivalSection: createSection({sourceArrival: 10}),
        arrivalDirection: "backward",
        departureSection: createSection({sourceDeparture: 12}),
        departureDirection: "forward",
        occurrenceIndex,
      }),
    );

    const tracks = service.estimateNodeTracks(occurrences, {
      windowMinutes: 60,
      separateForwardBackwardTracks: false,
    });

    expect(tracks.length).toBe(3);
    tracks.forEach((track) => {
      track.occupancies.forEach((occupancy, index) => {
        track.occupancies.slice(index + 1).forEach((otherOccupancy) => {
          expect(
            occupancy.headwayUntilMinute <= otherOccupancy.arrivalMinute ||
              otherOccupancy.headwayUntilMinute <= occupancy.arrivalMinute,
          ).toBeTrue();
        });
      });
    });
  });

  it("shares the endpoint occupancy pool for a roundtrip and a one-way departure", () => {
    const roundtripSection = createSection({targetArrival: 10, targetDeparture: 20});
    const oneWaySection = createSection({sourceDeparture: 40});
    const roundtrip = createOccurrence({
      node: {
        getId: () => 2,
        getTrainrunCategoryHaltezeit: () => ({HaltezeitIPV: {haltezeit: 3, no_halt: false}}),
      } as any,
      arrivalSection: roundtripSection,
      arrivalDirection: "forward",
      departureSection: roundtripSection,
      departureDirection: "backward",
      separateByDirection: false,
    });
    const oneWay = createOccurrence({
      node: {
        getId: () => 2,
        getTrainrunCategoryHaltezeit: () => ({HaltezeitIPV: {haltezeit: 3, no_halt: false}}),
      } as any,
      trainrun: {
        ...createOccurrence().trainrun,
        getId: () => 11,
        getDirection: () => Direction.ONE_WAY,
      } as any,
      departureSection: oneWaySection,
      departureDirection: "forward",
      occurrenceIndex: 1,
      separateByDirection: false,
    });

    const tracks = service.estimateNodeTracks([roundtrip, oneWay], {
      windowMinutes: 60,
      separateForwardBackwardTracks: true,
    });

    expect(tracks.length).toBe(1);
  });

  it("separates an arriving one-way train from an occupied roundtrip turnaround", () => {
    const roundtripSection = createSection({targetArrival: 10, targetDeparture: 20});
    const oneWaySection = createSection({targetArrival: 15});
    const roundtrip = createOccurrence({
      node: {
        getId: () => 2,
        getTrainrunCategoryHaltezeit: () => ({HaltezeitIPV: {haltezeit: 3, no_halt: false}}),
      } as any,
      arrivalSection: roundtripSection,
      arrivalDirection: "forward",
      departureSection: roundtripSection,
      departureDirection: "backward",
      separateByDirection: false,
    });
    const oneWay = createOccurrence({
      node: {
        getId: () => 2,
        getTrainrunCategoryHaltezeit: () => ({HaltezeitIPV: {haltezeit: 3, no_halt: false}}),
      } as any,
      trainrun: {
        ...createOccurrence().trainrun,
        getId: () => 11,
        getDirection: () => Direction.ONE_WAY,
      } as any,
      arrivalSection: oneWaySection,
      arrivalDirection: "forward",
      occurrenceIndex: 1,
      separateByDirection: false,
    });

    const tracks = service.estimateNodeTracks([roundtrip, oneWay], {
      windowMinutes: 60,
      separateForwardBackwardTracks: true,
    });

    expect(tracks.length).toBe(2);
  });
});
