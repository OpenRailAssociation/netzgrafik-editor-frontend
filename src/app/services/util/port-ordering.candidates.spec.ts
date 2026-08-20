import {buildNetwork, setPortOrder} from "./port-ordering.test-helpers";
import {
  arrangeBundleSegmentReversed,
  arrangeBundleTogether,
  getCandidates,
} from "./port-ordering.candidates";

describe("arrangeBundleTogether", () => {
  it("gathers the bundle at its first slot, keeping the current relative order", () => {
    expect(arrangeBundleTogether([9, 1, 8, 2, 7, 3], new Set([1, 2, 3]))).toEqual([
      9, 1, 2, 3, 8, 7,
    ]);
  });

  it("gathers the bundle at its last slot when atLast is set", () => {
    expect(arrangeBundleTogether([9, 1, 8, 2, 7, 3], new Set([1, 2, 3]), true)).toEqual([
      9, 8, 7, 1, 2, 3,
    ]);
  });
});

describe("arrangeBundleSegmentReversed", () => {
  it("reverses the members between the first and last misplaced ones", () => {
    expect(arrangeBundleSegmentReversed([9, 3, 8, 2, 1], [1, 2, 3])).toEqual([9, 1, 8, 2, 3]);
  });

  it("leaves well-placed members outside the reversed window untouched", () => {
    expect(arrangeBundleSegmentReversed([9, 2, 1, 3], [1, 2, 3])).toEqual([9, 1, 2, 3]);
  });

  it("keeps the order intact when the bundle is already well ordered", () => {
    expect(arrangeBundleSegmentReversed([9, 1, 8, 2, 7, 3], [1, 2, 3])).toEqual([9, 1, 8, 2, 7, 3]);
  });
});

describe("getCandidates", () => {
  it("returns no candidates when the network is clean", () => {
    const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
      trainruns: [
        ["A", "B", "C"],
        ["A", "B", "C"],
      ],
    });
    setPortOrder(nodesMap.get("B"), "left", trainrunIDs);
    setPortOrder(nodesMap.get("B"), "right", trainrunIDs);

    expect(
      getCandidates(nodesArray, {
        order: trainrunIDs,
        betweenFirst: new Set(),
        root: nodesMap.get("B").getId(),
      }),
    ).toEqual([]);
  });

  it("emits the deduplicated reorderings of a single broken bundle", () => {
    // T0,T1 run A-B in parallel
    // T2 ends at B wedged between them -> bundle {T0,T1}, broken at A & B
    const {
      nodesMap,
      nodesArray,
      trainrunIDs: [t0, t1, t2],
    } = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, E: {x: -100}},
      trainruns: [
        ["A", "B"],
        ["A", "B"],
        ["E", "B"],
      ],
    });
    setPortOrder(nodesMap.get("A"), "right", [t0, t1]);
    setPortOrder(nodesMap.get("B"), "left", [t0, t2, t1]);

    const broken = new Set([nodesMap.get("A").getId(), nodesMap.get("B").getId()]);
    const root = nodesMap.get("B").getId();
    const candidates = getCandidates(nodesArray, {
      order: [t0, t2, t1],
      betweenFirst: new Set(),
      root,
    });

    expect(candidates).toEqual([
      {order: [t2, t0, t1], betweenFirst: new Set(), root, source: "gather-at-last"},
      {order: [t2, t0, t1], betweenFirst: broken, root, source: "gather-at-last (betweenFirst)"},
      {order: [t0, t2, t1], betweenFirst: new Set(), root, source: "segment-reversal"},
      {order: [t0, t2, t1], betweenFirst: broken, root, source: "segment-reversal (betweenFirst)"},
      {order: [t1, t0, t2], betweenFirst: new Set(), root, source: "together-reversed"},
      {order: [t1, t0, t2], betweenFirst: broken, root, source: "together-reversed (betweenFirst)"},
      {order: [t0, t1, t2], betweenFirst: new Set(), root, source: "together-normal"},
      {order: [t0, t1, t2], betweenFirst: broken, root, source: "together-normal (betweenFirst)"},
    ]);
  });

  it("reorders the candidates according to the prioritize flags", () => {
    const {
      nodesMap,
      nodesArray,
      trainrunIDs: [t0, t1, t2],
    } = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, E: {x: -100}},
      trainruns: [
        ["A", "B"],
        ["A", "B"],
        ["E", "B"],
      ],
    });
    setPortOrder(nodesMap.get("A"), "right", [t0, t1]);
    setPortOrder(nodesMap.get("B"), "left", [t0, t2, t1]);

    const broken = new Set([nodesMap.get("A").getId(), nodesMap.get("B").getId()]);
    const root = nodesMap.get("B").getId();
    const candidates = getCandidates(
      nodesArray,
      {order: [t0, t2, t1], betweenFirst: new Set(), root},
      {prioritizeSeparation: true, prioritizeWithin: true},
    );

    // prioritizeSeparation -> crossing repair before separation repair
    // prioritizeWithin -> between-first variant before the plain one
    expect(candidates).toEqual([
      {order: [t0, t2, t1], betweenFirst: broken, root, source: "segment-reversal (betweenFirst)"},
      {order: [t0, t2, t1], betweenFirst: new Set(), root, source: "segment-reversal"},
      {order: [t2, t0, t1], betweenFirst: broken, root, source: "gather-at-last (betweenFirst)"},
      {order: [t2, t0, t1], betweenFirst: new Set(), root, source: "gather-at-last"},
      {order: [t1, t0, t2], betweenFirst: broken, root, source: "together-reversed (betweenFirst)"},
      {order: [t1, t0, t2], betweenFirst: new Set(), root, source: "together-reversed"},
      {order: [t0, t1, t2], betweenFirst: broken, root, source: "together-normal (betweenFirst)"},
      {order: [t0, t1, t2], betweenFirst: new Set(), root, source: "together-normal"},
    ]);
  });
});
