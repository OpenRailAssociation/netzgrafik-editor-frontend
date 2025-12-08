import * as d3 from "d3";

import {
  NODE_ANALYTICS_AREA_HEIGHT,
  NODE_POSITION_BASIC_RASTER,
  NODE_TEXT_AREA_HEIGHT,
  NODE_TEXT_LEFT_SPACING,
  TEXT_SIZE,
} from "../../rastering/definitions";
import {Node} from "../../../models/node.model";
import {StaticDomTags} from "./static.dom.tags";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {EditorView} from "./editor.view";
import {
  DragIntermediateStopInfo,
  DragTransitionInfo,
  PreviewLineMode,
} from "./trainrunsection.previewline.view";
import {Vec2D} from "../../../utils/vec2D";
import {D3Utils} from "./d3.utils";
import {NodeViewObject} from "./nodeViewObject";
import {EditorMode} from "../../editor-menu/editor-mode";
import {LevelOfDetail} from "../../../services/ui/level.of.detail.service";

export class NodesView {
  dragPreviousMousePosition: Vec2D;
  nodeGroup;
  draggable: any;
  private LevelOfDetails: LevelOfDetail;

  constructor(private editorView: EditorView) {
    this.draggable = d3
      .drag()
      .on("start", (n: NodeViewObject, i, a) => this.onNodeDragStart(n.node, a[i]))
      .on("drag", (n: NodeViewObject) => this.onNodeDragged(n.node))
      .on("end", (n: NodeViewObject, i, a) => this.onNodeDragEnd(n.node, a[i]));
    this.dragPreviousMousePosition = new Vec2D();
  }

  setGroup(nodeGroup: d3.Selector) {
    this.nodeGroup = nodeGroup;
    this.nodeGroup.attr("class", "NodesView");
  }

  onNodeDragStart(node: Node, domObj: any) {
    D3Utils.enableFastRenderingUpdate();
    d3.select(domObj).classed(StaticDomTags.TAG_HOVER, true);
    d3.select(domObj).classed(StaticDomTags.TAG_DRAGGING, true);

    // add the delta mouse position to node's current location/position
    if (this.editorView.editorMode !== EditorMode.MultiNodeMoving) {
      this.editorView.unselectAllNodes();
      this.editorView.unselectAllNotes();
    }

    this.dragPreviousMousePosition = this.editorView.svgMouseController.getCurrentMousePosition();
    this.editorView.pauseUndoRecording();
  }

  onNodeDragged(node: Node) {
    this.editorView.enableElementDragging();
    this.doDrag(node.getId());
    this.editorView.disableElementDragging();
  }

  onNodeDragEnd(node: Node, domObj: any) {
    D3Utils.disableFastRenderingUpdate();

    this.editorView.startUndoRecording();

    d3.select(domObj).classed(StaticDomTags.TAG_HOVER, false);
    d3.select(domObj).classed(StaticDomTags.TAG_DRAGGING, false);
    this.doDrag(node.getId(), NODE_POSITION_BASIC_RASTER, true);

    // add the delta mouse position to node's current location/position
    if (this.editorView.editorMode !== EditorMode.MultiNodeMoving) {
      this.editorView.unselectAllNodes();
      this.editorView.unselectAllNotes();
    }
  }

  createViewNodeDataObjects(nodes: Node[]): NodeViewObject[] {
    const viewNodeDataObjects: NodeViewObject[] = [];
    nodes.forEach((n: Node) => {
      viewNodeDataObjects.push(new NodeViewObject(this.editorView, n, n.isNonStopNode()));
    });
    return viewNodeDataObjects;
  }

  filterNodesToDisplay(node: Node): boolean {
    return this.editorView.isNodeVisible(node) && !node.getIsCollapsed();
  }

  displayNodes(inputNodes: Node[]) {
    const nodes = inputNodes.filter(
      (n) =>
        this.editorView.doCullCheckPositionsInViewport([
          new Vec2D(n.getPositionX(), n.getPositionY()),
          new Vec2D(n.getPositionX() + n.getNodeWidth(), n.getPositionY()),
          new Vec2D(n.getPositionX(), n.getPositionY() + n.getNodeHeight()),
          new Vec2D(n.getPositionX() + n.getNodeWidth(), n.getPositionY() + n.getNodeHeight()),
        ]) && this.filterNodesToDisplay(n),
    );

    const group = this.nodeGroup
      .selectAll(StaticDomTags.NODE_ROOT_CONTAINER_DOM_REF)
      .data(this.createViewNodeDataObjects(nodes), (n: NodeViewObject) => n.key);

    const groupEnter2 = group
      .enter()
      .append(StaticDomTags.NODE_SVG)
      .attr("class", StaticDomTags.NODE_ROOT_CONTAINER)
      .attr("data-testid", StaticDomTags.NODE_ROOT_CONTAINER);

    const groupEnter = groupEnter2
      .append(StaticDomTags.NODE_SVG)
      .attr("class", StaticDomTags.NODE_CLASS)
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId())
      .attr(
        "transform",
        (n: NodeViewObject) =>
          "translate(" + n.node.getPositionX() + "," + n.node.getPositionY() + ")",
      );

