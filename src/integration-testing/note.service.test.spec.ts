import {NodeService} from "../app/services/data/node.service";
import {TrainrunService} from "../app/services/data/trainrun.service";
import {TrainrunSectionService} from "../app/services/data/trainrunsection.service";
import {StammdatenService} from "../app/services/data/stammdaten.service";
import {DataService} from "../app/services/data/data.service";
import {ResourceService} from "../app/services/data/resource.service";
import {LogService} from "../app/logger/log.service";
import {LogPublishersService} from "../app/logger/log.publishers.service";
import {NoteService} from "../app/services/data/note.service";
import {LabelService} from "../app/services/data/label.service";
import {LabelGroupService} from "../app/services/data/labelgroup.service";
import {Note} from "../app/models/note.model";
import {NetzgrafikUnitTesting} from "./netzgrafik.unit.testing";
import {FilterService} from "../app/services/ui/filter.service";
import {Vec2D} from "../app/utils/vec2D";
import {NetzgrafikColoringService} from "../app/services/data/netzgrafikColoring.service";

describe("NodeService Test", () => {
  let notes: Note[] = null;

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

    noteService.notes.subscribe((updateNotes) => (notes = updateNotes));
  });

  it("check notes", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(notes.length).toBe(1);
    const note = noteService.getNoteFromId(3);
    expect(note.getDto().id).toBe(3);
  });

  it("getNoteFromId", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(noteService.getNoteFromId(undefined)).toBe(undefined);
    expect(noteService.getNoteFromId(-1)).toBe(undefined);
    expect(noteService.getNoteFromId(null)).toBe(undefined);
  });

  it("select", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const note: Note = noteService.getNoteFromId(3);
    expect(note.selected()).toBe(false);
    note.select();
    expect(note.selected()).toBe(true);
    note.unselect();
    expect(note.selected()).toBe(false);
  });

  it("getWidth", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const note: Note = noteService.getNoteFromId(3);
    expect(note.getWidth()).toBe(192);
    note.setWidth(1978);
    expect(note.getWidth()).toBe(1978);
  });

  it("getHeight", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const note: Note = noteService.getNoteFromId(3);
    expect(note.getHeight()).toBe(64);
    note.setHeight(-12);
    expect(note.getHeight()).toBe(-12);
  });

  it("getPosition X / Y", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const note: Note = noteService.getNoteFromId(3);
    expect(note.getPositionX()).toBe(1312);
    expect(note.getPositionY()).toBe(160);
    note.setPosition(1, 2);
    expect(note.getPositionX()).toBe(1);
    expect(note.getPositionY()).toBe(2);
  });

  it("getTitle", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const note: Note = noteService.getNoteFromId(3);
    expect(note.getTitle()).toBe("Frabcodierter Text");
    note.setTitle("PFI");
    expect(note.getTitle()).toBe("PFI");
  });

  it("getText", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const note: Note = noteService.getNoteFromId(3);
    expect(note.getText()).toBe("<p><em>Folgendes</em></p>spannend<p><strong>FETT</strong>");
    note.setText("PFI");
    expect(note.getText()).toBe("PFI");
  });

  it("deleteAllNotes", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    noteService.unselectAllNotes();
    expect(noteService.getNoteFromId(3).getId()).toBe(3);
    noteService.deleteAllVisibleNotes();
    expect(noteService.getNoteFromId(3)).toBe(undefined);
    expect(notes.length).toBe(0);
  });

  it("deleteAllNotes all non visible", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    noteService.unselectAllNotes();
    expect(noteService.getNoteFromId(3).getId()).toBe(3);
    noteService.deleteAllNonVisibleNotes();
    expect(noteService.getNoteFromId(3).getId()).toBe(3);
    expect(notes.length).toBe(1);
  });

  it("deleteAllNotes all non visible with filter notes enabled", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    noteService.unselectAllNotes();
    expect(notes.length).toBe(1);
    expect(noteService.getNoteFromId(3).getId()).toBe(3);
    filterService.enableFilterNotes();
    noteService.deleteAllNonVisibleNotes();
    expect(notes.length).toBe(0);
  });

  it("deleteAllNotes all non visible with filter notes enabled (2)", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    noteService.unselectAllNotes();
    const newNote = noteService.addNote(new Vec2D(100, 1000), "Fun", "nice");
    noteService.setLabels(newNote.getId(), ["Spass"]);
    expect(noteService.getNotes().length).toBe(2);
    expect(noteService.getNoteFromId(3).getId()).toBe(3);
    filterService.setFilterNoteLabels(newNote.getLabelIds());
    noteService.deleteAllNonVisibleNotes();
    expect(noteService.getNotes().length).toBe(1);
  });

  it("deleteAllNotes all non visible with filter notes enabled but no filtering hit", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    noteService.unselectAllNotes();
    const newNote = noteService.addNote(new Vec2D(100, 1000), "Fun", "nice");
    noteService.setLabels(newNote.getId(), ["Spass"]);
    const noteLabels = labelService.getTextLabelsFromIds(newNote.getLabelIds());
    expect(noteService.getNoteFromId(3).getId()).toBe(3);
    filterService.setFilterNoteLabels([0]);
    noteService.deleteAllNonVisibleNotes();
    expect(notes.length).toBe(2);
    expect(noteService.getNoteFromId(3).getId()).toBe(3);
  });

  it("addNote", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const newNote = noteService.addNote(new Vec2D(10, 10), "titel", "text");
    expect(noteService.getNoteFromId(newNote.getId()).getTitle()).toBe("titel");
  });

  it("editNote", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const newNote = noteService.addNote(new Vec2D(10, 10), "titel", "text");
    noteService.editNote(newNote.getId(), "ok", "<p>:-)</p>text <p>next</p>", 0, -1);
    noteService.editNote(newNote.getId(), "ok", "<p>:-)</p>text <p>next</p>", -1, 0);
    noteService.editNote(newNote.getId(), "ok", "<p>:-)</p>text <p>next</p>", -1, -1);
    expect(noteService.getNoteFromId(newNote.getId()).getTitle()).toBe("ok");
    noteService.editNote(-1, "ok2", "<p>:-)</p>text <p>next</p>", 200, 560);
    noteService.editNote(undefined, "ok2", "<p>:-)</p>text <p>next</p>", 200, 560);
    noteService.editNote(newNote.getId(), "ok2", "<p>:-)</p>text <p>next</p>", 200, 560);
    expect(noteService.getNoteFromId(newNote.getId()).getTitle()).toBe("ok2");
  });

  it("moveNote", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const newNote = noteService.addNote(new Vec2D(10, 10), "titel", "text");
    expect(noteService.getNoteFromId(newNote.getId()).getPositionX()).toBe(10);
    expect(noteService.getNoteFromId(newNote.getId()).getPositionY()).toBe(10);

    noteService.moveNote(newNote.getId(), 5.21, 6.55, 2, false);
    expect(noteService.getNoteFromId(newNote.getId()).getPositionX()).toBe(15.21);
    expect(noteService.getNoteFromId(newNote.getId()).getPositionY()).toBe(16.55);

    noteService.moveNote(newNote.getId(), 5.09, 43.4, 32, true);
    expect(noteService.getNoteFromId(newNote.getId()).getPositionX()).toBe(32);
    expect(noteService.getNoteFromId(newNote.getId()).getPositionY()).toBe(64);
  });

  it("deleteNote", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(noteService.getNoteFromId(3).getId()).toBe(3);
    noteService.deleteNote(3);
    expect(noteService.getNoteFromId(3)).toBe(undefined);
  });

  it("getNoteFromId", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(noteService.getNoteFromId(3).getId()).toBe(3);
  });

  it("select", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    noteService.getNoteFromId(3).select();
    expect(noteService.isNoteSelected(3)).toBe(true);
    noteService.unselectAllNotes();
    noteService.selectNote(3);
    expect(noteService.isNoteSelected(3)).toBe(true);
  });

  it("unselect", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    noteService.getNoteFromId(3).select();
    noteService.getNoteFromId(3).unselect();
    expect(noteService.isNoteSelected(3)).toBe(false);
  });

  it("selectNode", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    noteService.getNoteFromId(3).select();
    noteService.getNoteFromId(3).unselect();
    expect(noteService.isNoteSelected(3)).toBe(false);

    noteService.getNoteFromId(3).select();
    noteService.unselectAllNotes();
    expect(noteService.isNoteSelected(3)).toBe(false);

    noteService.selectNote(3);
    expect(noteService.isNoteSelected(3)).toBe(true);

    noteService.unselectNote(3);
    expect(noteService.isNoteSelected(3)).toBe(false);
  });

  it("unselectNote", () => {
    noteService.unselectNote(null);
    noteService.unselectNote(undefined);
    noteService.unselectNote(notes.length);
    noteService.unselectNote(-1);
    noteService.unselectNote(0);
  });
});
