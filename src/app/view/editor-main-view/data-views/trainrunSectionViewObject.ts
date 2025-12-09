import {Trainrun} from "src/app/models/trainrun.model";
import {
  TrainrunSectionText,
  TrainrunSectionTextPositions,
} from "../../../data-structures/technical.data.structures";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {SimpleTrainrunSectionRouter} from "../../../services/util/trainrunsection.routing";
import {Vec2D} from "../../../utils/vec2D";
import {EditorView} from "./editor.view";
import {TrainrunSectionsView} from "./trainrunsections.view";

export class TrainrunSectionViewObject {
  readonly firstSection: TrainrunSection;
  readonly lastSection: TrainrunSection;
  readonly key: string;
  readonly path: Vec2D[];
  readonly textPositions: TrainrunSectionTextPositions;

  constructor(
    private editorView: EditorView,
    public trainrunSections: TrainrunSection[],
  ) {
    this.firstSection = trainrunSections[0];
    this.lastSection = trainrunSections.at(-1)!;

    // Compute path and text positions based on the first trainrun section
    this.path = SimpleTrainrunSectionRouter.routeTrainrunSection(
      this.firstSection.getSourceNode(),
      this.firstSection.getSourceNode().getPort(this.firstSection.getSourcePortId()),
      this.lastSection.getTargetNode(),
      this.lastSection.getTargetNode().getPort(this.lastSection.getTargetPortId()),
    );
    this.textPositions = SimpleTrainrunSectionRouter.placeTextOnTrainrunSection(
      this.path,
      this.firstSection.getSourceNode().getPort(this.firstSection.getSourcePortId()),
    );

    // Compute key for caching/rendering purposes
    const selectedTrainrun: Trainrun = this.editorView.getSelectedTrainrun();
    let connectedTrainIds = [];
    if (selectedTrainrun !== null) {
      connectedTrainIds = this.editorView.getConnectedTrainrunIds(selectedTrainrun);
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
    const hiddenTagSource = this.getHiddenTagForTime(
      this.firstSection,
      TrainrunSectionText.SourceDeparture,
    );
    const hiddenTagTarget = this.getHiddenTagForTime(
      this.lastSection,
      TrainrunSectionText.TargetDeparture,
    );
    const hiddenTagTraveltime = this.getHiddenTagForTime(
      this.firstSection,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const hiddenTagTrainrunName = this.getHiddenTagForTime(
      this.firstSection,
      TrainrunSectionText.TrainrunSectionName,
    );
    const hiddenTagDirectionArrows =
      !this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() &&
      !this.editorView.isFilterDirectionArrowsEnabled();

    this.key = this.generateKey(
      editorView,
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
    return this.firstSection.getTrainrun();
  }

  getNumberOfStops(): number {
    // Count non-stop collapsed source nodes
    // Note: in this context, all intermediate sections are collapsed
    return this.trainrunSections
      .slice(1) // skip first section
      .filter((section) => !section.getSourceNode().isNonStop(section)).length;
  }

  getSection(atSource: boolean): TrainrunSection {
    return atSource ? this.firstSection : this.lastSection;
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

  getTextPositionX(textElement: TrainrunSectionText): number {
    return this.textPositions[textElement].x;
  }

  getTextPositionY(textElement: TrainrunSectionText): number {
    return this.textPositions[textElement].y;
  }

  getPositionAtSourceNode(): Vec2D {
    return this.path[0];
  }

  getPositionAtTargetNode(): Vec2D {
    return this.path[this.path.length - 1];
  }

  getPosition(atSource: boolean): Vec2D {
    return atSource ? this.getPositionAtSourceNode() : this.getPositionAtTargetNode();
  }

  getHiddenTagForTime(trainrunSection: TrainrunSection, textElement: TrainrunSectionText): boolean {
    if (this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      // disable filtering in view (render all objects)
      return false;
    }
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
      case TrainrunSectionText.SourceArrival:
        if (!this.editorView.isFilterArrivalDepartureTimeEnabled()) {
          return true;
        }
        if (
          !this.editorView.checkFilterNonStopNode(
            TrainrunSectionsView.getNode(trainrunSection, true),
          )
        ) {
          return true;
        }
        if (this.editorView.isFilterShowNonStopTimeEnabled()) {
          return false;
        }
        return TrainrunSectionsView.getNode(trainrunSection, true).isNonStop(trainrunSection);
      case TrainrunSectionText.TargetDeparture:
      case TrainrunSectionText.TargetArrival:
        if (!this.editorView.isFilterArrivalDepartureTimeEnabled()) {
          return true;
        }
        if (
          !this.editorView.checkFilterNonStopNode(
            TrainrunSectionsView.getNode(trainrunSection, false),
          )
        ) {
          return true;
        }
        if (this.editorView.isFilterShowNonStopTimeEnabled()) {
          return false;
        }
        return TrainrunSectionsView.getNode(trainrunSection, false).isNonStop(trainrunSection);
      case TrainrunSectionText.TrainrunSectionTravelTime:
        if (!this.editorView.isFilterTravelTimeEnabled()) {
          return true;
        }
        if (this.editorView.isFilterShowNonStopTimeEnabled()) {
          return false;
        }
        return (
          !trainrunSection.getTrainrun().selected() &&
          TrainrunSectionsView.isBothSideNonStop(trainrunSection)
        );
      case TrainrunSectionText.TrainrunSectionName:
        {
          if (!this.editorView.isFilterTrainrunNameEnabled()) {
            return true;
          }
          const srcNode = TrainrunSectionsView.getNode(trainrunSection, true);
          const trgNode = TrainrunSectionsView.getNode(trainrunSection, false);
          if (
            !this.editorView.checkFilterNonStopNode(srcNode) ||
            !this.editorView.checkFilterNonStopNode(trgNode)
          ) {
            const transSrc = srcNode.getTransition(trainrunSection.getId());
            const transTrg = trgNode.getTransition(trainrunSection.getId());
            if (transSrc !== undefined && transTrg !== undefined) {
              if (transSrc.getIsNonStopTransit() && transTrg.getIsNonStopTransit()) {
                return true;
              }
            }
          }
        }
        return false;
      default:
        return false;
    }
  }

  private generateKey(
    editorView: EditorView,
    isNonStopAtSource: boolean,
    isNonStopAtTarget: boolean,
    isMuted: boolean,
    hiddenTagSource: boolean,
    hiddenTagTarget: boolean,
    hiddenTagTraveltime: boolean,
    hiddenTagTrainrunName: boolean,
    hiddenTagDirectionArrows: boolean,
  ): string {
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

    this.path.forEach((p) => {
      key += p.toString();
    });

    return key;
  }
}
