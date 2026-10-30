import type {Scenario} from "../lib/measure.ts";
import {loadDataset} from "../lib/app.ts";
import {centerGraph, zoom} from "../lib/gestures.ts";

// Zooms out to the minimum, then back in, crossing all level-of-detail thresholds
export const zoomOutIn: Scenario = {
  name: "zoomOutIn",
  setup: async ({page, dataset}) => {
    await loadDataset(page, dataset);
    await centerGraph(page);
  },
  body: async ({page}, step) => {
    await zoom(page, 100, step);
    await zoom(page, -100, step);
  },
};
