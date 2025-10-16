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
import { M } from "@angular/cdk/keycodes";

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


  // Given a graph (adjacency list), and vertices in topological order, return the shortest paths (and connections)
  // from a given node to other nodes.
  async computeShortestPaths (
    origin : Node,
    neighbors: Map<string, [Vertex, number][]>,
    vertices: Vertex[],
    tsSuccessor: Map<number, number>,
    cachedKey: Map<Vertex, string>,
    finalRes : any
  ): Promise<void>  {
    const from = origin.getId();
    const tsPredecessor = new Map<number, number>();
    for (const [k, v] of tsSuccessor.entries()) {
      tsPredecessor.set(v, k);
    }
    const res = new Map<number, [number, number]>();
    const dist = new Map<string, [number, number]>();

    let started = false;
    vertices.forEach( (vertex) => {
       
      let key = cachedKey.get(vertex);
      if (key === undefined) {
        key = JSON.stringify(vertex);
        cachedKey.set(vertex, key);
      }
 
      // First, look for our start node.
      if (!started) {
        if (from === vertex.nodeId && vertex.isDeparture === true && vertex.time === undefined) {
          started = true;
          dist.set(key, [0, 0]);
        } else {
          return;
        }
      }
       
      // Perf.Opt.: just cache the dist.get(key) access (is 3x used)
      const cachedDistGetKey = dist.get(key);

      // We found an end node.
      if (
        vertex.isDeparture === false &&
        vertex.time === undefined &&
        cachedDistGetKey !== undefined &&
        vertex.nodeId !== from
      ) {
        res.set(vertex.nodeId, cachedDistGetKey);
      }
      const neighs = neighbors.get(key);
      if (neighs === undefined || cachedDistGetKey === undefined) {
        return;
      }
      // The shortest path from the start node to this vertex is a shortest path from the start node to a neighbor
      // plus the weight of the edge connecting the neighbor to this vertex.
      //neighs.forEach(([neighbor, weight]) => {
      for (let idx=0;idx < neighs.length; idx++) {
        const data = neighs[idx];
        const neighbor = data[0];
        const weight = data[1];
        // Perf.Opt.: just cache the dist.get(key) access (is 2x used)
        const distGetKey = dist.get(key);
        const alt = distGetKey[0] + weight;

        let neighborKey = cachedKey.get(neighbor);
        if (neighborKey === undefined) {
          neighborKey = JSON.stringify(neighbor);
          cachedKey.set(neighbor, neighborKey);
        }

        const distNeighborKey = dist.get(neighborKey);
        if (distNeighborKey === undefined || alt < distNeighborKey[0]) {
          let connection = 0;
          let successor = tsSuccessor;
          if (vertex.trainrunId < 0) {
            successor = tsPredecessor;
          }
          if (
            vertex.trainrunId !== undefined &&
            neighbor.trainrunId !== undefined &&
            (vertex.trainrunId !== neighbor.trainrunId ||
              (successor.get(vertex.trainrunSectionId) !== neighbor.trainrunSectionId &&
                vertex.isDeparture === false))
          ) {
            connection = 1;
          }
          dist.set(neighborKey, [alt, distGetKey[1] + connection]);
        }
      };
    });

    for (const [key, value] of res.entries()) {
      finalRes.set([origin.getId(), key].join(","), value);
    }
    return;
  };

  async runThread(
    startEnd: [number,number],
    odNodes: Node[],
    neighbors: Map<string, [Vertex, number][]>,
    vertices: Vertex[],
    tsSuccessor: Map<number, number>,
    cachedKey: Map<Vertex, string>,
    res: Map<string, [number, number]>,
  ) {
    // console.log(`Start ${startEnd} at ${new Date().toISOString()}`);
    const start = startEnd[0];
    const end = startEnd[1];
    const chunk = odNodes.slice(start, end);

    const promises = chunk.map(origin =>
      this.computeShortestPaths(
        origin,
        neighbors,
        vertices,
        tsSuccessor,
        cachedKey,
        res
      )
    );
    await Promise.all(promises);
    // console.log(`End ${startEnd} at ${new Date().toISOString()}`);
  }

  async computeBatchShortestPaths(
    odNodes: Node[],
    neighbors: Map<string, [Vertex, number][]>,
    vertices: Vertex[],
    tsSuccessor: Map<number, number>,
    cachedKey: Map<Vertex, string>,
    res: Map<string, [number, number]>,
  ): Promise<void> {
    const numThreads = 8;
    const chunkSize = Math.ceil(odNodes.length / numThreads);
    const allChunks: [number, number][] = [];

    for (let i = 0; i < odNodes.length; i += chunkSize) {
      allChunks.push([i, Math.min(i + chunkSize, odNodes.length)]);
    }

    const threads: Promise<void>[] = [];
 
    const tasks = allChunks.map( (chunk)=>{
      this.runThread(
        chunk,
        odNodes,
        neighbors,
        vertices,
        tsSuccessor,
        cachedKey,
        res
      );
    });

    await Promise.all(tasks);
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
    const vertices = topoSort(neighbors);
    // In theory we could parallelize the pathfindings, but the overhead might be too big.
    const res = new Map<string, [number, number]>();
    this.computeBatchShortestPaths(odNodes, neighbors, vertices, tsSuccessor, cachedKey, res);
    
    const rows = [];
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
