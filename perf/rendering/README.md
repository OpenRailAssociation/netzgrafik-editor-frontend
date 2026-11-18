# Rendering performance

These scripts measure how fast the editor reacts to various user actions (zooming, panning...). See [#1415](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1415) and [#1416](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1416).

They use a dense network, `datasets/reticulaire.json`: the demo network, copied 3 times, as described in [#1415](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1415).

## Usage

Install the browser once:

```sh
npx playwright install chromium
```

Start the app, in another terminal:

```sh
npm run start:standalone
```

Then run the measures:

```sh
npm run perf:rendering
```

You can also name the run, to find its report more easily:

```sh
npm run perf:rendering -- --label before-fix
```

The report is saved in `results/`. Other options:

- `--runs 5`: number of runs (the report keeps the median of each metric across runs)
- `--dataset file.json`: dataset to load (default: `datasets/reticulaire.json`)
- `--url http://localhost:4200`: URL of the app
- `--headed`: shows the browser, to see what the scenarios do (the measures are then not comparable to headless ones)
- `--no-save`: only logs the results, without saving the report

The app runs as a dev build, and reports highly depend on the environment they're run on. The results can only be compared to other reports from the same machine, and should not be used for their absolute value.

## Comparing two versions

Run the measures on each version (after a checkout, wait for the app to rebuild), then:

```sh
npm run perf:rendering:compare -- perf/rendering/results/<before>.json perf/rendering/results/<after>.json
```

## Reading the results

Each scenario (see `scenarios/`) is a series of steps. A step is one user action (a click, a mouse move, a wheel tick, a dataset load).

- `taskMs` is the time the browser was busy during the whole scenario, and `scriptMs`, `styleMs`, `layoutMs` show where that time goes.
- `taskPerStepMs` is `taskMs` divided by the number of steps (`stepCount`).
- `graphElements` is the number of elements drawn at the end.

Each scenario except `load` is played once before being measured, so that the measures do not include the first time costs. The report has the median of each metric across runs, its spread (`(max - min) / median`, in percent), and the values of each run.

## Unit tests

```sh
npm run perf:test
```
