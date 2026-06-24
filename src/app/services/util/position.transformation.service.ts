import {EventEmitter, Injectable} from "@angular/core";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {TrainrunService} from "../data/trainrun.service";
import {UiInteractionService} from "../ui/ui.interaction.service";
import {NodeService} from "../data/node.service";
import {NoteService} from "../data/note.service";
import {Vec2D} from "../../utils/vec2D";
import {Node} from "../../models/node.model";
import {ViewportCullService} from "../ui/viewport.cull.service";
import {NodeOperation, Operation, OperationType} from "src/app/models/operation.model";
import {Note} from "../../models/note.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {RASTERING_BASIC_GRID_SIZE} from "../../view/rastering/definitions";

@Injectable({
  providedIn: "root",
})
export class PositionTransformationService {
  constructor(
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly trainrunService: TrainrunService,
    private readonly nodeService: NodeService,
    private readonly noteService: NoteService,
    private readonly uiInteractionService: UiInteractionService,
    private readonly viewportCullService: ViewportCullService,
  ) {}
  readonly operation = new EventEmitter<Operation>();

  private scaleFullNetzgrafikArea(
    factor: number,
    zoomCenter: Vec2D,
    windowViewboxPropertiesMapKey: string,
  ) {
    const scaleCenterCoordinates: Vec2D = this.computeScaleCenterCoordinates(
      zoomCenter,
      windowViewboxPropertiesMapKey,
    );
    const focalNode: Node = this.getFocalNode(scaleCenterCoordinates);

    this.nodeService.getNodes().forEach((n, index) => {
      let newPos = new Vec2D(
        (n.getPositionX() - scaleCenterCoordinates.getX()) * factor + scaleCenterCoordinates.getX(),
        (n.getPositionY() - scaleCenterCoordinates.getY()) * factor + scaleCenterCoordinates.getY(),
      );

      if (focalNode?.getId() === n.getId()) {
        const delta = Vec2D.sub(
          newPos,
          new Vec2D(focalNode.getPositionX(), focalNode.getPositionY()),
        );
        newPos = Vec2D.sub(newPos, delta);
      }
      n.setPosition(newPos.getX(), newPos.getY());
    });

    this.noteService.getNotes().forEach((n, index) => {
      let newPos = new Vec2D(
        (n.getPositionX() - scaleCenterCoordinates.getX()) * factor + scaleCenterCoordinates.getX(),
        (n.getPositionY() - scaleCenterCoordinates.getY()) * factor + scaleCenterCoordinates.getY(),
      );

      if (focalNode?.getId() === n.getId()) {
        const delta = Vec2D.sub(
          newPos,
          new Vec2D(focalNode.getPositionX(), focalNode.getPositionY()),
        );
        newPos = Vec2D.sub(newPos, delta);
      }
      n.setPosition(newPos.getX(), newPos.getY());
    });
  }

  private computeScaleCenterCoordinates(
    zoomCenter: Vec2D,
    windowViewboxPropertiesMapKey: string,
  ): Vec2D {
    const vp = this.uiInteractionService.getViewboxProperties(windowViewboxPropertiesMapKey);
    const scaleCenterCoordinates = new Vec2D(
      vp.panZoomLeft + zoomCenter.getX() * vp.panZoomWidth,
      vp.panZoomTop + zoomCenter.getY() * vp.panZoomHeight,
    );

    return scaleCenterCoordinates;
  }

  private getFocalNode(scaleCenterCoordinates: Vec2D): Node {
    // get the node under the mouse cursor and update the scaleCenter
    const focalNode = this.nodeService
      .getNodes()
      .find(
        (n) =>
          scaleCenterCoordinates.getX() > n.getPositionX() &&
          scaleCenterCoordinates.getX() < n.getPositionX() + n.getNodeWidth() &&
          scaleCenterCoordinates.getY() > n.getPositionY() &&
          scaleCenterCoordinates.getY() < n.getPositionY() + n.getNodeHeight(),
      );
    return focalNode;
  }

