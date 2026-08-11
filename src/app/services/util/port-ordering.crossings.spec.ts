import {buildNetwork, setPortOrder} from "./port-ordering.test-helpers";
import {
  countAllCrossings,
  countCrossingsInNode,
  countCrossingsBetweenSides,
  groupContiguous,
} from "./port-ordering.crossings";

describe("countCrossingsInNode", () => {
  it("returns 0 for non-crossing transitions", () => {
    // A - B - C, with no crossing
    const {nodesMap} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
      trainruns: [
        ["A", "B", "C"],
        ["A", "B", "C"],
      ],
    });

    expect(countCrossingsInNode(nodesMap.get("B"))).toBe(0);
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

    expect(countCrossingsInNode(nodesMap.get("C"))).toBe(1);
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

    expect(countCrossingsInNode(nodesMap.get("B"))).toBe(1);
  });
});

describe("countAllCrossings", () => {
  describe("parallel sections (same endpoints)", () => {
    it("returns total 0 when port orders match at both ends", () => {
      const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0}, B: {x: 100}},
        trainruns: [
          ["A", "B"],
          ["A", "B"],
        ],
      });
      setPortOrder(nodesMap.get("A"), "right", trainrunIDs);
      setPortOrder(nodesMap.get("B"), "left", trainrunIDs);

      const result = countAllCrossings(nodesArray);
      expect(result.crossings).toBe(0);
      expect(result.groupCrossings.length).toBe(0);
    });

    it("returns total 1 and detects group-crossing when port orders are inverted", () => {
      const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0}, B: {x: 100}},
        trainruns: [
          ["A", "B"],
          ["A", "B"],
        ],
      });
      setPortOrder(nodesMap.get("A"), "right", trainrunIDs);
      setPortOrder(nodesMap.get("B"), "left", trainrunIDs.toReversed());

      const result = countAllCrossings(nodesArray);
      expect(result.crossings).toBe(1);
      expect(result.groupCrossings[0]).toEqual({
        groups: [[trainrunIDs[1]], [trainrunIDs[0]]],
        crossings: 1,
      });
    });
  });

  describe("shared node, same alignment, different destinations", () => {
    it("returns total 0 when port order matches destination Y", () => {
      // A
      //   >- B
      // C
      const {nodesArray} = buildNetwork({
        nodes: {A: {x: 0, y: 0}, B: {x: 500, y: 50}, C: {x: 0, y: 100}},
        trainruns: [
          ["A", "B"],
          ["C", "B"],
        ],
      });
      // trainrunIDs[0] goes to A (y=0), trainrunIDs[1] goes to C (y=100)
      // At B's left side, order should be [0, 1] to match destination Y order
      const result = countAllCrossings(nodesArray);
      expect(result.crossings).toBe(0);
    });

    it("returns total 1 and detects group-crossing when port order does not match", () => {
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

      const result = countAllCrossings(nodesArray);
      expect(result.crossings).toBe(1);
      expect(result.groupCrossings[0]?.crossings).toBe(1);
    });
  });

  describe("group-crossings detection", () => {
    it("detects 2x2 group-crossing in parallel sections", () => {
      // 4 trainruns between A and B, first 2 inverted with last 2
      const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0}, B: {x: 100}},
        trainruns: [
          ["A", "B"],
          ["A", "B"],
          ["A", "B"],
          ["A", "B"],
        ],
      });
      // At A: [0, 1, 2, 3], at B: [2, 3, 0, 1]
      setPortOrder(nodesMap.get("A"), "right", trainrunIDs);
      setPortOrder(nodesMap.get("B"), "left", [
        trainrunIDs[2],
        trainrunIDs[3],
        trainrunIDs[0],
        trainrunIDs[1],
      ]);

      const result = countAllCrossings(nodesArray);
      // 0 crosses 2,3 (2), 1 crosses 2,3 (2) = 4 total
      expect(result.crossings).toBe(4);
      expect(result.groupCrossings[0]).toEqual({
        groups: [
          [trainrunIDs[2], trainrunIDs[3]],
          [trainrunIDs[0], trainrunIDs[1]],
        ],
        crossings: 4,
      });
    });

    it("detects group-crossing in Y case (shared endpoint, different destinations)", () => {
      // A
      //   >- B
      // C
      const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0, y: 0}, B: {x: 500, y: 50}, C: {x: 0, y: 100}},
        trainruns: [
          ["A", "B"],
          ["A", "B"],
          ["C", "B"],
          ["C", "B"],
        ],
      });
      // Force wrong order at B's left: trainruns to C before trainruns to A
      setPortOrder(nodesMap.get("B"), "left", [
        trainrunIDs[2],
        trainrunIDs[3],
        trainrunIDs[0],
        trainrunIDs[1],
      ]);

      const result = countAllCrossings(nodesArray);
      // Each A trainrun crosses each C trainrun = 2x2 = 4
      expect(result.crossings).toBe(4);
      expect(result.groupCrossings[0]?.crossings).toBe(4);
    });
  });
});

