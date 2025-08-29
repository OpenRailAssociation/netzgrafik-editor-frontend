import {NodeService} from "../app/services/data/node.service";
import {TrainrunService} from "../app/services/data/trainrun.service";
import {TrainrunSectionService} from "../app/services/data/trainrunsection.service";
import {StammdatenService} from "../app/services/data/stammdaten.service";
import {DataService} from "../app/services/data/data.service";
import {ResourceService} from "../app/services/data/resource.service";
import {LogService} from "../app/logger/log.service";
import {LogPublishersService} from "../app/logger/log.publishers.service";
import {NetzgrafikUnitTestingReconnectTrainrunSection} from "./netzgrafik.unit.test.reconnect.trainrunsections";
import {NoteService} from "../app/services/data/note.service";
import {LabelGroupService} from "../app/services/data/labelgroup.service";
import {LabelService} from "../app/services/data/label.service";
import {FilterService} from "../app/services/ui/filter.service";
import {NetzgrafikColoringService} from "../app/services/data/netzgrafikColoring.service";

describe("Reconnect TrainrunSection Test", () => {
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

  it("Reconnect trainrunSection and ensure a cyclic free trainrun test", () => {
    dataService.loadNetzgrafikDto(
      NetzgrafikUnitTestingReconnectTrainrunSection.getUnitTestReconnectTrainrunSectionNetzgrafik(),
    );
    const trainrunSectionOfInterest1 = trainrunSectionService.getTrainrunSectionFromId(1);

    trainrunSectionService.reconnectTrainrunSection(
      1,
      7,
      trainrunSectionOfInterest1.getId(),
      trainrunSectionOfInterest1.getTargetNodeId(),
      trainrunSectionOfInterest1.getSourceNodeId(),
    );

    const endNode1 = trainrunService.getEndNode(
      trainrunSectionOfInterest1.getSourceNode(),
      trainrunSectionOfInterest1,
    );
    expect(endNode1.getId()).toBe(8);

    const trainrunSectionOfInterest2 = trainrunSectionService.getTrainrunSectionFromId(2);
    trainrunSectionService.reconnectTrainrunSection(
      1,
      8,
      trainrunSectionOfInterest2.getId(),
      trainrunSectionOfInterest2.getTargetNodeId(),
      trainrunSectionOfInterest2.getSourceNodeId(),
    );

    const endNode2 = trainrunService.getEndNode(
      trainrunSectionOfInterest2.getSourceNode(),
      trainrunSectionOfInterest2,
    );
    expect(endNode2.getId()).toBe(1);

    const trainrunSectionOfInterest4 = trainrunSectionService.getTrainrunSectionFromId(4);
    trainrunSectionService.reconnectTrainrunSection(
      1,
      8,
      trainrunSectionOfInterest4.getId(),
      trainrunSectionOfInterest4.getTargetNodeId(),
      trainrunSectionOfInterest4.getSourceNodeId(),
    );

    const endNode4 = trainrunService.getEndNode(
      trainrunSectionOfInterest4.getSourceNode(),
      trainrunSectionOfInterest4,
    );
    expect(endNode4.getId()).toBe(7);

    trainrunSectionService.reconnectTrainrunSection(
      7,
      1,
      trainrunSectionOfInterest1.getId(),
      trainrunSectionOfInterest1.getTargetNodeId(),
      trainrunSectionOfInterest1.getSourceNodeId(),
    );

    const nLTH = nodeService.getNodeFromId(8);
    expect(nLTH.getTransitions().length).toBe(1);

    const nRTR = nodeService.getNodeFromId(7);
    expect(nRTR.getTransitions().length).toBe(0);

    const nBN = nodeService.getNodeFromId(0);
    expect(nBN.getTransitions().length).toBe(0);

    const nOL = nodeService.getNodeFromId(1);
    expect(nOL.getTransitions().length).toBe(1);
  });
});
