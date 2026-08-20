import {Node} from "../../models/node.model";
import {getBundleReferenceOrder, getClutterBundles} from "./port-ordering.bundles";

export type Candidate = {
  order: number[];
  betweenFirst: Set<number>;
  root: number;
  source?: string;
};

export type CandidateStats = Record<
  string,
  {tried: number; improved: number; gain: number; deduped: number}
>;

export const getStatsEntry = (stats: CandidateStats, source: string) =>
  (stats[source] = stats[source] ?? {tried: 0, improved: 0, gain: 0, deduped: 0});

/**
 * Gathers the bundle's members into one contiguous block, laid out in `referenceOrder` (repairs
 * separation and crossings at once). The block starts at the members' first slot, or ends at their
 * last slot when `atLast` is set.
 *
 * Example:
 * order [x, A, y, B, z, C], referenceOrder [C, B, A]
 * -> [x, C, B, A, y, z] ([x, y, z, C, B, A] with atLast)
 */
function arrangeBundleTogetherInOrder(
  order: number[],
  referenceOrder: number[],
  atLast = false,
): number[] {
  const members = new Set(referenceOrder);
  const firstIndex = order.findIndex((trainrunId) => members.has(trainrunId));
  if (firstIndex === -1) return order;
  const rest = order.filter((trainrunId) => !members.has(trainrunId));
  const at = atLast
    ? order.findLastIndex((trainrunId) => members.has(trainrunId)) - referenceOrder.length + 1
    : firstIndex;
  rest.splice(at, 0, ...referenceOrder);
  return rest;
}

/**
 * Gathers the bundle's members into one contiguous block, keeping their current relative order
 * (repairs separation only, leaving crossings untouched). The block starts at the members' first
 * slot, or ends at their last slot when `atLast` is set.
 *
 * Example:
 * order [x, A, y, B, z, C], members {A, B, C}
 * -> [x, A, B, C, y, z] ([x, y, z, A, B, C] with atLast)
 */
export function arrangeBundleTogether(
  order: number[],
  members: Set<number>,
  atLast = false,
): number[] {
  const block = order.filter((trainrunId) => members.has(trainrunId));
  if (block.length === 0) return order;
  const rest = order.filter((trainrunId) => !members.has(trainrunId));
  const at = atLast
    ? order.findLastIndex((trainrunId) => members.has(trainrunId)) - block.length + 1
    : order.findIndex((trainrunId) => members.has(trainrunId));
  rest.splice(at, 0, ...block);
  return rest;
}

/**
 * Reverses the members occupying the slots between the first and last misplaced members (relative
 * to `referenceOrder`), leaving well-placed members outside that window and all non-members alone.
 * It flips the current sequence rather than repainting it, so the result only matches
 * `referenceOrder` when the misplaced window was exactly reversed.
 *
 * Example:
 * order [x, A, C, y, D, B], referenceOrder [A, B, C, D]
 * -> [x, A, B, y, D, C] (A well-placed and untouched, the [C, D, B] window flipped to [B, D, C])
 */
export function arrangeBundleSegmentReversed(order: number[], referenceOrder: number[]): number[] {
  const members = new Set(referenceOrder);
  const slots: number[] = [];
  order.forEach((id, i) => {
    if (members.has(id)) slots.push(i);
  });
  const sequence = slots.map((i) => order[i]);
  const misplaced = sequence.flatMap((id, i) => (id !== referenceOrder[i] ? [i] : []));
  if (misplaced.length === 0) return order;

  const from = misplaced[0];
  const to = misplaced[misplaced.length - 1];
  const result = [...order];
  for (let i = from; i <= to; i++) result[slots[i]] = sequence[to - (i - from)];
  return result;
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
    source: "gather-at-last",
    kind: "separation",
    build: ({order, members}) => arrangeBundleTogether(order, members, true),
  },
  {
    source: "segment-reversal",
    kind: "crossing",
    build: ({order, reference}) => arrangeBundleSegmentReversed(order, reference),
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
          root: base.root,
          source: betweenFirst === betweenFirstWithBroken ? `${source} (betweenFirst)` : source,
        }),
      );
    });
  });

  return candidates;
}
