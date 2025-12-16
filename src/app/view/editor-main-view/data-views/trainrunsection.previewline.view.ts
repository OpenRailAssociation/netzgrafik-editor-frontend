import {StaticDomTags} from "./static.dom.tags";
import {Vec2D} from "../../../utils/vec2D";
import * as d3 from "d3";
import {D3Utils} from "./d3.utils";
import {Node} from "../../../models/node.model";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {Transition} from "../../../models/transition.model";
import {SimpleTrainrunSectionRouter} from "../../../services/util/trainrunsection.routing";
import {NodeService} from "../../../services/data/node.service";
import {FilterService} from "../../../services/ui/filter.service";
import {VersionControlService} from "../../../services/data/version-control.service";
import {TrainrunSectionViewObject} from "./trainrunSectionViewObject";

export enum PreviewLineMode {
  NotDragging,
  DragExistingTrainrunSection,
  DragNewTrainrunSection,
  DragIntermediateStop,
  DragTransition,
}

export class DragIntermediateStopInfo {
  constructor(
    public trainrunSection: TrainrunSection,
    public intermediateStopIndex: number,
    public domRef: any,
  ) {}
}

export class DragCollapsedStopNodeInfo {
  constructor(
    public viewObject: TrainrunSectionViewObject,
    public stopIndex: number,
    public domRef: any,
  ) {}
}

export class DragTransitionInfo {
  constructor(
    public node: Node,
    public trainrunSection1: TrainrunSection,
    public trainrunSection2: TrainrunSection,
    public transition: Transition,
    public insideNode: boolean,
    public domRef: any,
  ) {}

  setInsideNode(flag: boolean) {
    this.insideNode = flag;
  }
}

export class TrainrunSectionPreviewLineView {
  private mode: PreviewLineMode = PreviewLineMode.NotDragging;
  private startNode: Node = null;
  private startPos: Vec2D = null;
  private startConnectionPos: Vec2D = null;
  private startIntermediatePos: Vec2D = null;
  private existingTrainrunSection: TrainrunSection = null;
  private drawingTrainrunSectionObjectCreated = false;
  private drawingConnectionObjectCreated = false;
  private dragTransitionInfo: DragTransitionInfo = null;
  private canCombineTwoTrainrunsFlag = false;
  private dragCollapsedNodeInfo: DragCollapsedStopNodeInfo = null;

  constructor(
    private nodeService: NodeService,
    private filterService: FilterService,
    private versionControlService: VersionControlService,
  ) {}

  static setGroup(nodeGroup: d3.Selector) {
    nodeGroup
      .append(StaticDomTags.PREVIEW_LINE_ROOT_SVG)
      .attr("class", StaticDomTags.PREVIEW_LINE_ROOT_CLASS);
  }

  static setConnectionGroup(nodeGroup: d3.Selector) {
    nodeGroup
      .append(StaticDomTags.PREVIEW_CONNECTION_LINE_ROOT_SVG)
      .attr("class", StaticDomTags.PREVIEW_CONNECTION_LINE_ROOT_CLASS);
  }

  getVariantIsWritable(): boolean {
    if (!this.versionControlService?.getVariantIsWritable()) {
      return false;
    }
    return true;
  }

  getMode(): PreviewLineMode {
    return this.mode;
  }

  isDragging(): boolean {
    return this.getMode() !== PreviewLineMode.NotDragging;
  }

  getExistingTrainrunSection(): TrainrunSection {
    return this.existingTrainrunSection;
  }

  setExistingTrainrunSection(trainrunSection: TrainrunSection) {
    this.mode = PreviewLineMode.DragExistingTrainrunSection;
    this.existingTrainrunSection = new TrainrunSection(trainrunSection.getDto());
    this.existingTrainrunSection.setTrainrun(trainrunSection.getTrainrun());
  }

  startDragCollapsedNode(dragCollapsedNodeInfo: DragCollapsedStopNodeInfo, startPosition: Vec2D) {
    if (!this.versionControlService?.getVariantIsWritable()) {
      return;
    }
    this.mode = PreviewLineMode.DragIntermediateStop;
    this.dragCollapsedNodeInfo = dragCollapsedNodeInfo;
    this.startIntermediatePos = startPosition;
    this.displayTrainrunSectionPreviewLine();
    D3Utils.disableTrainrunSectionForEventHandling();
    D3Utils.doGrayout(dragCollapsedNodeInfo.viewObject.trainrunSections[0]);
  }

