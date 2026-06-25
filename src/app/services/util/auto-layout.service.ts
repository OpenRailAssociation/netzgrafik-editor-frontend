import {Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {NodeService} from "../data/node.service";
import {NoteService} from "../data/note.service";
import {TrainrunService} from "../data/trainrun.service";
import {UiInteractionService} from "../ui/ui.interaction.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {ViewportCullService} from "../ui/viewport.cull.service";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {RASTERING_BASIC_GRID_SIZE} from "../../view/rastering/definitions";
import {Vec2D} from "src/app/utils/vec2D";

type LayoutDirection = "horizontal" | "vertical";

interface PointLike {
  getX(): number;
  getY(): number;
}

interface SectionInfo {
  key: string;
  length: number;
  centerX: number;
  centerY: number;
  sourceDirection: LayoutDirection;
  targetDirection: LayoutDirection;
  direction?: LayoutDirection;
}

@Injectable({
  providedIn: "root",
})
export class AutoLayoutService {
  private static readonly MIN_SECTION_LENGTH_PX = 200;

  constructor(
    private readonly nodeService: NodeService,
    private readonly trainrunService: TrainrunService,
    private readonly uiInteractionService: UiInteractionService,
    private readonly noteService: NoteService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly viewportCullService: ViewportCullService,
  ) {}

  stretchShortSections(sections: TrainrunSection[], runGlobally = true, sign = 1): void {
    const anchorNode = this.findCurrentViewAnchorNode();
    const processedKeys = this.createProcessedKeySet(runGlobally, sign);

    for (const section of sections) {
      this.processSection(section, processedKeys, runGlobally, sign);
    }

    this.restoreViewAnchorNode(anchorNode);
    this.updateRendering();
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

    if (!info.direction) {
      this.logMixedDirection(info);
      return;
    }

    const delta = this.calculateDelta(info, runGlobally, sign);

    if (delta <= 0) {
      this.logSkip(info.key, "cannot shrink without violating minimum edge length");
      return;
    }

    this.moveNodesAroundSection(info, sign, delta);
    this.logAction(info, sign);
  }

  private findCurrentViewAnchorNode(): {node: Node | undefined; offset: Vec2D} {
    return this.uiInteractionService.findClosestNodeToViewCenter(this.nodeService.getNodes());
  }

  private restoreViewAnchorNode(anchorNode: {node: Node | undefined; offset: Vec2D}): void {
    if (!anchorNode.node) {
      return;
    }

    this.uiInteractionService.gotoNode(anchorNode.node, anchorNode.offset);
  }

  private createProcessedKeySet(runGlobally: boolean, sign: number): Set<string> | undefined {
    if (runGlobally && sign >= 0) {
      return undefined;
    }

    return new Set<string>();
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
    return runGlobally && sign >= 0 && info.length >= AutoLayoutService.MIN_SECTION_LENGTH_PX;
  }

  private markAsProcessed(info: SectionInfo, processedKeys: Set<string> | undefined): void {
    processedKeys?.add(info.key);
  }

  private getSectionInfo(section: TrainrunSection): SectionInfo {
    const source = section.getPositionAtSourceNode();
    const target = section.getPositionAtTargetNode();

    const sourceNode = section.getSourceNode();
    const targetNode = section.getTargetNode();

    const sourceDirection = this.getSourceDirection(section);
    const targetDirection = this.getTargetDirection(section);

    return {
      key: this.getSectionKey(sourceNode, targetNode),
      length: this.getDistance(source, target),
      centerX: this.getCenterX(source, target),
      centerY: this.getCenterY(source, target),
      sourceDirection,
      targetDirection,
      direction: this.getCommonDirection(sourceDirection, targetDirection),
    };
  }

  private getSourceDirection(section: TrainrunSection): LayoutDirection {
    const sourceNode = section.getSourceNode();
    const sourcePort = sourceNode.getPort(section.getSourcePortId());

    return this.getPortDirection(sourcePort.getPositionAlignment());
  }

  private getTargetDirection(section: TrainrunSection): LayoutDirection {
    const targetNode = section.getTargetNode();
    const targetPort = targetNode.getPort(section.getTargetPortId());

    return this.getPortDirection(targetPort.getPositionAlignment());
  }

  private getPortDirection(alignment: PortAlignment): LayoutDirection {
    if (alignment === PortAlignment.Left || alignment === PortAlignment.Right) {
      return "horizontal";
    }

    return "vertical";
  }

  private getCommonDirection(
    sourceDirection: LayoutDirection,
    targetDirection: LayoutDirection,
  ): LayoutDirection | undefined {
    if (sourceDirection !== targetDirection) {
      return undefined;
    }

    return sourceDirection;
  }

  private getSectionKey(sourceNode: Node, targetNode: Node): string {
    return [sourceNode.getBetriebspunktName(), targetNode.getBetriebspunktName()]
      .sort()
      .join(" – ");
  }

  private getDistance(source: PointLike, target: PointLike): number {
    const dx = target.getX() - source.getX();
    const dy = target.getY() - source.getY();

    return Math.hypot(dx, dy);
  }

  private getCenterX(source: PointLike, target: PointLike): number {
    return (source.getX() + target.getX()) / 2;
  }

  private getCenterY(source: PointLike, target: PointLike): number {
    return (source.getY() + target.getY()) / 2;
  }

  private calculateDelta(info: SectionInfo, runGlobally: boolean, sign: number): number {
    const wantedDelta = this.calculateWantedDelta(info.length, runGlobally, sign);

    if (sign >= 0 || !info.direction) {
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

  private calculateGridSteps(deficit: number): number {
    const grid = RASTERING_BASIC_GRID_SIZE;
    const steps = Math.ceil(deficit / (2 * grid));

    return Math.max(steps, 1);
  }

  private moveNodesAroundSection(info: SectionInfo, sign: number, delta: number): void {
    if (!info.direction) {
      return;
    }

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

  private moveNode(node: Node, x: number, y: number): void {
    this.nodeService.changeNodePositionWithoutUpdate(node.getId(), x, y, true, false);
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

    const allowedDelta = this.getAllowedShrinkDelta(section);

    if (allowedDelta < currentDelta) {
      this.logDeltaLimit(section, allowedDelta);
    }

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

  private getNodeCenterX(node: Node): number {
    return node.getPositionX() + node.getNodeWidth() / 2;
  }

  private getNodeCenterY(node: Node): number {
    return node.getPositionY() + node.getNodeHeight() / 2;
  }

  private getAllowedShrinkDelta(section: TrainrunSection): number {
    const length = this.getSectionLength(section);
    const minLength = AutoLayoutService.MIN_SECTION_LENGTH_PX;
    const grid = RASTERING_BASIC_GRID_SIZE;

    return Math.floor((length - minLength) / 2 / grid) * grid;
  }

  private getSectionLength(section: TrainrunSection): number {
    return this.getDistance(section.getPositionAtSourceNode(), section.getPositionAtTargetNode());
  }

  private updateRendering(): void {
    this.nodeService.initPortOrdering();
    this.routeAllSections();
    this.viewportCullService.onViewportChangeUpdateRendering(true);
  }

  private routeAllSections(): void {
    for (const section of this.trainrunSectionService.getTrainrunSections()) {
      section.routeEdgeAndPlaceText();

      // Do not call updateTransitionsAndConnections() here.
      // It would re-apply spatial port ordering and undo initPortOrdering().
    }
  }

  private logAction(info: SectionInfo, sign: number): void {
    const action = sign >= 0 ? "stretched" : "shrunk";

    console.log(`  [${action}] ${info.key} (${Math.round(info.length)}px, ${info.direction})`);
  }

  private logMixedDirection(info: SectionInfo): void {
    const directionLabel = `${info.sourceDirection}/${info.targetDirection}`;

    this.logSkip(info.key, `mixed port directions (${directionLabel})`);
  }

  private logSkip(key: string, reason: string): void {
    console.log(`  [skip] ${key}: ${reason}`);
  }

  private logDeltaLimit(section: TrainrunSection, allowedDelta: number): void {
    const key = this.getSectionKey(section.getSourceNode(), section.getTargetNode());
    const length = Math.round(this.getSectionLength(section));

    console.log(`  [limit] edge ${key} (${length}px) constrains delta to ${allowedDelta}px`);
  }
}