describe("groupContiguous", () => {
  describe("flat arrays", () => {
    it("returns single group when orders match", () => {
      expect(groupContiguous([1, 2, 3], [1, 2, 3])).toEqual([[1, 2, 3]]);
    });

    it("splits into groups when order is reversed", () => {
      expect(groupContiguous([1, 2, 3], [3, 2, 1])).toEqual([[1], [2], [3]]);
    });

    it("splits at discontinuity", () => {
      expect(groupContiguous([1, 2, 3, 4], [1, 2, 4, 3])).toEqual([[1, 2], [3], [4]]);
    });

    it("handles two swapped pairs", () => {
      expect(groupContiguous([1, 2, 3, 4], [2, 1, 4, 3])).toEqual([[1], [2], [3], [4]]);
    });

    it("keeps contiguous blocks together", () => {
      expect(groupContiguous([1, 2, 3, 4], [3, 4, 1, 2])).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });
  });

  describe("nested arrays (segments)", () => {
    it("splits groups at segment boundaries in a1", () => {
      expect(
        groupContiguous(
          [
            [1, 2],
            [3, 4],
          ],
          [1, 2, 3, 4],
        ),
      ).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it("splits groups at segment boundaries in a2", () => {
      expect(
        groupContiguous(
          [1, 2, 3, 4],
          [
            [1, 2],
            [3, 4],
          ],
        ),
      ).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it("handles segment boundaries in both inputs", () => {
      expect(
        groupContiguous(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [1, 2],
            [3, 4],
          ],
        ),
      ).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it("handles reordered segments", () => {
      expect(
        groupContiguous(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [3, 4],
            [1, 2],
          ],
        ),
      ).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty input", () => {
      expect(groupContiguous([], [])).toEqual([]);
    });

    it("handles single element", () => {
      expect(groupContiguous([1], [1])).toEqual([[1]]);
    });

    it("handles empty nested arrays", () => {
      expect(groupContiguous([[]], [[]])).toEqual([]);
    });
  });
});

describe("countCrossingsBetweenSides", () => {
  describe("direct crossings (same segment)", () => {
    it("returns 0 when orders match", () => {
      expect(countCrossingsBetweenSides([1, 2, 3], [1, 2, 3])).toEqual({direct: 0, indirect: 0});
    });

    it("returns 1 direct crossing for single swap", () => {
      expect(countCrossingsBetweenSides([1, 2], [2, 1])).toEqual({direct: 1, indirect: 0});
    });

    it("returns 3 direct crossings for full reversal of 3 elements", () => {
      expect(countCrossingsBetweenSides([1, 2, 3], [3, 2, 1])).toEqual({direct: 3, indirect: 0});
    });

    it("returns 1 direct crossing for adjacent swap", () => {
      expect(countCrossingsBetweenSides([1, 2, 3], [1, 3, 2])).toEqual({direct: 1, indirect: 0});
    });
  });

  describe("indirect crossings (different segments)", () => {
    it("returns 0 when segment orders match", () => {
      expect(countCrossingsBetweenSides([1, 2], [[1], [2]])).toEqual({direct: 0, indirect: 0});
    });

    it("returns 1 indirect crossing when segments are swapped", () => {
      expect(countCrossingsBetweenSides([1, 2], [[2], [1]])).toEqual({direct: 0, indirect: 1});
    });

    it("returns 4 indirect crossings for 2x2 segment swap", () => {
      expect(
        countCrossingsBetweenSides(
          [1, 2, 3, 4],
          [
            [3, 4],
            [1, 2],
          ],
        ),
      ).toEqual({
        direct: 0,
        indirect: 4,
      });
    });
  });

  describe("mixed crossings", () => {
    it("counts both direct and indirect crossings", () => {
      expect(countCrossingsBetweenSides([1, 2, 3], [[2, 1], [3]])).toEqual({
        direct: 1,
        indirect: 0,
      });
    });

    it("counts indirect when segment order differs", () => {
      expect(countCrossingsBetweenSides([1, 2, 3], [[3], [1, 2]])).toEqual({
        direct: 0,
        indirect: 2,
      });
    });

    it("handles complex case with both types", () => {
      expect(
        countCrossingsBetweenSides(
          [1, 2, 3, 4],
          [
            [3, 4],
            [2, 1],
          ],
        ),
      ).toEqual({
        direct: 1,
        indirect: 4,
      });
    });
  });

  describe("edge cases", () => {
    it("returns 0 for empty arrays", () => {
      expect(countCrossingsBetweenSides([], [])).toEqual({direct: 0, indirect: 0});
    });

    it("returns 0 for single element", () => {
      expect(countCrossingsBetweenSides([1], [1])).toEqual({direct: 0, indirect: 0});
    });

    it("handles elements in a1 not present in a2", () => {
      expect(countCrossingsBetweenSides([1, 2, 3], [1, 3])).toEqual({direct: 0, indirect: 0});
    });
  });
});
