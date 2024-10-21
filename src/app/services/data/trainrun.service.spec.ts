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
import {LabelService} from "../data/label.serivce";
import {NetzgrafikUnitTesting} from "../../../integration-testing/netzgrafik.unit.testing";
import {FilterService} from "../ui/filter.service";
import {NetzgrafikColoringService} from "../data/netzgrafikColoring.service";

describe("TrainrunService", () => {
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
    trainrunService = new TrainrunService(
      logService,
      labelService,
      filterService,
    );
    trainrunSectionService = new TrainrunSectionService(
      logService,
      trainrunService,
      filterService,
    );
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

  it("trainrunService.updateTrainrunFrequency - 001", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const t = ts.getTrainrun();
    expect(t.getTrainrunFrequency().frequency).toBe(60);
    trainrunService.updateTrainrunFrequency(
      t,
      dataService.getTrainrunFrequency(2),
      0,
    );
    expect(t.getTrainrunFrequency().frequency).toBe(30);
  });

  it("trainrunService.updateTrainrunFrequency - 002", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const t = ts.getTrainrun();
    expect(t.getTrainrunFrequency().frequency).toBe(60);
    trainrunService.updateTrainrunFrequency(
      t,
      dataService.getTrainrunFrequency(4),
      60,
    );
    expect(t.getTrainrunFrequency().frequency).toBe(120);
  });

  it("trainrunService.updateTrainrunFrequency - 003", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const t = ts.getTrainrun();
    expect(t.getTrainrunFrequency().frequency).toBe(60);
    trainrunService.updateTrainrunFrequency(
      t,
      dataService.getTrainrunFrequency(4),
      0,
    );
    expect(t.getTrainrunFrequency().frequency).toBe(120);
  });

  it("trainrunService.updateTrainrunFrequency - 001", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const t = ts.getTrainrun();
    expect(t.getFrequency()).toBe(60);
    trainrunService.updateTrainrunFrequency(
      t,
      dataService.getTrainrunFrequency(1),
      0,
    );
    trainrunService.updateTrainrunFrequency(
      t,
      dataService.getTrainrunFrequency(2),
      0,
    );
    trainrunService.updateTrainrunFrequency(
      t,
      dataService.getTrainrunFrequency(0),
      0,
    );
    expect(t.getFrequency()).toBe(15);
  });

  it("trainrunService.updateTrainrunCategory - 001", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const t = ts.getTrainrun();
    expect(t.getTrainrunFrequency().frequency).toBe(60);
    const n1 = nodeService.getNodeFromId(ts.getSourceNodeId());
    const n2 = nodeService.getNodeFromId(ts.getTargetNodeId());
    expect(n1.getPortOfTrainrunSection(ts.getId()).getId()).toBe(2);
    expect(n2.getPortOfTrainrunSection(ts.getId()).getId()).toBe(3);
    trainrunService.updateTrainrunCategory(
      t,
      dataService.getTrainrunCategory(1),
    );
    expect(n1.getPortOfTrainrunSection(ts.getId()).getId()).toBe(2);
    expect(n2.getPortOfTrainrunSection(ts.getId()).getId()).toBe(3);
  });

  it("trainrunService.updateTrainrunTitle - 001", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const t = ts.getTrainrun();
    const n1 = nodeService.getNodeFromId(ts.getSourceNodeId());
    const n2 = nodeService.getNodeFromId(ts.getTargetNodeId());
    expect(n1.getPortOfTrainrunSection(ts.getId()).getId()).toBe(2);
    expect(n2.getPortOfTrainrunSection(ts.getId()).getId()).toBe(3);
    trainrunService.updateTrainrunTitle(t, "Z");
    expect(n1.getPortOfTrainrunSection(ts.getId()).getId()).toBe(2);
    expect(n2.getPortOfTrainrunSection(ts.getId()).getId()).toBe(3);
  });

  it("trainrunService.updateTrainrunTitle - 002", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const t = ts.getTrainrun();
    const n1 = nodeService.getNodeFromId(ts.getSourceNodeId());
    const n2 = nodeService.getNodeFromId(ts.getTargetNodeId());
    expect(n1.getPortOfTrainrunSection(ts.getId()).getId()).toBe(2);
    expect(n2.getPortOfTrainrunSection(ts.getId()).getId()).toBe(3);
    trainrunService.updateTrainrunTitle(t, "0");
    expect(n1.getPortOfTrainrunSection(ts.getId()).getId()).toBe(2);
    expect(n2.getPortOfTrainrunSection(ts.getId()).getId()).toBe(3);
  });

  it("trainrunService.updateTrainrunTimeCategory - 001", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const t = ts.getTrainrun();
    const n1 = nodeService.getNodeFromId(ts.getSourceNodeId());
    const n2 = nodeService.getNodeFromId(ts.getTargetNodeId());
    expect(n1.getPortOfTrainrunSection(ts.getId()).getId()).toBe(2);
    expect(n2.getPortOfTrainrunSection(ts.getId()).getId()).toBe(3);
    trainrunService.updateTrainrunTimeCategory(
      t,
      dataService.getTrainrunTimeCategory(2),
    );
    expect(n1.getPortOfTrainrunSection(ts.getId()).getId()).toBe(2);
    expect(n2.getPortOfTrainrunSection(ts.getId()).getId()).toBe(3);
  });

  it("trainrunService.duplicateTrainrun", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const t = ts.getTrainrun();
    const n1 = nodeService.getNodeFromId(ts.getSourceNodeId());
    const n2 = nodeService.getNodeFromId(ts.getTargetNodeId());
    const copied = trainrunService.duplicateTrainrunAndSections(t.getId());
    const ts1 = trainrunSectionService.getAllTrainrunSectionsForTrainrun(
      t.getId(),
    );
    const ts2 = trainrunSectionService.getAllTrainrunSectionsForTrainrun(
      copied.getId(),
    );
    expect(ts1.length).toBe(ts2.length);
    for (let idx = 0; idx < ts1.length; idx++) {
      expect(ts1[idx].getSourceNodeId()).toBe(ts2[idx].getSourceNodeId());
      expect(ts1[idx].getTargetNodeId()).toBe(ts2[idx].getTargetNodeId());
    }
  });

  it("trainrunService.setLabels", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    const t = ts.getTrainrun();
    const n1 = nodeService.getNodeFromId(ts.getSourceNodeId());
    const n2 = nodeService.getNodeFromId(ts.getTargetNodeId());
    const labelsList = ["a", "e", "25", "04", "78"];
    trainrunService.setLabels(t.getId(), labelsList);
    labelsList.forEach((label, index) => {
      expect(
        labelService.getLabelFromId(t.getLabelIds()[index]).getLabel(),
      ).toBe(label);
    });
  });

  it("getAllConnectedTrainruns - 001", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );
    const ts: TrainrunSection =
      trainrunSectionService.getTrainrunSectionFromId(0);
    const n: Node = nodeService.getNodeFromId(1);
    const connectedTrainruns = n.getAllConnectedTrainruns(
      trainrunSectionService.getTrainrunSectionFromId(ts.getId()),
    );
    expect(connectedTrainruns.length).toBe(0);
  });

  it("getAllConnectedTrainruns - 002", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );
    const ts: TrainrunSection =
      trainrunSectionService.getTrainrunSectionFromId(1);
    const n: Node = nodeService.getNodeFromId(3);
    const connectedTrainruns = n.getAllConnectedTrainruns(
      trainrunSectionService.getTrainrunSectionFromId(ts.getId()),
    );
    expect(connectedTrainruns.length).toBe(0);
  });

  it("getAllConnectedTrainruns - 003", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );
    const ts: TrainrunSection =
      trainrunSectionService.getTrainrunSectionFromId(4);
    const n: Node = nodeService.getNodeFromId(1);
    const connectedTrainruns = n.getAllConnectedTrainruns(
      trainrunSectionService.getTrainrunSectionFromId(ts.getId()),
    );
    expect(connectedTrainruns.length).toBe(0);
  });

  it("getAllConnectedTrainruns - 004", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );
    const ts: TrainrunSection =
      trainrunSectionService.getTrainrunSectionFromId(4);
    const n: Node = nodeService.getNodeFromId(ts.getTargetNodeId());
    const connectedTrainruns = n.getAllConnectedTrainruns(
      trainrunSectionService.getTrainrunSectionFromId(ts.getId()),
    );
    expect(connectedTrainruns.find((e) => e === 3)).toBe(3);
    expect(connectedTrainruns.find((e) => e === 4)).toBe(4);
    expect(connectedTrainruns.find((e) => e === 0)).toBe(undefined);
    expect(connectedTrainruns.length).toBe(2);
  });

  it("getAllConnectedTrainruns - 005", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );

    const ts: TrainrunSection =
      trainrunSectionService.getTrainrunSectionFromId(6);
    const n: Node = nodeService.getNodeFromId(ts.getTargetNodeId());
    const connectedTrainruns = n.getAllConnectedTrainruns(
      trainrunSectionService.getTrainrunSectionFromId(ts.getId()),
    );
    expect(connectedTrainruns.find((e) => e === 2)).toBe(2);
    expect(connectedTrainruns.find((e) => e === 0)).toBe(undefined);
    expect(connectedTrainruns.length).toBe(1);
  });

  it("combineTwoTrainruns - 001", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );

    const ts0: TrainrunSection =
      trainrunSectionService.getTrainrunSectionFromId(0);
    const ts1: TrainrunSection =
      trainrunSectionService.getTrainrunSectionFromId(1);
    const n: Node = nodeService.getNodeFromId(1);

    const trainrunSections1 =
      trainrunSectionService.getAllTrainrunSectionsForTrainrun(0);
    expect(trainrunSections1.length).toBe(2);

    trainrunService.splitTrainrunIntoTwoParts(n.getTransition(0));

    const trainrunSections2 =
      trainrunSectionService.getAllTrainrunSectionsForTrainrun(ts0.getTrainrunId());
    expect(trainrunSections2.length).toBe(1);
    const trainrunSections3 =
      trainrunSectionService.getAllTrainrunSectionsForTrainrun(ts1.getTrainrunId());
    expect(trainrunSections3.length).toBe(1);

    trainrunService.combineTwoTrainruns(n,
      n.getPortOfTrainrunSection(0),
      n.getPortOfTrainrunSection(1));

    const trainrunSections4 =
      trainrunSectionService.getAllTrainrunSectionsForTrainrun(ts1.getTrainrunId());
    expect(trainrunSections4.length).toBe(2);
  });

  it("getRootIterators", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTesting.getUnitTestNetzgrafik(),
    );

    const iterators = trainrunService.getRootIterators();

    const iterators0 = iterators.get(0);
    // trainrun 0: 0 -> 1 -> 2
    // 1 root: 0
    expect(iterators0.length).toBe(1);
    expect(iterators0[0].current().trainrunSection.getSourceNodeId()).toBe(0);

    const iterators1 = iterators.get(1);
    // trainrun 1: 1 -> 2
    // 1 root: 1
    expect(iterators1.length).toBe(1);
    expect(iterators1[0].current().trainrunSection.getSourceNodeId()).toBe(1);

    const iterators2 = iterators.get(2);
    // trainrun 2: 0 -> 1 -> 2 -> 3
    // 1 root: 0
    expect(iterators2.length).toBe(1);
    expect(iterators2[0].current().trainrunSection.getSourceNodeId()).toBe(0);

    const iterators3 = iterators.get(3);
    // trainrun 3: 4 -> 2
    // 1 root: 4
    expect(iterators3.length).toBe(1);
    expect(iterators3[0].current().trainrunSection.getSourceNodeId()).toBe(4);

    const iterators4 = iterators.get(4);
    // trainrun 4: 4 -> 2
    // 1 root: 4
    expect(iterators4.length).toBe(1);
    expect(iterators4[0].current().trainrunSection.getSourceNodeId()).toBe(4);
  });

});
