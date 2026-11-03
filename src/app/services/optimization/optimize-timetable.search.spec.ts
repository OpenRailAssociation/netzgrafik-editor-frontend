import {TimetableEvaluator} from "./optimize-timetable.evaluator";
import {OptimizationProblem} from "./optimize-timetable.chains";
import {createDefaultOptimizationPolicy} from "./optimization-policy.model";
import {ConflictIndex} from "./optimization-conflict-index";
import {Node} from "../../models/node.model";
import {Trainrun} from "../../models/trainrun.model";
import {TrainrunCategory} from "../../data-structures/business.data.structures";
import {
  getConflictStepCandidates,
  getLocalStepCandidates,
  getCategoryOrderRanks,
  getActivePriorityRank,
  orderConflictVariables,
  runSearch,
  shouldAcceptExploratoryMove,
} from "./optimize-timetable.search";

describe("getActivePriorityRank", () => {
  it("releases every priority group in the first half of the search budget", () => {
    expect(getActivePriorityRank(0, 4)).toBe(0);
    expect(getActivePriorityRank(0.25, 4)).toBe(1);
    expect(getActivePriorityRank(0.5, 4)).toBe(3);
    expect(getActivePriorityRank(1, 4)).toBe(3);
  });
});

describe("orderConflictVariables", () => {
  it("keeps every affected chain and rotates the starting candidate", () => {
    expect(orderConflictVariables([4, 2, 7, 2], 1)).toEqual([2, 7, 4]);
  });
});

describe("getCategoryOrderRanks", () => {
  it("ranks lower TrainrunCategory.order values first and keeps equal priorities together", () => {
    const categoryOrders = [2, 0, 2];
    const problem = {
      sections: [],
      trainrunIds: [],
      variables: categoryOrders.map((_, index) => ({
        key: `var-${index}`,
        domain: 1,
        chains: [index],
        fixed: false,
      })),
      chains: categoryOrders.map((order) => ({
        trainrun: {getCategoryOrder: () => order},
      })),
    } as unknown as Pick<OptimizationProblem, "sections" | "variables" | "chains" | "trainrunIds">;

    const ranks = getCategoryOrderRanks(problem, [0, 1, 2]);

    expect(ranks.groupCount).toBe(2);
    expect(ranks.variablesByRank).toEqual([[1], [0, 2]]);
  });
});

describe("getLocalStepCandidates", () => {
  it("orders both departure-shift directions by increasing minute distance", () => {
    expect(getLocalStepCandidates(0, 3)).toEqual([
      [-1, 1],
      [-2, 2],
      [-3, 3],
    ]);
  });

  it("keeps moves inside the variable domain when stepping back toward baseline", () => {
    expect(getLocalStepCandidates(2, 2)).toEqual([[1], [0], [-1], [-2]]);
  });
});

describe("getConflictStepCandidates", () => {
  it("tests the full allowed domain only for later category-priority groups", () => {
    expect(getConflictStepCandidates(0, 12, "flexibilityCategoryFirst", 0).length).toBe(5);
    expect(getConflictStepCandidates(0, 12, "flexibilityCategoryFirst", 1).length).toBe(12);
    expect(getConflictStepCandidates(0, 12, "flexibilityFrequencyFirst", 1).length).toBe(5);
    expect(getConflictStepCandidates(0, 12, undefined, undefined).length).toBe(5);
  });

  it("tries one minute, then the section headway before nearby shifts", () => {
    expect(
      getConflictStepCandidates(0, 12, undefined, undefined, 3).map(({distance, values}) => [
        distance,
        values,
      ]),
    ).toEqual([
      [1, [-1, 1]],
      [3, [-3, 3]],
      [2, [-2, 2]],
      [4, [-4, 4]],
      [5, [-5, 5]],
    ]);
  });

  it("includes the exact headway even when it exceeds the usual five-minute step", () => {
    const candidates = getConflictStepCandidates(0, 12, undefined, undefined, 8);

    expect(candidates.slice(0, 2).map(({distance, values}) => [distance, values])).toEqual([
      [1, [-1, 1]],
      [8, [-8, 8]],
    ]);
  });
});

describe("shouldAcceptExploratoryMove", () => {
  it("accepts non-worsening scores only when the hard-conflict count does not increase", () => {
    expect(shouldAcceptExploratoryMove(3, 3, 10, 10, 1, 0.9)).toBe(true);
    expect(shouldAcceptExploratoryMove(3, 4, 10, 9, 1, 0)).toBe(false);
  });

  it("uses the search temperature to occasionally accept a worse-scoring plateau move", () => {
    expect(shouldAcceptExploratoryMove(3, 3, 10, 11, 1, 0.3)).toBe(true);
    expect(shouldAcceptExploratoryMove(3, 3, 10, 11, 1, 0.5)).toBe(false);
  });
});

function createSearchProblem(): OptimizationProblem {
  return {
    sections: [],
    nodeTrackNodes: [],
    trainrunIds: [],
    origC: new Float64Array(),
    origT: new Float64Array(),
    active: new Uint8Array(),
    chains: [],
    variables: [{key: "free", domain: 1, chains: [], fixed: false}],
    edges: [],
    edgeInScope: new Uint8Array(),
    stops: [],
    connections: [],
    nodeEvents: [],
    sectionChain: new Int32Array(),
    sectionEdge: new Int32Array(),
    varEdges: [[]],
    varStops: [[]],
    varTrainruns: [[]],
    varConnections: [[]],
    varNodeEvents: [[]],
    varNodeTrackNodes: [[]],
    travelTimeVariables: new Int32Array(),
    edgeVars: [],
    maxTracks: 1,
    optionalWindow: 5,
    policy: createDefaultOptimizationPolicy(),
  };
}

