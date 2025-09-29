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
import {FilterService} from "../ui/filter.service";
import {NetzgrafikColoringService} from "../data/netzgrafikColoring.service";
import {UndoService} from "../data/undo.service";
import {CopyService} from "./copy.service";
import {UiInteractionService} from "../ui/ui.interaction.service";
import {LoadPerlenketteService} from "../../perlenkette/service/load-perlenkette.service";
import {NetzgrafikUnitTesting} from "../../../integration-testing/netzgrafik.unit.testing";
import {EditorMode} from "../../view/editor-menu/editor-mode";

describe("CopyService", () => {
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
    copyService.resetLocalStorage();
  });

  it("test loadNetzgrafikDto", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const loadedNetzgrafik = dataService.getNetzgrafikDto();
    expect(loadedNetzgrafik.trainruns.length).toBe(5);
    expect(loadedNetzgrafik.trainrunSections.length).toBe(8);
    expect(loadedNetzgrafik.nodes.length).toBe(5);
    expect(loadedNetzgrafik.freeFloatingTexts.length).toBe(1);
  });

  it("General tests - 001 (complete netzgrafik)", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const loadedNetzgrafik = dataService.getNetzgrafikDto();
    copyService.copyCurrentVisibleNetzgrafik();
    trainrunSectionService.deleteAllVisibleTrainrunSections();
    nodeService.deleteAllNonVisibleNodes();
    noteService.deleteAllVisibleNotes();
    copyService.insertCopiedNetzgrafik();
    const insertedNetzgrafik = dataService.getNetzgrafikDto();
    expect(loadedNetzgrafik.trainruns.length).toBe(insertedNetzgrafik.trainruns.length);
    expect(loadedNetzgrafik.trainrunSections.length).toBe(
      insertedNetzgrafik.trainrunSections.length,
    );
    expect(loadedNetzgrafik.nodes.length).toBe(insertedNetzgrafik.nodes.length);
    expect(loadedNetzgrafik.freeFloatingTexts.length).toBe(
      insertedNetzgrafik.freeFloatingTexts.length,
    );

    expect(nodeService.getNodes().length).toBe(5);
    expect(trainrunService.getTrainruns().length).toBe(5);
    expect(trainrunSectionService.getTrainrunSections().length).toBe(8);
    expect(noteService.getNotes().length).toBe(1);
  });

  it("General tests - 002 (single trainrun)", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    trainrunService.setTrainrunAsSelected(0);
    copyService.copyCurrentVisibleNetzgrafik();
    nodeService.deleteAllNonVisibleNodes();
    noteService.deleteAllVisibleNotes();
    copyService.insertCopiedNetzgrafik();

    expect(nodeService.getNodes().length).toBe(5);
    expect(trainrunService.getTrainruns().length).toBe(6);
    expect(trainrunSectionService.getTrainrunSections().length).toBe(10);
    expect(noteService.getNotes().length).toBe(0);
  });

  it("General tests - 003 (filterMultiSelected)", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    uiInteractionService.setEditorMode(EditorMode.MultiNodeMoving);
    trainrunService.setTrainrunAsSelected(0);
    copyService.copyCurrentVisibleNetzgrafik();
    nodeService.deleteAllNonVisibleNodes();
    noteService.deleteAllVisibleNotes();
    copyService.insertCopiedNetzgrafik();

    expect(nodeService.getNodes().length).toBe(5);
    expect(trainrunService.getTrainruns().length).toBe(5);
    expect(trainrunSectionService.getTrainrunSections().length).toBe(8);
    expect(noteService.getNotes().length).toBe(0);
  });

  it("General tests - 004 (filterMultiSelected)", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    uiInteractionService.setEditorMode(EditorMode.MultiNodeMoving);
    trainrunSectionService.deleteAllVisibleTrainrunSections();
    nodeService.selectNode(1);
    nodeService.selectNode(2);
    noteService.selectNote(3);

    const copiedNetzgrafik = copyService.copyCurrentVisibleNetzgrafik();
    uiInteractionService.setEditorMode(EditorMode.NetzgrafikEditing);
    nodeService.deleteAllVisibleNodes();
    noteService.deleteAllVisibleNotes();
    copyService.insertCopiedNetzgrafik();

    expect(nodeService.getNodes().length).toBe(2);
    expect(trainrunService.getTrainruns().length).toBe(0);
    expect(trainrunSectionService.getTrainrunSections().length).toBe(0);
    expect(noteService.getNotes().length).toBe(1);
  });

  it("General tests - 005 (trainrun filtering)", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    filterService.disableFilterTrainrunCategory(dataService.getTrainrunCategory(1));
    filterService.disableFilterTrainrunCategory(dataService.getTrainrunCategory(3));
    noteService.deleteAllVisibleNotes();
    expect(filterService.isAnyFilterActive()).toBe(true);
    const data2copy = copyService.copyCurrentVisibleNetzgrafik();
    const copiedData = copyService.loadCopiedDataFromLocalStorage();

    expect(data2copy.trainruns.length).toBe(2);
    expect(data2copy.trainrunSections.length).toBe(4);
    expect(data2copy.nodes.length).toBe(5);
    expect(data2copy.freeFloatingTexts.length).toBe(0);

    expect(copiedData.trainruns.length).toBe(2);
    expect(copiedData.trainrunSections.length).toBe(4);
    expect(copiedData.nodes.length).toBe(5);
    expect(copiedData.freeFloatingTexts.length).toBe(0);
  });

  it("General tests - 006 (trainrun filtering)", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    filterService.setFilterNodeLabels([3, 4]);
    expect(filterService.isAnyFilterActive()).toBe(true);
    const data2copy = copyService.copyCurrentVisibleNetzgrafik();

    expect(data2copy.trainruns.length).toBe(5);
    expect(data2copy.trainrunSections.length).toBe(6);
    expect(data2copy.nodes.length).toBe(5);
    expect(data2copy.freeFloatingTexts.length).toBe(1);
  });
});
