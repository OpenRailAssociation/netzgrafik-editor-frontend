import {DataService} from "../../../services/data/data.service";
import {NodeService} from "../../../services/data/node.service";
import {ResourceService} from "../../../services/data/resource.service";
import {TrainrunService} from "../../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../../services/data/trainrunsection.service";
import {BaseDataService} from "../../../services/data/basedata.service";
import {NoteService} from "../../../services/data/note.service";
import {LabelGroupService} from "../../../services/data/labelgroup.service";
import {LabelService} from "../../../services/data/label.service";
import {NetzgrafikColoringService} from "../../../services/data/netzgrafikColoring.service";
import {UndoService} from "../../../services/data/undo.service";
import {CopyService} from "../../../services/data/copy.service";
import {LogService} from "../../../logger/log.service";
import {LogPublishersService} from "../../../logger/log.publishers.service";
import {FilterService} from "../../../services/ui/filter.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {LoadPerlenketteService} from "../../../perlenkette/service/load-perlenkette.service";
import {NetzgrafikUnitTesting} from "../../../../integration-testing/netzgrafik.unit.testing";
import {EditorMainViewComponent} from "../editor-main-view.component";
import {EditorView} from "./editor.view";
import {getReducedCorridorColors, NodesView} from "./nodes.view";
import {LevelOfDetailService} from "../../../services/ui/level.of.detail.service";
import {ViewportCullService} from "../../../services/ui/viewport.cull.service";
import {PositionTransformationService} from "../../../services/util/position.transformation.service";
import {AutoLayoutService} from "../../../services/util/auto-layout.service";
import * as d3 from "d3";

describe("reduced corridor colors", () => {
  it("keeps a chain one color and distinguishes adjacent corridors", () => {
    const links = [
      {source: 1, target: 2},
      {source: 2, target: 3},
      {source: 3, target: 4},
      {source: 3, target: 5},
      {source: 2, target: 1},
    ];
    const colors = getReducedCorridorColors(links, new Set([2]));
    expect(colors.get("1:2")).toBe(colors.get("2:3"));
    expect(new Set([colors.get("2:3"), colors.get("3:4"), colors.get("3:5")]).size).toBe(3);
    expect(getReducedCorridorColors(links.slice().reverse(), new Set([2]))).toEqual(colors);
  });

  it("keeps an isolated cycle one color", () => {
    const colors = getReducedCorridorColors(
      [
        {source: 1, target: 2},
        {source: 2, target: 3},
        {source: 3, target: 1},
      ],
      new Set([1, 2, 3]),
    );
    expect(new Set(colors.values()).size).toBe(1);
    expect(colors.size).toBe(3);
  });
});

