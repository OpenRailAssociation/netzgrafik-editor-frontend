import {Injectable} from "@angular/core";
import {Node} from "../../../../models/node.model";
import {NodeService} from "../../../data/node.service";
import {DataService} from "../../../data/data.service";
import {TrainrunService} from "../../../data/trainrun.service";
import {
  buildEdges,
  computeNeighbors,
  computeShortestPaths,
  topoSort,
  Vertex,
} from "src/app/view/util/origin-destination-graph";

// Computed values for an origin/destination pair.
export type OriginDestination = {
  // Names.
  origin: string;
  destination: string;
  // Travel time in minutes.
  travelTime: number | undefined;
  // Number of transfers.
  transfers: number | undefined;
  // Total cost, including connection penalties (optimized value).
  totalCost: number | undefined;
  // If false, no path was found (other fields should be ignored).
  found: boolean;
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
   * Return the origin/destination nodes used for output.
   *
   * If nodes are selected, we output those, otherwise,
   * we output all visible nodes.
   * Note that other nodes may be used for the calculation.
   */
  getODOutputNodes(): Node[] {
    const selectedNodes = this.nodeService.getSelectedNodes();
    return selectedNodes.length > 0 ? selectedNodes : this.nodeService.getVisibleNodes();
  }

  /**
   * Compute travelTime, transfers, and totalCost for all origin/destination pairs.
   *
   * Note that this is expensive.
   */
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
    const odNodes = this.getODOutputNodes();
    const trainruns = this.trainrunService.getVisibleTrainruns();

    const [edges, tsSuccessor] = buildEdges(
      nodes,
      odNodes,
      trainruns,
      connectionPenalty,
      this.trainrunService,
      timeLimit,
    );
    // Perf.Opt.: this map is used to cache the keys and thus the JSON.stringify will not be called for each key request
    const cachedKey = new Map<Vertex, string>();

    const neighbors = computeNeighbors(edges, cachedKey);
    const vertices = topoSort(neighbors, cachedKey);
    // In theory we could parallelize the pathfindings, but the overhead might be too big.
    const res = new Map<string, [number, number]>();
    odNodes.forEach((origin) => {
      computeShortestPaths(origin.getId(), neighbors, vertices, tsSuccessor, cachedKey).forEach(
        (value, key) => {
          res.set([origin.getId(), key].join(","), value);
        },
      );
    });

    const rows = [];
    odNodes.sort((a, b) => a.getBetriebspunktName().localeCompare(b.getBetriebspunktName()));
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
            found: false,
          });
          return;
        }
        const [totalCost, connections] = costs;
        const row = {
          origin: origin.getBetriebspunktName(),
          destination: destination.getBetriebspunktName(),
          travelTime: totalCost - connections * connectionPenalty,
          transfers: connections,
          totalCost: totalCost,
          found: true,
        };
        rows.push(row);
      });
    });

    return rows;
  }
}
