// Benchmarks the port-ordering optimizer's quality: for each dataset and each weight setup, it
// compares the clutter of the optimized solution against the alphabetical baseline (default order),
// scored under the same weights.

import {DataService} from "../app/services/data/data.service";
import {NodeService} from "../app/services/data/node.service";
import {ResourceService} from "../app/services/data/resource.service";
import {TrainrunService} from "../app/services/data/trainrun.service";
import {TrainrunSectionService} from "../app/services/data/trainrunsection.service";
import {BaseDataService} from "../app/services/data/basedata.service";
import {NoteService} from "../app/services/data/note.service";
import {LogService} from "../app/logger/log.service";
import {LogPublishersService} from "../app/logger/log.publishers.service";
import {LabelGroupService} from "../app/services/data/labelgroup.service";
import {LabelService} from "../app/services/data/label.service";
import {FilterService} from "../app/services/ui/filter.service";
import {NetzgrafikColoringService} from "../app/services/data/netzgrafikColoring.service";

import {OrderingAlgorithm} from "../app/data-structures/technical.data.structures";
import {ClutterWeights, optimizePorts} from "../app/services/util/port-ordering.algo";
import {
  countAllCrossings,
  countCrossingsInNode,
} from "../app/services/util/port-ordering.crossings";
import {countAllSeparations} from "../app/services/util/port-ordering.separations";
import {Node} from "../app/models/node.model";

import demoStandaloneGithub from "../app/sample-netzgrafik/netzgrafik_demo_standalone_github.json";
import demoOlLz from "../app/sample-netzgrafik/Demo_OL_LZ.json";

const DATASETS: {name: string; dto: unknown}[] = [
  {name: "demo_standalone_github", dto: demoStandaloneGithub},
  {name: "Demo_OL_LZ", dto: demoOlLz},
];

// Weight setups to compare, each steering the optimizer toward a different clutter trade-off:
const SETUPS: {name: string; weights: ClutterWeights}[] = [
  {
    name: "balanced",
    weights: {
      crossingsWithin: 1,
      crossingsBetween: 1,
      separationsWithin: 1,
      separationsBetween: 1,
    },
  },
  {
    name: "crossings-first",
    weights: {
      crossingsWithin: 1,
      crossingsBetween: 1,
      separationsWithin: 0.2,
      separationsBetween: 0.2,
    },
  },
  {
    name: "separations-first",
    weights: {
      crossingsWithin: 0.2,
      crossingsBetween: 0.2,
      separationsWithin: 1,
      separationsBetween: 1,
    },
  },
  {
    name: "within-first",
    weights: {
      crossingsWithin: 1,
      crossingsBetween: 0.2,
      separationsWithin: 1,
      separationsBetween: 0.2,
    },
  },
  {
    name: "between-first",
    weights: {
      crossingsWithin: 0.2,
      crossingsBetween: 1,
      separationsWithin: 0.2,
      separationsBetween: 1,
    },
  },
];

type Clutter = {
  crossingsWithin: number;
  crossingsBetween: number;
  separationsWithin: number;
  separationsBetween: number;
};

const measureClutter = (nodes: Node[]): Clutter => {
  const crossingsWithin = nodes.reduce((sum, node) => sum + countCrossingsInNode(node), 0);
  const {within: separationsWithin, between: separationsBetween} = countAllSeparations(nodes);
  return {
    crossingsWithin,
    crossingsBetween: countAllCrossings(nodes).crossings - crossingsWithin,
    separationsWithin,
    separationsBetween,
  };
};

const scoreClutter = (c: Clutter, w: ClutterWeights): number =>
  c.crossingsWithin * w.crossingsWithin +
  c.crossingsBetween * w.crossingsBetween +
  c.separationsWithin * w.separationsWithin +
  c.separationsBetween * w.separationsBetween;

