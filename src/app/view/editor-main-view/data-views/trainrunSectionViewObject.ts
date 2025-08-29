import {TrainrunSection} from "../../../models/trainrunsection.model";
import {EditorView} from "./editor.view";

export class TrainrunSectionViewObject {
  key: string;

  constructor(
    private editorView: EditorView,
    public trainrunSection: TrainrunSection,
    isNonStopAtSource: boolean,
    isNonStopAtTarget: boolean,
    isMuted: boolean,
    hiddenTagSource: boolean,
    hiddenTagTarget: boolean,
    hiddenTagTravelTime: boolean,
    hiddenTagBackwardTravelTime: boolean,
    hiddenTagTrainrunName: boolean,
    hiddenTagDirectionArrows: boolean,
    hiddenTagAsymmetryArrows: boolean,
  ) {
    this.key = TrainrunSectionViewObject.generateKey(
      editorView,
      trainrunSection,
      isNonStopAtSource,
      isNonStopAtTarget,
      isMuted,
      hiddenTagSource,
      hiddenTagTarget,
      hiddenTagTravelTime,
      hiddenTagBackwardTravelTime,
      hiddenTagTrainrunName,
      hiddenTagDirectionArrows,
      hiddenTagAsymmetryArrows,
    );
  }

  static generateKey(
    editorView: EditorView,
    d: TrainrunSection,
    isNonStopAtSource: boolean,
    isNonStopAtTarget: boolean,
    isMuted: boolean,
    hiddenTagSource: boolean,
    hiddenTagTarget: boolean,
    hiddenTagTravelTime: boolean,
    hiddenTagBackwardTravelTime: boolean,
    hiddenTagTrainrunName: boolean,
    hiddenTagDirectionArrows: boolean,
    hiddenTagAsymmetryArrows: boolean,
  ): string {
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
      d.getTargetArrival() +
      "_" +
      d.getTargetDepartureConsecutiveTime() +
      "_" +
      d.getTargetArrivalConsecutiveTime() +
      "_" +
      d.getSourceDepartureConsecutiveTime() +
      "_" +
      d.getTargetArrivalConsecutiveTime() +
      "_" +
      d.getNumberOfStops() +
      "_" +
      d.getFrequency() +
      "_" +
      d.getFrequencyOffset() +
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
      hiddenTagAsymmetryArrows +
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
