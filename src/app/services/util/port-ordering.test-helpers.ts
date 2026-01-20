import {Node} from "../../models/node.model";
import {Trainrun} from "../../models/trainrun.model";
import {VisAVisPortPlacement} from "./node.port.placement";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {PortAlignment} from "../../data-structures/technical.data.structures";

const ALIGNMENTS_MAP = {
  top: PortAlignment.Top,
  right: PortAlignment.Right,
  bottom: PortAlignment.Bottom,
  left: PortAlignment.Left,
};

/**
 * This function helps build a nodes network with proper trainruns, ports and transitions, to ease
 * writing unit tests for crossings and port ordering optimization.
 */
export function buildNetwork(def: {
  nodes: Record<string, {x?: number; y?: number}>;
  trainruns: string[][];
}) {
  // 1. Create nodes
  const nodesMap = new Map<string, Node>();
  for (const [name, {x = 0, y = 0}] of Object.entries(def.nodes)) {
    const node = new Node();
    node.setPosition(x, y);
    node.setBetriebspunktName(name);
    nodesMap.set(name, node);
  }

  // 2. Create trainrun sections and ports
  const trainrunIDs: number[] = [];
  const portIds = new Map<string, Map<string, number>>(); // nodeId -> targetNodeId -> portId

  for (const path of def.trainruns) {
    const trainrun = new Trainrun();
    trainrunIDs.push(trainrun.getId());

    for (let i = 0; i < path.length - 1; i++) {
      const sourceNode = nodesMap.get(path[i]);
      const targetNode = nodesMap.get(path[i + 1]);
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
      const node = nodesMap.get(path[i]);
      const port1 = node.getPort(portIds.get(path[i]).get(path[i - 1]));
      const port2 = node.getPort(portIds.get(path[i]).get(path[i + 1]));
      node.addTransitionAndComputeRouting(port1, port2, trainrun, true);
    }
  }

  return {nodesMap, nodesArray: [...nodesMap.values()], trainrunIDs};
}

/**
 * This function allows retrieving in which order trainruns meet at a node on a given side.
 */
export function getTrainrunIDsOnSide(
  node: Node,
  side: "top" | "right" | "bottom" | "left",
): number[] {
  return node
    .getPorts()
    .filter((p) => p.getPositionAlignment() === ALIGNMENTS_MAP[side])
    .sort((a, b) => a.getPositionIndex() - b.getPositionIndex())
    .map((p) => p.getTrainrunSection().getTrainrunId());
}

/**
 * This function reorders ports on a given side of a node, to match trainrun IDs in a given order.
 */
export function setPortOrder(
  node: Node,
  side: "top" | "right" | "bottom" | "left",
  trainrunIDs: number[],
): void {
  const ports = node.getPorts().filter((p) => p.getPositionAlignment() === ALIGNMENTS_MAP[side]);

  for (const port of ports) {
    const trainrunId = port.getTrainrunSection().getTrainrunId();
    const trainrunIndex = trainrunIDs.indexOf(trainrunId);
    port.setPositionIndex(trainrunIndex);
  }
}
