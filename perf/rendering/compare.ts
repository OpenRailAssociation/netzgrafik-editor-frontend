// Compares two rendering performance results.
// Usage: node perf/rendering/compare.ts <before.json> <after.json>

import {readFileSync} from "node:fs";

type Results = Record<string, Record<string, number>>;

const [beforeFile, afterFile] = process.argv.slice(2);
if (!beforeFile || !afterFile) {
  console.error("Usage: node perf/rendering/compare.ts <before.json> <after.json>");
  process.exit(1);
}

const load = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const before = load(beforeFile);
const after = load(afterFile);

for (const o of [before, after]) {
  console.log(`${o.label}: ${o.commit}${o.dirty ? " (dirty)" : ""}, ${o.date}, ${o.dataset}`);
}

const delta = (a: number, b: number) =>
  a === 0 ? "-" : `${b >= a ? "+" : ""}${Math.round(((b - a) / a) * 1000) / 10}%`;

for (const [scenario, metrics] of Object.entries(before.results as Results)) {
  console.log(`\n${scenario}`);
  console.table(
    Object.fromEntries(
      Object.entries(metrics).map(([metric, a]) => {
        const b = (after.results as Results)[scenario]?.[metric];
        return [metric, {before: a, after: b, delta: b === undefined ? "-" : delta(a, b)}];
      }),
    ),
  );
}
