import {DataService} from "../data/data.service";
import {NodeService} from "../data/node.service";
import {ResourceService} from "../data/resource.service";
import {TrainrunService} from "../data/trainrun.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {LeftAndRightTimeStructure} from "../data/trainrun-section-times.service";
import {BaseDataService} from "../data/basedata.service";
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
import {LeftAndRightLockStructure} from "../data/trainrun-section-times.service";

describe("TrainrunsectionHelper", () => {
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
  let trainrunsectionHelper: TrainrunsectionHelper = null;

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
      bottomTravelTime: 10,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    expect(d.travelTime).toBe(0);
    expect(d.rightDepartureTime).toBe(0);
    expect(d.rightArrivalTime).toBe(0);
    expect(d.leftDepartureTime).toBe(larts.leftDepartureTime);
    expect(d.leftArrivalTime).toBe(larts.leftArrivalTime);
  });

  it("getTravelTime -- 001", () => {
    const tt = TrainrunsectionHelper.getTravelTime(10, 10, 1, 12, false, 0);
    expect(tt).toBe(1);
  });

  it("getTravelTime -- 002", () => {
    const tt = TrainrunsectionHelper.getTravelTime(10, 10, 1, 12, true, 0);
    expect(tt).toBe(12);
  });

  it("getTravelTime -- 003", () => {
    const tt = TrainrunsectionHelper.getTravelTime(10, 10, 1, 12, false, 0);
    expect(tt).toBe(1);
  });

  it("getTravelTime -- 004", () => {
    const tt = TrainrunsectionHelper.getTravelTime(8, 10, 2, 12, false, 0);
    expect(tt).toBe(1);
  });

  it("getDefaultTimeStructure", () => {
    const larts: LeftAndRightTimeStructure = {
      leftDepartureTime: 10,
      leftArrivalTime: 50,
      rightDepartureTime: 20,
      rightArrivalTime: 40,
      travelTime: 10,
      bottomTravelTime: 10,
    };
    const d = TrainrunsectionHelper.getDefaultTimeStructure(larts);
    expect(d.travelTime).toBe(0);
    expect(d.rightDepartureTime).toBe(0);
    expect(d.rightArrivalTime).toBe(0);
    expect(d.leftDepartureTime).toBe(larts.leftDepartureTime);
    expect(d.leftArrivalTime).toBe(larts.leftArrivalTime);
  });

  it("getTravelTime -- 2 -- 001", () => {
    const tt = TrainrunsectionHelper.getTravelTime(10, 10, 1, 12, false, 0);
    expect(tt).toBe(1);
  });

  it("getTravelTime -- 2 -- 002", () => {
    const tt = TrainrunsectionHelper.getTravelTime(10, 10, 1, 12, true, 0);
    expect(tt).toBe(12);
  });

  it("getTravelTime -- 2 -- 003", () => {
    const tt = TrainrunsectionHelper.getTravelTime(10, 10, 1, 12, false, 0);
    expect(tt).toBe(1);
  });

  it("getTravelTime -- 2 -- 004", () => {
    const tt = TrainrunsectionHelper.getTravelTime(8, 10, 2, 12, false, 0);
    expect(tt).toBe(1);
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

  describe("getLeftAndRightLock", () => {
    const defaultLockStructure: LeftAndRightLockStructure = {
      leftLock: false,
      rightLock: false,
      travelTimeLock: false,
    };

    // By default, we look at all sections in-between stop nodes (ie, we cross
    // non-stop nodes)
    const defaultNodesOrdered: Node[] = [];

    it("travel time lock with single section", () => {
      dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
      const ts = trainrunSectionService.getTrainrunSectionFromId(1); // IC1 BN - OL

      const lockStructure = trainrunsectionHelper.getLeftAndRightLock(ts, defaultNodesOrdered);
      expect(lockStructure).toEqual({...defaultLockStructure, travelTimeLock: true});
    });

    it("source departure lock with single section, source on left", () => {
      dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
      const ts = trainrunSectionService.getTrainrunSectionFromId(1); // IC1 BN - OL

      ts.setTravelTimeLock(false);
      ts.setSourceDepartureLock(true);

      const lockStructure = trainrunsectionHelper.getLeftAndRightLock(ts, defaultNodesOrdered);
      expect(lockStructure).toEqual({...defaultLockStructure, leftLock: true});
    });

    it("source arrival lock with single section, source on left", () => {
      dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
      const ts = trainrunSectionService.getTrainrunSectionFromId(1); // IC1 BN - OL

      ts.setTravelTimeLock(false);
      ts.setSourceArrivalLock(true);

      const lockStructure = trainrunsectionHelper.getLeftAndRightLock(ts, defaultNodesOrdered);
      expect(lockStructure).toEqual({...defaultLockStructure, leftLock: true});
    });

    it("target arrival lock with single section, source on left", () => {
      dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
      const ts = trainrunSectionService.getTrainrunSectionFromId(1); // IC1 BN - OL

      ts.setTravelTimeLock(false);
      ts.setTargetArrivalLock(true);

      const lockStructure = trainrunsectionHelper.getLeftAndRightLock(ts, defaultNodesOrdered);
      expect(lockStructure).toEqual({...defaultLockStructure, rightLock: true});
    });

    it("source arrival lock with single section, source on right", () => {
      dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
      const ts = trainrunSectionService.getTrainrunSectionFromId(6); // RE5678 ZUE - CH

      ts.setTravelTimeLock(false);
      ts.setSourceArrivalLock(true);

      const lockStructure = trainrunsectionHelper.getLeftAndRightLock(ts, defaultNodesOrdered);
      expect(lockStructure).toEqual({...defaultLockStructure, rightLock: true});
    });

    it("target arrival lock with single section, source on right", () => {
      dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
      const ts = trainrunSectionService.getTrainrunSectionFromId(6); // RE5678 ZUE - CH

      ts.setTravelTimeLock(false);
      ts.setTargetArrivalLock(true);

      const lockStructure = trainrunsectionHelper.getLeftAndRightLock(ts, defaultNodesOrdered);
      expect(lockStructure).toEqual({...defaultLockStructure, leftLock: true});
    });

    it("all locks with single section", () => {
      dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
      const ts = trainrunSectionService.getTrainrunSectionFromId(6); // RE5678 ZUE - CH

      ts.setSourceDepartureLock(true);
      ts.setSourceArrivalLock(true);
      ts.setTargetDepartureLock(true);
      ts.setTargetArrivalLock(true);

      const lockStructure = trainrunsectionHelper.getLeftAndRightLock(ts, defaultNodesOrdered);
      expect(lockStructure).toEqual({
        ...defaultLockStructure,
        leftLock: true,
        rightLock: true,
        travelTimeLock: true,
      });
    });

    it("travel time lock with multiple sections across a non-stop node", () => {
      dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
      const leftSection = trainrunSectionService.getTrainrunSectionFromId(3); // S1234 BN - OL
      const rightSection = trainrunSectionService.getTrainrunSectionFromId(4); // S1234 OL - ZUE

      leftSection.setTravelTimeLock(false);
      rightSection.setTravelTimeLock(true);

      const leftLockStructure = trainrunsectionHelper.getLeftAndRightLock(
        leftSection,
        defaultNodesOrdered,
      );
      expect(leftLockStructure).toEqual(defaultLockStructure);

      const rightLockStructure = trainrunsectionHelper.getLeftAndRightLock(
        rightSection,
        defaultNodesOrdered,
      );
      expect(rightLockStructure).toEqual({...defaultLockStructure, travelTimeLock: true});
    });

    it("source arrival lock with multiple sections on stop node", () => {
      dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
      const leftSection = trainrunSectionService.getTrainrunSectionFromId(3); // S1234 BN - OL
      const rightSection = trainrunSectionService.getTrainrunSectionFromId(4); // S1234 OL - ZUE

      leftSection.setTravelTimeLock(false);
      rightSection.setTravelTimeLock(false);
      leftSection.setSourceArrivalLock(true);

      const expectedLockStructure = {...defaultLockStructure, leftLock: true};

      const leftLockStructure = trainrunsectionHelper.getLeftAndRightLock(
        leftSection,
        defaultNodesOrdered,
      );
      expect(leftLockStructure).toEqual(expectedLockStructure);

      const rightLockStructure = trainrunsectionHelper.getLeftAndRightLock(
        rightSection,
        defaultNodesOrdered,
      );
      expect(rightLockStructure).toEqual(expectedLockStructure);
    });

    it("source arrival lock with multiple sections on non-stop node", () => {
      dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
      const leftSection = trainrunSectionService.getTrainrunSectionFromId(3); // S1234 BN - OL
      const rightSection = trainrunSectionService.getTrainrunSectionFromId(4); // S1234 OL - ZUE

      leftSection.setTravelTimeLock(false);
      rightSection.setTravelTimeLock(false);
      rightSection.setSourceArrivalLock(true);

      const leftLockStructure = trainrunsectionHelper.getLeftAndRightLock(
        leftSection,
        defaultNodesOrdered,
      );
      expect(leftLockStructure).toEqual(defaultLockStructure);

      const rightLockStructure = trainrunsectionHelper.getLeftAndRightLock(
        rightSection,
        defaultNodesOrdered,
      );
      expect(rightLockStructure).toEqual(defaultLockStructure);
    });

    it("target departure lock with multiple sections on stop node", () => {
      dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
      const leftSection = trainrunSectionService.getTrainrunSectionFromId(3); // S1234 BN - OL
      const rightSection = trainrunSectionService.getTrainrunSectionFromId(4); // S1234 OL - ZUE

      leftSection.setTravelTimeLock(false);
      rightSection.setTravelTimeLock(false);
      rightSection.setTargetDepartureLock(true);

      const expectedLockStructure = {...defaultLockStructure, rightLock: true};

      const leftLockStructure = trainrunsectionHelper.getLeftAndRightLock(
        leftSection,
        defaultNodesOrdered,
      );
      expect(leftLockStructure).toEqual(expectedLockStructure);

      const rightLockStructure = trainrunsectionHelper.getLeftAndRightLock(
        rightSection,
        defaultNodesOrdered,
      );
      expect(rightLockStructure).toEqual(expectedLockStructure);
    });

    it("target departure lock with multiple sections on non-stop node", () => {
      dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
      const leftSection = trainrunSectionService.getTrainrunSectionFromId(3); // S1234 BN - OL
      const rightSection = trainrunSectionService.getTrainrunSectionFromId(4); // S1234 OL - ZUE

      leftSection.setTravelTimeLock(false);
      rightSection.setTravelTimeLock(false);
      leftSection.setTargetDepartureLock(true);

      const leftLockStructure = trainrunsectionHelper.getLeftAndRightLock(
        leftSection,
        defaultNodesOrdered,
      );
      expect(leftLockStructure).toEqual(defaultLockStructure);

      const rightLockStructure = trainrunsectionHelper.getLeftAndRightLock(
        rightSection,
        defaultNodesOrdered,
      );
      expect(rightLockStructure).toEqual(defaultLockStructure);
    });

    describe("source arrival lock with single section on non-stop node", () => {
      let ts: TrainrunSection;
      beforeEach(() => {
        dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
        ts = trainrunSectionService.getTrainrunSectionFromId(4); // S1234 OL - ZUE

        ts.setTravelTimeLock(false);
        ts.setSourceArrivalLock(true);
      });

      it("source on left", () => {
        const nodesOrdered = [ts.getSourceNode(), ts.getTargetNode()];
        const lockStructure = trainrunsectionHelper.getLeftAndRightLock(ts, nodesOrdered);
        expect(lockStructure).toEqual({...defaultLockStructure, leftLock: true});
      });

      it("source on right", () => {
        const nodesOrdered = [ts.getTargetNode(), ts.getSourceNode()];
        const lockStructure = trainrunsectionHelper.getLeftAndRightLock(ts, nodesOrdered);
        expect(lockStructure).toEqual({...defaultLockStructure, rightLock: true});
      });
    });

    describe("target arrival lock with single section on non-stop node", () => {
      let ts: TrainrunSection;
      beforeEach(() => {
        dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
        ts = trainrunSectionService.getTrainrunSectionFromId(3); // S1234 BN - OL

        ts.setTravelTimeLock(false);
        ts.setTargetArrivalLock(true);
      });

      it("target on left", () => {
        const nodesOrdered = [ts.getTargetNode(), ts.getSourceNode()];
        const lockStructure = trainrunsectionHelper.getLeftAndRightLock(ts, nodesOrdered);
        expect(lockStructure).toEqual({...defaultLockStructure, leftLock: true});
      });

      it("target on right", () => {
        const nodesOrdered = [ts.getSourceNode(), ts.getTargetNode()];
        const lockStructure = trainrunsectionHelper.getLeftAndRightLock(ts, nodesOrdered);
        expect(lockStructure).toEqual({...defaultLockStructure, rightLock: true});
      });
    });
  });
});
