import {buildNetwork, setPortOrder} from "./port-ordering.test-helpers";
import {getCandidates} from "./port-ordering.candidates";

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

    expect(getCandidates(nodesArray, {order: trainrunIDs, betweenFirst: new Set()})).toEqual([]);
  });

  it("emits the ten reorderings of a single broken bundle", () => {
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
    const candidates = getCandidates(nodesArray, {order: [t0, t2, t1], betweenFirst: new Set()});

    expect(candidates).toEqual([
      {order: [t0, t1, t2], betweenFirst: new Set()}, // separation repair
      {order: [t0, t1, t2], betweenFirst: broken},
      {order: [t1, t2, t0], betweenFirst: new Set()}, // crossing repair (reversed)
      {order: [t1, t2, t0], betweenFirst: broken},
      {order: [t0, t2, t1], betweenFirst: new Set()}, // crossing repair (normal)
      {order: [t0, t2, t1], betweenFirst: broken},
      {order: [t1, t0, t2], betweenFirst: new Set()}, // both at once (reversed)
      {order: [t1, t0, t2], betweenFirst: broken},
      {order: [t0, t1, t2], betweenFirst: new Set()}, // both at once (normal)
      {order: [t0, t1, t2], betweenFirst: broken},
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
    const candidates = getCandidates(
      nodesArray,
      {order: [t0, t2, t1], betweenFirst: new Set()},
      {prioritizeSeparation: true, prioritizeWithin: true},
    );

    // prioritizeSeparation -> crossing repair before separation repair
    // prioritizeWithin -> between-first variant before the plain one
    expect(candidates).toEqual([
      {order: [t1, t2, t0], betweenFirst: broken}, // crossing repair (reversed)
      {order: [t1, t2, t0], betweenFirst: new Set()},
      {order: [t0, t2, t1], betweenFirst: broken}, // crossing repair (normal)
      {order: [t0, t2, t1], betweenFirst: new Set()},
      {order: [t0, t1, t2], betweenFirst: broken}, // separation repair
      {order: [t0, t1, t2], betweenFirst: new Set()},
      {order: [t1, t0, t2], betweenFirst: broken}, // both at once (reversed)
      {order: [t1, t0, t2], betweenFirst: new Set()},
      {order: [t0, t1, t2], betweenFirst: broken}, // both at once (normal)
      {order: [t0, t1, t2], betweenFirst: new Set()},
    ]);
  });
});
