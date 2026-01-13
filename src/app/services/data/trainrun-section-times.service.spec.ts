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
import {TrainrunSectionTimesService} from "./trainrun-section-times.service";
import {LoadPerlenketteService} from "../../perlenkette/service/load-perlenkette.service";

describe("TrainrunSectionTimesService", () => {
  let dataService: DataService;
  let nodeService: NodeService;
  let resourceService: ResourceService;
  let trainrunService: TrainrunService;
  let trainrunSectionService: TrainrunSectionService;
  let stammdatenService: StammdatenService;
  let noteService: NoteService;
  let nodes: Node[];
  let trainrunSections: TrainrunSection[];
  let logService: LogService;
  let logPublishersService: LogPublishersService;
  let labelGroupService: LabelGroupService;
  let labelService: LabelService;
  let filterService: FilterService;
  let netzgrafikColoringService: NetzgrafikColoringService;
  let loadPerlenketteService: LoadPerlenketteService;
  let trainrunSectionTimesService: TrainrunSectionTimesService;

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
    loadPerlenketteService = new LoadPerlenketteService(
      trainrunService,
      trainrunSectionService,
      nodeService,
      filterService,
    );
    trainrunSectionTimesService = new TrainrunSectionTimesService(
      trainrunService,
      trainrunSectionService,
      filterService,
      loadPerlenketteService,
    );

    nodeService.nodes.subscribe((updatesNodes) => (nodes = updatesNodes));
    trainrunSectionService.trainrunSections.subscribe(
      (updatesTrainrunSections) => (trainrunSections = updatesTrainrunSections),
    );

    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
  });

  describe("getTimeStructure", () => {
    const testCases = [
      {
        name: "single section, source on the left",
        id: 1,
        expectedTimeStructure: {
          leftDepartureTime: 12,
          leftArrivalTime: 48,
          rightDepartureTime: 38,
          rightArrivalTime: 22,
          travelTime: 10,
          bottomTravelTime: 10,
        },
      },
      {
        name: "single section, source on the right",
        id: 7,
        expectedTimeStructure: {
          leftDepartureTime: 50,
          leftArrivalTime: 10,
          rightDepartureTime: 0,
          rightArrivalTime: 0,
          travelTime: 10,
          bottomTravelTime: 10,
        },
      },
      {
        name: "multiple sections, source on the left",
        id: 4,
        expectedTimeStructure: {
          leftDepartureTime: 0,
          leftArrivalTime: 0,
          rightDepartureTime: 11,
          rightArrivalTime: 49,
          travelTime: 49,
          bottomTravelTime: 49,
        },
      },
    ];

    for (const {name, id, expectedTimeStructure} of testCases) {
      it(`${name} (section ${id})`, () => {
        const ts = trainrunSectionService.getTrainrunSectionFromId(id);
        trainrunSectionTimesService.setTrainrunSection(ts);
        const timeStructure = trainrunSectionTimesService.getTimeStructure();
        expect(timeStructure).toEqual(expectedTimeStructure);
      });
    }
  });

  describe("update", () => {
    const trainrunSectionId = 1;
    const originalTimeStructure = {
      leftDepartureTime: 12,
      leftArrivalTime: 48,
      rightDepartureTime: 38,
      rightArrivalTime: 22,
      travelTime: 10,
      bottomTravelTime: 10,
    };

    const onChanged = {
      leftDepartureTime: () => trainrunSectionTimesService.onNodeLeftDepartureTimeChanged(),
      rightDepartureTime: () => trainrunSectionTimesService.onNodeRightDepartureTimeChanged(),
      leftArrivalTime: () => trainrunSectionTimesService.onNodeLeftArrivalTimeChanged(),
      rightArrivalTime: () => trainrunSectionTimesService.onNodeRightArrivalTimeChanged(),
      travelTime: () => trainrunSectionTimesService.onTravelTimeChanged(),
    };

    const testCases = [
      {
        key: "leftDepartureTime" as const,
        value: 15,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 15,
          leftArrivalTime: 45,
          rightDepartureTime: 35,
          rightArrivalTime: 25,
        },
      },
      {
        key: "rightDepartureTime" as const,
        value: 35,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 15,
          leftArrivalTime: 45,
          rightDepartureTime: 35,
          rightArrivalTime: 25,
        },
      },
      {
        key: "leftArrivalTime" as const,
        value: 51,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 9,
          leftArrivalTime: 51,
          rightDepartureTime: 41,
          rightArrivalTime: 19,
        },
      },
      {
        key: "rightArrivalTime" as const,
        value: 3,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 53,
          leftArrivalTime: 7,
          rightDepartureTime: 57,
          rightArrivalTime: 3,
        },
      },
      {
        key: "travelTime" as const,
        value: 20,
        expectedTimeStructure: {
          ...originalTimeStructure,
          rightDepartureTime: 28,
          rightArrivalTime: 32,
          travelTime: 20,
          bottomTravelTime: 20,
        },
      },
      {
        rightLock: true,
        key: "leftDepartureTime" as const,
        value: 15,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 15,
          leftArrivalTime: 45,
          travelTime: 7,
          bottomTravelTime: 7,
        },
      },
      {
        rightLock: true,
        key: "leftArrivalTime" as const,
        value: 46,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 14,
          leftArrivalTime: 46,
          travelTime: 8,
          bottomTravelTime: 8,
        },
      },
      {
        rightLock: true,
        key: "travelTime" as const,
        value: 20,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 2,
          leftArrivalTime: 58,
          travelTime: 20,
          bottomTravelTime: 20,
        },
      },

      // negative times tests
      {
        key: "leftDepartureTime" as const,
        value: -45,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 15,
          leftArrivalTime: 45,
          rightDepartureTime: 35,
          rightArrivalTime: 25,
        },
      },
      {
        key: "rightDepartureTime" as const,
        value: -25,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 15,
          leftArrivalTime: 45,
          rightDepartureTime: 35,
          rightArrivalTime: 25,
        },
      },
      {
        key: "leftArrivalTime" as const,
        value: -9,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 9,
          leftArrivalTime: 51,
          rightDepartureTime: 41,
          rightArrivalTime: 19,
        },
      },
      {
        key: "rightArrivalTime" as const,
        value: -57,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 53,
          leftArrivalTime: 7,
          rightDepartureTime: 57,
          rightArrivalTime: 3,
        },
      },

      // asymmetric tests
      {
        leftAsymmetry: true,
        key: "leftDepartureTime" as const,
        value: 15,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 15,
          leftArrivalTime: 45,
          rightDepartureTime: 35,
          rightArrivalTime: 25,
        },
      },
      {
        leftAsymmetry: true,
        leftLock: true,
        key: "leftDepartureTime" as const,
        value: 15,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 15,
          rightDepartureTime: 35,
          rightArrivalTime: 25,
          bottomTravelTime: 13,
        },
      },
      {
        rightLock: true,
        leftAsymmetry: true,
        key: "leftDepartureTime" as const,
        value: 15,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 15,
          travelTime: 7,
        },
      },
      {
        leftAsymmetry: true,
        rightAsymmetry: true,
        key: "leftDepartureTime" as const,
        value: 15,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 15,
          rightArrivalTime: 25,
        },
      },
      {
        rightAsymmetry: true,
        key: "travelTime" as const,
        value: 20,
        expectedTimeStructure: {
          ...originalTimeStructure,
          rightArrivalTime: 32,
          travelTime: 20,
        },
      },
      {
        leftAsymmetry: true,
        rightLock: true,
        key: "travelTime" as const,
        value: 20,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 2,
          travelTime: 20,
        },
      },
      {
        rightAsymmetry: true,
        key: "rightArrivalTime" as const,
        value: 3,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 53,
          leftArrivalTime: 7,
          rightDepartureTime: 57,
          rightArrivalTime: 3,
        },
      },
      {
        rightLock: true,
        rightAsymmetry: true,
        key: "rightArrivalTime" as const,
        value: 3,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 53,
          leftArrivalTime: 7,
          rightArrivalTime: 3,
          bottomTravelTime: 29,
        },
      },
      {
        leftAsymmetry: true,
        rightAsymmetry: true,
        key: "rightArrivalTime" as const,
        value: 3,
        expectedTimeStructure: {
          ...originalTimeStructure,
          leftDepartureTime: 53,
          rightArrivalTime: 3,
        },
      },
    ];

    for (const {
      leftLock,
      rightLock,
      leftAsymmetry,
      rightAsymmetry,
      key,
      value,
      expectedTimeStructure,
    } of testCases) {
      const options = {
        leftLock,
        rightLock,
        leftAsymmetry,
        rightAsymmetry,
      };
      const optionsDesc = Object.entries(options)
        .filter(([option, enabled]) => enabled)
        .map(([option, enabled]) => `with ${option}`)
        .join(" ");
      it(`set ${key} to ${value} ${optionsDesc}`, () => {
        const ts = trainrunSectionService.getTrainrunSectionFromId(trainrunSectionId);
        trainrunSectionTimesService.setTrainrunSection(ts);

        // Apply the lock update, if any
        if (leftLock || rightLock) {
          const lockStructure = trainrunSectionTimesService.getLockStructure();
          lockStructure.travelTimeLock = false;
          lockStructure.leftLock = leftLock;
          lockStructure.rightLock = rightLock;
          trainrunSectionTimesService.updateTrainrunSectionTimeLock();
        }

        // Apply the symmetry update, if any
        if (leftAsymmetry || rightAsymmetry) {
          const symmetryStructure = trainrunSectionTimesService.getSymmetryStructure();
          symmetryStructure.leftSymmetry = !leftAsymmetry;
          symmetryStructure.rightSymmetry = !rightAsymmetry;
          // TODO: apply update
        }

        // Apply the time update
        const timeStructure = trainrunSectionTimesService.getTimeStructure();
        timeStructure[key] = value;
        onChanged[key]();

        // Reload time structure from model and check
        trainrunSectionTimesService.setTrainrunSection(ts);
        const updatedTimeStructure = trainrunSectionTimesService.getTimeStructure();
        expect(updatedTimeStructure).toEqual(expectedTimeStructure);
      });
    }
  });

  describe("update with travel time > 60", () => {
    it("set leftDepartureTime to 15 with rightLock", () => {
      const ts = trainrunSectionService.getTrainrunSectionFromId(1);
      trainrunSectionTimesService.setTrainrunSection(ts);

      // Set travel time to 2 hours and 10 minutes
      let timeStructure = trainrunSectionTimesService.getTimeStructure();
      timeStructure.travelTime = 130;
      trainrunSectionTimesService.onTravelTimeChanged();

      // Enable right lock
      const lockStructure = trainrunSectionTimesService.getLockStructure();
      lockStructure.travelTimeLock = false;
      lockStructure.rightLock = true;
      trainrunSectionTimesService.updateTrainrunSectionTimeLock();

      // Update left departure time
      timeStructure = trainrunSectionTimesService.getTimeStructure();
      timeStructure.leftDepartureTime = 15;
      trainrunSectionTimesService.onNodeLeftDepartureTimeChanged();

      // Reload time structure from model and check that travel time is still > 2 hours
      trainrunSectionTimesService.setTrainrunSection(ts);
      const updatedTimeStructure = trainrunSectionTimesService.getTimeStructure();
      expect(updatedTimeStructure.travelTime).toEqual(127);
    });
  });
});
