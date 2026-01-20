import {Port} from "../../models/port.model";
import {Node} from "../../models/node.model";

export function getPortOppositeNodeId(port: Port, nodeId: number): number {
  const ts = port.getTrainrunSection();
  return ts.getSourceNodeId() === nodeId ? ts.getTargetNodeId() : ts.getSourceNodeId();
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
    const componentTrainrunIDs = new Set<number>();
    const queue: number[] = [startNode.getId()];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;

      visited.add(nodeId);
      const node = nodeMap.get(nodeId)!;
      componentNodes.push(node);

      node.getPorts().forEach((port) => {
        componentTrainrunIDs.add(port.getTrainrunSection().getTrainrunId());
        const neighborId = getPortOppositeNodeId(port, nodeId);
        if (!visited.has(neighborId) && nodeMap.has(neighborId)) {
          queue.push(neighborId);
        }
      });
    }

    components.push(componentNodes);
  }

  return components;
}
