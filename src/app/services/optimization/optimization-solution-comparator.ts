import {OptimizeTimetableSolution} from "./optimize-timetable.model";
import {ObjectiveId, OptimizationPolicy} from "./optimization-policy.model";

function compareNumber(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareObjective(
  id: ObjectiveId,
  a: OptimizeTimetableSolution,
  b: OptimizeTimetableSolution,
): number {
  switch (id) {
    case "minimalChanges":
      return (
        compareNumber(a.kpi.changedChains, b.kpi.changedChains) ||
        compareNumber(a.kpi.totalDeltaMinutes, b.kpi.totalDeltaMinutes)
      );
    case "moreConnections":
      return compareNumber(b.kpi.optionalConnections, a.kpi.optionalConnections);
    case "lowerTravelTime":
      return compareNumber(a.kpi.travelTimeExtensionMinutes, b.kpi.travelTimeExtensionMinutes);
    case "lowerTrackUsage":
      return (
        compareNumber(a.kpi.maxTrackUsage, b.kpi.maxTrackUsage) ||
        compareNumber(a.kpi.averageTrackUsage, b.kpi.averageTrackUsage)
      );
  }
  return 0;
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

  for (const objective of objectives) {
    const comparison = compareObjective(objective.id, a, b);
    if (comparison !== 0) {
      return comparison;
    }
  }

  return compareNumber(a.id, b.id);
}
