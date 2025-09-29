import {NodeService} from "../app/services/data/node.service";
import {TrainrunService} from "../app/services/data/trainrun.service";
import {TrainrunSectionService} from "../app/services/data/trainrunsection.service";
import {StammdatenService} from "../app/services/data/stammdaten.service";
import {DataService} from "../app/services/data/data.service";
import {Node} from "../app/models/node.model";
import {TrainrunSection} from "../app/models/trainrunsection.model";
import {PortAlignment} from "../app/data-structures/technical.data.structures";
import {ConnectionValidator} from "../app/services/util/connection.validator";
import {ResourceService} from "../app/services/data/resource.service";
import {LogService} from "../app/logger/log.service";
import {LogPublishersService} from "../app/logger/log.publishers.service";
import {NetzgrafikUnitTesting} from "./netzgrafik.unit.testing";
import {NetzgrafikUnitTestingTransition} from "./netzgrafik.unit.testing.transition";
import {NoteService} from "../app/services/data/note.service";
import {LabelService} from "../app/services/data/label.service";
import {LabelGroupService} from "../app/services/data/labelgroup.service";
import {LabelRef} from "../app/data-structures/business.data.structures";
import {FilterService} from "../app/services/ui/filter.service";
import {NetzgrafikColoringService} from "../app/services/data/netzgrafikColoring.service";

