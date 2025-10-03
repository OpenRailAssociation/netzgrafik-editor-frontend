import {NodeService} from "../app/services/data/node.service";
import {TrainrunService} from "../app/services/data/trainrun.service";
import {TrainrunSectionService} from "../app/services/data/trainrunsection.service";
import {StammdatenService} from "../app/services/data/stammdaten.service";
import {DataService} from "../app/services/data/data.service";
import {Node} from "../app/models/node.model";
import {TrainrunSection} from "../app/models/trainrunsection.model";
import {PortAlignment, TrainrunSectionText} from "../app/data-structures/technical.data.structures";
import {ResourceService} from "../app/services/data/resource.service";
import {LogService} from "../app/logger/log.service";
import {LogPublishersService} from "../app/logger/log.publishers.service";
import {NetzgrafikUnitTesting} from "./netzgrafik.unit.testing";
import {NoteService} from "../app/services/data/note.service";
import {LabelGroupService} from "../app/services/data/labelgroup.service";
import {LabelService} from "../app/services/data/label.service";
import {LinePatternRefs} from "../app/data-structures/business.data.structures";
import {FilterService} from "../app/services/ui/filter.service";
import {NetzgrafikColoringService} from "../app/services/data/netzgrafikColoring.service";

describe("TrainrunSection Service Test", () => {
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

  it("delete trainrunSection test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);

    trainrunSectionService.deleteTrainrunSection(0);
    expect(trainrunSections.length).toBe(7);
    const trainrunSection0 = trainrunSectionService.getTrainrunSectionFromId(0);
    expect(trainrunSection0).toBe(undefined);

    const node0 = nodeService.getNodeFromId(0);
    expect(node0.getPort(0)).toBe(undefined);
  });

  it("add trainrunSection test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);
    let node1 = nodeService.getNodeFromId(1);
    expect(node1.getTransitions().length).toBe(2);

    trainrunSectionService.createTrainrunSection(0, 1);
    expect(trainrunSections.length).toBe(9);

    const node0 = nodeService.getNodeFromId(0);
    expect(node0.getPorts().length).toBe(3);
    expect(node0.getPorts()[1].getPositionAlignment()).toBe(PortAlignment.Right);
    expect(node0.getPorts()[1].getPositionIndex()).toBe(1);
    node1 = nodeService.getNodeFromId(1);
    expect(node1.getPorts().length).toBe(6);
    expect(node1.getPorts()[1].getPositionAlignment()).toBe(PortAlignment.Left);
    expect(node1.getPorts()[1].getPositionIndex()).toBe(1);

    trainrunSectionService.deleteTrainrunSection(3);
    trainrunService.setTrainrunAsSelected(1);
    trainrunSectionService.createTrainrunSection(0, 1);
    node1 = nodeService.getNodeFromId(1);
    expect(node1.getTransitions().length).toBe(2);

    const trainrunSection = trainrunSectionService.getTrainrunSectionFromId(4);
    expect(trainrunSection.getSourceArrival()).toBe(21);
    expect(trainrunSection.getSourceDeparture()).toBe(39);
    expect(trainrunSection.getTargetArrival()).toBe(49);
    expect(trainrunSection.getTargetDeparture()).toBe(11);
    expect(trainrunSection.getTravelTime()).toBe(10);
  });

  it("delete all trainrunSections test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);

    trainrunSectionService.deleteAllVisibleTrainrunSections();
    expect(trainrunSections.length).toBe(0);
    expect(nodes.length).toBe(5);
    const node1 = nodeService.getNodeFromId(1);
    expect(node1.getTransitions().length).toBe(0);

    const node0 = nodeService.getNodeFromId(0);
    expect(node0.getPort(0)).toBe(undefined);
  });

  it("delete all non visible trainrunSections test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);

    trainrunSectionService.deleteAllNonVisibleTrainrunSections();

    expect(trainrunSections.length).toBe(8);
    expect(nodes.length).toBe(5);
    const node1 = nodeService.getNodeFromId(1);
    expect(node1.getTransitions().length).toBe(2);

    const node0 = nodeService.getNodeFromId(0);
    expect(node0.getPort(0).getId()).toBe(0);
  });

  it("delete all non visible trainrunSections with trainrun category filtering active test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);

    filterService.disableFilterTrainrunCategory(dataService.getTrainrunCategories()[4]);
    trainrunSectionService.deleteAllNonVisibleTrainrunSections();

    expect(trainrunSections.length).toBe(4);
    expect(nodes.length).toBe(5);
    const node1 = nodeService.getNodeFromId(1);
    expect(node1.getTransitions().length).toBe(1);

    const node0 = nodeService.getNodeFromId(0);
    expect(node0.getPort(0).getId()).toBe(0);
  });

  it("compute arrival and departure time test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    let computedTimes = TrainrunSectionService.computeArrivalAndDeparture(
      2,
      trainrunSections[1],
      false,
      nodes[1].getTrainrunCategoryHaltezeit(),
    );
    expect(computedTimes.nodeFromDepartureTime).toBe(4);
    expect(computedTimes.nodeFromArrivalTime).toBe(56);
    expect(computedTimes.nodeToDepartureTime).toBe(46);
    expect(computedTimes.nodeToArrivalTime).toBe(14);

    computedTimes = TrainrunSectionService.computeArrivalAndDeparture(
      2,
      trainrunSections[1],
      true,
      nodes[1].getTrainrunCategoryHaltezeit(),
    );
    expect(computedTimes.nodeFromDepartureTime).toBe(2);
    expect(computedTimes.nodeFromArrivalTime).toBe(58);
    expect(computedTimes.nodeToDepartureTime).toBe(48);
    expect(computedTimes.nodeToArrivalTime).toBe(12);

    computedTimes = TrainrunSectionService.computeArrivalAndDeparture(
      56,
      trainrunSections[1],
      false,
      nodes[1].getTrainrunCategoryHaltezeit(),
    );
    expect(computedTimes.nodeFromDepartureTime).toBe(58);
    expect(computedTimes.nodeFromArrivalTime).toBe(2);
    expect(computedTimes.nodeToDepartureTime).toBe(52);
    expect(computedTimes.nodeToArrivalTime).toBe(8);
  });

  it("update trainrunSection time test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    trainrunSectionService.updateTrainrunSectionTime(0, 58, 2, 12, 48, 10, 10);

    const trainrunSection = trainrunSectionService.getTrainrunSectionFromId(0);
    expect(trainrunSection.getSourceArrival()).toBe(58);
    expect(trainrunSection.getSourceDeparture()).toBe(2);
    expect(trainrunSection.getTargetArrival()).toBe(12);
    expect(trainrunSection.getTargetDeparture()).toBe(48);
  });

  it("propagate time test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    trainrunSectionService.updateTrainrunSectionTime(0, 58, 2, 12, 48, 10, 10);
    trainrunSectionService.propagateTimeAlongTrainrun(0, 0);
    trainrunSectionService.propagateTimeAlongTrainrun(0, 1);

    const trainrunSection = trainrunSectionService.getTrainrunSectionFromId(1);
    expect(trainrunSection.getSourceArrival()).toBe(46);
    expect(trainrunSection.getSourceDeparture()).toBe(14);
    expect(trainrunSection.getTargetArrival()).toBe(24);
    expect(trainrunSection.getTargetDeparture()).toBe(36);
  });

  it("reconnect trainrunSection test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    let node0 = nodeService.getNodeFromId(0);
    expect(node0.getPorts().length).toBe(2);
    let node2 = nodeService.getNodeFromId(2);
    expect(node2.getPorts().length).toBe(6);
    let node1 = nodeService.getNodeFromId(1);
    expect(node1.getPort(4).getPositionAlignment()).toBe(PortAlignment.Right);

    trainrunSectionService.reconnectTrainrunSection(1, 0, 2, 2, 1);

    node2 = nodeService.getNodeFromId(2);
    expect(node2.getPorts().length).toBe(5);
    node0 = nodeService.getNodeFromId(0);
    expect(node0.getPorts().length).toBe(3);
    node1 = nodeService.getNodeFromId(1);
    expect(node1.getPort(4).getPositionAlignment()).toBe(PortAlignment.Left);
  });

  it("get all trainrunsections for trainrun test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    const trainrunSections0 = trainrunSectionService.getAllTrainrunSectionsForTrainrun(0);
    const trainrunSections1 = trainrunSectionService.getAllTrainrunSectionsForTrainrun(1);

    expect(trainrunSections0.length).toBe(2);
    expect(trainrunSections0[0].getId()).toBe(0);
    expect(trainrunSections0[1].getId()).toBe(1);
    expect(trainrunSections1.length).toBe(1);
    expect(trainrunSections1[0].getId()).toBe(2);
  });

  it("delete trainrunsections with trainrun test", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);

    trainrunSectionService.deleteAllTrainrunSectionsOfTrainrun(0);
    expect(trainrunSections.length).toBe(6);

    trainrunSectionService.deleteAllTrainrunSectionsOfTrainrun(1);
    expect(trainrunSections.length).toBe(5);
  });

  it("check consecutive time", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);

    const allTrainrunSections = trainrunSectionService.getTrainrunSections();
    allTrainrunSections.forEach((trs) => {
      trs.setSourceDepartureConsecutiveTime(undefined);
      trs.setSourceArrivalConsecutiveTime(undefined);
      trs.setTargetDepartureConsecutiveTime(undefined);
      trs.setTargetArrivalConsecutiveTime(undefined);
    });
    trainrunService.propagateInitialConsecutiveTimes();
    const startNode = trainrunService.getStartNodeWithTrainrunId(2);
    const startTrainrunSection = startNode.getStartTrainrunSection(2);

    expect(startTrainrunSection.getSourceDepartureConsecutiveTime()).toBe(0);
    expect(startTrainrunSection.getSourceArrivalConsecutiveTime()).toBe(180);
    expect(startTrainrunSection.getTargetDepartureConsecutiveTime()).toBe(141);
    expect(startTrainrunSection.getTargetArrivalConsecutiveTime()).toBe(39);

    const nextTrainrunSection = startNode
      .getOppositeNode(startTrainrunSection)
      .getNextTrainrunSection(startTrainrunSection);
    expect(nextTrainrunSection.getSourceDepartureConsecutiveTime()).toBe(39);
    expect(nextTrainrunSection.getSourceArrivalConsecutiveTime()).toBe(141);
    expect(nextTrainrunSection.getTargetDepartureConsecutiveTime()).toBe(131);
    expect(nextTrainrunSection.getTargetArrivalConsecutiveTime()).toBe(49);
  });

  it("check consecutive time : travel time 60min overflow ", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);

    const allTrainrunSections = trainrunSectionService.getTrainrunSections();
    allTrainrunSections.forEach((trs) => {
      trs.setSourceDepartureConsecutiveTime(undefined);
      trs.setSourceArrivalConsecutiveTime(undefined);
      trs.setTargetDepartureConsecutiveTime(undefined);
      trs.setTargetArrivalConsecutiveTime(undefined);
    });
    const startNode = trainrunService.getStartNodeWithTrainrunId(2);
    const trainrunSection = startNode.getStartTrainrunSection(2);
    trainrunSection.setTravelTime(123);
    trainrunService.propagateInitialConsecutiveTimes();
    const startTrainrunSection = startNode.getStartTrainrunSection(2);

    expect(startTrainrunSection.getSourceDepartureConsecutiveTime()).toBe(0);
    expect(startTrainrunSection.getSourceArrivalConsecutiveTime()).toBe(420);
    expect(startTrainrunSection.getTargetDepartureConsecutiveTime()).toBe(261);
    expect(startTrainrunSection.getTargetArrivalConsecutiveTime()).toBe(159);

    const nextTrainrunSection = startNode
      .getOppositeNode(startTrainrunSection)
      .getNextTrainrunSection(startTrainrunSection);
    expect(nextTrainrunSection.getSourceDepartureConsecutiveTime()).toBe(159);
    expect(nextTrainrunSection.getSourceArrivalConsecutiveTime()).toBe(261);
    expect(nextTrainrunSection.getTargetDepartureConsecutiveTime()).toBe(251);
    expect(nextTrainrunSection.getTargetArrivalConsecutiveTime()).toBe(169);
  });

  it("path router check", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);
    const ts = trainrunSectionService.getTrainrunSectionFromId(0);
    ts.routeEdgeAndPlaceText();
    const path = ts.getPath();
    expect(path[0].getX()).toBe(130);
    expect(path[0].getY()).toBe(48);
    expect(path[1].getX()).toBe(194);
    expect(path[1].getY()).toBe(48);
    expect(path[2].getX()).toBe(254);
    expect(path[2].getY()).toBe(48);
    expect(path[3].getX()).toBe(318);
    expect(path[3].getY()).toBe(48);
    expect(ts.getSourcePortId()).toBe(0);
    expect(ts.getTargetPortId()).toBe(1);
    expect(ts.getNumberOfStops()).toBe(0);

    expect(ts.getTextPositionX(TrainrunSectionText.TargetArrival)).toBe(300);
    expect(ts.getTextPositionX(TrainrunSectionText.TargetDeparture)).toBe(272);
    expect(ts.getTextPositionX(TrainrunSectionText.SourceArrival)).toBe(148);
    expect(ts.getTextPositionX(TrainrunSectionText.SourceDeparture)).toBe(176);
    expect(ts.getTextPositionX(TrainrunSectionText.TrainrunSectionTravelTime)).toBe(224);

    expect(ts.getTextPositionY(TrainrunSectionText.TargetArrival)).toBe(36);
    expect(ts.getTextPositionY(TrainrunSectionText.TargetDeparture)).toBe(60);
    expect(ts.getTextPositionY(TrainrunSectionText.SourceArrival)).toBe(60);
    expect(ts.getTextPositionY(TrainrunSectionText.SourceDeparture)).toBe(36);
    expect(ts.getTextPositionY(TrainrunSectionText.TrainrunSectionTravelTime)).toBe(36);

    expect(ts.getPositionAtSourceNode().getX()).toBe(130);
    expect(ts.getPositionAtSourceNode().getY()).toBe(48);
    expect(ts.getPositionAtTargetNode().getX()).toBe(318);
    expect(ts.getPositionAtTargetNode().getY()).toBe(48);
    expect(ts.getFrequency()).toBe(60);
    expect(ts.getFrequencyLinePatternRef()).toBe(LinePatternRefs.Freq60);
    expect(ts.getTimeCategoryLinePatternRef()).toBe(LinePatternRefs.TimeCat7_24);

    const tsDto = ts.getDto();
    expect(tsDto.id).toBe(ts.getId());
  });

  it("trainrun check", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(trainrunSections.length).toBe(8);
    const ts = trainrunSectionService.getTrainrunSectionFromId(0);
    const trainrun = ts.getTrainrun();
    const trainrunDto = trainrun.getDto();
    expect(trainrunDto.id).toBe(trainrun.getId());
    expect(trainrun.getTimeCategoryShortName()).toBe("7/24");
    expect(trainrun.getTitle()).toBe("1");
    expect(trainrun.getCategoryColorRef()).toBe("IC");
    trainrun.setTitle("qwertz");
    expect(trainrun.getTitle()).toBe("qwertz");
  });
});
