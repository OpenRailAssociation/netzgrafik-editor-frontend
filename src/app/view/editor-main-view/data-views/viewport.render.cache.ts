import {LevelOfDetail} from "../../../services/ui/level.of.detail.service";

// What a layer last displayed, and its view objects, so that a viewport change only culls them
// again, without recomputing the view objects of unchanged data
export interface LayerCache<T extends object, V> {
  items: () => T[];
  start: (items: T[], viewportOnly: boolean, levelOfDetail: LevelOfDetail) => void;
  getAll: (items: T[], create: (missing: T[]) => V[]) => V[];
}

export const createLayerCache = <T extends object, V>(): LayerCache<T, V> => {
  let lastItems: T[] = [];
  let lastLevelOfDetail: LevelOfDetail | undefined;
  let objects = new WeakMap<T, V>();
  return {
    items: () => lastItems,
    // Drops the view objects, unless only the viewport changed. View object keys depend on the
    // level of detail, and zooming can change it: drop them too when it changes.
    start: (items, viewportOnly, levelOfDetail) => {
      if (!viewportOnly || levelOfDetail !== lastLevelOfDetail) objects = new WeakMap();
      lastItems = items;
      lastLevelOfDetail = levelOfDetail;
    },
    getAll: (items, create) => {
      const missing = items.filter((item) => !objects.has(item));
      create(missing).forEach((object, i) => objects.set(missing[i], object));
      return items.map((item) => objects.get(item));
    },
  };
};
