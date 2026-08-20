import {DataService} from "../../services/data/data.service";
import {NodeService} from "../../services/data/node.service";
import {ResourceService} from "../../services/data/resource.service";
import {TrainrunService} from "../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {BaseDataService} from "../../services/data/basedata.service";
import {NoteService} from "../../services/data/note.service";
import {LogService} from "../../logger/log.service";
import {LogPublishersService} from "../../logger/log.publishers.service";
import {LabelGroupService} from "../../services/data/labelgroup.service";
import {LabelService} from "../../services/data/label.service";
import {NetzgrafikUnitTesting} from "../../../integration-testing/netzgrafik.unit.testing";
import {FilterService} from "../../services/ui/filter.service";
import {NetzgrafikColoringService} from "../../services/data/netzgrafikColoring.service";
import {LoadPerlenketteService} from "./load-perlenkette.service";

describe("LoadPerlenketteService", () => {
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
  let perlenketteService: LoadPerlenketteService = null;

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
    perlenketteService = new LoadPerlenketteService(
      trainrunService,
      trainrunSectionService,
      nodeService,
      filterService,
    );
  });

  it("check getOrderedNodeEntriesForTrainrun - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const t = trainrunService.getTrainrunFromId(0);
    trainrunService.setTrainrunAsSelected(t.getId());
    const entries = perlenketteService.getOrderedNodeEntriesForTrainrun(t);
    console.log("A", entries, t.getId());
    expect(entries.length).toBe(3);
    expect(entries[0].nodeId).toBe(0);
    expect(entries[0].trainrunSectionId).toBe(0);
    expect(entries[0].hasGapAfter).toBe(false);
    expect(entries[1].nodeId).toBe(1);
    expect(entries[1].trainrunSectionId).toBe(0);
    expect(entries[1].hasGapAfter).toBe(false);
    expect(entries[2].nodeId).toBe(2);
    expect(entries[2].trainrunSectionId).toBe(1);
    expect(entries[2].hasGapAfter).toBe(false);
  });

  it("check getOrderedNodeEntriesForTrainrun - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const t = trainrunService.getTrainrunFromId(1);
    trainrunService.setTrainrunAsSelected(t.getId());
    const newSection = trainrunSectionService.createTrainrunSection(3, 4, false);
    const entries = perlenketteService.getOrderedNodeEntriesForTrainrun(t);
    console.log("B", entries, t.getId());
    expect(entries.length).toBe(4);
    expect(entries[0].nodeId).toBe(1);
    expect(entries[0].trainrunSectionId).toBe(2);
    expect(entries[0].hasGapAfter).toBe(false);
    expect(entries[1].nodeId).toBe(2);
    expect(entries[1].trainrunSectionId).toBe(2);
    expect(entries[1].hasGapAfter).toBe(true);
    expect(entries[2].nodeId).toBe(3);
    expect(entries[2].trainrunSectionId).toBe(newSection.getId());
    expect(entries[2].hasGapAfter).toBe(false);
    expect(entries[3].nodeId).toBe(4);
    expect(entries[3].trainrunSectionId).toBe(newSection.getId());
    expect(entries[3].hasGapAfter).toBe(false);
  });
});
