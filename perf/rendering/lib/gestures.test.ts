import {describe, it} from "node:test";
import assert from "node:assert/strict";
import type {Page} from "playwright";
import type {Box, Vector} from "./types.ts";
import {centerGraph, panBy, prepareZoom} from "./gestures.ts";

const BOX: Box = {x: 0, y: 0, width: 1000, height: 600};

/**
 * A fake Playwright page, to test the gestures without a browser or the app running.
 * Gestures read the page, then move the mouse: this page gives simple, fixed answers to the reads,
 * and records the mouse calls, so that tests can check them.
 */
const fakePage = () => {
  const calls: unknown[][] = [];
  const page = {
    mouse: {
      move: async (...args: unknown[]) => {
        calls.push(["move", ...args]);
      },
      down: async () => {
        calls.push(["down"]);
      },
      up: async () => {
        calls.push(["up"]);
      },
      wheel: async (...args: unknown[]) => {
        calls.push(["wheel", ...args]);
      },
    },
    /**
     * `evaluate` can't run the browser code, so it answers based on its argument:
     * - an area (getBackgroundPoint): a point 10px inside its top left corner
     * - a point (getScreenCoordinates): the same point, as if graph and screen coordinates were
     *   equal
     * - nothing else (getContainerBox, waitForRender): BOX
     */
    evaluate: async (_fn: unknown, arg?: {area?: Box; p?: Vector}) => {
      if (arg?.area) return {x: arg.area.x + 10, y: arg.area.y + 10};
      return arg?.p ?? BOX;
    },
  };
  return {page: page as unknown as Page, calls};
};

describe("panBy", () => {
  it("does nothing for a null move", async () => {
    const {page, calls} = fakePage();
    await panBy(page, {x: 0, y: 0});
    assert.deepEqual(calls, []);
  });

  it("splits a long move into equal drags, each fitting in half of the container", async () => {
    const {page, calls} = fakePage();
    // 1200px > 2 * 500px: 3 drags of 400px
    await panBy(page, {x: 1200, y: 0});
    const drag = [
      ["move", 10, 10],
      ["down"],
      ["move", 13, 10],
      ["move", 10, 10],
      ["move", 410, 10, {steps: 10}],
      ["up"],
    ];
    assert.deepEqual(calls, [...drag, ...drag, ...drag]);
  });

  it("starts where the move ends inside the container", async () => {
    const {page, calls} = fakePage();
    // Fits in one drag, starting at least 300px from the left edge
    await panBy(page, {x: -300, y: 200});
    assert.deepEqual(calls, [
      ["move", 310, 10],
      ["down"],
      ["move", 313, 10],
      ["move", 310, 10],
      ["move", 10, 210, {steps: 10}],
      ["up"],
    ]);
  });
});

describe("centerGraph", () => {
  it("pans the center of the dataset nodes to the middle of the container", async () => {
    const {page, calls} = fakePage();
    const dataset = {
      nodes: [
        {positionX: 100, positionY: 100},
        {positionX: 300, positionY: 200},
      ],
    };
    // From (200, 150) to (500, 300): one drag by (300, 150)
    await centerGraph(page, dataset);
    assert.deepEqual(calls, [
      ["move", 10, 10],
      ["down"],
      ["move", 13, 10],
      ["move", 10, 10],
      ["move", 310, 160, {steps: 10}],
      ["up"],
    ]);
  });
});

describe("prepareZoom", () => {
  it("moves the mouse to the middle of the container while preparing", async () => {
    const {page, calls} = fakePage();
    await prepareZoom(page, 100);
    assert.deepEqual(calls, [["move", 500, 300]]);
  });

  it("scrolls 9 times, one step per wheel move", async () => {
    const {page, calls} = fakePage();
    const run = await prepareZoom(page, -100);
    calls.length = 0;
    let steps = 0;
    await run(async (action) => {
      steps++;
      await action();
    });
    assert.deepEqual({steps, calls}, {steps: 9, calls: Array(9).fill(["wheel", 0, -100])});
  });
});
