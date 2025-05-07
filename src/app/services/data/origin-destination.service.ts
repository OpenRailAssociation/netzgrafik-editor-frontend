import {Injectable} from "@angular/core";
import {Node} from "../../models/node.model";
import {NodeService} from "./node.service";
import {DataService} from "./data.service";
import {TrainrunService} from "./trainrun.service";
import {
  buildEdges,
  computeNeighbors,
  computeShortestPaths,
  topoSort,
} from "src/app/view/util/origin-destination-graph";

type OriginDestination = {
  origin: string;
  destination: string;
  travelTime: string;
  transfert: string;
  totalCost: string;
};

@Injectable({
  providedIn: "root",
})
export class OriginDestinationService {
  constructor(
    private nodeService: NodeService,
    private dataService: DataService,
    private trainrunService: TrainrunService,
  ) {}

  /**
   * Returns the origin/destination nodes used for output.
   *
   * Note that other nodes may be used for the calculation.
   */
  odNodes(): Node[] {
    const selectedNodes = this.nodeService.getSelectedNodes();
    return selectedNodes.length > 0
      ? selectedNodes
      : this.nodeService.getVisibleNodes();
  }

  originDestinationData(): OriginDestination[] {
    // Duration of the schedule to consider (in minutes).
    // TODO: ideally this would be 24 hours, but performance is a concern.
    // One idea to optimize would be to consider the minimum time window before the schedule repeats (LCM).
    // Draft here: https://colab.research.google.com/drive/1Z1r2uU2pgffWxCbG_wt2zoLStZKzWleE#scrollTo=F6vOevK6znee
    const timeLimit = 16 * 60;

    const metadata = this.dataService.getNetzgrafikDto().metadata;
    // The cost to add for each connection.
    const connectionPenalty =
      metadata.analyticsSettings.originDestinationSettings.connectionPenalty;
    const nodes = this.nodeService.getNodes();
    const odNodes = this.odNodes();
    const trainruns = this.trainrunService.getVisibleTrainruns();

    const edges = buildEdges(
      nodes,
      odNodes,
      trainruns,
      connectionPenalty,
      this.trainrunService,
      timeLimit,
    );

    const neighbors = computeNeighbors(edges);
    const vertices = topoSort(neighbors);
    // In theory we could parallelize the pathfindings, but the overhead might be too big.
    const res = new Map<string, [number, number]>();
    odNodes.forEach((origin) => {
      computeShortestPaths(origin.getId(), neighbors, vertices).forEach(
        (value, key) => {
          res.set([origin.getId(), key].join(","), value);
        },
      );
    });

    const rows = [];
    odNodes.sort((a, b) =>
      a.getBetriebspunktName().localeCompare(b.getBetriebspunktName()),
    );
    odNodes.forEach((origin) => {
      odNodes.forEach((destination) => {
        if (origin.getId() === destination.getId()) {
          return;
        }
        const costs = res.get([origin.getId(), destination.getId()].join(","));
        if (costs === undefined) {
          // Keep empty if no path is found.
          rows.push({
            origin: origin.getBetriebspunktName(),
            destination: destination.getBetriebspunktName(),
            travelTime: "",
            transfert: "",
            totalCost: "",
          });
          return;
        }
        const [totalCost, connections] = costs;
        const row = {
          origin: origin.getBetriebspunktName(),
          destination: destination.getBetriebspunktName(),
          travelTime: (totalCost - connections * connectionPenalty).toString(),
          transfert: connections.toString(),
          totalCost: totalCost.toString(),
        };
        rows.push(row);
      });
    });

    return rows;
  }
}
