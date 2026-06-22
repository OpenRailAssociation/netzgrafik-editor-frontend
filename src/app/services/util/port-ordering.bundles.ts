import {Node} from "../../models/node.model";
import {countBetweenCrossingsAroundNode, transitionsCrossInNode} from "./port-ordering.crossings";
import {
  getSeparationPairsBetweenNodes,
  getSeparationPairsWithinNode,
} from "./port-ordering.separations";
import {groupBy} from "../../utils/collection";

type Pair = {trainrunId1: number; trainrunId2: number; nodeId: number};

type ClutterBundle = {trainruns: Set<number>; brokenAt: Set<number>};

/**
 * Groups the network's trainruns into bundles that "want to travel together", each tagged with the
 * nodes where that togetherness is currently broken.
 */
export function getClutterBundles(nodes: Node[]): ClutterBundle[] {
  // 1. Collect trainrun pairs:
  const pairs: Pair[] = [];
  nodes.forEach((node) => {
    const nodeId = node.getId();

    // Separations:
    // A pair drawn touching somewhere but pulled apart here
    [...getSeparationPairsWithinNode(node), ...getSeparationPairsBetweenNodes(node)].forEach(
      ([trainrunId1, trainrunId2]) => pairs.push({trainrunId1, trainrunId2, nodeId}),
    );

    // Crossing groups:
    // Contiguous neighbors stay bundled. Crossing trainruns land in DIFFERENT groups, so a crossing
    // never merges across the cross. So, sides merge only if parallel elsewhere.
    countBetweenCrossingsAroundNode(node).groupCrossings.forEach(({groups}) =>
      groups.forEach((group) => {
        for (let i = 0; i < group.length - 1; i++) {
          pairs.push({trainrunId1: group[i], trainrunId2: group[i + 1], nodeId});
        }
      }),
    );
  });

  // 2. Merge overlapping pairs:
  // Each trainrun ends up pointing at a single root trainrun, shared by its whole bundle
  const trainrunGroupIds = new Map<number, number>();
  const getTrainrunRoot = (trainrunId: number): number => {
    if (!trainrunGroupIds.has(trainrunId)) trainrunGroupIds.set(trainrunId, trainrunId);
    let root = trainrunId;
    while (trainrunGroupIds.get(root) !== root) root = trainrunGroupIds.get(root);
    trainrunGroupIds.set(trainrunId, root);
    return root;
  };
  pairs.forEach(({trainrunId1, trainrunId2}) =>
    trainrunGroupIds.set(getTrainrunRoot(trainrunId1), getTrainrunRoot(trainrunId2)),
  );

  // 3. Build one bundle per root, and map every trainrun to it (members sharing a root share the
  // same bundle object, so lookups below are plain gets and identity checks):
  const bundlesByTrainrunId = new Map<number, ClutterBundle>();
  [...trainrunGroupIds.keys()].forEach((trainrunId) => {
    const root = getTrainrunRoot(trainrunId);
    if (!bundlesByTrainrunId.has(root)) {
      bundlesByTrainrunId.set(root, {trainruns: new Set(), brokenAt: new Set()});
    }
    const bundle = bundlesByTrainrunId.get(root);
    bundle.trainruns.add(trainrunId);
    bundlesByTrainrunId.set(trainrunId, bundle);
  });

  // 4. Identify for each bundle what are the nodes that make it broken:
  // a. from the pairs that built the bundles (each pair marks its node on its bundle)
  pairs.forEach(({trainrunId1, nodeId}) =>
    // Either endpoint works here, since they share a bundle
    bundlesByTrainrunId.get(trainrunId1).brokenAt.add(nodeId),
  );

  // b. from within-node crossings between two members of the same bundle
  nodes.forEach((node) => {
    const transitions = node.getTransitions();
    for (let i = 0; i < transitions.length - 1; i++) {
      for (let j = i + 1; j < transitions.length; j++) {
        const bundle = bundlesByTrainrunId.get(transitions[i].getTrainrun().getId());
        const otherBundle = bundlesByTrainrunId.get(transitions[j].getTrainrun().getId());
        if (
          bundle &&
          bundle === otherBundle &&
          transitionsCrossInNode(node, transitions[i], transitions[j])
        ) {
          bundle.brokenAt.add(node.getId());
        }
      }
    }
  });

  // Only returns bundles with at least two trainruns:
  return [...new Set(bundlesByTrainrunId.values())];
}

/**
 * The order a bundle's members should follow, read off the node side that holds the most of them.
 * Members not on that side are appended in their current global order.
 */
export function getBundleReferenceOrder(
  nodes: Node[],
  trainruns: Set<number>,
  order: number[],
): number[] {
  let bestSideReading: number[] = [];
  nodes.forEach((node) =>
    groupBy(
      node.getPorts().filter((p) => trainruns.has(p.getTrainrunSection().getTrainrunId())),
      (p) => p.getPositionAlignment(),
    ).forEach((side) => {
      if (side.length > bestSideReading.length) {
        bestSideReading = [...side]
          .sort((a, b) => a.getPositionIndex() - b.getPositionIndex())
          .map((p) => p.getTrainrunSection().getTrainrunId());
      }
    }),
  );
  const seen = new Set(bestSideReading);
  return [...bestSideReading, ...order.filter((id) => trainruns.has(id) && !seen.has(id))];
}
