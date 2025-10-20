import {Trainrun} from "src/app/models/trainrun.model";
import {TrainrunService} from "src/app/services/data/trainrun.service";
import {TrainrunIterator} from "src/app/services/util/trainrun.iterator";
import {Node} from "src/app/models/node.model";

// A vertex indicates a "state": e.g. arriving at a node at a certain time and from a given trainrun.
export class Vertex {
  constructor(
    public nodeId: number,
    // Indicates if we depart or arrive at the node.
    public isDeparture: boolean,
    // Optional fields are undefined for "convenience" vertices.
    // Absolute time (duration from the start of the schedule) in minutes.
    public time?: number,
    // Negative trainrun ids are used for reverse directions.
    public trainrunId?: number,
    // In addition to the trainrunId, the trainrunSectionId allows us to check for connections
    // (especially useful for trains going back to a previous node).
    public trainrunSectionId?: number,
  ) {}
}

export class Edge {
  constructor(
    public v1: Vertex,
    public v2: Vertex,
    // The weight represents the cost of the edge, it is similar to a duration in minutes
    // but it may include a connection penalty cost.
    public weight: number,
  ) {}
}

// In addition to edges, return a map of trainrunSection ids to their successor
// (in the forward direction), so we can check for connections.
export const buildEdges = (
  nodes: Node[],
  odNodes: Node[],
  trainruns: Trainrun[],
  connectionPenalty: number,
  trainrunService: TrainrunService,
  timeLimit: number,
): [Edge[], Map<number, number>] => {
  const [sectionEdges, tsSuccessor] = buildSectionEdges(trainruns, trainrunService, timeLimit);
  let edges = sectionEdges;

  // Both trainrun and trainrunSection ids are encoded in JSON keys.
  const verticesDepartureByTrainrunByNode = new Map<number, Map<string, Vertex[]>>();
  const verticesArrivalByTrainrunByNode = new Map<number, Map<string, Vertex[]>>();
  edges.forEach((edge) => {
    const src = edge.v1;
    const tgt = edge.v2;
    if (src.isDeparture !== true) {
      console.log("src is not a departure: ", src);
    }
    if (tgt.isDeparture !== false) {
      console.log("tgt is not an arrival: ", tgt);
    }
    const departuresByTrainrun = verticesDepartureByTrainrunByNode.get(src.nodeId);
    const srcKey = JSON.stringify([src.trainrunId, src.trainrunSectionId]);
    if (departuresByTrainrun === undefined) {
      verticesDepartureByTrainrunByNode.set(
        src.nodeId,
        new Map<string, Vertex[]>([[srcKey, [src]]]),
      );
    } else {
      const departures = departuresByTrainrun.get(srcKey);
      if (departures === undefined) {
        departuresByTrainrun.set(srcKey, [src]);
      } else {
        departures.push(src);
      }
    }
    const arrivalsByTrainrun = verticesArrivalByTrainrunByNode.get(tgt.nodeId);
    const tgtKey = JSON.stringify([tgt.trainrunId, tgt.trainrunSectionId]);
    if (arrivalsByTrainrun === undefined) {
      verticesArrivalByTrainrunByNode.set(tgt.nodeId, new Map<string, Vertex[]>([[tgtKey, [tgt]]]));
    } else {
      const arrivals = arrivalsByTrainrun.get(tgtKey);
      if (arrivals === undefined) {
        arrivalsByTrainrun.set(tgtKey, [tgt]);
      } else {
        arrivals.push(tgt);
      }
    }
  });

  // Sorting is useful to find relevant connections later.
  verticesDepartureByTrainrunByNode.forEach((verticesDepartureByTrainrun) => {
    verticesDepartureByTrainrun.forEach((departures, trainrunId) => {
      departures.sort((a, b) => a.time - b.time);
    });
  });
  verticesArrivalByTrainrunByNode.forEach((verticesArrivalByTrainrun) => {
    verticesArrivalByTrainrun.forEach((arrivals, trainrunId) => {
      arrivals.sort((a, b) => a.time - b.time);
    });
  });

  // Note: pushing too many elements at once does not work well.
  edges = [
    ...edges,
    ...buildConvenienceEdges(
      odNodes,
      verticesDepartureByTrainrunByNode,
      verticesArrivalByTrainrunByNode,
    ),
  ];
  edges = [
    ...edges,
    ...buildConnectionEdges(
      nodes,
      verticesDepartureByTrainrunByNode,
      verticesArrivalByTrainrunByNode,
      connectionPenalty,
      tsSuccessor,
    ),
  ];

  return [edges, tsSuccessor];
};

