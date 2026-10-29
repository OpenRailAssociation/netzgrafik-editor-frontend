import {NodeService} from "../app/services/data/node.service";
import {TrainrunService} from "../app/services/data/trainrun.service";
import {TrainrunSectionService} from "../app/services/data/trainrunsection.service";
import {BaseDataService} from "../app/services/data/basedata.service";
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
import {LabelRef} from "../app/data-structures/business.data.structures";

describe("NodeService Test", () => {
  let notes: Note[] = null;

  let dataService: DataService = null;
  let nodeService: NodeService = null;
  let resourceService: ResourceService = null;
  let trainrunService: TrainrunService = null;
  let trainrunSectionService: TrainrunSectionService = null;
  let baseDataService: BaseDataService = null;
  let noteService: NoteService = null;
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
    labelGroupService = new LabelGroupService();
    labelService = new LabelService(labelGroupService);
    filterService = new FilterService(labelService, labelGroupService);
    trainrunService = new TrainrunService(logService, labelService, filterService);
    trainrunSectionService = new TrainrunSectionService(trainrunService, filterService);
    nodeService = new NodeService(
      resourceService,
      trainrunService,
      trainrunSectionService,
      labelService,
      filterService,
    );
    noteService = new NoteService(labelService, filterService);
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

    noteService.notes.subscribe((updateNotes) => (notes = updateNotes));
  });

  it("check notes", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    expect(notes.length).toBe(1);
    const note = noteService.getNoteFromId(3);
    expect(note.getDto().id).toBe(3);
  });

  it("syncCreatedNote adds a note without emitting operations", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const existingNote = noteService.getNoteFromId(3);
    const notesBefore = [...noteService.getNotes()];
    const addedDto = {...existingNote.getDto(), id: 42, labelIds: [4]};
    const operationSpy = spyOn(noteService.operation, "emit");
    let latestNotes: Note[];
    noteService.notes.subscribe((updatedNotes) => (latestNotes = updatedNotes));

    noteService.syncCreatedNote(addedDto);

    const addedNote = noteService.getNoteFromId(42);
    expect(addedNote.getDto()).toEqual(addedDto);
    expect(noteService.getNotes()).toEqual([...notesBefore, addedNote]);
    expect(noteService.getNoteFromId(3)).toBe(existingNote);
    expect(latestNotes).toEqual(noteService.getNotes());
    expect(operationSpy).not.toHaveBeenCalled();

    addedDto.labelIds.push(5);
    expect(addedNote.getLabelIds()).toEqual([4]);
    expect(() => noteService.syncCreatedNote(addedDto)).toThrowError();
  });

  it("syncUpdatedNote only updates the targeted note without emitting operations", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const existingNote = noteService.getNoteFromId(3);
    const otherNote = noteService.addNote(new Vec2D(0, 0), "Other", "Other");
    const otherDto = otherNote.getDto();
    noteService.selectNote(otherNote.getId());
    noteService.selectNote(existingNote.getId());

    const updatedDto = {
      ...existingNote.getDto(),
      x: 20,
      y: 30,
      width: 240,
      height: 80,
      title: "Updated title",
      text: "Updated text",
      backgroundColor: "#123456",
      textColor: "#abcdef",
      labelIds: [4, 5],
    };
    const operationSpy = spyOn(noteService.operation, "emit");
    let latestNotes: Note[];
    noteService.notes.subscribe((updatedNotes) => (latestNotes = updatedNotes));

    noteService.syncUpdatedNote(updatedDto);

    expect(noteService.getNoteFromId(3)).toBe(existingNote);
    expect(existingNote.getDto()).toEqual(updatedDto);
    expect(existingNote.selected()).toBeTrue();
    expect(otherNote.getDto()).toEqual(otherDto);
    expect(otherNote.selected()).toBeTrue();
    expect(latestNotes).toEqual(noteService.getNotes());
    expect(operationSpy).not.toHaveBeenCalled();

    updatedDto.labelIds.push(6);
    expect(existingNote.getLabelIds()).toEqual([4, 5]);
    expect(() => noteService.syncUpdatedNote({...updatedDto, id: 42})).toThrowError();
  });

  it("syncDeletedNote only removes the targeted note without emitting operations", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const deletedNote = noteService.getNoteFromId(3);
    const otherNote = noteService.addNote(new Vec2D(0, 0), "Other", "Other");
    noteService.selectNote(deletedNote.getId());
    noteService.selectNote(otherNote.getId());
    const operationSpy = spyOn(noteService.operation, "emit");

    noteService.syncDeletedNote(3);

    expect(noteService.getNoteFromId(3)).toBeUndefined();
    expect(noteService.getSelectedNotes()).toEqual([otherNote]);
    expect(operationSpy).not.toHaveBeenCalled();
    expect(() => noteService.syncDeletedNote(3)).toThrowError();
  });

  it("syncDeletedNote clears the labels only used by the removed note", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    const note = noteService.addNote(new Vec2D(0, 0), "Labelled", "Labelled");
    noteService.setLabels(note.getId(), ["Spass"]);
    expect(labelService.getLabelFromLabelAndLabelRef("Spass", LabelRef.Note)).toBeDefined();

    noteService.syncDeletedNote(note.getId());

    expect(labelService.getLabelFromLabelAndLabelRef("Spass", LabelRef.Note)).toBeUndefined();
  });

  it("deleteNote and setLabels ignore a note removed by syncDeletedNote", () => {
    dataService.loadNetzgrafikDto(NetzgrafikUnitTesting.getUnitTestNetzgrafik());
    noteService.syncDeletedNote(3);
    const operationSpy = spyOn(noteService.operation, "emit");

    expect(() => noteService.deleteNote(3)).not.toThrow();
    expect(() => noteService.setLabels(3, ["Label"])).not.toThrow();
    expect(operationSpy).not.toHaveBeenCalled();
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
