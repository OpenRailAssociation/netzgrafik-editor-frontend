import {OptimizationProblem} from "./optimize-timetable.chains";
import {buildProblem} from "./optimize-timetable.chains";
import {Node} from "../../models/node.model";
import {Direction} from "../../data-structures/business.data.structures";
import {
  InfrastructureEstimatorService,
  NodeTrackEstimate,
} from "../infrastructure/infrastructure-estimator.service";
import {
  TimetableEvaluator,
  WEIGHT_HARD,
  WEIGHT_SHIFT,
  WEIGHT_TRACK,
} from "./optimize-timetable.evaluator";
import {createDefaultOptimizationPolicy, OptimizationPolicy} from "./optimization-policy.model";

function createEvaluator(
  stops: OptimizationProblem["stops"] = [],
  connections: OptimizationProblem["connections"] = [],
  variables: OptimizationProblem["variables"] = [],
  nodeEvents: OptimizationProblem["nodeEvents"] = [],
  minimumStopTimeEnabled = true,
  policyOverride?: OptimizationPolicy,
): TimetableEvaluator {
  const section = {
    getTravelTime: () => 0,
    getBackwardTravelTime: () => 0,
  };
  const policy = policyOverride ?? createDefaultOptimizationPolicy();
  if (policyOverride === undefined) {
    policy.mode = "userDefined";
  }
  policy.hardConstraints.find((constraint) => constraint.id === "minimumStopTime").enabled =
    minimumStopTimeEnabled;
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
    policy,
  } as unknown as OptimizationProblem;
  const evaluator = new TimetableEvaluator(problem);
  evaluator.evaluateAll();
  return evaluator;
}

function createTrackEvaluator(
  trackLimitEnabled: boolean,
  edgeObjectiveEnabled: boolean,
  maxTracks = 1,
) {
  const sections = [0, 1].map(() => ({
    getSourceNodeId: () => 1,
    getTargetNodeId: () => 2,
    getTravelTime: () => 30,
    getBackwardTravelTime: () => 30,
    getTrainrun: () => ({getFrequency: () => 60}),
  }));
  const policy = createDefaultOptimizationPolicy();
  policy.mode = "userDefined";
  policy.hardConstraints.find((constraint) => constraint.id === "trackLimit").enabled =
    trackLimitEnabled;
  policy.objectives.forEach((objective) => (objective.enabled = false));
  policy.objectives.find((objective) => objective.id === "lowerEdgeTrackUsage").enabled =
    edgeObjectiveEnabled;
  const problem = {
    sections,
    trainrunIds: [1, 2],
    origC: new Float64Array([0, 0, 0, 30, 0, 0, 0, 30]),
    origT: new Float64Array([0, 0, 0, 30, 0, 0, 0, 30]),
    active: new Uint8Array([1, 0, 0, 1, 1, 0, 0, 1]),
    chains: [],
    variables: [],
    edges: [
      {
        fromNode: {getId: () => 1},
        toNode: {getId: () => 2},
        sections: [0, 1],
        headways: [1, 1],
        maxFrequency: 60,
      },
    ],
    edgeInScope: new Uint8Array([1]),
    stops: [],
    connections: [],
    nodeEvents: [],
    sectionChain: new Int32Array(2).fill(-1),
    sectionEdge: new Int32Array([0, 0]),
    varEdges: [],
    varStops: [],
    varTrainruns: [],
    varConnections: [],
    varNodeEvents: [],
    edgeVars: [[]],
    maxTracks,
    optionalWindow: 5,
    policy,
  } as unknown as OptimizationProblem;
  const evaluator = new TimetableEvaluator(problem);
  evaluator.evaluateAll();
  return evaluator;
}

