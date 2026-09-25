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

describe("InfrastructureEstimatorService", () => {
  it("matches the A-B and B-C section track calculation", () => {
    const fromNode = new Node();
    const middleNode = new Node();
    const toNode = new Node();

    const trainrun = new Trainrun();
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
    ).toEqual([
      [0, 1 / 6, 2],
      [1 / 6, 1, 1],
    ]);

    expect(
      infrastructureEstimatorService.estimateSectionTracks(middleNode, toNode, [
        trainrunSections[1],
      ]),
    ).toEqual([[0, 1, 1]]);
  });

  it("handles a 62-minute travel time with a 60-minute frequency", () => {
    const fromNode = new Node();
    const toNode = new Node();
    const trainrun = new Trainrun();
    trainrun.setTrainrunFrequency({
      id: 0,
      order: 0,
      frequency: 60,
      offset: 0,
      name: "verkehrt stündlich",
      shortName: "60",
      linePatternRef: LinePatternRefs.Freq60,
    } as TrainrunFrequency);

    const section = createTrainrunSection(0, 62, 54, 60, fromNode, toNode, trainrun);

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
    const fromNode = new Node();
    const middleNode = new Node();
    const toNode = new Node();
    const createTrainrun = (id: number, frequency: number, shortName: string) => {
      const trainrun = new Trainrun();
      trainrun.setTrainrunFrequency({
        id,
        order: 0,
        frequency,
        offset: 0,
        name: `verkehrt im ${shortName} Minuten-Takt`,
        shortName,
        linePatternRef: frequency === 60 ? LinePatternRefs.Freq60 : LinePatternRefs.Freq30,
      } as TrainrunFrequency);
      return trainrun;
    };
    const hourlyTrainrun = createTrainrun(3, 60, "60");
    const halfHourlyTrainrun = createTrainrun(2, 30, "30");
    const quarterHourlyTrainrun = createTrainrun(0, 15, "15");

    const trainrunSections = [
      createTrainrunSection(0, 6, 54, 60, fromNode, middleNode, hourlyTrainrun),
      createTrainrunSection(7, 13, 47, 53, middleNode, toNode, hourlyTrainrun),
      createTrainrunSection(43, 49, 11, 17, toNode, middleNode, halfHourlyTrainrun),
      createTrainrunSection(51, 59, 1, 9, middleNode, fromNode, halfHourlyTrainrun),
      createTrainrunSection(1, 25, 35, 59, middleNode, toNode, quarterHourlyTrainrun),
    ];
    const infrastructureEstimatorService = new InfrastructureEstimatorService();

    expect(
      infrastructureEstimatorService.estimateSectionTracks(fromNode, middleNode, [
        trainrunSections[0],
        trainrunSections[3],
      ]),
    ).toEqual([
      [0, 3 / 40, 3],
      [3 / 40, 59 / 120, 2],
      [59 / 120, 1, 1],
    ]);
    expect(
      infrastructureEstimatorService.estimateSectionTracks(middleNode, toNode, [
        trainrunSections[1],
        trainrunSections[2],
        trainrunSections[4],
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
        trainrunSections[1],
        trainrunSections[2],
        trainrunSections[4],
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
