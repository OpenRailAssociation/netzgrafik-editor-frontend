import {NetzgrafikDto} from "../app/data-structures/business.data.structures";
import demoStandaloneGithub from "../app/sample-netzgrafik/netzgrafik_demo_standalone_github.json";
import regression from "./optimize-timetable-regression.json";
import {LogPublishersService} from "../app/logger/log.publishers.service";
import {LogService} from "../app/logger/log.service";
import {BaseDataService} from "../app/services/data/basedata.service";
import {DataService} from "../app/services/data/data.service";
import {LabelGroupService} from "../app/services/data/labelgroup.service";
import {LabelService} from "../app/services/data/label.service";
import {NetzgrafikColoringService} from "../app/services/data/netzgrafikColoring.service";
import {NodeService} from "../app/services/data/node.service";
import {NoteService} from "../app/services/data/note.service";
import {ResourceService} from "../app/services/data/resource.service";
import {TrainrunSectionService} from "../app/services/data/trainrunsection.service";
import {TrainrunService} from "../app/services/data/trainrun.service";
import {FilterService} from "../app/services/ui/filter.service";
import {InfrastructureEstimatorService} from "../app/services/infrastructure/infrastructure-estimator.service";
import {OptimizeTimetableService} from "../app/services/optimization/optimize-timetable.service";
import {createDefaultOptimizationPolicy} from "../app/services/optimization/optimization-policy.model";
import {compareSolutions} from "../app/services/optimization/optimization-solution-comparator";

const RUNS = [
  {seed: 1, searchBudgetMs: 1000, variant: "default"},
  {seed: 1, searchBudgetMs: 1000, variant: "cp-sat"},
  {seed: 2, searchBudgetMs: 1000, variant: "default"},
  {seed: 3, searchBudgetMs: 1000, variant: "default"},
  {seed: 1, searchBudgetMs: 1000, variant: "flexibility-frequency-first"},
  {seed: 1, searchBudgetMs: 1000, variant: "flexibility-category-first"},
  {seed: 1, searchBudgetMs: 1000, variant: "without-node-track-objective"},
  {seed: 1, searchBudgetMs: 1000, variant: "without-hard-track-limit"},
  {seed: 1, searchBudgetMs: 1000, variant: "cp-sat-without-hard-track-limit"},
  {seed: 1, searchBudgetMs: 3500, variant: "default"},
];
const END_TO_END_LIMIT_MS = 4000;

function createBenchmarkServices() {
  const logService = new LogService(new LogPublishersService());
  const labelGroupService = new LabelGroupService();
  const labelService = new LabelService(labelGroupService);
  const filterService = new FilterService(labelService, labelGroupService);
  const resourceService = new ResourceService();
  const trainrunService = new TrainrunService(logService, labelService, filterService);
  const trainrunSectionService = new TrainrunSectionService(trainrunService, filterService);
  const nodeService = new NodeService(
    resourceService,
    trainrunService,
    trainrunSectionService,
    labelService,
    filterService,
  );
  const dataService = new DataService(
    resourceService,
    nodeService,
    trainrunSectionService,
    trainrunService,
    new BaseDataService(),
    new NoteService(labelService, filterService),
    labelService,
    labelGroupService,
    filterService,
    new NetzgrafikColoringService(),
  );
  return {dataService, nodeService, trainrunSectionService};
}

