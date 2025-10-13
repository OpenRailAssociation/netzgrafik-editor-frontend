import {Component, EventEmitter, Input, OnInit, Output} from "@angular/core";
import {PerlenketteNode} from "../model/perlenketteNode";
import {NodeService} from "../../services/data/node.service";
import {PerlenketteTrainrun} from "../model/perlenketteTrainrun";
import {TrainrunService} from "../../services/data/trainrun.service";
import {Transition} from "../../models/transition.model";
import {D3Utils} from "../../view/editor-main-view/data-views/d3.utils";
import {Vec2D} from "../../utils/vec2D";
import {StaticDomTags} from "../../view/editor-main-view/data-views/static.dom.tags";
import {PerlenketteSection} from "../model/perlenketteSection";
import {FilterService} from "../../services/ui/filter.service";
import {Trainrun} from "../../models/trainrun.model";
import {PerlenketteConnection} from "../model/perlenketteConnection";
import {PerlenketteItem} from "../model/perlenketteItem";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {VersionControlService} from "../../services/data/version-control.service";

@Component({
  selector: "sbb-perlenkette-node",
  templateUrl: "./perlenkette-node.component.html",
  styleUrls: ["./perlenkette-node.component.scss"],
})
export class PerlenketteNodeComponent implements OnInit {
  @Input() perlenketteNode: PerlenketteNode;
  @Input() perlenketteTrainrun: PerlenketteTrainrun;
  @Input() isTopNode = false;
  @Input() isBottomNode = false;
  @Output() signalIsBeingEdited = new EventEmitter<PerlenketteSection>();
  @Output() signalHeightChanged = new EventEmitter<number>();

  heightConnectionSurplus: number;
  isExpanded = true;

  surplus = 20;

  constructor(
    public nodeService: NodeService,
    public trainrunService: TrainrunService,
    readonly filterService: FilterService,
    readonly uiInteractionService: UiInteractionService,
    readonly versionControlService: VersionControlService,
  ) {}

  ngOnInit() {
    this.isExpanded = true;
    this.calculateHeightConnectionSurplus();
  }

  getVariantIsWritable(): boolean {
    return this.versionControlService.getVariantIsWritable();
  }

  getConnectionIssue(): string {
    let amountOfWarningConnections = 0;
    this.perlenketteNode.connections.forEach(
      (mockConnection) => mockConnection.connectionWarning && amountOfWarningConnections++,
    );
    if (amountOfWarningConnections === 0) {
      return $localize`:@@app.perlenkette.perlenkette-node.0-warning-connection:No incorrect connection`;
    }
    if (amountOfWarningConnections === 1) {
      return $localize`:@@app.perlenkette.perlenkette-node.1-warning-connection:1 incorrect connection`;
    }
    return $localize`:@@app.perlenkette.perlenkette-node.n-warning-connections:${amountOfWarningConnections}:number: incorrect connections`;
  }

  getFittingConnections(): string {
    let amountOfFittingConnections = 0;
    this.perlenketteNode.connections.forEach(
      (mockConnection) => !mockConnection.connectionWarning && amountOfFittingConnections++,
    );
    if (amountOfFittingConnections === 0) {
      return $localize`:@@app.perlenkette.perlenkette-node.0-fitting-connection:No fitting connection`;
    }
    if (amountOfFittingConnections === 1) {
      return $localize`:@@app.perlenkette.perlenkette-node.1-fitting-connection:1 fitting connection`;
    }
    return $localize`:@@app.perlenkette.perlenkette-node.n-fitting-connections:${amountOfFittingConnections}:number: fitting connections`;
  }

  expandConnections() {
    this.isExpanded = !this.isExpanded;
    this.calculateHeightConnectionSurplus();
  }

  private calculateHeightConnectionSurplus() {
    const startEndNode =
      this.perlenketteNode.isTopNode(this.perlenketteTrainrun) ||
      this.perlenketteNode.isTopNode(this.perlenketteTrainrun);

    if (this.isExpanded) {
      const topLen = this.perlenketteNode.getConnectionsTopNodes(this.perlenketteTrainrun).length;
      const bottomLen = this.perlenketteNode.getConnectionsBottomNodes(
        this.perlenketteTrainrun,
      ).length;

      this.heightConnectionSurplus =
        (Math.max(startEndNode ? 0 : 1, topLen) +
          Math.max(0, (topLen > 0 ? 1 : 0) + bottomLen - 1) -
          (this.perlenketteNode.isBottomNode(this.perlenketteTrainrun) ? 1.0 : 0.0)) *
        this.surplus;
    } else {
      this.heightConnectionSurplus = (2 - 1) * this.surplus;
    }
    this.signalHeightChanged.next(Math.max(64, 64 + this.heightConnectionSurplus));
  }

