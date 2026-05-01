import {GTFSConverterService} from "./gtfs-converter.service";
import {TrainrunSectionDto} from "../../data-structures/business.data.structures";
import {TrainrunSectionText} from "../../data-structures/technical.data.structures";

describe("GTFSConverterService topology consolidation", () => {
  let service: GTFSConverterService;

  beforeEach(() => {
    service = new GTFSConverterService();
  });

  it("replaces all sections of one undirected basis edge atomically", () => {
    const trainrunSections: TrainrunSectionDto[] = [
      createSection(1, 1, 2, 1, 1),
      createSection(2, 2, 3, 1, 2),
      createSection(3, 3, 4, 1, 3),
      createSection(4, 1, 4, 5, 10),
      createSection(5, 4, 1, 5, 11),
    ];

    const result = (service as any).applyTopologyConsolidationToTrainrunSections(trainrunSections, [], {
      topologyDetourPercent: 50,
      topologyDetourAbsoluteMinutes: 0,
      topologyMinEdgeTravelTime: 1,
      topologyMaxIterations: 10,
    });

    expect(result.graphChanged).toBeTrue();
    expect(result.consolidatedEdges).toBe(1);
    expect(result.replacedSections).toBe(2);
    expect(result.insertedSections).toBe(4);
    expect(trainrunSections.length).toBe(9);

    const trainrun10Sections = trainrunSections.filter((section) => section.trainrunId === 10);
    expect(trainrun10Sections.map(toEdge)).toEqual(["1→2", "2→3", "3→4"]);
    expect(trainrun10Sections.map((section) => section.numberOfStops)).toEqual([1, 1, 1]);
    expect(trainrun10Sections.map((section) => section.travelTime.time)).toEqual([2, 2, 1]);

    const trainrun11Sections = trainrunSections.filter((section) => section.trainrunId === 11);
    expect(trainrun11Sections.map(toEdge)).toEqual(["4→3", "3→2", "2→1"]);
    expect(trainrun11Sections.map((section) => section.numberOfStops)).toEqual([1, 1, 1]);
    expect(trainrun11Sections.map((section) => section.travelTime.time)).toEqual([2, 2, 1]);

    const remainingDirectSections = trainrunSections.filter(
      (section) =>
        (section.sourceNodeId === 1 && section.targetNodeId === 4) ||
        (section.sourceNodeId === 4 && section.targetNodeId === 1),
    );
    expect(remainingDirectSections.length).toBe(0);
  });

  it("does not replace a section when minimum edge travel time A makes interpolation impossible", () => {
    const trainrunSections: TrainrunSectionDto[] = [
      createSection(1, 1, 2, 1, 1),
      createSection(2, 2, 3, 1, 2),
      createSection(3, 3, 4, 1, 3),
      createSection(4, 1, 4, 5, 10),
    ];

    const result = (service as any).applyTopologyConsolidationToTrainrunSections(trainrunSections, [], {
      topologyDetourPercent: 200,
      topologyDetourAbsoluteMinutes: 10,
      topologyMinEdgeTravelTime: 2,
      topologyMaxIterations: 10,
    });

    expect(result.graphChanged).toBeFalse();
    expect(result.consolidatedEdges).toBe(0);
    expect(result.replacedSections).toBe(0);
    expect(trainrunSections.map(toEdge)).toEqual(["1→2", "2→3", "3→4", "1→4"]);
    expect(trainrunSections.find((section) => section.id === 4)?.travelTime.time).toBe(5);
  });

  it("does not replace a section through an intermediate node already used elsewhere in the same trainrun", () => {
    const trainrunSections: TrainrunSectionDto[] = [
      createSection(1, 1, 2, 2, 20),
      createSection(2, 2, 3, 2, 20),
      createSection(3, 3, 4, 4, 20),
      createSection(4, 2, 5, 1, 30),
      createSection(5, 5, 4, 1, 31),
    ];

    const result = (service as any).applyTopologyConsolidationToTrainrunSections(trainrunSections, [], {
      topologyDetourPercent: 100,
      topologyDetourAbsoluteMinutes: 0,
      topologyMinEdgeTravelTime: 1,
      topologyMaxIterations: 10,
    });

    expect(result.graphChanged).toBeFalse();
    expect(result.consolidatedEdges).toBe(0);
    expect(trainrunSections.filter((section) => section.trainrunId === 20).map(toEdge)).toEqual([
      "1→2",
      "2→3",
      "3→4",
    ]);
  });
});

function createSection(
  id: number,
  sourceNodeId: number,
  targetNodeId: number,
  travelTime: number,
  trainrunId: number,
): TrainrunSectionDto {
  const sourceDeparture = 0;
  const targetArrival = travelTime % 60;

  return {
    id,
    sourceNodeId,
    sourcePortId: 0,
    targetNodeId,
    targetPortId: 0,
    sourceSymmetry: false,
    targetSymmetry: false,
    sourceArrival: createTimeLock((60 - sourceDeparture) % 60),
    sourceDeparture: createTimeLock(sourceDeparture),
    targetArrival: createTimeLock(targetArrival),
    targetDeparture: createTimeLock((60 - targetArrival) % 60),
    travelTime: createTimeLock(travelTime),
    backwardTravelTime: createTimeLock(travelTime),
    numberOfStops: 0,
    trainrunId,
    resourceId: 0,
    specificTrainrunSectionFrequencyId: null,
    path: {
      path: [],
      textPositions: createTextPositions(),
    },
    warnings: [],
  };
}

function createTimeLock(time: number) {
  return {
    time,
    consecutiveTime: 0,
    lock: false,
    warning: undefined,
    timeFormatter: undefined,
  };
}

function createTextPositions() {
  const point = {x: 0, y: 0};
  return {
    [TrainrunSectionText.SourceArrival]: point,
    [TrainrunSectionText.SourceDeparture]: point,
    [TrainrunSectionText.TargetArrival]: point,
    [TrainrunSectionText.TargetDeparture]: point,
    [TrainrunSectionText.TrainrunSectionName]: point,
    [TrainrunSectionText.TrainrunSectionTravelTime]: point,
    [TrainrunSectionText.TrainrunSectionBackwardTravelTime]: point,
    [TrainrunSectionText.TrainrunSectionNumberOfStops]: point,
  };
}

function toEdge(section: TrainrunSectionDto): string {
  return `${section.sourceNodeId}→${section.targetNodeId}`;
}