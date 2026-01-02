import {TrainrunSection} from "../../../models/trainrunsection.model";
import {EditorView} from "./editor.view";

export class TrainrunSectionViewObject {
  readonly key: string;

  constructor(
    private editorView: EditorView,
    readonly trainrunSections: TrainrunSection[],
    isNonStopAtSource: boolean,
    isNonStopAtTarget: boolean,
    isMuted: boolean,
    hiddenTagSource: boolean,
    hiddenTagTarget: boolean,
    hiddenTagTraveltime: boolean,
    hiddenTagTrainrunName: boolean,
    hiddenTagDirectionArrows: boolean,
  ) {
    this.key = TrainrunSectionViewObject.generateKey(
      editorView,
      trainrunSections,
      isNonStopAtSource,
      isNonStopAtTarget,
      isMuted,
      hiddenTagSource,
      hiddenTagTarget,
      hiddenTagTraveltime,
      hiddenTagTrainrunName,
      hiddenTagDirectionArrows,
    );
  }

  getTrainrun() {
    return this.trainrunSections[0].getTrainrun();
  }

  getTravelTime(): number {
    if (this.trainrunSections.length === 1) {
      return this.trainrunSections[0].getTravelTime();
    }

    return this.trainrunSections.reduce((sum, section, index) => {
      let sectionTime = section.getTravelTime();

      // Add stop time at intermediate nodes (all except the last section)
      if (index < this.trainrunSections.length - 1) {
        const nextSection = this.trainrunSections[index + 1];
        const stopTime = Math.abs(
          nextSection.getSourceDepartureConsecutiveTime() -
            section.getTargetArrivalConsecutiveTime(),
        );
        sectionTime += stopTime;
      }

      return sum + sectionTime;
    }, 0);
  }

  static generateKey(
    editorView: EditorView,
    trainrunSections: TrainrunSection[],
    isNonStopAtSource: boolean,
    isNonStopAtTarget: boolean,
    isMuted: boolean,
    hiddenTagSource: boolean,
    hiddenTagTarget: boolean,
    hiddenTagTraveltime: boolean,
    hiddenTagTrainrunName: boolean,
    hiddenTagDirectionArrows: boolean,
  ): string {
    const d = trainrunSections[0];
    const cumulativeTravelTimeData = editorView.getCumulativeTravelTimeAndNodePath(d);
    const cumulativeTravelTime =
      cumulativeTravelTimeData[cumulativeTravelTimeData.length - 1].sumTravelTime;

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
      hiddenTagTraveltime +
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

    d.getPath().forEach((p) => {
      key += p.toString();
    });
    return key;
  }
}
