import {DataService} from "../data/data.service";
import {NodeService} from "../data/node.service";
import {ResourceService} from "../data/resource.service";
import {TrainrunService} from "../data/trainrun.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {BaseDataService} from "../data/basedata.service";
import {NoteService} from "../data/note.service";
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
import {Resource} from "../../models/resource.model";
import {
  InfrastructureDataSource,
  SectionTrackClass,
} from "../../types/infrastructure-resource.types";

describe("ResourceService", () => {
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
    copyService.resetLocalStorage();
  });

  it("preserves optional infrastructure data when serializing a resource", () => {
    const resource = new Resource({
      id: 1,
      capacity: 2,
      nodeInfrastructure: {
        platformTrackCount: 4,
        throughTrackCount: 2,
        sidingTrackCount: 1,
        source: InfrastructureDataSource.Manual,
        lastUpdatedAt: "2026-09-01T12:00:00.000Z",
      },
      sectionInfrastructure: {
        trackCount: 2,
        trackClass: SectionTrackClass.DoubleTrack,
        maximumSpeedKph: 160,
        electrified: true,
        source: InfrastructureDataSource.Manual,
        lastUpdatedAt: "2026-09-01T12:00:00.000Z",
      },
    });

    expect(new Resource(resource.getDto()).getDto()).toEqual(resource.getDto());
  });

  it("updates and persists node infrastructure", () => {
    const resource = resourceService.createAndGetResource(false);
    const nodeInfrastructure = {
      platformTrackCount: 3,
      throughTrackCount: 1,
      sidingTrackCount: 2,
      source: InfrastructureDataSource.Manual,
      lastUpdatedAt: "2026-09-01T12:00:00.000Z",
    };

    resourceService.changeNodeInfrastructure(resource.getId(), nodeInfrastructure, false);

    expect(resourceService.getResource(resource.getId()).getNodeInfrastructure()).toEqual(
      nodeInfrastructure,
    );
  });

  it("updates and persists section infrastructure", () => {
    const resource = resourceService.createAndGetResource(false);
    const sectionInfrastructure = {
      trackCount: 2,
      trackClass: SectionTrackClass.DoubleTrack,
      maximumSpeedKph: 160,
      electrified: true,
      source: InfrastructureDataSource.Manual,
      lastUpdatedAt: "2026-09-01T12:00:00.000Z",
    };

    resourceService.changeSectionInfrastructure(resource.getId(), sectionInfrastructure, false);

    expect(resourceService.getResource(resource.getId()).getSectionInfrastructure()).toEqual(
      sectionInfrastructure,
    );
  });

  it("test - resource and node 1:1 link", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
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
    expect(nodeService.getNodes().length).toBe(resourceService.getResources().length);
  });
});
