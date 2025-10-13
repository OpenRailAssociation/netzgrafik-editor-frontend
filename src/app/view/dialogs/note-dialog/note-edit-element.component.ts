import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from "@angular/core";
import {FormModel} from "../../../utils/form-model";
import {NoteFormComponentModel} from "./note-form/note-form.component";
import {Subject} from "rxjs";
import {NoteDialogParameter} from "./note-dialog.component";
import {Note} from "../../../models/note.model";

@Component({
  selector: "sbb-note-edit-element",
  templateUrl: "./note-edit-element.component.html",
  styleUrls: ["./note-edit-element.component.scss"],
})
export class NoteEditElementComponent implements OnInit, OnDestroy {
  @Input()
  noteDialogParameter: NoteDialogParameter;

  @Output()
  noteDeleted = new EventEmitter<void>();

  formModel: FormModel<NoteFormComponentModel>;
  private destroyed = new Subject<void>();
  private deleteNoteCallback = null;
  private saveNoteCallback = null;

  ngOnInit(): void {
    this.formModel = new FormModel<NoteFormComponentModel>(
      this.noteDialogParameter.noteFormComponentModel ?? {
        id: 0,
        noteTitle: "",
        noteText: "",
        noteHeight: Note.DEFAULT_NOTE_HEIGHT,
        noteWidth: Note.DEFAULT_NOTE_WIDTH,
        notePositionX: 0,
        notePositionY: 0,
        saveNoteCallback: null,
        deleteNoteCallback: null,
        updateNoteCallback: null,
      },
    );

    this.deleteNoteCallback = this.noteDialogParameter.noteFormComponentModel.deleteNoteCallback;
    this.saveNoteCallback = this.noteDialogParameter.noteFormComponentModel.saveNoteCallback;
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  onDeleteNote(): void {
    this.deleteNoteCallback(this.noteDialogParameter.noteFormComponentModel.id);
    this.noteDeleted.emit();
  }

  private updateNote() {
    this.formModel.tryGetValid();
    const newNoteTitle: string = this.formModel.getControl("noteTitle").value;
    const newNoteText: string = this.formModel.getControl("noteText").value;
    const newNoteHeight: string = this.formModel.getControl("noteHeight").value;
    const newNoteWidth: string = this.formModel.getControl("noteWidth").value;
    this.saveNoteCallback(
      this.noteDialogParameter.noteFormComponentModel.id,
      newNoteTitle,
      newNoteText,
      newNoteHeight,
      newNoteWidth,
    );
  }
}
