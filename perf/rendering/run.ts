// Measures the editor rendering performance on a running app (`npm run start:standalone`).
// Usage: node perf/rendering/run.ts [--runs 5] [--label name] [--dataset file.json] [--url url] [--headed] [--no-save]

import {chromium, type Browser} from "playwright";
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {relative} from "node:path";
import {parseArgs} from "node:util";
import {measure} from "./lib/measure.ts";
import {aggregate, type Results} from "./lib/report.ts";
import {VIEWPORT} from "./lib/browser.ts";
import {openEditor} from "./lib/editor.ts";
import {SCENARIOS} from "./scenarios/index.ts";

const DIR = import.meta.dirname;

const {values: args} = parseArgs({
  options: {
    runs: {type: "string", default: "5"},
    label: {type: "string", default: "run"},
    dataset: {type: "string", default: `${DIR}/datasets/reticulaire.json`},
    url: {type: "string", default: "http://localhost:4200"},
    headed: {type: "boolean", default: false},
    save: {type: "boolean", default: true},
  },
  allowNegative: true,
});
const runs = Number(args.runs);

const getSeconds = (start: number) => `${((performance.now() - start) / 1000).toFixed(1)}s`;

// Runs each scenario once, each one on a fresh page, and logs their durations
const runScenarios = async (browser: Browser, dataset: unknown, run: string) => {
  const results: Results = {};
  for (const scenario of SCENARIOS) {
    const start = performance.now();
    const page = await browser.newPage({viewport: VIEWPORT});
    await openEditor(page, args.url);
    results[scenario.name] = await measure({page, dataset}, scenario);
    await page.close();
    console.log(`${run} - ${scenario.name}: ${getSeconds(start)}`);
  }
  return results;
};

const main = async () => {
  const dataset = JSON.parse(readFileSync(args.dataset, "utf8"));
  const browser = await chromium.launch({headless: !args.headed});
  const all: Results[] = [];

  try {
    for (let i = 0; i < runs; i++) {
      const run = `run ${i + 1}/${runs}`;
      const start = performance.now();
      all.push(await runScenarios(browser, dataset, run));
      console.log(`${run} done in ${getSeconds(start)}`);
    }
  } finally {
    await browser.close();
  }

  const results = aggregate(all);

  // Log results:
  console.table(results);
  if (!args.save) return;

  // Save them in a new file as well:
  const date = new Date().toISOString();
  const report = {label: args.label, date, dataset: relative(DIR, args.dataset), runs, results};
  mkdirSync(`${DIR}/results`, {recursive: true});
  const file = `${DIR}/results/${date.replace(/[:.]/g, "-")}-${args.label}.json`;
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`Saved to ${file}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
