import {Node} from "../../models/node.model";
import {Port} from "../../models/port.model";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {Transition} from "../../models/transition.model";
import {
  countAllCrossings,
  countCrossingsInNode,
  getBetweenFirstCandidates,
} from "./port-ordering.crossings";
import {countAllSeparations, getSeparationCandidates} from "./port-ordering.separations";
import {getConnectedComponents, getPortOppositeNodeId} from "./port-ordering.components";
import {
  ALIGNMENTS_CLOCKWISE_ORDER,
  getOppositeAlignmentScore,
  isElbowSwapped,
  isHorizontalAlignment,
} from "./port-ordering.helpers";

/**
 * This function orders all ports in all nodes to minimize crossings. It first calls
 * getConnectedComponents, and then optimizeComponentPorts on each connected component.
 */
export function optimizePorts(nodes: Node[], clutterWeights?: Partial<ClutterWeights>): void {
  const components = getConnectedComponents(nodes);
  components.forEach((componentNodes) =>
    optimizeComponentPorts(componentNodes, {}, clutterWeights),
  );
}

type OptimizeComponentPortsOptions = {
  maxRuns: number;
  maxNewCandidates: number;
};
const DEFAULT_OPTIMIZE_COMPONENT_PORTS_OPTIONS: OptimizeComponentPortsOptions = {
  maxRuns: 50,
  maxNewCandidates: 10,
};

/**
 * A candidate is composed of:
 * - a trainrun ordering
 * - a set of nodes ordered "between-first"
 *
 * Each "between-first" node will have their ports reordered focusing on preserving order from
 * outside, rather than minimizing internal crossings first (see reorderNodePorts).
 */
type Candidate = {order: number[]; betweenFirst: Set<number>};

/**
 * Weights applied to the four clutter components the optimizer minimizes. The clutter is their
 * weighted sum, so callers tune the trade-off between minimizing crossings and keeping parallel
 * bundles together.
 */
export type ClutterWeights = {
  crossingsWithin: number;
  crossingsBetween: number;
  separationsWithin: number;
  separationsBetween: number;
};
const DEFAULT_CLUTTER_WEIGHTS: ClutterWeights = {
  crossingsWithin: 1,
  crossingsBetween: 1,
  separationsWithin: 0,
  separationsBetween: 0,
};

/**
 * This function tries to optimize port ordering across all nodes to minimize edge crossings.
 *
 * ## Strategy: Greedy search with crossing-guided candidate generation
 *
 * The core insight is that `reorderComponentPorts` uses a trainrun ordering as a tie-breaker when
 * two ports can't be distinguished by geometry alone. By trying different trainrun orderings, we
 * can explore different port arrangements, and find one with fewer crossings.
 *
 * ## Algorithm
 *
 * 1. Start with the initial trainrun order (from node transitions)
 * 2. For each candidate trainrun ordering:
 *    - Apply it via `reorderComponentPorts` (uses ordering as tie-breaker)
 *    - Count resulting crossings with `countAllCrossings`
 *    - If crossings improved, generate new candidates from detected group-crossings
 * 3. Repeat until no improvement or `maxRuns` reached
 * 4. Re-apply the best candidate found
 *
 * ## Candidate generation
 *
 * When crossings are detected, `countAllCrossings` returns `groupCrossings`: contiguous groups of
 * trainruns that cross each other. By permuting these groups in the trainrun ordering, we generate
 * new candidates that might reduce those specific crossings.
 *
 * Example: if trainruns [1,2] cross [3,4], we try reordering to [3,4,1,2].
 *
 * ## Limitations
 *
 * - This is a heuristic, not guaranteed to find the global optimum
 * - Uses depth-first search (stack), so may miss better solutions on other branches
 * - Stops early if no improvement, even if unexplored candidates remain
 *
 * ## Parameters
 *
 * - `maxRuns`: Maximum iterations to prevent infinite loops (default: 50)
 * - `maxNewCandidates`: Max new candidates per improvement (default: 10), limits branching factor
 */