  private scaleNetzgrafikSelectedNodesArea(
    factor: number,
    zoomCenter: Vec2D,
    nodes: Node[],
    notes: Note[],
    windowViewboxPropertiesMapKey: string,
  ) {
    const scaleCenterCoordinates: Vec2D = this.computeScaleCenterCoordinates(
      zoomCenter,
      windowViewboxPropertiesMapKey,
    );
    const focalNode: Node = this.getFocalNode(scaleCenterCoordinates);

    if (!focalNode) {
      /*
       * if more than one node is selected (multi-selected nodes) transform the nodes with center of
       * mass
       */
      let centerOfMass = new Vec2D(0, 0);
      nodes.forEach((n) => {
        centerOfMass = Vec2D.add(
          centerOfMass,
          new Vec2D(
            n.getPositionX() + n.getNodeWidth() / 2.0,
            n.getPositionY() + n.getNodeHeight() / 2.0,
          ),
        );
      });
      centerOfMass = Vec2D.scale(centerOfMass, 1.0 / Math.max(1, nodes.length));

      scaleCenterCoordinates.setData(centerOfMass.getX(), centerOfMass.getY());
    }

    nodes.forEach((n, index) => {
      let newPos = new Vec2D(
        (n.getPositionX() + n.getNodeWidth() / 2.0 - scaleCenterCoordinates.getX()) * factor +
          scaleCenterCoordinates.getX() -
          n.getNodeWidth() / 2.0,
        (n.getPositionY() + n.getNodeHeight() / 2.0 - scaleCenterCoordinates.getY()) * factor +
          scaleCenterCoordinates.getY() -
          n.getNodeHeight() / 2.0,
      );

      if (focalNode?.getId() === n.getId()) {
        const delta = Vec2D.sub(
          newPos,
          new Vec2D(focalNode.getPositionX(), focalNode.getPositionY()),
        );
        newPos = Vec2D.sub(newPos, delta);
      }

      n.setPosition(newPos.getX(), newPos.getY());
    });

    notes.forEach((n, index) => {
      const newPos = new Vec2D(
        (n.getPositionX() + n.getWidth() / 2.0 - scaleCenterCoordinates.getX()) * factor +
          scaleCenterCoordinates.getX() -
          n.getWidth() / 2.0,
        (n.getPositionY() + n.getHeight() / 2.0 - scaleCenterCoordinates.getY()) * factor +
          scaleCenterCoordinates.getY() -
          n.getHeight() / 2.0,
      );
      n.setPosition(newPos.getX(), newPos.getY());
    });
  }

  private updateRendering() {
    this.nodeService.initPortOrdering();

    this.trainrunSectionService.getTrainrunSections().forEach((ts) => {
      ts.routeEdgeAndPlaceText();
      // Note: don't call updateTransitionsAndConnections() here as it would
      // re-apply spatial port ordering, undoing the optimized ordering from
      // initPortOrdering().
    });

    this.viewportCullService.onViewportChangeUpdateRendering(true);
  }

  scaleNetzgrafikArea(factor: number, zoomCenter: Vec2D, windowViewboxPropertiesMapKey: string) {
    const nodes: Node[] = this.nodeService.getSelectedNodes();
    if (nodes.length < 2) {
      this.scaleFullNetzgrafikArea(factor, zoomCenter, windowViewboxPropertiesMapKey);
    } else {
      let notes: Note[] = this.noteService.getSelectedNotes();
      if (notes.length === 0) {
        notes = this.noteService.getNotes();
      }
      this.noteService.getSelectedNote();
      this.scaleNetzgrafikSelectedNodesArea(
        factor,
        zoomCenter,
        nodes,
        notes,
        windowViewboxPropertiesMapKey,
      );
    }

    this.updateRendering();
  }

