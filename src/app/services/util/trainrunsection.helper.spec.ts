import {DataService} from "../data/data.service";
import {NodeService} from "../data/node.service";
import {ResourceService} from "../data/resource.service";
import {TrainrunService} from "../data/trainrun.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {LeftAndRightTimeStructure} from "../data/trainrun-section-times.service";
import {StammdatenService} from "../data/stammdaten.service";
import {NoteService} from "../data/note.service";
import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {LogService} from "../../logger/log.service";
import {LogPublishersService} from "../../logger/log.publishers.service";
import {LabelGroupService} from "../data/labelgroup.service";
import {LabelService} from "../data/label.service";
import {NetzgrafikUnitTesting} from "../../../integration-testing/netzgrafik.unit.testing";
import {FilterService} from "../ui/filter.service";
import {NetzgrafikColoringService} from "../data/netzgrafikColoring.service";
import {TrainrunsectionHelper} from "./trainrunsection.helper";

describe("TrainrunsectionHelper", () => {
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
  let trainrunsectionHelper: TrainrunsectionHelper = null;

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

    trainrunsectionHelper = new TrainrunsectionHelper(trainrunService);
  });

  it("Test load data", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    expect(trainrunSections.length).toBe(8);
  });

  it("getDefaultTimeStructure", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      stopTime: 0,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    expect(d.travelTime).toBe(0);
    expect(d.stopTime).toBe(0);
    expect(d.rightDepartureTime).toBe(0);
    expect(d.rightArrivalTime).toBe(0);
    expect(d.leftDepartureTime).toBe(larts.leftDepartureTime);
    expect(d.leftArrivalTime).toBe(larts.leftArrivalTime);
  });

  it("getLastSectionTravelTime -- 001", () => {
    const tt = TrainrunsectionHelper.getLastSectionTravelTime(10, 10, 0);
    expect(tt).toBe(1);
  });

  it("getLastSectionTravelTime -- 002", () => {
    const tt = TrainrunsectionHelper.getLastSectionTravelTime(10, 8, 0);
    expect(tt).toBe(2);
  });

  it("getLastSectionTravelTime -- 003", () => {
    const tt = TrainrunsectionHelper.getLastSectionTravelTime(8, 10, 0);
    expect(tt).toBe(1);
  });

  it("getLastSectionTravelTime -- 004", () => {
    const tt = TrainrunsectionHelper.getLastSectionTravelTime(10, 2, 0);
    expect(tt).toBe(8);
  });

  it("getSectionDistributedTravelTime -- 001", () => {
    const tt = TrainrunsectionHelper.getSectionDistributedTravelTime(12, 1, 0);
    expect(tt).toBe(12);
  });

  it("getSectionDistributedTravelTime -- 002", () => {
    const tt = TrainrunsectionHelper.getSectionDistributedTravelTime(12, 2, 0);
    expect(tt).toBe(24);
  });

  it("getRightArrivalTime - 001", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      stopTime: 0,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    const a = TrainrunsectionHelper.getRightArrivalTime(d);
    expect(a).toBe(10);
  });

  it("getRightArrivalTime - 002", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      stopTime: 0,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    d.leftArrivalTime = -10;
    const a = TrainrunsectionHelper.getRightArrivalTime(d);
    expect(a).toBe(10);
  });

  it("getRightArrivalTime - 003", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      stopTime: 0,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    d.leftDepartureTime = undefined;
    const a = TrainrunsectionHelper.getRightArrivalTime(d);
    expect(a).toEqual(NaN);
  });

  it("getRightDepartureTime - 001", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      stopTime: 0,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    const a = TrainrunsectionHelper.getRightDepartureTime(d);
    expect(a).toBe(0);
  });

  it("getRightDepartureTime - 002", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      stopTime: 0,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    d.rightArrivalTime = -10;
    const a = TrainrunsectionHelper.getRightDepartureTime(d);
    expect(a).toBe(70);
  });

  it("getRightDepartureTime - 003", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      stopTime: 0,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    d.rightArrivalTime = undefined;
    const a = TrainrunsectionHelper.getRightDepartureTime(d);
    expect(a).toEqual(NaN);
  });

  it("getDefaultTimeStructure", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      stopTime: 0,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    expect(d.travelTime).toBe(0);
    expect(d.stopTime).toBe(0);
    expect(d.rightDepartureTime).toBe(0);
    expect(d.rightArrivalTime).toBe(0);
    expect(d.leftDepartureTime).toBe(larts.leftDepartureTime);
    expect(d.leftArrivalTime).toBe(larts.leftArrivalTime);
  });

  it("getRightArrivalTime - 001", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      stopTime: 0,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    const a = TrainrunsectionHelper.getRightArrivalTime(d);
    expect(a).toBe(10);
  });

  it("getRightArrivalTime - 002", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      stopTime: 0,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    d.leftArrivalTime = -10;
    const a = TrainrunsectionHelper.getRightArrivalTime(d);
    expect(a).toBe(10);
  });

  it("getRightArrivalTime - 003", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      stopTime: 0,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    d.leftDepartureTime = undefined;
    const a = TrainrunsectionHelper.getRightArrivalTime(d);
    expect(a).toEqual(NaN);
  });

  it("getRightDepartureTime - 001", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      stopTime: 0,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    const a = TrainrunsectionHelper.getRightDepartureTime(d);
    expect(a).toBe(0);
  });

  it("getRightDepartureTime - 002", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      stopTime: 0,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    d.rightArrivalTime = -10;
    const a = TrainrunsectionHelper.getRightDepartureTime(d);
    expect(a).toBe(70);
  });

  it("getRightDepartureTime - 003", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      stopTime: 0,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    d.rightArrivalTime = undefined;
    const a = TrainrunsectionHelper.getRightDepartureTime(d);
    expect(a).toEqual(NaN);
  });

  it("trainrunSectionService.getTrainrunSectionFromId", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const nodes = trainrunService.getBothEndNodesWithTrainrunId(ts.getTrainrunId());
    const d = trainrunsectionHelper.getLeftAndRightLock(ts, [nodes.endNode1, nodes.endNode2]);
    expect(d.leftLock).toBe(false);
    expect(d.rightLock).toBe(false);
    expect(d.travelTimeLock).toBe(true);
  });

  it("getLeftBetriebspunkt - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const nodes = trainrunService.getBothEndNodesWithTrainrunId(ts.getTrainrunId());
    const d = trainrunsectionHelper.getLeftBetriebspunkt(ts, [nodes.endNode1, nodes.endNode2]);
    expect(d[0]).toBe("OL");
    expect(d[1]).toBe("(Olten)");
  });

  it("getRightBetriebspunkt - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const nodes = trainrunService.getBothEndNodesWithTrainrunId(ts.getTrainrunId());
    const d = trainrunsectionHelper.getRightBetriebspunkt(ts, [nodes.endNode1, nodes.endNode2]);
    expect(d[0]).toBe("ZUE");
    expect(d[1]).toBe("(Zuerich)");
  });

  it("getSourceLock - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const nodes = trainrunService.getBothEndNodesWithTrainrunId(ts.getTrainrunId());
    const d = trainrunsectionHelper.getSourceLock(
      {
        leftLock: true,
        rightLock: false,
        travelTimeLock: true,
      },
      ts,
    );
    expect(d).toBe(true);
  });

  it("getTargetLock - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const nodes = trainrunService.getBothEndNodesWithTrainrunId(ts.getTrainrunId());

    const d = trainrunsectionHelper.getTargetLock(
      {
        leftLock: false,
        rightLock: true,
        travelTimeLock: true,
      },
      ts,
    );
    expect(d).toBe(true);

    const d1 = trainrunsectionHelper.getTargetLock(
      {
        leftLock: true,
        rightLock: false,
        travelTimeLock: true,
      },
      ts,
    );
    expect(d1).toBe(false);
  });
});
