import type {Page} from "playwright";

/**
 * A position, or a move, on screen, in pixels.
 */
export type Vector = {x: number; y: number};

/**
 * A rectangle on screen, in pixels: its top left corner, and its size.
 */
export type Box = {x: number; y: number; width: number; height: number};

/**
 * Runs one user action, then waits until the browser has drawn the result.
 */
export type RunStep = (action: () => Promise<unknown>) => Promise<void>;

/**
 * What each scenario gets: the browser page, and the dataset to load in it.
 */
export type Env = {page: Page; dataset: unknown};

/**
 * A collection of metric name / metric value pairs.
 */
export type Metrics = Record<string, number>;

/**
 * A named series of steps, measured as a whole:
 * - `name` identifies the scenario in the final report
 * - `prepare` prepares the page (not measured), then returns the measured part, which runs the
 *   steps one after the other, one `runStep` call each
 *
 * Example, with two steps:
 * ```ts
 * prepare: async ({page, dataset}) => {
 *   await loadDataset(page, dataset);
 *   return async (runStep) => {
 *     await runStep(() => page.mouse.click(10, 10));
 *     await runStep(() => page.mouse.click(20, 20));
 *   };
 * }
 * ```
 */
export type Scenario = {
  name: string;
  prepare(env: Env): Promise<(runStep: RunStep) => Promise<void>>;
};
