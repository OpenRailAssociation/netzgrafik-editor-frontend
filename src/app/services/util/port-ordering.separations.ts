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

const trainrunIdOf = (port: Port): number => port.getTrainrunSection().getTrainrunId();

/**
 * Within a single node, returns the trainrun-ID pairs whose transitions run between the same two
 * sides but are adjacent on only one of them (a bundle split apart by something wedged between).
 */
export function getSeparationPairsWithinNode(node: Node): [number, number][] {
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

  const pairs: [number, number][] = [];
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
        pairs.push([trainrunIdOf(a.get(sides[0])), trainrunIdOf(b.get(sides[0]))]);
      }
    }
  }
  return pairs;
}

/**
 * On links incident to `node`, returns the trainrun-ID pairs leaving toward the same opposite node,
 * adjacent at this end of the link but not the other (or vice versa).
 */
export function getSeparationPairsBetweenNodes(node: Node): [number, number][] {
  const nodeId = node.getId();
  const pairs: [number, number][] = [];

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

        if (areAdjacent(a, b) !== areAdjacent(aOpposite, bOpposite)) {
          pairs.push([trainrunIdOf(a), trainrunIdOf(b)]);
        }
      }
    }
  });

  return pairs;
}

export function countSeparationsWithinNode(node: Node): number {
  return getSeparationPairsWithinNode(node).length;
}

export function countSeparationsBetweenNodes(node: Node): number {
  return getSeparationPairsBetweenNodes(node).length;
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

// Unions separated pairs into connected bundles of trainruns that "want" to stay together, returned
// largest-first (only bundles of 2+ trainruns).
function groupSeparatedTrainruns(pairs: [number, number][]): number[][] {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    parent.set(x, root);
    return root;
  };
  pairs.forEach(([a, b]) => parent.set(find(a), find(b)));

  const groups = new Map<number, number[]>();
  [...parent.keys()].forEach((id) => {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  });
  return [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
}

// Moves all `bundle` trainruns next to each other (keeping their relative order), at the slot of
// the bundle's first member in `order`. Everything else keeps its relative order:
function pullTogether(order: number[], bundle: Set<number>): number[] {
  const firstIndex = order.findIndex((id) => bundle.has(id));
  if (firstIndex === -1) return order;
  const bundled = order.filter((id) => bundle.has(id));
  const rest = order.filter((id) => !bundle.has(id));
  rest.splice(firstIndex, 0, ...bundled);
  return rest;
}

/**
 * Generates new trainrun-ordering candidates aimed at reducing separations: it finds the largest
 * separated bundles and, for each, returns `currentOrder` with that bundle pulled contiguous.
 * Candidates are returned largest-bundle-first.
 */
export function getSeparationCandidates(
  nodes: Node[],
  currentOrder: number[],
  kinds: {within: boolean; between: boolean},
): number[][] {
  const pairs: [number, number][] = [];
  nodes.forEach((node) => {
    if (kinds.within) pairs.push(...getSeparationPairsWithinNode(node));
    if (kinds.between) pairs.push(...getSeparationPairsBetweenNodes(node));
  });
  return groupSeparatedTrainruns(pairs).map((bundle) =>
    pullTogether(currentOrder, new Set(bundle)),
  );
}
