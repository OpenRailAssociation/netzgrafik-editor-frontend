import {Node} from "../../models/node.model";
import {getBundleReferenceOrder, getClutterBundles} from "./port-ordering.bundles";

export type Candidate = {order: number[]; betweenFirst: Set<number>; source?: string};

export type CandidateStats = Record<
  string,
  {tried: number; improved: number; gain: number; deduped: number}
>;

export const getStatsEntry = (stats: CandidateStats, source: string) =>
  (stats[source] = stats[source] ?? {tried: 0, improved: 0, gain: 0, deduped: 0});

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

type GeneratorKind = "separation" | "crossing" | "both";
type BundleContext = {
  order: number[];
  members: Set<number>;
  reference: number[];
  reversed: number[];
};

const CANDIDATE_GENERATORS: {
  source: string;
  kind: GeneratorKind;
  build: (context: BundleContext) => number[];
}[] = [
  {
    source: "gather-at-first",
    kind: "separation",
    build: ({order, members}) => arrangeBundleTogether(order, members),
  },
  {
    source: "in-place-reversed",
    kind: "crossing",
    build: ({order, reversed}) => arrangeBundleInPlace(order, reversed),
  },
  {
    source: "in-place-normal",
    kind: "crossing",
    build: ({order, reference}) => arrangeBundleInPlace(order, reference),
  },
  {
    source: "together-reversed",
    kind: "both",
    build: ({order, reversed}) => arrangeBundleTogetherInOrder(order, reversed),
  },
  {
    source: "together-normal",
    kind: "both",
    build: ({order, reference}) => arrangeBundleTogetherInOrder(order, reference),
  },
];

/**
 * Emits, for each most-broken bundle, one candidate per generator (see CANDIDATE_GENERATORS), in
 * two variants: plain, and with the bundle's broken nodes flagged as `betweenFirst`. Duplicate
 * orders keep only the highest-priority one. Supposedly better candidates come last (the search
 * explores from the end), as steered by the prioritizeSeparation and prioritizeWithin flags.
 */
export function getCandidates(
  nodes: Node[],
  base: Candidate,
  {
    maxBundles = 4,
    prioritizeSeparation = false,
    prioritizeWithin = false,
    stats,
  }: {
    maxBundles?: number;
    prioritizeSeparation?: boolean;
    prioritizeWithin?: boolean;
    stats?: CandidateStats;
  } = {},
): Candidate[] {
  const bundles = getClutterBundles(nodes)
    .sort((a, b) => b.brokenAt.size - a.brokenAt.size || b.trainruns.size - a.trainruns.size)
    .slice(0, maxBundles);

  const orderedTrainruns = new Set(base.order);
  const candidates: Candidate[] = [];
  const ranks: Record<GeneratorKind, number> = {
    both: 2,
    separation: prioritizeSeparation ? 1 : 0,
    crossing: prioritizeSeparation ? 0 : 1,
  };

  bundles.reverse().forEach(({trainruns, brokenAt}) => {
    const reference = getBundleReferenceOrder(nodes, trainruns, base.order).filter((id) =>
      orderedTrainruns.has(id),
    );
    if (reference.length < 2) return;
    const context: BundleContext = {
      order: base.order,
      members: trainruns,
      reference,
      reversed: [...reference].reverse(),
    };
    const betweenFirstWithBroken = new Set([...base.betweenFirst, ...brokenAt]);

    const allOrders = CANDIDATE_GENERATORS.map(({source, kind, build}) => ({
      source,
      kind,
      order: build(context),
    })).sort((a, b) => ranks[a.kind] - ranks[b.kind]);

    // Deduplicate orders:
    const seen = new Set<string>();
    const orders = [...allOrders]
      .reverse()
      .filter(({source, order}) => {
        const key = order.join(",");
        if (seen.has(key)) {
          // Both variants of the dropped generator (plain and betweenFirst) are never emitted:
          if (stats) {
            getStatsEntry(stats, source).deduped++;
            getStatsEntry(stats, `${source} (betweenFirst)`).deduped++;
          }
          return false;
        }
        seen.add(key);
        return true;
      })
      .reverse();

    // prioritizeWithin explores plain candidates first, otherwise the between-first ones (which
    // make broken nodes follow their neighbors)
    const betweenVariants = prioritizeWithin
      ? [betweenFirstWithBroken, base.betweenFirst]
      : [base.betweenFirst, betweenFirstWithBroken];

    orders.forEach(({source, order}) => {
      betweenVariants.forEach((betweenFirst) =>
        candidates.push({
          order,
          betweenFirst,
          source: betweenFirst === betweenFirstWithBroken ? `${source} (betweenFirst)` : source,
        }),
      );
    });
  });

  return candidates;
}
