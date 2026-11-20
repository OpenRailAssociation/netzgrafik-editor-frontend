// What a layer last displayed, and its view objects, so that a viewport change only culls them
// again, without recomputing the view objects of unchanged data
export interface LayerCache<T extends object, V> {
  items: () => T[];
  start: (items: T[], viewportOnly: boolean, stamp: unknown) => void;
  getAll: (items: T[], create: (missing: T[]) => V[]) => V[];
}

export const createLayerCache = <T extends object, V>(): LayerCache<T, V> => {
  let lastItems: T[] = [];
  let lastStamp: unknown;
  let objects = new WeakMap<T, V>();
  return {
    items: () => lastItems,
    // Drops the view objects, unless only the viewport changed (with the same stamp)
    start: (items, viewportOnly, stamp) => {
      if (!viewportOnly || stamp !== lastStamp) objects = new WeakMap();
      lastItems = items;
      lastStamp = stamp;
    },
    getAll: (items, create) => {
      const missing = items.filter((item) => !objects.has(item));
      create(missing).forEach((object, i) => objects.set(missing[i], object));
      return items.map((item) => objects.get(item));
    },
  };
};
