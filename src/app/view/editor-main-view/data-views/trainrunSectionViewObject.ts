import {TrainrunSectionTextPositions} from "../../../data-structures/technical.data.structures";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {SimpleTrainrunSectionRouter} from "../../../services/util/trainrunsection.routing";
import {Vec2D} from "../../../utils/vec2D";
import {EditorView} from "./editor.view";

export class TrainrunSectionViewObject {
  readonly key: string;
  readonly textPositions: TrainrunSectionTextPositions;

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
    this.key = this.generateKey(
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

    this.textPositions = SimpleTrainrunSectionRouter.placeTextOnTrainrunSection(
      this.getPath(),
      trainrunSections[0].getSourceNode().getPort(trainrunSections[0].getSourcePortId()),
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

  private generateKey(
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
    const trainrun = this.getTrainrun();
    const firstSection = trainrunSections[0];
    const lastSection = trainrunSections.at(-1);
    const cumulativeTravelTimeData = editorView.getCumulativeTravelTimeAndNodePath(firstSection);
    const cumulativeTravelTime =
      cumulativeTravelTimeData[cumulativeTravelTimeData.length - 1].sumTravelTime;

    let key =
      "#" +
      firstSection.getId() +
      "@" +
      this.getTrainrun().getTitle() +
      "_" +
      this.getTrainrun().selected() +
      "_" +
      firstSection.getNumberOfStops() +
      "_" +
      this.getTravelTime() +
      "_" +
      cumulativeTravelTime +
      "_" +
      editorView.getTimeDisplayPrecision() +
      "_" +
      lastSection.getTargetDeparture() +
      "_" +
      lastSection.getTargetArrival() +
      "_" +
      firstSection.getSourceDeparture() +
      "_" +
      firstSection.getSourceArrival() +
      "_" +
      lastSection.getTargetDepartureConsecutiveTime() +
      "_" +
      lastSection.getTargetArrivalConsecutiveTime() +
      "_" +
      firstSection.getSourceDepartureConsecutiveTime() +
      "_" +
      firstSection.getSourceArrivalConsecutiveTime() +
      "_" +
      firstSection.getNumberOfStops() +
      "_" +
      this.getTrainrun().getTrainrunCategory().shortName +
      "_" +
      this.getTrainrun().getTrainrunFrequency().shortName +
      "_" +
      this.getTrainrun().getTrainrunTimeCategory().shortName +
      "_" +
      this.getTrainrun().getTrainrunCategory().id +
      "_" +
      this.getTrainrun().getTrainrunFrequency().id +
      "_" +
      this.getTrainrun().getTrainrunTimeCategory().id +
      "_" +
      this.getTrainrun().getTrainrunCategory().colorRef +
      "_" +
      this.getTrainrun().getTrainrunFrequency().linePatternRef +
      "_" +
      this.getTrainrun().getTrainrunTimeCategory().linePatternRef +
      "_" +
      this.getTrainrun().getTrainrunFrequency().frequency +
      "_" +
      this.getTrainrun().getTrainrunFrequency().offset +
      "_" +
      this.getTrainrun().getDirection() +
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
      editorView.checkFilterNonStopNode(firstSection.getSourceNode()) +
      "_" +
      editorView.checkFilterNonStopNode(lastSection.getTargetNode()) +
      "_" +
      editorView.isJunctionNode(firstSection.getSourceNode()) +
      "_" +
      editorView.isJunctionNode(lastSection.getTargetNode()) +
      "_" +
      editorView.checkFilterNode(firstSection.getSourceNode()) +
      "_" +
      editorView.checkFilterNode(lastSection.getTargetNode()) +
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

    this.getPath().forEach((p) => {
      key += p.toString();
    });

    return key;
  }

  getPath(): Vec2D[] {
    const sourcePath = this.trainrunSections[0].getPath().slice(0, 2);
    const targetPath = this.trainrunSections.at(-1)!.getPath().slice(2, 4);
    return [...sourcePath, ...targetPath];
  }
}
