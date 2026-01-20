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

/**
 * This function counts all relevant crossings, given a set of nodes. It counts different types of
 * crossings:
 * 1. Between transitions within each node
 * 2. Between parallel trainrun sections - with both same extremities, thus same alignments
 * 3. Between trainrun sections that share exactly one extremity - same node, AND same alignment
 *
 * It does not count crossings between trainruns that don't share any extremity.
 */
export function countAllCrossings(nodes: Node[]): number {
  let crossingsCase1 = 0;
  let crossingsCase2 = 0;
  let crossingsCase3 = 0;

  nodes.forEach((node) => {
    // Case 1: Crossings within nodes:
    crossingsCase1 += countCrossings(node);

    ALIGNMENTS_CLOCKWISE_ORDER.forEach((alignment) => {
      const ports = node.getPorts().filter((port) => port.getPositionAlignment() === alignment);

      for (let i = 0; i < ports.length - 1; i++) {
        const port1 = ports[i];
        const opposite1Node = port1.getOppositeNode(node.getId());

        for (let j = i + 1; j < ports.length; j++) {
          const port2 = ports[j];
          const opposite2Node = port2.getOppositeNode(node.getId());

          const isPort1AfterPort2 = port1.getPositionIndex() > port2.getPositionIndex();

          // Case 2: Two exactly parallel trainrun sections:
          if (opposite1Node === opposite2Node) {
            // This test prevents these pairs to be counted twice
            // (on each extremity):
            if (node.getId() < opposite1Node.getId()) {
              const port1SectionId = port1.getTrainrunSectionId();
              const opposite1Port = opposite1Node
                .getPorts()
                .find((port) => port.getTrainrunSectionId() === port1SectionId);

              const port2SectionId = port2.getTrainrunSectionId();
              const opposite2Port = opposite2Node
                .getPorts()
                .find((port) => port.getTrainrunSectionId() === port2SectionId);

              const isOpposite1AfterOpposite2 =
                opposite1Port.getPositionIndex() > opposite2Port.getPositionIndex();
              if (isPort1AfterPort2 !== isOpposite1AfterOpposite2) crossingsCase2++;
            }
          }

          // Case 3: Two trainrun sections that share one extremity:
          else {
            const relevantDimension = isHorizontalAlignment(alignment)
              ? ("getPositionX" as const)
              : ("getPositionY" as const);

            const isOpposite1AfterOpposite2 =
              opposite1Node[relevantDimension]() > opposite2Node[relevantDimension]();
            if (isPort1AfterPort2 !== isOpposite1AfterOpposite2) crossingsCase3++;
          }
        }
      }
    });
  });

  return crossingsCase1 + crossingsCase2 + crossingsCase3;
}
