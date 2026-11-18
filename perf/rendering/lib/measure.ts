import type {CDPSession} from "playwright";
import type {Env, Metrics, Scenario, RunStep} from "./types.ts";
import {getGraphElementCount} from "./editor.ts";
import {collectGarbage, createRunStep, waitForRender} from "./browser.ts";

// Report key -> Chrome metric name. Chrome gives them in seconds.
const CDP_METRICS = {
  taskMs: "TaskDuration",
  scriptMs: "ScriptDuration",
  layoutMs: "LayoutDuration",
  styleMs: "RecalcStyleDuration",
};

/**
 * Time the browser main thread has spent so far, in total and by kind of work, in milliseconds.
 * These are counters: the time spent during a scenario is the difference between two calls.
 */
const getCDPMetrics = async (cdp: CDPSession): Promise<Metrics> => {
  const {metrics} = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(
    Object.entries(CDP_METRICS).map(([key, name]) => {
      const metric = metrics.find((m) => m.name === name);
      if (!metric) throw new Error(`CDP metric ${name} not found`);
      return [key, metric.value * 1000];
    }),
  );
};

/**
 * Prepares and runs one scenario on a page, and returns its metrics: the main thread times during
 * its measured part, and the size of the graph at the end.
 */
export const measure = async (env: Env, scenario: Scenario): Promise<Metrics> => {
  const {page} = env;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const run = await scenario.prepare(env);
  const runStep = createRunStep(page);
  // Plays the measured part once first, so that the measures do not include the first time costs
  // (such as the JIT compilation)
  if (scenario.warmUp !== false) await run(runStep);
  await collectGarbage(page);
  await waitForRender(page);
  let stepCount = 0;
  const countedRunStep: RunStep = (action) => {
    stepCount++;
    return runStep(action);
  };
  const before = await getCDPMetrics(cdp);
  await run(countedRunStep);
  const after = await getCDPMetrics(cdp);
  const times = Object.fromEntries(Object.keys(after).map((k) => [k, after[k] - before[k]]));
  return {
    stepCount,
    ...times,
    taskPerStepMs: times.taskMs / stepCount,
    graphElements: await getGraphElementCount(page),
  };
};
