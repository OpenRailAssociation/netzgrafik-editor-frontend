import {Injectable, OnDestroy} from "@angular/core";
import {NodeService} from "../data/node.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {TrainrunService} from "../data/trainrun.service";
import {BehaviorSubject, Subject} from "rxjs";
import {ShortestDistanceNode} from "./algorithms/shortest-distance-node";
import {
  buildEdges,
  computeNeighbors,
  computeShortestPaths,
  topoSort,
} from "src/app/view/util/origin-destination-graph";

@Injectable({
  providedIn: "root",
})
export class AnalyticsService implements OnDestroy {
  findAllShortestDistanceNodesSubject = new BehaviorSubject<ShortestDistanceNode[]>([]);
  readonly shortestDistanceNode = this.findAllShortestDistanceNodesSubject.asObservable();
  private destroyed = new Subject<void>();

  constructor(
    private nodeService: NodeService,
    private trainrunSectionService: TrainrunSectionService,
    private trainrunService: TrainrunService,
  ) {}

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  calculateShortestDistanceNodesFromStartingNode(departureNodeId: number) {
    this.findAllShortestDistanceNodesSubject.next(this.findShortestDistanceNodes(departureNodeId));
  }

  calculateShortestDistanceNodesFromStartingTrainrunSection(
    trainrunSectionId: number,
    departureNodeId: number,
  ) {
    this.findAllShortestDistanceNodesSubject.next(
      this.findShortestDistanceNodes(departureNodeId, trainrunSectionId),
    );
  }

  /**
   * Compute shortest paths from a departure node using the OD graph algorithm.
   * When startTrainrunSectionId is set, the first hop is constrained to that
   * section, and paths back to the departure node are excluded.
   */
  private findShortestDistanceNodes(
    departureNodeId: number,
    startTrainrunSectionId?: number,
  ): ShortestDistanceNode[] {
    const nodes = this.nodeService.getNodes();
    const trainruns = this.trainrunService.getVisibleTrainruns();
    // No connection penalty.
    const connectionPenalty = 0;
    // Same time window as the OD matrix.
    const timeLimit = 16 * 60;

    const [edges, tsSuccessor, sectionExpansion] = buildEdges(
      nodes,
      nodes,
      trainruns,
      connectionPenalty,
      this.trainrunService,
      timeLimit,
    );
    const filteredEdges =
      startTrainrunSectionId !== undefined
        ? edges.filter(({v1, v2}) => {
            // Exclude all edges leaving the departure node, except the one that
            // follows the trainrun section.
            if (v1.nodeId === departureNodeId && v1.isDeparture) {
              return v2.trainrunSectionId === startTrainrunSectionId;
            }
            // Exclude all edges entering the departure node.
            const arrivesBackAtDeparture = !v2.isDeparture && v2.nodeId === departureNodeId;
            return !arrivesBackAtDeparture;
          })
        : edges;
    const neighbors = computeNeighbors(filteredEdges);
    const vertices = topoSort(neighbors);
    const results = computeShortestPaths(
      departureNodeId,
      neighbors,
      vertices,
      tsSuccessor,
      sectionExpansion,
    );

    const departureNode = this.nodeService.getNodeFromId(departureNodeId);
    const shortestDistanceNodes: ShortestDistanceNode[] = [
      new ShortestDistanceNode(departureNode, 0),
    ];
    results.forEach(([cost, _connections, tsIds], nodeId) => {
      const sdn = new ShortestDistanceNode(this.nodeService.getNodeFromId(nodeId), cost);
      sdn.setPath(tsIds.map((id) => this.trainrunSectionService.getTrainrunSectionFromId(id)));
      shortestDistanceNodes.push(sdn);
    });
    shortestDistanceNodes.sort((a, b) => a.distance - b.distance);

    return shortestDistanceNodes;
  }
}
