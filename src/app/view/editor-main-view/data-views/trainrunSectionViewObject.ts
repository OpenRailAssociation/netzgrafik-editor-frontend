import {TrainrunSectionTextPositions} from "../../../data-structures/technical.data.structures";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {TrainrunSectionText} from "../../../data-structures/technical.data.structures";
import {SimpleTrainrunSectionRouter} from "../../../services/util/trainrunsection.routing";
import {Vec2D} from "../../../utils/vec2D";
import {EditorView} from "./editor.view";
import {TrainrunSectionsView} from "./trainrunsections.view";

export class TrainrunSectionViewObject {
  readonly firstSection: TrainrunSection;
  readonly lastSection: TrainrunSection;
  readonly key: string;
  readonly textPositions: TrainrunSectionTextPositions;

  constructor(
    private editorView: EditorView,
    readonly trainrunSections: TrainrunSection[],
  ) {
    this.firstSection = trainrunSections[0];
    this.lastSection = trainrunSections.at(-1)!;
    this.key = this.generateKey(editorView, trainrunSections);
    this.textPositions = SimpleTrainrunSectionRouter.computeTextPositions(
      this.getPath(),
      this.firstSection.getSourceNode().getPort(this.firstSection.getSourcePortId()),
    );
  }

  getTrainrun() {
    return this.firstSection.getTrainrun();
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
      return this.firstSection.getTravelTime();
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

  getExtremitySection(atSource: boolean): TrainrunSection {
    return atSource ? this.firstSection : this.lastSection;
  }

  private generateKey(editorView: EditorView, trainrunSections: TrainrunSection[]): string {
    const selectedTrainrun = editorView.getSelectedTrainrun();
    let connectedTrainIds = [];
    if (selectedTrainrun !== null) {
      connectedTrainIds = editorView.getConnectedTrainrunIds(selectedTrainrun);
    }

    const isNonStopAtSource = TrainrunSectionsView.getNode(this.firstSection, true).isNonStop(
      this.firstSection,
    );
    const isNonStopAtTarget = TrainrunSectionsView.getNode(this.lastSection, false).isNonStop(
      this.lastSection,
    );
    const isMuted = TrainrunSectionsView.isMuted(
      this.firstSection,
      selectedTrainrun,
      connectedTrainIds,
    );
    const hiddenTagSource = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      this.firstSection,
      TrainrunSectionText.SourceDeparture,
    );
    const hiddenTagTarget = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      this.lastSection,
      TrainrunSectionText.TargetDeparture,
    );
    const hiddenTagTraveltime = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      this.firstSection,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const hiddenTagTrainrunName = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      this.firstSection,
      TrainrunSectionText.TrainrunSectionName,
    );
    const hiddenTagDirectionArrows =
      !editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() &&
      !editorView.isFilterDirectionArrowsEnabled();
    const cumulativeTravelTimeData = editorView.getCumulativeTravelTimeAndNodePath(
      this.firstSection,
    );
    const cumulativeTravelTime =
      cumulativeTravelTimeData[cumulativeTravelTimeData.length - 1].sumTravelTime;

    let key =
      "#" +
      this.firstSection.getId() +
      "@" +
      this.getTrainrun().getTitle() +
      "_" +
      trainrunSections.some((ts) => ts.selected()) +
      "_" +
      this.getTrainrun().selected() +
      "_" +
      this.firstSection.getNumberOfStops() +
      "_" +
      this.getTravelTime() +
      "_" +
      cumulativeTravelTime +
      "_" +
      editorView.getTimeDisplayPrecision() +
      "_" +
      this.lastSection.getTargetDeparture() +
      "_" +
      this.lastSection.getTargetArrival() +
      "_" +
      this.firstSection.getSourceDeparture() +
      "_" +
      this.firstSection.getSourceArrival() +
      "_" +
      this.lastSection.getTargetDepartureConsecutiveTime() +
      "_" +
      this.lastSection.getTargetArrivalConsecutiveTime() +
      "_" +
      this.firstSection.getSourceDepartureConsecutiveTime() +
      "_" +
      this.firstSection.getSourceArrivalConsecutiveTime() +
      "_" +
      this.firstSection.getNumberOfStops() +
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
      editorView.checkFilterNonStopNode(this.firstSection.getSourceNode()) +
      "_" +
      editorView.checkFilterNonStopNode(this.lastSection.getTargetNode()) +
      "_" +
      editorView.isJunctionNode(this.firstSection.getSourceNode()) +
      "_" +
      editorView.isJunctionNode(this.lastSection.getTargetNode()) +
      "_" +
      editorView.checkFilterNode(this.firstSection.getSourceNode()) +
      "_" +
      editorView.checkFilterNode(this.lastSection.getTargetNode()) +
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
    const sourcePath = this.firstSection.getPath().slice(0, 2);
    const targetPath = this.lastSection.getPath().slice(2, 4);
    return [...sourcePath, ...targetPath];
  }
}
