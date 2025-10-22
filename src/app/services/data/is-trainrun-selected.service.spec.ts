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
import {NetzgrafikUnitTesting} from "../../../integration-testing/netzgrafik.unit.testing";
import {FilterService} from "../ui/filter.service";
import {NetzgrafikColoringService} from "../data/netzgrafikColoring.service";
import {IsTrainrunSelectedService} from "./is-trainrun-section.service";

describe("IsTrainrunSelectedService", () => {
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
  });

  it("Test load data", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    expect(trainrunSections.length).toBe(8);
  });

  it("IsTrainrunSelectedService - 001", () => {
    const itss = new IsTrainrunSelectedService(trainrunService);
    itss.getTrainrunIdSelectedByClick().subscribe((trainrunIdSelected: number) => {
      expect(trainrunIdSelected).toBe(undefined);
    });
    itss.setTrainrunIdSelectedByClick(undefined);
  });

  it("IsTrainrunSelectedService - 002", () => {
    const itss = new IsTrainrunSelectedService(trainrunService);
    let nbrCalls = 0;
    itss.getTrainrunIdSelected().subscribe((trainrunIdSelected: number) => {
      if (nbrCalls === 0) {
        expect(trainrunIdSelected).toBe(undefined);
      } else {
        expect(trainrunIdSelected).toBe(2);
      }
      nbrCalls++;
    });
    itss.setTrainrunIdSelectedByClick(2);
  });

  it("IsTrainrunSelectedService - 003", () => {
    const itss = new IsTrainrunSelectedService(trainrunService);
    let nbrCalls = 0;
    itss.getTrainrunIdSelected().subscribe((trainrunIdSelected: number) => {
      if (nbrCalls === 0) {
        expect(trainrunIdSelected).toBe(undefined);
      } else {
        expect(trainrunIdSelected).toBe(-21);
      }
      nbrCalls++;
    });
    itss.setTrainrunIdSelectedByClick(-21);
  });
});
