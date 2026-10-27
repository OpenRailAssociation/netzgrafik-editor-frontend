import {OptimizationProblem} from "./optimize-timetable.chains";
import {ScoreParts, TimetableEvaluator} from "./optimize-timetable.evaluator";
import {ConflictIndex} from "./optimization-conflict-index";
import {SRC_ARR, SRC_DEP, TGT_ARR, TGT_DEP} from "./optimize-timetable.model";
import {ObjectiveId} from "./optimization-policy.model";

export interface ArchivedSolution {
  delta: Int32Array;
  score: number;
  parts: ScoreParts;
}

export interface SearchResult {
  archive: ArchivedSolution[];
  initial: ArchivedSolution;
  iterations: number;
  trace: SearchTraceEntry[];
  omittedTraceEntries: number;
}

export interface SearchTraceEntry {
  iteration: number;
  phase: string;
  conflict: string;
  candidate: string;
  tested: string;
  hard: string;
  severity: string;
  nextPriority: string;
  effects: string;
}

const ARCHIVE_SIZE = 40;
const TABU_TENURE = 7;
const MAX_TRACE_ENTRIES = 150;

interface TraceSnapshot {
  parts: ScoreParts;
  tracks: Map<string, number>;
  stops: Map<string, number>;
  connections: Map<string, number>;
  times: Map<string, number>;
}

interface PendingTrace {
  phase: string;
  conflict?: ReturnType<ConflictIndex["getHighestPriority"]>;
  variables: number[];
  oldValues: number[];
  newValues: number[];
  tested: string;
  severityBefore: number;
  before: TraceSnapshot;
}

/** Small deterministic PRNG (mulberry32). */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function objectiveEnabled(problem: OptimizationProblem, id: ObjectiveId): boolean {
  return problem.policy.objectives.find((objective) => objective.id === id)?.enabled ?? false;
}

function dominates(a: ScoreParts, b: ScoreParts, problem: OptimizationProblem): boolean {
  const comparisons: [number, number][] = [];
  if (objectiveEnabled(problem, "lowerEdgeTrackUsage")) {
    comparisons.push([a.edgeTrackCost, b.edgeTrackCost]);
  }
  if (objectiveEnabled(problem, "lowerTrackUsage")) {
    comparisons.push([a.nodeTrackCost, b.nodeTrackCost]);
  }
  if (objectiveEnabled(problem, "lowerTravelTime")) {
    comparisons.push([a.travelTimeDelta, b.travelTimeDelta]);
  }
  if (objectiveEnabled(problem, "moreConnections")) {
    comparisons.push([-a.optionalConnections, -b.optionalConnections]);
  }
  if (objectiveEnabled(problem, "minimalChanges")) {
    comparisons.push([a.sumAbsShift, b.sumAbsShift]);
  }
  let strictly = false;
  for (const [first, second] of comparisons) {
    if (first > second + 1e-9) {
      return false;
    }
    if (first < second - 1e-9) {
      strictly = true;
    }
  }
  return strictly;
}

function sameDelta(a: Int32Array, b: Int32Array): boolean {
  for (let k = 0; k < a.length; k++) {
    if (a[k] !== b[k]) {
      return false;
    }
  }
  return true;
}

export function getLocalStepCandidates(current: number, domain: number): number[][] {
  const steps: number[][] = [];
  const maxStep = Math.max(domain + current, domain - current);
  for (let step = 1; step <= maxStep; step++) {
    const candidates: number[] = [];
    if (current - step >= -domain) {
      candidates.push(current - step);
    }
    if (current + step <= domain) {
      candidates.push(current + step);
    }
    if (candidates.length > 0) {
      steps.push(candidates);
    }
  }
  return steps;
}

export function orderConflictVariables(affectedVariables: number[], startIndex = 0): number[] {
  const variables = [...new Set(affectedVariables)];
  if (variables.length === 0) {
    return variables;
  }
  const offset = ((startIndex % variables.length) + variables.length) % variables.length;
  return [...variables.slice(offset), ...variables.slice(0, offset)];
}

