import {TrainrunCategory, TrainrunFrequency} from "../../data-structures/business.data.structures";
import {Node} from "../../models/node.model";
import {Trainrun} from "../../models/trainrun.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {
  InfrastructureEstimatorService,
  NodeTrackEstimate,
  NodeTrackEstimatorOptions,
} from "./infrastructure-estimator.service";
import {NetzgrafikTrackEstimatorTesting} from "../../../integration-testing/netzgrafik.unit.testing.track.estimator";

function getTrackEstimatorFixture() {
  const netzgrafik = NetzgrafikTrackEstimatorTesting.getUnitTestNetzgrafik();
  const nodes = new Map(netzgrafik.nodes.map((nodeDto) => [nodeDto.id, new Node(nodeDto)]));
  const trainruns = new Map(
    netzgrafik.trainruns.map((trainrunDto) => {
      const trainrun = new Trainrun(trainrunDto);
      trainrun.setTrainrunCategory(
        netzgrafik.metadata.trainrunCategories.find(
          (category) => category.id === trainrunDto.categoryId,
        ) as TrainrunCategory,
      );
      trainrun.setTrainrunFrequency(
        netzgrafik.metadata.trainrunFrequencies.find(
          (frequency) => frequency.id === trainrunDto.frequencyId,
        ) as TrainrunFrequency,
      );
      return [trainrun.getId(), trainrun] as const;
    }),
  );
  const sections = netzgrafik.trainrunSections.map((sectionDto) => {
    const section = new TrainrunSection(sectionDto);
    section.setSourceNode(nodes.get(sectionDto.sourceNodeId) as Node);
    section.setTargetNode(nodes.get(sectionDto.targetNodeId) as Node);
    section.setTrainrun(trainruns.get(sectionDto.trainrunId) as Trainrun);
    return section;
  });
  nodes.forEach((node) => node.initializePortsWithReferencesToTrainrunSections(sections));
  return {nodes, trainruns, sections};
}

function getOccupancies(tracks: NodeTrackEstimate[]) {
  return tracks.flatMap((track) => track.occupancies);
}

function getNodeTrackMatrix(
  service: InfrastructureEstimatorService,
  node: Node,
  sections: TrainrunSection[],
  options: NodeTrackEstimatorOptions,
) {
  return service.estimateNodeTracks(node, sections, options).flatMap((estimate) =>
    estimate.occupancies.map((occupancy) => ({
      trackId: estimate.track,
      trainrunId: occupancy.trainrunId,
      occurrenceIndex: occupancy.occurrenceIndex,
      arrivalTime: occupancy.arrivalMinute,
      departureTime: occupancy.departureMinute,
      blockedUntilTime: occupancy.headwayUntilMinute,
    })),
  );
}

function expectNoOverlappingTrackOccupancies(tracks: NodeTrackEstimate[]): void {
  tracks.forEach((track) => {
    const occupancies = [...track.occupancies].sort(
      (first, second) => first.arrivalMinute - second.arrivalMinute,
    );
    occupancies.slice(1).forEach((occupancy, index) => {
      expect(occupancy.arrivalMinute).toBeGreaterThanOrEqual(occupancies[index].headwayUntilMinute);
    });
  });
}

