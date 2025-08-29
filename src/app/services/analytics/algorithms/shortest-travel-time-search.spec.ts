import {DataService} from "../../data/data.service";
import {NodeService} from "../../data/node.service";
import {ResourceService} from "../../data/resource.service";
import {TrainrunService} from "../../data/trainrun.service";
import {TrainrunSectionService} from "../../data/trainrunsection.service";
import {StammdatenService} from "../../data/stammdaten.service";
import {NoteService} from "../../data/note.service";
import {Node} from "../../../models/node.model";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {LogService} from "../../../logger/log.service";
import {LogPublishersService} from "../../../logger/log.publishers.service";
import {LabelGroupService} from "../../data/labelgroup.service";
import {LabelService} from "../../data/label.service";
import {NetzgrafikUnitTesting} from "../../../../integration-testing/netzgrafik.unit.testing";
import {AnalyticsService} from "../analytics.service";
import {FilterService} from "../../ui/filter.service";
import {ShortestDistanceNode} from "./shortest-distance-node";
import {ShortestDistanceEdge} from "./shortest-distance-edge";
import {NetzgrafikColoringService} from "../../data/netzgrafikColoring.service";

describe("ShortestTravelTimeSearch", () => {
  let dataService: DataService;
  let nodeService: NodeService;
  let resourceService: ResourceService;
  let trainrunService: TrainrunService;
  let trainrunSectionService: TrainrunSectionService;
  let stammdatenService: StammdatenService;
  let noteService: NoteService;
  let nodes: Node[] = null;
  let trainrunSections: TrainrunSection[] = null;
  let logService: LogService = null;
  let logPublishersService: LogPublishersService = null;
  let labelGroupService: LabelGroupService = null;
  let labelService: LabelService = null;
  let analyticsService: AnalyticsService = null;
  let filterService: FilterService = null;
  let netzgrafikColoringService: NetzgrafikColoringService = null;

  beforeEach(() => {
    stammdatenService = new StammdatenService();
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
    noteService = new NoteService(logService, labelService, filterService);
    analyticsService = new AnalyticsService(
      nodeService,
      trainrunSectionService,
      trainrunService,
      filterService,
    );
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
    nodeService.nodes.subscribe((updatesNodes) => (nodes = updatesNodes));

    nodeService.nodes.subscribe((updatesNodes) => (nodes = updatesNodes));
    trainrunSectionService.trainrunSections.subscribe(
      (updatesTrainrunSections) => (trainrunSections = updatesTrainrunSections),
    );
  });

  it("ShortestDistanceEdge", () => {
    const node1 = new Node();
    const node2 = new Node();
    const edge: ShortestDistanceEdge = new ShortestDistanceEdge(node1, node2, 19, 78, []);
    expect(edge.getFromNode().getId()).toBe(node1.getId());
    expect(edge.getToNode().getId()).toBe(node2.getId());
    expect(edge.getArrivalTime()).toBe(78);
    expect(edge.getFromNodeDepartingTrainrunSection()).toBe(undefined);
    expect(edge.getFullDistance()).toBe(59);
  });

  it("ShortestDistanceEdge - 2", () => {
    const node1 = new Node();
    const node2 = new Node();
    const ts = new TrainrunSection();
    const edge: ShortestDistanceEdge = new ShortestDistanceEdge(node1, node2, 19, 78, [ts]);
    expect(edge.getFromNode().getId()).toBe(node1.getId());
    expect(edge.getToNode().getId()).toBe(node2.getId());
    expect(edge.getArrivalTime()).toBe(78);
    expect(edge.getFromNodeDepartingTrainrunSection().getId()).toBe(ts.getId());
    expect(edge.getFullDistance()).toBe(59);
  });

  it("Search shortest distance nodes: Starting trainrun section (ZUE -> OL)", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    expect(trainrunSections.length).toBe(8);

    let shortestDistancenodeData: ShortestDistanceNode[] = [];
    analyticsService.shortestDistanceNode.subscribe((data) => (shortestDistancenodeData = data));
    analyticsService.calculateShortestDistanceNodesFromStartingTrainrunSection(1, 2);
    shortestDistancenodeData.forEach((sdn) => {
      switch (sdn.node.getId()) {
        case 0:
          if (sdn !== undefined) {
            expect(sdn.node.getBetriebspunktName()).toBe("BN");
            expect(sdn.distance).toBe(22);
          }
          break;
        case 1:
          if (sdn !== undefined) {
            expect(sdn.node.getBetriebspunktName()).toBe("OL");
            expect(sdn.distance).toBe(10);
          }
          break;
        case 2:
          if (sdn !== undefined) {
            expect(sdn.node.getBetriebspunktName()).toBe("ZUE");
            expect(sdn.distance).toBe(0);
          }
          break;
        case 3:
          if (sdn !== undefined) {
            expect(sdn.node.getBetriebspunktName()).toBe("SG");
            expect("not reachable").toBe(
              "this is a bug in the method, should no occur in the ShortestDistanceNode[]",
            );
          }
          break;
        case 4:
          if (sdn !== undefined) {
            expect(sdn.node.getBetriebspunktName()).toBe("CH");
            expect("not reachable").toBe(
              "this is a bug in the method, should no occur in the ShortestDistanceNode[]",
            );
          }
          break;
      }
    });

    expect(shortestDistancenodeData.length === nodes.length);
  });

  it("Search shortest distance nodes: Starting Node: BN", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    expect(trainrunSections.length).toBe(8);

    let shortestDistancenodeData: ShortestDistanceNode[] = [];
    analyticsService.shortestDistanceNode.subscribe((data) => (shortestDistancenodeData = data));
    analyticsService.calculateShortestDistanceNodesFromStartingNode(0);

    shortestDistancenodeData.forEach((sdn) => {
      switch (sdn.node.getId()) {
        case 0:
          expect(sdn.node.getBetriebspunktName()).toBe("BN");
          expect(sdn.distance).toBe(0);
          break;
        case 1:
          expect(sdn.node.getBetriebspunktName()).toBe("OL");
          expect(sdn.distance).toBe(10);
          break;
        case 2:
          expect(sdn.node.getBetriebspunktName()).toBe("ZUE");
          expect(sdn.distance).toBe(22);
          break;
        case 4:
          expect(sdn.node.getBetriebspunktName()).toBe("CH");
          expect(sdn.distance).toBe(60);
          break;
        case 3:
          expect(sdn.node.getBetriebspunktName()).toBe("SG");
          expect(sdn.distance).toBe(81);
          break;
      }
    });

    expect(shortestDistancenodeData.length === nodes.length);
  });

  it("Search shortest distance nodes: Starting Node: BN with filtering", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    expect(trainrunSections.length).toBe(8);

    filterService.resetFilterTrainrunCategory();
    filterService.disableFilterTrainrunCategory(dataService.getTrainrunCategory(1));
    filterService.disableFilterTrainrunCategory(dataService.getTrainrunCategory(3));

    let shortestDistancenodeData: ShortestDistanceNode[] = [];
    analyticsService.shortestDistanceNode.subscribe((data) => (shortestDistancenodeData = data));
    analyticsService.calculateShortestDistanceNodesFromStartingNode(0);
    shortestDistancenodeData.forEach((sdn) => {
      switch (sdn.node.getId()) {
        case 0:
          if (sdn !== undefined) {
            expect(sdn.node.getBetriebspunktName()).toBe("BN");
            expect(sdn.distance).toBe(0);
          }
          break;
        case 1:
          if (sdn !== undefined) {
            expect(sdn.node.getBetriebspunktName()).toBe("OL");
            expect(sdn.distance).toBe(75);
          }
          break;
        case 2:
          if (sdn !== undefined) {
            expect(sdn.node.getBetriebspunktName()).toBe("ZUE");
            expect(sdn.distance).toBe(49);
          }
          break;
        case 3:
          if (sdn !== undefined) {
            expect(sdn.node.getBetriebspunktName()).toBe("SG");
            expect(sdn.distance).toBe(101);
          }
          break;
        case 4:
          if (sdn !== undefined) {
            expect(sdn.node.getBetriebspunktName()).toBe("CH");
            expect("not reachable").toBe(
              "this is a bug in the method, should no occur in the ShortestDistanceNode[]",
            );
          }
          break;
      }
    });

    expect(shortestDistancenodeData.length === nodes.length);
  });
});