function createNodeTrackEvaluator(objectiveEnabled: boolean) {
  const section = {
    getId: () => 10,
    getSourceNodeId: () => 1,
    getTargetNodeId: () => 2,
    getTravelTime: () => 30,
    getBackwardTravelTime: () => 30,
  };
  const node = {getId: () => 2} as unknown as Node;
  const policy = createDefaultOptimizationPolicy();
  policy.mode = "userDefined";
  policy.hardConstraints.find((constraint) => constraint.id === "trackLimit").enabled = false;
  policy.objectives.forEach((objective) => (objective.enabled = false));
  policy.objectives.find((objective) => objective.id === "lowerTrackUsage").enabled =
    objectiveEnabled;
  const problem = {
    sections: [section],
    nodeTrackNodes: [node],
    trainrunIds: [1],
    origC: new Float64Array([0, 0, 0, 30]),
    origT: new Float64Array([0, 0, 0, 30]),
    active: new Uint8Array([1, 0, 0, 1]),
    chains: [
      {
        steps: [{sectionIdx: 0, fromNode: node, toNode: node, aligned: true}],
        varA: 0,
        varB: 0,
        signB: 1,
        mirrorB: false,
        fixed: false,
      },
    ],
    variables: [{key: "test", domain: 2, chains: [0], fixed: false}],
    edges: [],
    edgeInScope: new Uint8Array(0),
    stops: [],
    connections: [],
    nodeEvents: [],
    sectionChain: new Int32Array([0]),
    sectionEdge: new Int32Array([-1]),
    varEdges: [[]],
    varStops: [[]],
    varTrainruns: [[]],
    varConnections: [[]],
    varNodeEvents: [[]],
    varNodeTrackNodes: [[0]],
    edgeVars: [],
    maxTracks: 1,
    optionalWindow: 5,
    policy,
  } as unknown as OptimizationProblem;
  const estimator = jasmine.createSpyObj<InfrastructureEstimatorService>(
    "InfrastructureEstimatorService",
    ["estimateNodeTracks"],
  );
  estimator.estimateNodeTracks.and.callFake((_node, sections, options) => {
    const arrival = options.getTime?.(sections[0], "target", "arrival", "consecutive");
    const trackCount = arrival === 30 ? 2 : 1;
    return Array.from({length: trackCount}, (_, index): NodeTrackEstimate => ({
      track: index + 1,
      occupancies: [],
    }));
  });
  const evaluator = new TimetableEvaluator(problem, estimator);
  evaluator.evaluateAll();
  return {evaluator, estimator};
}

function createSectionTravelTimeEvaluator(): TimetableEvaluator {
  const sections = [0, 1].map(() => ({
    getTravelTime: () => 10,
    getBackwardTravelTime: () => 10,
  }));
  const policy = createDefaultOptimizationPolicy();
  policy.mode = "userDefined";
  policy.hardConstraints.find((constraint) => constraint.id === "trackLimit").enabled = false;
  const travelLimit = policy.hardConstraints.find(
    (constraint) => constraint.id === "maxTravelTimeExtension",
  );
  travelLimit.enabled = true;
  travelLimit.value = 5;
  policy.objectives.forEach((objective) => (objective.enabled = false));
  const steps = [
    {sectionIdx: 0, fromNode: {} as Node, toNode: {} as Node, aligned: true},
    {sectionIdx: 1, fromNode: {} as Node, toNode: {} as Node, aligned: true},
  ];
  const problem = {
    sections,
    nodeTrackNodes: [],
    trainrunIds: [1],
    origC: new Float64Array([0, 0, 0, 10, 10, 10, 10, 20]),
    origT: new Float64Array([0, 0, 0, 10, 10, 10, 10, 20]),
    active: new Uint8Array([1, 0, 0, 1, 1, 0, 0, 1]),
    chains: [
      {
        key: "chain",
        trainrun: undefined,
        steps,
        varA: 0,
        varB: 0,
        signB: 1,
        mirrorB: false,
        fixed: false,
      },
    ],
    variables: [
      {key: "shift", domain: 5, chains: [0], fixed: false},
      {key: "section-0-travel", domain: 5, chains: [0], fixed: false, travelTimeTrainrunIndex: 0},
      {key: "section-1-travel", domain: 5, chains: [0], fixed: false, travelTimeTrainrunIndex: 0},
    ],
    edges: [],
    edgeInScope: new Uint8Array(0),
    stops: [],
    connections: [],
    nodeEvents: [],
    sectionChain: new Int32Array([0, 0]),
    sectionEdge: new Int32Array([-1, -1]),
    varEdges: [[], [], []],
    varStops: [[], [], []],
    varTrainruns: [[0], [0], [0]],
    varConnections: [[], [], []],
    varNodeEvents: [[], [], []],
    varNodeTrackNodes: [[], [], []],
    travelTimeVariables: new Int32Array([1, -1, 2, -1]),
    edgeVars: [],
    maxTracks: 1,
    optionalWindow: 5,
    policy,
  } as unknown as OptimizationProblem;
  const evaluator = new TimetableEvaluator(problem);
  evaluator.evaluateAll();
  return evaluator;
}

