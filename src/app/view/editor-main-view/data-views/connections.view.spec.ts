import {DataService} from "../../../services/data/data.service";
import {NodeService} from "../../../services/data/node.service";
import {ResourceService} from "../../../services/data/resource.service";
import {TrainrunService} from "../../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../../services/data/trainrunsection.service";
import {BaseDataService} from "../../../services/data/basedata.service";
import {NoteService} from "../../../services/data/note.service";
import {LabelGroupService} from "../../../services/data/labelgroup.service";
import {LabelService} from "../../../services/data/label.service";
import {NetzgrafikColoringService} from "../../../services/data/netzgrafikColoring.service";
import {LogService} from "../../../logger/log.service";
import {LogPublishersService} from "../../../logger/log.publishers.service";
import {FilterService} from "../../../services/ui/filter.service";
import {NetzgrafikUnitTesting} from "../../../../integration-testing/netzgrafik.unit.testing";
import {ConnectionsView} from "./connections.view";

describe("Connections View", () => {
  let dataService: DataService;
  let nodeService: NodeService;
  let resourceService: ResourceService;
  let trainrunService: TrainrunService;
  let trainrunSectionService: TrainrunSectionService;
  let baseDataService: BaseDataService;
  let noteService: NoteService;
  let logService: LogService = null;
  let logPublishersService: LogPublishersService = null;
  let labelGroupService: LabelGroupService = null;
  let labelService: LabelService = null;
  let filterService: FilterService = null;
  let netzgrafikColoringService: NetzgrafikColoringService = null;

  beforeEach(() => {
    baseDataService = new BaseDataService();
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
    netzgrafikColoringService = new NetzgrafikColoringService();
    dataService = new DataService(
      resourceService,
      nodeService,
      trainrunSectionService,
      trainrunService,
      baseDataService,
      noteService,
      labelService,
      labelGroupService,
      filterService,
      netzgrafikColoringService,
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
