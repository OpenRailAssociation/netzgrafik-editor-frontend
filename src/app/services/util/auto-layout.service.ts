import {Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {NodeService} from "../data/node.service";
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
  direction?: LayoutDirection;
  directionLabel: string;
}

@Injectable({
  providedIn: "root",
})
export class AutoLayoutService {
  private static readonly MIN_SECTION_LENGTH_PX = 200;

  constructor(
    private readonly nodeService: NodeService,
    private readonly uiInteractionService: UiInteractionService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly viewportCullService: ViewportCullService,
  ) {}

  stretchShortSections(sections: TrainrunSection[], runGlobally = true, sign = 1): void {
    const anchorNode = this.uiInteractionService.findClosestNodeToViewCenter(
      this.nodeService.getNodes(),
    );

    const processedKeys = runGlobally && sign >= 0 ? undefined : new Set<string>();

    for (const section of sections) {
      if (section.isPathInvalid()) {
        continue;
      }

      const info = this.getSectionInfo(section);

      if (this.shouldSkipSection(info, processedKeys, runGlobally, sign)) {
        continue;
      }

      processedKeys?.add(info.key);

      if (!info.direction) {
        this.logSkip(info.key, `mixed port directions (${info.directionLabel})`);
        continue;
      }

      const delta = this.getDelta(info, runGlobally, sign);

      if (delta <= 0) {
        this.logSkip(info.key, "cannot shrink without violating minimum edge length");
        continue;
      }

      this.moveNodes(info.direction, info.centerX, info.centerY, sign * delta);
      this.logAction(info, sign);
    }

    if (anchorNode) {
      this.uiInteractionService.gotoNode(anchorNode, new Vec2D(0, 0));
    }

    this.updateRendering();
  }

  private updateRendering(): void {
    this.nodeService.initPortOrdering();

    this.trainrunSectionService.getTrainrunSections().forEach((section) => {
      section.routeEdgeAndPlaceText();
      // Don't call updateTransitionsAndConnections() here:
      // it would re-apply spatial port ordering and undo initPortOrdering().
    });

    this.viewportCullService.onViewportChangeUpdateRendering(true);
  }

  private shouldSkipSection(
    info: SectionInfo,
    processedKeys: Set<string> | undefined,
    runGlobally: boolean,
    sign: number,
  ): boolean {
    return (
      processedKeys?.has(info.key) === true ||
      (runGlobally && sign >= 0 && info.length >= AutoLayoutService.MIN_SECTION_LENGTH_PX)
    );
  }

  private getSectionInfo(section: TrainrunSection): SectionInfo {
    const source = section.getPositionAtSourceNode();
    const target = section.getPositionAtTargetNode();

    const sourceNode = section.getSourceNode();
    const targetNode = section.getTargetNode();

    const sourceDirection = this.getPortDirection(
      sourceNode.getPort(section.getSourcePortId()).getPositionAlignment(),
    );

    const targetDirection = this.getPortDirection(
      targetNode.getPort(section.getTargetPortId()).getPositionAlignment(),
    );

    const direction = sourceDirection === targetDirection ? sourceDirection : undefined;

    return {
      key: this.getSectionKey(sourceNode, targetNode),
      length: this.distance(source, target),
      centerX: (source.getX() + target.getX()) / 2,
      centerY: (source.getY() + target.getY()) / 2,
      direction,
      directionLabel: direction ?? `${sourceDirection}/${targetDirection}`,
    };
  }

  private getPortDirection(alignment: PortAlignment): LayoutDirection {
    return alignment === PortAlignment.Left || alignment === PortAlignment.Right
      ? "horizontal"
      : "vertical";
  }

  private getSectionKey(sourceNode: Node, targetNode: Node): string {
    return [sourceNode.getBetriebspunktName(), targetNode.getBetriebspunktName()]
      .sort()
      .join(" – ");
  }

  private distance(source: PointLike, target: PointLike): number {
    return Math.hypot(target.getX() - source.getX(), target.getY() - source.getY());
  }

