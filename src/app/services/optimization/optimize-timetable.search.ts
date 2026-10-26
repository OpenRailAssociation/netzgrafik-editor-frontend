import {OptimizationProblem} from "./optimize-timetable.chains";
import {ScoreParts, TimetableEvaluator} from "./optimize-timetable.evaluator";
import {ConflictIndex} from "./optimization-conflict-index";

export interface ArchivedSolution {
  delta: Int32Array;
  score: number;
  parts: ScoreParts;
}

export interface SearchResult {
  archive: ArchivedSolution[];
  initial: ArchivedSolution;
  iterations: number;
}

const ARCHIVE_SIZE = 40;
const TABU_TENURE = 7;
const VALUES_PER_VARIABLE = 12;
const VARIABLES_PER_STEP = 2;

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

function dominates(a: ScoreParts, b: ScoreParts): boolean {
  const av = [a.excess, a.travelTimeDelta, -a.optionalConnections, a.sumAbsShift];
  const bv = [b.excess, b.travelTimeDelta, -b.optionalConnections, b.sumAbsShift];
  let strictly = false;
  for (let k = 0; k < av.length; k++) {
    if (av[k] > bv[k] + 1e-9) {
      return false;
    }
    if (av[k] < bv[k] - 1e-9) {
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

  const conflictIndex = new ConflictIndex(problem, evaluator);

  const archive: ArchivedSolution[] = [];
  const archiveCurrent = () => {
    const parts = evaluator.parts();
    if (parts.hard > 0) {
      return;
    }
    if (archive.some((a) => dominates(a.parts, parts) || sameDelta(a.delta, evaluator.delta))) {
      return;
    }
    for (let k = archive.length - 1; k >= 0; k--) {
      if (dominates(parts, archive[k].parts)) {
        archive.splice(k, 1);
      }
    }
    archive.push({delta: new Int32Array(evaluator.delta), score, parts});
    if (archive.length > ARCHIVE_SIZE) {
      archive.sort((a, b) => a.score - b.score);
      archive.length = ARCHIVE_SIZE;
    }
  };
  archiveCurrent();

  if (freeVars.length === 0) {
    return {archive, initial, iterations: 0};
  }

  let best = new Int32Array(evaluator.delta);
  let bestScore = score;
  const tabuUntil = new Int32Array(problem.variables.length);
  let iteration = 0;
  let lastImprovement = 0;
  const startTime = performance.now();

  const candidateValues = (v: number): number[] => {
    const domain = problem.variables[v].domain;
    const current = evaluator.delta[v];
    const values = new Set<number>([0, current - 1, current + 1]);
    if (2 * domain + 1 <= VALUES_PER_VARIABLE) {
      for (let x = -domain; x <= domain; x++) {
        values.add(x);
      }
    } else {
      while (values.size < VALUES_PER_VARIABLE) {
        values.add(Math.round((random() * 2 - 1) * domain));
      }
    }
    values.delete(current);
    return [...values].filter((x) => Math.abs(x) <= domain);
  };

  const setBest = () => {
    if (score < bestScore - 1e-9) {
      bestScore = score;
      best = new Int32Array(evaluator.delta);
      lastImprovement = iteration;
    }
  };

  while (performance.now() < deadline) {
    iteration++;
    let changedVariable = -1;
    const conflict = conflictIndex.getHighestPriority();
    if (conflict !== undefined && random() < 0.85) {
      // --- Min-Conflicts + Tabu ----------------------------------------
      const vars = conflict.affectedVariables;
      let bestMove: {v: number; value: number; score: number} = undefined;
      for (let n = 0; n < Math.min(VARIABLES_PER_STEP, vars.length); n++) {
        const v = vars[Math.floor(random() * vars.length)];
        const old = evaluator.delta[v];
        for (const value of candidateValues(v)) {
          const s = evaluator.setVariable(v, value);
          const isTabu = tabuUntil[v] > iteration && s >= bestScore;
          if (!isTabu && (bestMove === undefined || s < bestMove.score)) {
            bestMove = {v, value, score: s};
          }
        }
        evaluator.setVariable(v, old);
      }
      if (bestMove !== undefined && bestMove.score < 0.5 * Number.MAX_VALUE) {
        score = evaluator.setVariable(bestMove.v, bestMove.value);
        tabuUntil[bestMove.v] = iteration + TABU_TENURE;
        changedVariable = bestMove.v;
      }
    } else {
      // --- Simulated Annealing -----------------------------------------
      const progress = Math.min(1, (performance.now() - startTime) / Math.max(1, timeBudgetMs));
      const temperature = 5 * Math.pow(0.02, progress);
      const v = freeVars[Math.floor(random() * freeVars.length)];
      const domain = problem.variables[v].domain;
      const old = evaluator.delta[v];
      const value =
        random() < 0.5
          ? Math.max(-domain, Math.min(domain, old + (random() < 0.5 ? -1 : 1)))
          : random() < 0.3
            ? 0
            : Math.round((random() * 2 - 1) * domain);
      if (value === old) {
        continue;
      }
      const s = evaluator.setVariable(v, value);
      const diff = s - score;
      if (diff <= 0 || random() < Math.exp(-diff / temperature)) {
        score = s;
        changedVariable = v;
      } else {
        evaluator.setVariable(v, old);
      }
    }

    if (changedVariable >= 0) {
      conflictIndex.updateVariable(changedVariable);
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
      if (anchor === undefined && problem.edges.length > 0) {
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
      for (let n = 0; n < destroy; n++) {
        const v = variablesToDestroy[n];
        const domain = problem.variables[v].domain;
        evaluator.setVariable(v, Math.round((random() * 2 - 1) * domain));
        conflictIndex.updateVariable(v);
      }
      score = evaluator.score();
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

  return {archive, initial, iterations: iteration};
}
