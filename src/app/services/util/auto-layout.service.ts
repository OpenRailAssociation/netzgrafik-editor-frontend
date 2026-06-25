import {Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {NodeService} from "../data/node.service";
import {NoteService} from "../data/note.service";
import {TrainrunService} from "../data/trainrun.service";
import {UiInteractionService} from "../ui/ui.interaction.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {ViewportCullService} from "../ui/viewport.cull.service";

// Falls diese Imports bei dir anders liegen: Pfad aus der alten Datei übernehmen.
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {RASTERING_BASIC_GRID_SIZE} from "../../view/rastering/definitions";

type LayoutDirection = "horizontal" | "vertical";

interface SectionLayoutInfo {
  key: string;
  lengthPx: number;
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
    private readonly trainrunService: TrainrunService,
    private readonly uiInteractionService: UiInteractionService,
    private readonly noteService: NoteService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly viewportCullService: ViewportCullService,
  ) {}

  private updateRendering(): void {
    this.nodeService.initPortOrdering();

    this.trainrunSectionService.getTrainrunSections().forEach((ts) => {
      ts.routeEdgeAndPlaceText();
      // Note: don't call updateTransitionsAndConnections() here as it would
      // re-apply spatial port ordering, undoing the optimized ordering from
      // initPortOrdering().
    });

    this.viewportCullService.onViewportChangeUpdateRendering(true);
  }

  stretchShortSections(sections: TrainrunSection[], runGlobally = true, sign = 1): void {
    const processedSectionKeys = runGlobally && sign >= 0 ? undefined : new Set<string>();

    for (const section of sections) {
      if (section.isPathInvalid()) {
        continue;
      }

      const info = this.getSectionLayoutInfo(section);

      if (runGlobally && sign >= 0 && info.lengthPx >= AutoLayoutService.MIN_SECTION_LENGTH_PX) {
        continue;
      }

      if (processedSectionKeys?.has(info.key)) {
        continue;
      }

      processedSectionKeys?.add(info.key);

      if (!info.direction) {
        console.log(`  [skip] ${info.key}: mixed port directions (${info.directionLabel})`);
        continue;
      }

      let delta = this.calculateDelta(info.lengthPx, runGlobally, sign);

      if (sign < 0) {
        delta = this.limitDeltaForMinEdgeLength(
          delta,
          info.direction,
          info.centerX,
          info.centerY,
          AutoLayoutService.MIN_SECTION_LENGTH_PX,
        );

        if (delta <= 0) {
          console.log(`  [skip] ${info.key}: cannot shrink without violating minimum edge length`);
          continue;
        }
      }

      this.moveNodesAroundSectionCenter(info.direction, info.centerX, info.centerY, sign, delta);

      const action = sign >= 0 ? "stretched" : "shrunk";
      console.log(`  [${action}] ${info.key} (${Math.round(info.lengthPx)}px, ${info.direction})`);
    }

    this.updateRendering();
  }

  private getSectionLayoutInfo(section: TrainrunSection): SectionLayoutInfo {
    const sourcePosition = section.getPositionAtSourceNode();
    const targetPosition = section.getPositionAtTargetNode();

    const sourceNode = section.getSourceNode();
    const targetNode = section.getTargetNode();

    const sourceDirection = this.getPortLayoutDirection(
      sourceNode.getPort(section.getSourcePortId()).getPositionAlignment(),
    );

    const targetDirection = this.getPortLayoutDirection(
      targetNode.getPort(section.getTargetPortId()).getPositionAlignment(),
    );

    const direction = sourceDirection === targetDirection ? sourceDirection : undefined;

    return {
      key: this.getSectionKey(sourceNode, targetNode),
      lengthPx: this.getDistancePx(sourcePosition, targetPosition),
      centerX: (sourcePosition.getX() + targetPosition.getX()) / 2,
      centerY: (sourcePosition.getY() + targetPosition.getY()) / 2,
      direction,
      directionLabel: direction ?? `${sourceDirection}/${targetDirection}`,
    };
  }

  private getPortLayoutDirection(alignment: PortAlignment): LayoutDirection {
    return alignment === PortAlignment.Left || alignment === PortAlignment.Right
      ? "horizontal"
      : "vertical";
  }

  private getSectionKey(sourceNode: Node, targetNode: Node): string {
    return [sourceNode.getBetriebspunktName(), targetNode.getBetriebspunktName()]
      .sort()
      .join(" – ");
  }

  private getDistancePx(
    sourcePosition: {getX(): number; getY(): number},
    targetPosition: {getX(): number; getY(): number},
  ): number {
    const dx = targetPosition.getX() - sourcePosition.getX();
    const dy = targetPosition.getY() - sourcePosition.getY();

    return Math.hypot(dx, dy);
  }

  private calculateDelta(lengthPx: number, runGlobally: boolean, sign: number): number {
    if (sign < 0 && runGlobally) {
      return Number.MAX_SAFE_INTEGER;
    }

    const deficit = AutoLayoutService.MIN_SECTION_LENGTH_PX - lengthPx;

    const steps = Math.max(Math.ceil(deficit / (2 * RASTERING_BASIC_GRID_SIZE)), 1);

    return steps * RASTERING_BASIC_GRID_SIZE;
  }

  private moveNodesAroundSectionCenter(
    direction: LayoutDirection,
    centerX: number,
    centerY: number,
    sign: number,
    delta: number,
  ): void {
    this.nodeService.getNodes().forEach((node: Node) => {
      const currentX = node.getPositionX();
      const currentY = node.getPositionY();

      if (direction === "horizontal") {
        const nodeCenterX = currentX + node.getNodeWidth() / 2;
        const dx = (nodeCenterX <= centerX ? -1 : 1) * sign * delta;

        this.nodeService.changeNodePositionWithoutUpdate(
          node.getId(),
          currentX + dx,
          currentY,
          true,
          false,
        );

        return;
      }

      const nodeCenterY = currentY + node.getNodeHeight() / 2;
      const dy = (nodeCenterY <= centerY ? -1 : 1) * sign * delta;

      this.nodeService.changeNodePositionWithoutUpdate(
        node.getId(),
        currentX,
        currentY + dy,
        true,
        false,
      );
    });
  }

  private limitDeltaForMinEdgeLength(
    delta: number,
    direction: LayoutDirection,
    centerX: number,
    centerY: number,
    minLength: number,
  ): number {
    let maxDelta = delta;

    for (const section of this.trainrunSectionService.getTrainrunSections()) {
      if (section.isPathInvalid()) {
        continue;
      }

      const sourcePosition = section.getPositionAtSourceNode();
      const targetPosition = section.getPositionAtTargetNode();

      const sourceNode = section.getSourceNode();
      const targetNode = section.getTargetNode();

      const edgeKey = this.getSectionKey(sourceNode, targetNode);

      const isHorizontal = direction === "horizontal";
      const splitCenter = isHorizontal ? centerX : centerY;

      const sourceCenter = isHorizontal
        ? sourceNode.getPositionX() + sourceNode.getNodeWidth() / 2
        : sourceNode.getPositionY() + sourceNode.getNodeHeight() / 2;

      const targetCenter = isHorizontal
        ? targetNode.getPositionX() + targetNode.getNodeWidth() / 2
        : targetNode.getPositionY() + targetNode.getNodeHeight() / 2;

      const sourceAndTargetAreOnSameSide =
        sourceCenter <= splitCenter === targetCenter <= splitCenter;

      if (sourceAndTargetAreOnSameSide) {
        continue;
      }

      const currentLength = this.getDistancePx(sourcePosition, targetPosition);

      const allowableDelta =
        Math.floor((currentLength - minLength) / 2 / RASTERING_BASIC_GRID_SIZE) *
        RASTERING_BASIC_GRID_SIZE;

      if (allowableDelta < maxDelta) {
        console.log(
          `  [limit] edge ${edgeKey} (${Math.round(
            currentLength,
          )}px) constrains delta to ${allowableDelta}px`,
        );
      }

      maxDelta = Math.min(maxDelta, allowableDelta);
    }

    return maxDelta;
  }
}
