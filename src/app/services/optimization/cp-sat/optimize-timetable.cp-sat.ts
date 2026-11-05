import {OptimizationProblem} from "../optimize-timetable.chains";
import {HardConstraintId} from "../optimization-policy.model";
import {TimetableEvaluator, WEIGHT_HARD} from "../optimize-timetable.evaluator";
import {
  ArchivedSolution,
  runSearch,
  SearchProgress,
  SearchResult,
} from "../optimize-timetable.search";
import {CpSatConstraint, CpSatSolver} from "./cp-sat-solver";
import {retainCandidate} from "../optimization-candidate-archive";

function componentScopes(dependencies: number[][], count: number): number[][] {
  const scopes = Array.from({length: count}, (): number[] => []);
  dependencies.forEach((components, variable) =>
    components.forEach((component) => scopes[component].push(variable)),
  );
  return scopes;
}

export async function runCpSatSearch(
  problem: OptimizationProblem,
  evaluator: TimetableEvaluator,
  startAssignment: Record<string, number> | undefined,
  timeBudgetMs: number,
  onProgress?: (progress: SearchProgress) => void,
  isEdgeWithinLimit?: (edgeIndex: number, evaluator: TimetableEvaluator) => boolean,
): Promise<SearchResult> {
  if (!Number.isFinite(timeBudgetMs) || timeBudgetMs < 0) {
    throw new RangeError("The CP-SAT time budget must be finite and non-negative.");
  }
  const startedAt = performance.now();
  const initial: ArchivedSolution = {
    delta: new Int32Array(evaluator.delta),
    score: evaluator.evaluateAll(),
    parts: evaluator.parts(),
  };
  let best = initial;
  const archive: ArchivedSolution[] = [];
  let iterations = 0;
  let evaluatedCandidates = 0;
  let strictFinished = false;
  let relaxedFinished = false;
  let nextFeasibleReportAt = 0;
  let reportedFeasible = false;
  let activeProgress = onProgress;
  let segmentStart = startedAt;
  let segmentBudget = timeBudgetMs;
  const recordCandidate = (strictFeasible = false) => {
    const parts = evaluator.parts();
    const candidate: ArchivedSolution = {
      delta: new Int32Array(evaluator.delta),
      score: evaluator.score() - (strictFeasible ? WEIGHT_HARD * parts.hard : 0),
      parts: strictFeasible ? {...parts, hard: 0} : parts,
    };
    retainCandidate(archive, candidate, initial.delta);
    if (
      candidate.parts.hard < best.parts.hard ||
      (candidate.parts.hard === best.parts.hard && candidate.score < best.score)
    ) {
      best = candidate;
    }
    if (
      (!reportedFeasible && candidate.parts.hard === 0) ||
      performance.now() >= nextFeasibleReportAt
    ) {
      reportedFeasible ||= candidate.parts.hard === 0;
      nextFeasibleReportAt = performance.now() + 250;
      activeProgress?.({
        fraction: Math.min(0.99, (performance.now() - segmentStart) / Math.max(1, segmentBudget)),
        elapsedMs: performance.now() - startedAt,
        iterations,
        candidate,
      });
    }
  };
  let evaluated: Int32Array | undefined;
  const evaluate = (values: Int32Array) => {
    const changed = values.some((value, index) => value !== evaluator.delta[index]);
    if (changed) {
      values.forEach((value, index) => {
        if (value !== evaluator.delta[index]) {
          evaluator.setVariable(index, value);
        }
      });
    }
    if (evaluated === undefined || values.some((value, index) => value !== evaluated[index])) {
      evaluated = new Int32Array(values);
      evaluatedCandidates++;
      recordCandidate();
    }
  };
  const enabled = (id: HardConstraintId) =>
    problem.policy.hardConstraints.some((constraint) => constraint.id === id && constraint.enabled);
  const constraints: CpSatConstraint[] = [];
  const addConstraint = (variables: number[], accepts: () => boolean) => {
    constraints.push({
      variables,
      accepts: (values) => {
        variables.forEach((index) => {
          if (values[index] !== evaluator.delta[index]) {
            evaluator.setVariable(index, values[index]);
          }
        });
        return accepts();
      },
    });
  };
  if (enabled("trackLimit")) {
    problem.edges.forEach((_, index) => {
      if (problem.edgeInScope[index] === 1) {
        addConstraint(
          problem.edgeVars[index],
          () => isEdgeWithinLimit?.(index, evaluator) ?? !evaluator.isEdgeOverLimit(index),
        );
      }
    });
  }
  if (enabled("minimumStopTime")) {
    componentScopes(problem.varStops, problem.stops.length).forEach((variables, index) =>
      addConstraint(variables, () => !evaluator.isStopViolated(index)),
    );
  }
  if (enabled("userConnections")) {
    componentScopes(problem.varConnections, problem.connections.length).forEach(
      (variables, index) => addConstraint(variables, () => !evaluator.isConnectionViolated(index)),
    );
  }
  if (enabled("maxTravelTimeExtension")) {
    componentScopes(problem.varTrainruns, problem.trainrunIds.length).forEach((variables, index) =>
      addConstraint(variables, () => !evaluator.isTravelTimeExtensionViolated(index)),
    );
  }
  const allVariables = problem.variables.map((_, index) => index);
  addConstraint(allVariables, () => {
    const surrogateTrackViolations =
      isEdgeWithinLimit !== undefined && enabled("trackLimit")
        ? problem.edges.reduce(
            (count, _, index) =>
              count + Number(problem.edgeInScope[index] === 1 && evaluator.isEdgeOverLimit(index)),
            0,
          )
        : 0;
    return evaluator.parts().hard - surrogateTrackViolations === 0;
  });

  const variables = problem.variables.map((variable) => {
    const maximum = variable.fixed ? 0 : variable.domain;
    return {
      key: variable.key,
      lower: variable.travelTimeTrainrunIndex === undefined ? -maximum : 0,
      upper: maximum,
      hint: variable.fixed ? 0 : (startAssignment?.[variable.key] ?? 0),
    };
  });
  const objective = (values: Int32Array) => {
    evaluate(values);
    return evaluator.softScore();
  };
  let solver: CpSatSolver | undefined;
  let relaxedSolver: CpSatSolver | undefined;
  let strictIterations = 0;
  let relaxedIterations = 0;
  let warmStartIterations = 0;
  const hasImmutableTrackConflict =
    enabled("trackLimit") &&
    problem.edges.some(
      (_, index) =>
        problem.edgeInScope[index] === 1 &&
        problem.edgeVars[index].every(
          (variable) =>
            problem.variables[variable].fixed || problem.variables[variable].domain === 0,
        ) &&
        !(isEdgeWithinLimit?.(index, evaluator) ?? !evaluator.isEdgeOverLimit(index)),
    );
  let warmStartFinished =
    startAssignment !== undefined ||
    !enabled("trackLimit") ||
    hasImmutableTrackConflict ||
    !problem.variables.some((variable) => !variable.fixed && variable.domain > 0);
  let warmStartSearch: SearchResult | undefined;
  let warmStartElapsedMs = 0;
  let warmStartEvaluatedCandidates = 0;
  let cpSatStartAssignment = startAssignment;
  const result = (): SearchResult => ({
    archive,
    initial,
    bestAssignment: Object.fromEntries(
      problem.variables.map((variable, index) => [variable.key, best.delta[index]]),
    ),
    iterations,
    evaluatedCandidates,
    exhausted: strictFinished && relaxedFinished,
    trace: [],
    omittedTraceEntries: 0,
    continueFor: async (additionalBudgetMs, progress) => {
      if (!Number.isFinite(additionalBudgetMs) || additionalBudgetMs <= 0) {
        throw new RangeError("Additional search budget must be a positive finite number.");
      }
      await runForBudget(additionalBudgetMs, progress);
      return result();
    },
  });
  const runForBudget = async (budgetMs: number, progress?: (progress: SearchProgress) => void) => {
    segmentStart = performance.now();
    segmentBudget = budgetMs;
    activeProgress = progress;
    let remainingBudgetMs = budgetMs;
    if (!warmStartFinished) {
      // Seed the SAT model with a feasible assignment before spending the rest on SAT search.
      const maxWarmStartMs = Math.max(0, Math.min(9000 - warmStartElapsedMs, budgetMs * 0.9));
      const segmentWarmStartStartedAt = performance.now();
      let foundFeasibleWarmStart = false;
      while (maxWarmStartMs > 0 && performance.now() - segmentWarmStartStartedAt < maxWarmStartMs) {
        const sliceMs = Math.min(
          250,
          maxWarmStartMs - (performance.now() - segmentWarmStartStartedAt),
        );
        const reportWarmStart = (update: SearchProgress) =>
          progress?.({
            ...update,
            fraction: Math.min(0.99, (performance.now() - segmentStart) / Math.max(1, budgetMs)),
            elapsedMs: performance.now() - startedAt,
          });
        if (warmStartSearch === undefined) {
          warmStartSearch = await runSearch(
            problem,
            evaluator,
            undefined,
            sliceMs,
            1,
            false,
            [],
            reportWarmStart,
          );
        } else if (warmStartSearch.continueFor !== undefined) {
          problem.variables.forEach((variable, index) => {
            const value = warmStartSearch.bestAssignment[variable.key] ?? initial.delta[index];
            if (value !== evaluator.delta[index]) {
              evaluator.setVariable(index, value);
            }
          });
          evaluator.evaluateAll();
          warmStartSearch = await warmStartSearch.continueFor(sliceMs, reportWarmStart);
        } else {
          warmStartFinished = true;
          break;
        }
        warmStartIterations = warmStartSearch.iterations;
        iterations = warmStartIterations;
        evaluatedCandidates += warmStartSearch.evaluatedCandidates - warmStartEvaluatedCandidates;
        warmStartEvaluatedCandidates = warmStartSearch.evaluatedCandidates;
        cpSatStartAssignment = warmStartSearch.bestAssignment;
        let validWarmStart: ArchivedSolution | undefined;
        try {
          validWarmStart = warmStartSearch.archive.find((candidate) => {
            candidate.delta.forEach((value, index) => {
              if (value !== evaluator.delta[index]) {
                evaluator.setVariable(index, value);
              }
            });
            const surrogateTrackViolations = enabled("trackLimit")
              ? problem.edges.reduce(
                  (count, _, index) =>
                    count +
                    Number(problem.edgeInScope[index] === 1 && evaluator.isEdgeOverLimit(index)),
                  0,
                )
              : 0;
            if (evaluator.parts().hard - surrogateTrackViolations !== 0) {
              return false;
            }
            return problem.edges.every(
              (_, index) =>
                problem.edgeInScope[index] !== 1 ||
                (isEdgeWithinLimit?.(index, evaluator) ?? !evaluator.isEdgeOverLimit(index)),
            );
          });
          if (validWarmStart !== undefined) {
            validWarmStart.delta.forEach((value, index) => {
              if (value !== evaluator.delta[index]) {
                evaluator.setVariable(index, value);
              }
            });
            recordCandidate(true);
            cpSatStartAssignment = Object.fromEntries(
              problem.variables.map((variable, index) => [
                variable.key,
                validWarmStart.delta[index],
              ]),
            );
            foundFeasibleWarmStart = true;
            warmStartFinished = true;
            if (solver !== undefined) {
              const hintedVariables = variables.map((variable) => ({
                ...variable,
                hint: cpSatStartAssignment?.[variable.key] ?? variable.hint,
              }));
              solver = new CpSatSolver(hintedVariables, constraints, objective);
              relaxedSolver = new CpSatSolver(hintedVariables, [], objective);
              strictFinished = false;
              relaxedFinished = false;
              strictIterations = 0;
              relaxedIterations = 0;
            }
            break;
          }
        } finally {
          const restore = warmStartSearch.bestAssignment;
          problem.variables.forEach((variable, index) => {
            const value = restore[variable.key] ?? initial.delta[index];
            if (value !== evaluator.delta[index]) {
              evaluator.setVariable(index, value);
            }
          });
        }
        if (foundFeasibleWarmStart || warmStartSearch.exhausted) {
          warmStartFinished = true;
          break;
        }
      }
      warmStartElapsedMs += performance.now() - segmentWarmStartStartedAt;
      if (warmStartElapsedMs >= 9000 || maxWarmStartMs <= 0) {
        warmStartFinished = true;
      }
      initial.delta.forEach((value, index) => {
        if (value !== evaluator.delta[index]) {
          evaluator.setVariable(index, value);
        }
      });
      remainingBudgetMs = Math.max(0, budgetMs - (performance.now() - segmentStart));
    }
    const deadline = performance.now() + remainingBudgetMs;
    try {
      recordCandidate();
      const report = () =>
        progress?.({
          fraction: Math.min(0.99, (performance.now() - segmentStart) / Math.max(1, budgetMs)),
          elapsedMs: performance.now() - startedAt,
          iterations: warmStartIterations + iterations,
        });
      if (solver === undefined || relaxedSolver === undefined) {
        const hintedVariables = variables.map((variable) => ({
          ...variable,
          hint: cpSatStartAssignment?.[variable.key] ?? variable.hint,
        }));
        solver = new CpSatSolver(hintedVariables, constraints, objective);
        // Relax evaluative hard rules only; domains still enforce locks, scope and symmetry.
        relaxedSolver = new CpSatSolver(hintedVariables, [], objective);
      }
      if (!strictFinished) {
        const search = await solver.solveFor(
          Math.max(0, deadline - performance.now()),
          ({values}) => {
            evaluate(values);
            recordCandidate(true);
          },
          (statistics) => {
            strictIterations = statistics.decisions + statistics.conflicts;
            iterations = warmStartIterations + strictIterations + relaxedIterations;
            report();
          },
        );
        strictIterations = search.statistics.decisions + search.statistics.conflicts;
        strictFinished = search.status !== "time-limit";
      }
      if (strictFinished && !relaxedFinished && performance.now() < deadline) {
        const search = await relaxedSolver.solveFor(
          deadline - performance.now(),
          ({values}) => evaluate(values),
          (statistics) => {
            relaxedIterations = statistics.decisions + statistics.conflicts;
            iterations = warmStartIterations + strictIterations + relaxedIterations;
            report();
          },
        );
        relaxedIterations = search.statistics.decisions + search.statistics.conflicts;
        relaxedFinished = search.status !== "time-limit";
      }
      iterations = warmStartIterations + strictIterations + relaxedIterations;
      progress?.({fraction: 1, elapsedMs: performance.now() - startedAt, iterations});
    } finally {
      evaluator.delta.set(best.delta);
      evaluator.evaluateAll();
      evaluated = new Int32Array(best.delta);
    }
  };
  await runForBudget(timeBudgetMs, onProgress);
  return result();
}
