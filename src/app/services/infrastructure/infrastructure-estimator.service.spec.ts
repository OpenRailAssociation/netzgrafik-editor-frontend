import {InfrastructureEstimatorService} from "./infrastructure-estimator.service";
import {
  LinePatternRefs,
  HaltezeitFachCategories,
  TrainrunCategory,
  TrainrunFrequency,
} from "../../data-structures/business.data.structures";
import {Node} from "../../models/node.model";
import {Trainrun} from "../../models/trainrun.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Direction} from "../../data-structures/business.data.structures";
import {NetzgrafikTrackEstimatorTesting} from "../../../integration-testing/netzgrafik.unit.testing.track.estimator";

const createTrainrunSection = (
  sourceDeparture: number,
  targetArrival: number,
  targetDeparture: number,
  sourceArrival: number,
  sourceNode: Node,
  targetNode: Node,
  trainrun: Trainrun,
) => {
  trainrun.setTrainrunCategory({
    id: 0,
    order: 0,
    name: "Test category",
    shortName: "TEST",
    fachCategory: HaltezeitFachCategories.Uncategorized,
    colorRef: "blue",
    minimalTurnaroundTime: 0,
    nodeHeadwayStop: 0,
    nodeHeadwayNonStop: 0,
    sectionHeadway: 2,
  } as TrainrunCategory);
  const trainrunSection = new TrainrunSection();
  trainrunSection.setSourceNode(sourceNode);
  trainrunSection.setTargetNode(targetNode);
  trainrunSection.setTrainrun(trainrun);
  trainrunSection.setSourceDeparture(sourceDeparture);
  trainrunSection.setSourceArrival(sourceArrival);
  trainrunSection.setTargetDeparture(targetDeparture);
  trainrunSection.setTargetArrival(targetArrival);
  trainrunSection.setSourceDepartureConsecutiveTime(sourceDeparture);
  trainrunSection.setSourceArrivalConsecutiveTime(sourceArrival);
  trainrunSection.setTargetDepartureConsecutiveTime(targetDeparture);
  trainrunSection.setTargetArrivalConsecutiveTime(targetArrival);
  return trainrunSection;
};

const getTrackEstimatorFixture = () => {
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
  return {nodes, sections};
};

