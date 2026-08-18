import {DataService} from "../../services/data/data.service";
import {NodeService} from "../../services/data/node.service";
import {ResourceService} from "../../services/data/resource.service";
import {TrainrunService} from "../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {BaseDataService} from "../../services/data/basedata.service";
import {NoteService} from "../../services/data/note.service";
import {Node} from "../../models/node.model";
import {LabelGroupService} from "../../services/data/labelgroup.service";
import {LabelService} from "../data/label.service";
import {NetzgrafikColoringService} from "../../services/data/netzgrafikColoring.service";
import {LogService} from "../../logger/log.service";
import {LogPublishersService} from "../../logger/log.publishers.service";
import {FilterService} from "../../services/ui/filter.service";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {LoadPerlenketteService} from "../../perlenkette/service/load-perlenkette.service";
import {NetzgrafikUnitTesting} from "../../../integration-testing/netzgrafik.unit.testing";
import {ViewportCullService} from "../../services/ui/viewport.cull.service";
import {PositionTransformationService} from "./position.transformation.service";
import {Vec2D} from "../../utils/vec2D";
import {Operation} from "../../models/operation.model";

describe("PositionTransformationService", () => {
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
  let uiInteractionService: UiInteractionService = null;
  let loadPerlenketteService: LoadPerlenketteService = null;
  let positionTransformationService: PositionTransformationService = null;

  beforeEach(() => {
    baseDataService = new BaseDataService();
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

    const viewportCullService = new ViewportCullService(
      uiInteractionService,
      nodeService,
      noteService,
      trainrunSectionService,
    );

    positionTransformationService = new PositionTransformationService(
      trainrunSectionService,
      nodeService,
      noteService,
      uiInteractionService,
      viewportCullService,
    );
  });

  it("PositionTransformationService test-001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const pos: Vec2D[] = [];
    nodeService.getNodes().forEach((n) => {
      pos.push(new Vec2D(n.getPositionX(), n.getPositionY()));
    });
    // no node is selected (default) - nothing changes
    positionTransformationService.alignSelectedElementsToRightBorder();
    positionTransformationService.alignSelectedElementsToLeftBorder();
    positionTransformationService.alignSelectedElementsToTopBorder();
    positionTransformationService.alignSelectedElementsToBottomBorder();
    nodeService.getNodes().forEach((n: Node, index: number) => {
      expect(n.getPositionX()).toBe(pos[index].getX());
      expect(n.getPositionY()).toBe(pos[index].getY());
    });
  });

  it("PositionTransformationService test-001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const pos: Vec2D[] = [];
    let minX = 100000;
    nodeService.getNodes().forEach((n) => {
      pos.push(new Vec2D(n.getPositionX(), n.getPositionY()));
      nodeService.selectNode(n.getId());
      minX = Math.min(n.getPositionX(), minX);
    });
    // all node are selected (default) - nothing changes
    positionTransformationService.alignSelectedElementsToLeftBorder();
    nodeService.getNodes().forEach((n: Node, index: number) => {
      expect(n.getPositionX()).toBe(minX);
      expect(n.getPositionY()).toBe(pos[index].getY());
    });
  });

  it("PositionTransformationService test-002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const pos: Vec2D[] = [];
    let minY = 100000;
    nodeService.getNodes().forEach((n) => {
      pos.push(new Vec2D(n.getPositionX(), n.getPositionY()));
      nodeService.selectNode(n.getId());
      minY = Math.min(n.getPositionY(), minY);
    });
    // all node are selected (default) - nothing changes
    positionTransformationService.alignSelectedElementsToTopBorder();
    nodeService.getNodes().forEach((n: Node, index: number) => {
      expect(n.getPositionX()).toBe(pos[index].getX());
      expect(n.getPositionY()).toBe(minY);
    });
  });

  it("PositionTransformationService test-003", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const operations: Operation[] = [];
    positionTransformationService.operation.subscribe((operation) => operations.push(operation));
    const pos: Vec2D[] = [];
    nodeService.getNodes().forEach((n) => {
      pos.push(new Vec2D(n.getPositionX(), n.getPositionY()));
    });
    // all node are selected (default) - nothing changes
    positionTransformationService.scaleNetzgrafikArea(2.0, new Vec2D(0.0, 0.0), "graphContainer");
    nodeService.getNodes().forEach((n: Node, index: number) => {
      expect(n.getPositionX()).toBe(pos[index].getX() * 2.0);
      expect(n.getPositionY()).toBe(pos[index].getY() * 2.0);
    });
    expect(operations.filter((operation) => operation.objectType === "node").length).toBe(
      nodeService.getNodes().length,
    );
    expect(operations.filter((operation) => operation.objectType === "note").length).toBe(
      noteService.getNotes().length,
    );
  });

  it("emits updates for each node scaled in a multiple selection", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const selectedNodes = nodeService.getNodes().slice(0, 2);
    const initialPositions = new Map(
      selectedNodes.map((node) => [node.getId(), [node.getPositionX(), node.getPositionY()]]),
    );
    selectedNodes.forEach((node) => nodeService.selectNode(node.getId()));
    const operations: Operation[] = [];
    positionTransformationService.operation.subscribe((operation) => operations.push(operation));

    positionTransformationService.scaleNetzgrafikArea(2.0, new Vec2D(0.0, 0.0), "graphContainer");

    const nodeOperations = operations.filter((operation) => operation.objectType === "node");
    expect(nodeOperations.map((operation) => operation.node.id)).toEqual(
      selectedNodes.map((node) => node.getId()),
    );
    nodeOperations.forEach((operation) => {
      expect([operation.node.positionX, operation.node.positionY]).not.toEqual(
        initialPositions.get(operation.node.id),
      );
    });
  });
});
