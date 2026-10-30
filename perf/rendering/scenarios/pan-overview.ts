import type {Scenario} from "../lib/measure.ts";
import {loadDataset} from "../lib/app.ts";
import {backgroundPoint, centerGraph, panBackAndForth, zoom, type Point} from "../lib/gestures.ts";

// Pans while zoomed out to the minimum, with the whole graph visible
export const panOverview: Scenario<Point> = {
  name: "panOverview",
  setup: async ({page, dataset}) => {
    await loadDataset(page, dataset);
    await centerGraph(page);
    await zoom(page, 100);
    return backgroundPoint(page);
  },
  body: ({page}, step, from) => panBackAndForth(page, step, from),
};
