import type {Scenario} from "../lib/measure.ts";
import {loadDataset} from "../lib/app.ts";
import {backgroundPoint, centerGraph, visibleSectionPoint, type Point} from "../lib/gestures.ts";

const REPEATS = 5;

// Selects a trainrun by clicking one of its sections, then unselects it by clicking the background
export const select: Scenario<{section: Point; background: Point}> = {
  name: "select",
  setup: async ({page, dataset}) => {
    await loadDataset(page, dataset);
    await centerGraph(page);
    return {section: await visibleSectionPoint(page), background: await backgroundPoint(page)};
  },
  body: async ({page}, step, {section, background}) => {
    for (let i = 0; i < REPEATS; i++) {
      await step(() => page.mouse.click(section.x, section.y));
      await step(() => page.mouse.click(background.x, background.y));
    }
  },
};
