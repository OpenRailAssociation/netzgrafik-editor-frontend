import type {Scenario} from "../lib/types.ts";
import {loadDataset} from "../lib/editor.ts";
import {centerGraph, preparePanBackAndForth} from "../lib/gestures.ts";

// Pans over the center of the graph, at 100% zoom
export const panDense: Scenario = {
  name: "panDense",
  prepare: async ({page, dataset}) => {
    await loadDataset(page, dataset);
    await centerGraph(page, dataset);
    return preparePanBackAndForth(page);
  },
};
