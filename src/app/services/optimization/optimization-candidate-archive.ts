import {WEIGHT_HARD, WEIGHT_TRACK} from "./optimize-timetable.evaluator";
import type {ArchivedSolution} from "./optimize-timetable.search";

const CANDIDATES_PER_FEASIBILITY_CLASS = 20;
const REPAIR_CANDIDATES = 5;

export function candidateSoftCost(candidate: ArchivedSolution): number {
  return (
    candidate.score -
    WEIGHT_HARD * candidate.parts.hard -
    WEIGHT_TRACK * candidate.parts.trackConflictCost
  );
}

/** Keeps both feasibility classes so infeasible candidates cannot crowd out feasible ones. */
export function retainCandidate(
  archive: ArchivedSolution[],
  candidate: ArchivedSolution,
  baseline: Int32Array,
): void {
  const same = (values: Int32Array) =>
    values.every((value, index) => value === candidate.delta[index]);
  if (same(baseline)) {
    return;
  }
  const existing = archive.findIndex((item) => same(item.delta));
  if (existing >= 0) {
    if (archive[existing].parts.hard <= candidate.parts.hard) {
      return;
    }
    archive.splice(existing, 1);
  }
  archive.push(candidate);
  archive.sort(
    (first, second) =>
      Number(first.parts.hard > 0) - Number(second.parts.hard > 0) ||
      candidateSoftCost(first) - candidateSoftCost(second),
  );
  const feasible = archive
    .filter((item) => item.parts.hard === 0)
    .slice(0, CANDIDATES_PER_FEASIBILITY_CLASS);
  const infeasible = archive.filter((item) => item.parts.hard > 0);
  // The track surrogate and exact final validation may disagree. Never discard every repair
  // just because cheaper, nearly unchanged candidates still violate more hard rules.
  const repairs = [...infeasible]
    .sort(
      (first, second) =>
        first.parts.hard - second.parts.hard ||
        first.parts.trackConflictCost - second.parts.trackConflictCost ||
        candidateSoftCost(first) - candidateSoftCost(second),
    )
    .slice(0, REPAIR_CANDIDATES);
  const retained = new Set([
    ...repairs,
    ...infeasible
      .filter((item) => !repairs.includes(item))
      .slice(0, CANDIDATES_PER_FEASIBILITY_CLASS - repairs.length),
  ]);
  archive.splice(
    0,
    archive.length,
    ...feasible,
    ...infeasible.filter((item) => retained.has(item)),
  );
}
