import {OptimizeTimetableSolution} from "./optimize-timetable.model";
import {ObjectiveId, OptimizationPolicy} from "./optimization-policy.model";

function compareNumber(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function weightedObjectiveScore(
  solution: OptimizeTimetableSolution,
  objectives: {id: ObjectiveId}[],
): number {
  return objectives.reduce(
    (score, objective, index) =>
      score + (solution.kpi.objectiveScores?.[objective.id] ?? 0) / 2 ** index,
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
  const objectives = [...policy.objectives]
    .filter((objective) => objective.enabled)
    .sort((first, second) => first.priority - second.priority);
  const scoreA = weightedObjectiveScore(a, objectives);
  const scoreB = weightedObjectiveScore(b, objectives);
  const scoreComparison = compareNumber(scoreB, scoreA);
  if (scoreComparison !== 0) {
    return scoreComparison;
  }

  return compareNumber(a.id, b.id);
}
