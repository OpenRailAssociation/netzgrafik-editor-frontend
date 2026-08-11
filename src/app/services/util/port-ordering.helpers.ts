import {PortAlignment} from "../../data-structures/technical.data.structures";

// These two structures help iterating or sorting the alignments, clockwise:
export const ALIGNMENTS_CLOCKWISE_ORDER = [
  PortAlignment.Top,
  PortAlignment.Right,
  PortAlignment.Bottom,
  PortAlignment.Left,
];
export const ALIGNMENTS_CLOCKWISE_SCORES = new Map(
  ALIGNMENTS_CLOCKWISE_ORDER.map((alignment, index) => [alignment, index]),
);

// This set marks the alignments in which the ports are ordered counterclockwise:
export const COUNTERCLOCKWISE_ALIGNMENTS = new Set([PortAlignment.Bottom, PortAlignment.Left]);

/**
 * This function returns true when the elbow described by the two input alignments must have swapped
 * orders, in order to have non-crossing paths. Basically, it's true if the elbow is top+right or
 * left+bottom.
 *
 * The reason we need this is that ports are not ordered clockwise or counterclockwise, but they
 * have the same order on facing sides (it's a local convention):
 *
 *                      (clockwise)
 *                          0 1
 *                        ┌─────┐
 *   (counterclockwise) 0 │     │ 0 (clockwise)
 *                      1 │     │ 1
 *                        └─────┘
 *                          0 1
 *                   (counterclockwise)
 *
 * That means that, when joining top and right, or left and bottom, we need to swap the ports order
 * in order to minimize the amount of crossings.
 */
export function isElbowSwapped(from: PortAlignment, to: PortAlignment): boolean {
  return COUNTERCLOCKWISE_ALIGNMENTS.has(from) === COUNTERCLOCKWISE_ALIGNMENTS.has(to);
}

/**
 * This function returns true if an alignment describes ports that are aligned horizontally. Weirdly
 * enough, this matches PortAlignment.Top and PortAlignment.Bottom.
 */
export function isHorizontalAlignment(a: PortAlignment) {
  return a === PortAlignment.Top || a === PortAlignment.Bottom;
}

/**
 * These two maps describe how to sort ports on a given node side, relatively to the alignment of
 * the opposite port of each port's transition, in order to minimize crossings within the node.
 *
 * For instance, if the ports are horizontally aligned, we want the ports connected to transitions
 * to left ports on the left, ports connected to transitions to right ports on the right, and the
 * other ports in between, as the following diagram shows:
 *
 *  ┌──┬┬─┬┬──┐
 *  │  ││▲││  │
 *  │◄─┘└┘│└─►│
 *  │     ▼   │
 *  └─────────┘
 */
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
 * This function helps to sort all alignments opposite of a given alignment, based on the two
 * previously described maps:
 */
export function getOppositeAlignmentScore(
  alignment: PortAlignment,
  opposite: PortAlignment,
): number {
  const scores = isHorizontalAlignment(alignment)
    ? HORIZONTAL_OPPOSITE_SCORES
    : VERTICAL_OPPOSITE_SCORES;
  return scores.get(opposite);
}
