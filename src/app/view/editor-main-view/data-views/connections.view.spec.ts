import {DataService} from "../../../services/data/data.service";
import {NodeService} from "../../../services/data/node.service";
import {ResourceService} from "../../../services/data/resource.service";
import {TrainrunService} from "../../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../../services/data/trainrunsection.service";
import {StammdatenService} from "../../../services/data/stammdaten.service";
import {NoteService} from "../../../services/data/note.service";
import {Node} from "../../../models/node.model";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {LabelGroupService} from "../../../services/data/labelgroup.service";
import {LabelService} from "../../../services/data/label.service";
import {NetzgrafikColoringService} from "../../../services/data/netzgrafikColoring.service";
import {UndoService} from "../../../services/data/undo.service";
import {CopyService} from "../../../services/data/copy.service";
import {LogService} from "../../../logger/log.service";
import {LogPublishersService} from "../../../logger/log.publishers.service";
import {FilterService} from "../../../services/ui/filter.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {LoadPerlenketteService} from "../../../perlenkette/service/load-perlenkette.service";
import {NetzgrafikUnitTesting} from "../../../../integration-testing/netzgrafik.unit.testing";
import {ConnectionsView} from "./connections.view";

describe("Connections View", () => {
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
  let copyService: CopyService = null;
  let uiInteractionService: UiInteractionService = null;
  let loadPerlenketteService: LoadPerlenketteService = null;
  let undoService: UndoService = null;

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

    loadPerlenketteService = new LoadPerlenketteService(
      trainrunService,
      trainrunSectionService,
      nodeService,
      filterService,
    );

    uiInteractionService = new UiInteractionService(
      filterService,
      nodeService,
      noteService,
      stammdatenService,
      trainrunSectionService,
      trainrunService,
      netzgrafikColoringService,
      loadPerlenketteService,
    );

    undoService = new UndoService(
      dataService,
      nodeService,
      noteService,
      trainrunService,
      filterService,
    );

    copyService = new CopyService(
      dataService,
      trainrunService,
      trainrunSectionService,
      nodeService,
      noteService,
      filterService,
      uiInteractionService,
      undoService,
    );
  });

  it("ConnectionsView.displayConnectionPinPort1 - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const node = nodeService.getNodeFromId(2);
    const con = node.getConnectionFromId(2);
    const flag = ConnectionsView.displayConnectionPinPort1(con, node);
    expect(flag).toBe(false);
  });

  it("ConnectionsView.displayConnectionPinPort1 - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const node = nodeService.getNodeFromId(2);
    const con = node.getConnectionFromId(2);
    trainrunService.setTrainrunAsSelected(4);
    const flag = ConnectionsView.displayConnectionPinPort1(con, node);
    expect(flag).toBe(true);
  });

  it("ConnectionsView.displayConnectionPinPort2 - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const node = nodeService.getNodeFromId(2);
    const con = node.getConnectionFromId(2);
    const flag = ConnectionsView.displayConnectionPinPort2(con, node);
    expect(flag).toBe(false);
  });

  it("ConnectionsView.displayConnectionPinPort2 - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const node = nodeService.getNodeFromId(2);
    const con = node.getConnectionFromId(2);
    trainrunService.setTrainrunAsSelected(2);
    const flag = ConnectionsView.displayConnectionPinPort2(con, node);
    expect(flag).toBe(true);
  });

  it("ConnectionsView.displayConnection - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const node = nodeService.getNodeFromId(2);
    const con = node.getConnectionFromId(2);
    const flag = ConnectionsView.displayConnection(con, node);
    expect(flag).toBe(false);
  });

  it("ConnectionsView.displayConnection - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const node = nodeService.getNodeFromId(2);
    const con = node.getConnectionFromId(2);
    trainrunService.setTrainrunAsSelected(4);
    const flag = ConnectionsView.displayConnection(con, node);
    expect(flag).toBe(true);
  });

  it("ConnectionsView.getSelectedTrainrunId - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const node = nodeService.getNodeFromId(2);
    const con = node.getConnectionFromId(2);
    const flag = ConnectionsView.getSelectedTrainrunId(con, node);
    expect(flag).toBe(null);
  });

  it("ConnectionsView.getSelectedTrainrunId - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const node = nodeService.getNodeFromId(2);
    const con = node.getConnectionFromId(2);
    trainrunService.setTrainrunAsSelected(4);
    const flag = ConnectionsView.getSelectedTrainrunId(con, node);
    expect(flag).toBe(4);
  });

  it("ConnectionsView.getSelectedTrainrunId - 003", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const node = nodeService.getNodeFromId(2);
    const con = node.getConnectionFromId(2);
    trainrunService.setTrainrunAsSelected(2);
    const flag = ConnectionsView.getSelectedTrainrunId(con, node);
    expect(flag).toBe(2);
  });

  it("ConnectionsView.getTrainrunSectionPort1 - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const node = nodeService.getNodeFromId(2);
    const con = node.getConnectionFromId(2);
    const ts = ConnectionsView.getTrainrunSectionPort1(con, node);
    expect(ts.getId()).toBe(7);
  });

  it("ConnectionsView.getTrainrunSectionPort2 - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const node = nodeService.getNodeFromId(2);
    const con = node.getConnectionFromId(2);
    const ts = ConnectionsView.getTrainrunSectionPort2(con, node);
    expect(ts.getId()).toBe(4);
  });
});