function describeVariable(problem: OptimizationProblem, variableIndex: number): string {
  const variable = problem.variables[variableIndex];
  const chains = variable.chains.map((chainIndex) => {
    const chain = problem.chains[chainIndex];
    const trainrunName = `${chain.trainrun.getCategoryShortName()} ${chain.trainrun.getTitle()}`.trim();
    const path = [
      chain.steps[0]?.fromNode.getBetriebspunktName(),
      ...chain.steps.map((step) => step.toNode.getBetriebspunktName()),
    ].filter(Boolean);
    return `Zug ${trainrunName} (#${chain.trainrun.getId()}) ${path.join(" -> ")}`;
  });
  return chains.length > 0 ? chains.join("; ") : variable.key;
}

function describeConflict(
  problem: OptimizationProblem,
  conflict: NonNullable<PendingTrace["conflict"]>,
): string {
  if (conflict.type === "TRACK_OVERLOAD") {
    const edge = problem.edges[conflict.componentIndex];
    return `Gleis ${edge.fromNode.getBetriebspunktName()} -> ${edge.toNode.getBetriebspunktName()}`;
  }
  if (conflict.type === "USER_CONNECTION") {
    return `Anschluss ${problem.connections[conflict.componentIndex].node.getBetriebspunktName()}`;
  }
  if (conflict.type === "MINIMUM_STOP_TIME") {
    return `Haltezeit ${problem.stops[conflict.componentIndex].node.getBetriebspunktName()}`;
  }
  return `Fahrzeit Zug ${problem.trainrunIds[conflict.componentIndex]}`;
}

function describeNodeSide(
  problem: OptimizationProblem,
  variableIndices: number[],
  nodeId: number,
): string {
  let isLeft = false;
  let isRight = false;
  variableIndices.forEach((v) =>
    problem.variables[v].chains.forEach((chainIndex) => {
      const steps = problem.chains[chainIndex].steps;
      if (steps[0]?.fromNode.getId() === nodeId) {
        isLeft = true;
      }
      if (steps[steps.length - 1]?.toNode.getId() === nodeId) {
        isRight = true;
      }
    }),
  );
  if (isLeft && isRight) {
    return "links/rechts";
  }
  return isLeft ? "links" : isRight ? "rechts" : "Kette";
}

