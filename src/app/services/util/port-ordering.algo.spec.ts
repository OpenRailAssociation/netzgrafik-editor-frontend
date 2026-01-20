import {orderPorts, reorderAllPorts} from "./port-ordering.algo";
import {countCrossings} from "./port-ordering.crossings";
import {buildNetwork, getTrainrunIDsOnSide} from "./port-ordering.test-helpers";

describe("port-ordering", () => {
  describe("orderPorts", () => {
    it("should order ports with two parallel trainruns (horizontal)", () => {
      // A -- B -- C (two trainruns going A→B→C)
      const {nodesMap, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0, y: 0}, B: {x: 100, y: 0}, C: {x: 200, y: 0}},
        trainruns: [
          ["A", "B", "C"],
          ["A", "B", "C"],
        ],
      });

      orderPorts(nodesMap.get("B"));

      // On both sides, trainruns are ordered in their given order:
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "left")).toEqual(trainrunIDs);
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "right")).toEqual(trainrunIDs);
    });

    it("should respect trainruns tiebreaker order", () => {
      // Same layout, but with explicit trainrun scores to control order
      const {nodesMap, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0, y: 0}, B: {x: 100, y: 0}, C: {x: 200, y: 0}},
        trainruns: [
          ["A", "B", "C"],
          ["A", "B", "C"],
        ],
      });
      const reversedTrainrunIDs = trainrunIDs.toReversed();
      const tiebreakerScores: Record<number, number> = {};
      reversedTrainrunIDs.forEach((id, index) => (tiebreakerScores[id] = index));

      // Give trainrun2 a lower score (should come first)
      orderPorts(nodesMap.get("B"), new Set(), tiebreakerScores);

      // Trainrun2 should be ordered before trainrun1 on left side
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "left")).toEqual(reversedTrainrunIDs);
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "right")).toEqual(reversedTrainrunIDs);
    });

    it("should order same-side ports by opposite node Y position", () => {
      // A
      //   >- B
      // C
      const {
        nodesMap,
        trainrunIDs: [t1, t2],
      } = buildNetwork({
        nodes: {A: {x: 0, y: 0}, B: {x: 1000, y: 50}, C: {x: 0, y: 100}},
        trainruns: [
          ["A", "B", "C"],
          ["A", "B", "C"],
        ],
      });

      orderPorts(nodesMap.get("B"));

      // B's left ports ordered by Y: A (y=0) before C (y=100)
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "left")).toEqual([t1, t2, t2, t1]);

      // There should be no crossing within B
      expect(countCrossings(nodesMap.get("B"))).toBe(0);
    });

    it("should order same-side ports by opposite node Y position (swapped side)", () => {
      //      A
      // B -<
      //      C
      const {
        nodesMap,
        trainrunIDs: [t1, t2],
      } = buildNetwork({
        nodes: {A: {x: 1000, y: 0}, B: {x: 0, y: 50}, C: {x: 1000, y: 100}},
        trainruns: [
          ["A", "B", "C"],
          ["A", "B", "C"],
        ],
      });

      orderPorts(nodesMap.get("B"));

      // B's right ports ordered by Y: A (y=0) before C (y=100)
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "right")).toEqual([t1, t2, t2, t1]);

      // There should be no crossing within B
      expect(countCrossings(nodesMap.get("B"))).toBe(0);
    });
  });

  describe("reorderAllPorts", () => {
    it("should handle swapped elbow (top to right)", () => {
      // A
      // |
      // B - C
      const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 50, y: 0}, B: {x: 50, y: 100}, C: {x: 150, y: 100}},
        trainruns: [
          ["A", "B", "C"],
          ["A", "B", "C"],
        ],
      });

      reorderAllPorts(nodesArray);

      expect(countCrossings(nodesMap.get("B"))).toBe(0);
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "top")).toEqual(trainrunIDs);
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "right")).toEqual(trainrunIDs.toReversed());
    });

    it("should handle non-swapped elbow (top to left)", () => {
      //     A
      //     |
      // C - B
      const {nodesMap, nodesArray, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 50, y: 0}, B: {x: 50, y: 100}, C: {x: -50, y: 100}},
        trainruns: [
          ["A", "B", "C"],
          ["A", "B", "C"],
        ],
      });

      reorderAllPorts(nodesArray);

      expect(countCrossings(nodesMap.get("B"))).toBe(0);
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "top")).toEqual(trainrunIDs);
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "left")).toEqual(trainrunIDs);
    });

    it("should handle two disconnected subgraphs", () => {
      // Subgraph 1: A1 - B1 - C1
      // Subgraph 2: A2 - B2 - C2 (separate component)
      const {nodesMap, nodesArray} = buildNetwork({
        nodes: {
          A1: {x: 0, y: 0},
          B1: {x: 100, y: 0},
          C1: {x: 200, y: 0},
          A2: {x: 0, y: 200},
          B2: {x: 100, y: 200},
          C2: {x: 200, y: 200},
        },
        trainruns: [
          ["A1", "B1", "C1"],
          ["A2", "B2", "C2"],
        ],
      });

      reorderAllPorts(nodesArray);

      // Both subgraphs processed: each B node has 1 transition, 0 crossings
      expect(nodesMap.get("B1").getTransitions().length).toBe(1);
      expect(nodesMap.get("B2").getTransitions().length).toBe(1);
      expect(countCrossings(nodesMap.get("B1"))).toBe(0);
      expect(countCrossings(nodesMap.get("B2"))).toBe(0);
    });
  });
});
