import {TimetableEvaluator} from "./optimize-timetable.evaluator";
import {OptimizationProblem} from "./optimize-timetable.chains";
import {createDefaultOptimizationPolicy} from "./optimization-policy.model";
import {
  getLocalStepCandidates,
  orderConflictVariables,
  runSearch,
} from "./optimize-timetable.search";

describe("orderConflictVariables", () => {
  it("keeps every affected chain and rotates the starting candidate", () => {
    expect(orderConflictVariables([4, 2, 7, 2], 1)).toEqual([2, 7, 4]);
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
  });
});
