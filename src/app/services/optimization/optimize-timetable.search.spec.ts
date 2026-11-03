import {TimetableEvaluator} from "./optimize-timetable.evaluator";
import {OptimizationProblem} from "./optimize-timetable.chains";
import {createDefaultOptimizationPolicy} from "./optimization-policy.model";
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

describe("runSearch continuation", () => {
  it("adds time to the same search state and keeps its archive", async () => {
    const problem: OptimizationProblem = {
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
    const search = await runSearch(problem, new TimetableEvaluator(problem), undefined, 30, 1);
    expect(search.bestAssignment.free).toBeGreaterThanOrEqual(-1);
    expect(search.bestAssignment.free).toBeLessThanOrEqual(1);
    const continueFor = search.continueFor;
    expect(continueFor).toBeDefined();
    if (continueFor === undefined) {
      throw new Error("Search continuation was not initialized.");
    }

    const firstIterations = search.iterations;
    const continuedSearch = await continueFor(30);

    expect(continuedSearch).toBe(search);
    expect(continuedSearch.archive).toBe(search.archive);
    expect(continuedSearch.iterations).toBeGreaterThan(firstIterations);
    expect(continuedSearch.bestAssignment.free).toBeGreaterThanOrEqual(-1);
    expect(continuedSearch.bestAssignment.free).toBeLessThanOrEqual(1);
  });
});