  private getDelta(info: SectionInfo, runGlobally: boolean, sign: number): number {
    const delta =
      sign < 0 && runGlobally ? Number.MAX_SAFE_INTEGER : this.getGridDelta(info.length);

    return sign < 0 && info.direction
      ? this.limitDeltaForMinEdgeLength(delta, info.direction, info.centerX, info.centerY)
      : delta;
  }

  private getGridDelta(length: number): number {
    const deficit = AutoLayoutService.MIN_SECTION_LENGTH_PX - length;
    const grid = RASTERING_BASIC_GRID_SIZE;
    const steps = Math.max(Math.ceil(deficit / (2 * grid)), 1);

    return steps * grid;
  }

  private moveNodes(
    direction: LayoutDirection,
    centerX: number,
    centerY: number,
    signedDelta: number,
  ): void {
    this.nodeService.getNodes().forEach((node) => {
      const x = node.getPositionX();
      const y = node.getPositionY();

      if (direction === "horizontal") {
        const nodeCenterX = x + node.getNodeWidth() / 2;
        const dx = nodeCenterX <= centerX ? -signedDelta : signedDelta;

        this.moveNode(node, x + dx, y);
        return;
      }

      const nodeCenterY = y + node.getNodeHeight() / 2;
      const dy = nodeCenterY <= centerY ? -signedDelta : signedDelta;

      this.moveNode(node, x, y + dy);
    });
  }

  private moveNode(node: Node, x: number, y: number): void {
    this.nodeService.changeNodePositionWithoutUpdate(node.getId(), x, y, true, false);
  }

  private limitDeltaForMinEdgeLength(
    delta: number,
    direction: LayoutDirection,
    centerX: number,
    centerY: number,
  ): number {
    let maxDelta = delta;

    for (const section of this.trainrunSectionService.getTrainrunSections()) {
      if (section.isPathInvalid()) {
        continue;
      }

      const sourceNode = section.getSourceNode();
      const targetNode = section.getTargetNode();
      const splitCenter = direction === "horizontal" ? centerX : centerY;

      if (!this.crossesSplit(sourceNode, targetNode, direction, splitCenter)) {
        continue;
      }

      const length = this.distance(
        section.getPositionAtSourceNode(),
        section.getPositionAtTargetNode(),
      );

      const allowedDelta = this.getAllowedShrinkDelta(length);

      if (allowedDelta < maxDelta) {
        console.log(
          `  [limit] edge ${this.getSectionKey(sourceNode, targetNode)} (${Math.round(
            length,
          )}px) constrains delta to ${allowedDelta}px`,
        );
      }

      maxDelta = Math.min(maxDelta, allowedDelta);
    }

    return maxDelta;
  }

  private crossesSplit(
    sourceNode: Node,
    targetNode: Node,
    direction: LayoutDirection,
    splitCenter: number,
  ): boolean {
    const sourceIsLeftOrAbove = this.getNodeCenter(sourceNode, direction) <= splitCenter;
    const targetIsLeftOrAbove = this.getNodeCenter(targetNode, direction) <= splitCenter;

    return sourceIsLeftOrAbove !== targetIsLeftOrAbove;
  }

  private getNodeCenter(node: Node, direction: LayoutDirection): number {
    return direction === "horizontal"
      ? node.getPositionX() + node.getNodeWidth() / 2
      : node.getPositionY() + node.getNodeHeight() / 2;
  }

  private getAllowedShrinkDelta(length: number): number {
    const grid = RASTERING_BASIC_GRID_SIZE;
    const minLength = AutoLayoutService.MIN_SECTION_LENGTH_PX;

    return Math.floor((length - minLength) / 2 / grid) * grid;
  }

  private logAction(info: SectionInfo, sign: number): void {
    const action = sign >= 0 ? "stretched" : "shrunk";

    console.log(`  [${action}] ${info.key} (${Math.round(info.length)}px, ${info.direction})`);
  }

  private logSkip(key: string, reason: string): void {
    console.log(`  [skip] ${key}: ${reason}`);
  }
}
