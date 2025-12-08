import * as d3 from "d3";
import {Node} from "../../../models/node.model";
import {EditorView} from "./editor.view";
import {StaticDomTags} from "./static.dom.tags";
import {D3Utils} from "./d3.utils";
import {Connection} from "../../../models/connection.model";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {DEFAULT_PIN_RADIUS} from "../../rastering/definitions";
import {Vec2D} from "../../../utils/vec2D";
import {ConnectionsViewObject} from "./connectionViewObject";
import {TrainrunSectionViewObject} from "./trainrunSectionViewObject";
import {LevelOfDetail} from "../../../services/ui/level.of.detail.service";

export class ConnectionsView {
  connectionsGroup;
  editorView: EditorView;

  constructor(editorView: EditorView) {
    this.editorView = editorView;
  }

  static displayConnectionPinPort1(c: Connection, node: Node): boolean {
    const port1 = node.getPort(c.getPortId1());
    return port1.getTrainrunSection().getTrainrun().selected();
  }

  static displayConnectionPinPort2(c: Connection, node: Node): boolean {
    const port2 = node.getPort(c.getPortId2());
    return port2.getTrainrunSection().getTrainrun().selected();
  }

  static displayConnection(c: Connection, node: Node): boolean {
    return (
      ConnectionsView.displayConnectionPinPort1(c, node) ||
      ConnectionsView.displayConnectionPinPort2(c, node)
    );
  }

  static getSelectedTrainrunId(c: Connection, node: Node): number {
    const port1 = node.getPort(c.getPortId1());
    const trainrun1 = port1.getTrainrunSection().getTrainrun();
    if (trainrun1.selected()) {
      return trainrun1.getId();
    }
    const port2 = node.getPort(c.getPortId2());
    const trainrun2 = port2.getTrainrunSection().getTrainrun();
    if (trainrun2.selected()) {
      return trainrun2.getId();
    }
    return null;
  }

  static getTrainrunSectionPort1(c: Connection, node: Node): TrainrunSection {
    const port1 = node.getPort(c.getPortId1());
    return port1.getTrainrunSection();
  }

  static getTrainrunSectionPort2(c: Connection, node: Node): TrainrunSection {
    const port2 = node.getPort(c.getPortId2());
    return port2.getTrainrunSection();
  }

  getConnectionPinPosition(ts: TrainrunSection, node: Node): Vec2D {
    const viewObject = new TrainrunSectionViewObject(this.editorView, [ts]);

    if (node.getId() === ts.getSourceNodeId()) {
      return viewObject.getPositionAtSourceNode();
    }
    return viewObject.getPositionAtTargetNode();
  }

  setGroup(connectionsGroup) {
    this.connectionsGroup = connectionsGroup;
    this.connectionsGroup.attr("class", "ConnectionsView");
  }

  displayConnectionFilteredSelectedTrainrun(c: Connection, node: Node): boolean {
    const port1 = node.getPort(c.getPortId1());
    const port2 = node.getPort(c.getPortId2());
    const selectedTrainrun = this.editorView.getSelectedTrainrun();

    if (!this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      if (!this.editorView.isFilterConnectionsEnabled()) {
        return false;
      }
      if (
        !this.editorView.isFilterTrainrunCategoryEnabled(
          port1.getTrainrunSection().getTrainrun().getTrainrunCategory(),
        )
      ) {
        return false;
      }
      if (
        !this.editorView.isFilterTrainrunCategoryEnabled(
          port2.getTrainrunSection().getTrainrun().getTrainrunCategory(),
        )
      ) {
        return false;
      }

      if (
        !this.editorView.isFilterTrainrunFrequencyEnabled(
          port1.getTrainrunSection().getTrainrun().getTrainrunFrequency(),
        )
      ) {
        return false;
      }
      if (
        !this.editorView.isFilterTrainrunFrequencyEnabled(
          port2.getTrainrunSection().getTrainrun().getTrainrunFrequency(),
        )
      ) {
        return false;
      }
    }

    if (selectedTrainrun === null) {
      return true;
    }
    if (port1.getTrainrunSection().getTrainrunId() === selectedTrainrun.getId()) {
      return true;
    }
    if (port2.getTrainrunSection().getTrainrunId() === selectedTrainrun.getId()) {
      return true;
    }
    return false;
  }

