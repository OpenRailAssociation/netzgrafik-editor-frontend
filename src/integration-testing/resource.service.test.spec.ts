import {NodeService} from "../app/services/data/node.service";
import {TrainrunService} from "../app/services/data/trainrun.service";
import {TrainrunSectionService} from "../app/services/data/trainrunsection.service";
import {StammdatenService} from "../app/services/data/stammdaten.service";
import {DataService} from "../app/services/data/data.service";
import {ResourceService} from "../app/services/data/resource.service";
import {LogService} from "../app/logger/log.service";
import {LogPublishersService} from "../app/logger/log.publishers.service";
import {NoteService} from "../app/services/data/note.service";
import {LabelService} from "../app/services/data/label.service";
import {LabelGroupService} from "../app/services/data/labelgroup.service";
import {NetzgrafikUnitTesting} from "./netzgrafik.unit.testing";
import {Resource} from "../app/models/resource.model";
import {FilterService} from "../app/services/ui/filter.service";
import {NetzgrafikColoringService} from "../app/services/data/netzgrafikColoring.service";

describe("ResourceService Test", () => {
  let resources: Resource[] = null;

  let dataService: DataService = null;
  let nodeService: NodeService = null;
  let resourceService: ResourceService = null;
  let trainrunService: TrainrunService = null;
  let trainrunSectionService: TrainrunSectionService = null;
  let stammdatenService: StammdatenService = null;
  let noteService: NoteService = null;
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

    resourceService.resourceObservable.subscribe(
      (updateResources) => (resources = updateResources),
    );
  });

  it("setResourceData", () => {
    const netzgrafik = NetzgrafikUnitTesting.getUnitTestNetzgrafik();
    dataService.loadNetzgrafikDto(netzgrafik);
    resourceService.setResourceData(netzgrafik.resources);
    resourceService.resourceUpdated();
    expect(netzgrafik.resources.length).toBe(resources.length);
  });

  it("getResource", () => {
    const netzgrafik = NetzgrafikUnitTesting.getUnitTestNetzgrafik();
    netzgrafik.resources = [];
    dataService.loadNetzgrafikDto(netzgrafik);
    const res: Resource = resourceService.getResource(0);
    expect(res).toBe(undefined);
  });

  it("createAndGetResource", () => {
    const netzgrafik = NetzgrafikUnitTesting.getUnitTestNetzgrafik();
    netzgrafik.resources = [];
    dataService.loadNetzgrafikDto(netzgrafik);
    const resCheck0: Resource = resourceService.getResource(0);
    expect(resCheck0).toBe(undefined);
    const res: Resource = resourceService.createAndGetResource();
    expect(res.getDto().capacity).toBe(2);
    expect(res !== undefined).toBe(true);
  });

  it("changeCapacity", () => {
    const netzgrafik = NetzgrafikUnitTesting.getUnitTestNetzgrafik();
    netzgrafik.resources = [];
    dataService.loadNetzgrafikDto(netzgrafik);
    const res: Resource = resourceService.createAndGetResource();
    resourceService.changeCapacity(res.getId(), 0);
    expect(resourceService.getResource(res.getId()).getCapacity()).toBe(0);
    res.setCapacity(1);
    expect(resourceService.getResource(res.getId()).getCapacity()).toBe(1);
  });

  it("changeCapacity", () => {
    const netzgrafik = NetzgrafikUnitTesting.getUnitTestNetzgrafik();
    dataService.loadNetzgrafikDto(netzgrafik);
    resourceService.createAndGetResource();
    const res1: Resource = resourceService.createAndGetResource();
    resourceService.changeCapacity(res1.getId(), 10);
    expect(resourceService.getResource(res1.getId()).getCapacity()).toBe(10);
    res1.setCapacity(undefined);
    expect(resourceService.getResource(res1.getId()).getCapacity()).toBe(undefined);
  });
});