describe("runSearch coordinated shifts", () => {
  it("finds a one-minute trainrun shift when isolated moves and headway-sized moves cannot repair it", async () => {
    let now = 0;
    spyOn(performance, "now").and.callFake(() => ++now);
    const problem = createSearchProblem();
    const trainrun = jasmine.createSpyObj<Trainrun>("trainrun", [
      "getId",
      "getFrequency",
      "getTrainrunCategory",
    ]);
    trainrun.getId.and.returnValue(1);
    trainrun.getFrequency.and.returnValue(60);
    trainrun.getTrainrunCategory.and.returnValue(
      jasmine.createSpyObj<TrainrunCategory>("category", [], {sectionHeadway: 3}),
    );
    problem.variables = [0, 1].map((index) => ({
      key: `chain-${index}`,
      domain: 3,
      chains: [index],
      fixed: false,
    }));
    problem.chains = [0, 1].map((index): OptimizationProblem["chains"][number] => ({
      key: `chain-${index}`,
      trainrun,
      steps: [],
      varA: index,
      varB: index,
      signB: 0,
      mirrorB: false,
      fixed: false,
    }));
    const nodes = [1, 2].map((id) => {
      const node = jasmine.createSpyObj<Node>("node", ["getId"]);
      node.getId.and.returnValue(id);
      return node;
    });
    problem.edges = [
      {
        fromNode: nodes[0],
        toNode: nodes[1],
        sections: [],
        headways: [],
        maxFrequency: 60,
      },
    ];
    problem.edgeInScope = new Uint8Array([1]);
    problem.edgeVars = [[0, 1]];
    problem.varEdges = [[0], [0]];
    problem.varStops = [[], []];
    problem.varTrainruns = [[], []];
    problem.varConnections = [[], []];
    problem.varNodeEvents = [[], []];
    const delta = new Int32Array(2);
    const repaired = () => delta[0] === 1 && delta[1] === 1;
    const hard = () => Number(!repaired()) + Number(delta[0] !== delta[1]);
    const score = () => hard() * 1e6;
    const evaluator = jasmine.createSpyObj<TimetableEvaluator>(
      "evaluator",
      [
        "evaluateAll",
        "setVariable",
        "score",
        "parts",
        "getTrackOverload",
        "getTrackConflictCost",
        "getEdgeTracks",
      ],
      {delta},
    );
    evaluator.evaluateAll.and.callFake(score);
    evaluator.score.and.callFake(score);
    evaluator.setVariable.and.callFake((index, value) => {
      delta[index] = value;
      return score();
    });
    evaluator.getTrackOverload.and.callFake(() => Number(!repaired()));
    evaluator.getTrackConflictCost.and.callFake(() => Number(!repaired()));
    evaluator.getEdgeTracks.and.callFake(() => (repaired() ? 1 : 2));
    evaluator.parts.and.callFake(() => ({
      hard: hard(),
      excess: Number(!repaired()),
      trackConflictCost: Number(!repaired()),
      edgeTrackCost: 0,
      nodeTrackCost: 0,
      edgesOverLimit: Number(!repaired()),
      connectionViolations: 0,
      connectionWaitDeviation: 0,
      stopViolations: Number(delta[0] !== delta[1]),
      travelTimeExtensionViolation: 0,
      travelTimeDelta: 0,
      optionalConnections: 0,
      sumAbsShift: Math.abs(delta[0]) + Math.abs(delta[1]),
    }));

    const result = await runSearch(problem, evaluator, undefined, 100, 1);

    expect(result.archive.some((solution) => solution.parts.hard === 0)).toBeTrue();
    expect(result.bestAssignment).toEqual({"chain-0": 1, "chain-1": 1});
  });
});

describe("runSearch continuation", () => {
  it("adds time to the same search state and keeps its archive", async () => {
    const refreshConflicts = spyOn(ConflictIndex.prototype, "refreshAll").and.callThrough();
    const problem = createSearchProblem();
    const search = await runSearch(problem, new TimetableEvaluator(problem), undefined, 30, 1);
    expect(refreshConflicts).toHaveBeenCalledTimes(2);
    expect(search.bestAssignment.free).toBeGreaterThanOrEqual(-1);
    expect(search.bestAssignment.free).toBeLessThanOrEqual(1);
    const continueFor = search.continueFor;
    expect(continueFor).toBeDefined();
    if (continueFor === undefined) {
      throw new Error("Search continuation was not initialized.");
    }

    const firstIterations = search.iterations;
    const continuedSearch = await continueFor(30);
    expect(refreshConflicts).toHaveBeenCalledTimes(3);

    expect(continuedSearch).toBe(search);
    expect(continuedSearch.archive).toBe(search.archive);
    expect(continuedSearch.iterations).toBeGreaterThan(firstIterations);
    expect(continuedSearch.bestAssignment.free).toBeGreaterThanOrEqual(-1);
    expect(continuedSearch.bestAssignment.free).toBeLessThanOrEqual(1);
  });
});