describe("InfrastructureEstimatorService", () => {
  it("matches the A-B and B-C section track calculation", () => {
    const fixture = getTrackEstimatorFixture();
    const fromNode = fixture.nodes.get(179) as Node;
    const middleNode = fixture.nodes.get(180) as Node;
    const toNode = fixture.nodes.get(181) as Node;
    const trainrunSections = fixture.sections;

    const infrastructureEstimatorService = new InfrastructureEstimatorService();

    expect(
      infrastructureEstimatorService.estimateSectionTracks(fromNode, middleNode, [
        trainrunSections.find((section) => section.getId() === 713) as TrainrunSection,
      ]),
    ).toEqual([
      [0, 1 / 6, 2],
      [1 / 6, 1, 1],
    ]);

    expect(
      infrastructureEstimatorService.estimateSectionTracks(middleNode, toNode, [
        trainrunSections.find((section) => section.getId() === 714) as TrainrunSection,
      ]),
    ).toEqual([[0, 1, 1]]);
  });

  it("handles a 62-minute travel time with a 60-minute frequency", () => {
    const fixture = getTrackEstimatorFixture();
    const fromNode = fixture.nodes.get(179) as Node;
    const toNode = fixture.nodes.get(180) as Node;
    const section = fixture.sections.find((item) => item.getId() === 713) as TrainrunSection;
    section.setTravelTime(62);
    section.setTargetArrival(62);
    section.setTargetArrivalConsecutiveTime(62);

    const infrastructureEstimatorService = new InfrastructureEstimatorService();

    expect(
      infrastructureEstimatorService.estimateSectionTracks(fromNode, toNode, [section]),
    ).toEqual([
      [0, 0.02903225806451613, 2],
      [0.02903225806451613, 0.853763440860215, 1],
      [0.853763440860215, 0.9118279569892473, 2],
      [0.9118279569892473, 1, 1],
    ]);
  });

  it("matches the A1-B2 and B2-C3 section track calculation", () => {
    const fixture = getTrackEstimatorFixture();
    const fromNode = fixture.nodes.get(182) as Node;
    expect(fromNode.getBetriebspunktName()).toBe("A1");
    const middleNode = fixture.nodes.get(183) as Node;
    const toNode = fixture.nodes.get(184) as Node;
    const trainrunSections = fixture.sections;
    const infrastructureEstimatorService = new InfrastructureEstimatorService();

    expect(
      infrastructureEstimatorService.estimateSectionTracks(fromNode, middleNode, [
        trainrunSections.find((section) => section.getId() === 715) as TrainrunSection,
        trainrunSections.find((section) => section.getId() === 718) as TrainrunSection,
      ]),
    ).toEqual([
      [0, 3 / 40, 3],
      [3 / 40, 59 / 120, 2],
      [59 / 120, 1, 1],
    ]);
    expect(
      infrastructureEstimatorService.estimateSectionTracks(middleNode, toNode, [
        trainrunSections.find((section) => section.getId() === 716) as TrainrunSection,
        trainrunSections.find((section) => section.getId() === 717) as TrainrunSection,
        trainrunSections.find((section) => section.getId() === 719) as TrainrunSection,
      ]),
    ).toEqual([
      [0, 1 / 30, 1],
      [1 / 30, 83 / 360, 2],
      [83 / 360, 3 / 10, 3],
      [3 / 10, 8 / 15, 2],
      [8 / 15, 13 / 24, 3],
      [13 / 24, 5 / 8, 4],
      [5 / 8, 2 / 3, 3],
      [2 / 3, 149 / 180, 2],
      [149 / 180, 151 / 180, 1],
      [151 / 180, 1, 2],
    ]);

    // switch orientation and estimate section tracks from toNode to middleNode
    expect(
      infrastructureEstimatorService.estimateSectionTracks(toNode, middleNode, [
        trainrunSections.find((section) => section.getId() === 716) as TrainrunSection,
        trainrunSections.find((section) => section.getId() === 717) as TrainrunSection,
        trainrunSections.find((section) => section.getId() === 719) as TrainrunSection,
      ]),
    ).toEqual([
      [0, 29 / 180, 2],
      [29 / 180, 31 / 180, 1],
      [31 / 180, 1 / 3, 2],
      [1 / 3, 3 / 8, 3],
      [3 / 8, 11 / 24, 4],
      [11 / 24, 7 / 15, 3],
      [7 / 15, 7 / 10, 2],
      [7 / 10, 277 / 360, 3],
      [277 / 360, 29 / 30, 2],
      [29 / 30, 1, 1],
    ]);
  });

  it("estimates all tracks along the A1-B2-C3-one-way-B2-one-way-A1-one-way route", () => {
    const fixture = getTrackEstimatorFixture();
    const infrastructureEstimatorService = new InfrastructureEstimatorService();
    const findSections = (...sectionIds: number[]) =>
      sectionIds.map(
        (sectionId) =>
          fixture.sections.find((section) => section.getId() === sectionId) as TrainrunSection,
      );
    const a1 = fixture.nodes.get(182) as Node;
    const b2 = fixture.nodes.get(183) as Node;
    const c3 = fixture.nodes.get(184) as Node;
    expect(a1.getBetriebspunktName()).toBe("A1");
    expect(b2.getBetriebspunktName()).toBe("B2");
    expect(c3.getBetriebspunktName()).toBe("C3");
    const c3OneWay = fixture.nodes.get(190) as Node;
    const b2OneWay = fixture.nodes.get(189) as Node;
    const a1OneWay = fixture.nodes.get(188) as Node;
    const a1ToB2 = infrastructureEstimatorService.estimateSectionTracks(
      a1,
      b2,
      findSections(715, 718),
    );
    const b2ToC3 = infrastructureEstimatorService.estimateSectionTracks(
      b2,
      c3,
      findSections(716, 717, 719),
    );
    const a1OneWayToB2OneWay = infrastructureEstimatorService.estimateSectionTracks(
      a1OneWay,
      b2OneWay,
      findSections(722),
    );
    const b2OneWayToC3OneWay = infrastructureEstimatorService.estimateSectionTracks(
      b2OneWay,
      c3OneWay,
      findSections(723, 724, 726),
    );
    const c3ToC3OneWay = infrastructureEstimatorService.estimateSectionTracks(
      c3,
      c3OneWay,
      findSections(727),
    );

    expect(a1ToB2).toEqual([
      [0, 0.075, 3],
      [0.075, 0.49166666666666664, 2],
      [0.49166666666666664, 1, 1],
    ]);
    expect(b2ToC3).toEqual([
      [0, 0.03333333333333333, 1],
      [0.03333333333333333, 0.23055555555555557, 2],
      [0.23055555555555557, 0.3, 3],
      [0.3, 0.5333333333333333, 2],
      [0.5333333333333333, 0.5416666666666666, 3],
      [0.5416666666666666, 0.625, 4],
      [0.625, 0.6666666666666666, 3],
      [0.6666666666666666, 0.8277777777777777, 2],
      [0.8277777777777777, 0.8388888888888889, 1],
      [0.8388888888888889, 1, 2],
    ]);
    expect(a1OneWayToB2OneWay).toEqual([[0, 1, 1]]);
    expect(b2OneWayToC3OneWay).toEqual([
      [0, 0.03611111111111111, 1],
      [0.03611111111111111, 0.16666666666666666, 2],
      [0.16666666666666666, 0.44722222222222224, 1],
      [0.44722222222222224, 0.5361111111111111, 2],
      [0.5361111111111111, 0.6666666666666666, 3],
      [0.6666666666666666, 0.8277777777777777, 2],
      [0.8277777777777777, 1, 1],
    ]);
    expect(c3ToC3OneWay).toEqual([
      [0, 0.491025641025641, 1],
      [0.491025641025641, 0.5474358974358975, 2],
      [0.5474358974358975, 1, 1],
    ]);
  });

  it("matches the A-B and B-C section track calculation - one-way", () => {
    const fromNode = new Node();
    const middleNode = new Node();
    const toNode = new Node();

    const trainrun = new Trainrun();
    trainrun.setDirection(Direction.ONE_WAY);
    trainrun.setTrainrunFrequency({
      id: 0,
      order: 0,
      frequency: 60,
      offset: 0,
      name: "verkehrt stündlich",
      shortName: "60",
      linePatternRef: LinePatternRefs.Freq60,
    } as TrainrunFrequency);

    const trainrunSections = [
      createTrainrunSection(0, 6, 54, 60, fromNode, middleNode, trainrun),
      createTrainrunSection(7, 13, 47, 53, middleNode, toNode, trainrun),
    ];

    const infrastructureEstimatorService = new InfrastructureEstimatorService();

    expect(
      infrastructureEstimatorService.estimateSectionTracks(fromNode, middleNode, [
        trainrunSections[0],
      ]),
    ).toEqual([[0, 1, 1]]);

    expect(
      infrastructureEstimatorService.estimateSectionTracks(middleNode, toNode, [
        trainrunSections[1],
      ]),
    ).toEqual([[0, 1, 1]]);
  });

  it("counts the second one-way trainrun only in its actual direction", () => {
    const fromNode = new Node();
    const toNode = new Node();

    const roundTripTrainrun = new Trainrun();
    roundTripTrainrun.setTrainrunFrequency({
      id: 3,
      order: 0,
      frequency: 60,
      offset: 0,
      name: "verkehrt stündlich",
      shortName: "60",
      linePatternRef: LinePatternRefs.Freq60,
    } as TrainrunFrequency);

    const oneWayTrainrun = new Trainrun();
    oneWayTrainrun.setDirection(Direction.ONE_WAY);
    oneWayTrainrun.setTrainrunFrequency({
      id: 2,
      order: 0,
      frequency: 30,
      offset: 0,
      name: "verkehrt halbstündlich",
      shortName: "30",
      linePatternRef: LinePatternRefs.Freq30,
    } as TrainrunFrequency);

    const trainrunSections = [
      createTrainrunSection(5, 25, 35, 55, fromNode, toNode, roundTripTrainrun),
      createTrainrunSection(51, 59, 1, 9, toNode, fromNode, oneWayTrainrun),
    ];

    const infrastructureEstimatorService = new InfrastructureEstimatorService();

    expect(
      infrastructureEstimatorService.estimateSectionTracks(fromNode, toNode, trainrunSections),
    ).toEqual([
      [0, 59 / 75, 1],
      [59 / 75, 139 / 150, 2],
      [139 / 150, 1, 1],
    ]);
  });

  it("handles asymmetric travel times for the A-B and B-C sections", () => {
    const nodeA = new Node();
    const nodeB = new Node();
    const nodeC = new Node();

    const createTrainrun = (id: number, frequency: number, direction = Direction.ROUND_TRIP) => {
      const trainrun = new Trainrun();
      trainrun.setDirection(direction);
      trainrun.setTrainrunFrequency({
        id,
        order: 0,
        frequency,
        offset: 0,
        name: `verkehrt im ${frequency} Minuten-Takt`,
        shortName: `${frequency}`,
        linePatternRef: frequency === 60 ? LinePatternRefs.Freq60 : LinePatternRefs.Freq30,
      } as TrainrunFrequency);
      return trainrun;
    };
    const roundTripTrainrun = createTrainrun(104, 60);
    const oneWayThirtyMinuteTrainrun = createTrainrun(105, 30, Direction.ONE_WAY);
    const oneWayFifteenMinuteTrainrun = createTrainrun(106, 15, Direction.ONE_WAY);

    const sectionABRoundTrip = createTrainrunSection(
      5,
      25,
      35,
      55,
      nodeA,
      nodeB,
      roundTripTrainrun,
    );
    const sectionABOneWay = createTrainrunSection(
      51,
      59,
      1,
      9,
      nodeB,
      nodeA,
      oneWayThirtyMinuteTrainrun,
    );
    const sectionBCRoundTrip = createTrainrunSection(
      26,
      32,
      28,
      34,
      nodeB,
      nodeC,
      roundTripTrainrun,
    );
    const sectionBCOneWayBackward = createTrainrunSection(
      43,
      49,
      11,
      17,
      nodeC,
      nodeB,
      oneWayThirtyMinuteTrainrun,
    );
    const sectionBCOneWayForward = createTrainrunSection(
      1,
      25,
      35,
      59,
      nodeB,
      nodeC,
      oneWayFifteenMinuteTrainrun,
    );
    const infrastructureEstimatorService = new InfrastructureEstimatorService();

    expect(
      infrastructureEstimatorService.estimateSectionTracks(nodeA, nodeB, [
        sectionABRoundTrip,
        sectionABOneWay,
      ]),
    ).toEqual([
      [0, 0.7866666666666666, 1],
      [0.7866666666666666, 0.9266666666666666, 2],
      [0.9266666666666666, 1, 1],
    ]);
    expect(
      infrastructureEstimatorService.estimateSectionTracks(nodeB, nodeC, [
        sectionBCRoundTrip,
        sectionBCOneWayBackward,
        sectionBCOneWayForward,
      ]),
    ).toEqual([
      [0, 0.03611111111111111, 1],
      [0.03611111111111111, 0.16666666666666666, 2],
      [0.16666666666666666, 0.44722222222222224, 1],
      [0.44722222222222224, 0.5361111111111111, 2],
      [0.5361111111111111, 0.6666666666666666, 3],
      [0.6666666666666666, 0.8277777777777777, 2],
      [0.8277777777777777, 1, 1],
    ]);
  });

  it("expands the unrolling window when the section travel time exceeds the frequency", () => {
    const fromNode = new Node();
    const toNode = new Node();
    const trainrun = new Trainrun();
    trainrun.setTrainrunFrequency({
      id: 3,
      order: 0,
      frequency: 60,
      offset: 0,
      name: "verkehrt stündlich",
      shortName: "60",
      linePatternRef: LinePatternRefs.Freq60,
    } as TrainrunFrequency);

    const section = createTrainrunSection(2, 187, 233, 418, fromNode, toNode, trainrun);

    const infrastructureEstimatorService = new InfrastructureEstimatorService();

    expect(
      infrastructureEstimatorService.estimateSectionTracks(fromNode, toNode, [section]),
    ).toEqual([
      [0, 0.14594594594594595, 1],
      [0.14594594594594595, 0.15675675675675677, 2],
      [0.15675675675675677, 0.3081081081081081, 1],
      [0.3081081081081081, 0.31891891891891894, 2],
      [0.31891891891891894, 0.4702702702702703, 1],
      [0.4702702702702703, 0.4810810810810811, 2],
      [0.4810810810810811, 0.6324324324324324, 1],
      [0.6324324324324324, 0.6432432432432432, 2],
      [0.6432432432432432, 0.7945945945945946, 1],
      [0.7945945945945946, 0.8054054054054054, 2],
      [0.8054054054054054, 0.9567567567567568, 1],
      [0.9567567567567568, 0.9675675675675676, 2],
      [0.9675675675675676, 1, 1],
    ]);
  });
});
