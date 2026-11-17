import type {Page} from "playwright";
import type {Dataset, RunStep, Vector} from "./types.ts";
import {getBackgroundPoint, getContainerBox, getGraphBox, getScreenCoordinates} from "./editor.ts";
import {waitForRender} from "./browser.ts";
import {getBoxCenter, getMoveStartArea} from "./math.ts";

// Each wheel step is +/-10%, clamped at 10%: 9 steps go exactly from 100% to the minimum and back
const ZOOM_STEPS = 9;

/**
 * Presses the mouse on `from`, so that the next mouse moves pan the view.
 */
const startDrag = async (page: Page, from: Vector) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // The editor only starts panning after a 2px move: moving 3px and back starts it, without
  // moving the view
  await page.mouse.move(from.x + 3, from.y);
  await page.mouse.move(from.x, from.y);
};

/**
 * Drags the background from `from` by `v`, so that the view moves by exactly `v`.
 */
const drag = async (page: Page, from: Vector, v: Vector) => {
  await startDrag(page, from);
  await page.mouse.move(from.x + v.x, from.y + v.y, {steps: 10});
  await page.mouse.up();
  await waitForRender(page);
};

/**
 * Moves the view by `v`, by dragging the background. Not measured.
 */
export const panBy = async (page: Page, v: Vector) => {
  const box = await getContainerBox(page);
  // Smallest number of drags so that each one fits in half of the container
  const n = Math.ceil(Math.max(Math.abs(v.x) / (box.width / 2), Math.abs(v.y) / (box.height / 2)));
  if (n === 0) return;
  const part = {x: v.x / n, y: v.y / n};
  for (let i = 0; i < n; i++) {
    const from = await getBackgroundPoint(page, getMoveStartArea(box, part));
    await drag(page, from, part);
  }
};

/**
 * Moves the view so that the graph is in the middle of the container. Not measured.
 */
export const centerGraph = async (page: Page, dataset: Dataset) => {
  const center = getBoxCenter(await getContainerBox(page));
  const graph = await getScreenCoordinates(page, getBoxCenter(getGraphBox(dataset)));
  await panBy(page, {x: center.x - graph.x, y: center.y - graph.y});
};

/**
 * Prepares a zoom around the middle of the container (not measured), and returns it: ZOOM_STEPS
 * wheel steps, each one a step. A positive deltaY zooms out, a negative one zooms in.
 */
export const prepareZoom = async (page: Page, deltaY: number) => {
  const center = getBoxCenter(await getContainerBox(page));
  await page.mouse.move(center.x, center.y);
  return async (runStep: RunStep) => {
    for (let i = 0; i < ZOOM_STEPS; i++) await runStep(() => page.mouse.wheel(0, deltaY));
  };
};