function optimizeComponentPorts(
  nodes: Node[],
  parameters: Partial<OptimizeComponentPortsOptions> = {},
  clutterWeights: Partial<ClutterWeights> = {},
): void {
  const {maxRuns, maxNewCandidates} = {...DEFAULT_OPTIMIZE_COMPONENT_PORTS_OPTIONS, ...parameters};
  const weights = {...DEFAULT_CLUTTER_WEIGHTS, ...clutterWeights};

  // Preserves insertion order while removing duplicates
  const toUnique = (arr: number[]): number[] => {
    const result: number[] = [];
    const set = new Set<number>();
    arr.forEach((n) => {
      if (!set.has(n)) {
        set.add(n);
        result.push(n);
      }
    });
    return result;
  };

  // Converts trainrun ID array to score map (index = priority)
  const trainrunsToScore = (trainruns: number[]): Record<number, number> => {
    const scores: Record<number, number> = {};
    trainruns.forEach((id, index) => (scores[id] = index));
    return scores;
  };

  // Permutes trainrun ordering by replacing group positions with flattened group order.
  // Example: trainruns=[1,2,3,4], groups=[[3,4],[1,2]] -> [3,4,1,2]
  const reorderGroups = (trainruns: number[], groups: number[][]): number[] => {
    const reorderedIDs = toUnique(groups.flat());
    const set = new Set(reorderedIDs);
    let j = 0;
    return trainruns.map((v) => (set.has(v) ? reorderedIDs[j++] : v));
  };

  const initialTrainrunsOrder = toUnique(
    nodes.flatMap((node) => node.getTransitions().map((t) => t.getTrainrun().getId())),
  );

  let runs = 0;
  let bestClutter = Infinity;
  let bestCandidate: Candidate = {order: [], betweenFirst: new Set()};
  const candidates: Candidate[] = [{order: initialTrainrunsOrder, betweenFirst: new Set()}];

  while (runs++ <= maxRuns && candidates.length > 0) {
    const candidate = candidates.pop();

    reorderComponentPorts(nodes, trainrunsToScore(candidate.order), candidate.betweenFirst);
    const {crossings, groupCrossings} = countAllCrossings(nodes);
    const crossingsWithin = nodes.reduce((sum, node) => sum + countCrossingsInNode(node), 0);
    const {within: separationsWithin, between: separationsBetween} = countAllSeparations(nodes);
    const clutter =
      crossingsWithin * weights.crossingsWithin +
      (crossings - crossingsWithin) * weights.crossingsBetween +
      separationsWithin * weights.separationsWithin +
      separationsBetween * weights.separationsBetween;

    if (clutter < bestClutter) {
      bestCandidate = candidate;
      bestClutter = clutter;

      // Generate new candidates from worst crossings (reversed so worst is tried last/first-popped)
      const newCandidates = groupCrossings.slice(0, maxNewCandidates).toReversed();
      newCandidates.forEach((groupCrossing) => {
        candidates.push({
          order: reorderGroups(candidate.order, groupCrossing.groups),
          betweenFirst: candidate.betweenFirst,
        });
      });

      // Generate candidates that pull the largest separated bundles back together (only when their
      // weight is non-zero, so default crossings-only behavior is preserved exactly).
      if (weights.separationsWithin > 0 || weights.separationsBetween > 0) {
        getSeparationCandidates(nodes, candidate.order, {
          within: weights.separationsWithin > 0,
          between: weights.separationsBetween > 0,
        })
          .slice(0, maxNewCandidates)
          .forEach((order) => candidates.push({order, betweenFirst: candidate.betweenFirst}));
      }

      getBetweenFirstCandidates(nodes, candidate.betweenFirst, maxNewCandidates).forEach((id) =>
        candidates.push({
          order: candidate.order,
          betweenFirst: new Set([...candidate.betweenFirst, id]),
        }),
      );
    }
  }

  // Re-apply best result (last iteration may have been worse)
  reorderComponentPorts(nodes, trainrunsToScore(bestCandidate.order), bestCandidate.betweenFirst);
}

