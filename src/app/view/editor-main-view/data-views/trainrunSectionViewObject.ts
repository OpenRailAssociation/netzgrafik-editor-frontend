import {
  TrainrunSectionText,
  TrainrunSectionTextPositions,
} from "../../../data-structures/technical.data.structures";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {SimpleTrainrunSectionRouter} from "../../../services/util/trainrunsection.routing";
import {Vec2D} from "../../../utils/vec2D";
import {GeneralViewFunctions} from "../../util/generalViewFunctions";
import {EditorView} from "./editor.view";
import {TrainrunSectionsView} from "./trainrunsections.view";
import {Node} from "src/app/models/node.model";
import {SHOW_MAX_SINGLE_TRAINRUN_SECTIONS_STOPS} from "../../rastering/definitions";

export class TrainrunSectionViewObject {
  readonly firstSection: TrainrunSection;
  readonly lastSection: TrainrunSection;
  readonly key: string;
  readonly path: Vec2D[];
  readonly textPositions: TrainrunSectionTextPositions;

  constructor(
    editorView: EditorView,
    readonly trainrunSections: TrainrunSection[],
  ) {
    this.firstSection = trainrunSections[0];
    this.lastSection = trainrunSections.at(-1)!;
    this.path = SimpleTrainrunSectionRouter.computePath(this.firstSection, this.lastSection);
    this.textPositions = SimpleTrainrunSectionRouter.computeTextPositions(
      this.path,
      this.firstSection.getSourceNode().getPort(this.firstSection.getSourcePortId()),
      !this.areTravelTimesEqual(),
    );
    this.key = this.generateKey(editorView, trainrunSections);
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

  firstSectionMatchesFirstOrLastSection(tsvo: TrainrunSectionViewObject): boolean {
    return (
      this.firstSection.getId() === tsvo.firstSection.getId() ||
      this.firstSection.getId() === tsvo.lastSection.getId()
    );
  }

  getCollapsedStopNodes(): Node[] {
    return this.trainrunSections
      .slice(1)
      .filter((section) => !section.getSourceNode().isNonStop(section))
      .map((section) => section.getSourceNode());
  }

  getCollapsedStopNodeFromStopIndex(stopIndex: number): Node {
    return this.getCollapsedStopNodes()[stopIndex];
  }

  getCollapsedNodeToDrag(stopIndex: number): Node {
    const numberOfCollapsedStops = this.getCollapsedStopNodes().length;
    if (numberOfCollapsedStops >= SHOW_MAX_SINGLE_TRAINRUN_SECTIONS_STOPS) {
      return this.getCollapsedStopNodeFromStopIndex(numberOfCollapsedStops - 1);
    }
    return this.getCollapsedStopNodeFromStopIndex(stopIndex);
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

  getBackwardTravelTime(): number {
    if (this.trainrunSections.length === 1) {
      return this.firstSection.getBackwardTravelTime();
    }

    return this.trainrunSections.reduce((sum, section, index) => {
      let sectionTime = section.getBackwardTravelTime();

      // Add stop time at intermediate nodes (all except the last section)
      if (index < this.trainrunSections.length - 1) {
        const nextSection = this.trainrunSections[index + 1];
        const stopTime = Math.abs(
          section.getTargetDepartureConsecutiveTime() -
            nextSection.getSourceArrivalConsecutiveTime(),
        );
        sectionTime += stopTime;
      }

      return sum + sectionTime;
    }, 0);
  }

  areTravelTimesEqual(): boolean {
    return this.getTravelTime() === this.getBackwardTravelTime();
  }

  getExtremitySection(atSource: boolean): TrainrunSection {
    return atSource ? this.firstSection : this.lastSection;
  }

  getExtremityNode(atSource: boolean): Node {
    const trainrunSection = this.getExtremitySection(atSource);
    return atSource ? trainrunSection.getSourceNode() : trainrunSection.getTargetNode();
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

  /**
   * Given the id of a dragged node (which must be at one extremity of this TSVO),
   * returns the four "links" that describe the drag anchor:
   *
   * Single-section TSVO (innerSection === outerSection):
   *
   *   outerNode ---[outerSection = innerSection]--- innerNode (= draggedNode)
   *
   * Multi-section TSVO:
   *
   *   outerNode ---[outerSection]--- ... ---[innerSection]--- innerNode (= draggedNode)
   *
   * Example with TSVO: A --[s1]-- B --[s2]-- C --[s3]-- D, dragging A:
   *
   *   outerNode=D, outerSection=s3, innerNode=A, innerSection=s1
   *
   * @throws Error if draggedNodeId is not an extremity of this TSVO
   */
  getExtremityLinks(draggedNodeId: number): {
    outerNode: Node;
    outerSection: TrainrunSection;
    innerNode: Node;
    innerSection: TrainrunSection;
  } {
    const touchesFirst = this.firstSection.isLinkedToNode(draggedNodeId);
    const touchesLast = this.lastSection.isLinkedToNode(draggedNodeId);

    // Single-section TSVO: innerSection === outerSection, determine which end is the dragged node
    if (touchesFirst && touchesLast) {
      const section = this.firstSection;
      const isDraggedNodeAtSource = section.getSourceNode().getId() === draggedNodeId;

      const sourceNode = section.getSourceNode();
      const targetNode = section.getTargetNode();

      return isDraggedNodeAtSource
        ? {
            outerNode: targetNode,
            outerSection: section,
            innerNode: sourceNode,
            innerSection: section,
          }
        : {
            outerNode: sourceNode,
            outerSection: section,
            innerNode: targetNode,
            innerSection: section,
          };
    }
    // Multi-section TSVO: dragged node is at the source extremity
    if (touchesFirst && !touchesLast) {
      return {
        outerNode: this.lastSection.getTargetNode(),
        outerSection: this.lastSection,
        innerNode: this.firstSection.getSourceNode(),
        innerSection: this.firstSection,
      };
    }
    // Multi-section TSVO: dragged node is at the target extremity
    if (touchesLast && !touchesFirst) {
      return {
        outerNode: this.firstSection.getSourceNode(),
        outerSection: this.firstSection,
        innerNode: this.lastSection.getTargetNode(),
        innerSection: this.lastSection,
      };
    }
    throw new Error(
      `getExtremityLinks: draggedNodeId ${draggedNodeId} is not an extremity of this TSVO`,
    );
  }

  // A "Tip" is the state of a trainrun section's end (source or target). This state is represented
  // as a cropped line on the end's side and a node's name displayed next to it. A trainrun section's
  // end is a Tip when the node on its side is collapsed or filtered.
  // Note: in this function, we deal only with collapsed node, because the filtering system is a mess.
  isTip(atSource: boolean): boolean {
    if (atSource) {
      return (
        !this.firstSection.getSourceNode().getIsCollapsed() &&
        this.lastSection.getTargetNode().getIsCollapsed()
      );
    } else {
      return (
        this.firstSection.getSourceNode().getIsCollapsed() &&
        !this.lastSection.getTargetNode().getIsCollapsed()
      );
    }
  }

  isTargetRightOrBottom(): boolean {
    const firstNode = this.firstSection.getSourceNode();
    const lastNode = this.lastSection.getTargetNode();
    return GeneralViewFunctions.getRightOrBottomNode(firstNode, lastNode) === lastNode;
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
    const hiddenTagTravelTime = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      this.firstSection,
      TrainrunSectionText.TrainrunSectionTravelTime,
    );
    const hiddenTagBackwardTravelTime = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      this.firstSection,
      TrainrunSectionText.TrainrunSectionBackwardTravelTime,
    );
    const hiddenTagTrainrunName = TrainrunSectionsView.getHiddenTagForTime(
      editorView,
      this.firstSection,
      TrainrunSectionText.TrainrunSectionName,
    );
    const hiddenTagDirectionArrows =
      !editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() &&
      !editorView.isFilterDirectionArrowsEnabled();
    const hiddenTagAsymmetryArrows = !editorView.isFilterAsymmetryArrowsEnabled();
    const cumulativeTravelTimeData = editorView.getCumulativeTravelTimeAndNodePath(
      this.firstSection,
      "sourceToTarget",
    );
    const activeTrafficSideType = editorView.getActiveTrafficSideType();
    const cumulativeTravelTime =
      cumulativeTravelTimeData[cumulativeTravelTimeData.length - 1].sumTravelTime;
    const cumulativeBackwardTravelTime = editorView.getCumulativeTravelTime(
      this.firstSection,
      "targetToSource",
    );

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
      this.getBackwardTravelTime() +
      "_" +
      cumulativeBackwardTravelTime +
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
      this.firstSection.getSourceNode().getIsCollapsed() +
      "_" +
      this.lastSection.getTargetNode().getIsCollapsed() +
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
      activeTrafficSideType +
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
