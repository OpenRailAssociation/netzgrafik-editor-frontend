import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {aggregate, formatResults, formatTable, getSpread} from "./report.ts";

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

describe("getSpread", () => {
  it("gives (max - min) / median of each metric, in percent, and 0 for a null median", () => {
    const runs = [
      {load: {taskMs: 10, graphElements: 0}},
      {load: {taskMs: 15, graphElements: 0}},
      {load: {taskMs: 20, graphElements: 0}},
    ];
    assert.deepEqual(getSpread(runs), {load: {taskMs: 66.67, graphElements: 0}});
  });
});

describe("formatResults", () => {
  it("shows the median and spread of time metrics, and only the median of the others", () => {
    const results = {load: {taskMs: 141.1, graphElements: 2296}};
    const spread = {load: {taskMs: 13.75, graphElements: 0}};
    assert.deepEqual(formatResults(results, spread), {
      load: {taskMs: "141.1ms (14%)", graphElements: "2296"},
    });
  });
});

describe("formatTable", () => {
  it("aligns the row names to the left, and the cells to the right", () => {
    const rows = {load: {a: "1", bb: "100"}, select: {a: "22", bb: "3"}};
    assert.equal(
      formatTable(rows),
      ["         a   bb", "load     1  100", "select  22    3"].join("\n"),
    );
  });
});
