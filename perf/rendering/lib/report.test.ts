import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {aggregate} from "./report.ts";

describe("aggregate", () => {
  it("keeps the median of each metric of each scenario, across runs", () => {
    const runs = [
      {load: {scriptMs: 10, taskMs: 30}, select: {scriptMs: 1, taskMs: 5}},
      {load: {scriptMs: 50, taskMs: 20}, select: {scriptMs: 2, taskMs: 6}},
      {load: {scriptMs: 20, taskMs: 10}, select: {scriptMs: 9, taskMs: 4}},
    ];
    assert.deepEqual(aggregate(runs), {
      load: {scriptMs: 20, taskMs: 20},
      select: {scriptMs: 2, taskMs: 5},
    });
  });

  it("rounds to 2 decimals", () => {
    assert.deepEqual(aggregate([{load: {taskMs: 1.23456}}]), {load: {taskMs: 1.23}});
  });
});
