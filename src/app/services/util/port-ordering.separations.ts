import {Node} from "../../models/node.model";
import {Port} from "../../models/port.model";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {ALIGNMENTS_CLOCKWISE_ORDER} from "./port-ordering.helpers";

/**
 * A "separation" happens when two trainrun sections that are drawn touching (adjacent on a node
 * side) get pulled apart, because a third section sits between them. Unlike a crossing, the two
 * sections need not swap order. Separations measure how well parallel bundles of lines stay
 * together.
 *
 * Two kinds are counted separately, so callers can weight them independently:
 * - within a node: a pair enters bundled on one side and leaves split on another (across transitions)
 * - between nodes: a pair is bundled at one end of a link and split at the other end
 */

// Two ports are adjacent on their side iff their (contiguous, per-side) indices differ by one.
const areAdjacent = (a: Port, b: Port): boolean =>
  Math.abs(a.getPositionIndex() - b.getPositionIndex()) === 1;

/**
 * Counts separations within a single node: pairs of transitions running between the same two sides
 * that are adjacent on one of those sides but not the other.
 */
export function countSeparationsWithinNode(node: Node): number {
  // Each transition spanning two distinct sides, as a map: side -> its port on that side.
  const transitions = node
    .getTransitions()
    .map((t) => {
      const p1 = node.getPort(t.getPortId1());
      const p2 = node.getPort(t.getPortId2());
      return new Map<PortAlignment, Port>([
        [p1.getPositionAlignment(), p1],
        [p2.getPositionAlignment(), p2],
      ]);
    })
    .filter((sides) => sides.size === 2);

  let separations = 0;
  for (let i = 0; i < transitions.length - 1; i++) {
    for (let j = i + 1; j < transitions.length; j++) {
      const a = transitions[i];
      const b = transitions[j];
      const sides = [...a.keys()];
      // Only pairs sharing the very same two sides form a bundle running through the node:
      if (!sides.every((side) => b.has(side))) continue;
      if (
        areAdjacent(a.get(sides[0]), b.get(sides[0])) !==
        areAdjacent(a.get(sides[1]), b.get(sides[1]))
      ) {
        separations++;
      }
    }
  }
  return separations;
}

/**
 * Counts separations on links incident to `node`: pairs of sections leaving toward the same
 * opposite node, adjacent at this end of the link but not the other (or vice versa).
 */
export function countSeparationsBetweenNodes(node: Node): number {
  const nodeId = node.getId();
  let separations = 0;

  ALIGNMENTS_CLOCKWISE_ORDER.forEach((alignment) => {
    const sidePorts = node.getPorts().filter((p) => p.getPositionAlignment() === alignment);

    for (let i = 0; i < sidePorts.length - 1; i++) {
      for (let j = i + 1; j < sidePorts.length; j++) {
        const a = sidePorts[i];
        const b = sidePorts[j];

        const oppositeNode = a.getOppositeNode(nodeId);
        if (oppositeNode.getId() !== b.getOppositeNode(nodeId).getId()) continue;

        const oppositePorts = oppositeNode.getPorts();
        const aOpposite = oppositePorts.find(
          (p) => p.getTrainrunSectionId() === a.getTrainrunSectionId(),
        );
        const bOpposite = oppositePorts.find(
          (p) => p.getTrainrunSectionId() === b.getTrainrunSectionId(),
        );
        if (!aOpposite || !bOpposite) continue;

        if (areAdjacent(a, b) !== areAdjacent(aOpposite, bOpposite)) separations++;
      }
    }
  });

  return separations;
}

/**
 * Aggregates separations across a set of nodes, returning within-node and between-node counts
 * separately so they can be weighted independently. Between-node separations are halved, as each
 * link is counted once from each of its two endpoints.
 */
export function countAllSeparations(nodes: Node[]): {within: number; between: number} {
  let within = 0;
  let between = 0;
  nodes.forEach((node) => {
    within += countSeparationsWithinNode(node);
    between += countSeparationsBetweenNodes(node);
  });
  return {within, between: between / 2};
}
