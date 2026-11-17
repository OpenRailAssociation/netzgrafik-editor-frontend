import {describe, it} from "node:test";
import assert from "node:assert/strict";
import type {Box} from "./types.ts";
import {getMoveStartArea, getBoundingBox} from "./math.ts";

const BOX: Box = {x: 0, y: 0, width: 1000, height: 600};

describe("getBoundingBox", () => {
  it("returns the smallest box containing all points", () => {
    const points = [
      {x: 10, y: -5},
      {x: -20, y: 30},
      {x: 40, y: 0},
    ];
    assert.deepEqual(getBoundingBox(points), {x: -20, y: -5, width: 60, height: 35});
  });
});

describe("getMoveStartArea", () => {
  it("shrinks the area by the move, on the side the move goes to", () => {
    assert.deepEqual(getMoveStartArea(BOX, {x: 400, y: 200}), {
      x: 0,
      y: 0,
      width: 600,
      height: 400,
    });
  });

  it("shifts the area for a move to the left", () => {
    assert.deepEqual(getMoveStartArea(BOX, {x: -300, y: 0}), {
      x: 300,
      y: 0,
      width: 700,
      height: 600,
    });
  });

  it("throws when the move is larger than the box", () => {
    assert.throws(() => getMoveStartArea(BOX, {x: 1000, y: 0}));
  });
});