describe("timetable optimizer standalone demo benchmark", () => {
  it("compares both engines on the live regression with the current default hard rules", async () => {
    const runs: unknown[] = [];
    for (const engine of ["heuristic", "cp-sat"] as const) {
      const {dataService, nodeService, trainrunSectionService} = createBenchmarkServices();
      dataService.loadNetzgrafikDto(structuredClone(regression as NetzgrafikDto));
      const nodes = nodeService.nodesStore.nodes;
      const sections = trainrunSectionService.getTrainrunSections();
      const before = sections.map((section) => structuredClone(section.getDto()));
      const policy = createDefaultOptimizationPolicy();
      const optimizer = new OptimizeTimetableService(new InfrastructureEstimatorService());
      const startedAt = performance.now();
      const result = await optimizer.optimize(nodes, sections, {
        engine,
        policy,
        maxTracksPerSection: 2,
        timeBudgetMs: 8000,
      });
      expect(result.solutions.some((solution) => solution.valid))
        .withContext(engine)
        .toBeTrue();
      runs.push({
        engine,
        runtimeMs: Math.round(performance.now() - startedAt),
        freeVariables: result.freeVariables,
        iterations: result.iterations,
        evaluatedCandidates: result.evaluatedCandidates,
        searchExhausted: result.searchExhausted,
        baselineOverLimit: result.initialEdgesOverLimit,
        immutable: result.immutableTrackConflicts?.map(
          (edge) => `${edge.fromNodeName} - ${edge.toNodeName}`,
        ),
        solutions: result.solutions.map((solution) => ({
          valid: solution.valid,
          overLimit: solution.kpi.edgesOverLimitAfter,
          stops: solution.kpi.minimumStopViolationsAfter,
          shift: solution.kpi.sumAbsShift,
        })),
        invalid: result.infeasibleSolutions?.map((solution) => ({
          overLimit: solution.kpi.edgesOverLimitAfter,
          stops: solution.kpi.minimumStopViolationsAfter,
          shift: solution.kpi.sumAbsShift,
        })),
      });
      expect(sections.map((section) => section.getDto())).toEqual(before);
    }
    console.warn("Live regression default-rule comparison", JSON.stringify(runs));
  }, 25000);

  it("continues the CP-SAT feasibility warm start when the first budget is insufficient", async () => {
    const {dataService, nodeService, trainrunSectionService} = createBenchmarkServices();
    dataService.loadNetzgrafikDto(structuredClone(regression as NetzgrafikDto));
    const optimizer = new OptimizeTimetableService(new InfrastructureEstimatorService());
    const result = await optimizer.optimize(
      nodeService.nodesStore.nodes,
      trainrunSectionService.getTrainrunSections(),
      {
        engine: "cp-sat",
        policy: createDefaultOptimizationPolicy(),
        maxTracksPerSection: 2,
        timeBudgetMs: 2000,
      },
    );
    const continued = await optimizer.continueSearch(result, 8000);
    expect(continued.solutions.some((solution) => solution.valid)).toBeTrue();
  }, 25000);

  it("finds valid alternatives for the small live regression with the track limit disabled", async () => {
    for (const engine of ["heuristic", "cp-sat"] as const) {
      const {dataService, nodeService, trainrunSectionService} = createBenchmarkServices();
      dataService.loadNetzgrafikDto(structuredClone(regression as NetzgrafikDto));
      const nodes = nodeService.nodesStore.nodes;
      const sections = trainrunSectionService.getTrainrunSections();
      const policy = createDefaultOptimizationPolicy();
      policy.mode = "userDefined";
      policy.hardConstraints.find((rule) => rule.id === "trackLimit").enabled = false;
      const optimizer = new OptimizeTimetableService(new InfrastructureEstimatorService());
      const before = sections.map((section) => structuredClone(section.getDto()));
      const result = await optimizer.optimize(nodes, sections, {
        engine,
        policy,
        maxTracksPerSection: 2,
        timeBudgetMs: 1000,
      });
      expect(result.solutions.some((solution) => solution.valid))
        .withContext(engine)
        .toBeTrue();
      expect(result.solutions.every((solution) => solution.valid))
        .withContext(engine)
        .toBeTrue();
      expect(result.message).toBeUndefined();
      result.solutions.forEach((solution) =>
        expect(
          optimizer.isSolutionValid(
            solution,
            nodes,
            sections,
            {
              policy,
              maxTracksPerSection: 2,
            },
            result.baselineEdges,
          ),
        )
          .withContext(engine)
          .toBeTrue(),
      );
      expect(sections.map((section) => section.getDto())).toEqual(before);
    }
  }, 10000);

  it("measures fixed-seed solution quality and end-to-end latency", async () => {
    const rows: {
      seed: number;
      searchBudgetMs: number;
      variant: string;
      runtimeMs: number;
      searchMs: number;
      iterations: number;
      evaluatedCandidates: number;
      validProposals: number;
      infeasibleProposals: number;
      searchExhausted: boolean;
      bestEdgesOverLimitAfter: number | string;
      initialEdgesOverLimit: number;
      freeVariables: number;
      immutableConflictEdges: string[];
      bestShiftMinutes: number | string;
    }[] = [];

    for (const {seed, searchBudgetMs, variant} of RUNS) {
      const {dataService, nodeService, trainrunSectionService} = createBenchmarkServices();
      dataService.loadNetzgrafikDto(structuredClone(demoStandaloneGithub as NetzgrafikDto));
      const nodes = nodeService.nodesStore.nodes;
      const sections = trainrunSectionService.getTrainrunSections();
      const optimizer = new OptimizeTimetableService(new InfrastructureEstimatorService());
      let searchMs = 0;
      const policy = createDefaultOptimizationPolicy();
      if (variant === "flexibility-frequency-first") {
        policy.directorProfile = "flexibilityFrequencyFirst";
      }
      if (variant === "flexibility-category-first") {
        policy.directorProfile = "flexibilityCategoryFirst";
      }
      if (variant === "without-node-track-objective") {
        policy.mode = "userDefined";
        policy.objectives.find((objective) => objective.id === "lowerTrackUsage").enabled = false;
      }
      if (variant.endsWith("without-hard-track-limit")) {
        policy.hardConstraints.find((constraint) => constraint.id === "trackLimit").enabled = false;
      }
      const startedAt = performance.now();
      const result = await optimizer.optimize(
        nodes,
        sections,
        {
          engine: variant.startsWith("cp-sat") ? "cp-sat" : "heuristic",
          maxTracksPerSection: 2,
          timeBudgetMs: searchBudgetMs,
          seed,
          policy,
        },
        (progress) => (searchMs = progress.elapsedMs),
      );
      const runtimeMs = performance.now() - startedAt;

      expect(runtimeMs)
        .withContext(`seed ${seed} exceeded the ${END_TO_END_LIMIT_MS} ms end-to-end limit`)
        .toBeLessThanOrEqual(END_TO_END_LIMIT_MS);
      if (!result.searchExhausted && result.freeVariables > 0) {
        expect(searchMs)
          .withContext(`${variant} stopped before the configured search deadline`)
          .toBeGreaterThanOrEqual(searchBudgetMs);
      }
      result.solutions.forEach((solution) => {
        expect(
          optimizer.isSolutionValid(
            solution,
            nodes,
            sections,
            {
              maxTracksPerSection: 2,
              timeBudgetMs: searchBudgetMs,
              seed,
              policy,
            },
            result.baselineEdges,
          ),
        )
          .withContext(`seed ${seed} returned a proposal rejected by the independent validator`)
          .toBe(solution.valid);
      });
      expect(result.solutions.length).toBeLessThanOrEqual(5);
      expect(result.infeasibleSolutions?.length).toBeLessThanOrEqual(5);
      expect(result.infeasibleSolutions?.every((solution) => !solution.valid)).toBeTrue();
      if (variant === "without-hard-track-limit") {
        expect(result.solutions.length).toBe(5);
        expect(result.solutions.every((solution) => solution.valid)).toBeTrue();
      }
      if (variant === "cp-sat-without-hard-track-limit") {
        expect(result.solutions.length).toBeGreaterThan(0);
        expect(result.solutions.every((solution) => solution.valid)).toBeTrue();
      }
      if (
        policy.hardConstraints.some(
          (constraint) => constraint.id === "trackLimit" && constraint.enabled,
        )
      ) {
        expect(result.immutableTrackConflicts?.length).toBe(7);
      } else {
        expect(result.immutableTrackConflicts).toEqual([]);
      }
      for (let index = 1; index < result.solutions.length; index++) {
        expect(
          compareSolutions(result.solutions[index - 1], result.solutions[index], policy),
        ).toBeLessThanOrEqual(0);
      }

      rows.push({
        seed,
        searchBudgetMs,
        variant,
        runtimeMs: Math.round(runtimeMs),
        searchMs: Math.round(searchMs),
        iterations: result.iterations,
        evaluatedCandidates: result.evaluatedCandidates,
        validProposals: result.solutions.filter((solution) => solution.valid).length,
        infeasibleProposals: result.solutions.filter((solution) => !solution.valid).length,
        searchExhausted: result.searchExhausted ?? false,
        bestEdgesOverLimitAfter:
          result.solutions[0]?.kpi.edgesOverLimitAfter ?? "no valid proposal",
        initialEdgesOverLimit: result.initialEdgesOverLimit,
        freeVariables: result.freeVariables,
        immutableConflictEdges: (result.immutableTrackConflicts ?? []).map(
          (edge) => `${edge.fromNodeName} - ${edge.toNodeName}`,
        ),
        bestShiftMinutes: result.solutions[0]?.kpi.sumAbsShift ?? "no valid proposal found",
      });
    }

    console.warn(
      "Timetable optimizer benchmark",
      JSON.stringify({
        dataset: "standalone demo",
        nodes: nodesCount(demoStandaloneGithub as NetzgrafikDto),
        trainruns: (demoStandaloneGithub as NetzgrafikDto).trainruns?.length ?? 0,
        sections: (demoStandaloneGithub as NetzgrafikDto).trainrunSections?.length ?? 0,
        searchBudgetsMs: RUNS.map((run) => run.searchBudgetMs),
        endToEndLimitMs: END_TO_END_LIMIT_MS,
        rows,
      }),
    );
  }, 20000);
});

function nodesCount(dto: NetzgrafikDto): number {
  return dto.nodes?.length ?? 0;
}
