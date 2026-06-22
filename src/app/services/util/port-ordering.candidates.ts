import {Node} from "../../models/node.model";
import {getBundleReferenceOrder, getClutterBundles} from "./port-ordering.bundles";

export type Candidate = {order: number[]; betweenFirst: Set<number>};

/**
 * Resequences the bundle's members to `referenceOrder`, but leaves each in its current slot
 * (repairs crossings without gathering the bundle).
 *
 * Example:
 * order [x, A, y, B, z, C], referenceOrder [C, B, A]
 * -> [x, C, y, B, z, A]
 */
function arrangeBundleInPlace(order: number[], referenceOrder: number[]): number[] {
  const members = new Set(referenceOrder);
  let j = 0;
  return order.map((trainrunId) => (members.has(trainrunId) ? referenceOrder[j++] : trainrunId));
}

/**
 * Gathers the bundle's members into one contiguous block at their first slot, keeping their current
 * relative order (repairs separation only, leaving crossings untouched).
 *
 * Example:
 * order [x, A, y, B, z, C], members {A, B, C}
 * -> [x, A, B, C, y, z]
 */
function arrangeBundleTogether(order: number[], members: Set<number>): number[] {
  const firstIndex = order.findIndex((trainrunId) => members.has(trainrunId));
  if (firstIndex === -1) return order;
  const block = order.filter((trainrunId) => members.has(trainrunId));
  const rest = order.filter((trainrunId) => !members.has(trainrunId));
  rest.splice(firstIndex, 0, ...block);
  return rest;
}

/**
 * Gathers the bundle's members into one contiguous block at their first slot, laid out in
 * `referenceOrder` (repairs separation and crossings at once).
 *
 * Example:
 * order [x, A, y, B, z, C], referenceOrder [C, B, A]
 * -> [x, C, B, A, y, z]
 */
function arrangeBundleTogetherInOrder(order: number[], referenceOrder: number[]): number[] {
  const members = new Set(referenceOrder);
  const firstIndex = order.findIndex((trainrunId) => members.has(trainrunId));
  if (firstIndex === -1) return order;
  const rest = order.filter((trainrunId) => !members.has(trainrunId));
  rest.splice(firstIndex, 0, ...referenceOrder);
  return rest;
}

/**
 * Identifies most-broken bundles, and emits for each of them a set of candidates.
 *
 * For each bundle, it emits ten reorderings:
 * - separation-repair
 * - crossing-repair (normal order + reversed)
 * - both-at-once (normal order + reversed)
 * - each the above, with the nodes where the bundle breaks flagged as `betweenFirst`
 *
 * The candidates are returned with the ones supposed to be the more effective last. The two option
 * flags prioritizeSeparation and prioritizeWithin determine what the more effective orders are.
 */
export function getCandidates(
  nodes: Node[],
  base: Candidate,
  {
    maxBundles = 4,
    prioritizeSeparation = false,
    prioritizeWithin = false,
  }: {maxBundles?: number; prioritizeSeparation?: boolean; prioritizeWithin?: boolean} = {},
): Candidate[] {
  const bundles = getClutterBundles(nodes)
    .sort((a, b) => b.brokenAt.size - a.brokenAt.size || b.trainruns.size - a.trainruns.size)
    .slice(0, maxBundles);

  const orderedTrainruns = new Set(base.order);
  const candidates: Candidate[] = [];

  bundles.reverse().forEach(({trainruns, brokenAt}) => {
    const referenceOrder = getBundleReferenceOrder(nodes, trainruns, base.order).filter((id) =>
      orderedTrainruns.has(id),
    );
    if (referenceOrder.length < 2) return;
    const reversedOrder = [...referenceOrder].reverse();
    const betweenFirstWithBroken = new Set([...base.betweenFirst, ...brokenAt]);

    const separationRepair = [arrangeBundleTogether(base.order, trainruns)];
    const crossingRepair = [
      arrangeBundleInPlace(base.order, reversedOrder),
      arrangeBundleInPlace(base.order, referenceOrder),
    ];
    const bothRepair = [
      arrangeBundleTogetherInOrder(base.order, reversedOrder),
      arrangeBundleTogetherInOrder(base.order, referenceOrder),
    ];

    // both-at-once (fixes crossings and separations together) is always explored first, and the
    // prioritizeSeparation flag decides which single-purpose repair the search tries next.
    const orders = prioritizeSeparation
      ? [...crossingRepair, ...separationRepair, ...bothRepair]
      : [...separationRepair, ...crossingRepair, ...bothRepair];

    // prioritizeWithin explores plain candidates first, otherwise the between-first ones (which
    // make broken nodes follow their neighbors)
    const betweenVariants = prioritizeWithin
      ? [betweenFirstWithBroken, base.betweenFirst]
      : [base.betweenFirst, betweenFirstWithBroken];

    orders.forEach((order) => {
      betweenVariants.forEach((betweenFirst) => candidates.push({order, betweenFirst}));
    });
  });

  return candidates;
}