  startDragTransition(dragTransition: DragTransitionInfo, startPosition: Vec2D) {
    if (!this.versionControlService?.getVariantIsWritable()) {
      return;
    }
    this.filterService.switchOffTemporaryEmptyAndNonStopFiltering();
    this.mode = PreviewLineMode.DragTransition;
    this.dragTransitionInfo = dragTransition;
    this.startIntermediatePos = startPosition;
    this.displayTrainrunSectionPreviewLine();
    D3Utils.disableTrainrunSectionForEventHandling();
    D3Utils.doGrayoutTransition(dragTransition.transition);
    D3Utils.doGrayoutTrainrunSectionPin(dragTransition.trainrunSection1, dragTransition.node);
    D3Utils.doGrayoutTrainrunSectionPin(dragTransition.trainrunSection2, dragTransition.node);
  }

  getStartNode(): Node {
    return this.startNode;
  }

  getDragCollapsedNodeInfo(): DragCollapsedStopNodeInfo {
    return this.dragCollapsedNodeInfo;
  }

  getDragTransitionInfo(): DragTransitionInfo {
    return this.dragTransitionInfo;
  }

  setStartConnectionPos(pos: Vec2D) {
    this.startConnectionPos = pos;
  }

  resetStartConnectionPos() {
    this.startConnectionPos = null;
  }

  startPreviewLine(nodeId: number) {
    if (!this.versionControlService?.getVariantIsWritable()) {
      return;
    }
    this.mode = PreviewLineMode.DragNewTrainrunSection;
    const mousePosition = d3.mouse(d3.select(StaticDomTags.PREVIEW_LINE_ROOT_DOM_REF).node());
    const startPosition = new Vec2D(mousePosition[0], mousePosition[1]);
    const startNode: Node = this.nodeService.getNodeFromId(nodeId);
    this.startPreviewLineAtPosition(startNode, startPosition);
  }

  startPreviewLineAtPosition(startNode: Node, startPosition: Vec2D) {
    if (!this.versionControlService?.getVariantIsWritable()) {
      return;
    }
    this.mode = PreviewLineMode.DragExistingTrainrunSection;
    this.startNode = startNode;
    this.startPos = startPosition;

    if (!this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      this.filterService.switchOffTemporaryEmptyAndNonStopFiltering();
    }

    this.displayTrainrunSectionPreviewLine();

    D3Utils.highlightNode(startNode);
    D3Utils.disableTrainrunSectionForEventHandling();
  }

  updatePreviewLineCombineTrainruns(transitionInvolved) {
    this.canCombineTwoTrainrunsFlag = !transitionInvolved;
    this.updatePreviewLine();
  }

  updatePreviewLine() {
    if (this.dragCollapsedNodeInfo !== null) {
      const firstSegment = this.dragCollapsedNodeInfo.viewObject.trainrunSections[0].getPath()[0];
      const lastSegment = this.dragCollapsedNodeInfo.viewObject.trainrunSections
        .at(-1)!
        .getPath()[3];
      this.hideConnectionPreviewLine();
      this.displayTrainrunSectionPreviewLine();
      D3Utils.updateIntermediateStopOrTransitionPreviewLine(firstSegment, lastSegment);
      return true;
    }

    if (this.dragTransitionInfo !== null) {
      this.hideConnectionPreviewLine();
      this.displayTrainrunSectionPreviewLine();
      if (this.dragTransitionInfo.insideNode) {
        const startPos = this.dragTransitionInfo.transition.getPath()[0];
        const endPos = this.dragTransitionInfo.transition.getPath()[3];
        D3Utils.updateIntermediateStopOrTransitionPreviewLine(startPos, endPos);
      } else {
        const node1 =
          this.dragTransitionInfo.trainrunSection1.getSourceNodeId() ===
          this.dragTransitionInfo.node.getId()
            ? this.dragTransitionInfo.trainrunSection1.getTargetNode()
            : this.dragTransitionInfo.trainrunSection1.getSourceNode();
        const node2 =
          this.dragTransitionInfo.trainrunSection2.getSourceNodeId() ===
          this.dragTransitionInfo.node.getId()
            ? this.dragTransitionInfo.trainrunSection2.getTargetNode()
            : this.dragTransitionInfo.trainrunSection2.getSourceNode();
        const port1 = node1.getPortOfTrainrunSection(
          this.dragTransitionInfo.trainrunSection1.getId(),
        );
        const port2 = node2.getPortOfTrainrunSection(
          this.dragTransitionInfo.trainrunSection2.getId(),
        );
        const startPos = SimpleTrainrunSectionRouter.getPortPositionForTrainrunSectionRouting(
          node1,
          port1,
        );
        const endPos = SimpleTrainrunSectionRouter.getPortPositionForTrainrunSectionRouting(
          node2,
          port2,
        );
        D3Utils.updateIntermediateStopOrTransitionPreviewLine(startPos, endPos);
      }
      return true;
    }

    if (this.startNode === null) {
      return false;
    }

    if (this.startConnectionPos !== null) {
      this.hideTrainrunSectionPreviewLine();
      this.displayConnectionPreviewLine();
      D3Utils.updateConnectionPreviewLine(this.startConnectionPos, this.canCombineTwoTrainruns());
      return true;
    }

    if (this.startPos !== null) {
      this.hideConnectionPreviewLine();
      this.displayTrainrunSectionPreviewLine();
      D3Utils.updateTrainrunSectionPreviewLine(this.startPos);
      return true;
    }
    return false;
  }

