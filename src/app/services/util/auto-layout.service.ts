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

    const elkPorts = nodes.flatMap((n) =>
      n.getPorts().map((p) => ({
        id: `${n.getId()}-${p.getId()}`,
        parent: n.getId().toString(),
      })),
    );

    return {
      id: "root",
      children: elkNodes,
      edges: elkEdges,
    };
  }

  private updateNodePositionsFromElkLayout(elkLayout: any, nodes: Node[]) {
    const elkNodes = elkLayout.children;
    elkNodes.forEach((elkNode: any) => {
      const nodeId = parseInt(elkNode.id, 10);
      const node = nodes.find((n) => n.getId() === nodeId);
      if (node) {
        node.setPosition(elkNode.x, elkNode.y);
        this.operation.emit(new NodeOperation(OperationType.update, node));
      }
    });
  }

  runAutomaticLayoutingForImports() {
    console.log("Running Layout…");

    const nodes = this.nodeService.getNodes();

    console.log(new ElkConstructor().knownLayoutAlgorithms());

    const graph = this.toElkGraph(nodes);

    console.log(graph);

    const elk = new ElkConstructor({
      defaultLayoutOptions: {
        "elk.algorithm": "sporeOverlap",
        "elk.spacing.nodeNode": "450",
      },
    });

    elk
      .layout(graph)
      .then((layout) => {
        console.log("Layout finished.");

        this.updateNodePositionsFromElkLayout(layout, nodes);

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
