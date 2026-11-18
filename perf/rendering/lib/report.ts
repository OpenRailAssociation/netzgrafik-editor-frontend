import type {Metrics} from "./types.ts";
import {getMedian} from "./math.ts";

/**
 * Metrics of each scenario, by scenario name.
 */
export type Results = Record<string, Metrics>;

const round = (x: number) => Math.round(x * 100) / 100;

/**
 * Merges the results of several runs into one: each metric of each scenario becomes `merge` of its
 * values across runs, rounded to 2 decimals.
 */
const mergeRuns = (runs: Results[], merge: (xs: number[]) => number): Results =>
  Object.fromEntries(
    Object.keys(runs[0]).map((scenario) => [
      scenario,
      Object.fromEntries(
        Object.keys(runs[0][scenario]).map((metric) => [
          metric,
          round(merge(runs.map((r) => r[scenario][metric]))),
        ]),
      ),
    ]),
  );

/**
 * Median of each metric of each scenario, across runs.
 */
export const aggregate = (runs: Results[]): Results => mergeRuns(runs, getMedian);

/**
 * Spread of each metric of each scenario across runs, in percent of its median: (max - min) / median.
 */
export const getSpread = (runs: Results[]): Results =>
  mergeRuns(runs, (xs) => {
    const median = getMedian(xs);
    return median ? ((Math.max(...xs) - Math.min(...xs)) / median) * 100 : 0;
  });

/**
 * Results to print: each time metric (named `...Ms`) shows its median and its spread, as in
 * "141.1ms (14%)". The other metrics (counts) do not vary, and show their median only.
 */
export const formatResults = (results: Results, spread: Results) =>
  Object.fromEntries(
    Object.entries(results).map(([scenario, metrics]) => [
      scenario,
      Object.fromEntries(
        Object.entries(metrics).map(([metric, value]) => [
          metric,
          metric.endsWith("Ms")
            ? `${value}ms (${Math.round(spread[scenario][metric])}%)`
            : String(value),
        ]),
      ),
    ]),
  );

/**
 * A text table, with one line per row, and one column per key of the rows.
 */
export const formatTable = (rows: Record<string, Record<string, string>>) => {
  const columns = Object.keys(Object.values(rows)[0]);
  const lines = [
    ["", ...columns],
    ...Object.entries(rows).map(([name, row]) => [name, ...columns.map((c) => row[c])]),
  ];
  const widths = lines[0].map((_, i) => Math.max(...lines.map((line) => line[i].length)));
  return lines
    .map((line) =>
      line.map((cell, i) => (i ? cell.padStart(widths[i]) : cell.padEnd(widths[i]))).join("  "),
    )
    .join("\n");
};
