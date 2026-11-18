import type {Scenario} from "../lib/types.ts";
import {injectDataset} from "../lib/editor.ts";

// Injects the dataset into the app. No warm up, since it would load the dataset twice
export const load: Scenario = {
  name: "load",
  warmUp: false,
  prepare:
    async ({page, dataset}) =>
    (runStep) =>
      runStep(() => injectDataset(page, dataset)),
};
