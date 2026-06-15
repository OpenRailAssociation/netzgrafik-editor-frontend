import {EventEmitter, Injectable} from "@angular/core";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {UiInteractionService} from "../ui/ui.interaction.service";
import {NodeService} from "../data/node.service";
import {NoteService} from "../data/note.service";
import {Vec2D} from "../../utils/vec2D";
import {Node} from "../../models/node.model";
import {ViewportCullService} from "../ui/viewport.cull.service";
import {NodeOperation, Operation, OperationType} from "src/app/models/operation.model";
import {Note} from "../../models/note.model";

@Injectable({
  providedIn: "root",
})
export class PositionTransformationService {
  constructor(
    private readonly trainrunSectionService: TrainrunSectionService,
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

    let leftX = undefined;
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

    let rightX = undefined;
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

    let topY = undefined;
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

    let bottomY = undefined;
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

  callRobustAutomaticNodeLayouting() {
    console.log("Running Spring Layout…");

    const nodes = this.nodeService.getNodes();
    const edges: Array<{source: any; target: any}> = [];

    // Build edge list from ports
    nodes.forEach((n) => {
      n.getPorts().forEach((p) => {
        const opp = p.getOppositeNode(n.getId());
        if (opp) {
          edges.push({source: n, target: opp});
        }
      });
    });

    // Spring layout parameters
    const ITERATIONS = 200;
    const SPRING_LENGTH = 150;
    const SPRING_STRENGTH = 0.01;
    const REPULSION = 50000;
    const DAMPING = 0.85;

    // Initialize velocities (FIX: number keys instead of string)
    const velocity = new Map<number, {x: number; y: number}>();
    nodes.forEach((n) => velocity.set(n.getId(), {x: 0, y: 0}));

    for (let iter = 0; iter < ITERATIONS; iter++) {
      // Forces per node
      const forces = new Map<number, {x: number; y: number}>();
      nodes.forEach((n) => forces.set(n.getId(), {x: 0, y: 0}));

      // --- REPULSION (Coulomb) ---
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];

          const dx = a.getPositionX() - b.getPositionX();
          const dy = a.getPositionY() - b.getPositionY();
          const distSq = dx * dx + dy * dy || 0.01;
          const force = REPULSION / distSq;

          const fx = (dx / Math.sqrt(distSq)) * force;
          const fy = (dy / Math.sqrt(distSq)) * force;

          forces.get(a.getId())!.x += fx;
          forces.get(a.getId())!.y += fy;
          forces.get(b.getId())!.x -= fx;
          forces.get(b.getId())!.y -= fy;
        }
      }

      // --- SPRINGS (Hooke) ---
      edges.forEach((e) => {
        const a = e.source;
        const b = e.target;

        const dx = b.getPositionX() - a.getPositionX();
        const dy = b.getPositionY() - a.getPositionY();
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;

        const displacement = dist - SPRING_LENGTH;
        const force = SPRING_STRENGTH * displacement;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        forces.get(a.getId())!.x += fx;
        forces.get(a.getId())!.y += fy;
        forces.get(b.getId())!.x -= fx;
        forces.get(b.getId())!.y -= fy;
      });

      // --- UPDATE POSITIONS ---
      nodes.forEach((n) => {
        const f = forces.get(n.getId())!;
        const v = velocity.get(n.getId())!;

        // Apply damping
        v.x = (v.x + f.x) * DAMPING;
        v.y = (v.y + f.y) * DAMPING;

        n.setPosition(n.getPositionX() + v.x, n.getPositionY() + v.y);
      });
    }

    console.log("Spring Layout finished.");

    // Trigger rendering updates
    this.nodeService.nodesUpdated();
    this.nodeService.transitionsUpdated();
    this.nodeService.connectionsUpdated();
    this.trainrunSectionService.trainrunSectionsUpdated();
    this.updateRendering();
  }
}
