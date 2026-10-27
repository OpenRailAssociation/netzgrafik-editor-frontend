import {OptimizationProblem} from "./optimize-timetable.chains";
import {TimetableEvaluator, WEIGHT_SHIFT} from "./optimize-timetable.evaluator";
import {createDefaultOptimizationPolicy} from "./optimization-policy.model";

function createEvaluator(
  stops: OptimizationProblem["stops"] = [],
  connections: OptimizationProblem["connections"] = [],
  variables: OptimizationProblem["variables"] = [],
  nodeEvents: OptimizationProblem["nodeEvents"] = [],
): TimetableEvaluator {
  const section = {
    getTravelTime: () => 0,
    getBackwardTravelTime: () => 0,
  };
  const problem = {
    sections: [section],
    trainrunIds: [1],
    origC: new Float64Array(4),
    origT: new Float64Array(4),
    active: new Uint8Array(4),
    chains: [],
    variables,
    edges: [],
    edgeInScope: new Uint8Array(0),
    stops,
    connections,
    nodeEvents,
    sectionChain: new Int32Array(1),
    sectionEdge: new Int32Array(1),
    varEdges: variables.map((): number[] => []),
    varStops: variables.map((): number[] => []),
    varTrainruns: variables.map((): number[] => []),
    varConnections: variables.map((): number[] => []),
    varNodeEvents: variables.map((): number[] => []),
    edgeVars: [],
    maxTracks: 0,
    optionalWindow: 5,
    policy: createDefaultOptimizationPolicy(),
  } as unknown as OptimizationProblem;
  const evaluator = new TimetableEvaluator(problem);
  evaluator.evaluateAll();
  return evaluator;
}

describe("TimetableEvaluator conflict severity", () => {
  it("strongly penalizes each shifted minute", () => {
    const evaluator = createEvaluator([], [], [
      {key: "shift", domain: 1, chains: [], fixed: false},
    ]);

    expect(evaluator.setVariable(0, 1)).toBe(WEIGHT_SHIFT);
    expect(WEIGHT_SHIFT).toBe(10);
  });

  it("rewards feasible optional connections and shorter waits", () => {
    const evaluator = createEvaluator([], [], [], [
      {
        node: undefined,
        connectionTime: 0,
        arrivals: [
          {section: 0, field: 0, trainrunId: 1, frequency: 60},
          {section: 0, field: 2, trainrunId: 2, frequency: 60},
        ],
        departures: [
          {section: 0, field: 1, trainrunId: 1, frequency: 60},
          {section: 0, field: 3, trainrunId: 2, frequency: 60},
        ],
      },
    ]);

    expect(evaluator.getOptionalConnectionScore()).toBeCloseTo(0.6);
  });

  it("does not report a stop conflict inside the hard-rule epsilon", () => {
    const evaluator = createEvaluator([
      {
        node: undefined,
        trainrunIndex: 0,
        arrSection: 0,
        arrField: 0,
        depSection: 0,
        depField: 1,
        dwell0: 10,
        minDwell: 10 + 5e-7,
      },
    ]);

    expect(evaluator.isStopViolated(0)).toBeFalse();
    expect(evaluator.getStopViolationSeverity(0)).toBe(0);
  });

  it("does not report a connection conflict inside the hard-rule epsilon", () => {
    const evaluator = createEvaluator(undefined, [
      {
        node: undefined,
        arrSection: 0,
        arrField: 0,
        depSection: 0,
        depField: 1,
        wait0: 10,
        lo: 10 + 5e-7,
        hi: 20,
      },
    ]);

    expect(evaluator.isConnectionViolated(0)).toBeFalse();
    expect(evaluator.getConnectionViolationSeverity(0)).toBe(0);
  });
});