import {OptimizeTimetableSolution} from "./optimize-timetable.model";
import {getObjectiveWeights, ObjectiveId, OptimizationPolicy} from "./optimization-policy.model";

function compareNumber(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function weightedObjectiveScore(
  solution: Pick<OptimizeTimetableSolution, "kpi">,
  objectives: {id: ObjectiveId}[],
  weights: Record<ObjectiveId, number>,
): number {
  return objectives.reduce(
    (score, objective) =>
      score + (solution.kpi.objectiveScores?.[objective.id] ?? 0) * weights[objective.id],
    0,
  );
}

export function compareSolutions(
  a: OptimizeTimetableSolution,
  b: OptimizeTimetableSolution,
  policy: OptimizationPolicy,
): number {
  if (a.valid !== b.valid) {
    return a.valid ? -1 : 1;
  }
  const scoreComparison = compareNumber(solutionSoftCost(a, policy), solutionSoftCost(b, policy));
  if (scoreComparison !== 0) {
    return scoreComparison;
  }

  return compareNumber(a.id, b.id);
}

export function solutionSoftCost(
  solution: Pick<OptimizeTimetableSolution, "kpi">,
  policy: OptimizationPolicy,
): number {
  const weights = getObjectiveWeights(policy);
  const objectives = policy.objectives.filter((objective) => weights[objective.id] > 0);
  return -weightedObjectiveScore(solution, objectives, weights);
}
