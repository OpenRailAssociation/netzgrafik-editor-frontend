import {Node} from "../../models/node.model";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {Transition} from "../../models/transition.model";
import {
  ALIGNMENTS_CLOCKWISE_ORDER,
  isHorizontalAlignment,
  SWAPPED_ALIGNMENTS,
} from "./port-ordering.crossings";
import {getConnectedComponents, getPortOppositeNodeId} from "./port-ordering.components";

// Scores for sorting opposite alignments from top/left to bottom/right
const HORIZONTAL_OPPOSITE_SCORES = new Map([
  [PortAlignment.Left, 1],
  [PortAlignment.Top, 2],
  [PortAlignment.Bottom, 3],
  [PortAlignment.Right, 4],
]);
const VERTICAL_OPPOSITE_SCORES = new Map([
  [PortAlignment.Top, 1],
  [PortAlignment.Left, 2],
  [PortAlignment.Right, 3],
  [PortAlignment.Bottom, 4],
]);

/**
 * This function helps to sort all alignments opposite of a given alignment, from top/left to
 * bottom/right.
 */
function getOppositeAlignmentScore(alignment: PortAlignment, opposite: PortAlignment): number {
  const scores = isHorizontalAlignment(alignment)
    ? HORIZONTAL_OPPOSITE_SCORES
    : VERTICAL_OPPOSITE_SCORES;
  return scores.get(opposite);
}

/**
 * This function returns true when the elbow described by the two input alignments must have swapped
 * orders, in order to have non-crossing paths.
 *
 * Basically, it's true if the elbow is top+right or left+bottom, or if both.
 */
function isElbowSwapped(from: PortAlignment, to: PortAlignment): boolean {
  return SWAPPED_ALIGNMENTS.has(from) === SWAPPED_ALIGNMENTS.has(to);
}

/**
 * This function sorts all ports in a given node, in a way that minimizes crossings as much as
 * possible. The strategy is described in detail within the function itself.
 */
export function orderPorts(
  node: Node,
  orderedNodeIDs = new Set<number>(),
  trainrunsScores: Record<number, number> = {},
) {
  const transitions = node.getTransitions();
  const ports = node.getPorts();

  // Index all port transitions:
  const portTransitions = new Map<number, Transition>();
  transitions.forEach((t) => {
    portTransitions.set(t.getPortId1(), t);
    portTransitions.set(t.getPortId2(), t);
  });

  // For each side, order ports by transitions groups:
  const orderedSides = new Set<PortAlignment>();
  ALIGNMENTS_CLOCKWISE_ORDER.forEach((alignment) => {
    const sidePorts = ports.filter((port) => port.getPositionAlignment() === alignment);

    // Sort these by the following criteria, in that order, when they apply:
    // - If both ports have a transition:
    //   1. Opposite port alignment within node
    //   2. Order of port on opposite side within node, if opposite side has already been ordered
    // - In all cases:
    //   3. Opposite node, sorted by position
    // - If other node has been ordered already (i.e. if it's in orderedNodeIDs):
    //   4a. Order of port in opposite node
    // - else, if some trainruns order has been given
    //   4b. Order using the trainruns tie-breaker
    sidePorts.sort((a, b) => {
      const aTransition = portTransitions.get(a.getId());
      const bTransition = portTransitions.get(b.getId());

      if (aTransition && bTransition) {
        const aOppositePort = node.getPort(aTransition.getOppositePort(a.getId()));
        const bOppositePort = node.getPort(bTransition.getOppositePort(b.getId()));

        const aOppositeAlignment = aOppositePort.getPositionAlignment();
        const bOppositeAlignment = bOppositePort.getPositionAlignment();

        if (aOppositeAlignment !== bOppositeAlignment) {
          // Case 1
          return (
            getOppositeAlignmentScore(alignment, aOppositeAlignment) -
            getOppositeAlignmentScore(alignment, bOppositeAlignment)
          );
        }

        if (orderedSides.has(aOppositeAlignment)) {
          const aScoreOppositeSide = aOppositePort.getPositionIndex();
          const bScoreOppositeSide = bOppositePort.getPositionIndex();
          const swap = isElbowSwapped(alignment, aOppositeAlignment);

          // Case 2
          return (aScoreOppositeSide - bScoreOppositeSide) * (swap ? -1 : 1);
        }
      }

      const aOppositeNode = a.getOppositeNode(node.getId());
      const bOppositeNode = b.getOppositeNode(node.getId());

      if (aOppositeNode !== bOppositeNode) {
        // Case 3
        return isHorizontalAlignment(alignment)
          ? aOppositeNode.getPositionX() - bOppositeNode.getPositionX()
          : aOppositeNode.getPositionY() - bOppositeNode.getPositionY();
      }

      // Case 4a
      if (orderedNodeIDs.has(aOppositeNode.getId())) {
        const oppositeNodePorts = aOppositeNode.getPorts();
        const aPortInOppositeNode = oppositeNodePorts.find(
          (port) => port.getTrainrunSectionId() === a.getTrainrunSectionId(),
        );
        const bPortInOppositeNode = oppositeNodePorts.find(
          (port) => port.getTrainrunSectionId() === b.getTrainrunSectionId(),
        );
        if (!aPortInOppositeNode || !bPortInOppositeNode) return 0;
        return aPortInOppositeNode.getPositionIndex() - bPortInOppositeNode.getPositionIndex();
      }

      // Case 4b
      else {
        const aTrainrunId = a.getTrainrunSection().getTrainrunId();
        const bTrainrunId = b.getTrainrunSection().getTrainrunId();
        const aScore = trainrunsScores[aTrainrunId] ?? aTrainrunId;
        const bScore = trainrunsScores[bTrainrunId] ?? bTrainrunId;

        let swap = 1;
        if (aTransition) {
          const aOppositePort = node.getPort(aTransition.getOppositePort(a.getId()));
          if (aOppositePort.getPositionAlignment() === alignment) {
            const otherEnd = aOppositePort.getOppositeNode(node.getId());
            const currentPos = isHorizontalAlignment(alignment)
              ? aOppositeNode.getPositionX()
              : aOppositeNode.getPositionY();
            const otherPos = isHorizontalAlignment(alignment)
              ? otherEnd.getPositionX()
              : otherEnd.getPositionY();
            if (currentPos > otherPos) swap = -1;
          }
        }

        return (aScore - bScore) * swap;
      }
    });

    // Apply new order:
    sidePorts.forEach((port, i) => port.setPositionIndex(i));

    orderedSides.add(alignment);
  });
}

