import {NodeService} from "../services/data/node.service";
import {TrainrunSectionService} from "../services/data/trainrunsection.service";
import {TrainrunSection} from "../models/trainrunsection.model";
import {Node} from "../models/node.model";

export class MultiSelectNodeGraph {
  private adjList = new Map();

  constructor(
    readonly nodeService: NodeService,
    readonly trainrunSectionService: TrainrunSectionService,
  ) {
    this.adjList = new Map();
  }

  addVertex(v) {
    this.adjList.set(v, []);
  }

  addEdge(v, e) {
    this.adjList.get(v).push(e);
  }

  createAdjList(edgeList) {
    edgeList.forEach((edge) => {
      this.addVertex(edge[0]);
      this.addVertex(edge[1]);
    });

    edgeList.forEach((edge) => {
      this.addEdge(edge[0], edge[1]);
      this.addEdge(edge[1], edge[0]);
    });
  }

  vertexDegree(v): number {
    return this.adjList.get(v).length;
  }

  getStartEndingVertices() {
    const startPathVertices = [];
    for (const node of this.adjList.keys()) {
      if (this.vertexDegree(node) === 1) {
        startPathVertices.push(node);
      }
    }
    return startPathVertices;
  }

  getPath(start, end, visited = {}, retPath = []) {
    retPath.push(this.nodeService.getNodeFromId(start));
    // base condition
    if (start === end) {
      return {path: retPath, end: true};
    }

    visited[start] = true;
    const childrens = this.adjList.get(start);
    if (childrens === undefined) {
      return {path: retPath, end: false};
    }
    for (const node of childrens) {
      if (!visited[node]) {
        const result = this.getPath(node, end, {...visited}, Object.assign([], retPath));
        if (result.end) {
          return {path: result.path, end: true};
        }
      }
    }
    return {path: retPath, end: false};
  }

  convertNetzgrafikSubNodesToGraph(nodes: Node[]): any[] {
    const edgeList = [];

    // retrieve edges
    nodes.forEach((node1) => {
      nodes.forEach((node2) => {
        const n1 = node1.getId() < node2.getId() ? node1.getId() : node2.getId();
        const n2 = node1.getId() < node2.getId() ? node2.getId() : node1.getId();
        const ts12 = this.trainrunSectionService
          .getTrainrunSections()
          .filter(
            (ts: TrainrunSection) => ts.getSourceNodeId() === n1 && ts.getTargetNodeId() === n2,
          );
        if (ts12.length > 0) {
          const meanTravelTime =
            ts12.reduce((sum, obj) => sum + obj.getTravelTime(), 0) / ts12.length;
          if (edgeList.find((a) => a[0] === n1 && a[1] === n2) === undefined) {
            edgeList.push([n1, n2, meanTravelTime]);
          }
        } else {
          const ts21 = this.trainrunSectionService
            .getTrainrunSections()
            .filter(
              (ts: TrainrunSection) => ts.getSourceNodeId() === n2 && ts.getTargetNodeId() === n1,
            );
          if (ts21.length > 0) {
            const meanTravelTime =
              ts21.reduce((sum, obj) => sum + obj.getTravelTime(), 0) / ts21.length;
            if (edgeList.find((a) => a[0] === n2 && a[1] === n1) === undefined) {
              edgeList.push([n2, n1, meanTravelTime]);
            }
          }
        }
      });
    });

    // insert all edges (graph)
    this.createAdjList(edgeList);
    const ret = [];
    edgeList.forEach((e) => {
      ret.push({
        from: e[0],
        to: e[1],
        meanTravelTime: e[2],
      });
    });
    return ret;
  }
}
