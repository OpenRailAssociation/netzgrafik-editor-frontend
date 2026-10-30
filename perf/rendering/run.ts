// Measures the editor rendering performance on a running app (`npm run start:standalone`).
// Usage: node perf/rendering/run.ts [--runs 5] [--label name] [--dataset file.json] [--url url]

import {chromium} from "playwright";
import {execSync} from "node:child_process";
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {parseArgs} from "node:util";
import {aggregate, measure, type Metrics} from "./lib/measure.ts";
import {settle, VIEWPORT} from "./lib/gestures.ts";
import {SCENARIOS} from "./scenarios/index.ts";

const {values: args} = parseArgs({
  options: {
    runs: {type: "string", default: "5"},
    label: {type: "string", default: "run"},
    dataset: {type: "string", default: "perf/rendering/datasets/reticulaire.json"},
    url: {type: "string", default: "http://localhost:4200"},
  },
});

const total = Number(args.runs);
if (!Number.isInteger(total) || total < 1) {
  console.error("--runs must be a positive integer");
  process.exit(1);
}

const git = (cmd: string) => execSync(`git ${cmd}`, {encoding: "utf8"}).trim();

const main = async () => {
  const dataset = JSON.parse(readFileSync(args.dataset, "utf8"));
  const browser = await chromium.launch();
  const runs: Record<string, Metrics>[] = [];
  try {
    // Run 0 is a warmup and is discarded
    for (let i = 0; i <= total; i++) {
      const results: Record<string, Metrics> = {};
      // Each scenario runs on a fresh page, to be independent from the others
      for (const scenario of SCENARIOS) {
        const page = await browser.newPage({viewport: VIEWPORT});
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Performance.enable");
        await page.goto(args.url);
        await page.waitForSelector("#graphContainer > g");
        await settle(page);
        results[scenario.name] = await measure({page, dataset}, cdp, scenario);
        await page.close();
      }
      if (i > 0) runs.push(results);
      console.log(i === 0 ? "warmup done" : `run ${i}/${total} done`);
    }
  } finally {
    await browser.close();
  }

  const results = aggregate(runs);
  console.table(results);

  const date = new Date().toISOString();
  const output = {
    label: args.label,
    date,
    commit: git("rev-parse --short HEAD"),
    dirty: git("status --porcelain") !== "",
    dataset: args.dataset,
    runs: total,
    results,
    raw: runs,
  };
  const dir = "perf/rendering/results";
  const file = `${dir}/${date.replace(/[:.]/g, "-")}-${args.label}.json`;
  mkdirSync(dir, {recursive: true});
  writeFileSync(file, JSON.stringify(output, null, 2));
  console.log(`Saved to ${file}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