/**
 * This function sorts all ports in a given node, in a way that minimizes crossings as much as
 * possible. The strategy is described in detail within the function itself.
 *
 * The strategy to sort the ports on each side of the node is, for a pair of ports, to find the
 * first discriminating factor in the following list, and return accordingly:
 *
 * - If both ports have a transition in the node:
 *   1. Opposite port alignment within node
 *   2. Order of port on opposite side within node, if opposite side has already been ordered
 *
 * - If opposite nodes are different:
 *   3. Opposite node, sorted by position
 *
 * - If the other node has been ordered already (i.e. if it's in orderedNodeIDs):
 *   4a. Order of port in opposite node
 *
 * - Finally, if some trainrunScores input has been given:
 *   4b. Order using the trainrunScores tie-breaker
 *
 * When `betweenFirst` is true, the between-node discriminators (3, 4a) are consulted before the
 * within-node ones (1, 2): the node follows its neighbors even if that creates a within-node
 * crossing. This lets callers trade within-node crossings for fewer between-node crossings.
 */
export function reorderNodePorts(
  node: Node,
  orderedNodeIDs = new Set<number>(),
  trainrunScores: Record<number, number> = {},
  betweenFirst = false,
) {
  const transitions = node.getTransitions();
  const ports = node.getPorts();

  // Index all port transitions:
  const portTransitions = new Map<number, Transition>();
  transitions.forEach((t) => {
    portTransitions.set(t.getPortId1(), t);
    portTransitions.set(t.getPortId2(), t);
  });

  // Start with sides facing an already-ordered neighbor, so this node follows
  // that neighbor (case 4a) instead of locking to its own opposite side
  // (case 2):
  const facesOrderedNeighbor = (alignment: PortAlignment) =>
    ports.some(
      (port) =>
        port.getPositionAlignment() === alignment &&
        orderedNodeIDs.has(port.getOppositeNode(node.getId()).getId()),
    );
  const processingOrder = [
    ...ALIGNMENTS_CLOCKWISE_ORDER.filter(facesOrderedNeighbor),
    ...ALIGNMENTS_CLOCKWISE_ORDER.filter((alignment) => !facesOrderedNeighbor(alignment)),
  ];

  // For each side, order ports by transitions groups:
  const orderedSides = new Set<PortAlignment>();
  processingOrder.forEach((alignment) => {
    const sidePorts = ports.filter((port) => port.getPositionAlignment() === alignment);

    // Within-node discriminators (cases 1 & 2): null when undecided.
    const withinCmp = (a: Port, b: Port): number | null => {
      const aTransition = portTransitions.get(a.getId());
      const bTransition = portTransitions.get(b.getId());
      if (!aTransition || !bTransition) return null;

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
        // Case 2
        const swap = isElbowSwapped(alignment, aOppositeAlignment);
        return (
          (aOppositePort.getPositionIndex() - bOppositePort.getPositionIndex()) * (swap ? -1 : 1)
        );
      }
      return null;
    };

    // Between-node discriminators (cases 3 & 4a): null when undecided.
    const betweenCmp = (a: Port, b: Port): number | null => {
      const aOppositeNode = a.getOppositeNode(node.getId());
      const bOppositeNode = b.getOppositeNode(node.getId());

      if (aOppositeNode !== bOppositeNode) {
        // Case 3
        return isHorizontalAlignment(alignment)
          ? aOppositeNode.getPositionX() - bOppositeNode.getPositionX()
          : aOppositeNode.getPositionY() - bOppositeNode.getPositionY();
      }
      if (orderedNodeIDs.has(aOppositeNode.getId())) {
        // Case 4a
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
      return null;
    };

    // Case 4b: trainrunScores tie-breaker, always decisive.
    const tieBreakerCmp = (a: Port, b: Port): number => {
      const aTransition = portTransitions.get(a.getId());
      const aTrainrunId = a.getTrainrunSection().getTrainrunId();
      const bTrainrunId = b.getTrainrunSection().getTrainrunId();
      const aScore = trainrunScores[aTrainrunId] ?? aTrainrunId;
      const bScore = trainrunScores[bTrainrunId] ?? bTrainrunId;

      let swap = 1;
      if (aTransition) {
        const aOppositePort = node.getPort(aTransition.getOppositePort(a.getId()));
        if (aOppositePort.getPositionAlignment() === alignment) {
          const aOppositeNode = a.getOppositeNode(node.getId());
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
    };

    // betweenFirst consults between-node cases before within-node ones.
    const orderedCmps = betweenFirst ? [betweenCmp, withinCmp] : [withinCmp, betweenCmp];
    const compare = (a: Port, b: Port): number => {
      for (const cmp of orderedCmps) {
        const result = cmp(a, b);
        if (result !== null) return result;
      }
      return tieBreakerCmp(a, b);
    };

    // Transitions are ordered by geometry, free ends only by a tie-break score. Mixing both scales
    // in a single sort can contradict itself and flip two transitions (which would cross inside the
    // node), so we sort each kind separately, then insert the free end into the ordered transitions.
    const hasTransition = (p: Port) => portTransitions.has(p.getId());
    const transitionPorts = sidePorts.filter(hasTransition).sort(compare);
    const freeEndPorts = sidePorts.filter((p) => !hasTransition(p)).sort(compare);

    // Insert each free end before the first transition it should precede (or last if there is none)
    freeEndPorts.forEach((freeEnd) => {
      const at = transitionPorts.findIndex((p) => compare(freeEnd, p) < 0);
      transitionPorts.splice(at === -1 ? transitionPorts.length : at, 0, freeEnd);
    });

    // Apply new order
    transitionPorts.forEach((port, i) => port.setPositionIndex(i));

    orderedSides.add(alignment);
  });
}

function getNeighborsCount(node: Node): number {
  return new Set(node.getPorts().map((p) => getPortOppositeNodeId(p, node.getId()))).size;
}

/**
 * This function orders all ports across all nodes using BFS traversal from a root node. To see
 * exactly how ports are ordered in a single node (where the logic actually is), check
 * reorderNodePorts.
 */
function reorderComponentPorts(
  nodes: Node[],
  trainrunScores: Record<number, number> = {},
  betweenFirstNodeIDs = new Set<number>(),
): void {
  const nodesWithPorts = nodes.filter((n) => n.getPorts().length > 0);
  if (nodesWithPorts.length === 0) return;

  const nodeMap = new Map(nodesWithPorts.map((n) => [n.getId(), n]));
  const visited = new Set<number>();
  const root = nodesWithPorts.reduce((best, n) => {
    const bestNeighbors = getNeighborsCount(best);
    const nNeighbors = getNeighborsCount(n);
    if (nNeighbors !== bestNeighbors) return nNeighbors > bestNeighbors ? n : best;
    return n.getPorts().length > best.getPorts().length ? n : best;
  });
  const queue: number[] = [root.getId()];

  reorderNodePorts(root, visited, trainrunScores, betweenFirstNodeIDs.has(root.getId()));
  visited.add(root.getId());

  // BFS traversal
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const node = nodeMap.get(nodeId)!;

    for (const neighborId of new Set(
      node.getPorts().map((p) => getPortOppositeNodeId(p, nodeId)),
    )) {
      if (visited.has(neighborId)) continue;

      visited.add(neighborId);
      queue.push(neighborId);
      reorderNodePorts(
        nodeMap.get(neighborId),
        visited,
        trainrunScores,
        betweenFirstNodeIDs.has(neighborId),
      );
    }
  }

  if (visited.size !== nodesWithPorts.length) {
    throw new Error(
      `Input is not a connected component: reached ${visited.size}/${nodesWithPorts.length} nodes`,
    );
  }
}
