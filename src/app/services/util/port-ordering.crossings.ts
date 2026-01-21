import {Node} from "../../models/node.model";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {Port} from "../../models/port.model";

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

export type Segments = number[] | number[][];

function normalizeSegments(input: Segments): number[][] {
  if (input.length === 0) return [];
  // If first element is a number, it's a flat array
  if (typeof input[0] === "number") {
    return [input as number[]];
  }
  return (input as number[][]).filter((a) => a.length);
}

/**
 * This function finds largest groups of elements that stay contiguous and in the same order in two
 * different "segment" inputs.
 *
 * Each segment input is either a number[] or a number[][]. It describes trainrun IDs, in their
 * order on the side of one or multiple nodes. Finding stable contiguous groups helps to find
 * permutation candidates, to globally reduce the amount of crossings.
 */
export function groupContiguous(a1: Segments, a2: Segments): number[][] {
  const segments1 = normalizeSegments(a1);
  const segments2 = normalizeSegments(a2);

  if (segments1.length === 0) return [];

  // Map each element to its segment index and global position (for a2)
  const info2 = new Map<number, {segment: number; pos: number}>();
  let globalPos = 0;
  segments2.forEach((segment, segIdx) => {
    segment.forEach((val) => {
      info2.set(val, {segment: segIdx, pos: globalPos++});
    });
  });

  // Same for a1
  const info1 = new Map<number, {segment: number; pos: number}>();
  globalPos = 0;
  segments1.forEach((segment, segIdx) => {
    segment.forEach((val) => {
      info1.set(val, {segment: segIdx, pos: globalPos++});
    });
  });

  // Flatten a1 for iteration
  const flat1 = segments1.flat();

  const result: number[][] = [];
  let currentGroup: number[] = [flat1[0]];

  for (let i = 1; i < flat1.length; i++) {
    const prev1 = info1.get(flat1[i - 1])!;
    const curr1 = info1.get(flat1[i])!;
    const prev2 = info2.get(flat1[i - 1])!;
    const curr2 = info2.get(flat1[i])!;

    const sameSegment1 = curr1.segment === prev1.segment;
    const sameSegment2 = curr2.segment === prev2.segment;
    const consecutive2 = curr2.pos === prev2.pos + 1;

    if (sameSegment1 && sameSegment2 && consecutive2) {
      currentGroup.push(flat1[i]);
    } else {
      result.push(currentGroup);
      currentGroup = [flat1[i]];
    }
  }

  result.push(currentGroup);
  return result;
}

/**
 * This function counts all intersections between two orderings of trainrun IDs:
 * - `direct` refers to crossings between trainrun sections that have exact same extremity nodes
 * - `indirect` refers to crossings between trainrun sections that only share one extremity node
 */
export function countCrossingsBetweenSides(
  a1: Segments,
  a2: Segments,
): {direct: number; indirect: number} {
  const flat1 = normalizeSegments(a1).flat();
  const segments2 = normalizeSegments(a2);

  // Build segment and position info for a2
  const info2 = new Map<number, {segment: number; posInSegment: number}>();
  segments2.forEach((segment, segIdx) => {
    segment.forEach((val, posInSegment) => {
      info2.set(val, {segment: segIdx, posInSegment});
    });
  });

  let direct = 0;
  let indirect = 0;

  // Compare all pairs from a1
  for (let i = 0; i < flat1.length - 1; i++) {
    for (let j = i + 1; j < flat1.length; j++) {
      const infoI = info2.get(flat1[i]);
      const infoJ = info2.get(flat1[j]);
      if (!infoI || !infoJ) continue;

      // In a1: i comes before j
      if (infoI.segment === infoJ.segment) {
        // Same opposite node → direct crossing if order inverted
        if (infoI.posInSegment > infoJ.posInSegment) direct++;
      } else {
        // Different opposite nodes → indirect crossing if segment order inverted
        if (infoI.segment > infoJ.segment) indirect++;
      }
    }
  }

  return {direct, indirect};
}

/**
 * This function counts all crossings within a node.
 */
export function countCrossingsInNode(node: Node): number {
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

export interface GroupCrossing {
  groups: number[][];
  crossings: number;
}

export interface CrossingsInfo {
  crossings: number;
  groupCrossings: GroupCrossing[];
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
export function countAllCrossings(nodes: Node[]): CrossingsInfo {
  const groupCrossings: GroupCrossing[] = [];
  let crossings = 0;

  nodes.forEach((node) => {
    const nodeId = node.getId();

    crossings += countCrossingsInNode(node);

    ALIGNMENTS_CLOCKWISE_ORDER.forEach((alignment) => {
      const relevantDimension = isHorizontalAlignment(alignment)
        ? ("getPositionX" as const)
        : ("getPositionY" as const);

      const ports = node
        .getPorts()
        .filter((port) => port.getPositionAlignment() === alignment)
        .sort((a, b) => a.getPositionIndex() - b.getPositionIndex());
      const oppositePortsPerNode: Record<number, {node: Node; port: Port}[]> = {};
      ports.forEach((port) => {
        const trainrunSectionId = port.getTrainrunSectionId();
        const oppositeNode = port.getOppositeNode(nodeId);
        const oppositeNodeID = oppositeNode.getId();
        const oppositePort = oppositeNode
          .getPorts()
          .find((p) => p.getTrainrunSectionId() === trainrunSectionId);

        oppositePortsPerNode[oppositeNodeID] = oppositePortsPerNode[oppositeNodeID] || [];
        oppositePortsPerNode[oppositeNodeID].push({
          node: oppositeNode,
          port: oppositePort,
        });
      });
      const oppositeNodes: {node: Node; ports: Port[]}[] = [];
      for (const nodeId in oppositePortsPerNode) {
        const node = oppositePortsPerNode[nodeId][0].node;
        const ports = oppositePortsPerNode[nodeId].map(({port}) => port);
        oppositeNodes.push({node, ports});
      }

      const portsTrainrunIDs = ports.map((port) => port.getTrainrunSection().getTrainrunId());
      const oppositePortsTrainrunIDs = oppositeNodes
        .toSorted((a, b) => a.node[relevantDimension]() - b.node[relevantDimension]())
        .map(({ports}) =>
          ports
            .toSorted((a, b) => a.getPositionIndex() - b.getPositionIndex())
            .map((port) => port.getTrainrunSection().getTrainrunId()),
        );

      // Count crossings:
      const {direct, indirect} = countCrossingsBetweenSides(
        portsTrainrunIDs,
        oppositePortsTrainrunIDs,
      );

      // Detect contiguous groups of nodes:
      const contiguous = groupContiguous(oppositePortsTrainrunIDs, portsTrainrunIDs);

      if (direct + indirect) {
        groupCrossings.push({
          crossings: direct + indirect,
          groups: contiguous,
        });
      }

      // Add local crossings to total count
      // (divide direct crossings by two, as these crossings will be counted twice)
      crossings += direct / 2 + indirect;
    });
  });

  return {crossings, groupCrossings: groupCrossings.toSorted((a, b) => b.crossings - a.crossings)};
}
