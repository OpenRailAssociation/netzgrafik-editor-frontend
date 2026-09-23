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

function modulo120(minutes: number): number {
  return ((minutes % 120) + 120) % 120;
}

function formatMatrixTime(minutes: number): string {
  const absoluteMinutes = 360 + minutes;
  const hour = Math.floor(absoluteMinutes / 60);
  const minute = ((absoluteMinutes % 60) + 60) % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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
    const actualByTiming = new Map(
      actualRows.map((row) => [
        `${row.nodeId}/${row.trainrunId}/${row.arrivalTime}/${row.departureTime}/${row.blockedUntilTime}`,
        row.trackId,
      ]),
    );
    const trackDifferences = manualGroundTruthRows
      .map((expectedRow) => {
        const arrivalTime = minutesSince0600(expectedRow.arrivalTime);
        const departureTime = minutesSince0600(expectedRow.departureTime);
        const blockedUntilTime = minutesSince0600(expectedRow.blockedUntilTime);
        const actualTrack = actualByTiming.get(
          `${expectedRow.nodeId}/${expectedRow.trainrunId}/${arrivalTime}/${departureTime}/${blockedUntilTime}`,
        );
        return {
          Node: expectedRow.nodeId,
          Trainrun: expectedRow.trainrunId,
          Ankunft: expectedRow.arrivalTime,
          Abfahrt: expectedRow.departureTime,
          Freigabe: expectedRow.blockedUntilTime,
          ErwartetesGleis: expectedRow.expectedTrackId,
          IstGleis: actualTrack ?? "not found",
          Status: actualTrack === expectedRow.expectedTrackId ? "OK" : "different",
        };
      })
      .filter((row) => row.Status === "different");

    console.group("Node track assignment differences (informational)");
    console.table(trackDifferences);
    console.groupEnd();
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
        .map(({trainrunId, arrivalTime, departureTime, blockedUntilTime}) => ({
          nodeId,
          trainrunId,
          arrivalTime,
          departureTime,
          blockedUntilTime,
        }));
    });
    const expectedRows = manualGroundTruthRows.map(
      ({nodeId, trainrunId, arrivalTime, departureTime, blockedUntilTime}) => ({
        nodeId,
        trainrunId,
        arrivalTime: minutesSince0600(arrivalTime),
        departureTime: minutesSince0600(departureTime),
        blockedUntilTime: minutesSince0600(blockedUntilTime),
      }),
    );
    const timingKey = (row: (typeof expectedRows)[number]) =>
      `${row.nodeId}/${row.trainrunId}/${modulo120(row.arrivalTime)}/${modulo120(row.departureTime)}/${modulo120(row.blockedUntilTime)}`;
    const actualTimingKeys = new Set(actualRows.map(timingKey));
    const missingRows = expectedRows.filter((expectedRow) => !actualTimingKeys.has(timingKey(expectedRow)));
    const expectedPhaseRows = expectedRows.flatMap((row) => {
      const frequency = fixture.trainruns.get(row.trainrunId)?.getFrequency() ?? 0;
      const phases = frequency > 0 ? Math.ceil(120 / frequency) : 1;
      return Array.from({length: phases}, (_, phase) => ({
        ...row,
        arrivalTime: row.arrivalTime + phase * frequency,
        departureTime: row.departureTime + phase * frequency,
        blockedUntilTime: row.blockedUntilTime + phase * frequency,
      }));
    });
    const expectedTimingKeys = new Set(expectedPhaseRows.map(timingKey));
    const unmappedActualRows = actualRows.filter(
      (actualRow) => !expectedTimingKeys.has(timingKey(actualRow)),
    );
    const describeRow = (row: (typeof expectedRows)[number]) => {
      const node = fixture.nodes.get(row.nodeId);
      const trainrun = fixture.trainruns.get(row.trainrunId);
      return {
        Knoten: node?.getBetriebspunktName() ?? row.nodeId,
        Zug: row.trainrunId,
        Kategorie: trainrun?.getCategoryShortName() ?? "?",
        Zugname: trainrun?.getTitle() ?? "?",
        Ankunft: formatMatrixTime(row.arrivalTime),
        Abfahrt: formatMatrixTime(row.departureTime),
        Freigabe: formatMatrixTime(row.blockedUntilTime),
      };
    };
    console.group("Groundtruth rows without rollout match");
    console.table(missingRows.map(describeRow));
    console.table(
      actualRows.filter((actualRow) =>
        missingRows.some(
          (missingRow) =>
            missingRow.nodeId === actualRow.nodeId &&
            missingRow.trainrunId === actualRow.trainrunId,
        ),
      ).map(describeRow),
    );
    console.groupEnd();
    console.group("Rolled-out rows without groundtruth mapping");
    console.table(unmappedActualRows.map(describeRow));
    console.groupEnd();
    expect(missingRows).toEqual([]);
    expect(unmappedActualRows).toEqual([]);
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

});
