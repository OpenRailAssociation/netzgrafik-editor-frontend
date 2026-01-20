import {Node} from "../../models/node.model";
import {PortAlignment} from "../../data-structures/technical.data.structures";

export const ALIGNMENTS_CLOCKWISE_ORDER = [
  PortAlignment.Top,
  PortAlignment.Right,
  PortAlignment.Bottom,
  PortAlignment.Left,
];
export const ALIGNMENTS_CLOCKWISE_SCORES = new Map(
  ALIGNMENTS_CLOCKWISE_ORDER.map((alignment, index) => [alignment, index]),
);
export const SWAPPED_ALIGNMENTS = new Set([PortAlignment.Bottom, PortAlignment.Left]);

/**
 * This function returns true if an alignment describes ports that are aligned horizontally. Weirdly
 * enough, this matches PortAlignment.Top and PortAlignment.Bottom.
 */
export function isHorizontalAlignment(a: PortAlignment) {
  return a === PortAlignment.Top || a === PortAlignment.Bottom;
}

/**
 * This function counts all crossings within a node.
 */
export function countCrossings(node: Node): number {
  let crossings = 0;
  const transitions = node.getTransitions();
  for (let i = 0; i < transitions.length - 1; i++) {
    const t1 = transitions[i];

    for (let j = i + 1; j < transitions.length; j++) {
      const t2 = transitions[j];

      /**
       * Here is what a node looks like:
       *       0 1 … n
       *     ┌─────────┐
       *   0 │         │ 0
       *   1 │         │ 1
       *   … │         │ …
       *   n │         │ n
       *     └─────────┘
       *       0 1 … n
       *
       * To detect if two transitions cross in a node, we rotate around the node and note each port
       * when we cross them, starting from the top left, and rotating clockwise. Bottom and left
       * ports are met backwards, so we have to reverse their position index order.
       *
       * Then, we end up with an array with 4 ports. The two transitions do cross when they
       * alternate in the array, so if the first and third ports refer to the same trainrun section.
       */
      const sortedPorts = [t1, t2]
        .flatMap((transition) =>
          [node.getPort(transition.getPortId1()), node.getPort(transition.getPortId2())].map(
            (port) => ({
              transition,
              port,
            }),
          ),
        )
        .sort((a, b) => {
          const aAlignment = a.port.getPositionAlignment();
          const bAlignment = b.port.getPositionAlignment();

          if (aAlignment !== bAlignment) {
            return (
              ALIGNMENTS_CLOCKWISE_SCORES.get(aAlignment) -
              ALIGNMENTS_CLOCKWISE_SCORES.get(bAlignment)
            );
          }

          const swap = SWAPPED_ALIGNMENTS.has(aAlignment);
          const aIndex = a.port.getPositionIndex();
          const bIndex = b.port.getPositionIndex();
          return (aIndex - bIndex) * (swap ? -1 : 1);
        });

      if (sortedPorts[0].transition === sortedPorts[2].transition) {
        crossings++;
      }
    }
  }

  return crossings;
}
