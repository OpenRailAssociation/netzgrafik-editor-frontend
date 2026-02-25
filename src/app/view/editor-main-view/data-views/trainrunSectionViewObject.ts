import {TrainrunSectionTextPositions} from "../../../data-structures/technical.data.structures";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {TrainrunSectionText} from "../../../data-structures/technical.data.structures";
import {SimpleTrainrunSectionRouter} from "../../../services/util/trainrunsection.routing";
import {Vec2D} from "../../../utils/vec2D";
import {EditorView} from "./editor.view";
import {TrainrunSectionsView} from "./trainrunsections.view";

export class TrainrunSectionViewObject {
  readonly key: string;
  readonly textPositions: TrainrunSectionTextPositions;

  constructor(
    private editorView: EditorView,
    readonly trainrunSections: TrainrunSection[],
  ) {
    this.key = this.generateKey(editorView, trainrunSections);
    this.textPositions = SimpleTrainrunSectionRouter.computeTextPositions(
      this.getPath(),
      trainrunSections[0].getSourceNode().getPort(trainrunSections[0].getSourcePortId()),
    );
  }

  getTrainrun() {
    return this.trainrunSections[0].getTrainrun();
  }

  getNumberOfStops(): number {
    // Count non-stop collapsed source nodes
    // Note: in this context, all intermediate sections are collapsed
    return this.trainrunSections
      .slice(1) // skip first section
      .filter((section) => !section.getSourceNode().isNonStop(section)).length;
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

  private generateKey(editorView: EditorView, trainrunSections: TrainrunSection[]): string {
    const trainrun = this.getTrainrun();
    const firstSection = trainrunSections[0];
    const lastSection = trainrunSections.at(-1);

    const selectedTrainrun = editorView.getSelectedTrainrun();
    let connectedTrainIds = [];
    if (selectedTrainrun !== null) {
      connectedTrainIds = editorView.getConnectedTrainrunIds(selectedTrainrun);
    }

    const isNonStopAtSource = TrainrunSectionsView.getNode(firstSection, true).isNonStop(
      firstSection,
    );
    const isNonStopAtTarget = TrainrunSectionsView.getNode(lastSection, false).isNonStop(
      lastSection,
    );
    const isMuted = TrainrunSectionsView.isMuted(firstSection, selectedTrainrun, connectedTrainIds);
    const hiddenTagSource = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      firstSection,
      TrainrunSectionText.SourceDeparture,
    );
    const hiddenTagTarget = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      lastSection,
      TrainrunSectionText.TargetDeparture,
    );
    const hiddenTagTraveltime = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      firstSection,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const hiddenTagTrainrunName = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      firstSection,
      TrainrunSectionText.TrainrunSectionName,
    );
    const hiddenTagDirectionArrows =
      !editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() &&
      !editorView.isFilterDirectionArrowsEnabled();
    const cumulativeTravelTimeData = editorView.getCumulativeTravelTimeAndNodePath(firstSection);
    const cumulativeTravelTime =
      cumulativeTravelTimeData[cumulativeTravelTimeData.length - 1].sumTravelTime;

    let key =
      "#" +
      firstSection.getId() +
      "@" +
      this.getTrainrun().getTitle() +
      "_" +
      trainrunSections.some((ts) => ts.selected()) +
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
