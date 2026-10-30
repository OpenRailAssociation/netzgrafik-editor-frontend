import type {CDPSession, Page} from "playwright";
import {settle} from "./gestures.ts";

export type Step = (action: () => Promise<unknown>) => Promise<void>;
export type Env = {page: Page; dataset: unknown};
export type Metrics = Record<string, number>;
// Only `body` is measured. Method syntax keeps scenarios with different contexts assignable.
export type Scenario<T = unknown> = {
  name: string;
  setup?(env: Env): Promise<T>;
  body(env: Env, step: Step, ctx: T): Promise<void>;
};

const CDP_METRICS = {
  taskMs: "TaskDuration",
  scriptMs: "ScriptDuration",
  layoutMs: "LayoutDuration",
  styleMs: "RecalcStyleDuration",
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (x: number) => Math.round(x * 100) / 100;

const cdpMetrics = async (cdp: CDPSession): Promise<Metrics> => {
  const {metrics} = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(
    Object.entries(CDP_METRICS).map(([key, name]) => {
      const metric = metrics.find((m) => m.name === name);
      if (!metric) throw new Error(`CDP metric ${name} not found`);
      return [key, metric.value * 1000];
    }),
  );
};

export const measure = async (env: Env, cdp: CDPSession, scenario: Scenario): Promise<Metrics> => {
  const {page} = env;
  const ctx = await scenario.setup?.(env);
  await settle(page);
  const steps: number[] = [];
  const step: Step = async (action) => {
    const t = performance.now();
    await action();
    await settle(page);
    steps.push(performance.now() - t);
  };
  const before = await cdpMetrics(cdp);
  await scenario.body(env, step, ctx);
  const after = await cdpMetrics(cdp);
  const svgElements = await page.evaluate(
    () => document.querySelectorAll("#graphContainer *").length,
  );
  return {
    stepCount: steps.length,
    totalStepsMs: steps.reduce((a, b) => a + b, 0),
    stepMedianMs: median(steps),
    ...Object.fromEntries(Object.keys(after).map((k) => [k, after[k] - before[k]])),
    svgElements,
  };
};

// Median of each metric, for each scenario, across runs
export const aggregate = (runs: Record<string, Metrics>[]) =>
  Object.fromEntries(
    Object.keys(runs[0]).map((scenario) => [
      scenario,
      Object.fromEntries(
        Object.keys(runs[0][scenario]).map((metric) => [
          metric,
          round(median(runs.map((r) => r[scenario][metric]))),
        ]),
      ),
    ]),
  );
