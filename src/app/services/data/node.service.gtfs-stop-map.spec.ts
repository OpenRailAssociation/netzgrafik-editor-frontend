import {DataService} from "../data/data.service";
import {NodeService} from "../data/node.service";
import {ResourceService} from "../data/resource.service";
import {TrainrunService} from "../data/trainrun.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {StammdatenService} from "../data/stammdaten.service";
import {NoteService} from "../data/note.service";
import {LogService} from "../../logger/log.service";
import {LogPublishersService} from "../../logger/log.publishers.service";
import {LabelGroupService} from "../data/labelgroup.service";
import {LabelService} from "./label.service";
import {NetzgrafikUnitTesting} from "../../../integration-testing/netzgrafik.unit.testing";
import {FilterService} from "../ui/filter.service";
import {NetzgrafikColoringService} from "../data/netzgrafikColoring.service";
import {Node} from "../../models/node.model";

describe("NodeService GTFS stop map", () => {
  let dataService: DataService;
  let nodeService: NodeService;
  let resourceService: ResourceService;
  let trainrunService: TrainrunService;
  let trainrunSectionService: TrainrunSectionService;
  let stammdatenService: StammdatenService;
  let noteService: NoteService;
  let logService: LogService;
  let logPublishersService: LogPublishersService;
  let labelGroupService: LabelGroupService;
  let labelService: LabelService;
  let filterService: FilterService;
  let netzgrafikColoringService: NetzgrafikColoringService;

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

  it("forces GTFS stop nodes to stop and all other transitions to non-stop", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());

    const nodes = nodeService.getNodes();
    const nodesByTrainrunId = new Map<number, Node[]>();
    nodes.forEach((node) => {
      node.getTransitions().forEach((transition) => {
        const trainrunId = transition.getTrainrun().getId();
        if (!nodesByTrainrunId.has(trainrunId)) {
          nodesByTrainrunId.set(trainrunId, []);
        }
        const nodesForTrainrun = nodesByTrainrunId.get(trainrunId)!;
        if (!nodesForTrainrun.includes(node)) {
          nodesForTrainrun.push(node);
        }
      });
    });

    const trainrunEntry = Array.from(nodesByTrainrunId.entries()).find(([, trainrunNodes]) => trainrunNodes.length >= 2);
    expect(trainrunEntry).toBeDefined();

    const [trainrunId, trainrunNodes] = trainrunEntry!;
    const nodeWithTransition = trainrunNodes[0];
    const otherNodeWithSameTrainrun = trainrunNodes[1];
    const stopNodeId = nodeWithTransition.getId();

    nodes.forEach((node) => {
      node.getTransitions().forEach((candidate) => candidate.setIsNonStopTransit(false));
    });

    nodeService.applyGtfsInitialStopNodeIdsByTrainrun(new Map([[trainrunId, [stopNodeId]]]));

    expect(getTransitionForTrainrun(nodeWithTransition, trainrunId)?.getIsNonStopTransit()).toBeFalse();
    expect(getTransitionForTrainrun(otherNodeWithSameTrainrun, trainrunId)?.getIsNonStopTransit()).toBeTrue();
  });
});

function getTransitionForTrainrun(node: Node, trainrunId: number) {
  return node.getTransitions().find((transition) => transition.getTrainrun().getId() === trainrunId);
}