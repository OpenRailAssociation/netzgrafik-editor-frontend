import {OptimizeTimetableKpi, OptimizeTimetableSolution} from "./optimize-timetable.model";
import {compareSolutions} from "./optimization-solution-comparator";
import {createDefaultOptimizationPolicy} from "./optimization-policy.model";

function solution(id: number, kpi: Partial<OptimizeTimetableKpi>): OptimizeTimetableSolution {
  return {
    id,
    label: `Candidate ${id}`,
    valid: true,
    kpi: {
      objectiveScores: {
        minimalChanges: 0,
        moreConnections: 0,
        lowerTravelTime: 0,
        lowerTrackUsage: 0,
      },
      changedChains: 0,
      totalDeltaMinutes: 0,
      travelTimeExtensionMinutes: 0,
      optionalConnections: 0,
      maxTrackUsage: 0,
      averageTrackUsage: 0,
      changedNodes: 0,
      edgesOverLimitBefore: 0,
      edgesOverLimitAfter: 0,
      maxTracksBefore: 0,
      maxTracksAfter: 0,
      totalTravelTimeDelta: 0,
      optionalConnectionsBefore: 0,
      optionalConnectionsAfter: 0,
      sumAbsShift: 0,
      changedTrainruns: 0,
      changedTimes: 0,
      ...kpi,
    },
    edges: [],
    changes: [],
    assignment: {},
  };
}

describe("compareSolutions", () => {
  it("ranks valid solutions before solutions invalidated by hard rules", () => {
    const policy = createDefaultOptimizationPolicy();
    const valid = {...solution(1, {changedChains: 9}), valid: true};
    const invalid = {...solution(2, {changedChains: 0}), valid: false};

    expect(compareSolutions(valid, invalid, policy)).toBeLessThan(0);
  });

  it("weights normalized objectives geometrically by their position", () => {
    const policy = createDefaultOptimizationPolicy();
    const topObjectiveWins = solution(1, {
      objectiveScores: {minimalChanges: 1, moreConnections: 0},
    });
    const secondObjectiveWins = solution(2, {
      objectiveScores: {minimalChanges: 0, moreConnections: 1},
    });

    expect(compareSolutions(topObjectiveWins, secondObjectiveWins, policy)).toBeLessThan(0);
  });

  it("lets drag-and-drop reorder the geometric objective weights", () => {
    const policy = createDefaultOptimizationPolicy();
    policy.objectives.find((objective) => objective.id === "minimalChanges").priority = 1;
    policy.objectives.find((objective) => objective.id === "moreConnections").priority = 0;
    const topObjectiveWins = solution(1, {
      objectiveScores: {minimalChanges: 1, moreConnections: 0},
    });
    const reorderedTopObjectiveWins = solution(2, {
      objectiveScores: {minimalChanges: 0, moreConnections: 1},
    });

    expect(compareSolutions(reorderedTopObjectiveWins, topObjectiveWins, policy)).toBeLessThan(0);
  });

  it("ignores disabled objectives and uses a stable id tie-break", () => {
    const policy = createDefaultOptimizationPolicy();
    policy.objectives.forEach((objective) => (objective.enabled = false));
    const first = solution(1, {changedChains: 9});
    const second = solution(2, {changedChains: 0});

    expect(compareSolutions(first, second, policy)).toBeLessThan(0);
  });
});
