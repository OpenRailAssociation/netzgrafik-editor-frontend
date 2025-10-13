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
import {LabelService} from "../data/label.service";
import {NetzgrafikUnitTesting} from "../../../integration-testing/netzgrafik.unit.testing";
import {FilterService} from "../ui/filter.service";
import {NetzgrafikColoringService} from "../data/netzgrafikColoring.service";
import {TrainrunsectionHelper} from "./trainrunsection.helper";
import {TransitionValidator} from "./transition.validator";
import {Transition} from "../../models/transition.model";

describe("TransitionValidator", () => {
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

  it("Validate Test - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);

    const transitionId = ts.getSourceNode().getTransitions()[0].getId();
    const trainrunSections = ts.getSourceNode().getTrainrunSections(transitionId);

    trainrunSections.trainrunSection1.resetTargetArrivalWarning();
    trainrunSections.trainrunSection1.resetTargetDepartureWarning();
    trainrunSections.trainrunSection1.resetSourceArrivalWarning();
    trainrunSections.trainrunSection1.resetSourceDepartureWarning();

    expect(trainrunSections.trainrunSection1.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceDepartureWarning()).toBe(false);

    trainrunSections.trainrunSection2.resetTargetArrivalWarning();
    trainrunSections.trainrunSection2.resetTargetDepartureWarning();
    trainrunSections.trainrunSection2.resetSourceArrivalWarning();
    trainrunSections.trainrunSection2.resetSourceDepartureWarning();

    expect(trainrunSections.trainrunSection2.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceDepartureWarning()).toBe(false);

    TransitionValidator.validateTransition(ts.getSourceNode(), transitionId);

    expect(trainrunSections.trainrunSection1.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceDepartureWarning()).toBe(false);

    expect(trainrunSections.trainrunSection2.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceDepartureWarning()).toBe(false);
  });

  it("Validate Test - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);

    const transitionId = ts.getSourceNode().getTransitions()[0].getId();
    const trainrunSections = ts.getSourceNode().getTrainrunSections(transitionId);
    const nodeHaltezeiten = ts.getSourceNode().getTrainrunCategoryHaltezeit();
    const trainrunHaltezeit =
      nodeHaltezeiten[
        trainrunSections.trainrunSection1.getTrainrun().getTrainrunCategory().fachCategory
      ].haltezeit;
    trainrunSections.trainrunSection2.setSourceDeparture(
      trainrunSections.trainrunSection1.getSourceArrival() - trainrunHaltezeit - 1,
    );
    trainrunSections.trainrunSection2.setTargetDeparture(
      trainrunSections.trainrunSection1.getTargetArrival() - trainrunHaltezeit - 1,
    );

    trainrunSections.trainrunSection1.resetTargetArrivalWarning();
    trainrunSections.trainrunSection1.resetTargetDepartureWarning();
    trainrunSections.trainrunSection1.resetSourceArrivalWarning();
    trainrunSections.trainrunSection1.resetSourceDepartureWarning();

    expect(trainrunSections.trainrunSection1.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceDepartureWarning()).toBe(false);

    trainrunSections.trainrunSection2.resetTargetArrivalWarning();
    trainrunSections.trainrunSection2.resetTargetDepartureWarning();
    trainrunSections.trainrunSection2.resetSourceArrivalWarning();
    trainrunSections.trainrunSection2.resetSourceDepartureWarning();

    expect(trainrunSections.trainrunSection2.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceDepartureWarning()).toBe(false);

    TransitionValidator.validateTransition(ts.getSourceNode(), transitionId);

    expect(trainrunSections.trainrunSection1.hasTargetArrivalWarning()).toBe(true);
    expect(trainrunSections.trainrunSection1.hasTargetDepartureWarning()).toBe(true);
    expect(trainrunSections.trainrunSection1.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceDepartureWarning()).toBe(false);

    expect(trainrunSections.trainrunSection2.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceArrivalWarning()).toBe(true);
    expect(trainrunSections.trainrunSection2.hasSourceDepartureWarning()).toBe(true);
  });

  it("Validate Test - 003", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(4);

    const transitionId = ts.getSourceNode().getTransitions()[0].getId();
    const trainrunSections = ts.getSourceNode().getTrainrunSections(transitionId);
    const nodeHaltezeiten = ts.getTargetNode().getTrainrunCategoryHaltezeit();
    const trainrunHaltezeit =
      nodeHaltezeiten[
        trainrunSections.trainrunSection2.getTrainrun().getTrainrunCategory().fachCategory
      ].haltezeit;
    trainrunSections.trainrunSection1.setSourceDeparture(
      trainrunSections.trainrunSection2.getSourceArrival() - trainrunHaltezeit - 1,
    );
    trainrunSections.trainrunSection1.setTargetDeparture(
      trainrunSections.trainrunSection2.getTargetArrival() - trainrunHaltezeit - 1,
    );

    trainrunSections.trainrunSection1.resetTargetArrivalWarning();
    trainrunSections.trainrunSection1.resetTargetDepartureWarning();
    trainrunSections.trainrunSection1.resetSourceArrivalWarning();
    trainrunSections.trainrunSection1.resetSourceDepartureWarning();

    expect(trainrunSections.trainrunSection1.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceDepartureWarning()).toBe(false);

    trainrunSections.trainrunSection2.resetTargetArrivalWarning();
    trainrunSections.trainrunSection2.resetTargetDepartureWarning();
    trainrunSections.trainrunSection2.resetSourceArrivalWarning();
    trainrunSections.trainrunSection2.resetSourceDepartureWarning();

    expect(trainrunSections.trainrunSection2.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceDepartureWarning()).toBe(false);

    TransitionValidator.validateTransition(ts.getSourceNode(), transitionId);

    expect(trainrunSections.trainrunSection1.hasTargetArrivalWarning()).toBe(true);
    expect(trainrunSections.trainrunSection1.hasTargetDepartureWarning()).toBe(true);
    expect(trainrunSections.trainrunSection1.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceDepartureWarning()).toBe(false);

    expect(trainrunSections.trainrunSection2.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceArrivalWarning()).toBe(true);
    expect(trainrunSections.trainrunSection2.hasSourceDepartureWarning()).toBe(true);
  });

  it("Validate Test - 004", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts1 = trainrunSectionService.getTrainrunSectionFromId(4);
    const ts2 = trainrunSectionService.getTrainrunSectionFromId(5);
    const trainrun = trainrunService.getSelectedOrNewTrainrun();
    trainrunSectionService.createTrainrunSection(ts1.getSourceNodeId(), ts1.getTargetNodeId());
    const ts = trainrunSectionService.getSelectedTrainrunSection();
    trainrunSectionService.createTrainrunSection(ts2.getTargetNodeId(), ts.getSourceNodeId());

    const transitionId = ts
      .getSourceNode()
      .getTransitions()
      .filter((t: Transition) => t.getTrainrun().getId() === ts.getTrainrunId())[0]
      .getId();
    const trainrunSections = ts.getSourceNode().getTrainrunSections(transitionId);

    const nodeHaltezeiten = ts.getTargetNode().getTrainrunCategoryHaltezeit();
    const trainrunHaltezeit =
      nodeHaltezeiten[
        trainrunSections.trainrunSection2.getTrainrun().getTrainrunCategory().fachCategory
      ].haltezeit;
    trainrunSections.trainrunSection1.setSourceDeparture(
      trainrunSections.trainrunSection2.getSourceArrival() - trainrunHaltezeit - 1,
    );
    trainrunSections.trainrunSection1.setTargetDeparture(
      trainrunSections.trainrunSection2.getTargetArrival() - trainrunHaltezeit - 1,
    );

    trainrunSections.trainrunSection1.resetTargetArrivalWarning();
    trainrunSections.trainrunSection1.resetTargetDepartureWarning();
    trainrunSections.trainrunSection1.resetSourceArrivalWarning();
    trainrunSections.trainrunSection1.resetSourceDepartureWarning();

    expect(trainrunSections.trainrunSection1.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceDepartureWarning()).toBe(false);

    trainrunSections.trainrunSection2.resetTargetArrivalWarning();
    trainrunSections.trainrunSection2.resetTargetDepartureWarning();
    trainrunSections.trainrunSection2.resetSourceArrivalWarning();
    trainrunSections.trainrunSection2.resetSourceDepartureWarning();

    expect(trainrunSections.trainrunSection2.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceDepartureWarning()).toBe(false);

    TransitionValidator.validateTransition(ts.getSourceNode(), transitionId);

    expect(trainrunSections.trainrunSection1.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceDepartureWarning()).toBe(false);

    expect(trainrunSections.trainrunSection2.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceDepartureWarning()).toBe(false);
  });

  it("Validate Test - 005", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts1 = trainrunSectionService.getTrainrunSectionFromId(4);
    const ts2 = trainrunSectionService.getTrainrunSectionFromId(5);
    const trainrun = trainrunService.getSelectedOrNewTrainrun();
    trainrunSectionService.createTrainrunSection(ts1.getTargetNodeId(), ts1.getSourceNodeId());
    const ts = trainrunSectionService.getSelectedTrainrunSection();
    trainrunSectionService.createTrainrunSection(ts.getSourceNodeId(), ts2.getTargetNodeId());

    const transitionId = ts
      .getSourceNode()
      .getTransitions()
      .filter((t: Transition) => t.getTrainrun().getId() === ts.getTrainrunId())[0]
      .getId();
    const trainrunSections = ts.getSourceNode().getTrainrunSections(transitionId);

    const nodeHaltezeiten = ts.getTargetNode().getTrainrunCategoryHaltezeit();
    const trainrunHaltezeit =
      nodeHaltezeiten[
        trainrunSections.trainrunSection2.getTrainrun().getTrainrunCategory().fachCategory
      ].haltezeit;
    trainrunSections.trainrunSection1.setSourceDeparture(
      trainrunSections.trainrunSection2.getSourceArrival() - trainrunHaltezeit - 1,
    );
    trainrunSections.trainrunSection1.setTargetDeparture(
      trainrunSections.trainrunSection2.getTargetArrival() - trainrunHaltezeit - 1,
    );

    trainrunSections.trainrunSection1.resetTargetArrivalWarning();
    trainrunSections.trainrunSection1.resetTargetDepartureWarning();
    trainrunSections.trainrunSection1.resetSourceArrivalWarning();
    trainrunSections.trainrunSection1.resetSourceDepartureWarning();

    expect(trainrunSections.trainrunSection1.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceDepartureWarning()).toBe(false);

    trainrunSections.trainrunSection2.resetTargetArrivalWarning();
    trainrunSections.trainrunSection2.resetTargetDepartureWarning();
    trainrunSections.trainrunSection2.resetSourceArrivalWarning();
    trainrunSections.trainrunSection2.resetSourceDepartureWarning();

    expect(trainrunSections.trainrunSection2.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceDepartureWarning()).toBe(false);
  });

  it("Validate Test - 006", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts1 = trainrunSectionService.getTrainrunSectionFromId(4);
    const ts2 = trainrunSectionService.getTrainrunSectionFromId(5);
    const trainrun = trainrunService.getSelectedOrNewTrainrun();
    trainrunSectionService.createTrainrunSection(ts1.getTargetNodeId(), ts1.getSourceNodeId());
    trainrunSectionService.createTrainrunSection(ts2.getTargetNodeId(), ts2.getSourceNodeId());
    const ts = trainrunSectionService.getSelectedTrainrunSection();

    const transitionId = ts
      .getTargetNode()
      .getTransitions()
      .filter((t: Transition) => t.getTrainrun().getId() === ts.getTrainrunId())[0]
      .getId();
    const trainrunSections = ts.getTargetNode().getTrainrunSections(transitionId);

    const nodeHaltezeiten = ts.getTargetNode().getTrainrunCategoryHaltezeit();
    const trainrunHaltezeit =
      nodeHaltezeiten[
        trainrunSections.trainrunSection2.getTrainrun().getTrainrunCategory().fachCategory
      ].haltezeit;
    trainrunSections.trainrunSection1.setSourceDeparture(
      trainrunSections.trainrunSection2.getSourceArrival() - trainrunHaltezeit - 1,
    );
    trainrunSections.trainrunSection2.setTargetDeparture(
      trainrunSections.trainrunSection1.getTargetArrival() - trainrunHaltezeit - 1,
    );

    trainrunSections.trainrunSection1.resetTargetArrivalWarning();
    trainrunSections.trainrunSection1.resetTargetDepartureWarning();
    trainrunSections.trainrunSection1.resetSourceArrivalWarning();
    trainrunSections.trainrunSection1.resetSourceDepartureWarning();

    expect(trainrunSections.trainrunSection1.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceDepartureWarning()).toBe(false);

    trainrunSections.trainrunSection2.resetTargetArrivalWarning();
    trainrunSections.trainrunSection2.resetTargetDepartureWarning();
    trainrunSections.trainrunSection2.resetSourceArrivalWarning();
    trainrunSections.trainrunSection2.resetSourceDepartureWarning();

    expect(trainrunSections.trainrunSection2.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceDepartureWarning()).toBe(false);

    TransitionValidator.validateTransition(ts.getTargetNode(), transitionId);

    expect(trainrunSections.trainrunSection1.hasTargetArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasTargetDepartureWarning()).toBe(false);
    expect(trainrunSections.trainrunSection1.hasSourceArrivalWarning()).toBe(true);
    expect(trainrunSections.trainrunSection1.hasSourceDepartureWarning()).toBe(true);

    expect(trainrunSections.trainrunSection2.hasTargetArrivalWarning()).toBe(true);
    expect(trainrunSections.trainrunSection2.hasTargetDepartureWarning()).toBe(true);
    expect(trainrunSections.trainrunSection2.hasSourceArrivalWarning()).toBe(false);
    expect(trainrunSections.trainrunSection2.hasSourceDepartureWarning()).toBe(false);
  });

  it("Validate Test - 007", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts1 = trainrunSectionService.getTrainrunSectionFromId(4);
    ts1.setSourceDeparture((ts1.getSourceDeparture() + 1) % 60);
    const a = ts1.getSourceArrival();
    const b = ts1.getSourceDeparture();
    expect(ts1.getSourceArrivalWarning().description).toBe("" + a + " + " + b + " = " + (a + b));
  });
});
