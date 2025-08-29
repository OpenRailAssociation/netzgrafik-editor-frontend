import {Injectable} from "@angular/core";
import {BehaviorSubject} from "rxjs";
import {Note} from "../../models/note.model";
import {LogService} from "../../logger/log.service";
import {FreeFloatingTextDto, LabelRef} from "../../data-structures/business.data.structures";
import {Vec2D} from "../../utils/vec2D";
import {MathUtils} from "../../utils/math";
import {NOTE_POSITION_BASIC_RASTER} from "../../view/rastering/definitions";
import {LabelService} from "./label.service";
import {FilterService} from "../ui/filter.service";

@Injectable({
  providedIn: "root",
})
export class NoteService {
  noteSubject = new BehaviorSubject<Note[]>([]);
  readonly notes = this.noteSubject.asObservable();
  private notesStore: {notes: Note[]} = {notes: []}; // store the data in memory

  constructor(
    private logService: LogService,
    private labelService: LabelService,
    private filterService: FilterService,
  ) {}

  static alginNoteToRaster(point: Vec2D, gridRaster: number = NOTE_POSITION_BASIC_RASTER): Vec2D {
    const newNodePositionX = gridRaster * MathUtils.round(point.getX() / gridRaster, 0);
    const newNodePositionY = gridRaster * MathUtils.round(point.getY() / gridRaster, 0);
    return new Vec2D(newNodePositionX, newNodePositionY);
  }

  setNoteData(notesDto: FreeFloatingTextDto[]) {
    this.notesStore.notes = notesDto.map((noteDto) => new Note(noteDto));
  }

  createNewNoteFromDtoList(freeFloatingTexts: FreeFloatingTextDto[]) {
    freeFloatingTexts.forEach((freeFloatingText: FreeFloatingTextDto) => {
      const note: Note = this.addNote(
        new Vec2D(freeFloatingText.x, freeFloatingText.y),
        freeFloatingText.title,
        freeFloatingText.text,
      );
      note.setWidth(freeFloatingText.width);
      note.setHeight(freeFloatingText.height);
      note.setBackgroundColor(freeFloatingText.backgroundColor);
      note.setLabelIds(Object.assign([], freeFloatingText.labelIds));
      note.setTextColor(freeFloatingText.textColor);
    });
  }

  addNote(
    position: Vec2D,
    title = $localize`:@@app.models.note.default-title:Note title`,
    text = $localize`:@@app.models.note.default-text:Note text`,
  ): Note {
    const newNote = new Note();
    newNote.setPosition(position.getX(), position.getY());
    newNote.setTitle(title);
    newNote.setText(text);
    this.notesStore.notes.push(newNote);
    this.notesUpdated();
    return newNote;
  }

  editNote(noteId: number, noteTitle: string, noteText: string, height: number, width: number) {
    const note = this.getNoteFromId(noteId);
    if (note === undefined) {
      return;
    }
    note.setTitle(noteTitle);
    note.setText(noteText);
    note.setHeight(Math.max(Note.DEFAULT_NOTE_HEIGHT, height));
    note.setWidth(Math.max(Note.DEFAULT_NOTE_WIDTH, width));
    this.notesUpdated();
  }

  moveNote(
    noteId: number,
    deltaPositionX: number,
    deltaPositionY: number,
    round: number,
    dragEnd: boolean,
    enforceUpdate = true,
  ) {
    const note = this.getNoteFromId(noteId);
    if (note === undefined) {
      return;
    }
    const posX = note.getPositionX() + deltaPositionX;
    const posY = note.getPositionY() + deltaPositionY;
    if (dragEnd) {
      const newPosition = NoteService.alginNoteToRaster(
        new Vec2D(note.getPositionX() + deltaPositionX, note.getPositionY() + deltaPositionY),
        round,
      );
      note.setPosition(newPosition.getX(), newPosition.getY());
      this.moveNoteToFront(noteId, enforceUpdate);
      return;
    } else {
      note.setPosition(posX, posY);
    }
    if (enforceUpdate) {
      this.notesUpdated();
    }
  }

