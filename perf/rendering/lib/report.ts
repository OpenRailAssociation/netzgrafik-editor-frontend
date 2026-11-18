import type {Metrics} from "./types.ts";
import {getMedian} from "./math.ts";

/**
 * Metrics of each scenario, by scenario name.
 */
export type Results = Record<string, Metrics>;

const round = (x: number) => Math.round(x * 100) / 100;

/**
 * Merges the results of several runs into one: each metric of each scenario becomes its median
 * across runs, rounded to 2 decimals.
 */
export const aggregate = (runs: Results[]): Results =>
  Object.fromEntries(
    Object.keys(runs[0]).map((scenario) => [
      scenario,
      Object.fromEntries(
        Object.keys(runs[0][scenario]).map((metric) => [
          metric,
          round(getMedian(runs.map((r) => r[scenario][metric]))),
        ]),
      ),
    ]),
  );
