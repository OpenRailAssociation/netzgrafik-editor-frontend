import {Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {NodeService} from "../data/node.service";
import {UiInteractionService} from "../ui/ui.interaction.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {TrainrunService} from "../data/trainrun.service";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {ViewportCullService} from "../ui/viewport.cull.service";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {RASTERING_BASIC_GRID_SIZE} from "../../view/rastering/definitions";
import {Vec2D} from "src/app/utils/vec2D";

// This auto-layout service was introduce at www.hack4rail.org 2026 at Vienna hackathon.
// It is a simple implementation of a layout optimization algorithm that stretches or shrinks
// trainrun sections to improve the overall layout of the diagram.
// The algorithm works by analyzing the selected trainrun sections or nodes and adjusting
// their positions based on their lengths and directions. The service also ensures that
// the minimum section length is maintained and that the layout remains visually appealing.

type LayoutDirection = "horizontal" | "vertical";

interface PointLike {
  getX(): number;
  getY(): number;
}

interface SectionInfo {
  key: string;
  label: string;
  span: number;
  centerX: number;
  centerY: number;
  direction: LayoutDirection;
}

@Injectable({
  providedIn: "root",
})
export class AutoLayoutService {
  private static readonly MIN_SECTION_LENGTH_PX = 200;

  constructor(
    private readonly nodeService: NodeService,
    private readonly uiInteractionService: UiInteractionService,
    private readonly trainrunService: TrainrunService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly viewportCullService: ViewportCullService,
  ) {}

  /**
   * Optimize Layout
   * - local optimization, if selection exists (trainrun sections or nodes)
   * - global optimization, if no selection exists
   * - Shift = inverted direction
   */
  optimizeLayout(inverse: boolean): void {
    const direction = inverse ? -1 : 1;

    // 1) get local sections
    const localSections = this.getSectionsForLocalOperation();

    if (localSections.length > 0) {
      // local optimization
      this.adjustSectionLengths(localSections, false, direction);
      return;
    }

    // 2) No selection → global optimization
    const allSections = this.trainrunSectionService.getTrainrunSections();
    this.adjustSectionLengths(allSections, true, direction);
  }

  private getSectionsForLocalOperation(): TrainrunSection[] {
    // --- State I ---------------------------------------------------------
    // If one or more sections are selected (multi-sections between A and B),
    // and no train run is selected, then operate only on these selected sections.
    const selectedSections = this.trainrunSectionService.getAllSelectedTrainrunSections();
    const selectedTrainrun = this.trainrunService.getSelectedTrainrun();

    if (selectedSections.length > 0 && !selectedTrainrun) {
      return selectedSections;
    }

    // --- State II --------------------------------------------------------
    // If two or more nodes are selected, operate on all sections between these nodes.
    const selectedNodes = this.nodeService.getSelectedNodes();
    if (selectedNodes.length >= 2) {
      const nodeIds = new Set(selectedNodes.map((n) => n.getId()));

      return this.trainrunSectionService
        .getTrainrunSections()
        .filter(
          (ts) =>
            nodeIds.has(ts.getSourceNode().getId()) && nodeIds.has(ts.getTargetNode().getId()),
        );
    }

    // --- State III -------------------------------------------------------
    // If a train run is selected, operate on all sections of the selected train run.
    if (selectedTrainrun) {
      return this.trainrunSectionService.getAllTrainrunSectionsForTrainrun(
        selectedTrainrun.getId(),
      );
    }

    // --- State IV -------------------------------------------------------
    // All other cases: operate on the entire graph (all sections).
    return [];
  }

  adjustSectionLengths(sections: TrainrunSection[], runGlobally = true, sign = 1): void {
    const anchorNode = this.findCurrentViewAnchorNode();
    const processedKeys = this.createProcessedKeySet(runGlobally, sign);

    for (const section of sections) {
      this.processSection(section, processedKeys, runGlobally, sign);
    }

    this.restoreViewAnchorNode(anchorNode);
    this.updateRendering();
  }

  private findCurrentViewAnchorNode(): {node: Node | undefined; offset: Vec2D} {
    return this.uiInteractionService.findClosestNodeToViewCenter(this.nodeService.getNodes());
  }

  private createProcessedKeySet(runGlobally: boolean, sign: number): Set<string> | undefined {
    if (runGlobally && sign >= 0) {
      return undefined;
    }

    return new Set<string>();
  }

  private processSection(
    section: TrainrunSection,
    processedKeys: Set<string> | undefined,
    runGlobally: boolean,
    sign: number,
  ): void {
    if (section.isPathInvalid()) {
      return;
    }

    const info = this.getSectionInfo(section);

    if (this.shouldSkipSection(info, processedKeys, runGlobally, sign)) {
      return;
    }

    this.markAsProcessed(info, processedKeys);

    const delta = this.calculateDelta(info, runGlobally, sign);

    if (delta <= 0) {
      // cannot shrink without violating minimum edge length
      return;
    }

    this.moveNodesAroundSection(info, sign, delta);
  }

  private getSectionInfo(section: TrainrunSection): SectionInfo {
    const source = section.getPositionAtSourceNode();
    const target = section.getPositionAtTargetNode();

    const sourceNode = section.getSourceNode();
    const targetNode = section.getTargetNode();

    const direction = this.getSourceDirection(section);

    return {
      key: this.getSectionKey(sourceNode, targetNode),
      label: this.getSectionLabel(sourceNode, targetNode),
      span: this.getSectionSpan(source, target, direction),
      centerX: this.getCenterX(source, target),
      centerY: this.getCenterY(source, target),
      direction,
    };
  }

  private getSourceDirection(section: TrainrunSection): LayoutDirection {
    const sourceNode = section.getSourceNode();
    const sourcePort = sourceNode.getPort(section.getSourcePortId());

    return this.getPortDirection(sourcePort.getPositionAlignment());
  }

  private getPortDirection(alignment: PortAlignment): LayoutDirection {
    if (alignment === PortAlignment.Left || alignment === PortAlignment.Right) {
      return "horizontal";
    }

    return "vertical";
  }

  private getSectionKey(sourceNode: Node, targetNode: Node): string {
    const ids = [sourceNode.getId(), targetNode.getId()].sort((a, b) => a - b);
    return `${ids[0]}:${ids[1]}`;
  }

  private getSectionLabel(sourceNode: Node, targetNode: Node): string {
    return [sourceNode.getBetriebspunktName(), targetNode.getBetriebspunktName()]
      .sort()
      .join(" – ");
  }

  private getSectionSpan(source: PointLike, target: PointLike, direction: LayoutDirection): number {
    if (direction === "horizontal") {
      return Math.abs(target.getX() - source.getX());
    }
    return Math.abs(target.getY() - source.getY());
  }

  private getCenterX(source: PointLike, target: PointLike): number {
    return (source.getX() + target.getX()) / 2;
  }

  private getCenterY(source: PointLike, target: PointLike): number {
    return (source.getY() + target.getY()) / 2;
  }

  private shouldSkipSection(
    info: SectionInfo,
    processedKeys: Set<string> | undefined,
    runGlobally: boolean,
    sign: number,
  ): boolean {
    return (
      this.wasAlreadyProcessed(info, processedKeys) ||
      this.isLongEnoughForGlobalStretch(info, runGlobally, sign)
    );
  }

  private wasAlreadyProcessed(info: SectionInfo, processedKeys: Set<string> | undefined): boolean {
    return processedKeys?.has(info.key) === true;
  }

  private isLongEnoughForGlobalStretch(
    info: SectionInfo,
    runGlobally: boolean,
    sign: number,
  ): boolean {
    return runGlobally && sign >= 0 && info.span >= AutoLayoutService.MIN_SECTION_LENGTH_PX;
  }

  private markAsProcessed(info: SectionInfo, processedKeys: Set<string> | undefined): void {
    processedKeys?.add(info.key);
  }

  private calculateDelta(info: SectionInfo, runGlobally: boolean, sign: number): number {
    const wantedDelta = this.calculateWantedDelta(info.span, runGlobally, sign);

    if (sign >= 0) {
      return wantedDelta;
    }

    return this.limitShrinkDelta(wantedDelta, info.direction, info.centerX, info.centerY);
  }

  private calculateWantedDelta(length: number, runGlobally: boolean, sign: number): number {
    if (sign < 0 && runGlobally) {
      return Number.MAX_SAFE_INTEGER;
    }

    return this.calculateGridDelta(length);
  }

  private calculateGridDelta(length: number): number {
    const deficit = AutoLayoutService.MIN_SECTION_LENGTH_PX - length;
    const steps = this.calculateGridSteps(deficit);

    return steps * RASTERING_BASIC_GRID_SIZE;
  }

  private limitShrinkDelta(
    delta: number,
    direction: LayoutDirection,
    centerX: number,
    centerY: number,
  ): number {
    let limitedDelta = delta;

    for (const section of this.trainrunSectionService.getTrainrunSections()) {
      limitedDelta = this.limitDeltaBySection(section, limitedDelta, direction, centerX, centerY);
    }

    return limitedDelta;
  }

  private calculateGridSteps(deficit: number): number {
    const grid = RASTERING_BASIC_GRID_SIZE;
    const steps = Math.ceil(deficit / (2 * grid));

    return Math.max(steps, 1);
  }

  private moveNodesAroundSection(info: SectionInfo, sign: number, delta: number): void {
    const signedDelta = sign * delta;

    for (const node of this.nodeService.getNodes()) {
      this.moveNodeAroundCenter(node, info.direction, info.centerX, info.centerY, signedDelta);
    }
  }

  private moveNodeAroundCenter(
    node: Node,
    direction: LayoutDirection,
    centerX: number,
    centerY: number,
    signedDelta: number,
  ): void {
    if (direction === "horizontal") {
      this.moveNodeHorizontally(node, centerX, signedDelta);
      return;
    }

    this.moveNodeVertically(node, centerY, signedDelta);
  }

  private moveNodeHorizontally(node: Node, centerX: number, signedDelta: number): void {
    const x = node.getPositionX();
    const y = node.getPositionY();
    const dx = this.calculateNodeMoveDelta(this.getNodeCenterX(node), centerX, signedDelta);

    this.moveNode(node, x + dx, y);
  }

  private moveNodeVertically(node: Node, centerY: number, signedDelta: number): void {
    const x = node.getPositionX();
    const y = node.getPositionY();
    const dy = this.calculateNodeMoveDelta(this.getNodeCenterY(node), centerY, signedDelta);

    this.moveNode(node, x, y + dy);
  }

  private calculateNodeMoveDelta(
    nodeCenter: number,
    sectionCenter: number,
    signedDelta: number,
  ): number {
    if (nodeCenter <= sectionCenter) {
      return -signedDelta;
    }

    return signedDelta;
  }

  private getNodeCenterX(node: Node): number {
    return node.getPositionX() + node.getNodeWidth() / 2;
  }

  private getNodeCenterY(node: Node): number {
    return node.getPositionY() + node.getNodeHeight() / 2;
  }

  private moveNode(node: Node, x: number, y: number): void {
    this.nodeService.changeNodePositionWithoutUpdate(node.getId(), x, y, true, false);
  }

  private restoreViewAnchorNode(anchorNode: {node: Node | undefined; offset: Vec2D}): void {
    if (!anchorNode.node) {
      return;
    }

    this.uiInteractionService.gotoNode(anchorNode.node, anchorNode.offset);
  }

  private updateRendering(): void {
    this.nodeService.initPortOrdering();
    this.routeAllSections();
    this.viewportCullService.onViewportChangeUpdateRendering(true);
  }

  private limitDeltaBySection(
    section: TrainrunSection,
    currentDelta: number,
    direction: LayoutDirection,
    centerX: number,
    centerY: number,
  ): number {
    if (section.isPathInvalid()) {
      return currentDelta;
    }

    if (!this.sectionCrossesCenterLine(section, direction, centerX, centerY)) {
      return currentDelta;
    }

    const allowedDelta = this.getAllowedShrinkDelta(section, direction);
    return Math.min(currentDelta, allowedDelta);
  }

  private sectionCrossesCenterLine(
    section: TrainrunSection,
    direction: LayoutDirection,
    centerX: number,
    centerY: number,
  ): boolean {
    const sourceNode = section.getSourceNode();
    const targetNode = section.getTargetNode();
    const center = this.getRelevantCenter(direction, centerX, centerY);

    return this.nodesAreOnDifferentSides(sourceNode, targetNode, direction, center);
  }

  private getRelevantCenter(direction: LayoutDirection, centerX: number, centerY: number): number {
    if (direction === "horizontal") {
      return centerX;
    }

    return centerY;
  }

  private nodesAreOnDifferentSides(
    sourceNode: Node,
    targetNode: Node,
    direction: LayoutDirection,
    center: number,
  ): boolean {
    const sourceSide = this.isNodeBeforeCenter(sourceNode, direction, center);
    const targetSide = this.isNodeBeforeCenter(targetNode, direction, center);

    return sourceSide !== targetSide;
  }

  private isNodeBeforeCenter(node: Node, direction: LayoutDirection, center: number): boolean {
    return this.getNodeCenter(node, direction) <= center;
  }

  private getNodeCenter(node: Node, direction: LayoutDirection): number {
    if (direction === "horizontal") {
      return this.getNodeCenterX(node);
    }

    return this.getNodeCenterY(node);
  }

  private getAllowedShrinkDelta(section: TrainrunSection, direction: LayoutDirection): number {
    const span = this.getSectionSpan(
      section.getPositionAtSourceNode(),
      section.getPositionAtTargetNode(),
      direction,
    );
    const minLength = AutoLayoutService.MIN_SECTION_LENGTH_PX;
    const grid = RASTERING_BASIC_GRID_SIZE;

    return Math.floor((span - minLength) / 2 / grid) * grid;
  }

  private routeAllSections(): void {
    for (const section of this.trainrunSectionService.getTrainrunSections()) {
      section.routeEdgeAndPlaceText();

      // Do not call updateTransitionsAndConnections() here.
      // It would re-apply spatial port ordering and undo initPortOrdering().
    }
  }
}
