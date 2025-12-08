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

type ConnectionDragEvent = d3.D3DragEvent<SVGElement, ConnectionsViewObject, unknown>;

export class ConnectionsView {
  connectionsGroup: d3.Selection<SVGElement, undefined, Element, undefined>;
  editorView: EditorView;
  dragDomObj: SVGElement | null = null;

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

  setGroup(connectionsGroup: d3.Selection<SVGElement, undefined, Element, undefined>) {
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

  createConnectionCurve(
    drawingGroup: d3.Selection<SVGElement, ConnectionsViewObject, Element, undefined>,
  ) {
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
      .on("mouseover", (event: MouseEvent, c: ConnectionsViewObject) =>
        this.onConnectionMouseover(event, c.connection, c.node),
      )
      .on("mouseout", (event: MouseEvent, c: ConnectionsViewObject) =>
        this.onConnectionMouseout(event, c.connection, c.node),
      )
      .on("mouseup", (event: MouseEvent, c: ConnectionsViewObject) =>
        this.onConnectionMouseup(event, c.connection, c.node),
      );
  }

  createConnectionSinglePin(
    drawingGroup: d3.Selection<SVGElement, ConnectionsViewObject, Element, undefined>,
    pinPos: Vec2D,
  ) {
    const draggable = d3
      .drag<SVGElement, ConnectionsViewObject>()
      .on("start", (event: ConnectionDragEvent, cv: ConnectionsViewObject) =>
        this.onConnectionPinDragStart(event, cv.connection),
      )
      .on("drag", (event: ConnectionDragEvent, cv: ConnectionsViewObject) =>
        this.onConnectionPinDragged(event, cv.connection),
      )
      .on("end", (event: ConnectionDragEvent, cv: ConnectionsViewObject) =>
        this.onConnectionPinDragEnd(event, cv.connection, cv.node),
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
      .on("mouseover", (event: MouseEvent, cv: ConnectionsViewObject) =>
        this.onConnectionPinMouseover(event, cv.connection, cv.node),
      )
      .on("mouseout", (event: MouseEvent, cv: ConnectionsViewObject) =>
        this.onConnectionPinMouseout(event, cv.connection, cv.node),
      )
      .on("mouseup", (event: MouseEvent, cv: ConnectionsViewObject) =>
        this.onConnectionMouseup(event, cv.connection, cv.node),
      )
      .call(draggable)
      .classed(StaticDomTags.TAG_WARNING, (cv: ConnectionsViewObject) =>
        cv.connection.hasWarning(),
      );
  }

  createConnectionPins(
    drawingGroup: d3.Selection<SVGElement, ConnectionsViewObject, Element, undefined>,
  ) {
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

  renderConnectionObject(
    groupEnter: d3.Selection<SVGElement, ConnectionsViewObject, Element, undefined>,
  ) {
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

  makeConnectionLODFull(
    groupEnter: d3.Selection<SVGElement, ConnectionsViewObject, Element, undefined>,
  ) {
    this.createConnectionCurve(groupEnter);
    this.createConnectionPins(groupEnter);
  }

  makeConnectionLOD3(
    groupEnter: d3.Selection<SVGElement, ConnectionsViewObject, Element, undefined>,
  ) {
    this.createConnectionCurve(groupEnter);
    this.createConnectionPins(groupEnter);
  }

  makeConnectionLOD2(
    groupEnter: d3.Selection<SVGElement, ConnectionsViewObject, Element, undefined>,
  ) {
    this.createConnectionCurve(groupEnter);
  }

  makeConnectionLOD1(
    groupEnter: d3.Selection<SVGElement, ConnectionsViewObject, Element, undefined>,
  ) {
    this.createConnectionCurve(groupEnter);
  }

  makeConnectionLOD0(
    groupEnter: d3.Selection<SVGElement, ConnectionsViewObject, Element, undefined>,
  ) {}

  onConnectionMouseup(event: MouseEvent, connection: Connection, node: Node) {
    event.stopPropagation();
    this.editorView.nodesView.handleMouseUpEvent(event, node);
  }

  onConnectionMouseover(event: MouseEvent, connection: Connection, node: Node) {
    this.editorView.nodesView.hoverNodeDockable(event, node);
  }

  onConnectionMouseout(event: MouseEvent, connection: Connection, node: Node) {
    this.editorView.nodesView.unhoverNodeDockable(event, node);
  }

  onConnectionPinMouseover(event: MouseEvent, connection: Connection, node: Node) {
    d3.select(D3Utils.getMouseEventCurrentTarget(event)).classed(StaticDomTags.TAG_HOVER, true);
    this.editorView.nodesView.hoverNodeDockable(event, node);
  }

  onConnectionPinMouseout(event: MouseEvent, connection: Connection, node: Node) {
    d3.select(D3Utils.getMouseEventCurrentTarget(event)).classed(StaticDomTags.TAG_HOVER, false);
    this.editorView.nodesView.unhoverNodeDockable(event, node);
  }

  onConnectionPinDragStart(event: ConnectionDragEvent, connection: Connection) {
    const domObj = D3Utils.getMouseEventCurrentTarget(event.sourceEvent);
    this.dragDomObj = domObj;
    d3.select(domObj).classed(StaticDomTags.CONNECTION_PIN_DRAGGING, true);
    D3Utils.disableTrainrunSectionForEventHandling();
  }

  onConnectionPinDragged(event: ConnectionDragEvent, connection: Connection) {
    const obj = d3.select(this.dragDomObj);
    obj.classed(StaticDomTags.CONNECTION_PIN_DRAGGING, true);
    const currentMousePosition = this.editorView.svgMouseController.getCurrentMousePosition(
      event.sourceEvent,
    );
    obj.attr("cx", currentMousePosition.getX());
    obj.attr("cy", currentMousePosition.getY());
  }

  onConnectionPinDragEnd(event: ConnectionDragEvent, connection: Connection, node: Node) {
    D3Utils.resetTrainrunSectionForEventHandling();
    const domObj = this.dragDomObj;
    this.dragDomObj = null;
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

  private setUnderlyingTrainrunAsSelected(connection: Connection, domObj: SVGElement, node: Node) {
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
