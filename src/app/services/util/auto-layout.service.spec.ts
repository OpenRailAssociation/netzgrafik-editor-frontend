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
import {NetzgrafikUnitTesting} from "../../../integration-testing/netzgrafik.unit.testing";
import {ViewportCullService} from "../../services/ui/viewport.cull.service";
import {AutoLayoutService} from "./auto-layout.service";

describe("AutoLayoutService", () => {
  let dataService: DataService;
  let nodeService: NodeService;
  let resourceService: ResourceService;
  let trainrunService: TrainrunService;
  let trainrunSectionService: TrainrunSectionService;
  let baseDataService: BaseDataService;
  let noteService: NoteService;
  let nodes: Node[] = null;
  let trainrunSections: TrainrunSection[] = null;
  let logService: LogService = null;
  let logPublishersService: LogPublishersService = null;
  let labelGroupService: LabelGroupService = null;
  let labelService: LabelService = null;
  let filterService: FilterService = null;
  let netzgrafikColoringService: NetzgrafikColoringService = null;
  let uiInteractionService: UiInteractionService = null;
  let loadPerlenketteService: LoadPerlenketteService = null;
  let autoLayoutService: AutoLayoutService = null;

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
    nodeService.nodes.subscribe((updatesNodes) => (nodes = updatesNodes));
    trainrunSectionService.trainrunSections.subscribe(
      (updatesTrainrunSections) => (trainrunSections = updatesTrainrunSections),
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

    autoLayoutService = new AutoLayoutService(
      nodeService,
      trainrunSectionService,
      viewportCullService,
    );
  });

  it("should be created", () => {
    expect(autoLayoutService).toBeTruthy();
  });

  it("AutoLayoutService - callRobustAutomaticNodeLayouting moves node positions", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    const initialPositions = nodeService.getNodes().map((n) => ({
      id: n.getId(),
      x: n.getPositionX(),
      y: n.getPositionY(),
    }));

    expect(() => autoLayoutService.callRobustAutomaticNodeLayouting()).not.toThrow();

    // After the spring layout, at least one node's position should have changed
    const movedCount = nodeService.getNodes().filter((n) => {
      const init = initialPositions.find((p) => p.id === n.getId());
      return init && (n.getPositionX() !== init.x || n.getPositionY() !== init.y);
    }).length;

    expect(movedCount).toBeGreaterThan(0);
  });
});
