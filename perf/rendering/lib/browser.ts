import type {Page} from "playwright";
import type {RunStep} from "./types.ts";

export const VIEWPORT = {width: 1600, height: 1000};

/**
 * Resolves once the next frame is rendered.
 * Since a rAF callback runs before its frame renders, we have to call rAF once more, to make sure
 * we reach the frame after the render:
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
 */
export const waitForRender = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

/**
 * Creates a RunStep for the page.
 */
export const createRunStep =
  (page: Page): RunStep =>
  async (action) => {
    await action();
    await waitForRender(page);
  };
