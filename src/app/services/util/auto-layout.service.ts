import {Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {NodeService} from "../data/node.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {ViewportCullService} from "../ui/viewport.cull.service";
import {Rectangle, removeOverlaps} from "webcola";

@Injectable({
  providedIn: "root",
})
export class AutoLayoutService {
  constructor(
    private readonly nodeService: NodeService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly viewportCullService: ViewportCullService,
  ) {}

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

  applyAutoSpacing(minSpacing: number) {
    const selectedNodeIds = new Set(this.nodeService.getSelectedNodes().map(n => n.getId()));
    const rectangleByNodeId = new Map<number, Rectangle>;

    this.nodeService.getNodes().forEach((node) => {
      const margin = selectedNodeIds.has(node.getId()) ? minSpacing / 2 : 0;
      const rectangle = new Rectangle(
        node.getPositionX() - margin,
        node.getPositionX() + node.getNodeWidth() + margin,
        node.getPositionY() - margin,
        node.getPositionY() + node.getNodeHeight() + margin
      );
      rectangleByNodeId.set(node.getId(), rectangle);
    });

    removeOverlaps(Array.from(rectangleByNodeId.values()));

    rectangleByNodeId.forEach((rectangle, nodeId) => {
      const node = this.nodeService.getNodeFromId(nodeId);
      node.setPosition(
        rectangle.cx() - node.getNodeWidth() / 2,
        rectangle.cy() - node.getNodeHeight() / 2
      );
    });

    // Trigger rendering updates
    this.nodeService.nodesUpdated();
    this.nodeService.transitionsUpdated();
    this.nodeService.connectionsUpdated();
    this.trainrunSectionService.trainrunSectionsUpdated();
    this.updateRendering();
  }
}