  alignSelectedElementsToLeftBorder() {
    const nodes: Node[] = this.nodeService.getSelectedNodes();

    let leftX: number | undefined = undefined;
    nodes.forEach((n) => {
      const pos = n.getPositionX();
      if (leftX === undefined) {
        leftX = pos;
      } else {
        leftX = Math.min(leftX, pos);
      }
    });

    if (leftX !== undefined) {
      nodes.forEach((n) => {
        n.setPosition(leftX, n.getPositionY());
        this.operation.emit(new NodeOperation(OperationType.update, n));
      });
    }

    this.updateRendering();
  }

  alignSelectedElementsToRightBorder() {
    const nodes: Node[] = this.nodeService.getSelectedNodes();

    let rightX: number | undefined = undefined;
    nodes.forEach((n) => {
      const pos = n.getPositionX() + n.getNodeWidth();
      if (rightX === undefined) {
        rightX = pos;
      } else {
        rightX = Math.max(rightX, pos);
      }
    });

    if (rightX !== undefined) {
      nodes.forEach((n) => {
        n.setPosition(rightX - n.getNodeWidth(), n.getPositionY());
        this.operation.emit(new NodeOperation(OperationType.update, n));
      });
    }

    this.updateRendering();
  }

  alignSelectedElementsToTopBorder() {
    const nodes: Node[] = this.nodeService.getSelectedNodes();

    let topY: number | undefined = undefined;
    nodes.forEach((n) => {
      const pos = n.getPositionY();
      if (topY === undefined) {
        topY = pos;
      } else {
        topY = Math.min(topY, pos);
      }
    });

    if (topY !== undefined) {
      nodes.forEach((n) => {
        n.setPosition(n.getPositionX(), topY);
        this.operation.emit(new NodeOperation(OperationType.update, n));
      });
    }

    this.updateRendering();
  }

  alignSelectedElementsToBottomBorder() {
    const nodes: Node[] = this.nodeService.getSelectedNodes();

    let bottomY: number | undefined = undefined;
    nodes.forEach((n) => {
      const pos = n.getPositionY() + n.getNodeHeight();
      if (bottomY === undefined) {
        bottomY = pos;
      } else {
        bottomY = Math.max(bottomY, pos);
      }
    });

    if (bottomY !== undefined) {
      nodes.forEach((n) => {
        n.setPosition(n.getPositionX(), bottomY - n.getNodeHeight());
        this.operation.emit(new NodeOperation(OperationType.update, n));
      });
    }

    this.updateRendering();
  }