describe("InfrastructureEstimatorService node tracks", () => {
  let service: InfrastructureEstimatorService;

  beforeEach(() => {
    service = new InfrastructureEstimatorService();
  });

  it("does not overlap track occupancy for any fixture node", () => {
    const fixture = getTrackEstimatorFixture();

    fixture.nodes.forEach((node) => {
      const tracks = service.estimateNodeTracks(node, fixture.sections, {
        windowEndMinutes: 180,
        separateForwardBackwardTracks: false,
      });

      expectNoOverlappingTrackOccupancies(tracks);
    });
  });

  it("keeps the A1 matrix track assignments", () => {
    const fixture = getTrackEstimatorFixture();
    const a1 = fixture.nodes.get(182) as Node;
    const expectedRows = [
      {trainrunId: 99, arrivalTime: -60, departureTime: 0, trackId: 4},
      {trainrunId: 100, arrivalTime: -31, departureTime: 1, trackId: 1},
      {trainrunId: 100, arrivalTime: -1, departureTime: 31, trackId: 2},
      {trainrunId: 99, arrivalTime: 0, departureTime: 60, trackId: 3},
      {trainrunId: 100, arrivalTime: 29, departureTime: 61, trackId: 1},
      {trainrunId: 100, arrivalTime: 59, departureTime: 91, trackId: 2},
      {trainrunId: 99, arrivalTime: 60, departureTime: 120, trackId: 4},
      {trainrunId: 100, arrivalTime: 89, departureTime: 121, trackId: 1},
      {trainrunId: 100, arrivalTime: 119, departureTime: 151, trackId: 2},
      {trainrunId: 99, arrivalTime: 120, departureTime: 180, trackId: 3},
      {trainrunId: 100, arrivalTime: 149, departureTime: 181, trackId: 1},
      {trainrunId: 100, arrivalTime: 179, departureTime: 211, trackId: 2},
    ];
    const expectedKeys = new Set(
      expectedRows.map(
        ({trainrunId, arrivalTime, departureTime}) =>
          `${trainrunId}/${arrivalTime}/${departureTime}`,
      ),
    );
    const actualRows = getNodeTrackMatrix(service, a1, fixture.sections, {
      windowStartMinutes: -60,
      windowEndMinutes: 271,
      separateForwardBackwardTracks: true,
    })
      .filter(({trainrunId, arrivalTime, departureTime}) =>
        expectedKeys.has(`${trainrunId}/${arrivalTime}/${departureTime}`),
      )
      .map(({trainrunId, arrivalTime, departureTime, trackId}) => ({
        trainrunId,
        arrivalTime,
        departureTime,
        trackId,
      }))
      .sort(
        (first, second) =>
          first.arrivalTime - second.arrivalTime || first.trainrunId - second.trainrunId,
      );

    expect(actualRows).toEqual(expectedRows);
  });

  it("uses the real C3 one-way route from the JSON fixture", () => {
    const fixture = getTrackEstimatorFixture();
    const c3 = fixture.nodes.get(184) as Node;
    const c3OneWay = fixture.nodes.get(190) as Node;
    const tracks = service.estimateNodeTracks(c3OneWay, fixture.sections, {
      windowEndMinutes: 120,
      separateForwardBackwardTracks: true,
    });
    const occupancies = getOccupancies(tracks);

    expect(c3.getBetriebspunktName()).toBe("C3");
    expect(c3OneWay.getBetriebspunktName()).toBe("C3-ONE_WAY");
    expect(tracks.length).toBeGreaterThan(0);
    expect(occupancies.some((occupancy) => occupancy.direction === "one_way")).toBeTrue();
  });

  it("normalizes wrapped turnaround times before calculating track strands", () => {
    const cases = [
      {frequency: 30, arrival: 30, departure: 30, duration: 30, headway: 32, tracks: 2},
      {frequency: 15, arrival: 15, departure: 45, duration: 15, headway: 17, tracks: 2},
      {frequency: 15, arrival: 45, departure: 15, duration: 15, headway: 17, tracks: 2},
      {frequency: 20, arrival: 40, departure: 20, duration: 20, headway: 22, tracks: 2},
    ];

    cases.forEach(({frequency, arrival, departure, duration, headway, tracks: expectedTracks}) => {
      const fixture = getTrackEstimatorFixture();
      const c3 = fixture.nodes.get(184) as Node;
      const trainrun = fixture.trainruns.get(100);
      trainrun.setTrainrunFrequency({frequency, offset: 0} as TrainrunFrequency);
      const icxSection = fixture.sections.find(
        (section) => section.getId() === 717,
      ) as TrainrunSection;
      icxSection.setSourceArrival(arrival);
      icxSection.setSourceDeparture(departure);
      icxSection.setSourceArrivalConsecutiveTime(0);
      icxSection.setSourceDepartureConsecutiveTime(60);

      const estimatedTracks = service.estimateNodeTracks(c3, [icxSection], {
        windowStartMinutes: 0,
        windowEndMinutes: 120,
        separateForwardBackwardTracks: false,
      });

      expect(estimatedTracks.length).toBe(expectedTracks);
      const occupancy = getOccupancies(estimatedTracks).find(
        (candidate) => candidate.arrivalMinute === 0,
      );
      expect(occupancy).toBeDefined();
      expect(occupancy?.arrivalMinute).toBe(0);
      expect(occupancy?.departureMinute).toBe(duration);
      expect(occupancy?.headwayUntilMinute).toBe(headway);
    });
  });

  it("moves a still-too-short turnaround to the following frequency cycle", () => {
    const fixture = getTrackEstimatorFixture();
    const c3 = fixture.nodes.get(184) as Node;
    const trainrun = fixture.trainruns.get(100);
    trainrun.setTrainrunFrequency({frequency: 30, offset: 0} as TrainrunFrequency);
    trainrun.getTrainrunCategory().minimalTurnaroundTime = 35;
    const icxSection = fixture.sections.find(
      (section) => section.getId() === 717,
    ) as TrainrunSection;
    icxSection.setSourceArrival(30);
    icxSection.setSourceDeparture(30);
    icxSection.setSourceArrivalConsecutiveTime(0);
    icxSection.setSourceDepartureConsecutiveTime(60);

    const tracks = service.estimateNodeTracks(c3, [icxSection], {
      windowStartMinutes: 0,
      windowEndMinutes: 120,
      separateForwardBackwardTracks: false,
    });

    const occupancy = getOccupancies(tracks).find((candidate) => candidate.arrivalMinute === 0);
    expect(occupancy).toBeDefined();
    expect(occupancy?.arrivalMinute).toBe(0);
    expect(occupancy?.departureMinute).toBe(60);
  });

  it("keeps a valid five-minute turnaround in the same cycle", () => {
    const fixture = getTrackEstimatorFixture();
    const c3 = fixture.nodes.get(184) as Node;
    const trainrun = fixture.trainruns.get(100);
    trainrun.setTrainrunFrequency({frequency: 15, offset: 0} as TrainrunFrequency);
    const icxSection = fixture.sections.find(
      (section) => section.getId() === 717,
    ) as TrainrunSection;
    icxSection.setSourceArrival(5);
    icxSection.setSourceDeparture(10);
    icxSection.setSourceArrivalConsecutiveTime(5);
    icxSection.setSourceDepartureConsecutiveTime(10);

    const tracks = service.estimateNodeTracks(c3, [icxSection], {
      windowStartMinutes: 0,
      windowEndMinutes: 60,
      separateForwardBackwardTracks: false,
    });

    expect(tracks.length).toBe(1);
    const occupancy = getOccupancies(tracks).find((candidate) => candidate.arrivalMinute === 5);
    expect(occupancy).toBeDefined();
    expect(occupancy?.arrivalMinute).toBe(5);
    expect(occupancy?.departureMinute).toBe(10);
  });

  it("chooses the next 15-minute departure for a 05-to-55 periodic turnaround", () => {
    const fixture = getTrackEstimatorFixture();
    const c3 = fixture.nodes.get(184) as Node;
    const trainrun = fixture.trainruns.get(100);
    trainrun.setTrainrunFrequency({frequency: 15, offset: 0} as TrainrunFrequency);
    const icxSection = fixture.sections.find(
      (section) => section.getId() === 717,
    ) as TrainrunSection;
    icxSection.setSourceArrival(5);
    icxSection.setSourceDeparture(55);
    icxSection.setSourceArrivalConsecutiveTime(5);
    icxSection.setSourceDepartureConsecutiveTime(55);

    const tracks = service.estimateNodeTracks(c3, [icxSection], {
      windowStartMinutes: 0,
      windowEndMinutes: 60,
      separateForwardBackwardTracks: false,
    });

    const occupancy = getOccupancies(tracks).find((candidate) => candidate.arrivalMinute === 5);
    expect(occupancy).toBeDefined();
    expect(occupancy?.arrivalMinute).toBe(5);
    expect(occupancy?.departureMinute).toBe(10);
  });
});
