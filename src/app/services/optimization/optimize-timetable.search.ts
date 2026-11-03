import {OptimizationProblem} from "./optimize-timetable.chains";
import {ScoreParts, TimetableEvaluator} from "./optimize-timetable.evaluator";
import {ConflictIndex} from "./optimization-conflict-index";
import {SRC_ARR, SRC_DEP, TGT_ARR, TGT_DEP} from "./optimize-timetable.model";
import {getObjectiveWeights, ObjectiveId} from "./optimization-policy.model";

export interface ArchivedSolution {
  delta: Int32Array;
  score: number;
  parts: ScoreParts;
}

export interface SearchResult {
  archive: ArchivedSolution[];
  initial: ArchivedSolution;
  bestAssignment: Record<string, number>;
  iterations: number;
  evaluatedCandidates: number;
  trace: SearchTraceEntry[];
  omittedTraceEntries: number;
  continueFor?: (
    additionalBudgetMs: number,
    onProgress?: (progress: SearchProgress) => void,
  ) => Promise<SearchResult>;
}

export interface SearchProgress {
  fraction: number;
  elapsedMs: number;
  iterations: number;
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

export interface ConflictStepCandidate {
  distance: number;
  values: number[];
}

interface TrainrunShiftGroup {
  trainrunId: number;
  variables: number[];
  headway: number;
}

interface CandidateMove {
  variables: number[];
  values: number[];
  score: number;
  hard: number;
  severity: number;
  traceLabel?: string;
}

const ARCHIVE_SIZE = 40;
const TABU_TENURE = 7;
const MAX_TRACE_ENTRIES = 150;
const MAX_CONFLICT_STEP_DISTANCE = 5;
const PRIORITY_STAGING_FRACTION = 0.5;
const LNS_STAGNATION_ITERATIONS = 50;

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

export function getActivePriorityRank(progress: number, groupCount: number): number {
  if (groupCount <= 0) {
    return -1;
  }
  const clampedProgress = Math.max(0, Math.min(1, progress));
  return Math.min(
    groupCount - 1,
    Math.floor((clampedProgress * (groupCount - 1)) / PRIORITY_STAGING_FRACTION),
  );
}

function chooseRandomSubset(candidates: number[], count: number, random: () => number): number[] {
  const shuffled = [...candidates];
  const selectedCount = Math.min(shuffled.length, count);
  for (let i = 0; i < selectedCount; i++) {
    const swapIndex = i + Math.floor(random() * (shuffled.length - i));
    [shuffled[i], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[i]];
  }
  return shuffled.slice(0, selectedCount);
}

function objectiveEnabled(problem: OptimizationProblem, id: ObjectiveId): boolean {
  return getObjectiveWeights(problem.policy)[id] > 0;
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
  if (objectiveEnabled(problem, "connectionStability")) {
    comparisons.push([a.connectionWaitDeviation, b.connectionWaitDeviation]);
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

function assignmentFromDelta(
  problem: OptimizationProblem,
  delta: Int32Array,
): Record<string, number> {
  const assignment: Record<string, number> = {};
  problem.variables.forEach((variable, index) => {
    assignment[variable.key] = delta[index];
  });
  return assignment;
}

export function getLocalStepCandidates(
  current: number,
  domain: number,
  maxStepDistance = Number.POSITIVE_INFINITY,
): number[][] {
  const steps: number[][] = [];
  const maxStep = Math.min(
    Math.max(domain + current, domain - current),
    Math.max(0, Math.floor(maxStepDistance)),
  );
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

export function getConflictStepCandidates(
  current: number,
  domain: number,
  priorityProfile: OptimizationProblem["policy"]["directorProfile"] | undefined,
  priorityRank: number | undefined,
  sectionHeadway = 0,
): ConflictStepCandidate[] {
  const isLaterCategory =
    priorityProfile === "flexibilityCategoryFirst" &&
    priorityRank !== undefined &&
    priorityRank > 0;
  const candidates = getLocalStepCandidates(
    current,
    domain,
    isLaterCategory ? Number.POSITIVE_INFINITY : MAX_CONFLICT_STEP_DISTANCE,
  ).map((values, index) => ({distance: index + 1, values}));
  const headway = Math.round(sectionHeadway);
  if (headway > 1) {
    const headwayGroup = getLocalStepCandidates(current, domain, headway)[headway - 1];
    if (headwayGroup !== undefined) {
      const existingIndex = candidates.findIndex((candidate) => candidate.distance === headway);
      if (existingIndex >= 0) {
        candidates.splice(existingIndex, 1);
      }
      candidates.splice(1, 0, {distance: headway, values: headwayGroup});
    }
  }
  return candidates;
}

export function shouldAcceptExploratoryMove(
  currentHardConflicts: number,
  candidateHardConflicts: number,
  currentScore: number,
  candidateScore: number,
  temperature: number,
  randomValue: number,
): boolean {
  if (candidateHardConflicts > currentHardConflicts) {
    return false;
  }
  if (candidateScore <= currentScore) {
    return true;
  }
  return randomValue < Math.exp((currentScore - candidateScore) / Math.max(temperature, 1e-9));
}

function getTrainrunShiftGroups(problem: OptimizationProblem): TrainrunShiftGroup[] {
  const groups = new Map<number, {variables: Set<number>; headway: number}>();
  problem.variables.forEach((variable, variableIndex) => {
    if (variable.fixed || variable.domain <= 0 || variable.travelTimeTrainrunIndex !== undefined) {
      return;
    }
    variable.chains.forEach((chainIndex) => {
      const trainrun = problem.chains[chainIndex].trainrun;
      const trainrunId = trainrun.getId();
      const group = groups.get(trainrunId) ?? {variables: new Set<number>(), headway: 1};
      group.variables.add(variableIndex);
      group.headway = Math.max(
        group.headway,
        Math.max(1, Math.round(trainrun.getTrainrunCategory()?.sectionHeadway ?? 1)),
      );
      groups.set(trainrunId, group);
    });
  });
  return [...groups].map(([trainrunId, group]) => ({
    trainrunId,
    variables: [...group.variables],
    headway: group.headway,
  }));
}

function getVariableSectionHeadway(problem: OptimizationProblem, variableIndex: number): number {
  return Math.max(
    0,
    ...problem.variables[variableIndex].chains.map(
      (chainIndex) =>
        problem.chains[chainIndex].trainrun.getTrainrunCategory()?.sectionHeadway ?? 0,
    ),
  );
}

export function orderConflictVariables(affectedVariables: number[], startIndex = 0): number[] {
  const variables = [...new Set(affectedVariables)];
  if (variables.length === 0) {
    return variables;
  }
  const offset = ((startIndex % variables.length) + variables.length) % variables.length;
  return [...variables.slice(offset), ...variables.slice(0, offset)];
}

function getFrequencyRanks(
  problem: OptimizationProblem,
  variableIndices: number[],
): {rankByVariable: Int32Array; variablesByRank: number[][]; groupCount: number} {
  const frequencyByTrainrunId = new Map<number, number>();
  problem.sections.forEach((section) => {
    const trainrun = section.getTrainrun();
    const frequency = trainrun.getFrequency();
    frequencyByTrainrunId.set(trainrun.getId(), frequency > 0 ? frequency : 60);
  });

  const priorityByVariable = new Map<number, number>();
  variableIndices.forEach((variableIndex) => {
    const variable = problem.variables[variableIndex];
    const frequencies = variable.chains.map((chainIndex) => {
      const frequency = problem.chains[chainIndex].trainrun.getFrequency();
      return frequency > 0 ? frequency : 60;
    });
    if (variable.travelTimeTrainrunIndex !== undefined) {
      const trainrunId = problem.trainrunIds[variable.travelTimeTrainrunIndex];
      frequencies.push(frequencyByTrainrunId.get(trainrunId) ?? 60);
    }
    priorityByVariable.set(variableIndex, frequencies.length === 0 ? 60 : Math.min(...frequencies));
  });

  return getRanksByPriority(problem.variables.length, priorityByVariable);
}

export function getCategoryOrderRanks(
  problem: Pick<OptimizationProblem, "sections" | "variables" | "chains" | "trainrunIds">,
  variableIndices: number[],
): {rankByVariable: Int32Array; variablesByRank: number[][]; groupCount: number} {
  const categoryOrderByTrainrunId = new Map<number, number>();
  problem.sections.forEach((section) => {
    const trainrun = section.getTrainrun();
    categoryOrderByTrainrunId.set(trainrun.getId(), trainrun.getCategoryOrder());
  });

  const priorityByVariable = new Map<number, number>();
  variableIndices.forEach((variableIndex) => {
    const variable = problem.variables[variableIndex];
    const categoryOrders = variable.chains.map((chainIndex) =>
      problem.chains[chainIndex].trainrun.getCategoryOrder(),
    );
    if (variable.travelTimeTrainrunIndex !== undefined) {
      const trainrunId = problem.trainrunIds[variable.travelTimeTrainrunIndex];
      categoryOrders.push(categoryOrderByTrainrunId.get(trainrunId) ?? Number.MAX_SAFE_INTEGER);
    }
    priorityByVariable.set(
      variableIndex,
      categoryOrders.length === 0 ? Number.MAX_SAFE_INTEGER : Math.min(...categoryOrders),
    );
  });

  return getRanksByPriority(problem.variables.length, priorityByVariable);
}

function getRanksByPriority(
  variableCount: number,
  priorityByVariable: Map<number, number>,
): {rankByVariable: Int32Array; variablesByRank: number[][]; groupCount: number} {
  const orderedPriorities = [...new Set(priorityByVariable.values())].sort(
    (first, second) => first - second,
  );
  const rankByPriority = new Map(orderedPriorities.map((priority, index) => [priority, index]));
  const rankByVariable = new Int32Array(variableCount);
  const variablesByRank = orderedPriorities.map(() => [] as number[]);
  priorityByVariable.forEach((priority, variableIndex) => {
    const rank = rankByPriority.get(priority) ?? 0;
    rankByVariable[variableIndex] = rank;
    variablesByRank[rank].push(variableIndex);
  });
  return {rankByVariable, variablesByRank, groupCount: orderedPriorities.length};
}

function orderVariablesByPriority(
  variables: number[],
  rankByVariable: Int32Array,
  startIndex: number,
): number[] {
  const groups = new Map<number, number[]>();
  variables.forEach((variableIndex) => {
    const rank = rankByVariable[variableIndex];
    const group = groups.get(rank) ?? [];
    group.push(variableIndex);
    groups.set(rank, group);
  });
  return [...groups.keys()]
    .sort((first, second) => first - second)
    .flatMap((rank) => orderConflictVariables(groups.get(rank) ?? [], startIndex));
}

function describeVariable(problem: OptimizationProblem, variableIndex: number): string {
  const variable = problem.variables[variableIndex];
  const chains = variable.chains.map((chainIndex) => {
    const chain = problem.chains[chainIndex];
    const trainrunName =
      `${chain.trainrun.getCategoryShortName()} ${chain.trainrun.getTitle()}`.trim();
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
        ? ([
            [step.toNode.getBetriebspunktName(), "Abfahrt", TGT_DEP],
            [step.fromNode.getBetriebspunktName(), "Ankunft", SRC_ARR],
          ] as const)
        : ([
            [step.toNode.getBetriebspunktName(), "Abfahrt", SRC_DEP],
            [step.fromNode.getBetriebspunktName(), "Ankunft", TGT_ARR],
          ] as const);
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
export async function runSearch(
  problem: OptimizationProblem,
  evaluator: TimetableEvaluator,
  startAssignment: Record<string, number> | undefined,
  timeBudgetMs: number,
  seed: number,
  traceEnabled = false,
  trackPriorities: number[] = [],
  onProgress?: (progress: SearchProgress) => void,
): Promise<SearchResult> {
  const random = createRandom(seed);
  const searchStartedAt = performance.now();
  let deadline = searchStartedAt + timeBudgetMs;
  let totalBudgetMs = timeBudgetMs;
  let activeProgress = onProgress;
  let segmentStartedAt = searchStartedAt;
  let segmentBudgetMs = timeBudgetMs;
  const freeVars = problem.variables
    .map((variable, v) => (!variable.fixed && variable.domain > 0 ? v : -1))
    .filter((v) => v >= 0);
  const priorityProfile =
    problem.policy.mode === "director" ? problem.policy.directorProfile : undefined;
  const priorityRanks =
    priorityProfile === "flexibilityFrequencyFirst"
      ? getFrequencyRanks(problem, freeVars)
      : priorityProfile === "flexibilityCategoryFirst"
        ? getCategoryOrderRanks(problem, freeVars)
        : undefined;

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
      archive.some((a) => dominates(a.parts, parts, problem) || sameDelta(a.delta, evaluator.delta))
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
      const alternatives = archive.filter(
        (candidate) => !sameDelta(initial.delta, candidate.delta),
      );
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
    onProgress?.({fraction: 1, elapsedMs: performance.now() - searchStartedAt, iterations: 0});
    return {
      archive,
      initial,
      bestAssignment: assignmentFromDelta(problem, initial.delta),
      iterations: 0,
      evaluatedCandidates: 0,
      trace,
      omittedTraceEntries,
    };
  }

  let best = new Int32Array(evaluator.delta);
  let bestScore = score;
  let bestParts = evaluator.parts();
  const tabuUntil = new Int32Array(problem.variables.length);
  let iteration = 0;
  let evaluatedCandidates = 0;
  let activePriorityRank = -1;
  const activeFreeVars = priorityRanks === undefined ? freeVars : [];
  const trainrunShiftGroups = getTrainrunShiftGroups(problem);
  let lastImprovement = 0;
  let lastLnsRestart = -LNS_STAGNATION_ITERATIONS;
  const startTime = performance.now();
  let nextProgressAt = startTime + 250;
  let nextYieldAt = startTime + 16;
  let polishReserveMs = Math.min(40, timeBudgetMs * 0.2);
  const yieldToBrowser = () => {
    if (performance.now() < nextYieldAt) {
      return undefined;
    }
    nextYieldAt = performance.now() + 16;
    return new Promise<void>((resolve) => setTimeout(resolve, 0));
  };

  const setBest = () => {
    const parts = evaluator.parts();
    const improvesFeasibility =
      parts.hard < bestParts.hard ||
      (parts.hard === bestParts.hard &&
        parts.hard > 0 &&
        parts.trackConflictCost < bestParts.trackConflictCost - 1e-9);
    const sameFeasibility =
      parts.hard === bestParts.hard &&
      (parts.hard === 0 || Math.abs(parts.trackConflictCost - bestParts.trackConflictCost) < 1e-9);
    if (improvesFeasibility || (sameFeasibility && score < bestScore - 1e-9)) {
      bestScore = score;
      bestParts = parts;
      best = new Int32Array(evaluator.delta);
      lastImprovement = iteration;
    }
  };

  const runForBudget = async () => {
    while (performance.now() < deadline) {
      const browserYield = yieldToBrowser();
      if (browserYield !== undefined) {
        await browserYield;
      }
      const now = performance.now();
      if (now >= nextProgressAt) {
        activeProgress?.({
          fraction: Math.min(
            0.99,
            Math.max(0, (now - segmentStartedAt) / Math.max(1, segmentBudgetMs)),
          ),
          elapsedMs: now - searchStartedAt,
          iterations: iteration,
        });
        nextProgressAt = now + 250;
      }
      if (hasFeasibleAlternative && performance.now() >= deadline - polishReserveMs) {
        break;
      }
      iteration++;
      if (priorityRanks !== undefined) {
        const progress = Math.min(1, (performance.now() - startTime) / Math.max(1, totalBudgetMs));
        const nextPriorityRank = getActivePriorityRank(progress, priorityRanks.groupCount);
        for (let rank = activePriorityRank + 1; rank <= nextPriorityRank; rank++) {
          activeFreeVars.push(...priorityRanks.variablesByRank[rank]);
        }
        activePriorityRank = Math.max(activePriorityRank, nextPriorityRank);
      }
      let changedVariables: number[] = [];
      let pendingTrace: PendingTrace | undefined;
      const conflict = conflictIndex.getHighestPriority();
      const activeConflictVariables =
        conflict === undefined || priorityRanks === undefined
          ? (conflict?.affectedVariables ?? [])
          : conflict.affectedVariables.filter(
              (variableIndex) => priorityRanks.rankByVariable[variableIndex] <= activePriorityRank,
            );
      if (conflict !== undefined && activeConflictVariables.length > 0 && random() < 0.85) {
        // --- Min-Conflicts + Tabu ----------------------------------------
        const selectedVariables =
          priorityRanks === undefined
            ? orderConflictVariables(activeConflictVariables, iteration - 1)
            : orderVariablesByPriority(
                activeConflictVariables,
                priorityRanks.rankByVariable,
                iteration - 1,
              );

        const currentParts = evaluator.parts();
        const currentSeverity = conflict.severity;
        const candidatesByVariable = selectedVariables.map((v) => ({
          v,
          groups: getConflictStepCandidates(
            evaluator.delta[v],
            problem.variables[v].domain,
            priorityProfile,
            priorityRanks?.rankByVariable[v],
            getVariableSectionHeadway(problem, v),
          ),
        }));
        const selectedVariableSet = new Set(selectedVariables);
        const activeTrainrunGroups = trainrunShiftGroups.filter(
          (group) =>
            group.variables.some((variableIndex) => selectedVariableSet.has(variableIndex)) &&
            (priorityRanks === undefined ||
              group.variables.every(
                (variableIndex) =>
                  priorityRanks.rankByVariable[variableIndex] <= activePriorityRank,
              )),
        );
        const maxStep = Math.max(0, ...candidatesByVariable.map(({groups}) => groups.length));
        const testedSteps: number[] = [];
        let bestMove: CandidateMove | undefined;
        let fallbackGroupMove: CandidateMove | undefined;
        let fallbackMove: {v: number; value: number; score: number} = undefined;
        const explorationProgress = Math.min(
          1,
          (performance.now() - startTime) / Math.max(1, totalBudgetMs),
        );
        const explorationTemperature = 5 * Math.pow(0.02, explorationProgress);
        const isBetterMove = (candidate: CandidateMove, current: CandidateMove | undefined) =>
          current === undefined ||
          candidate.hard < current.hard ||
          (candidate.hard === current.hard &&
            (candidate.severity < current.severity ||
              (candidate.severity === current.severity && candidate.score < current.score)));
        const evaluateTrainrunShift = async (
          group: TrainrunShiftGroup,
          shift: number,
        ): Promise<CandidateMove | undefined> => {
          const oldValues = group.variables.map((v) => evaluator.delta[v]);
          const values = oldValues.map((value) => value + shift);
          if (
            values.some(
              (value, index) =>
                value < -problem.variables[group.variables[index]].domain ||
                value > problem.variables[group.variables[index]].domain,
            )
          ) {
            return undefined;
          }
          group.variables.forEach((v, index) => evaluator.setVariable(v, values[index]));
          group.variables.forEach((v) => conflictIndex.updateVariable(v));
          evaluatedCandidates++;
          const candidateScore = evaluator.score();
          const candidateParts = evaluator.parts();
          const candidateSeverity = conflict.severity;
          const isTabu =
            group.variables.some((v) => tabuUntil[v] > iteration) && candidateScore >= bestScore;
          const improvesConflict =
            candidateParts.hard < currentParts.hard ||
            (candidateParts.hard === currentParts.hard && candidateSeverity < currentSeverity);
          let improvingCandidate: CandidateMove | undefined;
          if (!isTabu && improvesConflict) {
            improvingCandidate = {
              variables: group.variables,
              values,
              score: candidateScore,
              hard: candidateParts.hard,
              severity: candidateSeverity,
              traceLabel: `Zuglauf ${group.trainrunId} ±${shift}`,
            };
          } else if (
            !isTabu &&
            shouldAcceptExploratoryMove(
              currentParts.hard,
              candidateParts.hard,
              score,
              candidateScore,
              explorationTemperature,
              random(),
            )
          ) {
            const candidate: CandidateMove = {
              variables: group.variables,
              values,
              score: candidateScore,
              hard: candidateParts.hard,
              severity: candidateSeverity,
              traceLabel: `Zuglauf ${group.trainrunId} ±${shift} Erkundung`,
            };
            if (isBetterMove(candidate, fallbackGroupMove)) {
              fallbackGroupMove = candidate;
            }
          }
          for (let index = group.variables.length - 1; index >= 0; index--) {
            const v = group.variables[index];
            evaluator.setVariable(v, oldValues[index]);
            conflictIndex.updateVariable(v);
          }
          const browserYield = yieldToBrowser();
          if (browserYield !== undefined) {
            await browserYield;
          }
          return improvingCandidate;
        };

        for (let stepIndex = 0; stepIndex < maxStep && performance.now() < deadline; stepIndex++) {
          const testedDistanceSet = new Set<number>();
          let bestAtStep: CandidateMove | undefined;
          for (const {v, groups} of candidatesByVariable) {
            if (performance.now() >= deadline) {
              break;
            }
            const stepCandidate = groups[stepIndex];
            if (stepCandidate === undefined) {
              continue;
            }
            testedDistanceSet.add(stepCandidate.distance);
            const old = evaluator.delta[v];
            const values = stepCandidate.values;
            for (const value of values) {
              if (performance.now() >= deadline) {
                break;
              }
              const candidateScore = evaluator.setVariable(v, value);
              evaluatedCandidates++;
              conflictIndex.updateVariable(v);
              const candidateParts = evaluator.parts();
              const candidateSeverity = conflict.severity;
              const isTabu = tabuUntil[v] > iteration && candidateScore >= bestScore;
              if (!isTabu) {
                if (fallbackMove === undefined || candidateScore < fallbackMove.score) {
                  fallbackMove = {v, value, score: candidateScore};
                }

                const improvesConflict =
                  candidateParts.hard < currentParts.hard ||
                  (candidateParts.hard === currentParts.hard &&
                    candidateSeverity < currentSeverity);
                if (improvesConflict) {
                  const candidate: CandidateMove = {
                    variables: [v],
                    values: [value],
                    score: candidateScore,
                    hard: candidateParts.hard,
                    severity: candidateSeverity,
                  };
                  if (isBetterMove(candidate, bestAtStep)) {
                    bestAtStep = candidate;
                  }
                }
              }
              evaluator.setVariable(v, old);
              conflictIndex.updateVariable(v);
              const browserYield = yieldToBrowser();
              if (browserYield !== undefined) {
                await browserYield;
              }
            }
          }
          if (stepIndex <= 1) {
            for (const group of activeTrainrunGroups) {
              if (stepIndex === 1 && group.headway <= 1) {
                continue;
              }
              const distance = stepIndex === 0 ? 1 : group.headway;
              testedDistanceSet.add(distance);
              for (const shift of [-distance, distance]) {
                if (performance.now() >= deadline) {
                  break;
                }
                const candidate = await evaluateTrainrunShift(group, shift);
                if (candidate !== undefined && isBetterMove(candidate, bestAtStep)) {
                  bestAtStep = candidate;
                }
              }
            }
          }
          testedSteps.push(...testedDistanceSet);
          if (bestAtStep !== undefined) {
            bestMove = bestAtStep;
            break;
          }
        }

        const usedFallback = bestMove === undefined && fallbackMove !== undefined;
        const selectedMove: CandidateMove | undefined =
          bestMove ??
          fallbackGroupMove ??
          (fallbackMove === undefined
            ? undefined
            : {
                variables: [fallbackMove.v],
                values: [fallbackMove.value],
                score: fallbackMove.score,
                hard: currentParts.hard,
                severity: currentSeverity,
              });
        if (selectedMove !== undefined && selectedMove.score < 0.5 * Number.MAX_VALUE) {
          const before = traceEnabled
            ? captureTraceSnapshot(problem, evaluator, selectedMove.variables)
            : undefined;
          const oldValues = selectedMove.variables.map((v) => evaluator.delta[v]);
          selectedMove.variables.forEach((v, index) => {
            evaluator.setVariable(v, selectedMove.values[index]);
            tabuUntil[v] = iteration + TABU_TENURE;
          });
          score = evaluator.score();
          changedVariables = selectedMove.variables;
          if (before !== undefined) {
            pendingTrace = {
              phase: "Konfliktreparatur",
              conflict,
              variables: selectedMove.variables,
              oldValues,
              newValues: selectedMove.values,
              tested: `${testedSteps.map((step) => `±${step}`).join(", ")}${selectedMove.traceLabel ? ` (${selectedMove.traceLabel})` : usedFallback ? " (Fallback)" : ""}`,
              severityBefore: currentSeverity,
              before,
            };
          }
        }
      } else {
        // --- Simulated Annealing -----------------------------------------
        const progress = Math.min(1, (performance.now() - startTime) / Math.max(1, totalBudgetMs));
        const temperature = 5 * Math.pow(0.02, progress);
        const v = activeFreeVars[Math.floor(random() * activeFreeVars.length)];
        const domain = problem.variables[v].domain;
        const old = evaluator.delta[v];
        const maxStep = Math.min(
          domain + Math.abs(old),
          1 + Math.floor((iteration - lastImprovement) / 50),
        );
        const step = random() < 0.8 ? 1 : 1 + Math.floor(random() * maxStep);
        const value = Math.max(-domain, Math.min(domain, old + (random() < 0.5 ? -step : step)));
        if (value === old) {
          continue;
        }
        const before = traceEnabled ? captureTraceSnapshot(problem, evaluator, [v]) : undefined;
        const s = evaluator.setVariable(v, value);
        evaluatedCandidates++;
        const diff = s - score;
        if (diff <= 0 || random() < Math.exp(-diff / temperature)) {
          score = s;
          changedVariables = [v];
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

      changedVariables.forEach((variableIndex) => conflictIndex.updateVariable(variableIndex));
      if (pendingTrace !== undefined) {
        const after = captureTraceSnapshot(problem, evaluator, pendingTrace.variables);
        const next = conflictIndex.getHighestPriority();
        recordTrace({
          iteration,
          phase: pendingTrace.phase,
          conflict: pendingTrace.conflict
            ? describeConflict(problem, pendingTrace.conflict)
            : "Erkundung",
          candidate: pendingTrace.variables
            .map(
              (v, index) =>
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
      if (
        iteration - lastImprovement > LNS_STAGNATION_ITERATIONS &&
        iteration - lastLnsRestart > LNS_STAGNATION_ITERATIONS
      ) {
        lastLnsRestart = iteration;
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
            ? activeFreeVars
            : conflictIndex.buildCluster(anchor, Math.max(4, Math.ceil(freeVars.length * 0.2)));
        const activeNeighborhood =
          priorityRanks === undefined
            ? neighborhood
            : neighborhood.filter(
                (variableIndex) =>
                  priorityRanks.rankByVariable[variableIndex] <= activePriorityRank,
              );
        const variablesToDestroy =
          activeNeighborhood.length === 0 ? activeFreeVars : activeNeighborhood;
        const destroyCount = 3 + Math.floor(random() * 5);
        const destroyedVariables = chooseRandomSubset(variablesToDestroy, destroyCount, random);
        const before = traceEnabled
          ? captureTraceSnapshot(problem, evaluator, destroyedVariables)
          : undefined;
        const anchorSeverityBefore = anchor?.severity ?? 0;
        const oldValues = destroyedVariables.map((v) => evaluator.delta[v]);
        for (let n = 0; n < destroyedVariables.length; n++) {
          const v = destroyedVariables[n];
          const domain = problem.variables[v].domain;
          evaluator.setVariable(v, Math.round((random() * 2 - 1) * domain));
          conflictIndex.updateVariable(v);
          const browserYield = yieldToBrowser();
          if (browserYield !== undefined) {
            await browserYield;
          }
        }
        score = evaluator.score();
        if (before !== undefined) {
          const after = captureTraceSnapshot(problem, evaluator, destroyedVariables);
          recordTrace({
            iteration,
            phase: "LNS-Neustart",
            conflict: anchor ? describeConflict(problem, anchor) : "keine Konflikt-Verankerung",
            candidate: destroyedVariables
              .map(
                (v, index) =>
                  `${describeVariable(problem, v)} Δ ${oldValues[index]} -> ${evaluator.delta[v]}`,
              )
              .join("; "),
            tested: "konfliktnahes Teilnetz",
            hard: `${before.parts.hard} -> ${after.parts.hard}`,
            severity: anchor
              ? `${anchorSeverityBefore.toFixed(2)} -> ${anchor.severity.toFixed(2)}`
              : "n/a",
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
      const alternatives = archive.filter(
        (candidate) => !sameDelta(initial.delta, candidate.delta),
      );
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
          const browserYield = yieldToBrowser();
          if (browserYield !== undefined) {
            await browserYield;
          }
        }
      }
      score = evaluator.score();
      archiveCurrent();
    }

    // Restoring the best assignment and polishing can invalidate the conflict heap.
    conflictIndex.refreshAll();
    activeProgress?.({
      fraction: 1,
      elapsedMs: performance.now() - searchStartedAt,
      iterations: iteration,
    });
  };

  await runForBudget();
  const result: SearchResult = {
    archive,
    initial,
    bestAssignment: assignmentFromDelta(problem, best),
    iterations: iteration,
    evaluatedCandidates,
    trace,
    omittedTraceEntries,
    continueFor: async (additionalBudgetMs, nextProgress) => {
      if (!Number.isFinite(additionalBudgetMs) || additionalBudgetMs <= 0) {
        throw new RangeError("Additional search budget must be a positive finite number.");
      }
      segmentStartedAt = performance.now();
      deadline = segmentStartedAt + additionalBudgetMs;
      totalBudgetMs += additionalBudgetMs;
      segmentBudgetMs = additionalBudgetMs;
      polishReserveMs = Math.min(40, totalBudgetMs * 0.2);
      nextProgressAt = segmentStartedAt + 250;
      nextYieldAt = segmentStartedAt + 16;
      activeProgress = nextProgress;
      await runForBudget();
      result.iterations = iteration;
      result.evaluatedCandidates = evaluatedCandidates;
      result.bestAssignment = assignmentFromDelta(problem, best);
      return result;
    },
  };
  return result;
}