function getNeighborsCount(node: Node): number {
  return new Set(node.getPorts().map((p) => getPortOppositeNodeId(p, node.getId()))).size;
}

/**
 * This function orders all ports across all nodes using BFS traversal from a root node. Each
 * connected component is processed separately, starting from the node with the most neighbors.
 *
 * This function assumes all nodes are somehow connected. If you don't know that for sure, you
 * should call reorderAllPorts instead, that first looks for all connected components.
 */
export function reorderComponentPorts(nodes: Node[]): void {
  const nodesWithPorts = nodes.filter((n) => n.getPorts().length > 0);
  if (nodesWithPorts.length === 0) return;

  const nodeMap = new Map(nodes.map((n) => [n.getId(), n]));
  const sortedNodes = nodes.toSorted((a, b) => {
    const aNeighborsCount = getNeighborsCount(a);
    const bNeighborsCount = getNeighborsCount(b);
    if (aNeighborsCount !== bNeighborsCount) return bNeighborsCount - aNeighborsCount;

    const aPortsCount = a.getPorts().length;
    const bPortsCount = b.getPorts().length;
    return bPortsCount - aPortsCount;
  });
  const visited = new Set<number>();

  // Process each connected component
  while (visited.size < nodesWithPorts.length) {
    const root = sortedNodes.find((node) => !visited.has(node.getId()));
    const queue: number[] = [root.getId()];

    orderPorts(root, visited);
    visited.add(root.getId());

    // BFS traversal
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = nodeMap.get(nodeId)!;

      const neighborIds = new Set(node.getPorts().map((p) => getPortOppositeNodeId(p, nodeId)));

      for (const neighborId of neighborIds) {
        if (visited.has(neighborId)) continue;

        visited.add(neighborId);
        queue.push(neighborId);

        const neighbor = nodeMap.get(neighborId)!;
        orderPorts(neighbor, visited);
      }
    }
  }
}

/**
 * This function orders all ports in all nodes to minimize crossings. It first calls
 * getConnectedComponents, and then reorderComponentPorts on each connected component.
 */
export function reorderAllPorts(nodes: Node[]): void {
  const components = getConnectedComponents(nodes);
  components.forEach((componentNodes) => reorderComponentPorts(componentNodes));
}