  createConnectionCurve(drawingGroup: d3.selector) {
    drawingGroup
      .append(StaticDomTags.CONNECTION_LINE_SVG)
      .attr("class", StaticDomTags.CONNECTION_LINE_CLASS)
      .attr("d", (c: ConnectionsViewObject) =>
        D3Utils.getBezierCurveAsSVGString(c.connection.getPath()),
      )
      .attr(StaticDomTags.CONNECTION_ID, (c: ConnectionsViewObject) => c.connection.getId())
      .classed(StaticDomTags.TAG_WARNING, (c: ConnectionsViewObject) => c.connection.hasWarning())
      .classed(
        StaticDomTags.CONNECTION_NOT_VISIBLE,
        (c: ConnectionsViewObject) => !ConnectionsView.displayConnection(c.connection, c.node),
      )
      .classed(StaticDomTags.TAG_SELECTED, (c: ConnectionsViewObject) => c.connection.selected())
      .on("mouseover", (c: ConnectionsViewObject, i, a) =>
        this.onConnectionMouseover(c.connection, a[i], c.node),
      )
      .on("mouseout", (c: ConnectionsViewObject, i, a) =>
        this.onConnectionMouseout(c.connection, a[i], c.node),
      )
      .on("mouseup", (c: ConnectionsViewObject, i, a) =>
        this.onConnectionMouseup(c.connection, a[i], c.node),
      );
  }

  createConnectionSinglePin(drawingGroup: d3.selector, pinPos: Vec2D) {
    const draggable = d3
      .drag()
      .on("start", (cv: ConnectionsViewObject, i, a) =>
        this.onConnectionPinDragStart(cv.connection, a[i]),
      )
      .on("drag", (cv: ConnectionsViewObject, i, a) =>
        this.onConnectionPinDragged(cv.connection, a[i]),
      )
      .on("end", (cv: ConnectionsViewObject, i, a) =>
        this.onConnectionPinDragEnd(cv.connection, a[i], cv.node),
      );

    drawingGroup
      .append(StaticDomTags.CONNECTION_LINE_PIN_SVG)
      .attr("class", StaticDomTags.CONNECTION_LINE_PIN_CLASS)
      .attr(StaticDomTags.CONNECTION_NODE_ID, (cv: ConnectionsViewObject) => cv.node.getId())
      .attr(StaticDomTags.CONNECTION_ID, (c: ConnectionsViewObject) => c.connection.getId())
      .attr("cx", pinPos.getX())
      .attr("cy", pinPos.getY())
      .attr("org_x", pinPos.getX())
      .attr("org_y", pinPos.getY())
      .attr("r", DEFAULT_PIN_RADIUS)
      .attr(StaticDomTags.CONNECTION_TRAINRUN_ID, (cv: ConnectionsViewObject) =>
        ConnectionsView.getSelectedTrainrunId(cv.connection, cv.node),
      )
      .classed(StaticDomTags.TAG_SELECTED, (c: ConnectionsViewObject) => c.connection.selected())
      .on("mouseover", (cv: ConnectionsViewObject, i, a) =>
        this.onConnectionPinMouseover(cv.connection, a[i], cv.node),
      )
      .on("mouseout", (cv: ConnectionsViewObject, i, a) =>
        this.onConnectionPinMouseout(cv.connection, a[i], cv.node),
      )
      .on("mouseup", (cv: ConnectionsViewObject, i, a) =>
        this.onConnectionMouseup(cv.connection, a[i], cv.node),
      )
      .call(draggable)
      .classed(StaticDomTags.TAG_WARNING, (cv: ConnectionsViewObject) =>
        cv.connection.hasWarning(),
      );
  }

