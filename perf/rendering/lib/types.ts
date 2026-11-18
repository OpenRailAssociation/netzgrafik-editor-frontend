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
 * A network, as exported by the editor. Only the fields read by these scripts are typed.
 */
export type Dataset = {nodes: {positionX: number; positionY: number}[]};

/**
 * What each scenario gets: the browser page, and the dataset to load in it.
 */
export type Env = {page: Page; dataset: Dataset};

/**
 * A collection of metric name / metric value pairs.
 */
export type Metrics = Record<string, number>;

/**
 * A named series of steps, measured as a whole:
 * - `name` identifies the scenario in the final report
 * - `prepare` prepares the page (not measured), then returns the measured part, which runs the
 *   steps one after the other, one `runStep` call each
 * - `warmUp` (true by default) plays the measured part once, unmeasured, before measuring it. The
 *   measured part must then leave the page as it found it
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
  warmUp?: boolean;
  prepare(env: Env): Promise<(runStep: RunStep) => Promise<void>>;
};
