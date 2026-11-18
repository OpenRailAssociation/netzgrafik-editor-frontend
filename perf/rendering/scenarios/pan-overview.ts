import type {Scenario} from "../lib/types.ts";
import {loadDataset} from "../lib/editor.ts";
import {centerGraph, preparePanBackAndForth, prepareZoom} from "../lib/gestures.ts";
import {createRunStep} from "../lib/browser.ts";

// Pans while zoomed out to the minimum, with the whole graph visible
export const panOverview: Scenario = {
  name: "panOverview",
  prepare: async ({page, dataset}) => {
    await loadDataset(page, dataset);
    await centerGraph(page, dataset);
    const zoomOut = await prepareZoom(page, 100);
    await zoomOut(createRunStep(page));
    return preparePanBackAndForth(page);
  },
};