  createConnectionPins(drawingGroup: d3.selector) {
    const selectedTrainrun = this.editorView.getSelectedTrainrun();

    drawingGroup.each((c: ConnectionsViewObject, i, a) => {
      const ts1 = ConnectionsView.getTrainrunSectionPort1(c.connection, c.node);
      const ts2 = ConnectionsView.getTrainrunSectionPort2(c.connection, c.node);
      if (ConnectionsView.displayConnection(c.connection, c.node)) {
        if (ConnectionsView.displayConnectionPinPort2(c.connection, c.node)) {
          if (selectedTrainrun === null || selectedTrainrun.getId() === ts2.getTrainrunId()) {
            const pinPos = this.getConnectionPinPosition(ts1, c.node);
            this.createConnectionSinglePin(d3.select(a[i]), pinPos);
          }
        }

        if (ConnectionsView.displayConnectionPinPort1(c.connection, c.node)) {
          if (selectedTrainrun === null || selectedTrainrun.getId() === ts1.getTrainrunId()) {
            const pinPos = this.getConnectionPinPosition(ts2, c.node);
            this.createConnectionSinglePin(d3.select(a[i]), pinPos);
          }
        }
      }
    });
  }

  createTransitionViewObjects(inputConnection: Connection[]): ConnectionsViewObject[] {
    const connectionsViewObjects: ConnectionsViewObject[] = [];
    inputConnection.forEach((connection: Connection) => {
      const node: Node = this.editorView.getNodeFromConnection(connection);
      if (this.displayConnectionFilteredSelectedTrainrun(connection, node)) {
        connectionsViewObjects.push(
          new ConnectionsViewObject(
            this.editorView,
            connection,
            node,
            ConnectionsView.displayConnectionPinPort1(connection, node),
            ConnectionsView.displayConnectionPinPort2(connection, node),
          ),
        );
      }
    });
    return connectionsViewObjects;
  }

  filterConnectionsToDisplay(con: Connection): boolean {
    if (this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      // disable filtering in view (render all objects)
      return true;
    }

    const node: Node = this.editorView.getNodeFromConnection(con);

    // filter if node is collapsed - do not show connections for collapsed nodes
    if (node.getIsCollapsed()) {
      return false;
    }

    const trainrunSection1: TrainrunSection = node.getPort(con.getPortId1()).getTrainrunSection();
    const trainrunSection2: TrainrunSection = node.getPort(con.getPortId2()).getTrainrunSection();
    const filterTrainrun1 = this.editorView.filterTrainrun(trainrunSection1.getTrainrun());
    const filterTrainrun2 = this.editorView.filterTrainrun(trainrunSection2.getTrainrun());
    const filterNode = this.editorView.checkFilterNode(node);
    return filterNode && filterTrainrun1 && filterTrainrun2;
  }

  displayConnections(inputConnections: Connection[]) {
    const connections = inputConnections.filter(
      (c) =>
        this.editorView.doCullCheckPositionsInViewport(c.getPath()) &&
        this.filterConnectionsToDisplay(c),
    );

    const connectionsGroup = this.connectionsGroup
      .selectAll(StaticDomTags.CONNECTION_ROOT_CONTAINER_DOM_REF)
      .data(this.createTransitionViewObjects(connections), (c: ConnectionsViewObject) => c.key);

    const grpEnter = connectionsGroup
      .enter()
      .append(StaticDomTags.GROUP_SVG)
      .attr("class", StaticDomTags.CONNECTION_ROOT_CONTAINER)
      .classed(StaticDomTags.TAG_SELECTED, (c: ConnectionsViewObject) => c.connection.selected());

    if (!this.editorView.isElementDragging()) {
      this.renderConnectionObject(grpEnter);
    }
    connectionsGroup.exit().remove();

    d3.selectAll(
      StaticDomTags.CONNECTION_ROOT_CONTAINER_DOM_REF + "." + StaticDomTags.TAG_SELECTED,
    ).raise();
  }

