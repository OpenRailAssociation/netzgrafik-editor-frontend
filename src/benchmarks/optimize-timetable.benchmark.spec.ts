import {NetzgrafikDto} from "../app/data-structures/business.data.structures";
import demoStandaloneGithub from "../app/sample-netzgrafik/netzgrafik_demo_standalone_github.json";
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

const RUNS = [
  {seed: 1, searchBudgetMs: 1000, variant: "default"},
  {seed: 2, searchBudgetMs: 1000, variant: "default"},
  {seed: 3, searchBudgetMs: 1000, variant: "default"},
  {seed: 1, searchBudgetMs: 1000, variant: "flexibility-frequency-first"},
  {seed: 1, searchBudgetMs: 1000, variant: "flexibility-category-first"},
  {seed: 1, searchBudgetMs: 1000, variant: "without-node-track-objective"},
  {seed: 1, searchBudgetMs: 1000, variant: "without-hard-track-limit"},
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
  it("measures fixed-seed solution quality and end-to-end latency", async () => {
    const rows: {
      seed: number;
      searchBudgetMs: number;
      variant: string;
      runtimeMs: number;
      iterations: number;
      evaluatedCandidates: number;
      validProposals: number;
      bestEdgesOverLimitAfter: number | string;
      initialEdgesOverLimit: number;
      freeVariables: number;
      bestShiftMinutes: number | string;
    }[] = [];

    for (const {seed, searchBudgetMs, variant} of RUNS) {
      const {dataService, nodeService, trainrunSectionService} = createBenchmarkServices();
      dataService.loadNetzgrafikDto(structuredClone(demoStandaloneGithub as NetzgrafikDto));
      const nodes = nodeService.nodesStore.nodes;
      const sections = trainrunSectionService.getTrainrunSections();
      const optimizer = new OptimizeTimetableService(new InfrastructureEstimatorService());
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
      if (variant === "without-hard-track-limit") {
        policy.hardConstraints.find((constraint) => constraint.id === "trackLimit").enabled = false;
      }
      const startedAt = performance.now();
      const result = await optimizer.optimize(nodes, sections, {
        maxTracksPerSection: 2,
        timeBudgetMs: searchBudgetMs,
        seed,
        policy,
      });
      const runtimeMs = performance.now() - startedAt;

      expect(runtimeMs)
        .withContext(`seed ${seed} exceeded the ${END_TO_END_LIMIT_MS} ms end-to-end limit`)
        .toBeLessThanOrEqual(END_TO_END_LIMIT_MS);
      result.solutions.forEach((solution) => {
        expect(solution.valid).toBeTrue();
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
          .toBeTrue();
      });

      rows.push({
        seed,
        searchBudgetMs,
        variant,
        runtimeMs: Math.round(runtimeMs),
        iterations: result.iterations,
        evaluatedCandidates: result.evaluatedCandidates,
        validProposals: result.solutions.length,
        bestEdgesOverLimitAfter:
          result.solutions[0]?.kpi.edgesOverLimitAfter ?? "no valid proposal",
        initialEdgesOverLimit: result.initialEdgesOverLimit,
        freeVariables: result.freeVariables,
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
