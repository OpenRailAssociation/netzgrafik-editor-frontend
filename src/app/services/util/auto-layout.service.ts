import {EventEmitter, Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {NodeService} from "../data/node.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {ViewportCullService} from "../ui/viewport.cull.service";
import {UiInteractionService} from "../ui/ui.interaction.service";
import ElkConstructor from "elkjs/lib/elk.bundled.js";
import {NodeOperation, Operation, OperationType} from "src/app/models/operation.model";

@Injectable({
  providedIn: "root",
})
export class AutoLayoutService {
  constructor(
    private readonly nodeService: NodeService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly uiInteractionService: UiInteractionService,
    private readonly viewportCullService: ViewportCullService,
  ) {}
  readonly operation = new EventEmitter<Operation>();

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

  private toElkGraph(nodes: Node[]): any {
    const elkNodes = nodes.map((n) => ({
      id: n.getId().toString(),
      width: n.getNodeWidth(),
      height: n.getNodeHeight(),
      x: n.getPositionX(),
      y: n.getPositionY(),
    }));

    const elkEdges = this.trainrunSectionService.getTrainrunSections().map((ts) => ({
      id: ts.getId().toString(),
      source: ts.getSourceNodeId().toString(),
      target: ts.getTargetNodeId().toString(),
    }));

    return {
      id: "root",
      children: elkNodes,
      edges: elkEdges,
    };
  }

  private updateNodePositionsFromElkLayout(elkLayout: any, nodes: Node[]): void {
    const nodesById = new Map<number, Node>(nodes.map((n) => [n.getId(), n]));
    for (const elkNode of elkLayout.children) {
      const node = nodesById.get(parseInt(elkNode.id, 10));
      if (node) {
        node.setPosition(elkNode.x, elkNode.y);
        this.operation.emit(new NodeOperation(OperationType.update, node));
      }
    }
  }

  private computeDesiredEdgeLength(nodes: Node[]): number {
    const sections = this.trainrunSectionService.getTrainrunSections();
    const nodesById = new Map(nodes.map((n) => [n.getId(), n]));
    const lengths: number[] = [];
    for (const ts of sections) {
      // Skip self-loops — they contribute a zero length that biases the median down.
      if (ts.getSourceNodeId() === ts.getTargetNodeId()) continue;
      const src = nodesById.get(ts.getSourceNodeId());
      const tgt = nodesById.get(ts.getTargetNodeId());
      if (!src || !tgt) continue;
      const dx = src.getPositionX() - tgt.getPositionX();
      const dy = src.getPositionY() - tgt.getPositionY();
      lengths.push(Math.sqrt(dx * dx + dy * dy));
    }

    // Floor: the desired edge length must be at least wide enough that two of
    // the largest nodes can sit side-by-side without overlapping.  If the
    // geographic data is dense, a small median would cause ELK to target a
    // spacing tighter than the nodes themselves, forcing removeOverlaps to do
    // heavy work that distorts the topology it just computed.
    const maxDim = nodes.reduce((m, n) => Math.max(m, n.getNodeWidth(), n.getNodeHeight()), 0);
    const floor = maxDim * 1.3 + 40;

    if (lengths.length === 0) return Math.max(200, floor);
    lengths.sort((a, b) => a - b);
    const median = lengths[Math.floor(lengths.length / 2)];
    const scale = 0.5;
    return Math.max(median * scale, floor) * scale;
  }

  private correctAxisFlips(
    nodes: Node[],
    originalPositions: Map<number, {x: number; y: number}>,
  ): void {
    // Single pass to compute both centroids simultaneously
    let newCx = 0,
      newCy = 0,
      origCx = 0,
      origCy = 0;
    nodes.forEach((n) => {
      newCx += n.getPositionX();
      newCy += n.getPositionY();
      const o = originalPositions.get(n.getId());
      if (o) {
        origCx += o.x;
        origCy += o.y;
      }
    });
    newCx /= nodes.length;
    newCy /= nodes.length;
    origCx /= nodes.length;
    origCy /= nodes.length;

    // Negative covariance on an axis means that axis is flipped.
    let covX = 0,
      covY = 0;
    nodes.forEach((n) => {
      const o = originalPositions.get(n.getId());
      if (!o) return;
      covX += (n.getPositionX() - newCx) * (o.x - origCx);
      covY += (n.getPositionY() - newCy) * (o.y - origCy);
    });

    if (covX < 0)
      nodes.forEach((n) => n.setPosition(2 * newCx - n.getPositionX(), n.getPositionY()));
    if (covY < 0)
      nodes.forEach((n) => n.setPosition(n.getPositionX(), 2 * newCy - n.getPositionY()));
  }

  private removeOverlaps(nodes: Node[], padding = 40): void {
    // Precompute constant half-dimensions (node sizes never change during layout)
    const halfW = nodes.map((n) => n.getNodeWidth() / 2);
    const halfH = nodes.map((n) => n.getNodeHeight() / 2);

    for (let iter = 0; iter < 300; iter++) {
      let anyOverlap = false;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        // Cache centre of a; update it whenever a moves within this i-pass
        let cx_a = a.getPositionX() + halfW[i];
        let cy_a = a.getPositionY() + halfH[i];

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const cx_b = b.getPositionX() + halfW[j];
          const cy_b = b.getPositionY() + halfH[j];
          const dx = cx_b - cx_a;
          const dy = cy_b - cy_a;
          const hw = halfW[i] + halfW[j];
          const hh = halfH[i] + halfH[j];

          // AABB fast rejection: if either axis separation already exceeds the
          // padded half-sum, the Minkowski boundary cannot be violated in any
          // direction — skip the expensive sqrt entirely.
          if (Math.abs(dx) >= hw + padding || Math.abs(dy) >= hh + padding) continue;

          const dist = Math.sqrt(dx * dx + dy * dy);

          let minDist: number;
          if (dist < 1e-6) {
            // Coincident centres: push apart horizontally
            a.setPosition(a.getPositionX() - hw / 2, a.getPositionY());
            b.setPosition(b.getPositionX() + hw / 2, b.getPositionY());
            cx_a = a.getPositionX() + halfW[i];
            cy_a = a.getPositionY() + halfH[i];
            anyOverlap = true;
            continue;
          } else if (Math.abs(dx) < 1e-6) {
            minDist = hh + padding;
          } else if (Math.abs(dy) < 1e-6) {
            minDist = hw + padding;
          } else {
            minDist = Math.min((hw * dist) / Math.abs(dx), (hh * dist) / Math.abs(dy)) + padding;
          }

          if (dist < minDist) {
            anyOverlap = true;
            const push = (minDist - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;
            a.setPosition(a.getPositionX() - nx * push, a.getPositionY() - ny * push);
            b.setPosition(b.getPositionX() + nx * push, b.getPositionY() + ny * push);
            // Keep cached centre of a consistent for the rest of this i-pass
            cx_a = a.getPositionX() + halfW[i];
            cy_a = a.getPositionY() + halfH[i];
          }
        }
      }
      if (!anyOverlap) break;
    }
  }

  runAutomaticLayoutingForImports() {
    console.log("Running Layout…");

    const nodes = this.nodeService.getNodes();
    const originalPositions = new Map(
      nodes.map((n) => [n.getId(), {x: n.getPositionX(), y: n.getPositionY()}]),
    );
    const desiredEdgeLength = this.computeDesiredEdgeLength(nodes);
    console.log(`Desired edge length: ${desiredEdgeLength}`);

    const graph = this.toElkGraph(nodes);

    const elk = new ElkConstructor({
      defaultLayoutOptions: {
        "elk.algorithm": "stress",
        "org.eclipse.elk.stress.desiredEdgeLength": desiredEdgeLength.toString(),
        "org.eclipse.elk.stress.epsilon": "1e-4",
        "org.eclipse.elk.stress.iterationLimit": "1000",
      },
    });

    elk
      .layout(graph)
      .then((layout) => {
        console.log("Layout finished.");

        this.updateNodePositionsFromElkLayout(layout, nodes);
        this.correctAxisFlips(nodes, originalPositions);
        this.removeOverlaps(nodes, 250);

        this.nodeService.nodesUpdated();
        this.nodeService.transitionsUpdated();
        this.nodeService.connectionsUpdated();
        this.trainrunSectionService.trainrunSectionsUpdated();
        this.updateRendering();
        const closestNodeToCenter = this.uiInteractionService.findClosestNodeToViewCenter(nodes);
        if (closestNodeToCenter !== null) {
          this.uiInteractionService.gotoNode(closestNodeToCenter);
        }
      })
      .catch(console.error);
  }
}