  hasConnections() {
    return this.perlenketteNode.connections.length > 0;
  }

  hasAnyTrainConnections(): boolean {
    const node = this.nodeService.getNodeFromId(this.perlenketteNode.nodeId);
    return node.getConnections().length > 0;
  }

  isStopNode(): boolean {
    const node = this.nodeService.getNodeFromId(this.perlenketteNode.nodeId);
    return !node.isNonStopNode();
  }

  getNodeClassTag() {
    let tag = "";
    if (this.hasConnections()) {
      tag += " has_connections";
    }
    if (!this.isStopNode()) {
      tag += " junction_only";
      if (this.hasAnyTrainConnections()) {
        tag += " has_connections";
      }
    }
    if (this.perlenketteNode?.transition?.getIsNonStopTransit() && this.hasConnections()) {
      tag += " no_stop_has_connections";
    }
    return tag;
  }

  getNonStopClassTag(): string {
    if (this.perlenketteNode.transition === undefined) {
      return "";
    }
    if (!this.perlenketteNode.transition.getIsNonStopTransit()) {
      return "";
    }
    return "nonstop";
  }

  getConnectionsSize(minSize: number, calculatedConnectionSize: number): number {
    const startEndNode =
      this.perlenketteNode.isTopNode(this.perlenketteTrainrun) ||
      this.perlenketteNode.isTopNode(this.perlenketteTrainrun);
    if (startEndNode) {
      return calculatedConnectionSize;
    }
    return Math.max(minSize, calculatedConnectionSize);
  }

  getSepLinePos() {
    const topLen = this.perlenketteNode.getConnectionsTopNodes(this.perlenketteTrainrun).length;
    if (topLen === 0) {
      return 0.75;
    }
    return topLen + 0.5;
  }

  getTextTerminalStation(connection: PerlenketteConnection, connectionGrpKey: number, pos: number) {
    return pos === 0 ? connection.terminalStationBackward : connection.terminalStation;
  }

  getTextNameOrTime(connection: PerlenketteConnection, connectionGrpKey: number, pos: number) {
    return pos === 0
      ? connection.categoryShortName + "" + connection.title
      : "" + connection.remainingTime;
  }

  transformIndex(index: number, connectionGrpKey: number): number {
    const startEndNode =
      this.perlenketteNode.isTopNode(this.perlenketteTrainrun) ||
      this.perlenketteNode.isTopNode(this.perlenketteTrainrun);

    if (connectionGrpKey === null) {
      return index;
    }
    if (connectionGrpKey === undefined) {
      return index;
    }
    const topLen = this.perlenketteNode.getConnectionsTopNodes(this.perlenketteTrainrun).length;
    return index + Math.max(connectionGrpKey, startEndNode ? 0 : 1) + (topLen > 0 ? 1 : 0);
  }

  getColoringClassTag(connection: PerlenketteConnection = undefined): string {
    let trainrun2: Trainrun = undefined;
    let selected_tag = "";
    if (connection !== undefined) {
      trainrun2 = connection.connectedTrainrun;
      if (connection.connection.selected()) {
        selected_tag = " " + StaticDomTags.TAG_SELECTED;
      }
    }
    if (trainrun2 === undefined) {
      trainrun2 = this.trainrunService.getTrainrunFromId(this.perlenketteTrainrun.trainrunId);
    }
    return (
      " ColorRef_" +
      trainrun2.getCategoryColorRef() +
      " Freq_" +
      trainrun2.getFrequency() +
      " LinePatternRef_" +
      trainrun2.getFrequencyLinePatternRef() +
      selected_tag
    );
  }

  getTextNameOrTimeClassTag(
    connection: PerlenketteConnection,
    connectionGrpKey: number,
    pos: number,
  ): string {
    let retVal = this.getColoringClassTag(connection);
    if (pos !== 0 && this.isNonStopTransition(connection)) {
      retVal = retVal + " " + StaticDomTags.TAG_WARNING;
    }

    return pos === 0 ? retVal + " TrainrunName" : retVal + " RemainingTime";
  }

  getTextTerminalStationlassTag(
    connection: PerlenketteConnection,
    connectionGrpKey: number,
    pos: number,
  ): string {
    const retVal = this.getColoringClassTag(connection);
    return pos === 0 ? retVal + " FROM" : retVal + " TO";
  }

