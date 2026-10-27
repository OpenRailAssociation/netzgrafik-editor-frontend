import {Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {
  InfrastructureEstimatorService,
  TrackSegmentEstimate,
} from "../infrastructure/infrastructure-estimator.service";
import {OptimizationProblem, buildProblem} from "./optimize-timetable.chains";
import {TimetableEvaluator} from "./optimize-timetable.evaluator";
import {ArchivedSolution, runSearch} from "./optimize-timetable.search";
import {
  EdgeTrackKpi,
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
} from "./optimize-timetable.model";
import {createDefaultOptimizationPolicy, ObjectiveId} from "./optimization-policy.model";
import {compareSolutions} from "./optimization-solution-comparator";

const DEFAULT_TIME_BUDGET_MS = 1000;
const DEFAULT_CONNECTION_TOLERANCE = 2;
const DEFAULT_OPTIONAL_WINDOW = 5;
const DEFAULT_MAX_PROPOSALS = 4;

interface ProposalPick {
  label: string;
  compare: (a: ArchivedSolution, b: ArchivedSolution) => number;
}

interface NodeTrackMetrics {
  maxTracks: number;
  averageTracks: number;
  turnaroundWaitByTrainrun: Map<number, number>;
}

/**
 * Stateless timetable optimizer (see OPTIMIZE_TIMETABLE.md).
 * Shifts departure/arrival times of chains (sections between two stops) so that
 * no edge needs more tracks than allowed, while all hard Netzgrafik rules hold.
 * The search runs on numbers only; native objects are touched temporarily for the
 * exact track check (always restored) and when a proposal is applied.
 */
@Injectable({
  providedIn: "root",
})
export class OptimizeTimetableService {
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
      options.connectionTolerance ?? DEFAULT_CONNECTION_TOLERANCE,
      options.optionalConnectionWindow ?? DEFAULT_OPTIONAL_WINDOW,
      policy,
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

  optimize(
    nodes: Node[],
    trainrunSections: TrainrunSection[],
    options: OptimizeTimetableOptions,
  ): OptimizeTimetableResult {
    const start = performance.now();
    const maxTracks = Math.max(1, Math.floor(options.maxTracksPerSection));
    const policy = options.policy ?? createDefaultOptimizationPolicy();
    const problem = buildProblem(
      nodes,
      trainrunSections,
      maxTracks,
      options.selectedNodeIds ?? [],
      options.connectionTolerance ?? DEFAULT_CONNECTION_TOLERANCE,
      options.optionalConnectionWindow ?? DEFAULT_OPTIONAL_WINDOW,
      policy,
    );
    const evaluator = new TimetableEvaluator(problem, this.infrastructureEstimatorService);
    const beforeTracks = new Map<number, number>();
    const baselineTrackSegments = new Map<number, TrackSegmentEstimate[]>();
    const baselineEdges = problem.edges.map((edge, edgeIndex) => {
      const segments = this.estimateEdgeTrackSegments(problem, edgeIndex);
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
    const trackPriorities = problem.edges.map((_, edgeIndex) => {
      const segments = baselineTrackSegments.get(edgeIndex) ?? [];
      const sumTracks = segments.reduce((sum, segment) => sum + segment.tracks, 0);
      return segments.length === 0 ? 0 : (maxTracks * sumTracks) / (2 * segments.length);
    });
    const search = runSearch(
      problem,
      evaluator,
      options.startAssignment,
      options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS,
      options.seed ?? 1,
      options.debugTrace ?? false,
      trackPriorities,
    );

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
      optionalConnections: search.initial.parts.optionalConnections,
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
      minimumStopViolationsBefore: search.initial.parts.stopViolations,
      minimumStopViolationsAfter: search.initial.parts.stopViolations,
      totalTravelTimeDelta: 0,
      optionalConnectionsBefore: search.initial.parts.optionalConnections,
      optionalConnectionsAfter: search.initial.parts.optionalConnections,
      sumAbsShift: 0,
      changedTrainruns: 0,
      changedTimes: 0,
    };

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
      baselineKpi,
      baselineEdges,
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
      runtimeMs: 0,
      initialEdgesOverLimit: baselineOverLimit,
    };

    if (freeVariables === 0) {
      result.message = $localize`:@@app.services.optimization.no-free-variables:No times can be shifted (locks, selection or no trainruns).`;
    }

    const picks = this.pickProposals(
      search.archive,
      search.initial,
      options.maxProposals ?? DEFAULT_MAX_PROPOSALS,
    );
    result.solutions = picks.map((pick, id) =>
      this.createSolution(
        id,
        pick.label,
        pick.solution,
        search.initial,
        problem,
        nodes,
        beforeTracks,
        baselineEdges,
        baselineKpi,
        baselineNodeMetrics,
      ),
    );
    result.solutions.sort((first, second) => compareSolutions(first, second, policy));
    result.solutions = result.solutions.filter((solution) => solution.valid);

    if (result.solutions.length === 0 && freeVariables > 0) {
      result.message = $localize`:@@app.services.optimization.no-solution:No better solution found. Restart to continue the search.`;
    }
    result.runtimeMs = Math.round(performance.now() - start);
    if (options.debugTrace) {
      this.logSearchTrace(
        problem,
        baselineTrackSegments,
        search.trace,
        search.omittedTraceEntries,
        result.solutions,
      );
    }
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
      options.connectionTolerance ?? DEFAULT_CONNECTION_TOLERANCE,
      options.optionalConnectionWindow ?? DEFAULT_OPTIONAL_WINDOW,
      policy,
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
      (constraint) =>
        (constraint.id === "userConnections" || constraint.id === "preserveConnectionTimes") &&
        constraint.enabled,
    );
    const minimumStopTimeEnabled = policy.hardConstraints.some(
      (constraint) => constraint.id === "minimumStopTime" && constraint.enabled,
    );
    const maxTravelTimeEnabled = policy.hardConstraints.some(
      (constraint) => constraint.id === "maxTravelTimeExtension" && constraint.enabled,
    );
    const nonTrackViolations =
      (userConnectionsEnabled ? parts.connectionViolations : 0) +
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

    return nonTrackViolations === 0 && (!trackLimitEnabled || !exactOverLimit) && symmetryValid;
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
    solution: OptimizeTimetableSolution,
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
      if (!section.isSymmetric()) {
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

  private pickProposals(
    archive: ArchivedSolution[],
    initial: ArchivedSolution,
    maxProposals: number,
  ): {label: string; solution: ArchivedSolution}[] {
    const isInitial = (s: ArchivedSolution) => s.delta.every((x, k) => x === initial.delta[k]);
    const candidates = archive.filter(
      (s) => !isInitial(s) && s.parts.excess <= initial.parts.excess && s.score < initial.score,
    );
    const picks: ProposalPick[] = [
      {
        label: $localize`:@@app.services.optimization.proposal.balanced:Balanced`,
        compare: (a, b) => a.score - b.score,
      },
      {
        label: $localize`:@@app.services.optimization.proposal.minimal-change:Minimal change`,
        compare: (a, b) =>
          a.parts.excess - b.parts.excess || a.parts.sumAbsShift - b.parts.sumAbsShift,
      },
      {
        label: $localize`:@@app.services.optimization.proposal.connections:Most connections`,
        compare: (a, b) =>
          a.parts.excess - b.parts.excess ||
          b.parts.optionalConnections - a.parts.optionalConnections ||
          a.score - b.score,
      },
      {
        label: $localize`:@@app.services.optimization.proposal.travel-time:Shortest travel time`,
        compare: (a, b) =>
          a.parts.excess - b.parts.excess ||
          a.parts.travelTimeDelta - b.parts.travelTimeDelta ||
          a.score - b.score,
      },
    ];
    const chosen: {label: string; solution: ArchivedSolution}[] = [];
    for (const pick of picks) {
      if (chosen.length >= maxProposals) {
        break;
      }
      const solution = [...candidates]
        .sort(pick.compare)
        .find((s) => !chosen.some((c) => c.solution === s));
      if (solution !== undefined) {
        chosen.push({label: pick.label, solution});
      }
    }
    return chosen;
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
  ): OptimizeTimetableSolution {
    const evaluator = new TimetableEvaluator(problem, this.infrastructureEstimatorService);
    evaluator.delta.set(archived.delta);
    evaluator.evaluateAll();
    const parts = evaluator.parts();
    const nodeMetrics = this.withCandidateConsecutiveTimes(
      problem,
      evaluator,
      problem.sections,
      () => this.estimateNodeTrackMetrics(nodes, problem.sections),
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
      const after = this.withCandidateConsecutiveTimes(problem, evaluator, sections, () =>
        this.estimateEdgeTracks(problem, e),
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
      (constraint) =>
        (constraint.id === "userConnections" || constraint.id === "preserveConnectionTimes") &&
        constraint.enabled,
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
      (userConnectionsEnabled ? parts.connectionViolations : 0) +
      (minimumStopTimeEnabled ? parts.stopViolations : 0) +
      (maxTravelTimeEnabled ? parts.travelTimeExtensionViolation : 0);

    const assignment: Record<string, number> = {};
    problem.variables.forEach((variable, v) => {
      if (!variable.fixed && archived.delta[v] !== 0) {
        assignment[variable.key] = archived.delta[v];
      }
    });

    return {
      id,
      label,
      valid: nonTrackViolations === 0 && (!trackLimitEnabled || overAfter === 0),
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
      moreConnections: evaluator.getOptionalConnectionScore(),
      lowerTravelTime:
        trainrunCount === 0 ? 0 : (travelTimeScore / trainrunCount + 2) / 3,
      lowerTrackUsage: 1 / (1 + normalizedNodeTrackCost),
      lowerEdgeTrackUsage: 1 / (1 + normalizedEdgeTrackCost),
    };
  }

  private estimateNodeTrackMetrics(
    nodes: Node[],
    trainrunSections: TrainrunSection[],
  ): NodeTrackMetrics {
    const trackCounts: number[] = [];
    const turnaroundWaits = new Map<number, Map<string, number>>();
    nodes.forEach((node) => {
      const nodeTracks = this.infrastructureEstimatorService.estimateNodeTracks(
        node,
        trainrunSections,
      );
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
          const occurrences = turnaroundWaits.get(occupancy.trainrunId) ?? new Map<string, number>();
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
    };
  }

  private estimateEdgeTracks(problem: OptimizationProblem, e: number): number {
    const segments = this.estimateEdgeTrackSegments(problem, e);
    return segments.reduce((m, s) => Math.max(m, s.tracks), 0);
  }

  private estimateEdgeTrackSegments(
    problem: OptimizationProblem,
    edgeIndex: number,
  ): TrackSegmentEstimate[] {
    const edge = problem.edges[edgeIndex];
    const sections = edge.sections.map((i) => problem.sections[i]);
    return this.infrastructureEstimatorService.estimateSectionTracks(
      edge.fromNode,
      edge.toNode,
      sections,
    );
  }

  private logSearchTrace(
    problem: OptimizationProblem,
    segmentsByEdge: Map<number, TrackSegmentEstimate[]>,
    trace: ReturnType<typeof runSearch>["trace"],
    omittedTraceEntries: number,
    solutions: OptimizeTimetableSolution[],
  ): void {
    const x = problem.maxTracks;
    const edgeRows = problem.edges
      .map((edge, edgeIndex) => {
        const segments = segmentsByEdge.get(edgeIndex) ?? [];
        const sumSegmentTracks = segments.reduce((sum, segment) => sum + segment.tracks, 0);
        const conflictValue =
          segments.length === 0 ? 0 : (problem.maxTracks * sumSegmentTracks) / (2 * segments.length);
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
    const conflictRows = edgeRows.filter(
      (row) => row.scoreKonflikt || row.harteGleisverletzung,
    );
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
        variableDomains: variables.map((variable) => `${variable.key}: ±${variable.domain}`).join("; "),
        grund: movable ? "frei" : reasons.join("; ") || "fixiert",
      };
    });
    const finalRows = solutions.map((solution) => ({
      vorschlag: solution.label,
      gueltig: solution.valid,
      geaenderteZuege: [...new Set(solution.changes.map((change) => change.trainrunName))].join(", "),
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
      console.info(`${omittedTraceEntries} weitere Suchschritte wegen des Trace-Limits ausgelassen.`);
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
        const trainrunName = `${chain.trainrun.getCategoryShortName()} ${chain.trainrun.getTitle()}`.trim();
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
