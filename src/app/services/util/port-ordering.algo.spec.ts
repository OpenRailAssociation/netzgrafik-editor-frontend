import {reorderNodePorts, optimizePorts} from "./port-ordering.algo";
import {countAllCrossings, countCrossingsInNode} from "./port-ordering.crossings";
import {buildNetwork, getTrainrunIDsOnSide} from "./port-ordering.test-helpers";

describe("port-ordering", () => {
  describe("orderPorts", () => {
    it("should order ports with two parallel trainruns (horizontal)", () => {
      // A - B - C
      const {nodesMap, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0, y: 0}, B: {x: 100, y: 0}, C: {x: 200, y: 0}},
        trainruns: [
          ["A", "B", "C"],
          ["A", "B", "C"],
        ],
      });

      reorderNodePorts(nodesMap.get("B"));

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
      reorderNodePorts(nodesMap.get("B"), new Set(), tiebreakerScores);

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

      reorderNodePorts(nodesMap.get("B"));

      // B's left ports ordered by Y: A (y=0) before C (y=100)
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "left")).toEqual([t1, t2, t2, t1]);

      // There should be no crossing within B
      expect(countCrossingsInNode(nodesMap.get("B"))).toBe(0);
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

      reorderNodePorts(nodesMap.get("B"));

      // B's right ports ordered by Y: A (y=0) before C (y=100)
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "right")).toEqual([t1, t2, t2, t1]);

      // There should be no crossing within B
      expect(countCrossingsInNode(nodesMap.get("B"))).toBe(0);
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

      expect(countCrossingsInNode(nodesMap.get("B"))).toBe(1);
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "top")).toEqual(trainrunIDs);
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "right")).toEqual(trainrunIDs);

      optimizePorts(nodesArray);

      // This case solves the only crossing to unfold
      expect(countCrossingsInNode(nodesMap.get("B"))).toBe(0);
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

      expect(countCrossingsInNode(nodesMap.get("B"))).toBe(0);
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "top")).toEqual(trainrunIDs);
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "left")).toEqual(trainrunIDs);

      optimizePorts(nodesArray);

      // This case doesn't change anything (already optimized)
      expect(countCrossingsInNode(nodesMap.get("B"))).toBe(0);
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "top")).toEqual(trainrunIDs);
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "left")).toEqual(trainrunIDs);
    });

    it("should handle two disconnected subgraphs", () => {
      // Subgraph 1:
      // A1
      // |
      // B1 - C1
      //
      // Subgraph 2 (separate component):
      //      A2
      //      |
      // C2 - B2
      const {nodesMap, nodesArray} = buildNetwork({
        nodes: {
          A1: {x: 100, y: 100},
          B1: {x: 100, y: 200},
          C1: {x: 200, y: 200},
          A2: {x: 1200, y: 100},
          B2: {x: 1200, y: 200},
          C2: {x: 1100, y: 200},
        },
        trainruns: [
          ["A1", "B1", "C1"],
          ["A1", "B1", "C1"],
          ["A2", "B2", "C2"],
          ["A2", "B2", "C2"],
        ],
      });

      expect(countCrossingsInNode(nodesMap.get("B1"))).toBe(1);
      expect(countCrossingsInNode(nodesMap.get("B2"))).toBe(0);

      optimizePorts(nodesArray);

      expect(countCrossingsInNode(nodesMap.get("B1"))).toBe(0);
      expect(countCrossingsInNode(nodesMap.get("B2"))).toBe(0);
    });
  });

  describe("Regression #1140", () => {
    // Accurate reproduction: This case mimics the exact infrastructure
    // described in the ticket.
    describe("Accurate test case", () => {
      it("should not produce crossings, in the issue reticular", () => {
        const {nodesArray} = buildNetwork({
          nodes: {
            BOTTOM_LEFT: {x: -100, y: 100},
            TOP_LEFT: {x: -100, y: -100},
            LEFT: {x: -100, y: 0},
            MIDDLE: {x: 0, y: 0},
            RIGHT: {x: 100, y: 0},
            EXTRA_RIGHT: {x: 200, y: 0},
          },
          trainruns: [
            // Two parallel paths, on the bottom branch:
            ["BOTTOM_LEFT", "LEFT", "MIDDLE", "RIGHT", "EXTRA_RIGHT"],
            ["EXTRA_RIGHT", "RIGHT", "MIDDLE", "LEFT", "BOTTOM_LEFT"],
            // Three parallel paths, on the top branch:
            ["TOP_LEFT", "LEFT", "MIDDLE", "RIGHT", "EXTRA_RIGHT"],
            ["TOP_LEFT", "LEFT", "MIDDLE", "RIGHT", "EXTRA_RIGHT"],
            ["EXTRA_RIGHT", "RIGHT", "MIDDLE", "LEFT", "TOP_LEFT"],
          ],
        });

        optimizePorts(nodesArray);

        const {crossings, groupCrossings} = countAllCrossings(nodesArray);
        expect(crossings).toBe(0);
        expect(groupCrossings).toEqual([]);
      });
    });

    // Minimal reproduction: two parallel trains turning a 90° corner at HUB,
    // whose downstream neighbor (MID) is a pass-through continuing to END.
    // Tested in the 4 corner orientations.
    describe("Minimal test case", () => {
      const corners = [
        {name: "top > right (NE)", arm: {x: 0, y: -100}, mid: {x: 100, y: 0}, end: {x: 200, y: 0}},
        {
          name: "right > bottom (SE)",
          arm: {x: 100, y: 0},
          mid: {x: 0, y: 100},
          end: {x: 0, y: 200},
        },
        {
          name: "bottom > left (SW)",
          arm: {x: 0, y: 100},
          mid: {x: -100, y: 0},
          end: {x: -200, y: 0},
        },
        {name: "left > top (NW)", arm: {x: -100, y: 0}, mid: {x: 0, y: -100}, end: {x: 0, y: -200}},
      ];

      corners.forEach(({name, arm, mid, end}) => {
        it(`should not produce crossings (${name})`, () => {
          const {nodesArray} = buildNetwork({
            nodes: {ARM: arm, HUB: {x: 0, y: 0}, MID: mid, END: end},
            trainruns: [
              ["ARM", "HUB", "MID", "END"],
              ["ARM", "HUB", "MID", "END"],
            ],
          });

          optimizePorts(nodesArray);

          expect(countAllCrossings(nodesArray).crossings).toBe(0);
        });
      });
    });
  });

  // The ticket reports two distinct crossings.
  // The following tests each represent one crossing from the ticket, in a
  // minimal reticular:
  describe("Regression #1159", () => {
    describe("Crossing n°1", () => {
      const nodes = {
        LEFT: {x: -1000, y: 0},
        MID: {x: -500, y: 0},
        CORNER: {x: 0, y: 0},
        DOWN_MID: {x: 0, y: 500},
        HUB: {x: 0, y: 1000},
        HUB_LEFT: {x: -500, y: 1000},
        HUB_END: {x: 0, y: 1500},
      };

      it("is crossing-free", () => {
        const {nodesArray} = buildNetwork({
          nodes,
          trainruns: [
            ["HUB_LEFT", "HUB"],
            ["HUB", "DOWN_MID", "CORNER", "MID", "LEFT"],
            ["LEFT", "MID", "CORNER"],
            ["LEFT", "MID", "CORNER", "DOWN_MID", "HUB", "HUB_END"],
          ],
        });

        optimizePorts(nodesArray);

        const {crossings, groupCrossings} = countAllCrossings(nodesArray);
        expect(crossings).toBe(0);
        expect(groupCrossings).toEqual([]);
      });
    });

    // This test seems to be order-dependant right now, so here are two cases:
    // one with an order that breaks, one with an order that does not
    describe("Crossing n°2", () => {
      const nodes = {
        LEFT: {x: -500, y: 0},
        MID: {x: -250, y: 0},
        FORK: {x: 0, y: 0},
        RIGHT_TOP: {x: 250, y: -200},
        RIGHT_BOTTOM: {x: 250, y: 200},
      };
      const toBottom = ["LEFT", "MID", "FORK", "RIGHT_BOTTOM"];
      const toTop = ["MID", "FORK", "RIGHT_TOP"];
      const forkToTop = ["FORK", "RIGHT_TOP"];
      const terminating = ["LEFT", "MID", "FORK"];

      // Same network, varying only the position of the terminating trainrun
      // (LEFT -> FORK) in the declaration order.
      const orders = {
        last: [toBottom, toTop, forkToTop, terminating],
        early: [toBottom, terminating, toTop, forkToTop],
      };

      Object.entries(orders).forEach(([name, trainruns]) => {
        it(`is crossing-free with terminating trainrun declared ${name}`, () => {
          const {nodesArray} = buildNetwork({nodes, trainruns});

          optimizePorts(nodesArray);

          const {crossings, groupCrossings} = countAllCrossings(nodesArray);
          expect(crossings).toBe(0);
          expect(groupCrossings).toEqual([]);
        });
      });
    });
  });
});