  deleteNote(noteId: number, enforceUpdate = true) {
    const note = this.getNoteFromId(noteId);
    const deletetLabelIds = this.labelService.clearLabel(
      note.getLabelIds(),
      this.makeLabelIDCounterMap(this.getNotes()),
    );
    this.filterService.clearDeletetFilterNoteLabels(deletetLabelIds);
    this.notesStore.notes = this.notesStore.notes.filter((n: Note) => n.getId() !== noteId);
    if (enforceUpdate) {
      this.notesUpdated();
    }
  }

  getNotes(): Note[] {
    return Object.assign({}, this.notesStore).notes;
  }

  visibleNotesDeleteLabel(labelRef: string) {
    const labelObject = this.labelService.getLabelFromLabelAndLabelRef(labelRef, LabelRef.Note);
    if (labelObject === undefined) {
      return;
    }
    this.getNotes().forEach((n: Note) => {
      if (this.filterService.filterNote(n)) {
        this.filterService.clearDeletetFilterNoteLabel(labelObject.getId());
        n.setLabelIds(n.getLabelIds().filter((labelId: number) => labelId !== labelObject.getId()));
      }
    });

    const notes = this.getNotes().find(
      (n: Note) =>
        n.getLabelIds().find((labelId: number) => labelId === labelObject.getId()) !== undefined,
    );
    if (notes === undefined) {
      this.labelService.deleteLabel(labelObject.getId());
    }
    this.notesUpdated();
  }

  visibleNotesSetLabel(labelRef: string) {
    const labelObject = this.labelService.getLabelFromLabelAndLabelRef(labelRef, LabelRef.Note);
    if (labelObject === undefined) {
      return;
    }
    this.getNotes().forEach((n: Note) => {
      if (this.filterService.filterNote(n)) {
        const labelIds: number[] = n.getLabelIds();
        labelIds.push(labelObject.getId());
        n.setLabelIds(labelIds.filter((v, i, a) => a.indexOf(v) === i));
      }
    });
    this.notesUpdated();
  }

  setLabels(noteId: number, labels: string[]) {
    const note = this.getNoteFromId(noteId);

    // ensure uniqueness of input labels
    const uniqueLabels = Array.from(new Set(labels));
    const labelIds = uniqueLabels.map((label) =>
      this.labelService.getOrCreateLabel(label, LabelRef.Note).getId(),
    );
    const deletedLabelIds = this.labelService.clearLabel(
      this.findClearedLabel(note, labelIds),
      this.makeLabelIDCounterMap(this.getNotes()),
    );
    this.filterService.clearDeletetFilterNoteLabels(deletedLabelIds);
    note.setLabelIds(labelIds);
    this.notesUpdated();
  }

  deleteAllVisibleNotes() {
    this.notesStore.notes.forEach((note: Note) => {
      if (this.filterService.filterNote(note)) {
        const deletetLabelIds = this.labelService.clearLabel(
          note.getLabelIds(),
          this.makeLabelIDCounterMap(this.getNotes()),
        );
        this.filterService.clearDeletetFilterNoteLabels(deletetLabelIds);
        this.notesStore.notes = this.notesStore.notes.filter(
          (n: Note) => n.getId() !== note.getId(),
        );
      }
    });
    this.notesUpdated();
  }

  deleteAllNonVisibleNotes() {
    this.notesStore.notes.forEach((note: Note) => {
      if (!this.filterService.filterNote(note)) {
        const deletetLabelIds = this.labelService.clearLabel(
          note.getLabelIds(),
          this.makeLabelIDCounterMap(this.getNotes()),
        );
        this.filterService.clearDeletetFilterNoteLabels(deletetLabelIds);
        this.notesStore.notes = this.notesStore.notes.filter(
          (n: Note) => n.getId() !== note.getId(),
        );
      }
    });
    this.filterService.clearFilterNoteLabels();
    this.notesUpdated();
  }

