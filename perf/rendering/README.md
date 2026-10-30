# Rendering performance

These scripts measure how fast the editor reacts to common interactions (loading, selecting, panning, zooming) on a dense network. They drive a real browser (Chromium, through [Playwright](https://playwright.dev)) against a running app.

Related issues:

- [#1415](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1415): slow zoom and pan on dense networks
- [#1416](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1416): `adjustTextWithEllipsis` slows down zooming

## Scenarios

Each scenario runs on a fresh page, so scenarios do not depend on each other.

| Scenario      | What it does                                                              |
| ------------- | ------------------------------------------------------------------------- |
| `load`        | Loads the dataset, replacing the default network shown at startup         |
| `select`      | Clicks a trainrun section, then the background, 5 times                   |
| `panDense`    | Pans back and forth over the center of the graph, at 100% zoom            |
| `zoomOutIn`   | Zooms out from 100% to the minimum (10%), then back to 100%, step by step |
| `panOverview` | Pans back and forth at 10% zoom, with the whole graph visible             |
| `panEmpty`    | Pans back and forth far away from the graph, where nothing is drawn       |

The viewport is 1600x1000.

## Dataset

`datasets/reticulaire.json`: 153 nodes, 69 trainruns, 612 trainrun sections.

It is the dense network described in [#1415](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1415): the demo of the [public instance](https://openrailassociation.github.io/netzgrafik-editor-frontend/) (`src/app/sample-netzgrafik/netzgrafik_demo_standalone_github.json`), duplicated twice (select all, then Ctrl+D twice).

## Usage

Install the browser once:

```sh
npx playwright install chromium
```

Start the app in another terminal, and wait for the build to finish:

```sh
npm run start:standalone
```

This runs the app without build optimization: compare results with each other, not as absolute values.

Run the scripts:

```sh
npm run perf:rendering -- --label before
```

Options:

- `--runs 5`: number of measured runs (an extra warmup run is always done first, and discarded)
- `--label run`: name added to the report file name
- `--dataset perf/rendering/datasets/reticulaire.json`: dataset to load
- `--url http://localhost:4200`: app URL

To compare two versions, run the measures on each version (the dev server rebuilds after a checkout: wait for it to finish), then:

```sh
npm run perf:rendering:compare -- perf/rendering/results/<before>.json perf/rendering/results/<after>.json
```

This prints, for each scenario, the metrics of both reports and the difference in percent.

## Reports

Each run writes a JSON file in `results/` (ignored by git), containing:

- `label`, `date`, `dataset`, `runs`
- `commit`, `dirty`: the git commit, and whether there were uncommitted changes
- `results`: for each scenario, the median of each metric across runs
- `raw`: the metrics of every run

### Metrics

A scenario is a series of **steps**. A step is one user action (a click, a mouse move, a wheel tick), followed by a wait until the browser has drawn the result.

| Metric         | Meaning                                                    |
| -------------- | ---------------------------------------------------------- |
| `stepCount`    | Number of steps                                            |
| `totalStepsMs` | Total time of all steps                                    |
| `stepMedianMs` | Time of a typical step                                     |
| `taskMs`       | Time the browser main thread was busy                      |
| `scriptMs`     | Part of that time spent running JavaScript                 |
| `styleMs`      | Part of that time spent computing CSS styles               |
| `layoutMs`     | Part of that time spent computing positions and sizes      |
| `svgElements`  | Number of elements in the graph at the end of the scenario |

Why these metrics:

- **Step times** are what the user feels: the delay between an action and its visible result. The median shows the usual delay. They are measured from the test script, so they also include some Playwright overhead.
- **Main thread times** (from the Chrome DevTools Protocol) show where the time goes. They cover the whole scenario, including the waits between steps.
- **`svgElements`** shows how much is drawn, to see the effect of the level of detail and of hiding what is outside the screen.
