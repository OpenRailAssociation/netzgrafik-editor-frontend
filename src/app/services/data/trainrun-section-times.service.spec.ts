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
      // TODO: update travel time and arrival time
    ];

    for (const {rightLock, leftAsymmetry, rightAsymmetry, key, value, expectedTimeStructure} of testCases) {
      const optionsDesc = [
        rightLock ? "with rightLock" : null,
        leftAsymmetry ? "with leftAsymmetry" : null,
        rightAsymmetry ? "with rightAsymmetry" : null,
      ].filter((desc) => desc != null).join(' ');
      it(`set ${key} to ${value} ${optionsDesc}`, () => {
        const ts = trainrunSectionService.getTrainrunSectionFromId(trainrunSectionId);
        trainrunSectionTimesService.setTrainrunSection(ts);

        // Apply the lock update, if any
        if (rightLock) {
          const lockStructure = trainrunSectionTimesService.getLockStructure();
          lockStructure.travelTimeLock = false;
          lockStructure.rightLock = true;
          trainrunSectionTimesService.updateTrainrunSectionTimeLock();
        }

        // Apply the symmetry update, if any
        if (leftAsymmetry || rightAsymmetry) {
          const symmetryStructure = trainrunSectionTimesService.getSymmetryStructure();
          if (leftAsymmetry) {
            symmetryStructure.leftSymmetry = false;
          }
          if (rightAsymmetry) {
            symmetryStructure.rightSymmetry = false;
          }
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
});
