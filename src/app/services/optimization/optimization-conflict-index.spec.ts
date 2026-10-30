import {OptimizationProblem} from "./optimize-timetable.chains";
import {TimetableEvaluator} from "./optimize-timetable.evaluator";
import {createDefaultOptimizationPolicy} from "./optimization-policy.model";
import {ConflictIndex} from "./optimization-conflict-index";

function createConflictIndex(overloads: number[], priorities: number[]): ConflictIndex {
  const node = (id: number) => ({getId: () => id});
  const problem = {
    policy: createDefaultOptimizationPolicy(),
    variables: [],
    edges: [
      {fromNode: node(1), toNode: node(2)},
      {fromNode: node(1), toNode: node(3)},
    ],
    edgeVars: [[], []],
    edgeInScope: new Uint8Array([1, 1]),
    connections: [],
    varConnections: [],
    stops: [],
    varStops: [],
    varNodeEvents: [],
  } as unknown as OptimizationProblem;
  const evaluator = {
    getTrackOverload: (edgeIndex: number) => overloads[edgeIndex],
    getConnectionViolationSeverity: () => 0,
    getStopViolationSeverity: () => 0,
    getTravelTimeExtensionExcess: () => 0,
  } as unknown as TimetableEvaluator;

  return new ConflictIndex(problem, evaluator, priorities);
}

describe("ConflictIndex track priorities", () => {
  it("orders active track conflicts by exact segment score", () => {
    const index = createConflictIndex([1, 1], [1.25, 1.75]);

    expect(index.getHighestPriority()?.componentIndex).toBe(1);
  });

  it("does not activate an edge without a hard track overload", () => {
    const index = createConflictIndex([1, 0], [1.25, 100]);

    expect(index.getHighestPriority()?.componentIndex).toBe(0);
  });
});
