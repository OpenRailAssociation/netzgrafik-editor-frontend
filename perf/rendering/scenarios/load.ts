import type {Scenario} from "../lib/measure.ts";
import {injectDataset} from "../lib/app.ts";

// Injects the dataset into the app
export const load: Scenario = {
  name: "load",
  body: ({page, dataset}, step) => step(() => injectDataset(page, dataset)),
};
