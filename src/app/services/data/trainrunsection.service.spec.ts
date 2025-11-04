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

describe("TrainrunSectionService", () => {
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

  it("TrainrunSectionService.updateTrainrunSectionNumberOfStops", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    trainrunSectionService.updateTrainrunSectionNumberOfStops(ts, 0);
    expect(ts.getNumberOfStops()).toBe(0);
    trainrunSectionService.updateTrainrunSectionNumberOfStops(ts, undefined);
    expect(ts.getNumberOfStops()).toBe(undefined);
    trainrunSectionService.updateTrainrunSectionNumberOfStops(ts, 3);
    expect(ts.getNumberOfStops()).toBe(3);
  });

  it("TrainrunSectionService.setTrainrunSectionAsSelected", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    expect(trainrunSectionService.getSelectedTrainrunSection()).toBe(null);
    trainrunSectionService.setTrainrunSectionAsSelected(0);
    expect(trainrunSectionService.getSelectedTrainrunSection().getId()).toBe(0);
  });

  it("TrainrunSectionService.boundMinutesToOneHour", () => {
    expect(TrainrunSectionService.boundMinutesToOneHour(0)).toBe(0);
    expect(TrainrunSectionService.boundMinutesToOneHour(120)).toBe(0);
    expect(TrainrunSectionService.boundMinutesToOneHour(130)).toBe(10);
    expect(TrainrunSectionService.boundMinutesToOneHour(undefined)).toBe(undefined);
    expect(TrainrunSectionService.boundMinutesToOneHour(-30)).toBe(30);
    expect(TrainrunSectionService.boundMinutesToOneHour(-330)).toBe(30);
  });

  it("TrainrunSectionService.propagateTimesForNewTrainrunSection", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const ts = trainrunSectionService.getTrainrunSectionFromId(1);
    expect(ts.getTargetDepartureConsecutiveTime()).toBe(38);
    expect(ts.getTargetArrivalConsecutiveTime()).toBe(22);
    expect(ts.getSourceDepartureConsecutiveTime()).toBe(12);
    expect(ts.getSourceArrivalConsecutiveTime()).toBe(48);
    // should not have any impact
    trainrunSectionService.propagateTimesForNewTrainrunSection(ts);
    expect(ts.getTargetDepartureConsecutiveTime()).toBe(38);
    expect(ts.getTargetArrivalConsecutiveTime()).toBe(22);
    expect(ts.getSourceDepartureConsecutiveTime()).toBe(12);
    expect(ts.getSourceArrivalConsecutiveTime()).toBe(48);
  });

  it("TrainrunSectionService.checkMissingTransitionsAfterDeletion", () => {
    // tests: https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/369
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    trainrunSectionService.deleteAllVisibleTrainrunSections();
    nodeService.deleteAllVisibleNodes();
    noteService.deleteAllVisibleNotes();

    const nodeA = nodeService.addNodeWithPosition(0, 0, "A");
    const nodeB = nodeService.addNodeWithPosition(0, 1, "B");
    const nodeC = nodeService.addNodeWithPosition(0, 2, "C");
    const nodeD = nodeService.addNodeWithPosition(0, 3, "D");
    const nodeE = nodeService.addNodeWithPosition(0, 4, "E");
    const tsAB = trainrunSectionService.createTrainrunSection(nodeA.getId(), nodeB.getId());
    const tsBC = trainrunSectionService.createTrainrunSection(nodeB.getId(), nodeC.getId());
    const tsCD = trainrunSectionService.createTrainrunSection(nodeC.getId(), nodeD.getId());
    const tsDE = trainrunSectionService.createTrainrunSection(nodeD.getId(), nodeE.getId());
    const tsEA = trainrunSectionService.createTrainrunSection(nodeE.getId(), nodeA.getId());

    expect(nodeA.getTransitions().length).toBe(0);
    expect(nodeB.getTransitions().length).toBe(1);
    expect(nodeC.getTransitions().length).toBe(1);
    expect(nodeD.getTransitions().length).toBe(1);
    expect(nodeE.getTransitions().length).toBe(1);

    const transA_AB1 = nodeA.getTransition(tsAB.getId());
    const transA_EA1 = nodeA.getTransition(tsEA.getId());
    expect(transA_AB1).toBe(undefined);
    expect(transA_EA1).toBe(undefined);

    trainrunSectionService.deleteTrainrunSection(
      trainrunSectionService.getTrainrunSections()[1].getId(),
    );

    expect(nodeA.getTransitions().length).toBe(1);
    expect(nodeB.getTransitions().length).toBe(0);
    expect(nodeC.getTransitions().length).toBe(0);
    expect(nodeD.getTransitions().length).toBe(1);
    expect(nodeE.getTransitions().length).toBe(1);

    const transA_AB2 = nodeA.getTransition(tsAB.getId());
    const transA_EA2 = nodeA.getTransition(tsEA.getId());
    expect(transA_AB2.getId()).toBe(transA_EA2.getId());
  });

  describe("setTimeStructureToTrainrunSections", () => {
    const testCases = [
      {
        name: "single section, source on the left",
        id: 1,
        timeStructure: {
          leftDepartureTime: 45,
          rightArrivalTime: 55,
          rightDepartureTime: 30,
          leftArrivalTime: 45,
          travelTime: 10,
          bottomTravelTime: 15,
          stopTime: 0,
          bottomStopTime: 0,
        },
        expectedTrainrunSectionTimes: [
          {
            id: 1,
            sourceDeparture: 45,
            targetArrival: 55,
            targetDeparture: 30,
            sourceArrival: 45,
            travelTime: 10,
            backwardTravelTime: 15,
          },
        ],
      },
      {
        name: "single section, source on the right",
        id: 7,
        timeStructure: {
          leftDepartureTime: 45,
          rightArrivalTime: 55,
          rightDepartureTime: 30,
          leftArrivalTime: 45,
          travelTime: 10,
          bottomTravelTime: 15,
          stopTime: 0,
          bottomStopTime: 0,
        },
        expectedTrainrunSectionTimes: [
          {
            id: 7,
            sourceDeparture: 30,
            targetArrival: 45,
            targetDeparture: 45,
            sourceArrival: 55,
            travelTime: 15,
            backwardTravelTime: 10,
          },
        ],
      },
      {
        name: "multiple sections, source on the left",
        id: 4,
        timeStructure: {
          leftDepartureTime: 45,
          rightArrivalTime: 55,
          rightDepartureTime: 30,
          leftArrivalTime: 45,
          travelTime: 10,
          bottomTravelTime: 15,
          stopTime: 0,
          bottomStopTime: 0,
        },
        expectedTrainrunSectionTimes: [
          {
            id: 3,
            sourceDeparture: 45,
            targetArrival: 53,
            targetDeparture: 33,
            sourceArrival: 45,
            travelTime: 8,
            backwardTravelTime: 12,
          },
          {
            id: 4,
            sourceDeparture: 53,
            targetArrival: 55,
            targetDeparture: 30,
            sourceArrival: 33,
            travelTime: 2,
            backwardTravelTime: 3,
          },
        ],
      },
    ];

    for (const {name, id, timeStructure, expectedTrainrunSectionTimes} of testCases) {
      it(`${name} (section ${id})`, () => {
        dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

        const ts = trainrunSectionService.getTrainrunSectionFromId(id);
        trainrunSectionService.setTimeStructureToTrainrunSections(timeStructure, ts);

        for (const {id, ...expectedTimes} of expectedTrainrunSectionTimes) {
          const ts = trainrunSectionService.getTrainrunSectionFromId(id);
          expect({
            sourceDeparture: ts.getSourceDeparture(),
            targetDeparture: ts.getTargetDeparture(),
            sourceArrival: ts.getSourceArrival(),
            targetArrival: ts.getTargetArrival(),
            travelTime: ts.getTravelTime(),
            backwardTravelTime: ts.getBackwardTravelTime(),
          })
            .withContext(`trainrun section ${id}`)
            .toEqual(expectedTimes);
        }
      });
    }
  });
});