function buildSingleSectionProblem(
  direction: Direction,
  symmetryEnabled: boolean,
  travelTimeExtensionEnabled = true,
  sourceDepartureLocked = false,
  targetArrivalLocked = false,
  selectedNodeIds: number[] = [],
  travelTimeLocked = false,
  timeLocksEnabled = true,
  travelTimeLocksEnabled = true,
) {
  const source = {
    getId: () => 1,
    isEndNode: () => true,
    isNonStop: () => false,
    getConnectionTime: () => 0,
    getConnections: (): never[] => [],
  } as unknown as Node;
  const target = {
    getId: () => 2,
    isEndNode: () => true,
    isNonStop: () => false,
    getConnectionTime: () => 0,
    getConnections: (): never[] => [],
  } as unknown as Node;
  const trainrun = {
    getId: () => 1,
    getFrequency: () => 10,
    getDirection: () => direction,
    getTrainrunCategory: () => ({sectionHeadway: 1}),
  };
  const section = {
    getId: () => 10,
    getTrainrunId: () => 1,
    getTrainrun: () => trainrun,
    getSourceNode: () => source,
    getTargetNode: () => target,
    getSourceNodeId: () => 1,
    getTargetNodeId: () => 2,
    getSourceDeparture: () => 0,
    getSourceArrival: () => 0,
    getTargetDeparture: () => 50,
    getTargetArrival: () => 10,
    getSourceDepartureConsecutiveTime: () => 0,
    getSourceArrivalConsecutiveTime: () => 0,
    getTargetDepartureConsecutiveTime: () => 50,
    getTargetArrivalConsecutiveTime: () => 10,
    getTravelTime: () => 10,
    getBackwardTravelTime: () => 10,
    getSourceDepartureLock: () => sourceDepartureLocked,
    getSourceArrivalLock: () => false,
    getTargetDepartureLock: () => false,
    getTargetArrivalLock: () => targetArrivalLocked,
    getTravelTimeLock: () => travelTimeLocked,
    getBackwardTravelTimeLock: () => travelTimeLocked,
    getSourceSymmetry: () => true,
    getTargetSymmetry: () => true,
    isSymmetric: () => true,
    areTravelTimesEqual: () => true,
  };
  const policy = createDefaultOptimizationPolicy();
  policy.hardConstraints.find((constraint) => constraint.id === "timeLocks").enabled =
    timeLocksEnabled;
  policy.hardConstraints.find((constraint) => constraint.id === "travelTimeLocks").enabled =
    travelTimeLocksEnabled;
  policy.hardConstraints.find((constraint) => constraint.id === "symmetry").enabled =
    symmetryEnabled;
  const travelLimit = policy.hardConstraints.find(
    (constraint) => constraint.id === "maxTravelTimeExtension",
  );
  travelLimit.enabled = travelTimeExtensionEnabled;
  travelLimit.value = 5;

  return buildProblem(
    [source, target],
    [section] as unknown as OptimizationProblem["sections"],
    2,
    selectedNodeIds,
    2,
    5,
    policy,
  );
}

