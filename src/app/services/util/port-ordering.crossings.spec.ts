import {buildNetwork, setPortOrder} from "./port-ordering.test-helpers";
import {countCrossings} from "./port-ordering.crossings";

describe("countCrossings", () => {
  it("returns 0 for non-crossing transitions", () => {
    // A - B - C, with no crossing
    const {nodesMap} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
      trainruns: [
        ["A", "B", "C"],
        ["A", "B", "C"],
      ],
    });

    expect(countCrossings(nodesMap.get("B"))).toBe(0);
  });

  it("returns 1 for two orthogonal transitions", () => {
    //   A
    //   |
    // B-C-D
    //   |
    //   E
    const {nodesMap} = buildNetwork({
      nodes: {
        A: {x: 100, y: 0},
        B: {x: 0, y: 100},
        C: {x: 100, y: 100},
        D: {x: 200, y: 100},
        E: {x: 100, y: 200},
      },
      trainruns: [
        ["A", "C", "E"],
        ["B", "C", "D"],
      ],
    });

    expect(countCrossings(nodesMap.get("C"))).toBe(1);
  });

  it("returns 1 for two crossing transitions", () => {
    // A - B - C
    const {nodesMap, trainrunIDs} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
      trainruns: [
        ["A", "B", "C"],
        ["A", "B", "C"],
      ],
    });

    // Force trainruns to cross at B
    setPortOrder(nodesMap.get("B"), "left", trainrunIDs);
    setPortOrder(nodesMap.get("B"), "right", trainrunIDs.toReversed());

    expect(countCrossings(nodesMap.get("B"))).toBe(1);
  });
});
