import {Injectable} from "@angular/core";
import {Direction} from "../../data-structures/business.data.structures";
import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {
  InfrastructureEstimatorService,
  NodeTrackEstimate,
  TrackSegmentEstimate,
} from "../infrastructure/infrastructure-estimator.service";
import {OptimizationProblem, buildProblem, mod60, norm60} from "./optimize-timetable.chains";
import {TimetableEvaluator} from "./optimize-timetable.evaluator";
import {runCpSatSearch} from "./cp-sat/optimize-timetable.cp-sat";
import {
  ArchivedSolution,
  runSearch,
  SearchProgress,
  SearchResult,
} from "./optimize-timetable.search";
import {
  EdgeTrackKpi,
  ImmutableTrackConflict,
  OptimizeTimetableKpi,
  OptimizeTimetableOptions,
  OptimizeTimetableResult,
  OptimizeTimetableSolution,
  SRC_ARR,
  SRC_DEP,
  TGT_ARR,
  TGT_DEP,
  TIME_FIELDS,
  TimeChange,
  TimeField,
  TrackConflictBlocker,
} from "./optimize-timetable.model";
import {createDefaultOptimizationPolicy, ObjectiveId} from "./optimization-policy.model";
import {compareSolutions} from "./optimization-solution-comparator";
import {isMinimumConnectionTimeSatisfied} from "./minimum-connection-time.validator";

const DEFAULT_TIME_BUDGET_MS = 1000;
const DEFAULT_OPTIONAL_WINDOW = 5;
const DEFAULT_MAX_PROPOSALS = 5;
const MAX_EXACT_EDGE_CACHE_SIZE = 512;

interface NodeTrackMetrics {
  maxTracks: number;
  averageTracks: number;
  turnaroundWaitByTrainrun: Map<number, number>;
  byNode: Map<number, {signature: string; tracks: NodeTrackEstimate[]}>;
}

/**
 * Timetable optimizer (see OPTIMIZE_TIMETABLE.md).
 * Shifts departure/arrival times of chains (sections between two stops) so that
 * feasible proposals meet the active rules; infeasible alternatives remain explicitly marked.
 * The search runs on numbers only; native objects are touched temporarily for the
 * exact track check (always restored) and when a proposal is applied.
 */
@Injectable({
  providedIn: "root",
})
export class OptimizeTimetableService {
  private readonly searchSessions = new WeakMap<
    OptimizeTimetableResult,
    {
      search: SearchResult;
      buildSolutions: (search: SearchResult) => OptimizeTimetableSolution[];
      getInfeasibleSolutions: () => OptimizeTimetableSolution[];
      logTrace: (search: SearchResult, solutions: OptimizeTimetableSolution[]) => void;
      reportProgress: (
        progress: SearchProgress,
        listener?: (progress: SearchProgress) => void,
      ) => void;
    }
  >();

  constructor(private readonly infrastructureEstimatorService: InfrastructureEstimatorService) {}

  estimateBaselineEdges(
    nodes: Node[],
    trainrunSections: TrainrunSection[],
    options: OptimizeTimetableOptions,
  ): EdgeTrackKpi[] {
    const maxTracks = Math.max(1, Math.floor(options.maxTracksPerSection));
    const policy = options.policy ?? createDefaultOptimizationPolicy();
    const problem = buildProblem(
      nodes,
      trainrunSections,
      maxTracks,
      options.selectedNodeIds ?? [],
      options.optionalConnectionWindow ?? DEFAULT_OPTIONAL_WINDOW,
      policy,
      options.selectedCorridorEdgeIds,
    );

    return problem.edges.map((edge, edgeIndex) => {
      const trackSegments = this.estimateEdgeTrackSegments(problem, edgeIndex);
      const tracks = trackSegments.reduce(
        (maximum, segment) => Math.max(maximum, segment.tracks),
        0,
      );
      return {
        edgeId: this.edgeId(edge.fromNode.getId(), edge.toNode.getId()),
        inScope: problem.edgeInScope[edgeIndex] === 1,
        fromNodeName: edge.fromNode.getBetriebspunktName(),
        toNodeName: edge.toNode.getBetriebspunktName(),
        tracksBefore: tracks,
        tracksAfter: tracks,
        trackSegments,
      };
    });
  }

