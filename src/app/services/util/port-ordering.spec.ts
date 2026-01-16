import {Node} from "../../models/node.model";
import {Trainrun} from "../../models/trainrun.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {VisAVisPortPlacement} from "./node.port.placement";
import {orderPorts, reorderAllPorts} from "./port-ordering";
import {countCrossings} from "./port-ordering.utils";

interface NetworkDef {
  nodes: Record<string, {x: number; y: number}>;
  trainruns: string[][];
}

interface Network {
  nodes: Map<string, Node>;
  trainrunIDs: number[];
}

function getNode(nodes: Map<string, Node>, name: string): Node {
  const node = nodes.get(name);
  if (!node) throw new Error(`Unknown node in test definition: "${name}"`);
  return node;
}

function buildNetwork(def: NetworkDef): Network {
  // 1. Create nodes
  const nodes = new Map<string, Node>();
  for (const [name, {x, y}] of Object.entries(def.nodes)) {
    const node = new Node();
    node.setPosition(x, y);
    node.setBetriebspunktName(name);
    nodes.set(name, node);
  }

  // 2. Create trainrun sections and ports
  const trainrunIDs: number[] = [];
  const portIds = new Map<string, Map<string, number>>(); // nodeId -> targetNodeId -> portId

  for (const path of def.trainruns) {
    const trainrun = new Trainrun();
    trainrunIDs.push(trainrun.getId());

    for (let i = 0; i < path.length - 1; i++) {
      const sourceNode = getNode(nodes, path[i]);
      const targetNode = getNode(nodes, path[i + 1]);
      const {sourcePortPlacement, targetPortPlacement} =
        VisAVisPortPlacement.placePortsOnSourceAndTargetNode(sourceNode, targetNode);

      // Create trainrun section first (needed by addPort)
      const ts = new TrainrunSection();
      ts.setSourceNode(sourceNode);
      ts.setTargetNode(targetNode);
      ts.setTrainrun(trainrun);

      // Create ports with trainrun section
      const sourcePortId = sourceNode.addPort(sourcePortPlacement, ts);
      const targetPortId = targetNode.addPort(targetPortPlacement, ts);

      // Track port IDs for transitions
      if (!portIds.has(path[i])) portIds.set(path[i], new Map());
      if (!portIds.has(path[i + 1])) portIds.set(path[i + 1], new Map());
      portIds.get(path[i]).set(path[i + 1], sourcePortId);
      portIds.get(path[i + 1]).set(path[i], targetPortId);
    }

    // 3. Create transitions for middle nodes in this path
    for (let i = 1; i < path.length - 1; i++) {
      const node = getNode(nodes, path[i]);
      const port1 = node.getPort(portIds.get(path[i]).get(path[i - 1]));
      const port2 = node.getPort(portIds.get(path[i]).get(path[i + 1]));
      node.addTransitionAndComputeRouting(port1, port2, trainrun, true);
    }
  }

  return {nodes, trainrunIDs};
}

/**
 * Returns ordered port targets for a given side of a node.
 * Example: getPortsOnSide(nodeB, "left") → ["A", "C"] means B's left side
 * has ports connecting to A (index 0) then C (index 1).
 */
function getPortsOnSide(node: Node, side: "top" | "right" | "bottom" | "left"): string[] {
  const alignmentMap = {
    top: PortAlignment.Top,
    right: PortAlignment.Right,
    bottom: PortAlignment.Bottom,
    left: PortAlignment.Left,
  };
  return node
    .getPorts()
    .filter((p) => p.getPositionAlignment() === alignmentMap[side])
    .sort((a, b) => a.getPositionIndex() - b.getPositionIndex())
    .map((p) => {
      const ts = p.getTrainrunSection();
      const opposite = ts.getSourceNode() === node ? ts.getTargetNode() : ts.getSourceNode();
      return opposite.getBetriebspunktName();
    });
}

/** Returns trainrun IDs for ports on a given side, in order. */
function getTrainrunIdsOnSide(node: Node, side: "top" | "right" | "bottom" | "left"): number[] {
  const alignmentMap = {
    top: PortAlignment.Top,
    right: PortAlignment.Right,
    bottom: PortAlignment.Bottom,
    left: PortAlignment.Left,
  };
  return node
    .getPorts()
    .filter((p) => p.getPositionAlignment() === alignmentMap[side])
    .sort((a, b) => a.getPositionIndex() - b.getPositionIndex())
    .map((p) => p.getTrainrunSection().getTrainrunId());
}

