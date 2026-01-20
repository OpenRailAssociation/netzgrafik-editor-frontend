import {buildNetwork, setPortOrder} from "./port-ordering.test-helpers";
import {countAllCrossings, countCrossings} from "./port-ordering.crossings";

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

describe("countAllCrossings", () => {
  describe("parallel sections (same endpoints)", () => {
    it("returns 0 when port orders match at both ends", () => {
      // Two parallel trainruns, same order at both ends:
      const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0}, B: {x: 100}},
        trainruns: [
          ["A", "B"],
          ["A", "B"],
        ],
      });
      setPortOrder(nodesMap.get("A"), "right", trainrunIDs);
      setPortOrder(nodesMap.get("B"), "left", trainrunIDs);

      expect(countAllCrossings(nodesArray)).toBe(0);
    });

    it("returns 1 when port orders are inverted", () => {
      // Two parallel trainruns, inverted order at B:
      const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0}, B: {x: 100}},
        trainruns: [
          ["A", "B"],
          ["A", "B"],
        ],
      });
      setPortOrder(nodesMap.get("A"), "right", trainrunIDs);
      setPortOrder(nodesMap.get("B"), "left", trainrunIDs.toReversed());

      expect(countAllCrossings(nodesArray)).toBe(1);
    });
  });

  describe("shared node, same alignment, different destinations", () => {
    it("returns 0 when port order matches destination Y", () => {
      // A
      //   >- B
      // C
      const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0, y: 0}, B: {x: 500, y: 50}, C: {x: 0, y: 100}},
        trainruns: [
          ["A", "B"],
          ["C", "B"],
        ],
      });
      setPortOrder(nodesMap.get("B"), "left", trainrunIDs);

      expect(countAllCrossings(nodesArray)).toBe(0);
    });

    it("returns 1 when port order does not match destination Y", () => {
      // A
      //   >- B
      // C
      const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0, y: 0}, B: {x: 500, y: 50}, C: {x: 0, y: 100}},
        trainruns: [
          ["A", "B"],
          ["C", "B"],
        ],
      });
      setPortOrder(nodesMap.get("B"), "left", trainrunIDs.toReversed());

      expect(countAllCrossings(nodesArray)).toBe(1);
    });
  });
});