// Given edges, return the neighbors (with weights) for each vertex, if any (outgoing adjacency list).
export const computeNeighbors = (
  edges: Edge[],
  cachedKey: Map<Vertex, string>,
): Map<string, [Vertex, number][]> => {
  const neighbors = new Map<string, [Vertex, number][]>();
  edges.forEach((edge) => {
    let v1 = cachedKey.get(edge.v1);
    if (v1 === undefined) {
      v1 = JSON.stringify(edge.v1);
      cachedKey.set(edge.v1, v1);
    }

    const v1Neighbors = neighbors.get(v1);
    if (v1Neighbors === undefined) {
      neighbors.set(v1, [[edge.v2, edge.weight]]);
    } else {
      v1Neighbors.push([edge.v2, edge.weight]);
    }
  });
  return neighbors;
};

// Given a graph (adjacency list), return the vertices in topological order.
// Note: sorting vertices by time would be enough for our use case.
export const topoSort = (
  graph: Map<string, [Vertex, number][]>,
  cachedKey: Map<Vertex, string>,
): Vertex[] => {
  const res = [];
  const visited = new Set<string>();
  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      depthFirstSearch(graph, JSON.parse(node) as Vertex, visited, res, cachedKey);
    }
  }
  return res.reverse();
};

// Given a graph (adjacency list), and vertices in topological order, return the shortest paths (and connections)
// from a given node to other nodes.
export const computeShortestPaths = (
  from: number,
  neighbors: Map<string, [Vertex, number][]>,
  vertices: Vertex[],
  tsSuccessor: Map<number, number>,
  cachedKey: Map<Vertex, string>,
): Map<number, [number, number]> => {
  const tsPredecessor = new Map<number, number>();
  tsSuccessor.forEach((v, k) => {
    tsPredecessor.set(v, k);
  });
  const res = new Map<number, [number, number]>();
  const dist = new Map<string, [number, number]>();

  let started = false;
  vertices.forEach((vertex) => {
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
    neighs.forEach(([neighbor, weight]) => {
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
    });
  });
  return res;
};

const buildSectionEdges = (
  trainruns: Trainrun[],
  trainrunService: TrainrunService,
  timeLimit: number,
): [Edge[], Map<number, number>] => {
  const edges = [];
  const its = trainrunService.getRootIterators();
  const tsSuccessor = new Map<number, number>();
  trainruns.forEach((trainrun) => {
    const tsIterator = its.get(trainrun.getId());
    if (tsIterator === undefined) {
      console.log("Ignoring trainrun (no root found): ", trainrun.getId());
      return;
    }
    // Forward edges are calculated first, so we can use the successor map.
    const forwardEdges = buildSectionEdgesFromIterator(tsIterator, false, timeLimit, tsSuccessor);
    // Add forward edges to round trip and one-way trainruns.
    edges.push(...forwardEdges);
    if (!trainrun.isRoundTrip()) return;
    // Don't forget the reverse direction for round trip trainruns.
    const ts = tsIterator.current().trainrunSection;
    const nextIterator = trainrunService.getIterator(tsIterator.current().node, ts);
    edges.push(...buildSectionEdgesFromIterator(nextIterator, true, timeLimit, tsSuccessor));
  });
  return [edges, tsSuccessor];
};