describe("NodeService Test", () => {
  let nodes: Node[] = null;
  let trainrunSections: TrainrunSection[] = null;

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

    nodeService.nodes.subscribe((updatesNodes) => (nodes = updatesNodes));
    trainrunSectionService.trainrunSections.subscribe(
      (updatesTrainrunSections) => (trainrunSections = updatesTrainrunSections),
    );
  });

  it("test infrastructure setup", () => {
    const netzgrafik = NetzgrafikUnitTesting.getUnitTestNetzgrafik();
    dataService.loadNetzgrafikDto(netzgrafik);
    expect(nodes.length).toBe(5);
    expect(nodeService.getVisibleNodes().length).toBe(5);
    expect(nodeService.getSelectedNodes().length).toBe(0);
    nodeService.setDataService(dataService);
    const node = netzgrafik.nodes.pop();
    node.resourceId = null;
    expect(node.resourceId === null).toBe(true);
    netzgrafik.nodes.push(node);
    nodeService.setNodeData(netzgrafik.nodes);
    expect(nodes.length).toBe(netzgrafik.nodes.length);
    expect(nodeService.getVisibleNodes().length).toBe(netzgrafik.nodes.length);
    expect(nodeService.getSelectedNodes().length).toBe(0);
    nodes.forEach((n) => {
      expect(n.getResourceId() !== null).toBe(true);
    });
  });

  it("add node with position test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    let node3 = nodeService.getNodeFromId(5);
    expect(node3).toBe(undefined);

    nodeService.addNodeWithPosition(0, 0);
    expect(nodes.length).toBe(6);

    node3 = nodeService.getNodeFromId(3);
    expect(node3.getId()).toBe(3);
  });

  it("add node with position test 2", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);

    const betriebspunktName = "TT";
    const fullName = "TTest";
    const labelIds = labelService
      .getLabelsFromLabelRef(LabelRef.Node)
      .map((label) => label.getId());

    nodeService.addNodeWithPosition(0, 0, betriebspunktName, fullName);
    expect(nodes.length).toBe(6);
    const n = nodes[nodes.length - 1];
    expect(n.getBetriebspunktName()).toBe(betriebspunktName);
    expect(n.getFullName()).toBe(fullName);
  });

  it("add node with position test 3", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);

    const betriebspunktName = "TT";
    const fullName = "TTest";
    const labelIds = labelService
      .getLabelsFromLabelRef(LabelRef.Node)
      .map((label) => label.getId());

    nodeService.addNodeWithPosition(0, 0, betriebspunktName, fullName, labelIds);
    expect(nodes.length).toBe(6);
    const n = nodes[nodes.length - 1];
    expect(n.getBetriebspunktName()).toBe(betriebspunktName);
    expect(n.getFullName()).toBe(fullName);
    n.getLabelIds().forEach((lId) => {
      expect(labelIds.includes(lId)).toBe(true);
    });
    expect(n.getLabelIds().length).toBe(labelIds.length);
  });

  it("delete node1 test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    expect(trainrunSections.length).toBe(8);

    nodeService.deleteNode(1);
    expect(nodes.length).toBe(4);
    expect(trainrunSections.length).toBe(3);

    const node0 = nodeService.getNodeFromId(0);
    const node2 = nodeService.getNodeFromId(2);
    expect(node0.getPorts().length).toBe(0);
    expect(node2.getPorts().length).toBe(3);
  });

  it("delete node2 test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    expect(trainrunSections.length).toBe(8);

    nodeService.deleteNode(2);
    expect(nodes.length).toBe(4);
    expect(trainrunSections.length).toBe(2);

    const node0 = nodeService.getNodeFromId(0);
    const node1 = nodeService.getNodeFromId(1);
    expect(node0.getPorts().length).toBe(2);
    expect(node1.getPorts().length).toBe(2);
    expect(node1.getTransitions().length).toBe(0);
  });

  it("delete all nodes test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    expect(trainrunSections.length).toBe(8);

    nodeService.deleteAllVisibleNodes();
    expect(nodes.length).toBe(0);
    expect(trainrunSections.length).toBe(0);
  });

  it("delete all non visible nodes test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    expect(nodeService.getVisibleNodes().length).toBe(5);
    expect(trainrunSections.length).toBe(8);

    nodeService.deleteAllNonVisibleNodes();

    expect(nodes.length).toBe(5);
    expect(nodeService.getVisibleNodes().length).toBe(5);
    expect(trainrunSections.length).toBe(8);
  });

  it("delete all non visible nodes with label filtering active test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    expect(nodeService.getVisibleNodes().length).toBe(5);
    expect(trainrunSections.length).toBe(8);

    filterService.setFilterNodeLabels([3]);
    expect(nodeService.getVisibleNodes().length).toBe(4);
    nodeService.deleteAllNonVisibleNodes();

    expect(nodes.length).toBe(4);
    expect(nodeService.getVisibleNodes().length).toBe(4);
    expect(trainrunSections.length).toBe(6);
  });

  it("change node position test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    expect(trainrunSections.length).toBe(8);

    nodeService.changeNodePosition(1, 320, 640, true);
    expect(nodes.length).toBe(5);
    const node1 = nodeService.getNodeFromId(1);
    const ports = node1.getPorts();
    expect(ports.length).toBe(5);
    expect(ports[0].getPositionAlignment()).toBe(PortAlignment.Top);
    expect(ports[0].getPositionIndex()).toBe(0);
    expect(ports[1].getPositionAlignment()).toBe(PortAlignment.Top);
    expect(ports[1].getPositionIndex()).toBe(1);
    expect(ports[2].getPositionAlignment()).toBe(PortAlignment.Top);
    expect(ports[2].getPositionIndex()).toBe(2);
  });

  it("toggle transition test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodes.length).toBe(5);
    expect(trainrunSections.length).toBe(8);
    let node1 = nodeService.getNodeFromId(1);
    expect(node1.getIsNonStop(0)).toBe(false);

    nodeService.toggleNonStop(1, 0);
    node1 = nodeService.getNodeFromId(1);
    const node2 = nodeService.getNodeFromId(2);
    expect(node1.getIsNonStop(0)).toBe(true);
    expect(node1.getDepartureTime(trainrunSections[1])).toBe(10);
    expect(node1.getArrivalTime(trainrunSections[1])).toBe(50);
    expect(node2.getDepartureTime(trainrunSections[1])).toBe(40);
    expect(node2.getArrivalTime(trainrunSections[1])).toBe(20);
  });

  it("undock transition test", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTestingTransition.getUnitTestTransitionNetzgrafik(),
    );
    expect(nodes.length).toBe(4);
    expect(trainrunSections.length).toBe(8);

    const nodeOL = nodeService.getNodeFromId(1);
    const transition1 = nodeOL.getTransitionFromId(1);
    const transition2 = nodeOL.getTransitionFromId(2);
    const transition3 = nodeOL.getTransitionFromId(3);
    const transition4 = nodeOL.getTransitionFromId(4);

    expect(transition1.getDto().id).toBe(1);
    expect(transition2.getDto().id).toBe(2);
    expect(transition3.getDto().id).toBe(3);
    expect(transition4.getDto().id).toBe(4);

    const transitionPath1 = transition1.getPath();
    expect(transitionPath1.length).toBe(4);

    const trainrun1 = transition1.getTrainrun();
    const trainrun2 = transition2.getTrainrun();
    const trainrun3 = transition3.getTrainrun();
    const trainrun4 = transition4.getTrainrun();

    nodeService.undockTransition(1, 1);
    nodeService.undockTransition(1, 2);
    nodeService.undockTransition(1, 3);
    nodeService.undockTransition(1, 4);

    const trainrunSections4Trainrun1 = trainrunSectionService.getAllTrainrunSectionsForTrainrun(
      trainrun1.getId(),
    );
    const trainrunSections4Trainrun2 = trainrunSectionService.getAllTrainrunSectionsForTrainrun(
      trainrun2.getId(),
    );
    const trainrunSections4Trainrun3 = trainrunSectionService.getAllTrainrunSectionsForTrainrun(
      trainrun3.getId(),
    );
    const trainrunSections4Trainrun4 = trainrunSectionService.getAllTrainrunSectionsForTrainrun(
      trainrun4.getId(),
    );

    expect(trainrunSections4Trainrun1.length).toBe(1);
    const trainrunSection1 = trainrunSections4Trainrun1.pop();
    expect(trainrunSection1.getSourceDeparture()).toBe(49);
    expect(trainrunSection1.getSourceArrival()).toBe(11);
    expect(trainrunSection1.getTargetDeparture()).toBe(52);
    expect(trainrunSection1.getTargetArrival()).toBe(8);

    expect(trainrunSections4Trainrun2.length).toBe(1);
    const trainrunSection2 = trainrunSections4Trainrun2.pop();
    expect(trainrunSection2.getSourceDeparture()).toBe(0);
    expect(trainrunSection2.getSourceArrival()).toBe(0);
    expect(trainrunSection2.getTargetDeparture()).toBe(38);
    expect(trainrunSection2.getTargetArrival()).toBe(22);

    expect(trainrunSections4Trainrun3.length).toBe(1);
    const trainrunSection3 = trainrunSections4Trainrun3.pop();
    expect(trainrunSection3.getSourceDeparture()).toBe(0);
    expect(trainrunSection3.getSourceArrival()).toBe(0);
    expect(trainrunSection3.getTargetDeparture()).toBe(38);
    expect(trainrunSection3.getTargetArrival()).toBe(22);

    expect(trainrunSections4Trainrun4.length).toBe(1);
    const trainrunSection4 = trainrunSections4Trainrun4.pop();
    expect(trainrunSection4.getSourceDeparture()).toBe(48);
    expect(trainrunSection4.getSourceArrival()).toBe(12);
    expect(trainrunSection4.getTargetDeparture()).toBe(50);
    expect(trainrunSection4.getTargetArrival()).toBe(10);

    expect(trainrunSection1.getNumberOfStops()).toBe(1);
    expect(trainrunSection2.getNumberOfStops()).toBe(1);
    expect(trainrunSection3.getNumberOfStops()).toBe(1);
    expect(trainrunSection4.getNumberOfStops()).toBe(1);
  });

  it("undock transition time lock test (-1-)", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTestingTransition.getUnitTestTransitionNetzgrafik(),
    );
    expect(nodes.length).toBe(4);
    expect(trainrunSections.length).toBe(8);

    const nodeOL = nodeService.getNodeFromId(1);
    const transition1 = nodeOL.getTransitionFromId(1);

    expect(transition1.getDto().id).toBe(1);
    const port1 = nodeOL.getPort(transition1.getPortId1());
    const port2 = nodeOL.getPort(transition1.getPortId2());
    const ts1 = port1.getTrainrunSection();
    const ts2 = port2.getTrainrunSection();
    ts1.setSourceDepartureLock(true);
    ts1.setSourceArrivalLock(true);
    ts2.setTargetDepartureLock(true);
    ts2.setTargetArrivalLock(true);
    nodeService.undockTransition(1, 1);
    const updatedTrainrunSection = ts1;
    expect(updatedTrainrunSection.getSourceArrivalLock()).toBe(true);
    expect(updatedTrainrunSection.getTargetArrivalLock()).toBe(true);
  });

  it("undock transition time lock test (-2-)", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTestingTransition.getUnitTestTransitionNetzgrafik(),
    );
    expect(nodes.length).toBe(4);
    expect(trainrunSections.length).toBe(8);

    const nodeOL = nodeService.getNodeFromId(1);
    const transition1 = nodeOL.getTransitionFromId(1);

    expect(transition1.getDto().id).toBe(1);
    const port1 = nodeOL.getPort(transition1.getPortId1());
    const port2 = nodeOL.getPort(transition1.getPortId2());
    const ts1 = port1.getTrainrunSection();
    const ts2 = port2.getTrainrunSection();
    ts1.setSourceDepartureLock(false);
    ts1.setSourceArrivalLock(false);
    ts2.setTargetDepartureLock(true);
    ts2.setTargetArrivalLock(true);

    nodeService.undockTransition(1, 1);
    const updatedTrainrunSection = ts1;
    expect(updatedTrainrunSection.getSourceDepartureLock()).toBe(false);
    expect(updatedTrainrunSection.getTargetDepartureLock()).toBe(true);
  });

  it("undock transition time lock test (-3-)", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTestingTransition.getUnitTestTransitionNetzgrafik(),
    );
    expect(nodes.length).toBe(4);
    expect(trainrunSections.length).toBe(8);

    const nodeOL = nodeService.getNodeFromId(1);
    const transition1 = nodeOL.getTransitionFromId(1);

    expect(transition1.getDto().id).toBe(1);
    const port1 = nodeOL.getPort(transition1.getPortId1());
    const port2 = nodeOL.getPort(transition1.getPortId2());
    const ts1 = port1.getTrainrunSection();
    const ts2 = port2.getTrainrunSection();
    ts1.setSourceDepartureLock(true);
    ts1.setSourceArrivalLock(true);
    ts2.setTargetDepartureLock(false);
    ts2.setTargetArrivalLock(false);
    nodeService.undockTransition(1, 1);
    const updatedTrainrunSection = ts1;
    expect(updatedTrainrunSection.getSourceDepartureLock()).toBe(true);
    expect(updatedTrainrunSection.getTargetDepartureLock()).toBe(false);
  });

  it("undock transition time lock test (-4-)", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTestingTransition.getUnitTestTransitionNetzgrafik(),
    );
    expect(nodes.length).toBe(4);
    expect(trainrunSections.length).toBe(8);

    const nodeOL = nodeService.getNodeFromId(1);
    const transition1 = nodeOL.getTransitionFromId(1);

    expect(transition1.getDto().id).toBe(1);
    const port1 = nodeOL.getPort(transition1.getPortId1());
    const port2 = nodeOL.getPort(transition1.getPortId2());
    const ts1 = port1.getTrainrunSection();
    const ts2 = port2.getTrainrunSection();
    ts1.setSourceDepartureLock(false);
    ts1.setSourceArrivalLock(false);
    ts2.setTargetDepartureLock(false);
    ts2.setTargetArrivalLock(false);

    nodeService.undockTransition(1, 1);
    const updatedTrainrunSection = ts1;
    expect(updatedTrainrunSection.getSourceDepartureLock()).toBe(false);
    expect(updatedTrainrunSection.getTargetDepartureLock()).toBe(false);
  });

  it("undock transition - redock Intermediate stop test <1>", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTestingTransition.getUnitTestTransitionNetzgrafik(),
    );
    expect(nodes.length).toBe(4);
    expect(trainrunSections.length).toBe(8);

    const nodeOL = nodeService.getNodeFromId(1);
    const transition1 = nodeOL.getTransitionFromId(1);
    const trainrun1 = transition1.getTrainrun();
    nodeService.undockTransition(1, 1);
    let trainrunSections4Trainrun1 = trainrunSectionService.getAllTrainrunSectionsForTrainrun(
      trainrun1.getId(),
    );
    const trainrunSection1 = trainrunSections4Trainrun1.pop();

    // check whether the basis is correct
    expect(trainrunSection1.getTrainrun().getCategoryShortName()).toBe("RE");
    expect(trainrunSection1.getTrainrun().getTitle()).toBe("X");
    expect(trainrunSection1.getTravelTime()).toBe(19);
    expect(trainrunSection1.getSourceDeparture()).toBe(49);
    expect(trainrunSection1.getSourceArrival()).toBe(11);
    expect(trainrunSection1.getTargetDeparture()).toBe(52);
    expect(trainrunSection1.getTargetArrival()).toBe(8);

    trainrunSection1.setNumberOfStops(4);
    trainrunSectionService.replaceIntermediateStopWithNode(
      trainrunSection1.getId(),
      1,
      nodeOL.getId(),
    );
    trainrunSections4Trainrun1 = trainrunSectionService.getAllTrainrunSectionsForTrainrun(
      trainrun1.getId(),
    );
    const trainrunSection2 = trainrunSections4Trainrun1.pop();

    // check whether the basis is correct
    expect(trainrunSection2.getTrainrun().getCategoryShortName()).toBe("RE");
    expect(trainrunSection2.getTrainrun().getTitle()).toBe("X");

    // check update times
    expect(trainrunSection1.getSourceDeparture()).toBe(49);
    expect(trainrunSection1.getSourceArrival()).toBe(11);
    expect(trainrunSection1.getTargetDeparture()).toBe(1.5);
    expect(trainrunSection1.getTargetArrival()).toBe(58.5);

    expect(trainrunSection2.getSourceDeparture()).toBe(0);
    expect(trainrunSection2.getSourceArrival()).toBe(0);
    expect(trainrunSection2.getTargetDeparture()).toBe(52);
    expect(trainrunSection2.getTargetArrival()).toBe(8);

    expect(trainrunSection1.getNumberOfStops()).toBe(1);
    expect(trainrunSection2.getNumberOfStops()).toBe(2);

    expect(trainrunSection1.getTravelTime()).toBe(9.5);
    expect(trainrunSection2.getTravelTime()).toBe(8);
  });

  it("undock transition - redock Intermediate stop test <2>", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTestingTransition.getUnitTestTransitionNetzgrafik(),
    );
    expect(nodes.length).toBe(4);
    expect(trainrunSections.length).toBe(8);

    const nodeOL = nodeService.getNodeFromId(1);
    const transition1 = nodeOL.getTransitionFromId(1);
    const trainrun1 = transition1.getTrainrun();
    nodeService.undockTransition(1, 1);
    let trainrunSections4Trainrun1 = trainrunSectionService.getAllTrainrunSectionsForTrainrun(
      trainrun1.getId(),
    );
    const trainrunSection1 = trainrunSections4Trainrun1.pop();
    trainrunSection1.setTravelTime(139);

    // check whether the basis is correct
    expect(trainrunSection1.getTrainrun().getCategoryShortName()).toBe("RE");
    expect(trainrunSection1.getTrainrun().getTitle()).toBe("X");
    expect(trainrunSection1.getTravelTime()).toBe(139);
    expect(trainrunSection1.getSourceDeparture()).toBe(49);
    expect(trainrunSection1.getSourceArrival()).toBe(11);
    expect(trainrunSection1.getTargetDeparture()).toBe(52);
    expect(trainrunSection1.getTargetArrival()).toBe(8);

    trainrunSection1.setNumberOfStops(4);
    trainrunSectionService.replaceIntermediateStopWithNode(
      trainrunSection1.getId(),
      1,
      nodeOL.getId(),
    );
    trainrunSections4Trainrun1 = trainrunSectionService.getAllTrainrunSectionsForTrainrun(
      trainrun1.getId(),
    );
    const trainrunSection2 = trainrunSections4Trainrun1.pop();

    // check whether the basis is correct
    expect(trainrunSection2.getTrainrun().getCategoryShortName()).toBe("RE");
    expect(trainrunSection2.getTrainrun().getTitle()).toBe("X");

    // check update times
    expect(trainrunSection1.getSourceDeparture()).toBe(49);
    expect(trainrunSection1.getSourceArrival()).toBe(11);
    expect(trainrunSection1.getTargetDeparture()).toBe(1.5);
    expect(trainrunSection1.getTargetArrival()).toBe(58.5);

    expect(trainrunSection2.getSourceDeparture()).toBe(0);
    expect(trainrunSection2.getSourceArrival()).toBe(0);
    expect(trainrunSection2.getTargetDeparture()).toBe(52);
    expect(trainrunSection2.getTargetArrival()).toBe(8);

    expect(trainrunSection1.getNumberOfStops()).toBe(1);
    expect(trainrunSection2.getNumberOfStops()).toBe(2);

    expect(trainrunSection1.getTravelTime()).toBe(69.5);
    expect(trainrunSection2.getTravelTime()).toBe(68);
  });

  it("reconnect trainrunsection test", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTestingTransition.getUnitTestTransitionNetzgrafik(),
    );
    expect(nodes.length).toBe(4);
    expect(trainrunSections.length).toBe(8);

    const nodeOL = nodeService.getNodeFromId(1);
    const nodeBS = nodeService.getNodeFromId(11);
    const transition1 = nodeOL.getTransitionFromId(1);
    const trainrun1 = transition1.getTrainrun();
    const existingTrainrunSection = trainrunSectionService
      .getAllTrainrunSectionsForTrainrun(trainrun1.getId())
      .pop();

    expect(existingTrainrunSection.getSourceNodeId()).toBe(1);
    expect(existingTrainrunSection.getTargetNodeId()).toBe(5);

    trainrunSectionService.reconnectTrainrunSection(
      nodeOL.getId(),
      nodeBS.getId(),
      existingTrainrunSection.getId(),
      existingTrainrunSection.getTargetNodeId(),
      existingTrainrunSection.getSourceNodeId(),
    );

    expect(existingTrainrunSection.getSourceNodeId()).toBe(1);
    expect(existingTrainrunSection.getTargetNodeId()).toBe(11);
    expect(existingTrainrunSection.getSourceDeparture()).toBe(0);
    expect(existingTrainrunSection.getSourceArrival()).toBe(1);
    expect(existingTrainrunSection.getTargetDeparture()).toBe(52);
    expect(existingTrainrunSection.getTargetArrival()).toBe(8);
    expect(existingTrainrunSection.getNumberOfStops()).toBe(0);
    expect(existingTrainrunSection.getTravelTime()).toBe(8);
  });

  it("test getTransition", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTestingTransition.getUnitTestTransitionNetzgrafik(),
    );
    const nodeOL = nodeService.getNodeFromId(1);
    const transition = nodeOL.getTransitionFromId(1);
    const prt = nodeOL.getPort(transition.getPortId1());
    expect(prt.getDto().id).toBe(transition.getPortId1());
    const trainrunSection = prt.getTrainrunSection();
    expect(transition.getId()).toBe(1);
    expect(nodeOL.getTransition(trainrunSection.getId()).getId()).toBe(1);
    expect(nodeOL.getTransition(trainrunSection.getId()).getId()).toBe(transition.getId());
  });

  it("add connection test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);

    nodeService.addConnectionToNode(1, 0, 2);
    const node1 = nodeService.getNodeFromId(1);
    const connections = node1.getConnections();
    expect(connections.length).toBe(1);
  });

  it("connection test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);
    const con = nodeService.getNodeFromId(2).getConnectionFromId(1);
    expect(con.getDto().id).toBe(1);
    expect(con.getPath().length).toBe(4);
  });

  it("remove connection test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);

    nodeService.addConnectionToNode(1, 0, 2);
    let node1 = nodeService.getNodeFromId(1);
    let connections = node1.getConnections();
    expect(connections.length).toBe(1);

    nodeService.deleteNode(0);
    node1 = nodeService.getNodeFromId(1);
    connections = node1.getConnections();
    expect(connections.length).toBe(0);
  });

  it("change node details test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodeService.getNodeFromId(0).getBetriebspunktName()).toBe("BN");

    nodeService.changeNodeBetriebspunktName(0, "TEST");
    expect(nodeService.getNodeFromId(0).getBetriebspunktName()).toBe("TEST");
    nodeService.changeNodeFullName(0, "Test Betriebspunkt");
    expect(nodeService.getNodeFromId(0).getFullName()).toBe("Test Betriebspunkt");
    nodeService.changeConnectionTime(0, 10);
    expect(nodeService.getNodeFromId(0).getConnectionTime()).toBe(10);
  });

  it("check connection (warning)", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(nodeService.getNodeFromId(2).getBetriebspunktName()).toBe("ZUE");
    const nodeZUE = nodeService.getNodeFromId(2);
    expect(nodeZUE.getConnections().length).toBe(2);
    nodeZUE.getConnections().forEach((connection) => {
      expect(connection.getPortId2()).toBe(9);
      connection.resetWarning();
      const trainrunSection1 = nodeZUE.getPort(connection.getPortId1()).getTrainrunSection();
      const trainrunSection2 = nodeZUE.getPort(connection.getPortId2()).getTrainrunSection();

      if (connection.getId() === 2) {
        const port = nodeZUE.getPort(connection.getPortId2());
        const trans = nodeZUE.getTransition(port.getTrainrunSectionId());
        trans.toggleIsNonStopTransit();
      }

      ConnectionValidator.validateConnection(connection, nodeZUE);
      if (connection.getId() === 1) {
        expect(connection.hasWarning()).toBe(false);
      }
      if (connection.getId() === 2) {
        expect(connection.hasWarning()).toBe(true);
      }
    });
  });

  it("copyTransitionProperties", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const existingTrainrunSection = trainrunSectionService.getAllTrainrunSectionsForTrainrun(0)[1];
    const ts0 = trainrunSectionService.getAllTrainrunSectionsForTrainrun(0)[0];
    const sourceNode = nodeService.getNodeFromId(existingTrainrunSection.getSourceNodeId());
    const targetNode = nodeService.getNodeFromId(existingTrainrunSection.getTargetNodeId());
    const copyTs = new TrainrunSection();
    nodeService.addPortsToNodes(sourceNode.getId(), targetNode.getId(), existingTrainrunSection);

    expect(
      nodeService.isConditionToAddTransitionFullfilled(sourceNode, existingTrainrunSection),
    ).toBe(false);
    expect(nodeService.isConditionToAddTransitionFullfilled(sourceNode, ts0)).toBe(false);
    nodeService.addTransitionToNodes(
      sourceNode.getId(),
      targetNode.getId(),
      existingTrainrunSection,
    );
    const transition = nodeService
      .getNodeFromId(sourceNode.getId())
      .getTransitions()
      .find((t) => t.getTrainrun().getId() === copyTs.getTrainrunId());
    transition.setIsNonStopTransit(true);
    nodeService.copyTransitionProperties(sourceNode.getId(), copyTs, existingTrainrunSection);
    const newTransition = nodeService
      .getNodeFromId(sourceNode.getId())
      .getTransitions()
      .find((t) => t.getTrainrun().getId() === copyTs.getTrainrunId());
    expect(newTransition.getIsNonStopTransit()).toBe(true);
  });

  it("move selected nodes test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    const ids = [
      nodeService.getNodes()[0].getId(),
      nodeService.getNodes()[1].getId(),
      nodeService.getNodes()[3].getId(),
    ];
    nodeService.getNodes().forEach((n: Node) => {
      if (n.getId() in ids) {
        nodeService.selectNode(n.getId());
      }
      n.setPosition(n.getId() * 32, n.getId() * 32);
    });
    expect(nodeService.getSelectedNodes().length).toBe(3);

    nodeService.moveSelectedNodes(-63, 132, 32, false);

    nodeService.getNodes().forEach((n: Node) => {
      if (n.selected()) {
        expect(n.getPositionX()).toBe(n.getId() * 32 - 64);
        expect(n.getPositionY()).toBe(n.getId() * 32 + 128);
      } else {
        expect(n.getPositionX()).toBe(n.getId() * 32);
        expect(n.getPositionY()).toBe(n.getId() * 32);
      }
    });

    nodeService.unselectAllNodes();
    expect(nodeService.getSelectedNode()).toBe(null);
    expect(nodeService.getSelectedNodes().length).toBe(0);
  });

  it("select single node as selected test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    const ids = [
      nodeService.getNodes()[0].getId(),
      nodeService.getNodes()[1].getId(),
      nodeService.getNodes()[3].getId(),
    ];
    nodeService.getNodes().forEach((n: Node) => {
      if (n.getId() in ids) {
        nodeService.selectNode(n.getId());
      }
    });

    nodeService.setSingleNodeAsSelected(ids[2]);

    expect(nodeService.getSelectedNode().getId()).toBe(ids[2]);
    expect(nodeService.getSelectedNodes().length).toBe(1);

    nodeService.getNodes().forEach((n: Node) => {
      if (n.getId() === ids[2]) {
        expect(n.selected()).toBe(true);
        expect(nodeService.isNodeSelected(n.getId())).toBe(true);
      } else {
        expect(n.selected()).toBe(false);
        expect(nodeService.isNodeSelected(n.getId())).toBe(false);
      }
      nodeService.unselectNode(n.getId());
      expect(n.selected()).toBe(false);
      expect(nodeService.isNodeSelected(n.getId())).toBe(false);
    });
    expect(nodeService.getSelectedNodes().length).toBe(0);
  });

  it("unselect all nodes test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    const ids = [
      nodeService.getNodes()[0].getId(),
      nodeService.getNodes()[1].getId(),
      nodeService.getNodes()[3].getId(),
    ];
    nodeService.getNodes().forEach((n: Node) => {
      if (n.getId() in ids) {
        nodeService.selectNode(n.getId());
      }
    });

    nodeService.unselectAllNodes();

    nodeService.getNodes().forEach((n: Node) => {
      expect(n.selected()).toBe(false);
      expect(nodeService.isNodeSelected(n.getId())).toBe(false);
    });
    expect(nodeService.getSelectedNodes().length).toBe(0);
  });
});
