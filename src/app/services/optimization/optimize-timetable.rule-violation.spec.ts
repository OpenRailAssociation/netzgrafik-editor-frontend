import {Direction} from "../../data-structures/business.data.structures";
import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {InfrastructureEstimatorService} from "../infrastructure/infrastructure-estimator.service";
import {OptimizeTimetableSolution, TimeChange} from "./optimize-timetable.model";
import {OptimizeTimetableService} from "./optimize-timetable.service";
import {createDefaultOptimizationPolicy} from "./optimization-policy.model";

function createNode(
  id: number,
  name: string,
  isTerminal: boolean,
  nextSection: () => TrainrunSection | undefined = () => undefined,
  nonStop = false,
): Node {
  return {
    getId: () => id,
    getBetriebspunktName: () => name,
    isEndNode: () => isTerminal,
    isNonStop: () => nonStop,
    getNextTrainrunSection: nextSection,
    getTrainrunCategoryHaltezeit: () => ({passenger: {haltezeit: 5}}),
    getConnectionTime: () => 0,
    getConnections: (): never[] => [],
  } as unknown as Node;
}

function createTrainrun(direction: Direction) {
  return {
    getId: () => 10,
    getFrequency: () => 60,
    getDirection: () => direction,
    getTrainrunCategory: () => ({sectionHeadway: 1, fachCategory: "passenger"}),
    getCategoryShortName: () => "IR",
    getTitle: () => "123",
  };
}

function createSection(
  id: number,
  trainrun: ReturnType<typeof createTrainrun>,
  source: Node,
  target: Node,
  times: {
    sourceDeparture: number;
    sourceArrival: number;
    targetDeparture: number;
    targetArrival: number;
  },
): TrainrunSection {
  return {
    getId: () => id,
    getTrainrunId: () => trainrun.getId(),
    getTrainrun: () => trainrun,
    getSourceNode: () => source,
    getTargetNode: () => target,
    getSourceNodeId: () => source.getId(),
    getTargetNodeId: () => target.getId(),
    getSourceDeparture: () => times.sourceDeparture,
    getSourceArrival: () => times.sourceArrival,
    getTargetDeparture: () => times.targetDeparture,
    getTargetArrival: () => times.targetArrival,
    getSourceDepartureConsecutiveTime: () => times.sourceDeparture,
    getSourceArrivalConsecutiveTime: () => times.sourceArrival,
    getTargetDepartureConsecutiveTime: () => times.targetDeparture,
    getTargetArrivalConsecutiveTime: () => times.targetArrival,
    getTravelTime: () => 10,
    getBackwardTravelTime: () => 10,
    getSourceDepartureLock: () => false,
    getSourceArrivalLock: () => false,
    getTargetDepartureLock: () => false,
    getTargetArrivalLock: () => false,
    getTravelTimeLock: () => false,
    getBackwardTravelTimeLock: () => false,
    getSourceSymmetry: () => true,
    getTargetSymmetry: () => true,
    isSymmetric: () => true,
    areTravelTimesEqual: () => true,
  } as unknown as TrainrunSection;
}

