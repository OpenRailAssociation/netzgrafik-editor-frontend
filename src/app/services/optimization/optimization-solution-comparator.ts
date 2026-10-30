import {OptimizeTimetableSolution} from "./optimize-timetable.model";
import {getObjectiveWeights, ObjectiveId, OptimizationPolicy} from "./optimization-policy.model";

function compareNumber(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function weightedObjectiveScore(
  solution: OptimizeTimetableSolution,
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
  const weights = getObjectiveWeights(policy);
  const objectives = [...policy.objectives].filter((objective) => weights[objective.id] > 0);
  const scoreA = weightedObjectiveScore(a, objectives, weights);
  const scoreB = weightedObjectiveScore(b, objectives, weights);
  const scoreComparison = compareNumber(scoreB, scoreA);
  if (scoreComparison !== 0) {
    return scoreComparison;
  }

  return compareNumber(a.id, b.id);
}
