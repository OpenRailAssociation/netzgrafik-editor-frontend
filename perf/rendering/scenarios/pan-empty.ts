import type {Scenario} from "../lib/types.ts";
import {getContainerBox, getGraphBox, getScreenCoordinates, loadDataset} from "../lib/editor.ts";
import {panBy, preparePanBackAndForth} from "../lib/gestures.ts";

// Distance between the container and the graph, larger than the editor culling margins
const MARGIN = 200;

// Pans next to the graph, where nothing is drawn
export const panEmpty: Scenario = {
  name: "panEmpty",
  prepare: async ({page, dataset}) => {
    await loadDataset(page, dataset);
    const container = await getContainerBox(page);
    const graph = await getScreenCoordinates(page, getGraphBox(dataset));
    // Moves the graph to the right of the container. The pan then moves it further right, and back
    await panBy(page, {x: container.x + container.width + MARGIN - graph.x, y: 0});
    return preparePanBackAndForth(page);
  },
};
