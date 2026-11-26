import type {Page} from "playwright";
import type {Box, Dataset, Vector} from "./types.ts";
import {waitForRender} from "./browser.ts";
import {getBoundingBox} from "./math.ts";

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
 * The rectangle of the graph container. The editor ignores mouse events outside of it.
 */
export const getContainerBox = (page: Page): Promise<Box> =>
  page.evaluate((container) => {
    const element = document.querySelector(container);
    if (!element) throw new Error("Graph container not found");
    const {x, y, width, height} = element.getBoundingClientRect();
    return {x, y, width, height};
  }, CONTAINER);

/**
 * Box of the dataset nodes, in graph coordinates. The DOM can't be used, since it only has the
 * nodes in the viewport.
 */
export const getGraphBox = (dataset: Dataset): Box =>
  getBoundingBox(dataset.nodes.map((n) => ({x: n.positionX, y: n.positionY})));

/**
 * Converts a point from graph to screen coordinates.
 */
export const getScreenCoordinates = (page: Page, p: Vector): Promise<Vector> =>
  page.evaluate(
    ({container, p}) => {
      const svg = document.querySelector<SVGSVGElement>(container);
      if (!svg) throw new Error("Graph container not found");
      // getScreenCTM() converts graph coordinates (the SVG viewBox) to screen coordinates:
      // matrixTransform applies it to the point
      const {x, y} = new DOMPoint(p.x, p.y).matrixTransform(svg.getScreenCTM());
      return {x, y};
    },
    {container: CONTAINER, p},
  );

/**
 * A point of `area` (by default, the middle of the container) where nothing is drawn, to start a
 * drag that pans the view (instead of moving a node, for instance).
 */
export const getBackgroundPoint = (page: Page, area?: Box): Promise<Vector> =>
  page.evaluate(
    ({container, area}) => {
      const element = document.querySelector(container);
      if (!element) throw new Error("Graph container not found");
      const r = element.getBoundingClientRect();
      const {
        x: left,
        y: top,
        width,
        height,
      } = area ?? {
        x: r.x + r.width * 0.2,
        y: r.y + r.height * 0.2,
        width: r.width * 0.6,
        height: r.height * 0.6,
      };
      // Scans the area, every 10px, for a point where the background is on top
      for (let y = top; y < top + height; y += 10) {
        for (let x = left; x < left + width; x += 10) {
          if (document.elementFromPoint(x, y) === element) return {x, y};
        }
      }
      throw new Error("No empty background point found");
    },
    {container: CONTAINER, area},
  );

/**
 * A point of the container where a click hits a trainrun section.
 */
export const getVisibleSectionPoint = (page: Page): Promise<Vector> =>
  page.evaluate((container) => {
    const element = document.querySelector(container);
    if (!element) throw new Error("Graph container not found");
    const c = element.getBoundingClientRect();
    for (const path of element.querySelectorAll("path.edge_line")) {
      const r = path.getBoundingClientRect();
      const p = {x: r.x + r.width / 2, y: r.y + r.height / 2};
      const inside = p.x > c.left && p.y > c.top && p.x < c.right && p.y < c.bottom;
      // The section must be on top at that point: not hidden by another element
      if (inside && document.elementFromPoint(p.x, p.y) === path) return p;
    }
    throw new Error("No visible trainrun section found");
  }, CONTAINER);

/**
 * Number of DOM elements in the graph: shows how much is drawn.
 */
export const getGraphElementCount = (page: Page) =>
  page.evaluate((container) => document.querySelectorAll(`${container} *`).length, CONTAINER);