  renderConnectionObject(groupEnter: any) {
    switch (this.editorView.getLevelOfDetail()) {
      case LevelOfDetail.LEVEL3: {
        //statements;
        this.makeConnectionLOD3(groupEnter);
        break;
      }
      case LevelOfDetail.LEVEL2: {
        //statements;
        this.makeConnectionLOD2(groupEnter);
        break;
      }
      case LevelOfDetail.LEVEL1: {
        //statements;
        this.makeConnectionLOD1(groupEnter);
        break;
      }
      case LevelOfDetail.LEVEL0: {
        //statements;
        this.makeConnectionLOD0(groupEnter);
        break;
      }
      default: {
        //statements;
        this.makeConnectionLODFull(groupEnter);
      }
    }
  }

  makeConnectionLODFull(groupEnter: any) {
    this.createConnectionCurve(groupEnter);
    this.createConnectionPins(groupEnter);
  }

  makeConnectionLOD3(groupEnter: any) {
    this.createConnectionCurve(groupEnter);
    this.createConnectionPins(groupEnter);
  }

  makeConnectionLOD2(groupEnter: any) {
    this.createConnectionCurve(groupEnter);
  }

  makeConnectionLOD1(groupEnter: any) {
    this.createConnectionCurve(groupEnter);
  }

  makeConnectionLOD0(groupEnter: any) {}

  onConnectionMouseup(connection: Connection, domObj: any, node: Node) {
    d3.event.stopPropagation();
    this.editorView.nodesView.handleMouseUpEvent(node);
  }

  onConnectionMouseover(connection: Connection, domObj: any, node: Node) {
    this.editorView.nodesView.hoverNodeDockable(node, null);
  }

  onConnectionMouseout(connection: Connection, domObj: any, node: Node) {
    this.editorView.nodesView.unhoverNodeDockable(node, null);
  }

  onConnectionPinMouseover(connection: Connection, domObj: any, node: Node) {
    d3.select(domObj).classed(StaticDomTags.TAG_HOVER, true);
    this.editorView.nodesView.hoverNodeDockable(node, null);
  }

  onConnectionPinMouseout(connection: Connection, domObj: any, node: Node) {
    d3.select(domObj).classed(StaticDomTags.TAG_HOVER, false);
    this.editorView.nodesView.unhoverNodeDockable(node, null);
  }

  onConnectionPinDragStart(connection: Connection, domObj: any) {
    d3.select(domObj).classed(StaticDomTags.CONNECTION_PIN_DRAGGING, true);
    D3Utils.disableTrainrunSectionForEventHandling();
  }

  onConnectionPinDragged(connection: Connection, domObj: any) {
    d3.select(domObj).classed(StaticDomTags.CONNECTION_PIN_DRAGGING, true);
    const currentMousePosition = this.editorView.svgMouseController.getCurrentMousePosition();
    const obj = d3.select(domObj);
    obj.attr("cx", currentMousePosition.getX());
    obj.attr("cy", currentMousePosition.getY());
  }

  onConnectionPinDragEnd(connection: Connection, domObj: any, node: Node) {
    D3Utils.resetTrainrunSectionForEventHandling();
    d3.select(domObj).classed(StaticDomTags.CONNECTION_PIN_DRAGGING, false);
    if (this.editorView.nodesView.isNodeHovered(node)) {
      const obj = d3.select(domObj);
      obj.attr("cx", obj.attr("org_x"));
      obj.attr("cy", obj.attr("org_y"));
      this.setUnderlyingTrainrunAsSelected(connection, domObj, node);
      return;
    }
    this.editorView.removeConnectionFromNode(connection, node);
    this.setUnderlyingTrainrunAsSelected(connection, domObj, node);
  }

  private setUnderlyingTrainrunAsSelected(connection: Connection, domObj: any, node: Node) {
    const trainrunID = d3.select(domObj).attr(StaticDomTags.CONNECTION_TRAINRUN_ID);
    const trainrunPort1 = ConnectionsView.getTrainrunSectionPort1(connection, node).getTrainrun();
    const trainrunPort2 = ConnectionsView.getTrainrunSectionPort2(connection, node).getTrainrun();
    if ("" + trainrunPort1.getId() === trainrunID) {
      this.editorView.setTrainrunAsSelected(trainrunPort1);
    } else {
      this.editorView.setTrainrunAsSelected(trainrunPort2);
    }
  }
}