const buildSectionEdgesFromIterator = (
  tsIterator: TrainrunIterator,
  reverseIterator: boolean,
  timeLimit: number,
  tsSuccessor: Map<number, number>,
): Edge[] => {
  const edges = [];
  let nonStopV1Time = -1;
  let nonStopV1Node = -1;
  let nonStopV1TsId = -1;
  let previousTsId = -1;
  while (tsIterator.hasNext()) {
    tsIterator.next();
    const ts = tsIterator.current().trainrunSection;
    let tsId = ts.getId();
    const trainrunId = reverseIterator
      ? // Minus 1 so we don't conflate 0 with -0.
        -ts.getTrainrunId() - 1
      : ts.getTrainrunId();

    const reverseSection = tsIterator.current().node.getId() !== ts.getTargetNodeId();

    const v1Time = reverseSection
      ? ts.getTargetDepartureDto().consecutiveTime
      : ts.getSourceDepartureDto().consecutiveTime;
    const v1Node = reverseSection ? ts.getTargetNodeId() : ts.getSourceNodeId();
    // If we don't stop here, we need to remember where we started.
    if (reverseSection ? ts.getSourceNode().isNonStop(ts) : ts.getTargetNode().isNonStop(ts)) {
      if (nonStopV1Time === -1) {
        nonStopV1Time = v1Time;
        nonStopV1Node = v1Node;
        nonStopV1TsId = tsId;
      }
      continue;
    }
    let v1 = new Vertex(v1Node, true, v1Time, trainrunId, tsId);
    // If we didn't stop previously, we need to use the stored start.
    if (nonStopV1Time !== -1) {
      // Since we only store successors for the forward direction,
      // we need to keep a consistent section id in the reverse direction as well.
      if (reverseIterator) {
        tsId = nonStopV1TsId;
      }
      v1 = new Vertex(nonStopV1Node, true, nonStopV1Time, trainrunId, tsId);
      nonStopV1Time = -1;
    }
    const v2Time = reverseSection
      ? ts.getSourceArrivalDto().consecutiveTime
      : ts.getTargetArrivalDto().consecutiveTime;
    const v2Node = reverseSection ? ts.getSourceNodeId() : ts.getTargetNodeId();
    const v2 = new Vertex(v2Node, false, v2Time, trainrunId, tsId);

    for (let i = 0; i * ts.getTrainrun().getFrequency() < timeLimit; i++) {
      const newV1 = new Vertex(
        v1.nodeId,
        v1.isDeparture,
        v1.time + i * ts.getTrainrun().getFrequency(),
        v1.trainrunId,
        tsId,
      );
      const newV2 = new Vertex(
        v2.nodeId,
        v2.isDeparture,
        v2.time + i * ts.getTrainrun().getFrequency(),
        v2.trainrunId,
        tsId,
      );
      const edge = new Edge(newV1, newV2, newV2.time - newV1.time);
      edges.push(edge);
    }
    if (previousTsId !== -1 && !reverseIterator) {
      tsSuccessor.set(previousTsId, tsId);
    }
    previousTsId = tsId;
  }
  return edges;
};

const buildConvenienceEdges = (
  nodes: Node[],
  verticesDepartureByTrainrunByNode: Map<number, Map<string, Vertex[]>>,
  verticesArrivalByTrainrunByNode: Map<number, Map<string, Vertex[]>>,
): Edge[] => {
  const edges = [];
  nodes.forEach((node) => {
    const nodeId = node.getId();
    // We add a single start and end vertex for each node, so we can compute shortest paths more easily.
    const srcVertex = new Vertex(nodeId, true);
    const tgtVertex = new Vertex(nodeId, false);
    // Going from one node to itself is free.
    const edge = new Edge(srcVertex, tgtVertex, 0);
    edges.push(edge);
    const departuresByTrainrun = verticesDepartureByTrainrunByNode.get(nodeId);
    if (departuresByTrainrun !== undefined) {
      departuresByTrainrun.forEach((departures, trainrunId) => {
        departures.forEach((departure) => {
          const edge = new Edge(srcVertex, departure, 0);
          edges.push(edge);
        });
      });
    }
    const arrivalsByTrainrun = verticesArrivalByTrainrunByNode.get(nodeId);
    if (arrivalsByTrainrun !== undefined) {
      arrivalsByTrainrun.forEach((arrivals, trainrunId) => {
        arrivals.forEach((arrival) => {
          const edge = new Edge(arrival, tgtVertex, 0);
          edges.push(edge);
        });
      });
    }
  });
  return edges;
};

