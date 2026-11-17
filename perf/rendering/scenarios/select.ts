import type {Scenario} from "../lib/types.ts";
import {loadDataset, getBackgroundPoint, getVisibleSectionPoint} from "../lib/editor.ts";
import {centerGraph} from "../lib/gestures.ts";

const REPEATS = 5;

// Selects a trainrun by clicking one of its sections, then unselects it by clicking the background.
// Each click first moves the mouse, so the steps also include hovering the section, then
// unhovering it.
export const select: Scenario = {
  name: "select",
  prepare: async ({page, dataset}) => {
    await loadDataset(page, dataset);
    await centerGraph(page, dataset);
    const section = await getVisibleSectionPoint(page);
    const background = await getBackgroundPoint(page);
    return async (runStep) => {
      for (let i = 0; i < REPEATS; i++) {
        await runStep(() => page.mouse.click(section.x, section.y));
        await runStep(() => page.mouse.click(background.x, background.y));
      }
    };
  },
};