    this.renderNodeObject(groupEnter);

    group.exit().remove();
  }

  renderNodeObject(groupEnter: any) {
    switch (this.editorView.getLevelOfDetail()) {
      case LevelOfDetail.LEVEL3: {
        //statements;
        this.makeNodeLODLevel3(groupEnter);
        break;
      }
      case LevelOfDetail.LEVEL2: {
        //statements;
        this.makeNodeLODLevel2(groupEnter);
        break;
      }
      case LevelOfDetail.LEVEL1: {
        //statements;
        this.makeNodeLODLevel1(groupEnter);
        break;
      }
      case LevelOfDetail.LEVEL0: {
        //statements;
        this.makeNodeLODLevel0(groupEnter);
        break;
      }
      default: {
        //statements;
        this.makeNodeLODFull(groupEnter);
      }
    }
  }

  makeNodeLODFull(groupEnter: any) {
    this.makeNodeHoverRoot(groupEnter);
    this.makeNodeRoot(groupEnter);
    this.makeBackground(groupEnter);
    this.makeLabelArea(groupEnter);
    this.makeHoverDragBackground(groupEnter);
    this.makeHoverDragRoot(groupEnter);
    this.makeEditButtonBackground(groupEnter);
    this.makeEditButton(groupEnter);
    this.makeNodeDockable(groupEnter);
    this.makeAnalyticsArea(groupEnter);
    this.makeAnalyticsTextLeftArea(groupEnter);
    this.makeAnalyticsTextRightArea(groupEnter);
    this.makeLabelText(groupEnter);
    this.makeLabelConnectionText(groupEnter);
  }

  makeNodeLODLevel3(groupEnter: any) {
    this.makeNodeHoverRoot(groupEnter);
    this.makeNodeRoot(groupEnter);
    this.makeBackground(groupEnter);
    this.makeLabelArea(groupEnter);
    this.makeNodeDockable(groupEnter);
    this.makeAnalyticsArea(groupEnter);
    this.makeAnalyticsTextLeftArea(groupEnter);
    this.makeAnalyticsTextRightArea(groupEnter);
    this.makeLabelText(groupEnter);
    this.makeLabelConnectionText(groupEnter);
  }

  makeNodeLODLevel2(groupEnter: any) {
    this.makeNodeHoverRoot(groupEnter);
    this.makeNodeRoot(groupEnter);
    this.makeBackground(groupEnter);
    this.makeLabelArea(groupEnter);
    this.makeNodeDockable(groupEnter);
    this.makeAnalyticsArea(groupEnter);
    this.makeLabelText(groupEnter);
    this.makeLabelConnectionText(groupEnter);
  }

  makeNodeLODLevel1(groupEnter: any) {
    this.makeNodeHoverRoot(groupEnter);
    this.makeBackground(groupEnter);
    this.makeNodeDockable(groupEnter);
    this.makeAnalyticsArea(groupEnter);
    this.makeLabelText(groupEnter);
  }

  makeNodeLODLevel0(groupEnter: any) {
    this.makeNodeHoverRoot(groupEnter);
    this.makeNodeDockable(groupEnter);
    this.makeAnalyticsArea(groupEnter);
  }

  private makeNodeHoverRoot(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NODE_HOVER_ROOT_SVG)
      .attr("class", StaticDomTags.NODE_HOVER_ROOT_CLASS)
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId())
      .attr("width", (n: NodeViewObject) => n.node.getNodeWidth() + 24)
      .attr("height", (n: NodeViewObject) => n.node.getNodeHeight() + 24)
      .attr("x", -12)
      .attr("y", -12)
      .classed(StaticDomTags.NODE_TAG_JUNCTION_ONLY, (n: NodeViewObject) => n.node.isNonStopNode())
      .classed(
        StaticDomTags.NODE_HAS_CONNECTIONS,
        (n: NodeViewObject) => n.node.getConnections().length > 0,
      )
      .on("mouseover", (n: NodeViewObject) => this.onHoverNodeMouseover(n.node))
      .on("mouseout", (n: NodeViewObject) => this.onHoverNodeMouseout(n.node))
      .on("mousedown", (n: NodeViewObject) => this.onNodeMousedown(n.node))
      .on("mouseup", (n: NodeViewObject) => this.onNodeMouseup(n.node))
      .on("dblclick", (n: NodeViewObject) => this.onNodeDetailsClicked(n.node));
  }

  private makeNodeRoot(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NODE_ROOT_SVG)
      .attr("class", StaticDomTags.NODE_ROOT_CLASS)
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId())
      .attr("width", (n: NodeViewObject) => n.node.getNodeWidth())
      .attr("height", (n: NodeViewObject) => n.node.getNodeHeight())
      .attr("x", 0)
      .attr("y", 0)
      .classed(StaticDomTags.NODE_TAG_JUNCTION_ONLY, (n: NodeViewObject) => n.node.isNonStopNode())
      .classed(
        StaticDomTags.NODE_HAS_CONNECTIONS,
        (n: NodeViewObject) => n.node.getConnections().length > 0,
      )
      .on("mouseover", (n: NodeViewObject) => this.onHoverNodeMouseover(n.node))
      .on("mouseout", (n: NodeViewObject) => this.onHoverNodeMouseout(n.node))
      .on("mousedown", (n: NodeViewObject) => this.onNodeMousedown(n.node))
      .on("mouseup", (n: NodeViewObject) => this.onNodeMouseup(n.node))
      .on("dblclick", (n: NodeViewObject) => this.onNodeDetailsClicked(n.node));
  }

  private makeBackground(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NODE_BACKGROUND_SVG)
      .attr("class", StaticDomTags.NODE_BACKGROUND_CLASS)
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId())
      .attr("width", (n: NodeViewObject) => n.node.getNodeWidth())
      .attr("height", (n: NodeViewObject) => n.node.getNodeHeight())
      .attr("x", 0)
      .attr("y", 0)
      .classed(StaticDomTags.NODE_TAG_JUNCTION_ONLY, (n: NodeViewObject) => n.node.isNonStopNode())
      .classed(
        StaticDomTags.NODE_HAS_CONNECTIONS,
        (n: NodeViewObject) => n.node.getConnections().length > 0,
      )
      .on("mouseover", (n: NodeViewObject) => this.onHoverNodeMouseover(n.node))
      .on("mouseout", (n: NodeViewObject) => this.onHoverNodeMouseout(n.node))
      .on("mousedown", (n: NodeViewObject) => this.onNodeMousedown(n.node))
      .on("mouseup", (n: NodeViewObject) => this.onNodeMouseup(n.node))
      .on("dblclick", (n: NodeViewObject) => this.onNodeDetailsClicked(n.node));
  }

  private makeLabelArea(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NODE_LABELAREA_SVG)
      .attr("class", StaticDomTags.NODE_LABELAREA_CLASS)
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId())
      .attr("width", (n: NodeViewObject) => n.node.getNodeWidth())
      .attr("height", () => NODE_TEXT_AREA_HEIGHT)
      .attr("x", 0)
      .attr("y", (n: NodeViewObject) => n.node.getNodeHeight() - NODE_TEXT_AREA_HEIGHT)
      .classed(StaticDomTags.NODE_TAG_JUNCTION_ONLY, (n: NodeViewObject) => n.node.isNonStopNode())
      .classed(
        StaticDomTags.NODE_HAS_CONNECTIONS,
        (n: NodeViewObject) => n.node.getConnections().length > 0,
      )
      .on("mouseover", (n: NodeViewObject) => this.onNodeLabelAreaMouseover(n.node, null))
      .on("mouseout", (n: NodeViewObject) => this.onNodeMouseout(n.node, null))
      .on("mousedown", (n: NodeViewObject) => this.onNodeMousedown(n.node))
      .on("mouseup", (n: NodeViewObject) => this.onNodeMouseup(n.node))
      .on("dblclick", (n: NodeViewObject) => this.onNodeDetailsClicked(n.node));
  }

  private makeHoverDragBackground(groupEnter: any) {
    const added = groupEnter.append(StaticDomTags.NODE_HOVER_DRAG_AREA_BACKGROUND_SVG);
    added
      .attr("class", StaticDomTags.NODE_HOVER_DRAG_AREA_BACKGROUND_CLASS)
      .classed(StaticDomTags.TAG_SELECTED, (n: NodeViewObject) => n.node.selected())
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId())
      .attr("transform", (n: NodeViewObject) => "translate(-32.5,1)")
      .attr("width", 28)
      .attr("height", 28)
      .attr("x", 2)
      .attr("y", (n: NodeViewObject) => n.node.getNodeHeight() - NODE_TEXT_AREA_HEIGHT)
      .classed(
        StaticDomTags.NODE_READONLY,
        !this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable(),
      );

    if (this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      added.call(this.draggable);
    }

    added
      .on("mouseover", (n: NodeViewObject, i, a) => this.onNodeMouseoverDragButton(n.node, a[i]))
      .on("mouseout", (n: NodeViewObject, i, a) => this.onNodeMouseoutDragButton(n.node, a[i]))
      .on("mouseup", (n: NodeViewObject) => this.onNodeMouseup(n.node))
      .on("dblclick", (n: NodeViewObject) => this.onNodeDblClick(n.node));
  }

  private makeHoverDragRoot(groupEnter: any) {
    if (!this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      return;
    }
    groupEnter
      .append(StaticDomTags.NODE_HOVER_DRAG_AREA_SVG)
      .attr("class", StaticDomTags.NODE_HOVER_DRAG_AREA_CLASS)
      .classed(StaticDomTags.TAG_SELECTED, (n: NodeViewObject) => n.node.selected())
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId())
      .attr(
        "d",
        "m11.855 2.398-.356-.36-.356.36-3.841 3.897.712.702L11 " +
          "3.97V11H3.957l2.647-2.647-.707-.708-3.5 3.5-.354.354.354.354 3.5 " +
          "3.5.707-.708-2.646-2.645H11v7.03l-2.995-3.027-.71.703 3.852 3.894.356.36.355-.36 " +
          "3.842-3.898-.712-.701L12 19.032v-7.031h7.041l-2.645 2.645.708.708 " +
          "3.5-3.5.353-.354-.353-.354-3.5-3.5-.707.708L19.043 11H12V3.967l2.997 " +
          "3.029.711-.704-3.853-3.894Z",
      )
      .attr(
        "transform",
        (n: NodeViewObject) =>
          "translate(-28," + (n.node.getNodeHeight() - NODE_TEXT_AREA_HEIGHT + 4) + "),scale(1.0)",
      )
      .call(this.draggable)
      .on("mouseover", (n: NodeViewObject, i, a) => this.onNodeMouseoverDragButton(n.node, a[i]))
      .on("mouseout", (n: NodeViewObject, i, a) => this.onNodeMouseoutDragButton(n.node, a[i]))
      .on("mouseup", (n: NodeViewObject) => this.onNodeMouseup(n.node))
      .on("dblclick", (n: NodeViewObject) => this.onNodeDblClick(n.node));
  }

  private makeEditButtonBackground(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NODE_EDIT_AREA_BACKGROUND_SVG)
      .attr("class", StaticDomTags.NODE_EDIT_AREA_BACKGROUND_CLASS)
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId())
      .attr("transform", (n: NodeViewObject) => "translate(" + (n.node.getNodeWidth() + 1) + ",1)")
      .attr("width", 28)
      .attr("height", 28)
      .attr("x", 2)
      .attr("y", (n: NodeViewObject) => n.node.getNodeHeight() - NODE_TEXT_AREA_HEIGHT)
      .on("mouseover", (n: NodeViewObject, i, a) => this.onNodeMouseoverEditButton(n.node, a[i]))
      .on("mouseout", (n: NodeViewObject, i, a) => this.onNodeMouseoutEditButton(n.node, a[i]))
      .on("mousedown", (n: NodeViewObject) => this.onNodeDetailsClicked(n.node))
      .on("mouseup", (n: NodeViewObject) => this.onNodeMouseup(n.node));
  }

  private makeEditButton(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NODE_EDIT_AREA_SVG)
      .attr("class", StaticDomTags.NODE_EDIT_AREA_CLASS)
      .classed(StaticDomTags.TAG_SELECTED, (n: NodeViewObject) => n.node.selected())
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId())
      .attr(
        "d",
        "m25.853 6.71-.354-.352-.353.353-3.435 3.435-.353.354.353.353 " +
          "3.435 3.435.355.355.353-.355 3.435-3.449.353-.354-.354-.353-3.435-3.421Zm-" +
          "3.081 3.79 2.729-2.729 2.727 2.717-2.729 2.739-2.727-2.727Zm-2.918 2.212-." +
          "354-.354-.354.354-11.25 11.25-.146.146V28.25h4.142l.147-.146 11.25-11.252." +
          "353-.353-.354-.354-3.434-3.433ZM8.75 24.522l10.75-10.75 2.728 2.727-10.75 " +
          "10.751H8.75v-2.728Z",
      )
      .attr(
        "transform",
        (n: NodeViewObject) =>
          "translate(" +
          (n.node.getNodeWidth() + 1) +
          "," +
          (n.node.getNodeHeight() - NODE_TEXT_AREA_HEIGHT + 2) +
          "),scale(0.7)",
      )
      .on("mouseover", (n: NodeViewObject, i, a) => this.onNodeMouseoverEditButton(n.node, a[i]))
      .on("mouseout", (n: NodeViewObject, i, a) => this.onNodeMouseoutEditButton(n.node, a[i]))
      .on("mousedown", (n: NodeViewObject) => this.onNodeDetailsClicked(n.node))
      .on("mouseup", (n: NodeViewObject) => this.onNodeMouseup(n.node));
  }

  private makeNodeDockable(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NODE_DOCKABLE_SVG)
      .attr("class", StaticDomTags.NODE_DOCKABLE_CLASS)
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId())
      .attr("width", (n: NodeViewObject) => n.node.getNodeWidth())
      .attr("height", (n: NodeViewObject) => n.node.getNodeHeight() - NODE_TEXT_AREA_HEIGHT)
      .attr("x", 0)
      .attr("y", 0)
      .classed(StaticDomTags.NODE_TAG_JUNCTION_ONLY, (n: NodeViewObject) => n.node.isNonStopNode())
      .classed(
        StaticDomTags.NODE_HAS_CONNECTIONS,
        (n: NodeViewObject) => n.node.getConnections().length > 0,
      )
      .classed(
        StaticDomTags.TAG_MULTI_SELECTED,
        (n: NodeViewObject) =>
          n.node.selected() && this.editorView.editorMode === EditorMode.MultiNodeMoving,
      )
      .on("mouseover", (n: NodeViewObject, i, a) => this.onNodeDockableMouseover(n.node, a[i]))
      .on("mouseout", (n: NodeViewObject, i, a) => this.onNodeDockableMouseout(n.node, a[i]))
      .on("mousedown", (n: NodeViewObject) => this.onNodeMousedown(n.node))
      .on("mouseup", (n: NodeViewObject) => this.onNodeMouseup(n.node))
      .on("dblclick", (n: NodeViewObject) => this.onNodeDetailsClicked(n.node));
  }

  private makeAnalyticsArea(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NODE_ANALYTICSAREA_SVG)
      .attr("class", StaticDomTags.NODE_ANALYTICSAREA_CLASS)
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId())
      .attr("width", (n: NodeViewObject) => n.node.getNodeWidth())
      .attr("height", () => NODE_ANALYTICS_AREA_HEIGHT)
      .attr("x", 0)
      .attr(
        "y",
        (n: NodeViewObject) =>
          n.node.getNodeHeight() - NODE_TEXT_AREA_HEIGHT - 0.75 * NODE_ANALYTICS_AREA_HEIGHT,
      )
      .attr("title", "test")
      .classed(StaticDomTags.NODE_TAG_JUNCTION_ONLY, (n: NodeViewObject) => n.node.isNonStopNode())
      .classed(
        StaticDomTags.NODE_HAS_CONNECTIONS,
        (n: NodeViewObject) => n.node.getConnections().length > 0,
      )
      .on("mouseover", (n: NodeViewObject) => this.onNodeMouseover(n.node, null))
      .on("mousemove", (n: NodeViewObject) => this.onNodeMousemove(n.node, null))
      .on("mouseout", (n: NodeViewObject) => this.onNodeMouseout(n.node, null))
      .on("mousedown", (n: NodeViewObject) => this.onNodeMousedown(n.node))
      .on("mouseup", (n: NodeViewObject) => this.onNodeMouseup(n.node));
  }

  private makeAnalyticsTextLeftArea(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NODE_ANALYTICSAREA_TEXT_LEFT_SVG)
      .attr("class", StaticDomTags.NODE_ANALYTICSAREA_TEXT_LEFT_CLASS)
      .attr("x", NODE_TEXT_LEFT_SPACING)
      .attr(
        "y",
        (n: NodeViewObject) =>
          n.node.getNodeHeight() -
          NODE_TEXT_AREA_HEIGHT -
          0.5 * NODE_ANALYTICS_AREA_HEIGHT -
          TEXT_SIZE / 2,
      )
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId());
  }

  private makeAnalyticsTextRightArea(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NODE_ANALYTICSAREA_TEXT_RIGHT_SVG)
      .attr("class", StaticDomTags.NODE_ANALYTICSAREA_TEXT_RIGHT_CLASS)
      .attr("x", (n: NodeViewObject) => n.node.getNodeWidth() - NODE_TEXT_LEFT_SPACING)
      .attr(
        "y",
        (n: NodeViewObject) =>
          n.node.getNodeHeight() -
          NODE_TEXT_AREA_HEIGHT -
          0.5 * NODE_ANALYTICS_AREA_HEIGHT -
          TEXT_SIZE / 2,
      )
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId());
  }

  private makeLabelText(groupEnter: any) {
    const added = groupEnter.append(StaticDomTags.NODE_LABELAREA_TEXT_SVG);
    added
      .attr("class", StaticDomTags.NODE_LABELAREA_TEXT_CLASS)
      .attr("data-testid", StaticDomTags.NODE_LABELAREA_TEXT_CLASS)
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId())
      .attr("x", NODE_TEXT_LEFT_SPACING)
      .attr("y", (n: NodeViewObject) => n.node.getNodeHeight() - TEXT_SIZE / 2)
      .text((n: NodeViewObject) => n.node.getBetriebspunktName())
      .classed(StaticDomTags.NODE_TAG_JUNCTION_ONLY, (n: NodeViewObject) => n.node.isNonStopNode())
      .classed(
        StaticDomTags.NODE_HAS_CONNECTIONS,
        (n: NodeViewObject) => n.node.getConnections().length > 0,
      )
      .classed(
        StaticDomTags.NODE_READONLY,
        !this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable(),
      );

    if (!this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      return;
    }

    added
      .call(this.draggable)
      .on("mouseover", (n: NodeViewObject, i, a) => this.onNodeLabelAreaMouseover(n.node, a[i]))
      .on("mouseout", (n: NodeViewObject, i, a) => this.onNodeMouseout(n.node, a[i]))
      .on("mouseup", (n: NodeViewObject) => this.onNodeMouseup(n.node))
      .on("dblclick", (n: NodeViewObject) => this.onNodeDblClick(n.node));
  }

  private makeLabelConnectionText(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NODE_CONNECTIONTIME_TEXT_SVG)
      .attr("class", StaticDomTags.NODE_CONNECTIONTIME_TEXT_CLASS)
      .attr(StaticDomTags.NODE_ID, (n: NodeViewObject) => n.node.getId())
      .attr("x", (n: NodeViewObject) => n.node.getNodeWidth() - NODE_TEXT_LEFT_SPACING)
      .attr("y", (n: NodeViewObject) => n.node.getNodeHeight() - TEXT_SIZE / 2)
      .text((n: NodeViewObject) => n.node.getConnectionTime())
      .classed(StaticDomTags.NODE_TAG_JUNCTION_ONLY, (n: NodeViewObject) => n.node.isNonStopNode())
      .classed(
        StaticDomTags.NODE_HAS_CONNECTIONS,
        (n: NodeViewObject) => n.node.getConnections().length > 0,
      )
      .on("mouseover", (n: NodeViewObject) => this.onNodeLabelAreaMouseover(n.node, null))
      .on("mouseout", (n: NodeViewObject) => this.onNodeMouseout(n.node, null))
      .on("mousedown", (n: NodeViewObject) => this.onNodeDetailsClicked(n.node))
      .on("mouseup", (n: NodeViewObject) => this.onNodeMouseup(n.node));
  }

  onNodeDetailsClicked(node: Node) {
    d3.event.stopPropagation();
    this.editorView.showNodeInformation(node);
  }

  onNodeDockableMouseover(node: Node, domObj: any) {
    this.hoverNodeDockable(node, domObj);
  }

  onNodeDockableMouseout(node: Node, domObj: any) {
    this.unhoverNodeDockable(node, domObj);
  }

  hoverPinsAsConnectionDroppable(node: Node) {
    this.highlightPinsAsConnectionDroppable(node, true);
  }

  unhoverPinsAsConnectionDroppable(node: Node) {
    this.highlightPinsAsConnectionDroppable(node, false);
  }

  onNodeMouseover(node: Node, domObj: any) {
    this.hoverNode(node, domObj);
  }

  onNodeMousemove(node: Node, domObj: any) {
    this.hoverPinsAsConnectionDroppable(node);
  }

  onNodeLabelAreaMouseover(node: Node, domObj: any) {
    this.hoverNode(node, domObj);
    d3.selectAll(StaticDomTags.NODE_HOVER_DRAG_AREA_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.TAG_MUTED, true);
    d3.selectAll(StaticDomTags.NODE_EDIT_AREA_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.TAG_MUTED, true);
  }

  onNodeMouseout(node: Node, domObj: any) {
    this.unhoverNode(node, domObj);
  }

  onNodeMouseoverEditButton(node: Node, domObj: any) {
    this.hoverNode(node, domObj);
    d3.selectAll(StaticDomTags.NODE_EDIT_AREA_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.TAG_HOVER, true);
  }

  onNodeMouseoutEditButton(node: Node, domObj: any) {
    d3.selectAll(StaticDomTags.NODE_EDIT_AREA_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.TAG_HOVER, false);
    this.unhoverNode(node, domObj);
  }

  onNodeMouseoverDragButton(node: Node, domObj: any) {
    this.hoverNode(node, domObj);
    d3.selectAll(StaticDomTags.NODE_HOVER_DRAG_AREA_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.TAG_HOVER, true);
  }

  onNodeMouseoutDragButton(node: Node, domObj: any) {
    d3.selectAll(StaticDomTags.NODE_HOVER_DRAG_AREA_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.TAG_HOVER, false);
    this.unhoverNode(node, domObj);
  }

  onHoverNodeMouseover(node: Node) {
    this.hoverNode(node, null);
  }

  onHoverNodeMouseout(node: Node) {
    this.unhoverNode(node, null);
  }

  onNodeMousedown(node: Node) {
    if (this.editorView.editorMode === EditorMode.NetzgrafikEditing) {
      this.editorView.trainrunSectionPreviewLineView.startPreviewLine(node.getId());
      return;
    }
    if (this.editorView.editorMode === EditorMode.MultiNodeMoving) {
      const multiSelected = this.editorView.isNodeSelected(node.getId());
      if (multiSelected) {
        this.editorView.unselectNode(node.getId());
      } else {
        this.editorView.selectNode(node.getId());
      }
      return;
    }
    if (this.editorView.editorMode === EditorMode.Analytics) {
      this.editorView.calculateShortestDistanceNodesFromStartingNode(node.getId());
    }
  }

  onNodeMouseup(endNode: Node) {
    d3.event.stopPropagation();
    this.handleMouseUpEvent(endNode);
  }

  onNodeDblClick(node: Node) {
    if (this.editorView.editorMode === EditorMode.MultiNodeMoving) {
      return;
    }
    this.editorView.showNodeInformation(node);
  }

  handleMouseUpEvent(endNode: Node) {
    // user started in the empty area
    d3.selectAll(StaticDomTags.EDGE_LINE_PIN_DOM_REF).classed(
      StaticDomTags.EDGE_LINE_PIN_CONNECTION,
      false,
    );
    if (this.editorView.trainrunSectionPreviewLineView.getMode() === PreviewLineMode.NotDragging) {
      return;
    }

    const dragIntermediateStopInfo =
      this.editorView.trainrunSectionPreviewLineView.getDragIntermediateStopInfo();
    if (dragIntermediateStopInfo !== null) {
      this.replaceIntermediateStopWithTrainrunSections(dragIntermediateStopInfo, endNode);
    } else {
      const dragTransitionInfo =
        this.editorView.trainrunSectionPreviewLineView.getDragTransitionInfo();
      if (dragTransitionInfo !== null) {
        this.reconnectTransition(dragTransitionInfo, endNode);
      } else {
        const startNode: Node = this.editorView.trainrunSectionPreviewLineView.getStartNode();
        this.createNewTrainrunSection(startNode, endNode);
      }
    }
    d3.event.stopPropagation();
  }

  isNodeHovered(node: Node): boolean {
    return d3
      .selectAll(StaticDomTags.NODE_ROOT_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.TAG_HOVER);
  }

  hoverNode(node: Node, domObj: any) {
    if (domObj !== null) {
      d3.select(domObj).raise().classed(StaticDomTags.TAG_HOVER, true);
    }
    d3.selectAll(StaticDomTags.NODE_ROOT_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.TAG_HOVER, true);

    this.hoverPinsAsConnectionDroppable(node);
  }

  unhoverNode(node: Node, domObj: any) {
    if (domObj !== null) {
      d3.select(domObj).raise().classed(StaticDomTags.TAG_HOVER, false);
    }
    d3.selectAll(StaticDomTags.NODE_ROOT_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.TAG_HOVER, false);
    d3.selectAll(StaticDomTags.NODE_HOVER_DRAG_AREA_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.TAG_MUTED, false);
    d3.selectAll(StaticDomTags.NODE_EDIT_AREA_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.TAG_MUTED, false);

    this.unhoverPinsAsConnectionDroppable(node);
  }

  hoverNodeDockable(node: Node, domObj: any) {
    d3.selectAll(StaticDomTags.NODE_DOCKABLE_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.TAG_HOVER, true);
    this.hoverNode(node, domObj);
  }

  unhoverNodeDockable(node: Node, domObj: any) {
    d3.selectAll(StaticDomTags.NODE_DOCKABLE_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.TAG_HOVER, false);
    this.unhoverNode(node, domObj);
  }

  createNewTrainrunSection(startNode: Node, endNode: Node) {
    let existingTrainrunSection: TrainrunSection = null;
    if (
      this.editorView.trainrunSectionPreviewLineView.getMode() ===
      PreviewLineMode.DragExistingTrainrunSection
    ) {
      existingTrainrunSection =
        this.editorView.trainrunSectionPreviewLineView.getExistingTrainrunSection();
    }
    this.editorView.trainrunSectionPreviewLineView.stopPreviewLine();
    if (startNode === endNode) {
      return;
    }
    if (existingTrainrunSection !== null) {
      if (
        existingTrainrunSection.getSourceNode() === startNode &&
        existingTrainrunSection.getTargetNode() === endNode
      ) {
        return;
      }
      if (
        existingTrainrunSection.getSourceNode() === endNode &&
        existingTrainrunSection.getTargetNode() === startNode
      ) {
        return;
      }
    }

    if (existingTrainrunSection === null) {
      const sourceObj = d3.select(
        StaticDomTags.NODE_DOCKABLE_DOM_REF + '[id="' + startNode.getId() + '"]',
      );
      const sourceRect: DOMRect = sourceObj.node().getBoundingClientRect();
      const sourcePos = new Vec2D(
        sourceRect.x + sourceRect.width / 2,
        sourceRect.y + sourceRect.height / 2,
      );

      let targetPos = new Vec2D(
        endNode.getPositionX() + endNode.getNodeWidth() / 2,
        endNode.getPositionY() + endNode.getNodeHeight() / 2,
      );
      const targetObj = d3.select(
        StaticDomTags.NODE_DOCKABLE_DOM_REF + '[id="' + endNode.getId() + '"]',
      );
      if (targetObj.node() !== null) {
        const targetRect: DOMRect = targetObj.node().getBoundingClientRect();
        targetPos = new Vec2D(
          targetRect.x + targetRect.width / 2,
          targetRect.y + targetRect.height / 2,
        );
      }

      const position = Vec2D.scale(Vec2D.add(sourcePos, targetPos), 0.5);

      this.editorView.addTrainrunSectionWithSourceTarget(startNode, endNode, position);
    } else {
      this.editorView.reconnectTrainrunSection(startNode, endNode, existingTrainrunSection, true);
    }
  }

  replaceIntermediateStopWithTrainrunSections(
    dragIntermediateStopInfo: DragIntermediateStopInfo,
    endNode: Node,
  ) {
    this.editorView.replaceIntermediateStopWithNode(
      dragIntermediateStopInfo.viewObject.firstSection.getId(),
      dragIntermediateStopInfo.intermediateStopIndex,
      endNode.getId(),
    );
    this.editorView.trainrunSectionPreviewLineView.stopPreviewLine();
  }

  reconnectTransition(dragTransitionInfo: DragTransitionInfo, endNode: Node) {
    if (dragTransitionInfo.node.getId() === endNode.getId()) {
      this.editorView.trainrunSectionPreviewLineView.stopPreviewLine();
      return;
    }
    if (
      !(
        dragTransitionInfo.trainrunSection1.getSourceNodeId() !== endNode.getId() &&
        dragTransitionInfo.trainrunSection1.getTargetNodeId() !== endNode.getId() &&
        dragTransitionInfo.trainrunSection2.getSourceNodeId() !== endNode.getId() &&
        dragTransitionInfo.trainrunSection2.getTargetNodeId() !== endNode.getId()
      )
    ) {
      this.editorView.trainrunSectionPreviewLineView.stopPreviewLine();
      D3Utils.removeGrayout(dragTransitionInfo.trainrunSection1);
      D3Utils.removeGrayout(dragTransitionInfo.trainrunSection2);
      return;
    }

    // reconnect the transition
    const nodeId = dragTransitionInfo.node.getId();
    const isNonStop = dragTransitionInfo.transition.getIsNonStopTransit();
    const startNode1 =
      dragTransitionInfo.trainrunSection1.getSourceNodeId() !== nodeId
        ? dragTransitionInfo.trainrunSection1.getSourceNode()
        : dragTransitionInfo.trainrunSection1.getTargetNode();
    const startNode2 =
      dragTransitionInfo.trainrunSection2.getSourceNodeId() !== nodeId
        ? dragTransitionInfo.trainrunSection2.getSourceNode()
        : dragTransitionInfo.trainrunSection2.getTargetNode();
    this.editorView.reconnectTrainrunSection(
      startNode1,
      endNode,
      dragTransitionInfo.trainrunSection1,
      false,
    );
    this.editorView.reconnectTrainrunSection(
      startNode2,
      endNode,
      dragTransitionInfo.trainrunSection2,
      true,
    );

    // update the "transition" stop-state
    let trans = endNode.getTransition(dragTransitionInfo.trainrunSection2.getId());
    if (trans === undefined) {
      trans = endNode.getTransition(dragTransitionInfo.trainrunSection1.getId());
    }
    if (trans !== undefined) {
      if (trans.getIsNonStopTransit() !== isNonStop) {
        this.editorView.toggleNonStop(endNode, trans);
      }
    }

    // stop the preview line (updating progress stop)
    this.editorView.trainrunSectionPreviewLineView.stopPreviewLine();
  }

  private doDrag(nodeId: number, round = 1, dragEnd = false) {
    if (this.editorView.editorMode === EditorMode.Analytics) {
      return;
    }

    if (!dragEnd) {
      this.editorView.selectNode(nodeId, false);
    }
    const currentMousePosition = this.editorView.svgMouseController.getCurrentMousePosition();
    const newPosition: Vec2D = Vec2D.sub(currentMousePosition, this.dragPreviousMousePosition);
    newPosition.setData(newPosition.getX(), newPosition.getY());

    this.editorView.moveSelectedNodes(newPosition.getX(), newPosition.getY(), round, dragEnd);
    this.editorView.moveSelectedNotes(newPosition.getX(), newPosition.getY(), round, dragEnd);

    // update the drag mouse position (previous for next dragging step)
    this.dragPreviousMousePosition = currentMousePosition;
  }

  private highlightPinsAsConnectionDroppable(node: Node, hover: boolean) {
    if (this.editorView.trainrunSectionPreviewLineView.getMode() !== PreviewLineMode.NotDragging) {
      const dragTransitionInfo: DragTransitionInfo =
        this.editorView.trainrunSectionPreviewLineView.getDragTransitionInfo();
      if (dragTransitionInfo !== null) {
        if (hover && dragTransitionInfo.node.getId() === node.getId()) {
          dragTransitionInfo.setInsideNode(true);
          D3Utils.removeGrayout(dragTransitionInfo.trainrunSection1, node);
          D3Utils.removeGrayout(dragTransitionInfo.trainrunSection2, node);
        } else {
          dragTransitionInfo.setInsideNode(false);
          D3Utils.doGrayout(dragTransitionInfo.trainrunSection1, node);
          D3Utils.doGrayout(dragTransitionInfo.trainrunSection2, node);
        }
        this.editorView.trainrunSectionPreviewLineView.updatePreviewLine();
        return;
      }

      const ts: TrainrunSection =
        this.editorView.trainrunSectionPreviewLineView.getExistingTrainrunSection();
      if (ts !== null) {
        let startNodeId = this.editorView.trainrunSectionPreviewLineView.getStartNode().getId();
        if (startNodeId === ts.getTargetNodeId()) {
          startNodeId = ts.getSourceNodeId();
        } else {
          startNodeId = ts.getTargetNodeId();
        }
        if (startNodeId === node.getId()) {
          const obj1 = d3.selectAll(StaticDomTags.EDGE_LINE_PIN_DOM_REF);
          obj1.each(function () {
            const obj = d3.select(this);
            if (obj.attr(StaticDomTags.EDGE_NODE_ID) === "" + node.getId()) {
              if (obj.attr(StaticDomTags.EDGE_ID) !== "" + ts.getId()) {
                if (obj.attr(StaticDomTags.EDGE_LINE_LINE_ID) !== "" + ts.getTrainrunId()) {
                  obj.classed(StaticDomTags.EDGE_LINE_PIN_CONNECTION, hover);
                }
              }
            } // the current element
          });

          if (hover) {
            D3Utils.removeGrayout(ts);
            this.editorView.trainrunSectionPreviewLineView.setStartConnectionPos(
              this.editorView.connectionsView.getConnectionPinPosition(ts, node),
            );
          } else {
            this.editorView.trainrunSectionPreviewLineView.resetStartConnectionPos();
            D3Utils.doGrayout(ts);
          }
        }
      }
    } else {
      d3.selectAll(StaticDomTags.EDGE_LINE_PIN_DOM_REF).classed(
        StaticDomTags.EDGE_LINE_PIN_CONNECTION,
        false,
      );
    }
  }
}