const buildConnectionEdges = (
  nodes: Node[],
  verticesDepartureByTrainrunByNode: Map<number, Map<string, Vertex[]>>,
  verticesArrivalByTrainrunByNode: Map<number, Map<string, Vertex[]>>,
  connectionPenalty: number,
  tsSuccessor: Map<number, number>,
): Edge[] => {
  const tsPredecessor = new Map<number, number>();
  tsSuccessor.forEach((v, k) => {
    tsPredecessor.set(v, k);
  });
  const edges = [];
  nodes.forEach((node) => {
    const departuresByTrainrun = verticesDepartureByTrainrunByNode.get(node.getId());
    const arrivalsByTrainrun = verticesArrivalByTrainrunByNode.get(node.getId());
    if (departuresByTrainrun !== undefined && arrivalsByTrainrun !== undefined) {
      arrivalsByTrainrun.forEach((arrivals, arrivalTrainrunId) => {
        const [arrivalTrId, arrivalTsId] = JSON.parse(arrivalTrainrunId);
        arrivals.forEach((arrival) => {
          departuresByTrainrun.forEach((departures, departureTrainrunId) => {
            let minDepartureTime = arrival.time;
            const [departureTrId, departureTsId] = JSON.parse(departureTrainrunId);
            let successor = tsSuccessor;
            if (arrivalTrId < 0) {
              successor = tsPredecessor;
            }
            const connection =
              arrivalTrId !== departureTrId || successor.get(arrivalTsId) !== departureTsId;
            if (connection) {
              minDepartureTime += node.getConnectionTime();
            }
            // For each arrival and for each trainrun available, we only want to consider the first departure.
            // This could be a binary search but it does not seem to be worth it.
            const departure = departures.find((departure) => {
              return departure.time >= minDepartureTime;
            });
            if (departure !== undefined) {
              let cost = departure.time - arrival.time;
              if (connection) {
                cost += connectionPenalty;
              }
              const edge = new Edge(arrival, departure, cost);
              edges.push(edge);
            }
          });
        });
      });
    }
  });
  return edges;
};

const depthFirstSearch = (
  graph: Map<string, [Vertex, number][]>,
  root: Vertex,
  visited: Set<string>,
  res: Vertex[],
  cachedKey: Map<Vertex, string>,
): void => {
  // Internal helpfer function to reduce the JSON key access complexity from cache
  const getKey = (v: Vertex): string => {
    let k = cachedKey.get(v);
    if (k === undefined) {
      k = JSON.stringify(v);
      cachedKey.set(v, k);
    }
    return k;
  };

  const rootKey = getKey(root);

  // mark the root
  visited.add(rootKey);

  // Stack frame for iterative DFS: vertex, its key, neighbors, next index
  type Frame = {
    vertex: Vertex;
    key: string;
    neighbors: [Vertex, number][] | undefined;
    idx: number;
  };
  const stack: Frame[] = [{vertex: root, key: rootKey, neighbors: graph.get(rootKey), idx: 0}];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];

    const nbrs = frame.neighbors;
    if (nbrs !== undefined && frame.idx < nbrs.length) {
      const [neighbor] = nbrs[frame.idx];
      frame.idx += 1; // next time continue with the next neighbor

      const neighborKey = getKey(neighbor);
      if (!visited.has(neighborKey)) {
        visited.add(neighborKey);
        stack.push({vertex: neighbor, key: neighborKey, neighbors: graph.get(neighborKey), idx: 0});
      }
      // if already visited, simply continue to the next neighbor
    } else {
      // all neighbors processed -> post-order like in the recursive original
      res.push(frame.vertex);
      stack.pop();
    }
  }
};