  async optimize(
    nodes: Node[],
    trainrunSections: TrainrunSection[],
    options: OptimizeTimetableOptions,
    onProgress?: (progress: SearchProgress) => void,
  ): Promise<OptimizeTimetableResult> {
    const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
    if (!Number.isFinite(timeBudgetMs) || timeBudgetMs < 0) {
      throw new RangeError("The search budget must be finite and non-negative.");
    }
    const maxProposals = options.maxProposals ?? DEFAULT_MAX_PROPOSALS;
    if (!Number.isInteger(maxProposals) || maxProposals < 0) {
      throw new RangeError("The proposal limit must be a non-negative integer.");
    }
    const start = performance.now();
    const maxTracks = Math.max(1, Math.floor(options.maxTracksPerSection));
    const policy = options.policy ?? createDefaultOptimizationPolicy();
    const problem = buildProblem(
      nodes,
      trainrunSections,
      maxTracks,
      options.selectedNodeIds ?? [],
      options.optionalConnectionWindow ?? DEFAULT_OPTIONAL_WINDOW,
      policy,
      options.selectedCorridorEdgeIds,
    );
    const evaluator = new TimetableEvaluator(problem, this.infrastructureEstimatorService);
    const baselineInitial: ArchivedSolution = {
      delta: new Int32Array(evaluator.delta),
      score: evaluator.evaluateAll(),
      parts: evaluator.parts(),
    };
    const beforeTracks = new Map<number, number>();
    const baselineTrackSegments = new Map<number, TrackSegmentEstimate[]>();
    // Per-search metadata stays fixed; only candidate consecutive times vary.
    const exactEdgeCache = new Map<string, TrackSegmentEstimate[]>();
    const baselineEdges = problem.edges.map((edge, edgeIndex) => {
      const segments = this.estimateEdgeTrackSegments(problem, edgeIndex, exactEdgeCache);
      baselineTrackSegments.set(edgeIndex, segments);
      const tracks = segments.reduce((maximum, segment) => Math.max(maximum, segment.tracks), 0);
      beforeTracks.set(edgeIndex, tracks);
      return {
        edgeId: this.edgeId(edge.fromNode.getId(), edge.toNode.getId()),
        inScope: problem.edgeInScope[edgeIndex] === 1,
        fromNodeName: edge.fromNode.getBetriebspunktName(),
        toNodeName: edge.toNode.getBetriebspunktName(),
        tracksBefore: tracks,
        tracksAfter: tracks,
        trackSegments: segments,
      };
    });
    const baselineNodeMetrics = this.estimateNodeTrackMetrics(nodes, trainrunSections);
    // Final KPIs estimate node occupancies separately, including turnaround waits.
    const solutionEvaluator = new TimetableEvaluator(problem);
    solutionEvaluator.evaluateAll();
    const trackPriorities = problem.edges.map((_, edgeIndex) => {
      const segments = baselineTrackSegments.get(edgeIndex) ?? [];
      const sumTracks = segments.reduce((sum, segment) => sum + segment.tracks, 0);
      return segments.length === 0 ? 0 : (maxTracks * sumTracks) / (2 * segments.length);
    });
    let liveSolutions: OptimizeTimetableSolution[] = [];
    const rankSolutions = (solutions: OptimizeTimetableSolution[]) => {
      const seen = new Set<string>();
      const distinct = solutions
        .filter((solution) => {
          const key = JSON.stringify(
            solution.changes.map((change) => [
              change.trainrunSectionId,
              change.field,
              change.newValue,
            ]),
          );
          if (solution.changes.length === 0 || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((first, second) => compareSolutions(first, second, policy));
      const feasible = distinct.filter((solution) => solution.valid);
      const limit = Math.min(DEFAULT_MAX_PROPOSALS, maxProposals);
      return [
        ...feasible.slice(0, limit),
        ...distinct.filter((solution) => !solution.valid).slice(0, limit),
      ].map((solution, index) => ({
        ...solution,
        id: index,
        label: $localize`:@@app.services.optimization.proposal.candidate:Candidate ${index + 1}`,
      }));
    };
    const getInfeasibleSolutions = () => liveSolutions.filter((solution) => !solution.valid);
    const getVisibleSolutions = () => {
      const feasible = liveSolutions.filter((solution) => solution.valid);
      return feasible.length > 0 ? feasible : getInfeasibleSolutions();
    };
    const buildSolutions = (currentSearch: SearchResult) => {
      liveSolutions = rankSolutions([
        ...liveSolutions,
        ...currentSearch.archive.map((candidate, id) =>
          this.createSolution(
            id,
            $localize`:@@app.services.optimization.proposal.candidate:Candidate ${id + 1}`,
            candidate,
            currentSearch.initial,
            problem,
            nodes,
            beforeTracks,
            baselineEdges,
            baselineKpi,
            baselineNodeMetrics,
            solutionEvaluator,
            exactEdgeCache,
          ),
        ),
      ]);
      return getVisibleSolutions();
    };
    const logTrace = (currentSearch: SearchResult, solutions: OptimizeTimetableSolution[]) => {
      if (options.debugTrace) {
        this.logSearchTrace(
          problem,
          baselineTrackSegments,
          currentSearch.trace,
          currentSearch.omittedTraceEntries,
          solutions,
        );
      }
    };

    const baselineOverLimit = baselineEdges.filter(
      (edge) => edge.inScope && edge.tracksBefore > maxTracks,
    ).length;
    const scopedBaselineEdges = baselineEdges.filter((edge) => edge.inScope);
    const baselineMaxTracks = scopedBaselineEdges.reduce(
      (maximum, edge) => Math.max(maximum, edge.tracksBefore),
      0,
    );
    const baselineTrackSum = scopedBaselineEdges.reduce((sum, edge) => sum + edge.tracksBefore, 0);
    const baselineKpi: OptimizeTimetableKpi = {
      changedChains: 0,
      totalDeltaMinutes: 0,
      travelTimeExtensionMinutes: 0,
      optionalConnections: baselineInitial.parts.optionalConnections,
      maxTrackUsage: baselineMaxTracks,
      averageTrackUsage:
        scopedBaselineEdges.length === 0 ? 0 : baselineTrackSum / scopedBaselineEdges.length,
      changedNodes: 0,
      edgesOverLimitBefore: baselineOverLimit,
      edgesOverLimitAfter: baselineOverLimit,
      maxTracksBefore: baselineMaxTracks,
      maxTracksAfter: baselineMaxTracks,
      maxNodeTracksBefore: baselineNodeMetrics.maxTracks,
      maxNodeTracksAfter: baselineNodeMetrics.maxTracks,
      minimumStopViolationsBefore: baselineInitial.parts.stopViolations,
      minimumStopViolationsAfter: baselineInitial.parts.stopViolations,
      totalTravelTimeDelta: 0,
      optionalConnectionsBefore: baselineInitial.parts.optionalConnections,
      optionalConnectionsAfter: baselineInitial.parts.optionalConnections,
      sumAbsShift: 0,
      changedTrainruns: 0,
      changedTimes: 0,
    };
    baselineKpi.objectiveScores = this.calculateObjectiveScores(
      problem,
      evaluator,
      nodes,
      baselineNodeMetrics,
      baselineNodeMetrics,
      baselineMaxTracks,
      baselineKpi.averageTrackUsage,
      scopedBaselineEdges.length,
    );
    let firstFeasibleSolution: OptimizeTimetableSolution | undefined;
    const reportProgress = (
      progress: SearchProgress,
      listener?: (progress: SearchProgress) => void,
    ) => {
      if (progress.candidate !== undefined) {
        const candidate = this.createSolution(
          -1,
          $localize`:@@app.services.optimization.proposal.first-feasible:First feasible candidate`,
          progress.candidate,
          baselineInitial,
          problem,
          nodes,
          beforeTracks,
          baselineEdges,
          baselineKpi,
          baselineNodeMetrics,
          solutionEvaluator,
          exactEdgeCache,
        );
        liveSolutions = rankSolutions([...liveSolutions, candidate]);
        if (firstFeasibleSolution === undefined && candidate.valid) {
          firstFeasibleSolution = candidate;
        }
      }
      listener?.({
        ...progress,
        phase: firstFeasibleSolution === undefined ? "feasibility" : "soft-objectives",
        solution: firstFeasibleSolution,
        solutions: getVisibleSolutions(),
        infeasibleSolutions: getInfeasibleSolutions(),
      });
    };
    const progress = (update: SearchProgress) => reportProgress(update, onProgress);
    const search =
      options.engine === "cp-sat"
        ? await runCpSatSearch(
            problem,
            evaluator,
            options.startAssignment,
            timeBudgetMs,
            progress,
            (edgeIndex, candidateEvaluator) =>
              this.withCandidateConsecutiveTimes(
                problem,
                candidateEvaluator,
                problem.edges[edgeIndex].sections.map((index) => problem.sections[index]),
                () =>
                  this.estimateEdgeTrackSegments(problem, edgeIndex, exactEdgeCache).every(
                    (segment) => segment.tracks <= maxTracks,
                  ),
              ),
          )
        : await runSearch(
            problem,
            evaluator,
            options.startAssignment,
            timeBudgetMs,
            options.seed ?? 1,
            options.debugTrace ?? false,
            trackPriorities,
            progress,
          );

    const freeVariables = problem.variables.filter((v) => !v.fixed && v.domain > 0).length;
    const freeTravelTimeVariables = problem.variables.filter(
      (variable) =>
        !variable.fixed && variable.domain > 0 && variable.travelTimeTrainrunIndex !== undefined,
    ).length;
    const fixedTravelTimeVariables = problem.variables.filter(
      (variable) =>
        variable.travelTimeTrainrunIndex !== undefined && (variable.fixed || variable.domain <= 0),
    ).length;
    const travelTimeLockBlockedVariables = problem.variables.filter(
      (variable) => variable.travelTimeFixedReason === "travel-time-lock",
    ).length;
    const departureTimeLockBlockedVariables = problem.variables.filter(
      (variable) => variable.travelTimeFixedReason === "departure-time-lock",
    ).length;
    const arrivalTimeLockBlockedVariables = problem.variables.filter(
      (variable) => variable.travelTimeFixedReason === "arrival-time-lock",
    ).length;
    const scopeBlockedTravelTimeVariables = problem.variables.filter(
      (variable) => variable.travelTimeFixedReason === "scope",
    ).length;
    const noRangeTravelTimeVariables = problem.variables.filter(
      (variable) =>
        variable.travelTimeTrainrunIndex !== undefined &&
        variable.domain <= 0 &&
        variable.travelTimeFixedReason === undefined,
    ).length;
    const fixedChains = problem.chains.filter((c) => c.fixed).length;
    const result: OptimizeTimetableResult = {
      engine: options.engine ?? "heuristic",
      searchExhausted: search.exhausted,
      baselineKpi,
      baselineEdges,
      immutableTrackConflicts: policy.hardConstraints.some(
        (constraint) => constraint.id === "trackLimit" && constraint.enabled,
      )
        ? baselineEdges.flatMap((edge, index) =>
            edge.inScope &&
            edge.tracksBefore > maxTracks &&
            problem.edgeVars[index].every(
              (variable) =>
                problem.variables[variable].fixed || problem.variables[variable].domain === 0,
            )
              ? [
                  {
                    ...edge,
                    blockingSections: this.getImmutableTrackConflictBlockers(
                      problem,
                      index,
                      options,
                    ),
                  },
                ]
              : [],
          )
        : [],
      solutions: [],
      freeVariables,
      freeShiftVariables: freeVariables - freeTravelTimeVariables,
      freeTravelTimeVariables,
      fixedTravelTimeVariables,
      travelTimeLockBlockedVariables,
      departureTimeLockBlockedVariables,
      arrivalTimeLockBlockedVariables,
      scopeBlockedTravelTimeVariables,
      noRangeTravelTimeVariables,
      fixedChains,
      iterations: search.iterations,
      evaluatedCandidates: search.evaluatedCandidates,
      runtimeMs: 0,
      initialEdgesOverLimit: baselineOverLimit,
      searchBestAssignment: search.bestAssignment,
    };

    if (freeVariables === 0) {
      result.message = $localize`:@@app.services.optimization.no-free-variables:No times can be shifted (locks, selection or no trainruns).`;
    }

    result.solutions = buildSolutions(search);
    result.infeasibleSolutions = getInfeasibleSolutions();

    if (!result.solutions.some((solution) => solution.valid) && freeVariables > 0) {
      result.message = result.searchExhausted
        ? $localize`:@@app.services.optimization.cp-sat-exhausted:The finite CP-SAT model is exhausted. No feasible alternative was found; available infeasible candidates can be expanded.`
        : $localize`:@@app.services.optimization.no-solution:No feasible alternative found within the search time. Available infeasible candidates can be expanded; continue searching to improve them.`;
    }
    result.runtimeMs = Math.round(performance.now() - start);
    logTrace(search, result.solutions);
    if (search.continueFor !== undefined) {
      this.searchSessions.set(result, {
        search,
        buildSolutions,
        getInfeasibleSolutions,
        logTrace,
        reportProgress,
      });
    }
    return result;
  }

  async continueSearch(
    result: OptimizeTimetableResult,
    additionalBudgetMs: number,
    onProgress?: (progress: SearchProgress) => void,
  ): Promise<OptimizeTimetableResult> {
    const session = this.searchSessions.get(result);
    if (session?.search.continueFor === undefined) {
      throw new Error("The optimization search session is no longer available.");
    }

    const search = await session.search.continueFor(additionalBudgetMs, (progress) =>
      session.reportProgress(progress, onProgress),
    );
    session.search = search;
    result.iterations = search.iterations;
    result.evaluatedCandidates = search.evaluatedCandidates;
    result.searchBestAssignment = search.bestAssignment;
    result.searchExhausted = search.exhausted;
    result.solutions = session.buildSolutions(search);
    result.infeasibleSolutions = session.getInfeasibleSolutions();
    result.message = result.solutions.some((solution) => solution.valid)
      ? undefined
      : result.freeVariables === 0
        ? $localize`:@@app.services.optimization.no-free-variables:No times can be shifted (locks, selection or no trainruns).`
        : result.searchExhausted
          ? $localize`:@@app.services.optimization.cp-sat-exhausted:The finite CP-SAT model is exhausted. No feasible alternative was found; available infeasible candidates can be expanded.`
          : $localize`:@@app.services.optimization.no-solution:No feasible alternative found within the search time. Available infeasible candidates can be expanded; continue searching to improve them.`;
    session.logTrace(search, result.solutions);
    return result;
  }

  isSolutionValid(
    solution: OptimizeTimetableSolution,
    nodes: Node[],
    trainrunSections: TrainrunSection[],
    options: OptimizeTimetableOptions,
    baselineEdges: EdgeTrackKpi[],
  ): boolean {
    const policy = options.policy ?? createDefaultOptimizationPolicy();
    const maxTracks = Math.max(1, Math.floor(options.maxTracksPerSection));
    const problem = buildProblem(
      nodes,
      trainrunSections,
      maxTracks,
      options.selectedNodeIds ?? [],
      options.optionalConnectionWindow ?? DEFAULT_OPTIONAL_WINDOW,
      policy,
      options.selectedCorridorEdgeIds,
    );
    const evaluator = new TimetableEvaluator(problem, this.infrastructureEstimatorService);
    problem.variables.forEach((variable, index) => {
      if (!variable.fixed) {
        evaluator.setVariable(index, solution.assignment[variable.key] ?? 0);
      }
    });
    evaluator.evaluateAll();
    const parts = evaluator.parts();
    const userConnectionsEnabled = policy.hardConstraints.some(
      (constraint) => constraint.id === "userConnections" && constraint.enabled,
    );
    const minimumStopTimeEnabled = policy.hardConstraints.some(
      (constraint) => constraint.id === "minimumStopTime" && constraint.enabled,
    );
    const maxTravelTimeEnabled = policy.hardConstraints.some(
      (constraint) => constraint.id === "maxTravelTimeExtension" && constraint.enabled,
    );
    const nonTrackViolations =
      (minimumStopTimeEnabled ? parts.stopViolations : 0) +
      (maxTravelTimeEnabled ? parts.travelTimeExtensionViolation : 0);

    const changedEdges = new Map(solution.edges.map((edge) => [edge.edgeId, edge]));
    const exactOverLimit = baselineEdges.some((baselineEdge) => {
      if (!baselineEdge.inScope) {
        return false;
      }
      const edge = changedEdges.get(baselineEdge.edgeId) ?? baselineEdge;
      return edge.tracksAfter > maxTracks;
    });
    const trackLimitEnabled = policy.hardConstraints.some(
      (constraint) => constraint.id === "trackLimit" && constraint.enabled,
    );
    const symmetryEnabled = policy.hardConstraints.some(
      (constraint) => constraint.id === "symmetry" && constraint.enabled,
    );
    const symmetryValid = !symmetryEnabled || this.hasSymmetricChanges(solution, trainrunSections);

    const connectionTimesValid =
      !userConnectionsEnabled || this.areMinimumConnectionTimesSatisfied(solution.changes, nodes);
    return (
      nonTrackViolations === 0 &&
      connectionTimesValid &&
      (!trackLimitEnabled || !exactOverLimit) &&
      symmetryValid
    );
  }

  private areMinimumConnectionTimesSatisfied(
    solutionChanges: TimeChange[],
    nodes: Node[],
  ): boolean {
    const changes = new Map(
      solutionChanges.map((change) => [`${change.trainrunSectionId}:${change.field}`, change]),
    );
    const timeField = (node: Node, section: TrainrunSection, departure: boolean): TimeField => {
      const atSource = section.getSourceNodeId() === node.getId();
      if (atSource) {
        return departure ? "sourceDeparture" : "sourceArrival";
      }
      return departure ? "targetDeparture" : "targetArrival";
    };
    const shiftAt = (node: Node, section: TrainrunSection, departure: boolean): number => {
      const change = changes.get(`${section.getId()}:${timeField(node, section, departure)}`);
      return change === undefined ? 0 : norm60(change.newValue - change.oldValue);
    };
    const originalTime = (node: Node, section: TrainrunSection, departure: boolean): number => {
      const change = changes.get(`${section.getId()}:${timeField(node, section, departure)}`);
      return (
        change?.oldValue ??
        (departure ? node.getDepartureTime(section) : node.getArrivalTime(section))
      );
    };

    for (const node of nodes) {
      const minimumConnectionTime = node.getConnectionTime() ?? 0;
      for (const connection of node.getConnections()) {
        const first = node.getPort(connection.getPortId1())?.getTrainrunSection();
        const second = node.getPort(connection.getPortId2())?.getTrainrunSection();
        if (first === undefined || second === undefined) {
          continue;
        }
        for (const [arrival, departure] of [
          [first, second],
          [second, first],
        ] as const) {
          const arrivalTime = originalTime(node, arrival, false);
          const departureTime = originalTime(node, departure, true);
          const baselineWait = mod60(departureTime - arrivalTime);
          if (
            !isMinimumConnectionTimeSatisfied(
              baselineWait,
              shiftAt(node, arrival, false),
              shiftAt(node, departure, true),
              minimumConnectionTime,
            )
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /** Writes the new times of a proposal into the native objects. */
  applySolution(solution: OptimizeTimetableSolution, trainrunSections: TrainrunSection[]) {
    this.writeChanges(solution.changes, trainrunSections, (c) => c.newValue);
  }

  /** Restores the old times of a proposal. */
  revertSolution(solution: OptimizeTimetableSolution, trainrunSections: TrainrunSection[]) {
    this.writeChanges(solution.changes, trainrunSections, (c) => c.oldValue);
  }

  /** Ids of one section per changed trainrun (for consecutive time propagation). */
  getChangedTrainrunSectionIds(solution: OptimizeTimetableSolution): number[] {
    const byTrainrun = new Map<number, number>();
    solution.changes.forEach((c) => byTrainrun.set(c.trainrunId, c.trainrunSectionId));
    return [...byTrainrun.values()];
  }

  private writeChanges(
    changes: TimeChange[],
    trainrunSections: TrainrunSection[],
    value: (c: TimeChange) => number,
  ) {
    const byId = new Map<number, TrainrunSection>();
    trainrunSections.forEach((s) => byId.set(s.getId(), s));
    changes.forEach((change) => {
      const section = byId.get(change.trainrunSectionId);
      if (section === undefined) {
        return;
      }
      const v = value(change);
      switch (change.field) {
        case "sourceDeparture":
          section.setSourceDeparture(v);
          break;
        case "sourceArrival":
          section.setSourceArrival(v);
          break;
        case "targetDeparture":
          section.setTargetDeparture(v);
          break;
        case "targetArrival":
          section.setTargetArrival(v);
          break;
        case "travelTime":
          section.setTravelTime(v);
          break;
        case "backwardTravelTime":
          section.setBackwardTravelTime(v);
          break;
      }
    });
  }

  private hasSymmetricChanges(
    solution: Pick<OptimizeTimetableSolution, "changes">,
    trainrunSections: TrainrunSection[],
  ): boolean {
    const values = new Map<string, number>();
    solution.changes.forEach((change) =>
      values.set(`${change.trainrunSectionId}:${change.field}`, change.newValue),
    );
    const symmetricTime = (time: number) => ((-time % 60) + 60) % 60;
    const isClose = (first: number, second: number) => {
      const difference = ((((first - second) % 60) + 90) % 60) - 30;
      return Math.abs(difference) < 1e-6;
    };
    return trainrunSections.every((section) => {
      if (section.getTrainrun().getDirection() === Direction.ONE_WAY || !section.isSymmetric()) {
        return true;
      }
      const value = (field: TimeField, original: number) =>
        values.get(`${section.getId()}:${field}`) ?? original;
      return (
        isClose(
          value("sourceArrival", section.getSourceArrival()),
          symmetricTime(value("sourceDeparture", section.getSourceDeparture())),
        ) &&
        isClose(
          value("targetArrival", section.getTargetArrival()),
          symmetricTime(value("targetDeparture", section.getTargetDeparture())),
        )
      );
    });
  }

  private createSolution(
    id: number,
    label: string,
    archived: ArchivedSolution,
    initial: ArchivedSolution,
    problem: OptimizationProblem,
    nodes: Node[],
    beforeTracks: Map<number, number>,
    baselineEdges: EdgeTrackKpi[],
    baselineKpi: OptimizeTimetableKpi,
    baselineNodeMetrics: NodeTrackMetrics,
    evaluator: TimetableEvaluator,
    exactEdgeCache: Map<string, TrackSegmentEstimate[]>,
  ): OptimizeTimetableSolution {
    archived.delta.forEach((value, index) => {
      if (value !== evaluator.delta[index]) {
        evaluator.setVariable(index, value);
      }
    });
    const parts = evaluator.parts();
    const nodeMetrics = this.withCandidateConsecutiveTimes(
      problem,
      evaluator,
      problem.sections,
      () => this.estimateNodeTrackMetrics(nodes, problem.sections, baselineNodeMetrics),
    );

    const changes: TimeChange[] = [];
    const changedEdges = new Set<number>();
    const changedSections: number[] = [];
    problem.sections.forEach((section, i) => {
      let changed = false;
      const add = (field: TimeField, oldValue: number, newValue: number) => {
        if (Math.abs(oldValue - newValue) > 1e-9) {
          changed = true;
          changes.push({
            trainrunSectionId: section.getId(),
            trainrunId: section.getTrainrunId(),
            trainrunName: `${section.getTrainrun().getCategoryShortName()}${section.getTrainrun().getTitle()}`,
            sourceNodeId: section.getSourceNodeId(),
            targetNodeId: section.getTargetNodeId(),
            sourceNodeName: section.getSourceNode().getBetriebspunktName(),
            targetNodeName: section.getTargetNode().getBetriebspunktName(),
            field,
            oldValue,
            newValue,
          });
        }
      };
      TIME_FIELDS.forEach((field, k) =>
        add(field, problem.origT[i * 4 + k], evaluator.candT[i * 4 + k]),
      );
      add("travelTime", evaluator.origTravel[i * 2], evaluator.candTravel[i * 2]);
      add("backwardTravelTime", evaluator.origTravel[i * 2 + 1], evaluator.candTravel[i * 2 + 1]);
      if (changed) {
        changedEdges.add(problem.sectionEdge[i]);
        changedSections.push(i);
      }
    });

    // exact check with the InfrastructureEstimatorService on all changed edges
    const edges: EdgeTrackKpi[] = [];
    const afterTracks = new Map<number, number>();
    let overAfter = baselineKpi.edgesOverLimitAfter;
    changedEdges.forEach((e) => {
      const edge = problem.edges[e];
      const sections = edge.sections.map((i) => problem.sections[i]);
      const before = beforeTracks.get(e) ?? 0;
      const segmentsAfter = this.withCandidateConsecutiveTimes(problem, evaluator, sections, () =>
        this.estimateEdgeTrackSegments(problem, e, exactEdgeCache),
      );
      const after = segmentsAfter.reduce(
        (maximum, segment) => Math.max(maximum, segment.tracks),
        0,
      );
      afterTracks.set(e, after);
      if (problem.edgeInScope[e] === 1) {
        overAfter += Number(after > problem.maxTracks) - Number(before > problem.maxTracks);
      }
      edges.push({
        edgeId: this.edgeId(edge.fromNode.getId(), edge.toNode.getId()),
        inScope: problem.edgeInScope[e] === 1,
        fromNodeName: edge.fromNode.getBetriebspunktName(),
        toNodeName: edge.toNode.getBetriebspunktName(),
        tracksBefore: before,
        tracksAfter: after,
        trackSegmentsBefore: baselineEdges[e]?.trackSegments ?? [],
        trackSegmentsAfter: segmentsAfter,
      });
    });
    edges.sort((a, b) => b.tracksAfter - a.tracksAfter || b.tracksBefore - a.tracksBefore);

    let maxTracksAfter = 0;
    let maxTracksBefore = 0;
    let totalTracksAfter = 0;
    let scopedEdgeCount = 0;
    for (let edgeIndex = 0; edgeIndex < baselineEdges.length; edgeIndex++) {
      if (!baselineEdges[edgeIndex].inScope) {
        continue;
      }
      scopedEdgeCount++;
      maxTracksBefore = Math.max(maxTracksBefore, beforeTracks.get(edgeIndex) ?? 0);
      const tracks = afterTracks.get(edgeIndex) ?? beforeTracks.get(edgeIndex) ?? 0;
      maxTracksAfter = Math.max(maxTracksAfter, tracks);
      totalTracksAfter += tracks;
    }

    const changedChains = new Set<number>();
    changedSections.forEach((sectionIndex) =>
      changedChains.add(problem.sectionChain[sectionIndex]),
    );
    const changedNodes = new Set<number>();
    changes.forEach((change) => {
      changedNodes.add(change.sourceNodeId);
      changedNodes.add(change.targetNodeId);
    });
    const userConnectionsEnabled = problem.policy.hardConstraints.some(
      (constraint) => constraint.id === "userConnections" && constraint.enabled,
    );
    const minimumStopTimeEnabled = problem.policy.hardConstraints.some(
      (constraint) => constraint.id === "minimumStopTime" && constraint.enabled,
    );
    const maxTravelTimeEnabled = problem.policy.hardConstraints.some(
      (constraint) => constraint.id === "maxTravelTimeExtension" && constraint.enabled,
    );
    const trackLimitEnabled = problem.policy.hardConstraints.some(
      (constraint) => constraint.id === "trackLimit" && constraint.enabled,
    );
    const nonTrackViolations =
      (minimumStopTimeEnabled ? parts.stopViolations : 0) +
      (maxTravelTimeEnabled ? parts.travelTimeExtensionViolation : 0);
    const connectionTimesValid =
      !userConnectionsEnabled || this.areMinimumConnectionTimesSatisfied(changes, nodes);

    const assignment: Record<string, number> = {};
    problem.variables.forEach((variable, v) => {
      if (!variable.fixed && archived.delta[v] !== 0) {
        assignment[variable.key] = archived.delta[v];
      }
    });

    return {
      id,
      label,
      valid:
        nonTrackViolations === 0 &&
        connectionTimesValid &&
        (!trackLimitEnabled || overAfter === 0) &&
        (!problem.policy.hardConstraints.some((rule) => rule.id === "symmetry" && rule.enabled) ||
          this.hasSymmetricChanges({changes}, problem.sections)),
      kpi: {
        objectiveScores: this.calculateObjectiveScores(
          problem,
          evaluator,
          nodes,
          nodeMetrics,
          baselineNodeMetrics,
          maxTracksAfter,
          scopedEdgeCount === 0 ? 0 : totalTracksAfter / scopedEdgeCount,
          scopedEdgeCount,
        ),
        changedChains: changedChains.size,
        totalDeltaMinutes: parts.sumAbsShift,
        travelTimeExtensionMinutes: parts.travelTimeDelta,
        optionalConnections: parts.optionalConnections,
        maxTrackUsage: maxTracksAfter,
        changedNodes: changedNodes.size,
        edgesOverLimitBefore: baselineKpi.edgesOverLimitBefore,
        edgesOverLimitAfter: Math.max(0, overAfter),
        maxTracksBefore,
        maxTracksAfter,
        maxNodeTracksBefore: baselineNodeMetrics.maxTracks,
        maxNodeTracksAfter: nodeMetrics.maxTracks,
        minimumStopViolationsBefore: initial.parts.stopViolations,
        minimumStopViolationsAfter: parts.stopViolations,
        averageTrackUsage: scopedEdgeCount === 0 ? 0 : totalTracksAfter / scopedEdgeCount,
        totalTravelTimeDelta: parts.travelTimeDelta,
        optionalConnectionsBefore: initial.parts.optionalConnections,
        optionalConnectionsAfter: parts.optionalConnections,
        sumAbsShift: parts.sumAbsShift,
        changedTrainruns: new Set(changes.map((c) => c.trainrunId)).size,
        changedTimes: changes.length,
      },
      edges,
      changes,
      assignment,
    };
  }

  private calculateObjectiveScores(
    problem: OptimizationProblem,
    evaluator: TimetableEvaluator,
    nodes: Node[],
    nodeMetrics: NodeTrackMetrics,
    baselineNodeMetrics: NodeTrackMetrics,
    maxEdgeTracks: number,
    averageEdgeTracks: number,
    scopedEdgeCount: number,
  ): Record<ObjectiveId, number> {
    let squaredTimeShift = 0;
    problem.sections.forEach((_, sectionIndex) => {
      for (let field = 0; field < 4; field++) {
        const index = sectionIndex * 4 + field;
        if (problem.active[index] === 0) {
          continue;
        }
        const shift = evaluator.candC[index] - problem.origC[index];
        squaredTimeShift += shift * shift;
      }
    });
    const normalizedShiftCost = squaredTimeShift / Math.max(1, problem.sections.length);

    const trainrunCount = problem.trainrunIds.length;
    const trainrunFrequencies = new Map<number, number>();
    problem.sections.forEach((section) =>
      trainrunFrequencies.set(
        section.getTrainrunId(),
        Math.max(1, section.getTrainrun().getFrequency() || 60),
      ),
    );
    let travelTimeScore = 0;
    problem.trainrunIds.forEach((trainrunId, trainrunIndex) => {
      const turnaroundWait = nodeMetrics.turnaroundWaitByTrainrun.get(trainrunId) ?? 0;
      const baselineTurnaroundWait =
        baselineNodeMetrics.turnaroundWaitByTrainrun.get(trainrunId) ?? 0;
      const durationDelta =
        evaluator.getTravelTimeChangeByTrainrun(trainrunIndex) +
        turnaroundWait -
        baselineTurnaroundWait;
      travelTimeScore += durationDelta <= 0 ? 1 : -1;

      const frequency = trainrunFrequencies.get(trainrunId) ?? 60;
      travelTimeScore -= Math.pow(Math.min(1, turnaroundWait / frequency), 2);
    });

    const nodeCount = Math.max(1, nodes.length);
    const maximumPossibleTracks = Math.max(1, problem.sections.length);
    const averageTrackWeight = 1 / (nodeCount + 1);
    const normalizedNodeTrackCost =
      (nodeMetrics.maxTracks + nodeMetrics.averageTracks * averageTrackWeight) /
      maximumPossibleTracks;
    const averageEdgeTrackWeight = 1 / (scopedEdgeCount + 1);
    const normalizedEdgeTrackCost =
      (maxEdgeTracks + averageEdgeTracks * averageEdgeTrackWeight) / maximumPossibleTracks;

    return {
      minimalChanges: 1 / (1 + normalizedShiftCost),
      connectionStability: 1 / (1 + evaluator.getAverageConnectionWaitDeviation()),
      moreConnections: evaluator.getOptionalConnectionScore(),
      lowerTravelTime: trainrunCount === 0 ? 0 : (travelTimeScore / trainrunCount + 2) / 3,
      lowerTrackUsage: 1 / (1 + normalizedNodeTrackCost),
      lowerEdgeTrackUsage: 1 / (1 + normalizedEdgeTrackCost),
    };
  }

  private estimateNodeTrackMetrics(
    nodes: Node[],
    trainrunSections: TrainrunSection[],
    baseline?: NodeTrackMetrics,
  ): NodeTrackMetrics {
    const trackCounts: number[] = [];
    const turnaroundWaits = new Map<number, Map<string, number>>();
    const byNode: NodeTrackMetrics["byNode"] = new Map();
    nodes.forEach((node) => {
      const signature = trainrunSections
        .filter(
          (section) =>
            section.getSourceNodeId() === node.getId() ||
            section.getTargetNodeId() === node.getId(),
        )
        .map((section) =>
          [
            section.getId(),
            section.getSourceDepartureConsecutiveTime(),
            section.getSourceArrivalConsecutiveTime(),
            section.getTargetDepartureConsecutiveTime(),
            section.getTargetArrivalConsecutiveTime(),
          ].join(","),
        )
        .join("|");
      const cached = baseline?.byNode.get(node.getId());
      const nodeTracks =
        cached?.signature === signature
          ? cached.tracks
          : this.infrastructureEstimatorService.estimateNodeTracks(node, trainrunSections);
      byNode.set(node.getId(), {signature, tracks: nodeTracks});
      trackCounts.push(nodeTracks.length);
      nodeTracks.forEach((track) =>
        track.occupancies.forEach((occupancy) => {
          if (
            occupancy.arrivalSectionId === undefined ||
            occupancy.departureSectionId === undefined ||
            occupancy.transitionId !== undefined
          ) {
            return;
          }
          const occurrences =
            turnaroundWaits.get(occupancy.trainrunId) ?? new Map<string, number>();
          occurrences.set(
            `${node.getId()}:${occupancy.occurrenceIndex}`,
            Math.max(0, occupancy.departureMinute - occupancy.arrivalMinute),
          );
          turnaroundWaits.set(occupancy.trainrunId, occurrences);
        }),
      );
    });

    const turnaroundWaitByTrainrun = new Map<number, number>();
    turnaroundWaits.forEach((occurrences, trainrunId) => {
      const waits = [...occurrences.values()];
      turnaroundWaitByTrainrun.set(
        trainrunId,
        waits.reduce((sum, wait) => sum + wait, 0) / waits.length,
      );
    });
    return {
      maxTracks: Math.max(0, ...trackCounts),
      averageTracks:
        trackCounts.length === 0
          ? 0
          : trackCounts.reduce((sum, tracks) => sum + tracks, 0) / trackCounts.length,
      turnaroundWaitByTrainrun,
      byNode,
    };
  }

  private estimateEdgeTrackSegments(
    problem: OptimizationProblem,
    edgeIndex: number,
    cache?: Map<string, TrackSegmentEstimate[]>,
  ): TrackSegmentEstimate[] {
    const edge = problem.edges[edgeIndex];
    const sections = edge.sections.map((i) => problem.sections[i]);
    const signature = `${edgeIndex}:${sections
      .map((section) =>
        [
          section.getSourceDepartureConsecutiveTime(),
          section.getSourceArrivalConsecutiveTime(),
          section.getTargetDepartureConsecutiveTime(),
          section.getTargetArrivalConsecutiveTime(),
        ].join(","),
      )
      .join("|")}`;
    const cached = cache?.get(signature);
    if (cached !== undefined) {
      return cached;
    }
    const segments = this.infrastructureEstimatorService.estimateSectionTracks(
      edge.fromNode,
      edge.toNode,
      sections,
    );
    if (cache !== undefined) {
      cache.set(signature, segments);
      if (cache.size > MAX_EXACT_EDGE_CACHE_SIZE) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
    }
    return segments;
  }

  private logSearchTrace(
    problem: OptimizationProblem,
    segmentsByEdge: Map<number, TrackSegmentEstimate[]>,
    trace: Awaited<ReturnType<typeof runSearch>>["trace"],
    omittedTraceEntries: number,
    solutions: OptimizeTimetableSolution[],
  ): void {
    const x = problem.maxTracks;
    const edgeRows = problem.edges
      .map((edge, edgeIndex) => {
        const segments = segmentsByEdge.get(edgeIndex) ?? [];
        const sumSegmentTracks = segments.reduce((sum, segment) => sum + segment.tracks, 0);
        const conflictValue =
          segments.length === 0
            ? 0
            : (problem.maxTracks * sumSegmentTracks) / (2 * segments.length);
        const maximumSegmentTracks = segments.reduce(
          (maximum, segment) => Math.max(maximum, segment.tracks),
          0,
        );
        return {
          edgeIndex,
          inScope: problem.edgeInScope[edgeIndex] === 1,
          strecke: `${edge.fromNode.getBetriebspunktName()} -> ${edge.toNode.getBetriebspunktName()}`,
          konfliktwert: Number(conflictValue.toFixed(2)),
          x,
          scoreKonflikt: conflictValue > x,
          harteGleisverletzung: maximumSegmentTracks > x,
          maxGleise: maximumSegmentTracks,
          segmente: segments
            .map(
              (segment) =>
                `${Math.round(segment.start * 100)}-${Math.round(segment.end * 100)}%: ${segment.tracks}`,
            )
            .join(" | "),
          moeglicheZuege: this.describeEdgeChains(problem, edgeIndex),
        };
      })
      .filter((row) => row.inScope)
      .sort((first, second) => second.konfliktwert - first.konfliktwert);
    const conflictRows = edgeRows.filter((row) => row.scoreKonflikt || row.harteGleisverletzung);
    const chainRows = problem.chains.map((chain) => {
      const variableIndices = [...new Set([chain.varA, chain.varB])];
      const variables = variableIndices.map((index) => problem.variables[index]);
      const locks = new Set<string>();
      const outOfScopeSections = new Set<number>();
      chain.steps.forEach((step) => {
        const section = problem.sections[step.sectionIdx];
        const lockFields = [
          ["sourceDeparture", section.getSourceDepartureLock()],
          ["sourceArrival", section.getSourceArrivalLock()],
          ["targetDeparture", section.getTargetDepartureLock()],
          ["targetArrival", section.getTargetArrivalLock()],
        ] as const;
        lockFields.forEach(([field, locked]) => {
          if (locked) {
            locks.add(`${section.getId()}:${field}`);
          }
        });
        const edgeIndex = problem.sectionEdge[step.sectionIdx];
        if (edgeIndex < 0 || problem.edgeInScope[edgeIndex] !== 1) {
          outOfScopeSections.add(section.getId());
        }
      });
      const frequency = chain.trainrun.getFrequency() || 60;
      const naturalDomain = Math.floor(Math.min(frequency, 60) / 2);
      const movable = !chain.fixed && variables.some((variable) => variable.domain > 0);
      const reasons = [
        locks.size > 0 ? `Zeit-Lock: ${[...locks].join(", ")}` : "",
        outOfScopeSections.size > 0
          ? `ausserhalb Scope: Abschnitte ${[...outOfScopeSections].join(", ")}`
          : "",
        chain.key.endsWith(":fixed") ? "nicht traversierbarer/zyklischer Abschnitt" : "",
        naturalDomain === 0 ? `Δ-Domäne 0 (Frequenz ${frequency} min)` : "",
      ].filter(Boolean);
      return {
        zug: `${chain.trainrun.getCategoryShortName()} ${chain.trainrun.getTitle()}`.trim(),
        zugId: chain.trainrun.getId(),
        kette: chain.steps.length
          ? `${chain.steps[0].fromNode.getBetriebspunktName()} -> ${chain.steps[chain.steps.length - 1].toNode.getBetriebspunktName()}`
          : chain.key,
        verschiebbar: movable,
        variableDomains: variables
          .map((variable) => `${variable.key}: ±${variable.domain}`)
          .join("; "),
        grund: movable ? "frei" : reasons.join("; ") || "fixiert",
      };
    });
    const finalRows = solutions.map((solution) => ({
      vorschlag: solution.label,
      gueltig: solution.valid,
      geaenderteZuege: [...new Set(solution.changes.map((change) => change.trainrunName))].join(
        ", ",
      ),
      gleiseMax: solution.kpi.maxTrackUsage,
      ueberlasteteStrecken: solution.kpi.edgesOverLimitAfter,
      verschiebungsminuten: solution.kpi.totalDeltaMinutes,
      geaenderteKetten: solution.kpi.changedChains,
    }));

    console.groupCollapsed("Fahrplanoptimierung: Schritt-für-Schritt-Diagnose");
    const freeVariableCount = problem.variables.filter(
      (variable) => !variable.fixed && variable.domain > 0,
    ).length;
    const freeTravelTimeVariableCount = problem.variables.filter(
      (variable) =>
        !variable.fixed && variable.domain > 0 && variable.travelTimeTrainrunIndex !== undefined,
    ).length;
    const domainlessChainCount = problem.chains.filter(
      (chain) =>
        [chain.varA, chain.varB].every((index) => problem.variables[index].domain === 0) &&
        !chain.fixed,
    ).length;
    console.info(
      `Eingabemodell: ${problem.sections.length} Abschnitte, ${problem.chains.length} Ketten, ${freeVariableCount} freie Variablen (davon ${freeTravelTimeVariableCount} Abschnittsfahrzeiten), ${domainlessChainCount} Ketten ohne Δ-Domäne, ${problem.edges.length} Strecken.`,
    );
    console.info(
      `Schritt 1: exakte Track-Estimator-Segmente. Konfliktwert = maxTracks * Summe(segment.tracks) / (2 * Segmentanzahl); x = maxTracksPerSection (${x}). Sortierung absteigend.`,
    );
    console.table(conflictRows.length > 0 ? conflictRows : edgeRows.slice(0, 20));
    console.info("Schritt 1b: Verschiebbarkeit je Kette (Grund bei fixierten Ketten).");
    console.table(chainRows);
    console.info(
      "Schritte 2-4: akzeptierte Suchmoves. Gleiswirkungen innerhalb der Suche sind Surrogatwerte; Kandidatenketten sind mögliche Verursacher, bis ein getesteter Move die Wirkung bestätigt.",
    );
    console.table(trace);
    if (omittedTraceEntries > 0) {
      console.info(
        `${omittedTraceEntries} weitere Suchschritte wegen des Trace-Limits ausgelassen.`,
      );
    }
    console.info("Schritt 5: nach den harten Regeln exakt validierte Vorschläge.");
    console.table(finalRows);
    console.groupEnd();
  }

  private describeEdgeChains(problem: OptimizationProblem, edgeIndex: number): string {
    const chainIndices = new Set<number>();
    problem.edgeVars[edgeIndex].forEach((variableIndex) =>
      problem.variables[variableIndex].chains.forEach((chainIndex) => chainIndices.add(chainIndex)),
    );
    return [...chainIndices]
      .map((chainIndex) => {
        const chain = problem.chains[chainIndex];
        const trainrunName =
          `${chain.trainrun.getCategoryShortName()} ${chain.trainrun.getTitle()}`.trim();
        const route = chain.steps.length
          ? [
              chain.steps[0].fromNode.getBetriebspunktName(),
              ...chain.steps.map((step) => step.toNode.getBetriebspunktName()),
            ].join(" -> ")
          : chain.key;
        return `Zug ${trainrunName} (#${chain.trainrun.getId()}): ${route}`;
      })
      .join("; ");
  }

  private getImmutableTrackConflictBlockers(
    problem: OptimizationProblem,
    edgeIndex: number,
    options: OptimizeTimetableOptions,
  ): TrackConflictBlocker[] {
    const selectedNodes = new Set(options.selectedNodeIds ?? []);
    const selectedCorridorEdges =
      options.selectedCorridorEdgeIds === undefined
        ? undefined
        : new Set(options.selectedCorridorEdgeIds);
    const isOutsideScope = (section: TrainrunSection): boolean =>
      (selectedNodes.size > 0 &&
        (!selectedNodes.has(section.getSourceNodeId()) ||
          !selectedNodes.has(section.getTargetNodeId()))) ||
      (selectedCorridorEdges !== undefined &&
        !selectedCorridorEdges.has(
          this.edgeId(section.getSourceNodeId(), section.getTargetNodeId()),
        ));
    const blockingSections = new Map<number, TrackConflictBlocker>();
    const getBlockingSection = (sectionIndex: number): TrackConflictBlocker => {
      const existing = blockingSections.get(sectionIndex);
      if (existing !== undefined) {
        return existing;
      }

      const section = problem.sections[sectionIndex];
      const trainrun = section.getTrainrun();
      const displayTime = (formatted: string | undefined, value: number) =>
        formatted ?? value.toString();
      const blocker: TrackConflictBlocker = {
        sectionId: section.getId(),
        trainrunName: `${trainrun.getCategoryShortName()}${trainrun.getTitle()}`,
        fromNodeName: section.getSourceNode().getBetriebspunktName(),
        toNodeName: section.getTargetNode().getBetriebspunktName(),
        times: {
          forwardDeparture: {
            display: displayTime(
              section.getSourceDepartureFormattedDisplayText(),
              section.getSourceDeparture(),
            ),
            locked: section.getSourceDepartureLock(),
          },
          forwardArrival: {
            display: displayTime(
              section.getTargetArrivalFormattedDisplayText(),
              section.getTargetArrival(),
            ),
            locked: section.getTargetArrivalLock(),
          },
          forwardTravelTime: {
            display: displayTime(
              section.getTravelTimeFormattedDisplayText(),
              section.getTravelTime(),
            ),
            locked: section.getTravelTimeLock(),
          },
          backwardDeparture: {
            display: displayTime(
              section.getTargetDepartureFormattedDisplayText(),
              section.getTargetDeparture(),
            ),
            locked: section.getTargetDepartureLock(),
          },
          backwardArrival: {
            display: displayTime(
              section.getSourceArrivalFormattedDisplayText(),
              section.getSourceArrival(),
            ),
            locked: section.getSourceArrivalLock(),
          },
          backwardTravelTime: {
            display: displayTime(
              section.getBackwardTravelTimeFormattedDisplayText(),
              section.getBackwardTravelTime(),
            ),
            locked: section.getBackwardTravelTimeLock(),
          },
        },
        reasons: [],
      };
      blockingSections.set(sectionIndex, blocker);
      return blocker;
    };
    const addReason = (sectionIndex: number, reason: TrackConflictBlocker["reasons"][number]) => {
      const reasons = getBlockingSection(sectionIndex).reasons;
      if (!reasons.includes(reason)) {
        reasons.push(reason);
      }
    };
    const variableIndices = problem.varEdges.flatMap((edges, variableIndex) =>
      edges.includes(edgeIndex) ? [variableIndex] : [],
    );
    const chainIndices = new Set(
      variableIndices.flatMap((variableIndex) => problem.variables[variableIndex].chains),
    );

    chainIndices.forEach((chainIndex) => {
      const chain = problem.chains[chainIndex];
      chain.steps.forEach((step) => {
        const section = problem.sections[step.sectionIdx];
        if (
          chain.fixed &&
          (section.getSourceDepartureLock() ||
            section.getSourceArrivalLock() ||
            section.getTargetDepartureLock() ||
            section.getTargetArrivalLock())
        ) {
          getBlockingSection(step.sectionIdx);
        }
        if (chain.fixed && isOutsideScope(section)) {
          addReason(step.sectionIdx, "selection-boundary");
        }
      });
    });

    variableIndices.forEach((variableIndex) => {
      const variable = problem.variables[variableIndex];
      const travelTimeSections: {
        sectionIndex: number;
        direction: "forward" | "backward";
      }[] = [];
      problem.sections.forEach((_, sectionIndex) => {
        if (problem.travelTimeVariables[sectionIndex * 2] === variableIndex) {
          travelTimeSections.push({sectionIndex, direction: "forward"});
        }
        if (problem.travelTimeVariables[sectionIndex * 2 + 1] === variableIndex) {
          travelTimeSections.push({sectionIndex, direction: "backward"});
        }
      });

      travelTimeSections.forEach(({sectionIndex, direction}) => {
        const section = problem.sections[sectionIndex];
        const isLocked =
          direction === "forward"
            ? section.getTravelTimeLock()
            : section.getBackwardTravelTimeLock();
        if (isLocked) {
          getBlockingSection(sectionIndex);
        }
      });

      if (variable.travelTimeFixedReason === "scope") {
        travelTimeSections
          .filter(({sectionIndex}) => isOutsideScope(problem.sections[sectionIndex]))
          .forEach(({sectionIndex}) => addReason(sectionIndex, "selection-boundary"));
      }

      if (!variable.fixed && variable.domain <= 0) {
        const blockedSections =
          travelTimeSections.length > 0
            ? travelTimeSections.map(({sectionIndex}) => sectionIndex)
            : (problem.chains[variable.chains[0]]?.steps.map((step) => step.sectionIdx) ?? []);
        blockedSections.forEach((sectionIndex) => addReason(sectionIndex, "no-shift-range"));
      }
    });

    if (blockingSections.size === 0) {
      const sectionIndex =
        problem.chains[[...chainIndices][0]]?.steps[0]?.sectionIdx ??
        problem.edges[edgeIndex].sections[0];
      if (problem.sections[sectionIndex] !== undefined) {
        addReason(sectionIndex, "no-free-variable");
      }
    }

    return [...blockingSections.values()];
  }

  private edgeId(firstNodeId: number, secondNodeId: number): string {
    return firstNodeId < secondNodeId
      ? `${firstNodeId}-${secondNodeId}`
      : `${secondNodeId}-${firstNodeId}`;
  }

  /** Temporarily writes candidate consecutive times into the sections; always restored. */
  private withCandidateConsecutiveTimes<T>(
    problem: OptimizationProblem,
    evaluator: TimetableEvaluator,
    sections: TrainrunSection[],
    action: () => T,
  ): T {
    const indexOf = new Map<number, number>();
    problem.sections.forEach((s, i) => indexOf.set(s.getId(), i));
    const saved = sections.map((s) => [
      s.getSourceDepartureConsecutiveTime(),
      s.getSourceArrivalConsecutiveTime(),
      s.getTargetDepartureConsecutiveTime(),
      s.getTargetArrivalConsecutiveTime(),
    ]);
    try {
      sections.forEach((s) => {
        const i = indexOf.get(s.getId());
        s.setSourceDepartureConsecutiveTime(evaluator.candC[i * 4 + SRC_DEP]);
        s.setSourceArrivalConsecutiveTime(evaluator.candC[i * 4 + SRC_ARR]);
        s.setTargetDepartureConsecutiveTime(evaluator.candC[i * 4 + TGT_DEP]);
        s.setTargetArrivalConsecutiveTime(evaluator.candC[i * 4 + TGT_ARR]);
      });
      return action();
    } finally {
      sections.forEach((s, k) => {
        s.setSourceDepartureConsecutiveTime(saved[k][0]);
        s.setSourceArrivalConsecutiveTime(saved[k][1]);
        s.setTargetDepartureConsecutiveTime(saved[k][2]);
        s.setTargetArrivalConsecutiveTime(saved[k][3]);
      });
    }
  }
}