// Renders rows as an aligned text table, each column padded to its widest cell (header included):
const formatTable = <T>(
  columns: {header: string; value: (row: T) => string}[],
  rows: T[],
): string => {
  const widths = columns.map((col) =>
    Math.max(col.header.length, ...rows.map((row) => col.value(row).length)),
  );
  const renderCells = (cells: string[]) =>
    cells.map((cell, i) => cell.padStart(widths[i])).join("  ");
  return [
    renderCells(columns.map((col) => col.header)),
    ...rows.map((row) => renderCells(columns.map((col) => col.value(row)))),
  ].join("\n");
};

type BenchmarkRow = {setup: string; alphaScore: number; optScore: number; optimized: Clutter};

const createServices = (): {dataService: DataService; nodeService: NodeService} => {
  const logService = new LogService(new LogPublishersService());
  const labelGroupService = new LabelGroupService(logService);
  const labelService = new LabelService(logService, labelGroupService);
  const filterService = new FilterService(labelService, labelGroupService);
  const trainrunService = new TrainrunService(logService, labelService, filterService);
  const trainrunSectionService = new TrainrunSectionService(
    logService,
    trainrunService,
    filterService,
  );
  const nodeService = new NodeService(
    logService,
    new ResourceService(),
    trainrunService,
    trainrunSectionService,
    labelService,
    filterService,
  );
  const dataService = new DataService(
    new ResourceService(),
    nodeService,
    trainrunSectionService,
    trainrunService,
    new BaseDataService(),
    new NoteService(logService, labelService, filterService),
    labelService,
    labelGroupService,
    filterService,
    new NetzgrafikColoringService(logService),
  );
  return {dataService, nodeService};
};

// Loads the dataset and applies the alphabetical (default) ordering, returning the node store:
const loadAlphabetical = (
  dataService: DataService,
  nodeService: NodeService,
  dto: unknown,
): Node[] => {
  dataService.loadNetzgrafikDto(structuredClone(dto) as any);
  nodeService.initPortOrdering(OrderingAlgorithm.Alphabetical);
  return nodeService.nodesStore.nodes;
};

describe("port-ordering benchmark", () => {
  it("scores the optimizer against the alphabetical baseline across datasets and weight setups", async () => {
    for (const {name, dto} of DATASETS) {
      const {dataService, nodeService} = createServices();

      // Alphabetical baseline clutter (same order for every setup, only the weighting differs):
      const baseline = measureClutter(loadAlphabetical(dataService, nodeService, dto));
      const trainruns = (dto as {trainruns?: unknown[]}).trainruns?.length ?? 0;
      const nodeCount = nodeService.nodesStore.nodes.length;

      const rows: BenchmarkRow[] = [];
      for (const setup of SETUPS) {
        // Re-optimize from a fresh alphabetical order for each setup:
        const nodes = loadAlphabetical(dataService, nodeService, dto);
        optimizePorts(nodes, setup.weights);
        const optimized = measureClutter(nodes);

        rows.push({
          setup: setup.name,
          alphaScore: scoreClutter(baseline, setup.weights),
          optScore: scoreClutter(optimized, setup.weights),
          optimized,
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const table = formatTable<BenchmarkRow>(
        [
          {header: "setup", value: (r) => r.setup},
          {header: "Alpha order", value: (r) => r.alphaScore.toFixed(1)},
          {header: "Resolved order", value: (r) => r.optScore.toFixed(1)},
          {header: "cW/cB/sW/sB", value: ({optimized: o}) => `${o.crossingsWithin}/${o.crossingsBetween}/${o.separationsWithin}/${o.separationsBetween}`}, // prettier-ignore
        ],
        rows,
      );

      console.log(
        `\ndataset: ${name} (${nodeCount} nodes, ${trainruns} trainruns)\n` +
          `alphabetical baseline: crossings ${baseline.crossingsWithin}w/${baseline.crossingsBetween}b, separations ${baseline.separationsWithin}w/${baseline.separationsBetween}b\n\n` +
          table,
      );
    }
  }, 600000);
});
