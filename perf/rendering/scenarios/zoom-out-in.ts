import type {Scenario} from "../lib/types.ts";
import {loadDataset} from "../lib/editor.ts";
import {centerGraph, prepareZoom} from "../lib/gestures.ts";

// Zooms out to the minimum, then back in, crossing all level-of-detail thresholds
export const zoomOutIn: Scenario = {
  name: "zoomOutIn",
  prepare: async ({page, dataset}) => {
    await loadDataset(page, dataset);
    await centerGraph(page, dataset);
    const zoomOut = await prepareZoom(page, 100);
    const zoomIn = await prepareZoom(page, -100);
    return async (runStep) => {
      await zoomOut(runStep);
      await zoomIn(runStep);
    };
  },
};
