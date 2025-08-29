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
import {UndoService} from "../data/undo.service";
import {Vec2D} from "../../utils/vec2D";
import {Note} from "../../models/note.model";
import {LabelRef} from "../../data-structures/business.data.structures";

describe("UndoService", () => {
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

  it("UndoService - 001", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const undoService = new UndoService(
      dataService,
      nodeService,
      noteService,
      trainrunService,
      filterService,
    );
    undoService.reset(0);
    undoService.pushCurrentVersion(true);
    const loaded = JSON.stringify(dataService.getNetzgrafikDto());
    nodeService.changeNodePosition(0, 10, 20, true);
    const changed = JSON.stringify(dataService.getNetzgrafikDto());
    undoService.undo();
    const undone = JSON.stringify(dataService.getNetzgrafikDto());

    expect(loaded === changed).toBe(false);
    expect(undone === changed).toBe(false);
    expect(loaded === undone).toBe(true);
  });

  it("UndoService - 002", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const undoService = new UndoService(
      dataService,
      nodeService,
      noteService,
      trainrunService,
      filterService,
    );
    expect(trainrunService.isAnyTrainrunSelected()).toBe(false);
    undoService.reset(0);
    undoService.pushCurrentVersion(true);
    const loaded = JSON.stringify(dataService.getNetzgrafikDto());
    const changed = JSON.stringify(dataService.getNetzgrafikDto());
    nodeService.changeNodePosition(0, 10, 20, true);
    noteService.moveNote(0, 0, 10, 32, true);
    nodeService.selectNode(0);
    noteService.selectNote(3);
    expect(nodeService.getSelectedNode().getId()).toBe(0);
    expect(noteService.getSelectedNote().getId()).toBe(3);
    trainrunService.setTrainrunAsSelected(1);
    undoService.undo();
    const undone = JSON.stringify(dataService.getNetzgrafikDto());

    expect(loaded === changed).toBe(true);
    expect(undone === changed).toBe(true);
    expect(loaded === undone).toBe(true);
    expect(trainrunService.isAnyTrainrunSelected()).toBe(true);
    expect(noteService.isNoteSelected(0)).toBe(false);
    expect(noteService.isAnyNoteSelected()).toBe(false);
    expect(nodeService.isNodeSelected(0)).toBe(false);
    expect(nodeService.isAnyNodeSelected()).toBe(false);
    expect(nodeService.getSelectedNode()).toBe(null);
    expect(noteService.getSelectedNote()).toBe(null);
    trainrunService.unselectAllTrainruns();
    expect(trainrunService.isAnyTrainrunSelected()).toBe(false);
  });

  it("UndoService - 003", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const undoService = new UndoService(
      dataService,
      nodeService,
      noteService,
      trainrunService,
      filterService,
    );
    expect(trainrunService.isAnyTrainrunSelected()).toBe(false);
    const preChangedNodes = trainrunService.getNodePathToEnd(
      nodeService.getNodeFromId(0),
      trainrunSectionService.getTrainrunSectionFromId(0),
    );

    undoService.reset(0);
    undoService.pushCurrentVersion(true);
    const changedNodes = trainrunService.getNodePathToEnd(
      nodeService.getNodeFromId(0),
      trainrunSectionService.getTrainrunSectionFromId(0),
    );
    undoService.undo();
    const postNodes = trainrunService.getNodePathToEnd(
      nodeService.getNodeFromId(0),
      trainrunSectionService.getTrainrunSectionFromId(0),
    );

    let preNodesStr = "";
    preChangedNodes.forEach((n) => {
      preNodesStr += n.getBetriebspunktName();
    });
    let changedNodesStr = "";
    changedNodes.forEach((n) => {
      changedNodesStr += n.getBetriebspunktName();
    });
    let postNodesStr = "";
    postNodes.forEach((n) => {
      postNodesStr += n.getBetriebspunktName();
    });

    expect(preNodesStr === postNodesStr).toBe(true);
    expect(preNodesStr === changedNodesStr).toBe(true);
    expect(postNodesStr === changedNodesStr).toBe(true);
  });

  it("UndoService - 004", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const undoService = new UndoService(
      dataService,
      nodeService,
      noteService,
      trainrunService,
      filterService,
    );
    expect(trainrunService.isAnyTrainrunSelected()).toBe(false);
    const preChangedTrainrunSection = trainrunService.getLastNonStopTrainrunSection(
      nodeService.getNodeFromId(0),
      trainrunSectionService.getTrainrunSectionFromId(0),
    );

    undoService.reset(0);
    undoService.pushCurrentVersion(true);
    const changedTrainrunSection = trainrunService.getLastNonStopTrainrunSection(
      nodeService.getNodeFromId(0),
      trainrunSectionService.getTrainrunSectionFromId(0),
    );
    undoService.undo();
    const postTrainrunSection = trainrunService.getLastNonStopTrainrunSection(
      nodeService.getNodeFromId(0),
      trainrunSectionService.getTrainrunSectionFromId(0),
    );

    expect(preChangedTrainrunSection.getId() === preChangedTrainrunSection.getId()).toBe(true);
    expect(postTrainrunSection.getId() === changedTrainrunSection.getId()).toBe(true);
    expect(changedTrainrunSection.getId() === postTrainrunSection.getId()).toBe(true);
  });

  it("UndoService - 005", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const undoService = new UndoService(
      dataService,
      nodeService,
      noteService,
      trainrunService,
      filterService,
    );
    undoService.reset(0);
    undoService.pushCurrentVersion(true);
    const loaded = JSON.stringify(dataService.getNetzgrafikDto());
    const newNote = noteService.duplicateNote(3);
    expect(noteService.getNoteFromId(newNote.getId()).getId()).toBe(newNote.getId());
    const changed = JSON.stringify(dataService.getNetzgrafikDto());
    undoService.undo();
    const undone = JSON.stringify(dataService.getNetzgrafikDto());

    expect(loaded === changed).toBe(false);
    expect(undone === changed).toBe(false);
    expect(loaded === undone).toBe(true);
  });

  it("UndoService - 006", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const undoService = new UndoService(
      dataService,
      nodeService,
      noteService,
      trainrunService,
      filterService,
    );
    undoService.reset(0);
    undoService.pushCurrentVersion(true);
    const loaded = JSON.stringify(dataService.getNetzgrafikDto());
    const newNode = nodeService.duplicateNode(0);
    expect(nodeService.getNodeFromId(newNode.getId()).getId()).toBe(newNode.getId());
    const changed = JSON.stringify(dataService.getNetzgrafikDto());
    undoService.undo();
    const undone = JSON.stringify(dataService.getNetzgrafikDto());

    expect(loaded === changed).toBe(false);
    expect(undone === changed).toBe(false);
    expect(loaded === undone).toBe(true);
  });

  it("UndoService - 007", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const undoService = new UndoService(
      dataService,
      nodeService,
      noteService,
      trainrunService,
      filterService,
    );
    expect(trainrunService.isAnyTrainrunSelected()).toBe(false);
    undoService.reset(0);
    undoService.pushCurrentVersion(true);
    const loaded = JSON.stringify(dataService.getNetzgrafikDto());
    const changed = JSON.stringify(dataService.getNetzgrafikDto());
    nodeService.changeNodePosition(0, 10, 20, true);
    noteService.moveNote(0, 0, 10, 32, true);
    nodeService.selectNode(0);
    noteService.selectNote(3);
    const newNote = noteService.duplicateNote(3);
    noteService.selectNote(newNote.getId());
    noteService.duplicateNote(3);
    noteService.duplicateNote(3);
    const notePos: Vec2D[] = [];
    noteService.getNotes().forEach((note: Note) => {
      notePos.push(new Vec2D(note.getPositionX(), note.getPositionY()));
    });
    noteService.moveSelectedNotes(10, 8, 1, false);
    noteService.getNotes().forEach((note: Note, index: number) => {
      if (index < 2) {
        expect(notePos[index].getX() + 10).toBe(note.getPositionX());
        expect(notePos[index].getY() + 8).toBe(note.getPositionY());
      } else {
        expect(notePos[index].getX()).toBe(note.getPositionX());
        expect(notePos[index].getY()).toBe(note.getPositionY());
      }
    });

    noteService.moveSelectedNotes(2, 5, 1, true);

    noteService.getNotes().forEach((note: Note, index: number) => {
      if (index < 2) {
        expect(notePos[index].getX() + 12).toBe(note.getPositionX());
        expect(notePos[index].getY() + 13).toBe(note.getPositionY());
      } else {
        expect(notePos[index].getX()).toBe(note.getPositionX());
        expect(notePos[index].getY()).toBe(note.getPositionY());
      }
    });

    const label0 = labelService.getOrCreateLabel("test", LabelRef.Note);
    const label1 = labelService.getOrCreateLabel("test1", LabelRef.Note);
    const label2 = labelService.getOrCreateLabel("test2", LabelRef.Note);
    expect(labelService.getLabelsFromLabelRef(LabelRef.Note).length).toBe(3);
    noteService.visibleNotesSetLabel(undefined);
    noteService.visibleNotesSetLabel(label0.getLabel());
    noteService.visibleNotesSetLabel(label2.getLabel());
    noteService.visibleNotesDeleteLabel(undefined);
    noteService.visibleNotesDeleteLabel(label0.getLabel());
    noteService.visibleNotesDeleteLabel(label1.getLabel());

    expect(labelService.getLabelsFromLabelRef(LabelRef.Note).length).toBe(1);
    undoService.undo();

    expect(labelService.getLabelsFromLabelRef(LabelRef.Note).length).toBe(0);

    const undone = JSON.stringify(dataService.getNetzgrafikDto());
    expect(loaded === changed).toBe(true);
    expect(undone === changed).toBe(true);
    expect(loaded === undone).toBe(true);
    expect(noteService.isNoteSelected(0)).toBe(false);
    expect(noteService.isAnyNoteSelected()).toBe(false);
    expect(nodeService.getSelectedNode()).toBe(null);
    expect(noteService.getSelectedNote()).toBe(null);
  });
});
