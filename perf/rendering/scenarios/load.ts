import type {Scenario} from "../lib/types.ts";
import {injectDataset} from "../lib/editor.ts";

// Injects the dataset into the app
export const load: Scenario = {
  name: "load",
  prepare:
    async ({page, dataset}) =>
    (runStep) =>
      runStep(() => injectDataset(page, dataset)),
};
