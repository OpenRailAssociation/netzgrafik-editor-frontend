import {Node} from "../../../models/node.model";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {EditorView} from "./editor.view";

// Values shared by all trainrun section keys of one rendering pass, computed once
export const createTrainrunSectionKeyContext = (editorView: EditorView) => {
  const selectedTrainrun = editorView.getSelectedTrainrun();
  const isTemporaryDisableFilteringOfItemsInViewEnabled =
    editorView.isTemporaryDisableFilteringOfItemsInViewEnabled();
  const isFilterDirectionArrowsEnabled = editorView.isFilterDirectionArrowsEnabled();
  const nodeFilters = new Map<
    number,
    {isJunction: boolean; checkFilterNonStop: boolean; checkFilter: boolean}
  >();

  return {
    selectedTrainrun,
    connectedTrainIds:
      selectedTrainrun !== null ? editorView.getConnectedTrainrunIds(selectedTrainrun) : [],
    timeDisplayPrecision: editorView.getTimeDisplayPrecision(),
    hiddenTagDirectionArrows:
      !isTemporaryDisableFilteringOfItemsInViewEnabled && !isFilterDirectionArrowsEnabled,
    hiddenTagAsymmetryArrows: !editorView.isFilterAsymmetryArrowsEnabled(),
    activeTrafficSideType: editorView.getActiveTrafficSideType(),
    isTemporaryDisableFilteringOfItemsInViewEnabled,
    isFilterShowNonStopTimeEnabled: editorView.isFilterShowNonStopTimeEnabled(),
    isFilterDirectionArrowsEnabled,
    displayNodesFullName: editorView.displayNodesFullName(),
    levelOfDetail: editorView.getLevelOfDetail(),
    variantIsWritable: editorView.trainrunSectionPreviewLineView.getVariantIsWritable(),
    getNodeFilters: (node: Node) => {
      let filters = nodeFilters.get(node.getId());
      if (!filters) {
        filters = {
          isJunction: editorView.isJunctionNode(node),
          checkFilterNonStop: editorView.checkFilterNonStopNode(node),
          checkFilter: editorView.checkFilterNode(node),
        };
        nodeFilters.set(node.getId(), filters);
      }
      return filters;
    },
  };
};

export type TrainrunSectionKeyContext = ReturnType<typeof createTrainrunSectionKeyContext>;

// Same as getCumulativeTravelTime(d, "targetToSource"), reusing the path from
// getCumulativeTravelTimeAndNodePath(d, ...): both iterate the same sections
export const sumBackwardTravelTime = (path: {trainrunSection: TrainrunSection}[]) =>
  path
    .slice(1)
    .reduce((sum, {trainrunSection}) => sum + trainrunSection.getBackwardTravelTime(), 0);
