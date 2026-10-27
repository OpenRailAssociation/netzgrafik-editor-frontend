import {PathItem} from "../model/pathItem";
import {PathSection} from "../model/pathSection";

/**
 * Merges PathItem arrays across collapsed intermediate nodes:
 * - Intermediate collapsed nodes: adjacent sections are merged, numberOfStops
 *   are summed, and incremented
 * - Edge collapsed nodes (leftmost/rightmost): treated as filtered nodes
 *
 * Why collapsed nodes reuse the "filter" flag for edge nodes:
 * The Streckengrafik rendering already handles "filtered" nodes by giving their
 * adjacent sections a fixed width (see PathSection.xPathFix). Collapsed edge
 * nodes need exactly the same visual treatment: they sit outside the visible
 * corridor and their sections should not scale with travel time. Rather than
 * duplicating that rendering logic, we convert edge collapsed nodes to filtered
 * ones so the existing rendering pipeline handles them correctly.
 */
export function collapsePathItems(pathItems: PathItem[]): PathItem[] {
  if (pathItems.length === 0) return pathItems;

  const forwardItems = pathItems.filter((item) => !item.backward);
  const backwardItems = pathItems.filter((item) => item.backward);

  const collapsedForward = collapseDirectionalPathItems(forwardItems);
  const collapsedBackward = collapseDirectionalPathItems(backwardItems);

  return [...collapsedForward, ...collapsedBackward];
}

function collapseDirectionalPathItems(items: PathItem[]): PathItem[] {
  if (items.length === 0) return items;

  // Mark edge collapsed nodes as filtered instead of collapsed
  markEdgeCollapsedAsFiltered(items);

  // Merge sections across collapsed intermediate nodes
  return mergeCollapsedIntermediateNodes(items);
}

function isNodeVisible(item: PathItem): boolean {
  return item.isNode() && !item.getPathNode().collapsed && !item.getPathNode().filter;
}

function markEdgeCollapsedAsFiltered(items: PathItem[]): void {
  const firstVisibleIdx = items.findIndex(isNodeVisible);
  const lastVisibleIdx = findLastIndex(items, isNodeVisible);

  if (firstVisibleIdx < 0) {
    // All nodes are collapsed/filtered: keep first and last non-filtered as visible anchors
    const firstCollapsedIdx = items.findIndex(
      (item) => item.isNode() && item.getPathNode().collapsed,
    );
    const lastCollapsedIdx = findLastIndex(
      items,
      (item) => item.isNode() && item.getPathNode().collapsed,
    );
    if (firstCollapsedIdx >= 0) {
      items[firstCollapsedIdx].getPathNode().collapsed = false;
    }
    if (lastCollapsedIdx >= 0 && lastCollapsedIdx !== firstCollapsedIdx) {
      items[lastCollapsedIdx].getPathNode().collapsed = false;
    }
    return;
  }

  for (let i = 0; i < items.length; i++) {
    if (!items[i].isNode()) continue;
    const node = items[i].getPathNode();
    if (!node.collapsed) continue;

    // Edge node: before first visible or after last visible
    if (i < firstVisibleIdx || i > lastVisibleIdx) {
      node.filter = true;
      node.collapsed = false;
    }
  }
}

function mergeCollapsedIntermediateNodes(items: PathItem[]): PathItem[] {
  const result: PathItem[] = [];
  let pendingSection: PathSection | undefined;
  let collapsedStopsCount = 0;

  for (const item of items) {
    if (item.isNode()) {
      const node = item.getPathNode();

      if (node.collapsed) {
        // Intermediate collapsed node: accumulate into pending section
        collapsedStopsCount++;
        // Don't push this node to result
        continue;
      }

      // Visible node: flush any pending merged section before it
      if (pendingSection) {
        pendingSection.numberOfStops += collapsedStopsCount;
        result.push(pendingSection);
        pendingSection = undefined;
        collapsedStopsCount = 0;
      }
      result.push(item);
    }

    if (item.isSection()) {
      const section = item.getPathSection();

      if (pendingSection) {
        // There's already a pending section (previous section was followed by a collapsed node).
        // Merge this section into the pending one.
        pendingSection = mergeSections(pendingSection, section);
      } else {
        pendingSection = section;
      }
    }
  }

  // Flush any remaining pending section
  if (pendingSection) {
    pendingSection.numberOfStops += collapsedStopsCount;
    result.push(pendingSection);
  }

  return result;
}

function mergeSections(first: PathSection, second: PathSection): PathSection {
  return new PathSection(
    first.trainrunSectionId,
    first.departureTime,
    second.arrivalTime,
    first.numberOfStops + second.numberOfStops,
    first.trackData,
    first.backward,
    first.departureBranchEndNode,
    second.arrivalBranchEndNode,
    first.trainrunBranchType,
    first.departurePathNode,
    second.arrivalPathNode,
    first.isFilteredDepartureNode,
    second.isFilteredArrivalNode,
    first.isPartOfTemplatePath,
    first.oppDirectionTemplatePath,
  );
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}