describe("TimetableEvaluator conflict severity", () => {
  it("skips section-track evaluation when both track controls are off", () => {
    const evaluator = createTrackEvaluator(false, false);

    expect(evaluator.getEdgeTracks(0)).toBe(0);
    expect(evaluator.parts().excess).toBe(0);
    expect(evaluator.parts().hard).toBe(0);
    expect(evaluator.score()).toBe(0);
  });

  it("still enforces the hard section limit when the soft objective is off", () => {
    const evaluator = createTrackEvaluator(true, false);

    expect(evaluator.parts().hard).toBe(1);
    expect(evaluator.score()).toBe(WEIGHT_HARD);
  });

  it("uses section overload as a soft cost when the edge objective is enabled", () => {
    const evaluator = createTrackEvaluator(false, true);

    expect(evaluator.parts().hard).toBe(0);
    expect(evaluator.score()).toBe(3 * WEIGHT_TRACK);
  });

  it("reduces section-track usage even when it is below the hard limit", () => {
    const evaluator = createTrackEvaluator(false, true, 3);

    expect(evaluator.parts().excess).toBe(0);
    expect(evaluator.parts().edgeTrackCost).toBe(3);
    expect(evaluator.score()).toBe(3 * WEIGHT_TRACK);
  });

  it("recalculates node tracks only when the node objective is enabled", () => {
    const inactive = createNodeTrackEvaluator(false);
    expect(inactive.estimator.estimateNodeTracks).not.toHaveBeenCalled();
    inactive.evaluator.setVariable(0, 1);
    expect(inactive.estimator.estimateNodeTracks).not.toHaveBeenCalled();

    const active = createNodeTrackEvaluator(true);
    expect(active.evaluator.score()).toBe(3 * WEIGHT_TRACK);
    expect(active.estimator.estimateNodeTracks).toHaveBeenCalledTimes(1);
    active.evaluator.setVariable(0, 1);
    expect(active.evaluator.score()).toBe(1.5 * WEIGHT_TRACK);
    expect(active.estimator.estimateNodeTracks).toHaveBeenCalledTimes(2);
  });

  it("allows each section its own extension up to the configured maximum", () => {
    const evaluator = createSectionTravelTimeEvaluator();

    evaluator.setVariable(1, 5);
    evaluator.setVariable(2, 5);

    expect(evaluator.candTravel[0]).toBe(15);
    expect(evaluator.candTravel[2]).toBe(15);
    expect(evaluator.candC[7]).toBe(30);
    expect(evaluator.parts().travelTimeDelta).toBe(10);
    expect(evaluator.parts().travelTimeExtensionViolation).toBe(0);

    evaluator.setVariable(1, 6);
    expect(evaluator.getTravelTimeExtensionExcess(0)).toBe(1);
    expect(evaluator.parts().travelTimeExtensionViolation).toBe(1);
    expect(evaluator.parts().hard).toBe(1);
  });

  it("creates runtime variables only for active directions and links symmetric ones", () => {
    const withoutTravelTimeExtension = buildSingleSectionProblem(Direction.ONE_WAY, true, false);
    const oneWay = buildSingleSectionProblem(Direction.ONE_WAY, true);
    expect(oneWay.travelTimeVariables[0]).toBeGreaterThanOrEqual(0);
    expect(oneWay.travelTimeVariables[1]).toBe(-1);
    expect(
      oneWay.variables.filter((variable) => !variable.fixed && variable.domain > 0).length,
    ).toBe(2);
    expect(
      oneWay.variables.filter((variable) => !variable.fixed && variable.domain > 0).length -
        withoutTravelTimeExtension.variables.filter(
          (variable) => !variable.fixed && variable.domain > 0,
        ).length,
    ).toBe(1);

    const symmetric = buildSingleSectionProblem(Direction.ROUND_TRIP, true);
    expect(symmetric.travelTimeVariables[0]).toBe(symmetric.travelTimeVariables[1]);

    const asymmetric = buildSingleSectionProblem(Direction.ROUND_TRIP, false);
    expect(asymmetric.travelTimeVariables[0]).not.toBe(asymmetric.travelTimeVariables[1]);
  });

  it("keeps a section runtime free when an unrelated departure lock fixes its chain", () => {
    const problem = buildSingleSectionProblem(Direction.ONE_WAY, true, true, true);
    const runtimeVariable = problem.variables[problem.travelTimeVariables[0]];
    const evaluator = new TimetableEvaluator(problem);
    evaluator.evaluateAll();
    evaluator.setVariable(problem.travelTimeVariables[0], 5);

    expect(problem.chains[0].fixed).toBeTrue();
    expect(runtimeVariable.fixed).toBeFalse();
    expect(runtimeVariable.domain).toBe(5);
    expect(evaluator.candT[0]).toBe(0);
    expect(evaluator.candT[3]).toBe(15);
  });

  it("keeps the runtime fixed when its propagated arrival is locked", () => {
    const problem = buildSingleSectionProblem(Direction.ONE_WAY, true, true, false, true);
    const runtimeVariable = problem.variables[problem.travelTimeVariables[0]];

    expect(runtimeVariable.fixed).toBeTrue();
    expect(runtimeVariable.domain).toBe(0);
    expect(runtimeVariable.travelTimeFixedReason).toBe("arrival-time-lock");
  });

  it("keeps section runtimes fixed on the boundary of a partial scope", () => {
    const problem = buildSingleSectionProblem(Direction.ONE_WAY, true, true, false, false, [1]);
    const runtimeVariable = problem.variables[problem.travelTimeVariables[0]];

    expect(runtimeVariable.fixed).toBeTrue();
    expect(runtimeVariable.domain).toBe(0);
    expect(runtimeVariable.travelTimeFixedReason).toBe("scope");
  });

  it("defaults both lock rules to active and lets each be disabled independently", () => {
    const policy = createDefaultOptimizationPolicy();
    expect(
      policy.hardConstraints.find((constraint) => constraint.id === "timeLocks").enabled,
    ).toBeTrue();
    expect(
      policy.hardConstraints.find((constraint) => constraint.id === "travelTimeLocks").enabled,
    ).toBeTrue();

    const travelTimeLocksDisabled = buildSingleSectionProblem(
      Direction.ONE_WAY,
      true,
      true,
      false,
      false,
      [],
      true,
      true,
      false,
    );
    expect(
      travelTimeLocksDisabled.variables[travelTimeLocksDisabled.travelTimeVariables[0]].fixed,
    ).toBeFalse();

    const timeLocksDisabled = buildSingleSectionProblem(
      Direction.ONE_WAY,
      true,
      true,
      false,
      true,
      [],
      false,
      false,
      true,
    );
    expect(timeLocksDisabled.variables[timeLocksDisabled.travelTimeVariables[0]].fixed).toBeFalse();
  });

  it("reports stop violations when the hard minimum stop-time rule is disabled", () => {
    const evaluator = createEvaluator(
      [
        {
          node: undefined,
          trainrunIndex: 0,
          arrSection: 0,
          arrField: 0,
          depSection: 0,
          depField: 1,
          dwell0: 10,
          minDwell: 12,
        },
      ],
      [],
      [],
      [],
      false,
    );

    expect(evaluator.parts().stopViolations).toBe(1);
    expect(evaluator.parts().hard).toBe(0);
  });

  it("strongly penalizes each shifted minute", () => {
    const evaluator = createEvaluator(
      [],
      [],
      [{key: "shift", domain: 1, chains: [], fixed: false}],
    );

    expect(evaluator.setVariable(0, 1)).toBe(WEIGHT_SHIFT);
    expect(WEIGHT_SHIFT).toBe(10);
  });

  it("uses the Director rank-based weight while scoring each search move", () => {
    const policy = createDefaultOptimizationPolicy();
    policy.objectives.find((objective) => objective.id === "minimalChanges").rating = 3;
    const evaluator = createEvaluator(
      [],
      [],
      [{key: "shift", domain: 1, chains: [], fixed: false}],
      [],
      true,
      policy,
    );

    expect(evaluator.setVariable(0, 1)).toBe(WEIGHT_SHIFT / 16);
  });

  it("rewards feasible optional connections and shorter waits", () => {
    const evaluator = createEvaluator(
      [],
      [],
      [],
      [
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
      ],
    );

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