describe("Nodes-View", () => {
  let dataService: DataService;
  let nodeService: NodeService;
  let resourceService: ResourceService;
  let trainrunService: TrainrunService;
  let trainrunSectionService: TrainrunSectionService;
  let baseDataService: BaseDataService;
  let noteService: NoteService;
  let logService: LogService = null;
  let logPublishersService: LogPublishersService = null;
  let labelGroupService: LabelGroupService = null;
  let labelService: LabelService = null;
  let filterService: FilterService = null;
  let netzgrafikColoringService: NetzgrafikColoringService = null;
  let copyService: CopyService = null;
  let uiInteractionService: UiInteractionService = null;
  let loadPerlenketteService: LoadPerlenketteService = null;
  let undoService: UndoService = null;
  let editorView: EditorView = null;

  beforeEach(() => {
    baseDataService = new BaseDataService();
    resourceService = new ResourceService();
    logPublishersService = new LogPublishersService();
    logService = new LogService(logPublishersService);
    labelGroupService = new LabelGroupService();
    labelService = new LabelService(labelGroupService);
    filterService = new FilterService(labelService, labelGroupService);
    trainrunService = new TrainrunService(logService, labelService, filterService);
    trainrunSectionService = new TrainrunSectionService(trainrunService, filterService);
    nodeService = new NodeService(
      resourceService,
      trainrunService,
      trainrunSectionService,
      labelService,
      filterService,
    );
    noteService = new NoteService(labelService, filterService);
    netzgrafikColoringService = new NetzgrafikColoringService();
    dataService = new DataService(
      resourceService,
      nodeService,
      trainrunSectionService,
      trainrunService,
      baseDataService,
      noteService,
      labelService,
      labelGroupService,
      filterService,
      netzgrafikColoringService,
    );

    loadPerlenketteService = new LoadPerlenketteService(
      trainrunService,
      trainrunSectionService,
      nodeService,
      filterService,
    );

    uiInteractionService = new UiInteractionService(
      filterService,
      nodeService,
      noteService,
      baseDataService,
      trainrunSectionService,
      trainrunService,
      netzgrafikColoringService,
      loadPerlenketteService,
      dataService,
    );

    undoService = new UndoService(dataService, trainrunService, filterService);

    copyService = new CopyService(
      dataService,
      trainrunService,
      trainrunSectionService,
      nodeService,
      noteService,
      filterService,
      uiInteractionService,
      undoService,
    );

    const levelOfDetailService = new LevelOfDetailService(uiInteractionService);

    const viewportCullService = new ViewportCullService(
      uiInteractionService,
      nodeService,
      noteService,
      trainrunSectionService,
    );

    const positionTransformationService = new PositionTransformationService(
      trainrunSectionService,
      nodeService,
      noteService,
      uiInteractionService,
      viewportCullService,
    );

    const autoLayoutService = new AutoLayoutService(
      nodeService,
      uiInteractionService,
      trainrunService,
      trainrunSectionService,
      viewportCullService,
    );

    const controller = new EditorMainViewComponent(
      nodeService,
      trainrunSectionService,
      trainrunService,
      filterService,
      uiInteractionService,
      noteService,
      undefined,
      dataService,
      undoService,
      copyService,
      viewportCullService,
      levelOfDetailService,
      undefined,
      positionTransformationService,
      autoLayoutService,
    );

    new EditorView(
      controller,
      nodeService,
      trainrunService,
      trainrunSectionService,
      noteService,
      filterService,
      uiInteractionService,
      undoService,
      copyService,
      viewportCullService,
      levelOfDetailService,
      undefined,
      positionTransformationService,
      autoLayoutService,
    );

    controller.bindViewToServices();
    editorView = controller.editorView;
  });

  it("nodesView construction test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const nodesView = new NodesView(editorView);
    nodesView.createViewNodeDataObjects(nodeService.getNodes());
  });

  it("shows colored corridors without degree markers when only Z is enabled", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const middle = nodeService.getNodeFromId(1);
    const endingPort = middle
      .getPorts()
      .find((port) => middle.isEndNode(port.getTrainrunSection()));
    const otherPort = middle
      .getPorts()
      .find(
        (port) =>
          port.getOppositeNode(middle.getId()).getId() !==
          endingPort.getOppositeNode(middle.getId()).getId(),
      );
    middle.addTransition(
      endingPort,
      otherPort,
      endingPort.getTrainrunSection().getTrainrun(),
      true,
    );
    trainrunSectionService
      .getTrainrunSections()
      .forEach((section) => section.routeEdgeAndPlaceText());
    spyOn(editorView, "doCullCheckPositionsInViewport").and.returnValue(true);
    const svg = d3
      .select<HTMLDivElement, undefined>(document.createElement("div"))
      .selectAll<SVGSVGElement, undefined>("svg")
      .data([undefined])
      .join("svg");
    const nodesView = new NodesView(editorView);
    nodesView.setGroup(svg.append("g"));
    nodesView.setDegreeEdgeGroup(svg.append("g"));
    nodesView.setDegreeGroup(svg.append("g"));

    nodesView.displayNodes(nodeService.getNodes());
    const nodeCount = svg.selectAll("g.node").size();

    uiInteractionService.setShowCorridors(true);
    nodesView.displayNodes(nodeService.getNodes());
    expect(svg.selectAll(".corridor-paths path").size()).toBeGreaterThan(0);
    expect(svg.node().querySelector<SVGPathElement>(".corridor-paths path").style.stroke).not.toBe(
      "rgb(34, 34, 34)",
    );
    expect(svg.selectAll(".node-degree-overlay g").size()).toBe(0);
    expect(svg.selectAll("g.node").size()).toBe(nodeCount);

    uiInteractionService.setHideNodeDegreeTwo(true);
    nodesView.displayNodes(nodeService.getNodes());
    const hiddenCount = nodeService.getNodes().filter((node) => {
      const neighbors = new Set(
        node.getPorts().map((port) => port.getOppositeNode(node.getId()).getId()),
      );
      neighbors.delete(node.getId());
      return (
        neighbors.size === 2 &&
        node
          .getPorts()
          .every((port) =>
            node
              .getTransitions()
              .some(
                (transition) =>
                  transition.getPortId1() === port.getId() ||
                  transition.getPortId2() === port.getId(),
              ),
          )
      );
    }).length;
    expect(hiddenCount).toBeGreaterThan(0);
    expect(svg.selectAll("g.node").size()).toBe(nodeCount - hiddenCount);

    uiInteractionService.setShowNodeDegree(true);
    nodesView.displayNodes(nodeService.getNodes());
    expect(svg.selectAll("g.node").size()).toBe(nodeCount - hiddenCount);
    expect(svg.selectAll(".node-degree-overlay g").size()).toBeGreaterThan(0);

    uiInteractionService.setHideNodeDegreeTwo(false);
    nodesView.displayNodes(nodeService.getNodes());
    expect(svg.selectAll("g.node").size()).toBe(nodeCount);
    uiInteractionService.setShowNodeDegree(false);
    uiInteractionService.setShowCorridors(false);
    nodesView.displayNodes(nodeService.getNodes());
    expect(svg.selectAll(".corridor-paths path").size()).toBe(0);
  });
});