  getPathClassTag(connection: PerlenketteConnection = undefined): string {
    if (connection === undefined) {
      const lineTag =
        " Freq_" +
        this.perlenketteTrainrun.frequency +
        " LinePatternRef_" +
        this.perlenketteTrainrun.trainrunTimeCategory.linePatternRef;
      return "UI_DIALOG " + this.getColoringClassTag() + lineTag;
    }

    let selected_tag = "";
    if (connection.connection.selected()) {
      selected_tag = " " + StaticDomTags.TAG_SELECTED;
    }
    const lineTag =
      " Freq_" +
      connection.frequency +
      " LinePatternRef_" +
      connection.connectedTrainrun.getTimeCategoryLinePatternRef();
    return "UI_DIALOG " + selected_tag + this.getColoringClassTag(connection) + lineTag;
  }

  getConnectedTrainEdgeLineTransform(startPosX: number, startPosY: number): string {
    return "translate(" + startPosX + "," + startPosY + ")";
  }

  getInitialExpanedTranform(): string {
    const len = this.perlenketteNode.connections.length + 2;
    return "translate(0," + this.surplus / len + ")";
  }

  getConnectedTrainEdgeLine(startPosX: number, startPosY: number, width: number): string {
    return "M" + startPosX + "," + startPosY + " L" + (startPosX + width) + "," + startPosY;
  }

  toggleNonStop() {
    const node = this.nodeService.getNodeFromId(this.perlenketteNode.nodeId);
    const transition: Transition = this.perlenketteNode.transition;
    if (transition !== undefined && node !== undefined) {
      this.nodeService.toggleNonStop(node.getId(), transition.getId());
      this.trainrunService.trainrunsUpdated();
    }
  }

  isNonStopTransition(connection: PerlenketteConnection): boolean {
    const node = this.nodeService.getNodeFromId(this.perlenketteNode.nodeId);
    const transition = node.getTransitionFromPortId(connection.port.getId());
    if (transition === undefined) {
      return false;
    }
    return transition.getIsNonStopTransit();
  }

  hasTransition() {
    return this.perlenketteNode.transition !== undefined;
  }

  createPolygon(x: number, y: number): string {
    return (
      "M" +
      D3Utils.makeHexagonSVGPoints(new Vec2D(x, y), StaticDomTags.TRANSITION_BUTTON_SIZE) +
      "z"
    );
  }

  disableSectionView(event: MouseEvent) {
    if (!this.getVariantIsWritable()) {
      this.signalIsBeingEdited.next(undefined);
    }
    event.stopPropagation();
  }

  getExpandedNodeWith(): number {
    let maxTrainrunNameLen = 0;
    this.perlenketteTrainrun.pathItems.forEach((item: PerlenketteItem) => {
      if (item.isPerlenketteNode()) {
        item.getPerlenketteNode().connections.forEach((connection: PerlenketteConnection) => {
          const name = connection.categoryShortName + "" + connection.title;
          maxTrainrunNameLen = Math.max(
            3 + connection.terminalStationBackward.length,
            Math.max(
              3 + connection.terminalStation.length,
              Math.max(name.length, maxTrainrunNameLen),
            ),
          );
        });
      }
    });

    if (maxTrainrunNameLen < 5) {
      return 192;
    }
    return Math.min(192.0 * Math.min(1.8125, 1.0 + (maxTrainrunNameLen - 5) / 12), 320);
  }

  getTrainrunNameFieldPosition(): number {
    return 7;
  }

  getFromStationNameFieldPosition(): number {
    return this.getExpandedNodeWith() / 2 - 24;
  }

  getToStationNameFieldPosition(): number {
    return this.getExpandedNodeWith() / 2 + 24;
  }

  getTrainEdgeLineStartPos(): number {
    return this.getFromStationNameFieldPosition() + 4;
  }

  getTrainEdgeLineWidth(): number {
    return (this.getExpandedNodeWith() / 2 - this.getTrainEdgeLineStartPos()) * 2;
  }

  getTimeFieldPos(): number {
    return this.getExpandedNodeWith() - this.getTrainrunNameFieldPosition() - 1;
  }

  selectConnection(connection: PerlenketteConnection) {
    if (connection.connection.selected()) {
      this.nodeService.unselectConnection(connection.id);
      return;
    }
    this.nodeService.selectConnection(connection.id);
  }
}
