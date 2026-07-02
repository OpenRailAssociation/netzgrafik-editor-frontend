import {DataService} from "../../services/data/data.service";
import {NodeService} from "../../services/data/node.service";
import {ResourceService} from "../../services/data/resource.service";
import {TrainrunService} from "../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {BaseDataService} from "../../services/data/basedata.service";
import {NoteService} from "../../services/data/note.service";
import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {LabelGroupService} from "../../services/data/labelgroup.service";
import {LabelService} from "../data/label.service";
import {NetzgrafikColoringService} from "../../services/data/netzgrafikColoring.service";
import {LogService} from "../../logger/log.service";
import {LogPublishersService} from "../../logger/log.publishers.service";
import {FilterService} from "../../services/ui/filter.service";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {LoadPerlenketteService} from "../../perlenkette/service/load-perlenkette.service";
import {ViewportCullService} from "../../services/ui/viewport.cull.service";
import {AutoLayoutService} from "./auto-layout.service";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {Vec2D} from "src/app/utils/vec2D";

interface TestPoint {
  getX(): number;
  getY(): number;
}

describe("AutoLayoutService", () => {
  let dataService: DataService;
  let nodeService: NodeService;
  let resourceService: ResourceService;
  let trainrunService: TrainrunService;
  let trainrunSectionService: TrainrunSectionService;
  let baseDataService: BaseDataService;
  let noteService: NoteService;
  let logService: LogService;
  let logPublishersService: LogPublishersService;
  let labelGroupService: LabelGroupService;
  let labelService: LabelService;
  let filterService: FilterService;
  let netzgrafikColoringService: NetzgrafikColoringService;
  let uiInteractionService: UiInteractionService;
  let loadPerlenketteService: LoadPerlenketteService;
  let viewportCullService: ViewportCullService;
  let autoLayoutService: AutoLayoutService;

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
    netzgrafikColoringService = new NetzgrafikColoringService(logService);

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

    viewportCullService = new ViewportCullService(
      uiInteractionService,
      nodeService,
      noteService,
      trainrunSectionService,
    );

    autoLayoutService = new AutoLayoutService(
      nodeService,
      uiInteractionService,
      trainrunService,
      trainrunSectionService,
      viewportCullService,
    );
  });

  it("should stretch a short horizontal section by moving nodes apart", () => {
    const sourceNode = createNode("source", "A", 0, 0, PortAlignment.Right);
    const targetNode = createNode("target", "B", 100, 0, PortAlignment.Left);

    const section = createSection(sourceNode, targetNode, point(50, 25), point(100, 25));

    prepareLayoutTest([sourceNode, targetNode], [section]);

    autoLayoutService.adjustSectionLengths([section], true, 1);

    const moveCalls = getMoveCalls();

    expect(moveCalls.length).toBe(2);

    const sourceMove = getMoveCallForNode(moveCalls, "source");
    const targetMove = getMoveCallForNode(moveCalls, "target");

    expect(sourceMove).toBeTruthy();
    expect(targetMove).toBeTruthy();

    expect(sourceMove[1]).toBeLessThan(0);
    expect(sourceMove[2]).toBe(0);

    expect(targetMove[1]).toBeGreaterThan(100);
    expect(targetMove[2]).toBe(0);
  });

  it("should skip long sections during global stretch", () => {
    const sourceNode = createNode("source", "A", 0, 0, PortAlignment.Right);
    const targetNode = createNode("target", "B", 300, 0, PortAlignment.Left);

    const section = createSection(sourceNode, targetNode, point(50, 25), point(350, 25));

    prepareLayoutTest([sourceNode, targetNode], [section]);

    autoLayoutService.adjustSectionLengths([section], true, 1);

    expect(nodeService.changeNodePositionWithoutUpdate).not.toHaveBeenCalled();
    expect(section.routeEdgeAndPlaceText).toHaveBeenCalled();
    expect(viewportCullService.onViewportChangeUpdateRendering).toHaveBeenCalledWith(true);
  });

  it("should not shrink a section below the minimum section length", () => {
    const sourceNode = createNode("source", "A", 0, 0, PortAlignment.Right);
    const targetNode = createNode("target", "B", 200, 0, PortAlignment.Left);

    const section = createSection(sourceNode, targetNode, point(50, 25), point(250, 25));

    prepareLayoutTest([sourceNode, targetNode], [section]);

    autoLayoutService.adjustSectionLengths([section], false, -1);

    expect(nodeService.changeNodePositionWithoutUpdate).not.toHaveBeenCalled();
  });

  function prepareLayoutTest(nodes: Node[], sections: TrainrunSection[]): void {
    spyOn(nodeService, "getNodes").and.returnValue(nodes);
    spyOn(trainrunSectionService, "getTrainrunSections").and.returnValue(sections);
    spyOn(nodeService, "changeNodePositionWithoutUpdate").and.stub();
    spyOn(nodeService, "initPortOrdering").and.stub();
    spyOn(viewportCullService, "onViewportChangeUpdateRendering").and.stub();

    spyOn(uiInteractionService, "findClosestNodeToViewCenter").and.returnValue({
      node: undefined,
      offset: new Vec2D(0, 0),
    });

    spyOn(uiInteractionService, "gotoNode").and.stub();
  }

  function createNode(
    id: string,
    name: string,
    x: number,
    y: number,
    portAlignment: PortAlignment,
  ): Node {
    return {
      getId: () => id,
      getPositionX: () => x,
      getPositionY: () => y,
      getNodeWidth: () => 50,
      getNodeHeight: () => 50,
      getBetriebspunktName: () => name,
      getPort: () => ({
        getPositionAlignment: () => portAlignment,
      }),
    } as unknown as Node;
  }

  function createSection(
    sourceNode: Node,
    targetNode: Node,
    sourcePosition: TestPoint,
    targetPosition: TestPoint,
  ): TrainrunSection {
    return {
      isPathInvalid: jasmine.createSpy("isPathInvalid").and.returnValue(false),
      getSourceNode: () => sourceNode,
      getTargetNode: () => targetNode,
      getSourcePortId: () => "source-port",
      getTargetPortId: () => "target-port",
      getPositionAtSourceNode: () => sourcePosition,
      getPositionAtTargetNode: () => targetPosition,
      routeEdgeAndPlaceText: jasmine.createSpy("routeEdgeAndPlaceText"),
    } as unknown as TrainrunSection;
  }

  function point(x: number, y: number): TestPoint {
    return {
      getX: () => x,
      getY: () => y,
    };
  }

  function getMoveCalls(): Array<[string, number, number, boolean, boolean]> {
    return (nodeService.changeNodePositionWithoutUpdate as jasmine.Spy).calls.allArgs() as Array<
      [string, number, number, boolean, boolean]
    >;
  }

  function getMoveCallForNode(
    calls: Array<[string, number, number, boolean, boolean]>,
    nodeId: string,
  ): [string, number, number, boolean, boolean] | undefined {
    return calls.find((call) => call[0] === nodeId);
  }
});
