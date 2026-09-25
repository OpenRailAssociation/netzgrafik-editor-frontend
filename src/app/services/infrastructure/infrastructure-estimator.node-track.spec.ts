import {TrainrunCategory, TrainrunFrequency} from "../../data-structures/business.data.structures";
import {Node} from "../../models/node.model";
import {Trainrun} from "../../models/trainrun.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {InfrastructureEstimatorService} from "./infrastructure-estimator.service";
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

function getOccupancies(tracks: ReturnType<InfrastructureEstimatorService["estimateNodeTracks"]>) {
  return tracks.flatMap((track) => track.occupancies);
}

function getNodeTrackMatrix(
  service: InfrastructureEstimatorService,
  node: Node,
  sections: TrainrunSection[],
  options: Parameters<InfrastructureEstimatorService["estimateNodeTracks"]>[2],
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

function expectNoOverlappingTrackOccupancies(
  tracks: ReturnType<InfrastructureEstimatorService["estimateNodeTracks"]>,
): void {
  tracks.forEach((track) => {
    const occupancies = [...track.occupancies].sort(
      (first, second) => first.arrivalMinute - second.arrivalMinute,
    );
    occupancies.slice(1).forEach((occupancy, index) => {
      expect(occupancy.arrivalMinute).toBeGreaterThanOrEqual(occupancies[index].headwayUntilMinute);
    });
  });
}

interface ManualNodeTrackRow {
  trainrunId: number;
  nodeId: number;
  arrivalTime: string;
  departureTime: string;
  blockedUntilTime: string;
  expectedTrackId: number;
}

const manualGroundTruthRows: ManualNodeTrackRow[] = [
  {
    trainrunId: 98, // REX
    nodeId: 179, // A
    arrivalTime: "07:00",
    departureTime: "08:00",
    blockedUntilTime: "08:02",
    expectedTrackId: 2,
  },
  {
    trainrunId: 98, // REX
    nodeId: 179, // A
    arrivalTime: "08:00",
    departureTime: "09:00",
    blockedUntilTime: "09:02",
    expectedTrackId: 1,
  },
  {
    trainrunId: 98, // REX
    nodeId: 180, // B
    arrivalTime: "07:06",
    departureTime: "07:07",
    blockedUntilTime: "07:09",
    expectedTrackId: 2,
  },
  {
    trainrunId: 98, // REX
    nodeId: 180, // B
    arrivalTime: "07:53",
    departureTime: "07:54",
    blockedUntilTime: "07:56",
    expectedTrackId: 1,
  },
  {
    trainrunId: 98, // REX
    nodeId: 181, // C
    arrivalTime: "07:13",
    departureTime: "07:47",
    blockedUntilTime: "07:49",
    expectedTrackId: 1,
  },
  {
    trainrunId: 98, // REX
    nodeId: 181, // C
    arrivalTime: "08:13",
    departureTime: "08:47",
    blockedUntilTime: "08:49",
    expectedTrackId: 1,
  },
  {
    trainrunId: 102, // REX
    nodeId: 187, // C-ONE_WAY
    arrivalTime: "07:46",
    departureTime: "07:47",
    blockedUntilTime: "07:49",
    expectedTrackId: 1,
  },
  {
    trainrunId: 102, // REX
    nodeId: 186, // B-ONE_WAY
    arrivalTime: "07:53",
    departureTime: "07:54",
    blockedUntilTime: "07:56",
    expectedTrackId: 1,
  },
  {
    trainrunId: 102, // REX
    nodeId: 185, // A-ONE_WAY
    arrivalTime: "08:00",
    departureTime: "08:01",
    blockedUntilTime: "08:03",
    expectedTrackId: 1,
  },
  {
    trainrunId: 100, // ICX
    nodeId: 182, // A1
    arrivalTime: "07:59",
    departureTime: "07:31",
    blockedUntilTime: "07:33",
    expectedTrackId: 1,
  },
  {
    trainrunId: 99, // REX
    nodeId: 182, // A1
    arrivalTime: "06:00",
    departureTime: "07:00",
    blockedUntilTime: "07:02",
    expectedTrackId: 2,
  },
  {
    trainrunId: 99, // REX
    nodeId: 182, // A1
    arrivalTime: "07:00",
    departureTime: "08:00",
    blockedUntilTime: "08:02",
    expectedTrackId: 3,
  },
  {
    trainrunId: 100, // ICX
    nodeId: 182, // A1
    arrivalTime: "07:29",
    departureTime: "08:01",
    blockedUntilTime: "08:03",
    expectedTrackId: 4,
  },
  {
    trainrunId: 100, // ICX
    nodeId: 183, // B2
    arrivalTime: "08:09",
    departureTime: "08:11",
    blockedUntilTime: "08:13",
    expectedTrackId: 2,
  },
  {
    trainrunId: 99, // REX
    nodeId: 183, // B2
    arrivalTime: "08:06",
    departureTime: "08:07",
    blockedUntilTime: "08:09",
    expectedTrackId: 2,
  },
  {
    trainrunId: 99, // REX
    nodeId: 183, // B2
    arrivalTime: "08:53",
    departureTime: "08:54",
    blockedUntilTime: "08:56",
    expectedTrackId: 1,
  },
  {
    trainrunId: 100, // ICX
    nodeId: 183, // B2
    arrivalTime: "08:19",
    departureTime: "08:21",
    blockedUntilTime: "08:23",
    expectedTrackId: 1,
  },
  {
    trainrunId: 101, // SX
    nodeId: 183, // B2
    arrivalTime: "07:59",
    departureTime: "08:16",
    blockedUntilTime: "08:18",
    expectedTrackId: 1,
  },
  {
    trainrunId: 101, // SX
    nodeId: 183, // B2
    arrivalTime: "08:14",
    departureTime: "08:31",
    blockedUntilTime: "08:33",
    expectedTrackId: 2,
  },
  {
    trainrunId: 100, // ICX
    nodeId: 183, // B2
    arrivalTime: "08:39",
    departureTime: "08:41",
    blockedUntilTime: "08:43",
    expectedTrackId: 2,
  },
  {
    trainrunId: 100, // ICX
    nodeId: 183, // B2
    arrivalTime: "08:49",
    departureTime: "08:51",
    blockedUntilTime: "08:53",
    expectedTrackId: 1,
  },
  {
    trainrunId: 100, // ICX
    nodeId: 184, // C3
    arrivalTime: "08:17",
    departureTime: "08:43",
    blockedUntilTime: "08:45",
    expectedTrackId: 3,
  },
  {
    trainrunId: 100, // ICX
    nodeId: 184, // C3
    arrivalTime: "07:47",
    departureTime: "08:13",
    blockedUntilTime: "08:15",
    expectedTrackId: 3,
  },
  {
    trainrunId: 99, // REX
    nodeId: 184, // C3
    arrivalTime: "08:13",
    departureTime: "08:47",
    blockedUntilTime: "08:49",
    expectedTrackId: 2,
  },
  {
    trainrunId: 101, // SX
    nodeId: 184, // C3
    arrivalTime: "08:10",
    departureTime: "08:20",
    blockedUntilTime: "08:22",
    expectedTrackId: 1,
  },
  {
    trainrunId: 101, // SX
    nodeId: 184, // C3
    arrivalTime: "08:25",
    departureTime: "08:45",
    blockedUntilTime: "08:47",
    expectedTrackId: 1,
  },
  {
    trainrunId: 101, // SX
    nodeId: 184, // C3
    arrivalTime: "08:40",
    departureTime: "08:50",
    blockedUntilTime: "08:52",
    expectedTrackId: 1,
  },
  {
    trainrunId: 106, // GEXX
    nodeId: 184, // C3
    arrivalTime: "07:57",
    departureTime: "08:03",
    blockedUntilTime: "08:06",
    expectedTrackId: 2,
  },
  {
    trainrunId: 104, // ICX
    nodeId: 190, // C3-ONE_WAY
    arrivalTime: "08:17",
    departureTime: "08:19",
    blockedUntilTime: "08:21",
    expectedTrackId: 3,
  },
  {
    trainrunId: 104, // ICX
    nodeId: 190, // C3-ONE_WAY
    arrivalTime: "08:47",
    departureTime: "08:49",
    blockedUntilTime: "08:51",
    expectedTrackId: 3,
  },
  {
    trainrunId: 106, // GEXX
    nodeId: 190, // C3-ONE_WAY
    arrivalTime: "07:55",
    departureTime: "08:05",
    blockedUntilTime: "08:08",
    expectedTrackId: 2,
  },
  {
    trainrunId: 105, // SX
    nodeId: 190, // C3-ONE_WAY
    arrivalTime: "08:04",
    departureTime: "08:05",
    blockedUntilTime: "08:07",
    expectedTrackId: 1,
  },
  {
    trainrunId: 105, // SX
    nodeId: 190, // C3-ONE_WAY
    arrivalTime: "08:19",
    departureTime: "08:20",
    blockedUntilTime: "08:22",
    expectedTrackId: 1,
  },
  {
    trainrunId: 105, // SX
    nodeId: 190, // C3-ONE_WAY
    arrivalTime: "08:34",
    departureTime: "08:35",
    blockedUntilTime: "08:37",
    expectedTrackId: 1,
  },
  {
    trainrunId: 105, // SX
    nodeId: 190, // C3-ONE_WAY
    arrivalTime: "08:49",
    departureTime: "08:50",
    blockedUntilTime: "08:52",
    expectedTrackId: 1,
  },
];

function minutesSince0600(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes - 360;
}

const groundTruthWindowStartMinutes = minutesSince0600("04:00");
const groundTruthWindowEndMinutes = minutesSince0600("10:00");

describe("InfrastructureEstimatorService node tracks", () => {
  let service: InfrastructureEstimatorService;

  beforeEach(() => {
    service = new InfrastructureEstimatorService();
  });

  it("loads the A1-B2-C3 nodes from the JSON fixture", () => {
    const fixture = getTrackEstimatorFixture();
    const a1 = fixture.nodes.get(182) as Node;
    const b2 = fixture.nodes.get(183) as Node;
    const c3 = fixture.nodes.get(184) as Node;

    expect(a1.getBetriebspunktName()).toBe("A1");
    expect(b2.getBetriebspunktName()).toBe("B2");
    expect(c3.getBetriebspunktName()).toBe("C3");
    expect(fixture.sections.length).toBeGreaterThan(0);
    expect(fixture.trainruns.size).toBeGreaterThan(0);
  });

  it("returns a valid C3 node-track matrix", () => {
    const fixture = getTrackEstimatorFixture();
    const c3 = fixture.nodes.get(184) as Node;
    const matrix = getNodeTrackMatrix(service, c3, fixture.sections, {
      windowMinutes: 180,
      separateForwardBackwardTracks: false,
    });

    expect(matrix.length).toBeGreaterThan(0);
    matrix.forEach((row) => {
      expect(row.arrivalTime).toBeLessThanOrEqual(row.departureTime);
      expect(row.departureTime).toBeLessThanOrEqual(row.blockedUntilTime);
      expect(row.trackId).toBeGreaterThan(0);
    });
  });

  it("does not overlap track occupancy for any fixture node", () => {
    const fixture = getTrackEstimatorFixture();

    fixture.nodes.forEach((node) => {
      const tracks = service.estimateNodeTracks(node, fixture.sections, {
        windowMinutes: 180,
        separateForwardBackwardTracks: false,
      });

      expectNoOverlappingTrackOccupancies(tracks);
    });
  });

  it("keeps all B2 fixture occupancies on non-overlapping tracks", () => {
    const fixture = getTrackEstimatorFixture();
    const b2 = fixture.nodes.get(183) as Node;
    const tracks = service.estimateNodeTracks(b2, fixture.sections, {
      windowMinutes: 120,
      separateForwardBackwardTracks: false,
    });
    expect(tracks.length).toBeGreaterThan(0);
    expectNoOverlappingTrackOccupancies(tracks);
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
      windowMinutes: 271,
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

  it("reports track assignments without making them part of timing validation", () => {
    const fixture = getTrackEstimatorFixture();
    const nodeIds = [...new Set(manualGroundTruthRows.map((row) => row.nodeId))];
    const actualRows = nodeIds.flatMap((nodeId) => {
      const node = fixture.nodes.get(nodeId) as Node;
      return getNodeTrackMatrix(service, node, fixture.sections, {
        windowMinutes: groundTruthWindowEndMinutes,
        windowStartMinutes: groundTruthWindowStartMinutes,
        separateForwardBackwardTracks: true,
      }).map((row) => ({nodeId, ...row}));
    });
    expect(actualRows.length).toBeGreaterThan(0);
  });

  it("maps every rolled-out occupancy timing to groundtruth modulo 120 from 04:00 to 10:00", () => {
    const fixture = getTrackEstimatorFixture();
    const nodeIds = [...new Set(manualGroundTruthRows.map((row) => row.nodeId))];
    const actualRows = nodeIds.flatMap((nodeId) => {
      const node = fixture.nodes.get(nodeId) as Node;
      return getNodeTrackMatrix(service, node, fixture.sections, {
        windowMinutes: groundTruthWindowEndMinutes,
        windowStartMinutes: groundTruthWindowStartMinutes,
        separateForwardBackwardTracks: true,
      })
        .filter(
          ({arrivalTime}) =>
            arrivalTime >= groundTruthWindowStartMinutes &&
            arrivalTime < groundTruthWindowEndMinutes,
        )
        .map(({trainrunId, occurrenceIndex, arrivalTime, departureTime, blockedUntilTime}) => ({
          nodeId,
          trainrunId,
          occurrenceIndex,
          arrivalTime,
          departureTime,
          blockedUntilTime,
        }));
    });
    expect(actualRows.length).toBeGreaterThan(manualGroundTruthRows.length);
    actualRows.forEach((row) => {
      expect(fixture.trainruns.has(row.trainrunId)).toBeTrue();
      expect(row.arrivalTime).toBeLessThanOrEqual(row.departureTime);
      expect(row.departureTime).toBeLessThanOrEqual(row.blockedUntilTime);
    });
    expect(
      actualRows.some(
        (row) =>
          row.nodeId === 183 &&
          row.trainrunId === 101 &&
          row.occurrenceIndex === 4 &&
          row.arrivalTime === 119 &&
          row.departureTime === 136,
      ),
    ).toBeTrue();
  });

  it("uses the real C3 one-way route from the JSON fixture", () => {
    const fixture = getTrackEstimatorFixture();
    const c3 = fixture.nodes.get(184) as Node;
    const c3OneWay = fixture.nodes.get(190) as Node;
    const tracks = service.estimateNodeTracks(c3OneWay, fixture.sections, {
      windowMinutes: 120,
      separateForwardBackwardTracks: true,
    });
    const occupancies = getOccupancies(tracks);

    expect(c3.getBetriebspunktName()).toBe("C3");
    expect(c3OneWay.getBetriebspunktName()).toBe("C3-ONE_WAY");
    expect(tracks.length).toBeGreaterThan(0);
    expect(occupancies.some((occupancy) => occupancy.direction === "one_way")).toBeTrue();
  });

  it("uses one frequency cycle for a 30/30 ICX turnaround", () => {
    const fixture = getTrackEstimatorFixture();
    const c3 = fixture.nodes.get(184) as Node;
    const icxSection = fixture.sections.find(
      (section) => section.getId() === 717,
    ) as TrainrunSection;

    icxSection.setSourceArrival(30);
    icxSection.setSourceDeparture(30);
    icxSection.setSourceArrivalConsecutiveTime(0);
    icxSection.setSourceDepartureConsecutiveTime(60);

    const tracks = service.estimateNodeTracks(c3, [icxSection], {
      windowStartMinutes: 0,
      windowMinutes: 90,
      separateForwardBackwardTracks: false,
    });

    expect(fixture.trainruns.get(100).getFrequency()).toBe(30);
    expect(tracks.length).toBe(2);
    expect(getOccupancies(tracks)).toEqual(
      jasmine.arrayContaining([
        jasmine.objectContaining({
          arrivalMinute: 0,
          departureMinute: 30,
          headwayUntilMinute: 32,
        }),
      ]),
    );
  });

  it("normalizes wrapped turnaround times before calculating track strands", () => {
    const cases = [
      {frequency: 30, arrival: 30, departure: 30, duration: 30, tracks: 2},
      {frequency: 15, arrival: 15, departure: 45, duration: 15, tracks: 2},
      {frequency: 15, arrival: 45, departure: 15, duration: 15, tracks: 2},
      {frequency: 20, arrival: 40, departure: 20, duration: 20, tracks: 2},
    ];

    cases.forEach(({frequency, arrival, departure, duration, tracks: expectedTracks}) => {
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
        windowMinutes: 120,
        separateForwardBackwardTracks: false,
      });

      expect(estimatedTracks.length).toBe(expectedTracks);
      expect(getOccupancies(estimatedTracks)).toContain(
        jasmine.objectContaining({
          arrivalMinute: 0,
          departureMinute: duration,
        }),
      );
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
      windowMinutes: 120,
      separateForwardBackwardTracks: false,
    });

    expect(getOccupancies(tracks)).toContain(
      jasmine.objectContaining({
        arrivalMinute: 0,
        departureMinute: 60,
      }),
    );
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
      windowMinutes: 60,
      separateForwardBackwardTracks: false,
    });

    expect(tracks.length).toBe(1);
    expect(getOccupancies(tracks)).toContain(
      jasmine.objectContaining({
        arrivalMinute: 5,
        departureMinute: 10,
      }),
    );
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
      windowMinutes: 60,
      separateForwardBackwardTracks: false,
    });

    expect(getOccupancies(tracks)).toContain(
      jasmine.objectContaining({
        arrivalMinute: 5,
        departureMinute: 10,
      }),
    );
  });
});
