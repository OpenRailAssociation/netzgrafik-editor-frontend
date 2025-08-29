import {NodeService} from "../app/services/data/node.service";
import {TrainrunService} from "../app/services/data/trainrun.service";
import {TrainrunSectionService} from "../app/services/data/trainrunsection.service";
import {StammdatenService} from "../app/services/data/stammdaten.service";
import {DataService} from "../app/services/data/data.service";
import {ResourceService} from "../app/services/data/resource.service";
import {LogService} from "../app/logger/log.service";
import {LogPublishersService} from "../app/logger/log.publishers.service";
import {NetzgrafikUnitTesting} from "./netzgrafik.unit.testing";
import {NonStopTrainrunIterator, TrainrunIterator} from "../app/services/util/trainrun.iterator";
import {NoteService} from "../app/services/data/note.service";
import {LabelGroupService} from "../app/services/data/labelgroup.service";
import {LabelService} from "../app/services/data/label.service";
import {FilterService} from "../app/services/ui/filter.service";
import {NetzgrafikColoringService} from "../app/services/data/netzgrafikColoring.service";

describe("TrainrunSection Service Test", () => {
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
  });

  it("test simple trainrun iterator 1 test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    const startingTrainrunSection = trainrunSectionService
      .getAllTrainrunSectionsForTrainrun(2)
      .pop();
    const node1 = trainrunService.getEndNode(
      startingTrainrunSection.getSourceNode(),
      startingTrainrunSection,
    );
    const node2 = trainrunService.getEndNode(
      startingTrainrunSection.getTargetNode(),
      startingTrainrunSection,
    );
    expect(node1.getId()).toBe(3);
    expect(node2.getId()).toBe(0);

    const iteratorNodeIds = [2, 1, 0];

    const itr = new TrainrunIterator(
      logService,
      node1,
      node1.getTrainrunSection(startingTrainrunSection.getTrainrun()),
    );
    while (itr.hasNext()) {
      const iteratorObject = itr.next();
      expect(iteratorObject.node.getId()).toBe(iteratorNodeIds.shift());
    }
    expect(itr.current().node.getId()).toBe(node2.getId());
    expect(iteratorNodeIds.length).toBe(0);
  });

  it("test simple trainrun iterator 2 test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    const startingTrainrunSection = trainrunSectionService
      .getAllTrainrunSectionsForTrainrun(2)
      .pop();
    const node1 = trainrunService.getEndNode(
      startingTrainrunSection.getSourceNode(),
      startingTrainrunSection,
    );
    const node2 = trainrunService.getEndNode(
      startingTrainrunSection.getTargetNode(),
      startingTrainrunSection,
    );
    expect(node1.getId()).toBe(3);
    expect(node2.getId()).toBe(0);

    const iteratorNodeIds = [1, 2, 3];

    const itr = new TrainrunIterator(
      logService,
      node2,
      node2.getTrainrunSection(startingTrainrunSection.getTrainrun()),
    );
    while (itr.hasNext()) {
      const iteratorObject = itr.next();
      expect(iteratorObject.node.getId()).toBe(iteratorNodeIds.shift());
    }
    expect(itr.current().node.getId()).toBe(node1.getId());
    expect(iteratorNodeIds.length).toBe(0);
  });

  it("test simple trainrun iterator 2 test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    const startingTrainrunSection = trainrunSectionService
      .getAllTrainrunSectionsForTrainrun(2)
      .pop();
    const node1 = trainrunService.getEndNode(
      startingTrainrunSection.getSourceNode(),
      startingTrainrunSection,
    );
    const node2 = trainrunService.getEndNode(
      startingTrainrunSection.getTargetNode(),
      startingTrainrunSection,
    );
    expect(node1.getId()).toBe(3);
    expect(node2.getId()).toBe(0);

    const iteratorNodeIds = [1, 2];

    const itr = new NonStopTrainrunIterator(
      logService,
      node2,
      node2.getTrainrunSection(startingTrainrunSection.getTrainrun()),
    );
    while (itr.hasNext()) {
      const iteratorObject = itr.next();
      expect(iteratorObject.node.getId()).toBe(iteratorNodeIds.shift());
    }
    expect(itr.current().node.getId()).toBe(2);
    expect(iteratorNodeIds.length).toBe(0);
  });
});
