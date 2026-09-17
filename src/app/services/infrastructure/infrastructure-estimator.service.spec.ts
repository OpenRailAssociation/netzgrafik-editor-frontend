import {InfrastructureEstimatorService} from "./infrastructure-estimator.service";
import {LinePatternRefs, TrainrunFrequency} from "../../data-structures/business.data.structures";
import {Node} from "../../models/node.model";
import {Trainrun} from "../../models/trainrun.model";
import {TrainrunSection} from "../../models/trainrunsection.model";

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

    const createTrainrunSection = (
      sourceDeparture: number,
      targetArrival: number,
      targetDeparture: number,
      sourceArrival: number,
      sourceNode: Node,
      targetNode: Node,
    ) => {
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

    const trainrunSections = [
      createTrainrunSection(0, 6, 54, 60, fromNode, middleNode),
      createTrainrunSection(7, 13, 47, 53, middleNode, toNode),
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

    const createTrainrunSection = (
      sourceDeparture: number,
      targetArrival: number,
      targetDeparture: number,
      sourceArrival: number,
      sourceNode: Node,
      targetNode: Node,
      trainrun: Trainrun,
    ) => {
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
});
