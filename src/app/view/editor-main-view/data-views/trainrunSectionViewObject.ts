import {TrainrunSection} from "../../../models/trainrunsection.model";
import {TrainrunSectionText} from "../../../data-structures/technical.data.structures";
import {EditorView} from "./editor.view";
import {TrainrunSectionsView} from "./trainrunsections.view";

export class TrainrunSectionViewObject {
  readonly key: string;

  constructor(
    private editorView: EditorView,
    readonly trainrunSection: TrainrunSection,
  ) {
    this.key = TrainrunSectionViewObject.generateKey(editorView, trainrunSection);
  }

  static generateKey(editorView: EditorView, d: TrainrunSection): string {
    const selectedTrainrun = editorView.getSelectedTrainrun();
    let connectedTrainIds = [];
    if (selectedTrainrun !== null) {
      connectedTrainIds = editorView.getConnectedTrainrunIds(selectedTrainrun);
    }

    const isNonStopAtSource = d.getSourceNode().isNonStop(d);
    const isNonStopAtTarget = d.getTargetNode().isNonStop(d);
    const isMuted = TrainrunSectionsView.isMuted(d, selectedTrainrun, connectedTrainIds);
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
    const hiddenTagDirectionArrows =
      !editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() &&
      !editorView.isFilterDirectionArrowsEnabled();
    const cumulativeTravelTimeData = editorView.getCumulativeTravelTimeAndNodePath(d);
    const cumulativeTravelTime =
      cumulativeTravelTimeData[cumulativeTravelTimeData.length - 1].sumTravelTime;
    const cumulativeBackwardTravelTimeData =
      editorView.getCumulativeBackwardTravelTimeAndNodePath(d);
    const cumulativeBackwardTravelTime =
      cumulativeBackwardTravelTimeData[cumulativeBackwardTravelTimeData.length - 1].sumTravelTime;

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
      editorView.getTimeDisplayPrecision() +
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
      hiddenTagDirectionArrows +
      "_" +
      editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() +
      "_" +
      editorView.isFilterShowNonStopTimeEnabled() +
      "_" +
      editorView.checkFilterNonStopNode(d.getSourceNode()) +
      "_" +
      editorView.checkFilterNonStopNode(d.getTargetNode()) +
      "_" +
      editorView.isJunctionNode(d.getSourceNode()) +
      "_" +
      editorView.isJunctionNode(d.getTargetNode()) +
      "_" +
      editorView.checkFilterNode(d.getSourceNode()) +
      "_" +
      editorView.checkFilterNode(d.getTargetNode()) +
      "_" +
      editorView.isFilterDirectionArrowsEnabled() +
      "_" +
      editorView.getLevelOfDetail() +
      "_" +
      editorView.trainrunSectionPreviewLineView.getVariantIsWritable();

    cumulativeTravelTimeData.forEach((data) => {
      key += "_" + data.node.getId();
      key += "_" + editorView.isJunctionNode(data.node);
      key += "_" + editorView.checkFilterNonStopNode(data.node);
      key += "_" + editorView.checkFilterNode(data.node);
    });

    cumulativeBackwardTravelTimeData.forEach((data) => {
      key += "_" + data.node.getId();
      key += "_" + editorView.isJunctionNode(data.node);
      key += "_" + editorView.checkFilterNonStopNode(data.node);
      key += "_" + editorView.checkFilterNode(data.node);
    });

    d.getPath().forEach((p) => {
      key += p.toString();
    });
    return key;
  }
}
