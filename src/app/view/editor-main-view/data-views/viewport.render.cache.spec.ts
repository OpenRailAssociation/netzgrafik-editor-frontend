import {createLayerCache} from "./viewport.render.cache";

describe("createLayerCache", () => {
  // A layer with two items. Each display starts the cache, then gets one view object per item.
  // A new view object is a copy of its item, so we can check if it was reused or recreated.
  const items = [{id: "a"}, {id: "b"}];
  const cache = createLayerCache<{id: string}, {id: string}>();
  const display = (viewportOnly: boolean, stamp = 0) => {
    cache.start(items, viewportOnly, stamp);
    return cache.getAll(items, (missing) => missing.map((item) => ({...item})));
  };

  it("reuses view objects on viewport only displays", () => {
    const before = display(false);
    const after = display(true);
    expect(after[0]).toBe(before[0]);
  });

  it("recreates view objects on data changes", () => {
    const before = display(false);
    const after = display(false);
    expect(after[0]).not.toBe(before[0]);
  });

  it("recreates view objects on stamp changes", () => {
    const before = display(false, 0);
    const after = display(true, 1);
    expect(after[0]).not.toBe(before[0]);
  });
});