  stretchShortSections(
    sections: TrainrunSection[],
    runGlobally = true,
    sign = 1,
  ): void {
    const MIN_SECTION_LENGTH_PX = 200;

    const toDirection = (a: PortAlignment) =>
      a === PortAlignment.Left || a === PortAlignment.Right ? "horizontal" : "vertical";

    const processed = !(runGlobally && sign >= 0) ? new Set<string>() : null;
    sections.forEach((section: TrainrunSection) => {
      if (section.isPathInvalid()) {
        return;
      }
      const src = section.getPositionAtSourceNode();
      const tgt = section.getPositionAtTargetNode();
      const length = Vec2D.norm(Vec2D.sub(tgt, src));
      if (runGlobally && sign >= 0 && length >= MIN_SECTION_LENGTH_PX) {
        return;
      }
      const srcNodeObj = section.getSourceNode();
      const tgtNodeObj = section.getTargetNode();
      const srcDir = toDirection(
        srcNodeObj.getPort(section.getSourcePortId()).getPositionAlignment(),
      );
      const tgtDir = toDirection(
        tgtNodeObj.getPort(section.getTargetPortId()).getPositionAlignment(),
      );
      const direction = srcDir === tgtDir ? srcDir : `${srcDir}/${tgtDir}`;
      const key = [srcNodeObj.getBetriebspunktName(), tgtNodeObj.getBetriebspunktName()]
        .sort()
        .join(" – ");

      if (processed?.has(key)) {
        return;
      }
      processed?.add(key);

      const deficit = MIN_SECTION_LENGTH_PX - length;
      const steps = Math.max(Math.ceil(deficit / (2 * RASTERING_BASIC_GRID_SIZE)), 1);
      let delta =
        sign < 0 && runGlobally ? Number.MAX_SAFE_INTEGER : steps * RASTERING_BASIC_GRID_SIZE;

      const centerX = (src.getX() + tgt.getX()) / 2;
      const centerY = (src.getY() + tgt.getY()) / 2;

      if (sign < 0) {
        delta = this.limitDeltaForMinEdgeLength(
          delta,
          direction,
          centerX,
          centerY,
          MIN_SECTION_LENGTH_PX,
        );
        if (delta <= 0) {
          console.log(`  [skip] ${key}: cannot shrink without violating minimum edge length`);
          return;
        }
      }

      if (direction === "horizontal") {
        this.nodeService.getNodes().forEach((node: Node) => {
          const nodeCenterX = node.getPositionX() + node.getNodeWidth() / 2;
          const dx = (nodeCenterX <= centerX ? -1 : 1) * sign * delta;
          this.nodeService.changeNodePositionWithoutUpdate(
            node.getId(),
            node.getPositionX() + dx,
            node.getPositionY(),
            true,
            false,
          );
        });
      } else if (direction === "vertical") {
        this.nodeService.getNodes().forEach((node: Node) => {
          const nodeCenterY = node.getPositionY() + node.getNodeHeight() / 2;
          const dy = (nodeCenterY <= centerY ? -1 : 1) * sign * delta;
          this.nodeService.changeNodePositionWithoutUpdate(
            node.getId(),
            node.getPositionX(),
            node.getPositionY() + dy,
            true,
            false,
          );
        });
      } else {
        console.log(`  [skip] ${key}: mixed port directions (${direction})`);
        return;
      }

      const action = sign >= 0 ? "stretched" : "shrunk";
      console.log(`  [${action}] ${key} (${Math.round(length)}px, ${direction})`);
    });

    this.nodeService.nodesUpdated();
    this.nodeService.transitionsUpdated();
    this.trainrunService.trainrunsUpdated();
    this.trainrunSectionService.trainrunSectionsUpdated();
  }

  private limitDeltaForMinEdgeLength(
    delta: number,
    direction: string,
    centerX: number,
    centerY: number,
    minLength: number,
  ): number {
    const allSections = this.trainrunSectionService.getTrainrunSections();
    let maxDelta = delta;

    for (const section of allSections) {
      if (section.isPathInvalid()) {
        continue;
      }
      const src = section.getPositionAtSourceNode();
      const tgt = section.getPositionAtTargetNode();
      const srcNode = section.getSourceNode();
      const tgtNode = section.getTargetNode();
      const edgeKey = `${srcNode.getBetriebspunktName()} – ${tgtNode.getBetriebspunktName()}`;

      const isHorizontal = direction === "horizontal";
      const srcCenter = isHorizontal
        ? srcNode.getPositionX() + srcNode.getNodeWidth() / 2
        : srcNode.getPositionY() + srcNode.getNodeHeight() / 2;
      const tgtCenter = isHorizontal
        ? tgtNode.getPositionX() + tgtNode.getNodeWidth() / 2
        : tgtNode.getPositionY() + tgtNode.getNodeHeight() / 2;
      const center = isHorizontal ? centerX : centerY;

      if (!isHorizontal && direction !== "vertical") {
        continue;
      }
      if (srcCenter <= center === tgtCenter <= center) {
        continue;
      }

      const currentLength = Vec2D.norm(Vec2D.sub(tgt, src));
      const allowable =
        Math.floor((currentLength - minLength) / 2 / RASTERING_BASIC_GRID_SIZE) *
        RASTERING_BASIC_GRID_SIZE;
      if (allowable < maxDelta) {
        console.log(
          `  [limit] edge ${edgeKey} (${Math.round(currentLength)}px) constrains delta to ${allowable}px`,
        );
      }
      maxDelta = Math.min(maxDelta, allowable);
    }

    return maxDelta;
  }
}