describe("OptimizeTimetableService rule-violation details", () => {
  const service = new OptimizeTimetableService({} as InfrastructureEstimatorService);

  function getDetails(
    rule: "minimum-stop-time" | "arrival-before-departure" | "scope-boundary" | "symmetry",
    nodes: Node[],
    sections: TrainrunSection[],
    changes: TimeChange[],
    policy = createDefaultOptimizationPolicy(),
    selectedNodeIds: number[] = [],
  ) {
    return service.getRuleViolationTrainruns(
      rule,
      {assignment: {}, changes} as OptimizeTimetableSolution,
      nodes,
      sections,
      {maxTracksPerSection: 2, selectedNodeIds, policy},
    );
  }

  it("identifies both sides of a minimum-stop-time violation and orders the train's legs", () => {
    let nextSection: TrainrunSection;
    const source = createNode(1, "A", true);
    const stop = createNode(2, "B", false, () => nextSection);
    const target = createNode(3, "C", true);
    const trainrun = createTrainrun(Direction.ONE_WAY);
    const first = createSection(20, trainrun, source, stop, {
      sourceDeparture: 0,
      sourceArrival: 0,
      targetDeparture: 8,
      targetArrival: 8,
    });
    const second = createSection(21, trainrun, stop, target, {
      sourceDeparture: 14,
      sourceArrival: 14,
      targetDeparture: 20,
      targetArrival: 20,
    });
    nextSection = second;
    const change: TimeChange = {
      trainrunSectionId: 21,
      trainrunId: 10,
      trainrunName: "IR123",
      sourceNodeId: 2,
      targetNodeId: 3,
      sourceNodeName: "B",
      targetNodeName: "C",
      field: "sourceDeparture",
      oldValue: 14,
      newValue: 12,
    };

    const details = getDetails(
      "minimum-stop-time",
      [source, stop, target],
      [first, second],
      [change],
    );

    expect(details.length).toBe(1);
    expect(details[0].category).toBe("IR");
    expect(details[0].name).toBe("123");
    expect(details[0].journeys).toHaveSize(1);
    const rows = details[0].journeys[0].rows;
    expect(rows.map((row) => row.nodeName)).toEqual(["A", "B", "C"]);
    expect(rows[0].arrivalConsecutiveTime).toBeNull();
    expect(rows[0].departureConsecutiveTime).toBe(0);
    expect(rows[1].arrivalConsecutiveTime).toBe(8);
    expect(rows[1].departureConsecutiveTime).toBe(12);
    expect(rows[1].arrivalViolated).toBeTrue();
    expect(rows[1].departureViolated).toBeTrue();
    expect(rows[0].departureEditable).toBeTrue();
    expect(rows[1].arrivalEditable).toBeTrue();
    expect(rows[2].arrivalConsecutiveTime).toBe(20);
    expect(rows[2].departureConsecutiveTime).toBeNull();

    const fixedPolicy = createDefaultOptimizationPolicy();
    fixedPolicy.adjustableParameters.find(
      (parameter) => parameter.id === "allowTimeShifts",
    )!.enabled = false;
    const fixedDetails = getDetails(
      "minimum-stop-time",
      [source, stop, target],
      [first, second],
      [change],
      fixedPolicy,
    );
    expect(fixedDetails[0].journeys[0].rows[0].departureEditable).toBeFalse();
  });

  it("keeps both event times at a through-passage node", () => {
    let nextSection: TrainrunSection;
    const source = createNode(1, "A", true);
    const throughNode = createNode(2, "B", false, () => nextSection, true);
    const target = createNode(3, "C", true);
    const trainrun = createTrainrun(Direction.ONE_WAY);
    const first = createSection(40, trainrun, source, throughNode, {
      sourceDeparture: 0,
      sourceArrival: 0,
      targetDeparture: 10,
      targetArrival: 10,
    });
    const second = createSection(41, trainrun, throughNode, target, {
      sourceDeparture: 10,
      sourceArrival: 10,
      targetDeparture: 20,
      targetArrival: 20,
    });
    nextSection = second;
    const change: TimeChange = {
      trainrunSectionId: 41,
      trainrunId: 10,
      trainrunName: "IR123",
      sourceNodeId: 2,
      targetNodeId: 3,
      sourceNodeName: "B",
      targetNodeName: "C",
      field: "sourceDeparture",
      oldValue: 10,
      newValue: 11,
    };

    const details = getDetails(
      "scope-boundary",
      [source, throughNode, target],
      [first, second],
      [change],
      createDefaultOptimizationPolicy(),
      [2],
    );
    const throughRow = details[0].journeys[0].rows.find((row) => row.nodeId === 2);

    expect(throughRow?.arrivalConsecutiveTime).toBe(10);
    expect(throughRow?.departureConsecutiveTime).toBe(11);
  });

  it("marks both times involved in a symmetry violation on the affected direction", () => {
    const source = createNode(1, "A", true);
    const target = createNode(2, "B", true);
    const section = createSection(30, createTrainrun(Direction.ROUND_TRIP), source, target, {
      sourceDeparture: 0,
      sourceArrival: 0,
      targetDeparture: 50,
      targetArrival: 10,
    });
    const policy = createDefaultOptimizationPolicy();
    policy.hardConstraints.find((constraint) => constraint.id === "symmetry")!.enabled = true;
    const change: TimeChange = {
      trainrunSectionId: 30,
      trainrunId: 10,
      trainrunName: "IR123",
      sourceNodeId: 1,
      targetNodeId: 2,
      sourceNodeName: "A",
      targetNodeName: "B",
      field: "targetDeparture",
      oldValue: 50,
      newValue: 49,
    };

    const details = getDetails("symmetry", [source, target], [section], [change], policy);

    expect(details[0].journeys.map((journey) => journey.direction)).toEqual([
      "forward",
      "backward",
    ]);
    expect(details[0].journeys[0].rows.map((row) => row.nodeName)).toEqual(["A", "B"]);
    expect(details[0].journeys[1].rows.map((row) => row.nodeName)).toEqual(["B", "A"]);
    expect(details[0].journeys[0].rows[0].departureConsecutiveTime).toBe(0);
    expect(details[0].journeys[0].rows[1].arrivalConsecutiveTime).toBe(10);
    expect(details[0].journeys[1].rows[0].departureConsecutiveTime).toBe(49);
    expect(details[0].journeys[1].rows[1].arrivalConsecutiveTime).toBe(0);
    expect(details[0].journeys[0].rows[1].arrivalViolated).toBeTrue();
    expect(details[0].journeys[1].rows[0].departureViolated).toBeTrue();
  });
});
