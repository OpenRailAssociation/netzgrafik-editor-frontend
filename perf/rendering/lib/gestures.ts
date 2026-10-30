import type {Page} from "playwright";
import type {Step} from "./measure.ts";

export type Point = {x: number; y: number};

export const VIEWPORT = {width: 1600, height: 1000};
export const CENTER = {x: VIEWPORT.width / 2, y: VIEWPORT.height / 2};
const PAN_STEPS = 30;
const PAN_STEP_PX = 15;
// Each wheel step is ±10%, clamped at 10%: 9 steps go exactly from 100% to the minimum and back
const ZOOM_STEPS = 9;

// Resolves once the next frame is rendered
export const settle = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

const graphCenter = (page: Page): Promise<Point> =>
  page.evaluate(() => {
    const g = document.querySelector("#graphContainer > g");
    if (!g) throw new Error("Graph not found");
    const r = g.getBoundingClientRect();
    return {x: r.x + r.width / 2, y: r.y + r.height / 2};
  });

export const backgroundPoint = (page: Page): Promise<Point> =>
  page.evaluate(({width, height}) => {
    for (let y = height * 0.2; y < height * 0.8; y += 10) {
      for (let x = width * 0.2; x < width * 0.8; x += 10) {
        if (document.elementFromPoint(x, y)?.id === "graphContainer") return {x, y};
      }
    }
    throw new Error("No empty background point found");
  }, VIEWPORT);

export const visibleSectionPoint = (page: Page): Promise<Point> =>
  page.evaluate(({width, height}) => {
    for (const path of document.querySelectorAll("path.edge_line")) {
      const r = path.getBoundingClientRect();
      const p = {x: r.x + r.width / 2, y: r.y + r.height / 2};
      const inside = p.x > 0 && p.y > 0 && p.x < width && p.y < height;
      if (inside && document.elementFromPoint(p.x, p.y)?.matches("path.edge_line")) return p;
    }
    throw new Error("No visible trainrun section found");
  }, VIEWPORT);

// Drags the background by (dx, dy), in several moves to stay inside the viewport
export const panBy = async (page: Page, dx: number, dy: number) => {
  while (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
    const from = await backgroundPoint(page);
    const mx = Math.max(10 - from.x, Math.min(VIEWPORT.width - 10 - from.x, dx));
    const my = Math.max(10 - from.y, Math.min(VIEWPORT.height - 10 - from.y, dy));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + mx, from.y + my, {steps: 10});
    await page.mouse.up();
    await settle(page);
    dx -= mx;
    dy -= my;
  }
};

export const centerGraph = async (page: Page) => {
  const c = await graphCenter(page);
  await panBy(page, CENTER.x - c.x, CENTER.y - c.y);
};

// Positive deltaY zooms out, negative zooms in
export const zoom = async (
  page: Page,
  deltaY: number,
  step: Step = async (action) => {
    await action();
    await settle(page);
  },
) => {
  await page.mouse.move(CENTER.x, CENTER.y);
  for (let i = 0; i < ZOOM_STEPS; i++) await step(() => page.mouse.wheel(0, deltaY));
};

export const panBackAndForth = async (page: Page, step: Step, from: Point) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const xs = [
    ...Array.from({length: PAN_STEPS}, (_, i) => from.x + PAN_STEP_PX * (i + 1)),
    ...Array.from({length: PAN_STEPS}, (_, i) => from.x + PAN_STEP_PX * (PAN_STEPS - i - 1)),
  ];
  for (const x of xs) await step(() => page.mouse.move(x, from.y));
  await page.mouse.up();
};
