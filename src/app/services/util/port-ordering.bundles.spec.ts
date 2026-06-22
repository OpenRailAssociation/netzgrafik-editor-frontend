import {buildNetwork, setPortOrder} from "./port-ordering.test-helpers";
import {getBundleReferenceOrder, getClutterBundles} from "./port-ordering.bundles";

describe("getClutterBundles", () => {
  it("returns no bundles when the network is clean", () => {
    const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
      trainruns: [
        ["A", "B", "C"],
        ["A", "B", "C"],
      ],
    });
    setPortOrder(nodesMap.get("B"), "left", trainrunIDs);
    setPortOrder(nodesMap.get("B"), "right", trainrunIDs);

    expect(getClutterBundles(nodesArray)).toEqual([]);
  });

  it("reports a separated pair as one bundle, broken at both ends of the link", () => {
    // T0,T1 run A-B in parallel
    // T2 ends at B (from E, further west), wedged between them on B's left
    // T0,T1 want to stay together but are pulled apart
    // -> one bundle {T0,T1}
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

    const bundles = getClutterBundles(nodesArray);

    expect(bundles.length).toBe(1);
    expect(bundles[0].trainruns).toEqual(new Set([t0, t1]));
    expect(bundles[0].brokenAt).toEqual(
      new Set([nodesMap.get("A").getId(), nodesMap.get("B").getId()]),
    );
  });
});

describe("getBundleReferenceOrder", () => {
  it("reads the members' order off the node side that holds the most of them", () => {
    const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}},
      trainruns: [
        ["A", "B"],
        ["A", "B"],
        ["A", "B"],
      ],
    });
    const [t0, t1, t2] = trainrunIDs;
    setPortOrder(nodesMap.get("A"), "right", [t2, t0, t1]);
    setPortOrder(nodesMap.get("B"), "left", [t2, t0, t1]);

    expect(getBundleReferenceOrder(nodesArray, new Set([t0, t1, t2]), [t0, t1, t2])).toEqual([
      t2,
      t0,
      t1,
    ]);
  });

  it("appends members absent from that side in their current global order", () => {
    const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
      trainruns: [
        ["A", "B"],
        ["A", "B"],
        ["B", "C"],
      ],
    });
    const [t0, t1, t2] = trainrunIDs;
    setPortOrder(nodesMap.get("A"), "right", [t1, t0]);
    setPortOrder(nodesMap.get("B"), "left", [t1, t0]);

    expect(getBundleReferenceOrder(nodesArray, new Set([t0, t1, t2]), [t0, t1, t2])).toEqual([
      t1,
      t0,
      t2,
    ]);
  });
});
