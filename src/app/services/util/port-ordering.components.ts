import {Port} from "../../models/port.model";
import {Node} from "../../models/node.model";

export function getPortOppositeExpandedNodeId(port: Port, nodeId: number): number {
  return port.getOppositeExpandedNode(nodeId).getId();
}

export function getMatchingPortInOppositeNode(port: Port, nodeId: number): Port | undefined {
  const trainrunId = port.getTrainrunSection().getTrainrunId();
  const oppositeNode = port.getOppositeExpandedNode(nodeId);
  return oppositeNode
    .getPorts()
    .find(
      (p) =>
        p.getTrainrunSection().getTrainrunId() === trainrunId &&
        p.getOppositeExpandedNode(oppositeNode.getId()).getId() === nodeId,
    );
}

/**
 * This function takes a graph (as an array of nodes), and returns an array of all connected
 * components in it.
 */
export function getConnectedComponents(nodes: Node[]): Node[][] {
  const nodeMap = new Map(nodes.map((n) => [n.getId(), n]));
  const visited = new Set<number>();
  const components: Node[][] = [];

  for (const startNode of nodes) {
    if (visited.has(startNode.getId())) continue;

    const componentNodes: Node[] = [];
    const nodesToProcess: number[] = [startNode.getId()];

    while (nodesToProcess.length > 0) {
      const nodeId = nodesToProcess.pop();
      if (visited.has(nodeId)) continue;

      visited.add(nodeId);
      const node = nodeMap.get(nodeId)!;
      componentNodes.push(node);

      node.getPorts().forEach((port) => {
        const neighborId = getPortOppositeExpandedNodeId(port, nodeId);
        if (!visited.has(neighborId) && nodeMap.has(neighborId)) {
          nodesToProcess.push(neighborId);
        }
      });
    }

    components.push(componentNodes);
  }

  return components;
}