describe("port-ordering", () => {
  describe("orderPorts", () => {
    it("should order ports with two parallel trainruns (horizontal)", () => {
      // A -- B -- C (two trainruns going A→B→C)
      const {nodes, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 0, y: 0}, B: {x: 100, y: 0}, C: {x: 200, y: 0}},
        trainruns: [
          ["A", "B", "C"],
          ["A", "B", "C"],
        ],
      });

      orderPorts(getNode(nodes, "B"));

      // B's left side has 2 ports to A, right side has 2 ports to C
      expect(getPortsOnSide(getNode(nodes, "B"), "left")).toEqual(["A", "A"]);
      expect(getPortsOnSide(getNode(nodes, "B"), "right")).toEqual(["C", "C"]);

      // On both sides, trainruns are ordered in their given order:
      expect(getTrainrunIdsOnSide(getNode(nodes, "B"), "left")).toEqual(trainrunIDs);
      expect(getTrainrunIdsOnSide(getNode(nodes, "B"), "right")).toEqual(trainrunIDs);
    });

    it("should respect trainruns tiebreaker order", () => {
      // Same layout, but with explicit trainrun scores to control order
      const {nodes, trainrunIDs} = buildNetwork({
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
      orderPorts(getNode(nodes, "B"), new Set(), tiebreakerScores);

      // Trainrun2 should be ordered before trainrun1 on left side
      expect(getTrainrunIdsOnSide(getNode(nodes, "B"), "left")).toEqual(reversedTrainrunIDs);
      expect(getTrainrunIdsOnSide(getNode(nodes, "B"), "right")).toEqual(reversedTrainrunIDs);
    });

    it("should order same-side ports by opposite node Y position", () => {
      //  A ----+
      //        B   (B is on the right, A and C are stacked on the left)
      //  C ----+
      const {
        nodes,
        trainrunIDs: [t1, t2],
      } = buildNetwork({
        nodes: {A: {x: 0, y: 0}, B: {x: 1000, y: 50}, C: {x: 0, y: 100}},
        trainruns: [
          ["A", "B", "C"],
          ["A", "B", "C"],
        ],
      });

      orderPorts(getNode(nodes, "B"));

      // B's left ports ordered by Y: A (y=0) before C (y=100)
      expect(getPortsOnSide(getNode(nodes, "B"), "left")).toEqual(["A", "A", "C", "C"]);
      expect(getTrainrunIdsOnSide(getNode(nodes, "B"), "left")).toEqual([t1, t2, t2, t1]);

      // There should be no crossing within B
      expect(countCrossings(getNode(nodes, "B"))).toBe(0);
    });

    it("should order same-side ports by opposite node Y position (swapped side)", () => {
      //  +---- A
      //  B        (B is on the left, A and C are stacked on the right)
      //  +---- C
      const {
        nodes,
        trainrunIDs: [t1, t2],
      } = buildNetwork({
        nodes: {A: {x: 1000, y: 0}, B: {x: 0, y: 50}, C: {x: 1000, y: 100}},
        trainruns: [
          ["A", "B", "C"],
          ["A", "B", "C"],
        ],
      });

      orderPorts(getNode(nodes, "B"));

      // B's right ports ordered by Y: A (y=0) before C (y=100)
      expect(getPortsOnSide(getNode(nodes, "B"), "right")).toEqual(["A", "A", "C", "C"]);
      expect(getTrainrunIdsOnSide(getNode(nodes, "B"), "right")).toEqual([t1, t2, t2, t1]);

      // There should be no crossing within B
      expect(countCrossings(getNode(nodes, "B"))).toBe(0);
    });
  });

  describe("reorderAllPorts", () => {
    it("should handle swapped elbow (top to right)", () => {
      //     A          Two trainruns: A→B→C
      //     |          Elbow at B: top↔right (swapped)
      //     B --- C
      const {nodes, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 50, y: 0}, B: {x: 50, y: 100}, C: {x: 150, y: 100}},
        trainruns: [
          ["A", "B", "C"],
          ["A", "B", "C"],
        ],
      });

      reorderAllPorts([...nodes.values()]);

      expect(countCrossings(getNode(nodes, "B"))).toBe(0);
      expect(getTrainrunIdsOnSide(getNode(nodes, "B"), "top")).toEqual(trainrunIDs);
      expect(getTrainrunIdsOnSide(getNode(nodes, "B"), "right")).toEqual(trainrunIDs.toReversed());
    });

    it("should handle non-swapped elbow (top to left)", () => {
      //        A       Two trainruns: A→B→C
      //        |       Elbow at B: top↔left (non-swapped)
      //  C --- B
      const {nodes, trainrunIDs} = buildNetwork({
        nodes: {A: {x: 50, y: 0}, B: {x: 50, y: 100}, C: {x: -50, y: 100}},
        trainruns: [
          ["A", "B", "C"],
          ["A", "B", "C"],
        ],
      });

      reorderAllPorts([...nodes.values()]);

      expect(countCrossings(getNode(nodes, "B"))).toBe(0);
      expect(getTrainrunIdsOnSide(getNode(nodes, "B"), "top")).toEqual(trainrunIDs);
      expect(getTrainrunIdsOnSide(getNode(nodes, "B"), "left")).toEqual(trainrunIDs);
    });

    it("should handle two disconnected subgraphs", () => {
      // Subgraph 1: A1 - B1 - C1
      // Subgraph 2: A2 - B2 - C2 (separate component)
      const {nodes} = buildNetwork({
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

      reorderAllPorts([...nodes.values()]);

      // Both subgraphs processed: each B node has 1 transition, 0 crossings
      expect(getNode(nodes, "B1").getTransitions().length).toBe(1);
      expect(getNode(nodes, "B2").getTransitions().length).toBe(1);
      expect(countCrossings(getNode(nodes, "B1"))).toBe(0);
      expect(countCrossings(getNode(nodes, "B2"))).toBe(0);
    });
  });
});
