import type {Page} from "playwright";
import type {Dataset, RunStep, Vector} from "./types.ts";
import {getBackgroundPoint, getContainerBox, getGraphBox, getScreenCoordinates} from "./editor.ts";
import {waitForRender} from "./browser.ts";
import {getBoxCenter, getMoveStartArea} from "./math.ts";

const PAN_STEPS = 30;
const PAN_STEP_PX = 15;
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

/**
 * Prepares a pan back and forth (not measured), and returns it: it drags the background PAN_STEPS
 * times PAN_STEP_PX to the right, then back. The mouse is not released, so that the release and its
 * consequences are not measured.
 */
export const preparePanBackAndForth = async (page: Page) => {
  const box = await getContainerBox(page);
  const area = getMoveStartArea(box, {x: PAN_STEPS * PAN_STEP_PX, y: 0});
  const from = await getBackgroundPoint(page, area);
  await startDrag(page, from);
  return async (runStep: RunStep) => {
    const xs = [
      // Going right: from.x + 15, + 30, ..., + 450
      ...Array.from({length: PAN_STEPS}, (_, i) => from.x + PAN_STEP_PX * (i + 1)),
      // Going back: from.x + 435, + 420, ..., + 0
      ...Array.from({length: PAN_STEPS}, (_, i) => from.x + PAN_STEP_PX * (PAN_STEPS - i - 1)),
    ];
    for (const x of xs) await runStep(() => page.mouse.move(x, from.y));
  };
};
