import {LogPublishersService} from "src/app/logger/log.publishers.service";
import {LogService} from "src/app/logger/log.service";
import {DataService} from "src/app/services/data/data.service";
import {LabelService} from "src/app/services/data/label.service";
import {LabelGroupService} from "src/app/services/data/labelgroup.service";
import {NetzgrafikColoringService} from "src/app/services/data/netzgrafikColoring.service";
import {NodeService} from "src/app/services/data/node.service";
import {NoteService} from "src/app/services/data/note.service";
import {ResourceService} from "src/app/services/data/resource.service";
import {StammdatenService} from "src/app/services/data/stammdaten.service";
import {TrainrunService} from "src/app/services/data/trainrun.service";
import {TrainrunSectionService} from "src/app/services/data/trainrunsection.service";
import {FilterService} from "src/app/services/ui/filter.service";
import {
  buildEdges,
  computeNeighbors,
  computeShortestPaths,
  Edge,
  topoSort,
  Vertex,
} from "src/app/view/util/origin-destination-graph";
import {NetzgrafikUnitTestingOdMatrix} from "./netzgrafik.unit.testing.od.matrix";

describe("Origin Destination CSV Test", () => {
  let dataService: DataService = null;
  let resourceService: ResourceService = null;
  let nodeService: NodeService = null;
  let logService: LogService = null;
  let logPublishersService: LogPublishersService = null;
  let trainrunService: TrainrunService = null;
  let labelService: LabelService = null;
  let labelGroupService: LabelGroupService = null;
  let filterService: FilterService = null;
  let trainrunSectionService: TrainrunSectionService = null;
  let stammdatenService: StammdatenService = null;
  let noteService: NoteService = null;
  let netzgrafikColoringService: NetzgrafikColoringService = null;

  beforeEach(() => {
    resourceService = new ResourceService();
    logPublishersService = new LogPublishersService();
    logService = new LogService(logPublishersService);
    labelGroupService = new LabelGroupService(logService);
    labelService = new LabelService(logService, labelGroupService);
    filterService = new FilterService(labelService, labelGroupService);
    trainrunService = new TrainrunService(logService, labelService, filterService);
    trainrunSectionService = new TrainrunSectionService(logService, trainrunService, filterService);
    nodeService = new NodeService(
      logService,
      resourceService,
      trainrunService,
      trainrunSectionService,
      labelService,
      filterService,
    );
    stammdatenService = new StammdatenService();
    noteService = new NoteService(logService, labelService, filterService);
    netzgrafikColoringService = new NetzgrafikColoringService(logService);
    dataService = new DataService(
      resourceService,
      nodeService,
      trainrunSectionService,
      trainrunService,
      stammdatenService,
      noteService,
      labelService,
      labelGroupService,
      filterService,
      netzgrafikColoringService,
    );
    dataService.loadNetzgrafikDto(NetzgrafikUnitTestingOdMatrix.getUnitTestNetzgrafik());
  });

  it("simple test", () => {
    // select nodes [15..17]
    for (let i = 15; i <= 17; i++) {
      nodeService.selectNode(i);
    }
    const nodes = nodeService.getNodes();
    const odNodes = nodeService.getSelectedNodes();
    const trainruns = trainrunService.getTrainruns();
    const connectionPenalty = 5;
    const timeLimit = 60 * 10;

    const start = new Date().getTime();
    const [edges, tsSuccessor] = buildEdges(
      nodes,
      odNodes,
      trainruns,
      connectionPenalty,
      trainrunService,
      timeLimit,
    );

    const neighbors = computeNeighbors(edges);
    const vertices = topoSort(neighbors);

    const res = new Map<string, [number, number]>();
    nodes.forEach((origin) => {
      computeShortestPaths(origin.getId(), neighbors, vertices, tsSuccessor).forEach(
        (value, key) => {
          res.set([origin.getId(), key].join(","), value);
        },
      );
    });
    const end = new Date().getTime();

    // See https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/199
    expect(res).toEqual(
      new Map([
        // Making sure we traverse E <- F -> G correctly.
        ["15,17", [4, 0]],
        ["15,16", [1, 0]],
        ["16,15", [1, 0]],
        ["16,17", [1, 0]],
        ["17,15", [4, 0]],
        ["17,16", [1, 0]],
      ]),
    );
    // This should be reasonably fast, likely less than 10ms.
    expect(end - start).toBeLessThan(100);
  });

  it("use connection for optimal travel time", () => {
    // select nodes [1,2,4,7]
    nodeService.selectNode(1);
    nodeService.selectNode(2);
    nodeService.selectNode(4);
    nodeService.selectNode(7);
    const nodes = nodeService.getNodes();
    const odNodes = nodeService.getSelectedNodes();
    const trainruns = trainrunService.getTrainruns();
    const connectionPenalty = 5;
    const timeLimit = 60 * 10;

    const start = new Date().getTime();
    const [edges, tsSuccessor] = buildEdges(
      nodes,
      odNodes,
      trainruns,
      connectionPenalty,
      trainrunService,
      timeLimit,
    );

    const neighbors = computeNeighbors(edges);
    const vertices = topoSort(neighbors);

    const res = new Map<string, [number, number]>();
    nodes.forEach((origin) => {
      computeShortestPaths(origin.getId(), neighbors, vertices, tsSuccessor).forEach(
        (value, key) => {
          res.set([origin.getId(), key].join(","), value);
        },
      );
    });
    const end = new Date().getTime();

    // See https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/199
    expect(res).toEqual(
      new Map([
        // Making sure we consider connections in H -> I -> J -> I -> K.
        ["1,7", [1, 0]],
        ["1,2", [1, 0]],
        ["1,4", [1, 0]],
        ["2,7", [15, 1]],
        ["2,4", [4, 0]],
        ["2,1", [1, 0]],
        ["4,7", [8, 0]],
        ["4,2", [4, 0]],
        ["4,1", [1, 0]],
        ["7,2", [15, 1]],
        ["7,4", [8, 0]],
        ["7,1", [1, 0]],
        // TODO: ideally we would test L -> M -> Non-stop -> O works well in both directions.
      ]),
    );
    // This should be reasonably fast, likely less than 10ms.
    expect(end - start).toBeLessThan(100);
  });

  it("trainruns with different frequences", () => {
    // select nodes [11..14]
    for (let i = 11; i <= 14; i++) {
      nodeService.selectNode(i);
    }
    const nodes = nodeService.getNodes();
    const odNodes = nodeService.getSelectedNodes();
    const trainruns = trainrunService.getTrainruns();
    const connectionPenalty = 5;
    const timeLimit = 60 * 10;

    const start = new Date().getTime();
    const [edges, tsSuccessor] = buildEdges(
      nodes,
      odNodes,
      trainruns,
      connectionPenalty,
      trainrunService,
      timeLimit,
    );

    const neighbors = computeNeighbors(edges);
    const vertices = topoSort(neighbors);

    const res = new Map<string, [number, number]>();
    nodes.forEach((origin) => {
      computeShortestPaths(origin.getId(), neighbors, vertices, tsSuccessor).forEach(
        (value, key) => {
          res.set([origin.getId(), key].join(","), value);
        },
      );
    });
    const end = new Date().getTime();

    // See https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/199
    expect(res).toEqual(
      new Map([
        ["11,13", [22, 1]],
        ["11,14", [6, 0]],
        ["11,12", [4, 0]],
        ["12,13", [2, 0]],
        ["12,14", [2, 0]],
        ["12,11", [4, 0]],
        ["13,14", [29, 1]],
        ["13,11", [22, 1]],
        ["13,12", [2, 0]],
        ["14,13", [29, 1]],
        ["14,11", [6, 0]],
        ["14,12", [2, 0]],
      ]),
    );
    // This should be reasonably fast, likely less than 10ms.
    expect(end - start).toBeLessThan(100);
  });

  it("integration test with selected nodes", () => {
    // select nodes [13..14]
    for (let i = 13; i <= 14; i++) {
      nodeService.selectNode(i);
    }
    const nodes = nodeService.getNodes();
    const odNodes = nodeService.getSelectedNodes();
    const trainruns = trainrunService.getTrainruns();
    const connectionPenalty = 5;
    const timeLimit = 60 * 10;

    const [edges, tsSuccessor] = buildEdges(
      nodes,
      odNodes,
      trainruns,
      connectionPenalty,
      trainrunService,
      timeLimit,
    );

    const neighbors = computeNeighbors(edges);
    const vertices = topoSort(neighbors);

    const res = new Map<string, [number, number]>();
    nodes.forEach((origin) => {
      computeShortestPaths(origin.getId(), neighbors, vertices, tsSuccessor).forEach(
        (value, key) => {
          res.set([origin.getId(), key].join(","), value);
        },
      );
    });

    // See https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/199
    expect(res).toEqual(
      new Map([
        ["13,14", [29, 1]],
        ["14,13", [29, 1]],
      ]),
    );
  });

  it("simple path unit test", () => {
    const v1 = new Vertex(0, true);
    const v2 = new Vertex(0, true, 0, 0, 0);
    const v3 = new Vertex(1, false, 15, 0, 0);
    const v4 = new Vertex(1, false);
    const e1 = new Edge(v1, v2, 0);
    const e2 = new Edge(v2, v3, 15);
    const e3 = new Edge(v3, v4, 0);
    const edges = [e1, e2, e3];
    const tsSuccessor = new Map<number, number>();

    const neighbors = computeNeighbors(edges);

    // v4 has no outgoing edges.
    expect(neighbors).toHaveSize(3);
    expect(neighbors.get(v1)).toHaveSize(1);
    expect(neighbors.get(v1)).toContain([v2, 0]);
    expect(neighbors.get(v2)).toHaveSize(1);
    expect(neighbors.get(v2)).toContain([v3, 15]);
    expect(neighbors.get(v3)).toHaveSize(1);
    expect(neighbors.get(v3)).toContain([v4, 0]);

    const topoVertices = topoSort(neighbors);

    expect(topoVertices).toHaveSize(4);
    edges.forEach((edge) => {
      const v1Index = topoVertices.findIndex((value, index, obj) => {
        return value === edge.v1;
      });
      const v2Index = topoVertices.findIndex((value, index, obj) => {
        return value === edge.v2;
      });
      expect(v1Index).toBeLessThan(v2Index);
    });

    const distances0 = computeShortestPaths(0, neighbors, topoVertices, tsSuccessor);

    expect(distances0).toHaveSize(1);
    expect(distances0.get(1)).toEqual([15, 0]);
  });

  it("connection unit test", () => {
    // trainrun 0
    const v1 = new Vertex(0, true);
    const v2 = new Vertex(0, true, 0, 0, 0);
    const v3 = new Vertex(1, false, 15, 0, 0);
    const v4 = new Vertex(1, true, 16, 0, 1);
    const v5 = new Vertex(2, false, 30, 0, 1);
    const v6 = new Vertex(2, false);
    const e1 = new Edge(v1, v2, 0);
    const e2 = new Edge(v2, v3, 15);
    const e3 = new Edge(v3, v4, 1);
    const e4 = new Edge(v4, v5, 14);
    const e5 = new Edge(v5, v6, 0);
    // trainrun 1
    const v7 = new Vertex(3, true);
    const v8 = new Vertex(3, true, 0, 1, 2);
    const v9 = new Vertex(1, false, 10, 1, 2);
    const e6 = new Edge(v7, v8, 0);
    const e7 = new Edge(v8, v9, 10);
    // connection
    const e8 = new Edge(v9, v4, 6 + 5);
    // convenience
    const v10 = new Vertex(1, false);
    const e9 = new Edge(v3, v10, 0);
    const e10 = new Edge(v9, v10, 0);
    const v11 = new Vertex(1, true);
    const e11 = new Edge(v11, v4, 0);
    const edges = [e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11];
    const tsSuccessor = new Map<number, number>([[0, 1]]);

    const neighbors = computeNeighbors(edges);
    expect(neighbors).toHaveSize(9);
    expect(neighbors.get(v1)).toHaveSize(1);
    expect(neighbors.get(v2)).toHaveSize(1);
    expect(neighbors.get(v3)).toHaveSize(2);
    expect(neighbors.get(v4)).toHaveSize(1);
    expect(neighbors.get(v5)).toHaveSize(1);
    expect(neighbors.get(v7)).toHaveSize(1);
    expect(neighbors.get(v8)).toHaveSize(1);
    expect(neighbors.get(v9)).toHaveSize(2);
    expect(neighbors.get(v11)).toHaveSize(1);

    const topoVertices = topoSort(neighbors);
    expect(topoVertices).toHaveSize(11);
    edges.forEach((edge) => {
      const v1Index = topoVertices.findIndex((value, index, obj) => {
        return value === edge.v1;
      });
      const v2Index = topoVertices.findIndex((value, index, obj) => {
        return value === edge.v2;
      });
      expect(v1Index).toBeLessThan(v2Index);
    });

    const distances0 = computeShortestPaths(0, neighbors, topoVertices, tsSuccessor);
    expect(distances0).toHaveSize(2);
    expect(distances0.get(1)).toEqual([15, 0]);
    expect(distances0.get(2)).toEqual([30, 0]);

    const distances1 = computeShortestPaths(1, neighbors, topoVertices, tsSuccessor);
    expect(distances1).toHaveSize(1);
    expect(distances1.get(2)).toEqual([14, 0]);

    const distances3 = computeShortestPaths(3, neighbors, topoVertices, tsSuccessor);
    expect(distances3).toHaveSize(2);
    expect(distances3.get(1)).toEqual([10, 0]);
    // connection
    expect(distances3.get(2)).toEqual([30 + 5, 1]);
  });

  it("round trips and one-ways test", () => {
    // select nodes [18..26]
    for (let i = 18; i <= 26; i++) {
      nodeService.selectNode(i);
    }
    const nodes = nodeService.getNodes();
    const odNodes = nodeService.getSelectedNodes();
    const trainruns = trainrunService.getTrainruns();
    const connectionPenalty = 5;
    const timeLimit = 60 * 10;

    const [edges, tsSuccessor] = buildEdges(
      nodes,
      odNodes,
      trainruns,
      connectionPenalty,
      trainrunService,
      timeLimit,
    );

    const neighbors = computeNeighbors(edges);
    const vertices = topoSort(neighbors);

    const res = new Map<string, [number, number]>();
    nodes.forEach((origin) => {
      computeShortestPaths(origin.getId(), neighbors, vertices, tsSuccessor).forEach(
        (value, key) => {
          res.set([origin.getId(), key].join(","), value);
        },
      );
    });

    expect(res).toEqual(
      new Map([
        // both trainrun are round trips
        ["18,20", [66, 1]],
        ["18,19", [5, 0]],
        ["19,20", [1, 0]],
        ["19,18", [5, 0]],
        ["20,18", [66, 1]],
        ["20,19", [1, 0]],
        // one trainrun is round trip, the other one-way (22->23)
        ["21,23", [66, 1]],
        ["21,22", [5, 0]],
        ["22,23", [1, 0]],
        ["22,21", [5, 0]],
        // one trainrun is round trip, the other one-way (25<-26)
        ["24,25", [5, 0]],
        ["25,24", [5, 0]],
        ["26,24", [66, 1]],
        ["26,25", [1, 0]],
      ]),
    );
  });
});
