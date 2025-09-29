import {DataService} from "../data/data.service";
import {NodeService} from "../data/node.service";
import {ResourceService} from "../data/resource.service";
import {TrainrunService} from "../data/trainrun.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {StammdatenService} from "../data/stammdaten.service";
import {NoteService} from "../data/note.service";
import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {LogService} from "../../logger/log.service";
import {LogPublishersService} from "../../logger/log.publishers.service";
import {LabelGroupService} from "../data/labelgroup.service";
import {LabelService} from "./label.service";
import {FilterService} from "../ui/filter.service";
import {NetzgrafikColoringService} from "../data/netzgrafikColoring.service";
import {UndoService} from "../data/undo.service";
import {CopyService} from "./copy.service";
import {UiInteractionService} from "../ui/ui.interaction.service";
import {LoadPerlenketteService} from "../../perlenkette/service/load-perlenkette.service";
import {NetzgrafikUnitTesting} from "../../../integration-testing/netzgrafik.unit.testing";

describe("ResourceService", () => {
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
  let filterService: FilterService = null;
  let netzgrafikColoringService: NetzgrafikColoringService = null;
  let copyService: CopyService = null;
  let uiInteractionService: UiInteractionService = null;
  let loadPerlenketteService: LoadPerlenketteService = null;
  let undoService: UndoService = null;

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
      stammdatenService,
      trainrunSectionService,
      trainrunService,
      netzgrafikColoringService,
      loadPerlenketteService,
    );

    undoService = new UndoService(
      dataService,
      nodeService,
      noteService,
      trainrunService,
      filterService,
    );

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
    copyService.resetLocalStorage();
  });

  it("test - resource and node 1:1 link", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const loadedNetzgrafik = dataService.getNetzgrafikDto();
    const allNodeResourceIds: number[] = [];
    nodeService.getNodes().forEach((n) => {
      const res = resourceService.getResource(n.getResourceId());
      if (res !== undefined) {
        allNodeResourceIds.push(n.getResourceId());
      }
      expect(res.getId()).toBe(n.getResourceId());
    });
    expect(allNodeResourceIds.length).toBe(resourceService.getResources().length);
  });

  it("test - data.service.ensureAllResourcesLinkedToNetzgrafikObjects", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const res001 = resourceService.createAndGetResource();
    const res002 = resourceService.createAndGetResource();
    const res003 = resourceService.createAndGetResource();
    expect(res001.getId()).toBe(resourceService.getResource(res001.getId()).getId());
    expect(res002.getId()).toBe(resourceService.getResource(res002.getId()).getId());
    expect(res003.getId()).toBe(resourceService.getResource(res003.getId()).getId());
    expect(nodeService.getNodes().length + 3).toBe(resourceService.getResources().length);
    dataService.ensureAllResourcesLinkedToNetzgrafikObjects();
    expect(nodeService.getNodes().length).toBe(resourceService.getResources().length);
  });

  it("test - delete node", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const nodeOfInterest = nodeService.getNodes()[1];
    nodeService.deleteNode(nodeOfInterest.getId());
    const res = resourceService.getResource(nodeOfInterest.getResourceId());
    expect(nodeService.getNodes().length).toBe(resourceService.getResources().length);
  });
});