  duplicateNote(noteId: number): Note {
    const note = this.getNoteFromId(noteId);
    const newNote = this.addNote(
      new Vec2D(note.getPositionX(), note.getPositionY()),
      note.getTitle(),
      note.getText(),
    );
    return newNote;
  }

  getNoteFromId(noteId: number): Note {
    return this.notesStore.notes.find((n: Note) => n.getId() === noteId);
  }

  moveNoteToFront(noteId: number, enforceUpdate = true) {
    const note = this.getNoteFromId(noteId);
    this.notesStore.notes = this.notesStore.notes.filter((n: Note) => n.getId() !== noteId);
    this.notesStore.notes.push(note);
    if (enforceUpdate) {
      this.notesUpdated();
    }
  }

  getNoteLayerIndex(noteId: number): number {
    return this.notesStore.notes.findIndex((n: Note) => n.getId() === noteId);
  }

  selectNote(noteId: number, enforceUpdate = true) {
    const note = this.getNoteFromId(noteId);
    if (note !== undefined) {
      note.select();
      if (enforceUpdate) {
        this.notesUpdated();
      }
    }
  }

  unselectNote(noteId: number, enforceUpdate = true) {
    const note = this.getNoteFromId(noteId);
    if (note !== undefined) {
      note.unselect();
      if (enforceUpdate) {
        this.notesUpdated();
      }
    }
  }

  isAnyNoteSelected(): boolean {
    const selectedNote = this.notesStore.notes.find((n: Note) => n.selected());
    return selectedNote !== undefined;
  }

  isNoteSelected(noteId: number): boolean {
    const note = this.getNoteFromId(noteId);
    if (note === undefined) {
      return false;
    }
    return note.selected();
  }

  unselectAllNotes(enforceUpdate = true) {
    this.notesStore.notes.forEach((n: Note) => n.unselect());
    if (enforceUpdate) {
      this.notesUpdated();
    }
  }

  getSelectedNote(): Note {
    const selectedNote = this.notesStore.notes.find((n) => n.selected());
    if (selectedNote !== undefined) {
      return selectedNote;
    } else {
      return null;
    }
  }

  getDtos() {
    return this.notesStore.notes.map((note) => note.getDto());
  }

  moveSelectedNotes(
    deltaPositionX: number,
    deltaPositionY: number,
    round: number,
    dragEnd: boolean,
  ) {
    const nodesToUpdate = this.notesStore.notes.filter((n) => n.selected());
    nodesToUpdate.forEach((n) => {
      const newPosition = NoteService.alginNoteToRaster(
        new Vec2D(n.getPositionX() + deltaPositionX, n.getPositionY() + deltaPositionY),
        round,
      );
      this.changeNotePositionWithoutUpdate(
        n.getId(),
        newPosition.getX(),
        newPosition.getY(),
        dragEnd,
      );
    });
    this.notesUpdated();
  }

  notesUpdated() {
    this.noteSubject.next(Object.assign({}, this.notesStore).notes);
  }

  private changeNotePositionWithoutUpdate(
    nodeId: number,
    newPositionX: number,
    newPositionY: number,
    dragEnd: boolean,
  ) {
    const note = this.getNoteFromId(nodeId);
    if (note !== undefined) {
      note.setPosition(newPositionX, newPositionY);
    }
  }

  private findClearedLabel(note: Note, labelIds: number[]) {
    return [].concat(note.getLabelIds()).filter((oldlabelId) => !labelIds.includes(oldlabelId));
  }

  private makeLabelIDCounterMap(nNotes: Note[]): Map<number, number> {
    const labelIDCauntMap = new Map<number, number>();
    nNotes.forEach((trainrun) => {
      trainrun.getLabelIds().forEach((labelId) => {
        let counter = labelIDCauntMap.get(labelId);
        if (counter === undefined) {
          counter = 0;
        }
        counter++;
        labelIDCauntMap.set(labelId, counter);
      });
    });
    return labelIDCauntMap;
  }
}
