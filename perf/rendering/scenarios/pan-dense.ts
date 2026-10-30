import type {Scenario} from "../lib/measure.ts";
import {loadDataset} from "../lib/app.ts";
import {backgroundPoint, centerGraph, panBackAndForth, type Point} from "../lib/gestures.ts";

// Pans over the center of the graph, at 100% zoom
export const panDense: Scenario<Point> = {
  name: "panDense",
  setup: async ({page, dataset}) => {
    await loadDataset(page, dataset);
    await centerGraph(page);
    return backgroundPoint(page);
  },
  body: ({page}, step, from) => panBackAndForth(page, step, from),
};