  stopPreviewLine() {
    this.filterService.resetTemporaryEmptyAndNonStopFilteringSwitchedOff();
    this.hideTrainrunSectionPreviewLine();
    this.hideConnectionPreviewLine();
    if (this.dragCollapsedNodeInfo !== null) {
      D3Utils.removeGrayout(this.dragCollapsedNodeInfo.viewObject.trainrunSections[0]);
      d3.select(this.dragCollapsedNodeInfo.domRef).classed(StaticDomTags.TAG_HOVER, false);
    }

    if (this.dragTransitionInfo !== null) {
      D3Utils.removeGrayoutTransition(this.dragTransitionInfo.transition);
      D3Utils.removeGrayoutTrainrunSectionPin();
      d3.select(this.dragTransitionInfo.domRef).classed(StaticDomTags.TAG_HOVER, false);
    }
    if (this.existingTrainrunSection !== null) {
      D3Utils.removeGrayout(this.existingTrainrunSection);
    }
    if (this.startNode !== null) {
      D3Utils.unhighlightNode(this.startNode);
    }
    this.resetInternalState();
  }

  canCombineTwoTrainruns() {
    return this.canCombineTwoTrainrunsFlag;
  }

  private displayTrainrunSectionPreviewLine() {
    if (this.drawingTrainrunSectionObjectCreated) {
      return;
    }
    if (!this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      this.filterService.switchOffTemporaryEmptyAndNonStopFiltering();
    }
    this.drawingTrainrunSectionObjectCreated = true;
    d3.selectAll(StaticDomTags.PREVIEW_LINE_ROOT_DOM_REF)
      .append(StaticDomTags.PREVIEW_LINE_SVG)
      .attr("class", StaticDomTags.PREVIEW_LINE_CLASS);
  }

  private hideTrainrunSectionPreviewLine() {
    if (!this.drawingTrainrunSectionObjectCreated) {
      return;
    }

    this.drawingTrainrunSectionObjectCreated = false;
    d3.selectAll(StaticDomTags.PREVIEW_LINE_DOM_REF).remove();
  }

  private displayConnectionPreviewLine() {
    if (this.drawingConnectionObjectCreated) {
      return;
    }
    this.filterService.resetTemporaryEmptyAndNonStopFilteringSwitchedOff();

    this.drawingConnectionObjectCreated = true;
    d3.selectAll(StaticDomTags.PREVIEW_CONNECTION_LINE_ROOT_DOM_REF)
      .append(StaticDomTags.PREVIEW_CONNECTION_LINE_SVG)
      .attr("class", StaticDomTags.PREVIEW_CONNECTION_LINE_CLASS);
  }

  private hideConnectionPreviewLine() {
    if (!this.drawingConnectionObjectCreated) {
      return;
    }
    this.drawingConnectionObjectCreated = false;
    d3.selectAll(StaticDomTags.PREVIEW_CONNECTION_LINE_DOM_REF).remove();
  }

  private resetInternalState() {
    this.mode = PreviewLineMode.NotDragging;
    this.canCombineTwoTrainrunsFlag = false;

    this.existingTrainrunSection = null;
    this.startNode = null;
    this.startPos = null;
    this.startConnectionPos = null;
    this.drawingTrainrunSectionObjectCreated = false;
    this.drawingConnectionObjectCreated = false;
    this.dragTransitionInfo = null;
    this.dragCollapsedNodeInfo = null;
    D3Utils.resetTrainrunSectionForEventHandling();
  }
}
