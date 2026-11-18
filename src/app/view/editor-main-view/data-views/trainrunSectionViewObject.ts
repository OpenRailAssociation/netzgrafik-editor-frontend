import {TrainrunSection} from "../../../models/trainrunsection.model";
import {TrainrunSectionText} from "../../../data-structures/technical.data.structures";
import {EditorView} from "./editor.view";
import {TrainrunSectionsView} from "./trainrunsections.view";
import {
  createTrainrunSectionKeyContext,
  TrainrunSectionKeyContext,
} from "./trainrunsection.key.context";

export class TrainrunSectionViewObject {
  readonly key: string;

  constructor(
    editorView: EditorView,
    readonly trainrunSection: TrainrunSection,
    ctx?: TrainrunSectionKeyContext,
  ) {
    this.key = TrainrunSectionViewObject.generateKey(editorView, trainrunSection, ctx);
  }

  static generateKey(
    editorView: EditorView,
    d: TrainrunSection,
    ctx: TrainrunSectionKeyContext = createTrainrunSectionKeyContext(editorView),
  ): string {
    const isNonStopAtSource = d.getSourceNode().isNonStop(d);
    const isNonStopAtTarget = d.getTargetNode().isNonStop(d);
    const isMuted = TrainrunSectionsView.isMuted(d, ctx.selectedTrainrun, ctx.connectedTrainIds);
    const hiddenTagSource = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      d,
      TrainrunSectionText.SourceDeparture,
    );
    const hiddenTagTarget = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      d,
      TrainrunSectionText.TargetDeparture,
    );
    const hiddenTagTravelTime = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      d,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const hiddenTagBackwardTravelTime = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      d,
      TrainrunSectionText.TrainrunSectionBackwardTravelTime,
    );
    const hiddenTagTrainrunName = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      d,
      TrainrunSectionText.TrainrunSectionName,
    );
    const cumulativeTravelTimeData = editorView.getCumulativeTravelTimeAndNodePath(
      d,
      "sourceToTarget",
    );
    const cumulativeTravelTime =
      cumulativeTravelTimeData[cumulativeTravelTimeData.length - 1].sumTravelTime;
    const cumulativeBackwardTravelTime = editorView.getCumulativeTravelTime(d, "targetToSource");
    const sourceFilters = ctx.getNodeFilters(d.getSourceNode());
    const targetFilters = ctx.getNodeFilters(d.getTargetNode());

    let key =
      "#" +
      d.getId() +
      "@" +
      d.getTrainrun().getTitle() +
      "_" +
      d.selected() +
      "_" +
      d.getTrainrun().selected() +
      "_" +
      d.getNumberOfStops() +
      "_" +
      d.getTravelTime() +
      "_" +
      cumulativeTravelTime +
      "_" +
      d.getBackwardTravelTime() +
      "_" +
      cumulativeBackwardTravelTime +
      "_" +
      ctx.timeDisplayPrecision +
      "_" +
      d.getTargetDeparture() +
      "_" +
      d.getTargetArrival() +
      "_" +
      d.getSourceDeparture() +
      "_" +
      d.getSourceArrival() +
      "_" +
      d.getTargetDepartureConsecutiveTime() +
      "_" +
      d.getTargetArrivalConsecutiveTime() +
      "_" +
      d.getSourceDepartureConsecutiveTime() +
      "_" +
      d.getSourceArrivalConsecutiveTime() +
      "_" +
      d.getNumberOfStops() +
      "_" +
      d.getTrainrun().getTrainrunCategory().shortName +
      "_" +
      d.getTrainrun().getTrainrunFrequency().shortName +
      "_" +
      d.getTrainrun().getTrainrunTimeCategory().shortName +
      "_" +
      d.getTrainrun().getTrainrunCategory().id +
      "_" +
      d.getTrainrun().getTrainrunFrequency().id +
      "_" +
      d.getTrainrun().getTrainrunTimeCategory().id +
      "_" +
      d.getTrainrun().getTrainrunCategory().colorRef +
      "_" +
      d.getTrainrun().getTrainrunFrequency().linePatternRef +
      "_" +
      d.getTrainrun().getTrainrunTimeCategory().linePatternRef +
      "_" +
      d.getTrainrun().getTrainrunFrequency().frequency +
      "_" +
      d.getTrainrun().getTrainrunFrequency().offset +
      "_" +
      d.getTrainrun().getDirection() +
      "_" +
      isNonStopAtSource +
      "_" +
      isNonStopAtTarget +
      "_" +
      isMuted +
      "_" +
      hiddenTagSource +
      "_" +
      hiddenTagTarget +
      "_" +
      hiddenTagTravelTime +
      "_" +
      hiddenTagBackwardTravelTime +
      "_" +
      hiddenTagTrainrunName +
      "_" +
      ctx.hiddenTagDirectionArrows +
      "_" +
      ctx.hiddenTagAsymmetryArrows +
      "_" +
      ctx.activeTrafficSideType +
      "_" +
      ctx.isTemporaryDisableFilteringOfItemsInViewEnabled +
      "_" +
      ctx.isFilterShowNonStopTimeEnabled +
      "_" +
      sourceFilters.checkFilterNonStop +
      "_" +
      targetFilters.checkFilterNonStop +
      "_" +
      sourceFilters.isJunction +
      "_" +
      targetFilters.isJunction +
      "_" +
      sourceFilters.checkFilter +
      "_" +
      targetFilters.checkFilter +
      "_" +
      ctx.isFilterDirectionArrowsEnabled +
      "_" +
      ctx.displayNodesFullName +
      "_" +
      ctx.levelOfDetail +
      "_" +
      ctx.variantIsWritable;

    cumulativeTravelTimeData.forEach((data) => {
      const filters = ctx.getNodeFilters(data.node);
      key += "_" + data.node.getId();
      key += "_" + filters.isJunction;
      key += "_" + filters.checkFilterNonStop;
      key += "_" + filters.checkFilter;
    });

    d.getPath().forEach((p) => {
      key += p.toString();
    });
    return key;
  }
}