function captureTraceSnapshot(
  problem: OptimizationProblem,
  evaluator: TimetableEvaluator,
  variableIndices: number[],
): TraceSnapshot {
  const edges = new Set<number>();
  const stops = new Set<number>();
  const connections = new Set<number>();
  const chains = new Set<number>();
  variableIndices.forEach((v) => {
    problem.varEdges[v].forEach((index) => edges.add(index));
    problem.varStops[v].forEach((index) => stops.add(index));
    problem.varConnections[v].forEach((index) => connections.add(index));
    problem.variables[v].chains.forEach((index) => chains.add(index));
  });

  const trackValues = new Map<string, number>();
  edges.forEach((index) => {
    const edge = problem.edges[index];
    trackValues.set(
      `${edge.fromNode.getBetriebspunktName()} (#${edge.fromNode.getId()}) -> ${edge.toNode.getBetriebspunktName()} (#${edge.toNode.getId()})`,
      evaluator.getEdgeTracks(index),
    );
  });

  const stopValues = new Map<string, number>();
  stops.forEach((index) => {
    const stop = problem.stops[index];
    stopValues.set(
      `${describeNodeSide(problem, variableIndices, stop.node.getId())} Haltezeit Zug ${problem.trainrunIds[stop.trainrunIndex]} ${stop.node.getBetriebspunktName()} (#${stop.node.getId()}) Abschnitt ${stop.arrSection}->${stop.depSection}`,
      evaluator.getStopDwell(index),
    );
  });

  const connectionValues = new Map<string, number>();
  connections.forEach((index) => {
    const connection = problem.connections[index];
    connectionValues.set(
      `${describeNodeSide(problem, variableIndices, connection.node.getId())} Anschluss Zug ${problem.sections[connection.arrSection].getTrainrun().getId()} -> Zug ${problem.sections[connection.depSection].getTrainrun().getId()} ${connection.node.getBetriebspunktName()} (#${connection.node.getId()}) Verbindung ${index}`,
      evaluator.getConnectionWait(index),
    );
  });

  const timeValues = new Map<string, number>();
  const timeFields = [
    {label: "Abfahrt", at: "source" as const, field: SRC_DEP},
    {label: "Ankunft", at: "source" as const, field: SRC_ARR},
    {label: "Abfahrt", at: "target" as const, field: TGT_DEP},
    {label: "Ankunft", at: "target" as const, field: TGT_ARR},
  ];
  chains.forEach((chainIndex) => {
    const chain = problem.chains[chainIndex];
    chain.steps.forEach((step) => {
      const section = problem.sections[step.sectionIdx];
      const trainrunId = chain.trainrun.getId();
      timeFields.forEach(({label, at, field}) => {
        const node = at === "source" ? section.getSourceNode() : section.getTargetNode();
        timeValues.set(
          `Zug ${trainrunId} Abschnitt ${section.getId()} ${node.getBetriebspunktName()} ${label}`,
          evaluator.candT[step.sectionIdx * 4 + field],
        );
      });
      const reverseFields = step.aligned
        ? [
            [step.toNode.getBetriebspunktName(), "Abfahrt", TGT_DEP],
            [step.fromNode.getBetriebspunktName(), "Ankunft", SRC_ARR],
          ] as const
        : [
            [step.toNode.getBetriebspunktName(), "Abfahrt", SRC_DEP],
            [step.fromNode.getBetriebspunktName(), "Ankunft", TGT_ARR],
          ] as const;
      reverseFields.forEach(([nodeName, label, field]) => {
        timeValues.set(
          `Zug ${trainrunId} Abschnitt ${section.getId()} Gegenrichtung ${nodeName} ${label}`,
          evaluator.candT[step.sectionIdx * 4 + field],
        );
      });
    });
  });

  return {
    parts: evaluator.parts(),
    tracks: trackValues,
    stops: stopValues,
    connections: connectionValues,
    times: timeValues,
  };
}

function describeChangedValues(before: Map<string, number>, after: Map<string, number>): string {
  const changes: string[] = [];
  before.forEach((oldValue, key) => {
    const newValue = after.get(key);
    if (newValue !== undefined && Math.abs(newValue - oldValue) > 1e-6) {
      changes.push(`${key}: ${oldValue.toFixed(2)} -> ${newValue.toFixed(2)}`);
    }
  });
  return changes.join("; ") || "unverändert";
}

function describeEffects(before: TraceSnapshot, after: TraceSnapshot): string {
  return [
    `Gleise (Surrogat) [${describeChangedValues(before.tracks, after.tracks)}]`,
    `Halte links/rechts [${describeChangedValues(before.stops, after.stops)}]`,
    `Anschlüsse [${describeChangedValues(before.connections, after.connections)}]`,
    `Zeiten [${describeChangedValues(before.times, after.times)}]`,
  ].join(" | ");
}

/**
 * Hybrid search (see UMSETZUNGSVORSCHLAG.md, Anhang A):
 * 1. Min-Conflicts + Tabu on edges violating the track limit,
 * 2. Simulated Annealing on the soft objectives,
 * 3. LNS restarts from the best solution when stagnating,
 * all solutions without hard violations go into a Pareto archive.
 */
