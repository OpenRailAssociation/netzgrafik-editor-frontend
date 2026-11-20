import {Node} from "../../../models/node.model";
import {LevelOfDetail} from "../../../services/ui/level.of.detail.service";
import {TrafficSide} from "../../../data-structures/business.data.structures";
import {EditorView} from "./editor.view";

export interface NodeFilters {
  isJunction: boolean;
  checkFilterNonStop: boolean;
  checkFilter: boolean;
}

export interface TrainrunSectionKeyContext {
  timeDisplayPrecision: number;
  hiddenTagDirectionArrows: boolean;
  hiddenTagAsymmetryArrows: boolean;
  activeTrafficSideType: TrafficSide;
  isTemporaryDisableFilteringOfItemsInViewEnabled: boolean;
  isFilterShowNonStopTimeEnabled: boolean;
  isFilterDirectionArrowsEnabled: boolean;
  displayNodesFullName: boolean;
  levelOfDetail: LevelOfDetail;
  variantIsWritable: boolean;
  getNodeFilters: (node: Node) => NodeFilters;
}

// Values shared by all trainrun section keys of one rendering pass, computed once
export const createTrainrunSectionKeyContext = (
  editorView: EditorView,
): TrainrunSectionKeyContext => {
  const isTemporaryDisableFilteringOfItemsInViewEnabled =
    editorView.isTemporaryDisableFilteringOfItemsInViewEnabled();
  const isFilterDirectionArrowsEnabled = editorView.isFilterDirectionArrowsEnabled();
  const nodeFilters = new Map<number, NodeFilters>();

  return {
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
