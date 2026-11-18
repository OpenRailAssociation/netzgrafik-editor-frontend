import type {Page} from "playwright";
import {waitForRender} from "./browser.ts";

// The graph container: the SVG where the editor draws the graph, and listens to the mouse.
// Passed as argument to `page.evaluate`, since its code runs in the browser, without access to
// this file's variables.
const CONTAINER = "#graphContainer";

/**
 * Opens the editor at `url`, waits for the graph to be in the page, then for the next rendered
 * frame.
 */
export const openEditor = async (page: Page, url: string) => {
  await page.goto(url);
  await page.waitForSelector(`${CONTAINER} > g`);
  await waitForRender(page);
};

/**
 * Replaces the network shown in the editor with the given dataset.
 * In standalone mode, <sbb-root> is a custom element: setting its netzgrafikDto input loads the
 * network.
 */
export const injectDataset = (page: Page, dataset: unknown) =>
  page.evaluate(
    (dto) =>
      // Loads the dataset in a setTimeout, so that it runs like regular page code, and counts in
      // scriptMs (Chrome does not count code run directly by `evaluate`)
      new Promise<void>((resolve, reject) =>
        setTimeout(() => {
          try {
            const root = document.querySelector("sbb-root") as unknown as {netzgrafikDto: unknown};
            root.netzgrafikDto = dto;
            resolve();
          } catch (e) {
            reject(e);
          }
        }),
      ),
    dataset,
  );

/**
 * Same as injectDataset, then waits for the next rendered frame.
 */
export const loadDataset = async (page: Page, dataset: unknown) => {
  await injectDataset(page, dataset);
  await waitForRender(page);
};

/**
 * Number of DOM elements in the graph: shows how much is drawn.
 */
export const getGraphElementCount = (page: Page) =>
  page.evaluate((container) => document.querySelectorAll(`${container} *`).length, CONTAINER);
