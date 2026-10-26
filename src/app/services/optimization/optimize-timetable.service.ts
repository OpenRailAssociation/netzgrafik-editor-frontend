import {Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {InfrastructureEstimatorService} from "../infrastructure/infrastructure-estimator.service";
import {OptimizationProblem, buildProblem} from "./optimize-timetable.chains";
import {TimetableEvaluator} from "./optimize-timetable.evaluator";
import {ArchivedSolution, runSearch} from "./optimize-timetable.search";
import {
  EdgeTrackKpi,
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

const DEFAULT_TIME_BUDGET_MS = 250;
const DEFAULT_CONNECTION_TOLERANCE = 2;
const DEFAULT_OPTIONAL_WINDOW = 5;
const DEFAULT_MAX_PROPOSALS = 4;

interface ProposalPick {
  label: string;
  compare: (a: ArchivedSolution, b: ArchivedSolution) => number;
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

  optimize(
    nodes: Node[],
    trainrunSections: TrainrunSection[],
    options: OptimizeTimetableOptions,
  ): OptimizeTimetableResult {
    const start = performance.now();
    const maxTracks = Math.max(1, Math.floor(options.maxTracksPerSection));
    const problem = buildProblem(
      nodes,
      trainrunSections,
      maxTracks,
      options.selectedNodeIds ?? [],
      options.connectionTolerance ?? DEFAULT_CONNECTION_TOLERANCE,
      options.optionalConnectionWindow ?? DEFAULT_OPTIONAL_WINDOW,
    );
    const evaluator = new TimetableEvaluator(problem);
    const search = runSearch(
      problem,
      evaluator,
      options.startAssignment,
      options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS,
      options.seed ?? 1,
    );

    const freeVariables = problem.variables.filter((v) => !v.fixed && v.domain > 0).length;
    const fixedChains = problem.chains.filter((c) => c.fixed).length;
    const result: OptimizeTimetableResult = {
      solutions: [],
      freeVariables,
      fixedChains,
      iterations: search.iterations,
      runtimeMs: 0,
      initialEdgesOverLimit: search.initial.parts.edgesOverLimit,
    };

    if (freeVariables === 0) {
      result.message = $localize`:@@app.services.optimization.no-free-variables:No times can be shifted (locks, selection or no trainruns).`;
    }

    const picks = this.pickProposals(
      search.archive,
      search.initial,
      options.maxProposals ?? DEFAULT_MAX_PROPOSALS,
    );
    const beforeTracks = new Map<number, number>();
    result.solutions = picks.map((pick, id) =>
      this.createSolution(id, pick.label, pick.solution, search.initial, problem, beforeTracks),
    );

    if (result.solutions.length === 0 && freeVariables > 0) {
      result.message = $localize`:@@app.services.optimization.no-solution:No better solution found. Restart to continue the search.`;
    }
    result.runtimeMs = Math.round(performance.now() - start);
    return result;
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
    beforeTracks: Map<number, number>,
  ): OptimizeTimetableSolution {
    const evaluator = new TimetableEvaluator(problem);
    evaluator.delta.set(archived.delta);
    evaluator.evaluateAll();
    const parts = evaluator.parts();

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
    let overBefore = initial.parts.edgesOverLimit;
    let overAfter = initial.parts.edgesOverLimit;
    changedEdges.forEach((e) => {
      const edge = problem.edges[e];
      const sections = edge.sections.map((i) => problem.sections[i]);
      if (!beforeTracks.has(e)) {
        beforeTracks.set(e, this.estimateEdgeTracks(problem, e));
      }
      const before = beforeTracks.get(e);
      const after = this.withCandidateConsecutiveTimes(problem, evaluator, sections, () =>
        this.estimateEdgeTracks(problem, e),
      );
      const surrogateInitiallyOver = this.surrogateInitiallyOver(problem, initial, e);
      overBefore += (before > problem.maxTracks ? 1 : 0) - surrogateInitiallyOver;
      overAfter += (after > problem.maxTracks ? 1 : 0) - surrogateInitiallyOver;
      edges.push({
        fromNodeName: edge.fromNode.getBetriebspunktName(),
        toNodeName: edge.toNode.getBetriebspunktName(),
        tracksBefore: before,
        tracksAfter: after,
      });
    });
    edges.sort((a, b) => b.tracksAfter - a.tracksAfter || b.tracksBefore - a.tracksBefore);

    const assignment: Record<string, number> = {};
    problem.variables.forEach((variable, v) => {
      if (!variable.fixed && archived.delta[v] !== 0) {
        assignment[variable.key] = archived.delta[v];
      }
    });

    return {
      id,
      label,
      kpi: {
        edgesOverLimitBefore: Math.max(0, overBefore),
        edgesOverLimitAfter: Math.max(0, overAfter),
        maxTracksBefore: edges.reduce((m, e) => Math.max(m, e.tracksBefore), 0),
        maxTracksAfter: edges.reduce((m, e) => Math.max(m, e.tracksAfter), 0),
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

  private surrogateInitiallyOver(
    problem: OptimizationProblem,
    initial: ArchivedSolution,
    e: number,
  ): number {
    const evaluator = new TimetableEvaluator(problem);
    evaluator.delta.set(initial.delta);
    return evaluator.computeEdgeTracks(e) > problem.maxTracks ? 1 : 0;
  }

  private estimateEdgeTracks(problem: OptimizationProblem, e: number): number {
    const edge = problem.edges[e];
    const sections = edge.sections.map((i) => problem.sections[i]);
    const segments = this.infrastructureEstimatorService.estimateSectionTracks(
      edge.fromNode,
      edge.toNode,
      sections,
    );
    return segments.reduce((m, s) => Math.max(m, s.tracks), 0);
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
