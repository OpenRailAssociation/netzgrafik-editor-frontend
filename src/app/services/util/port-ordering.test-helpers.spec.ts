import {PortAlignment} from "../../data-structures/technical.data.structures";
import {buildNetwork, getTrainrunIDsOnSide, setPortOrder} from "./port-ordering.test-helpers";

describe("Port ordering unit tests helpers", () => {
  describe("buildNetwork", () => {
    it("creates nodes with correct positions", () => {
      const {nodesMap} = buildNetwork({
        nodes: {A: {x: 10, y: 20}, B: {x: 30, y: 40}},
        trainruns: [["A", "B"]],
      });

      expect(nodesMap.get("A").getPositionX()).toBe(10);
      expect(nodesMap.get("A").getPositionY()).toBe(20);
      expect(nodesMap.get("B").getPositionX()).toBe(30);
      expect(nodesMap.get("B").getPositionY()).toBe(40);
    });

    it("creates nodes with default positions when omitted", () => {
      const {nodesMap} = buildNetwork({
        nodes: {A: {}, B: {x: 100}},
        trainruns: [["A", "B"]],
      });

      expect(nodesMap.get("A").getPositionX()).toBe(0);
      expect(nodesMap.get("A").getPositionY()).toBe(0);
      expect(nodesMap.get("B").getPositionX()).toBe(100);
      expect(nodesMap.get("B").getPositionY()).toBe(0);
    });

    it("creates correct number of nodes", () => {
      const {nodesMap, nodesArray} = buildNetwork({
        nodes: {A: {}, B: {}, C: {}},
        trainruns: [["A", "B", "C"]],
      });

      expect(nodesMap.size).toBe(3);
      expect(nodesArray.length).toBe(3);
    });

    it("returns unique trainrun IDs for each trainrun", () => {
      const {trainrunIDs} = buildNetwork({
        nodes: {A: {}, B: {}},
        trainruns: [
          ["A", "B"],
          ["A", "B"],
          ["A", "B"],
        ],
      });

      expect(trainrunIDs.length).toBe(3);
      expect(new Set(trainrunIDs).size).toBe(3);
    });

    it("creates ports with correct alignments (horizontal)", () => {
      // A - B
      const {nodesMap} = buildNetwork({
        nodes: {A: {x: 0}, B: {x: 100}},
        trainruns: [["A", "B"]],
      });

      const aPorts = nodesMap.get("A").getPorts();
      const bPorts = nodesMap.get("B").getPorts();

      expect(aPorts.length).toBe(1);
      expect(bPorts.length).toBe(1);
      expect(aPorts[0].getPositionAlignment()).toBe(PortAlignment.Right);
      expect(bPorts[0].getPositionAlignment()).toBe(PortAlignment.Left);
    });

    it("creates ports with correct alignments (vertical)", () => {
      // A
      // |
      // B
      const {nodesMap} = buildNetwork({
        nodes: {A: {y: 0}, B: {y: 100}},
        trainruns: [["A", "B"]],
      });

      const aPorts = nodesMap.get("A").getPorts();
      const bPorts = nodesMap.get("B").getPorts();

      expect(aPorts.length).toBe(1);
      expect(bPorts.length).toBe(1);
      expect(aPorts[0].getPositionAlignment()).toBe(PortAlignment.Bottom);
      expect(bPorts[0].getPositionAlignment()).toBe(PortAlignment.Top);
    });

    it("creates transitions for middle nodes", () => {
      // A - B - C
      const {nodesMap} = buildNetwork({
        nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
        trainruns: [["A", "B", "C"]],
      });

      expect(nodesMap.get("A").getTransitions().length).toBe(0);
      expect(nodesMap.get("B").getTransitions().length).toBe(1);
      expect(nodesMap.get("C").getTransitions().length).toBe(0);
    });

    it("creates multiple transitions for hub nodes", () => {
      // A - B - C
      // with two trainruns
      const {nodesMap} = buildNetwork({
        nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
        trainruns: [
          ["A", "B", "C"],
          ["A", "B", "C"],
        ],
      });

      expect(nodesMap.get("B").getTransitions().length).toBe(2);
      expect(nodesMap.get("B").getPorts().length).toBe(4);
    });
  });

  describe("getTrainrunIdsOnSide", () => {
    it("returns trainrun IDs in position index order", () => {
      const {nodesMap, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0}, B: {x: 100}},
        trainruns: [
          ["A", "B"],
          ["A", "B"],
        ],
      });

      const leftIds = getTrainrunIDsOnSide(nodesMap.get("B"), "left");
      expect(leftIds.length).toBe(2);
      expect(leftIds).toEqual(trainrunIDs);
    });

    it("returns empty array for side with no ports", () => {
      const {nodesMap} = buildNetwork({
        nodes: {A: {x: 0}, B: {x: 100}},
        trainruns: [["A", "B"]],
      });

      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "top")).toEqual([]);
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "right")).toEqual([]);
      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "bottom")).toEqual([]);
    });

    it("works for all sides", () => {
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

      expect(getTrainrunIDsOnSide(nodesMap.get("C"), "top").length).toBe(1);
      expect(getTrainrunIDsOnSide(nodesMap.get("C"), "right").length).toBe(1);
      expect(getTrainrunIDsOnSide(nodesMap.get("C"), "left").length).toBe(1);
      expect(getTrainrunIDsOnSide(nodesMap.get("C"), "bottom").length).toBe(1);
    });
  });

  describe("setPortOrder", () => {
    it("changes port position indices", () => {
      const {nodesMap, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0}, B: {x: 100}},
        trainruns: [
          ["A", "B"],
          ["A", "B"],
        ],
      });

      const reversed = trainrunIDs.toReversed();
      setPortOrder(nodesMap.get("B"), "left", reversed);

      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "left")).toEqual(reversed);
    });

    it("is idempotent when called with same order", () => {
      const {nodesMap, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0}, B: {x: 100}},
        trainruns: [
          ["A", "B"],
          ["A", "B"],
        ],
      });

      const customOrder = trainrunIDs.toReversed();

      setPortOrder(nodesMap.get("B"), "left", customOrder);
      setPortOrder(nodesMap.get("B"), "left", customOrder);

      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "left")).toEqual(customOrder);
    });

    it("handles three trainruns", () => {
      const {nodesMap, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0}, B: {x: 100}},
        trainruns: [
          ["A", "B"],
          ["A", "B"],
          ["A", "B"],
        ],
      });

      const customOrder = [trainrunIDs[2], trainrunIDs[0], trainrunIDs[1]];
      setPortOrder(nodesMap.get("B"), "left", customOrder);

      expect(getTrainrunIDsOnSide(nodesMap.get("B"), "left")).toEqual(customOrder);
    });
  });
});
