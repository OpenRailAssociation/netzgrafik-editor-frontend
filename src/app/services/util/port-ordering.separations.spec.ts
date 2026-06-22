import {buildNetwork, setPortOrder} from "./port-ordering.test-helpers";
import {
  countAllSeparations,
  countSeparationsBetweenNodes,
  countSeparationsWithinNode,
  getSeparationCandidates,
} from "./port-ordering.separations";
import {countAllCrossings} from "./port-ordering.crossings";

describe("countSeparationsWithinNode", () => {
  it("returns 0 when a bundle stays together through the node", () => {
    const {nodesMap, trainrunIDs} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
      trainruns: [
        ["A", "B", "C"],
        ["A", "B", "C"],
      ],
    });
    setPortOrder(nodesMap.get("B"), "left", trainrunIDs);
    setPortOrder(nodesMap.get("B"), "right", trainrunIDs);

    expect(countSeparationsWithinNode(nodesMap.get("B"))).toBe(0);
  });

  it("counts a terminating section wedged between a through-bundle as a separation", () => {
    // T0,T1 run A-B-C through B
    // T2 ends at B (from D, east), landing between them on B's right
    const {nodesMap, trainrunIDs} = buildNetwork({
      nodes: {A: {x: 0, y: 100}, B: {x: 100, y: 100}, C: {x: 200, y: 100}, D: {x: 250, y: 100}},
      trainruns: [
        ["A", "B", "C"],
        ["A", "B", "C"],
        ["D", "B"],
      ],
    });
    const [t0, t1, t2] = trainrunIDs;
    setPortOrder(nodesMap.get("B"), "left", [t0, t1]);
    setPortOrder(nodesMap.get("B"), "right", [t0, t2, t1]);

    // T0 and T1 keep their order through B (no crossing of the pair), yet T2 splits them apart.
    expect(countSeparationsWithinNode(nodesMap.get("B"))).toBe(1);
  });
});

describe("countSeparationsBetweenNodes", () => {
  it("returns 0 when a link's bundle is aligned at both ends", () => {
    const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}},
      trainruns: [
        ["A", "B"],
        ["A", "B"],
      ],
    });
    setPortOrder(nodesMap.get("A"), "right", trainrunIDs);
    setPortOrder(nodesMap.get("B"), "left", trainrunIDs);

    expect(countSeparationsBetweenNodes(nodesMap.get("A"))).toBe(0);
    expect(countAllSeparations(nodesArray)).toEqual({within: 0, between: 0});
  });

  it("treats a pure two-line swap as a crossing, not a separation", () => {
    const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}},
      trainruns: [
        ["A", "B"],
        ["A", "B"],
      ],
    });
    setPortOrder(nodesMap.get("A"), "right", trainrunIDs);
    setPortOrder(nodesMap.get("B"), "left", trainrunIDs.toReversed());

    // Swapped: they cross, but stay adjacent at both ends, so they are not
    // separated
    expect(countAllCrossings(nodesArray).crossings).toBe(1);
    expect(countAllSeparations(nodesArray)).toEqual({within: 0, between: 0});
  });

  it("counts a terminating section wedged into a link as a separation", () => {
    // T0,T1 run A-B in parallel
    // T2 ends at B (from E, further west), wedged between them on B's left,
    // while T0,T1 keep their relative order along the link
    const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
      nodes: {A: {x: 0, y: 100}, B: {x: 100, y: 100}, E: {x: -100, y: 100}},
      trainruns: [
        ["A", "B"],
        ["A", "B"],
        ["E", "B"],
      ],
    });
    const [t0, t1, t2] = trainrunIDs;
    setPortOrder(nodesMap.get("A"), "right", [t0, t1]);
    setPortOrder(nodesMap.get("B"), "left", [t0, t2, t1]);

    expect(countSeparationsBetweenNodes(nodesMap.get("A"))).toBe(1);
    expect(countAllSeparations(nodesArray)).toEqual({within: 0, between: 1});
  });
});

describe("getSeparationCandidates", () => {
  it("returns an ordering that pulls the largest separated bundle contiguous", () => {
    // T0,T1 run A-B in parallel
    // T2 ends at B, wedged between them on B's left
    const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
      nodes: {A: {x: 0, y: 0}, B: {x: 100, y: 0}, E: {x: -100, y: 0}},
      trainruns: [
        ["A", "B"],
        ["A", "B"],
        ["E", "B"],
      ],
    });
    const [t0, t1, t2] = trainrunIDs;
    setPortOrder(nodesMap.get("A"), "right", [t0, t1]);
    setPortOrder(nodesMap.get("B"), "left", [t0, t2, t1]);

    // With t2 wedged between t0 and t1 in the order, the candidate reunites t0,t1
    expect(
      getSeparationCandidates(nodesArray, [t0, t2, t1], {within: false, between: true}),
    ).toEqual([[t0, t1, t2]]);
  });

  it("returns no candidate when the targeted kind has no separation", () => {
    const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
      nodes: {A: {x: 0, y: 0}, B: {x: 100, y: 0}, E: {x: -100, y: 0}},
      trainruns: [
        ["A", "B"],
        ["A", "B"],
        ["E", "B"],
      ],
    });
    const [t0, t1, t2] = trainrunIDs;
    setPortOrder(nodesMap.get("A"), "right", [t0, t1]);
    setPortOrder(nodesMap.get("B"), "left", [t0, t2, t1]);

    // The separation is between-nodes, so asking only for within-node bundles yields nothing
    expect(
      getSeparationCandidates(nodesArray, [t0, t2, t1], {within: true, between: false}),
    ).toEqual([]);
  });
});