export function runSearch(
  problem: OptimizationProblem,
  evaluator: TimetableEvaluator,
  startAssignment: Record<string, number> | undefined,
  timeBudgetMs: number,
  seed: number,
  traceEnabled = false,
  trackPriorities: number[] = [],
): SearchResult {
  const random = createRandom(seed);
  const deadline = performance.now() + timeBudgetMs;
  const freeVars = problem.variables
    .map((variable, v) => (!variable.fixed && variable.domain > 0 ? v : -1))
    .filter((v) => v >= 0);

  let score = evaluator.evaluateAll();
  const initial: ArchivedSolution = {
    delta: new Int32Array(evaluator.delta),
    score,
    parts: evaluator.parts(),
  };

  if (startAssignment) {
    freeVars.forEach((v) => {
      const value = startAssignment[problem.variables[v].key];
      if (typeof value === "number" && Math.abs(value) <= problem.variables[v].domain) {
        evaluator.setVariable(v, value);
      }
    });
    score = evaluator.evaluateAll();
  }

  const conflictIndex = new ConflictIndex(problem, evaluator, trackPriorities);

  const archive: ArchivedSolution[] = [];
  const trace: SearchTraceEntry[] = [];
  let omittedTraceEntries = 0;
  const recordTrace = (entry: SearchTraceEntry) => {
    if (!traceEnabled) {
      return;
    }
    if (trace.length < MAX_TRACE_ENTRIES) {
      trace.push(entry);
    } else {
      omittedTraceEntries++;
    }
  };
  let hasFeasibleAlternative = false;
  const archiveCurrent = () => {
    const parts = evaluator.parts();
    if (parts.hard > 0) {
      return;
    }
    if (
      archive.some(
        (a) => dominates(a.parts, parts, problem) || sameDelta(a.delta, evaluator.delta),
      )
    ) {
      return;
    }
    for (let k = archive.length - 1; k >= 0; k--) {
      if (dominates(parts, archive[k].parts, problem)) {
        archive.splice(k, 1);
      }
    }
    archive.push({delta: new Int32Array(evaluator.delta), score, parts});
    if (!sameDelta(initial.delta, evaluator.delta)) {
      hasFeasibleAlternative = true;
    }
    if (archive.length > ARCHIVE_SIZE) {
      const alternatives = archive.filter((candidate) => !sameDelta(initial.delta, candidate.delta));
      const smallestShift = objectiveEnabled(problem, "minimalChanges")
        ? (alternatives.length > 0 ? alternatives : archive).reduce((best, item) =>
            item.parts.sumAbsShift < best.parts.sumAbsShift ? item : best,
          )
        : undefined;
      archive.sort((a, b) => a.score - b.score);
      const retained = archive.slice(0, ARCHIVE_SIZE);
      if (smallestShift !== undefined && !retained.includes(smallestShift)) {
        retained[ARCHIVE_SIZE - 1] = smallestShift;
      }
      archive.splice(0, archive.length, ...retained);
    }
  };
  archiveCurrent();

  if (freeVars.length === 0) {
    return {archive, initial, iterations: 0, trace, omittedTraceEntries};
  }

  let best = new Int32Array(evaluator.delta);
  let bestScore = score;
  const tabuUntil = new Int32Array(problem.variables.length);
  let iteration = 0;
  let lastImprovement = 0;
  const startTime = performance.now();
  const polishReserveMs = Math.min(40, timeBudgetMs * 0.2);

  const setBest = () => {
    if (score < bestScore - 1e-9) {
      bestScore = score;
      best = new Int32Array(evaluator.delta);
      lastImprovement = iteration;
    }
  };

  while (performance.now() < deadline) {
    if (hasFeasibleAlternative && performance.now() >= deadline - polishReserveMs) {
      break;
    }
    iteration++;
    let changedVariable = -1;
    let pendingTrace: PendingTrace | undefined;
    const conflict = conflictIndex.getHighestPriority();
    if (conflict !== undefined && random() < 0.85) {
      // --- Min-Conflicts + Tabu ----------------------------------------
      const vars = conflict.affectedVariables;
      const selectedVariables = orderConflictVariables(vars, iteration - 1);

      const currentParts = evaluator.parts();
      const currentSeverity = conflict.severity;
      const candidatesByVariable = selectedVariables.map((v) => ({
        v,
        groups: getLocalStepCandidates(evaluator.delta[v], problem.variables[v].domain),
      }));
      const maxStep = Math.max(0, ...candidatesByVariable.map(({groups}) => groups.length));
      const testedSteps: number[] = [];
      let bestMove: {v: number; value: number; score: number} = undefined;
      let fallbackMove: {v: number; value: number; score: number} = undefined;

      for (let stepIndex = 0; stepIndex < maxStep && performance.now() < deadline; stepIndex++) {
        testedSteps.push(stepIndex + 1);
        let bestAtStep: {
          v: number;
          value: number;
          score: number;
          hard: number;
          severity: number;
        } = undefined;
        for (const {v, groups} of candidatesByVariable) {
          if (performance.now() >= deadline) {
            break;
          }
          const old = evaluator.delta[v];
          const values = groups[stepIndex] ?? [];
          for (const value of values) {
            if (performance.now() >= deadline) {
              break;
            }
            const candidateScore = evaluator.setVariable(v, value);
            conflictIndex.updateVariable(v);
            const candidateParts = evaluator.parts();
            const candidateSeverity = conflict.severity;
            const isTabu =
              tabuUntil[v] > iteration &&
              candidateScore >= bestScore &&
              candidateSeverity >= currentSeverity;
            if (!isTabu) {
              if (fallbackMove === undefined || candidateScore < fallbackMove.score) {
                fallbackMove = {v, value, score: candidateScore};
              }

              const improvesConflict =
                candidateParts.hard < currentParts.hard ||
                (candidateParts.hard === currentParts.hard &&
                  candidateSeverity < currentSeverity);
              if (improvesConflict) {
                const isBetterAtStep =
                  bestAtStep === undefined ||
                  candidateParts.hard < bestAtStep.hard ||
                  (candidateParts.hard === bestAtStep.hard &&
                    (candidateSeverity < bestAtStep.severity ||
                      (candidateSeverity === bestAtStep.severity &&
                        candidateScore < bestAtStep.score)));
                if (isBetterAtStep) {
                  bestAtStep = {
                    v,
                    value,
                    score: candidateScore,
                    hard: candidateParts.hard,
                    severity: candidateSeverity,
                  };
                }
              }
            }
            evaluator.setVariable(v, old);
            conflictIndex.updateVariable(v);
          }
        }
        if (bestAtStep !== undefined) {
          bestMove = bestAtStep;
          break;
        }
      }

      if (bestMove === undefined) {
        bestMove = fallbackMove;
      }
      if (bestMove !== undefined && bestMove.score < 0.5 * Number.MAX_VALUE) {
        const before = traceEnabled
          ? captureTraceSnapshot(problem, evaluator, [bestMove.v])
          : undefined;
        const oldValue = evaluator.delta[bestMove.v];
        score = evaluator.setVariable(bestMove.v, bestMove.value);
        tabuUntil[bestMove.v] = iteration + TABU_TENURE;
        changedVariable = bestMove.v;
        if (before !== undefined) {
          pendingTrace = {
            phase: "Konfliktreparatur",
            conflict,
            variables: [bestMove.v],
            oldValues: [oldValue],
            newValues: [bestMove.value],
            tested: `${testedSteps.map((step) => `±${step}`).join(", ")}${bestMove === fallbackMove ? " (Fallback)" : ""}`,
            severityBefore: currentSeverity,
            before,
          };
        }
      }
    } else {
      // --- Simulated Annealing -----------------------------------------
      const progress = Math.min(1, (performance.now() - startTime) / Math.max(1, timeBudgetMs));
      const temperature = 5 * Math.pow(0.02, progress);
      const v = freeVars[Math.floor(random() * freeVars.length)];
      const domain = problem.variables[v].domain;
      const old = evaluator.delta[v];
      const maxStep = Math.min(domain + Math.abs(old), 1 + Math.floor((iteration - lastImprovement) / 50));
      const step = random() < 0.8 ? 1 : 1 + Math.floor(random() * maxStep);
      const value = Math.max(
        -domain,
        Math.min(domain, old + (random() < 0.5 ? -step : step)),
      );
      if (value === old) {
        continue;
      }
      const before = traceEnabled ? captureTraceSnapshot(problem, evaluator, [v]) : undefined;
      const s = evaluator.setVariable(v, value);
      const diff = s - score;
      if (diff <= 0 || random() < Math.exp(-diff / temperature)) {
        score = s;
        changedVariable = v;
        if (before !== undefined) {
          pendingTrace = {
            phase: "Simulated Annealing",
            conflict,
            variables: [v],
            oldValues: [old],
            newValues: [value],
            tested: `±${step}`,
            severityBefore: conflict?.severity ?? 0,
            before,
          };
        }
      } else {
        evaluator.setVariable(v, old);
      }
    }

    if (changedVariable >= 0) {
      conflictIndex.updateVariable(changedVariable);
    }
    if (pendingTrace !== undefined) {
      const after = captureTraceSnapshot(problem, evaluator, pendingTrace.variables);
      const next = conflictIndex.getHighestPriority();
      recordTrace({
        iteration,
        phase: pendingTrace.phase,
        conflict: pendingTrace.conflict ? describeConflict(problem, pendingTrace.conflict) : "Erkundung",
        candidate: pendingTrace.variables
          .map((v, index) =>
            `${describeVariable(problem, v)} Δ ${pendingTrace.oldValues[index]} -> ${pendingTrace.newValues[index]}`,
          )
          .join("; "),
        tested: pendingTrace.tested,
        hard: `${pendingTrace.before.parts.hard} -> ${after.parts.hard}`,
        severity: pendingTrace.conflict
          ? `${pendingTrace.severityBefore.toFixed(2)} -> ${pendingTrace.conflict.severity.toFixed(2)}`
          : "n/a",
        nextPriority: next ? describeConflict(problem, next) : "kein aktiver Konflikt",
        effects: describeEffects(pendingTrace.before, after),
      });
    }

    setBest();
    archiveCurrent();

    // --- LNS restart from best with random perturbation -----------------
    if (iteration - lastImprovement > 300) {
      for (let v = 0; v < best.length; v++) {
        if (evaluator.delta[v] !== best[v]) {
          evaluator.setVariable(v, best[v]);
          conflictIndex.updateVariable(v);
        }
      }
      let anchor = conflictIndex.getHighestPriority();
      const trackObjectiveEnabled = objectiveEnabled(problem, "lowerEdgeTrackUsage");
      const trackLimitEnabled =
        problem.policy.hardConstraints.find((constraint) => constraint.id === "trackLimit")
          ?.enabled ?? false;
      if (
        anchor === undefined &&
        (trackObjectiveEnabled || trackLimitEnabled) &&
        problem.edges.length > 0
      ) {
        let mostUsedEdge = -1;
        for (let edge = 0; edge < problem.edges.length; edge++) {
          if (
            problem.edgeInScope[edge] === 1 &&
            (mostUsedEdge < 0 ||
              evaluator.getEdgeTracks(edge) > evaluator.getEdgeTracks(mostUsedEdge))
          ) {
            mostUsedEdge = edge;
          }
        }
        if (mostUsedEdge >= 0) {
          anchor = conflictIndex.getTrackConflict(mostUsedEdge);
        }
      }
      const neighborhood =
        anchor === undefined
          ? freeVars
          : conflictIndex.buildCluster(anchor, Math.max(4, Math.ceil(freeVars.length * 0.2)));
      const variablesToDestroy = neighborhood.length === 0 ? freeVars : neighborhood;
      const destroy = Math.min(variablesToDestroy.length, 2 + Math.floor(random() * 4));
      const destroyedVariables = variablesToDestroy.slice(0, destroy);
      const before = traceEnabled
        ? captureTraceSnapshot(problem, evaluator, destroyedVariables)
        : undefined;
      const anchorSeverityBefore = anchor?.severity ?? 0;
      const oldValues = destroyedVariables.map((v) => evaluator.delta[v]);
      for (let n = 0; n < destroy; n++) {
        const v = destroyedVariables[n];
        const domain = problem.variables[v].domain;
        evaluator.setVariable(v, Math.round((random() * 2 - 1) * domain));
        conflictIndex.updateVariable(v);
      }
      score = evaluator.score();
      if (before !== undefined) {
        const after = captureTraceSnapshot(problem, evaluator, destroyedVariables);
        recordTrace({
          iteration,
          phase: "LNS-Neustart",
          conflict: anchor ? describeConflict(problem, anchor) : "keine Konflikt-Verankerung",
          candidate: destroyedVariables
            .map((v, index) =>
              `${describeVariable(problem, v)} Δ ${oldValues[index]} -> ${evaluator.delta[v]}`,
            )
            .join("; "),
          tested: "konfliktnahes Teilnetz",
          hard: `${before.parts.hard} -> ${after.parts.hard}`,
          severity: anchor ? `${anchorSeverityBefore.toFixed(2)} -> ${anchor.severity.toFixed(2)}` : "n/a",
          nextPriority: conflictIndex.getHighestPriority()
            ? describeConflict(problem, conflictIndex.getHighestPriority())
            : "kein aktiver Konflikt",
          effects: describeEffects(before, after),
        });
      }
      lastImprovement = iteration;
    }
  }

  // make sure the best solution is part of the archive
  for (let v = 0; v < best.length; v++) {
    if (evaluator.delta[v] !== best[v]) {
      evaluator.setVariable(v, best[v]);
    }
  }
  score = evaluator.evaluateAll();
  archiveCurrent();

  if (
    hasFeasibleAlternative &&
    objectiveEnabled(problem, "minimalChanges") &&
    performance.now() < deadline
  ) {
    const alternatives = archive.filter((candidate) => !sameDelta(initial.delta, candidate.delta));
    const smallestShift = alternatives.reduce((best, item) =>
      item.parts.sumAbsShift < best.parts.sumAbsShift ? item : best,
    );
    for (let v = 0; v < smallestShift.delta.length; v++) {
      if (evaluator.delta[v] !== smallestShift.delta[v]) {
        score = evaluator.setVariable(v, smallestShift.delta[v]);
        conflictIndex.updateVariable(v);
      }
    }

    let improved = true;
    while (improved && performance.now() < deadline) {
      improved = false;
      for (const v of freeVars) {
        if (performance.now() >= deadline) {
          break;
        }
        const current = evaluator.delta[v];
        if (current === 0) {
          continue;
        }
        const before = traceEnabled ? captureTraceSnapshot(problem, evaluator, [v]) : undefined;
        const candidateScore = evaluator.setVariable(v, current - Math.sign(current));
        if (evaluator.parts().hard === 0) {
          score = candidateScore;
          conflictIndex.updateVariable(v);
          archiveCurrent();
          if (before !== undefined) {
            const after = captureTraceSnapshot(problem, evaluator, [v]);
            recordTrace({
              iteration,
              phase: "Feasibility-Politur",
              conflict: "Richtung Baseline",
              candidate: `${describeVariable(problem, v)} Δ ${current} -> ${evaluator.delta[v]}`,
              tested: "±1 Minute",
              hard: `${before.parts.hard} -> ${after.parts.hard}`,
              severity: "gültig",
              nextPriority: conflictIndex.getHighestPriority()
                ? describeConflict(problem, conflictIndex.getHighestPriority())
                : "kein aktiver Konflikt",
              effects: describeEffects(before, after),
            });
          }
          improved = true;
        } else {
          evaluator.setVariable(v, current);
        }
      }
    }
    score = evaluator.score();
    archiveCurrent();
  }

  return {archive, initial, iterations: iteration, trace, omittedTraceEntries};
}
