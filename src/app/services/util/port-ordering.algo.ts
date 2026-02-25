import {Node} from "../../models/node.model";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {Transition} from "../../models/transition.model";
import {
  ALIGNMENTS_CLOCKWISE_ORDER,
  countAllCrossings,
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
export function reorderNodePorts(
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
 * This function orders all ports across all nodes using BFS traversal from a root node. To see
 * exactly how ports are ordered in a single node (where the logic actually is), check
 * reorderNodePorts.
 */
export function reorderComponentPorts(
  nodes: Node[],
  trainrunsScores: Record<number, number> = {},
): void {
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

    reorderNodePorts(root, visited, trainrunsScores);
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
        reorderNodePorts(neighbor, visited, trainrunsScores);
      }
    }
  }
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
export function optimizeComponentPorts(
  nodes: Node[],
  parameters: Partial<OptimizeComponentPortsOptions> = {},
): void {
  const {maxRuns, maxNewCandidates} = {...DEFAULT_OPTIMIZE_COMPONENT_PORTS_OPTIONS, ...parameters};

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
  // Example: trainruns=[1,2,3,4], groups=[[3,4],[1,2]] → [3,4,1,2]
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
  let bestCrossings = Infinity;
  let bestCandidate: number[] = [];
  const candidates = [initialTrainrunsOrder];

  while (runs++ <= maxRuns && candidates.length > 0) {
    const candidate = candidates.pop();

    reorderComponentPorts(nodes, trainrunsToScore(candidate));
    const {crossings, groupCrossings} = countAllCrossings(nodes);

    if (crossings < bestCrossings) {
      bestCandidate = candidate;
      bestCrossings = crossings;

      // Generate new candidates from worst crossings (reversed so worst is tried last/first-popped)
      const newCandidates = groupCrossings.slice(0, maxNewCandidates).toReversed();
      newCandidates.forEach((groupCrossing) => {
        candidates.push(reorderGroups(candidate, groupCrossing.groups));
      });
    }
  }

  // Re-apply best result (last iteration may have been worse)
  reorderComponentPorts(nodes, trainrunsToScore(bestCandidate));
}

/**
 * This function orders all ports in all nodes to minimize crossings. It first calls
 * getConnectedComponents, and then optimizeComponentPorts on each connected component.
 */
export function optimizePorts(nodes: Node[]): void {
  const components = getConnectedComponents(nodes);
  components.forEach((componentNodes) => optimizeComponentPorts(componentNodes));
}
