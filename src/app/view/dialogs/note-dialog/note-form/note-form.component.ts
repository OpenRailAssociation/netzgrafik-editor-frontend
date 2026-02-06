import {Component, Input} from "@angular/core";
import {FormModel} from "../../../../utils/form-model";

@Component({
  selector: "sbb-note-form",
  templateUrl: "./note-form.component.html",
  styleUrls: ["./note-form.component.scss"],
})
export class NoteFormComponent {
  @Input() model!: FormModel<NoteFormComponentModel>;

  onKeydown(event) {
    if (event.key === "Enter") {
      this.onUpdate();
    }
  }

  onUpdate() {
    this.updateNote();
  }

  private updateNote() {
    this.model.tryGetValid();
    const newNoteTitle: string = this.model.getControl("noteTitle").value;
    const newNoteText: string = this.model.getControl("noteText").value;
    const newNoteHeight: string = this.model.getControl("noteHeight").value;
    const newNoteWidth: string = this.model.getControl("noteWidth").value;
    const newNoteRotation: number = this.model.getControl("noteRotation").value;
    const saveNoteCallback = this.model.getControl("saveNoteCallback").value;
    saveNoteCallback(
      this.model.getControl("id").value,
      newNoteTitle,
      newNoteText,
      newNoteHeight,
      newNoteWidth,
      newNoteRotation,
    );
  }
}

export interface NoteFormComponentModel {
  id: number;
  noteTitle: string;
  noteText: string;
  noteHeight: number;
  noteWidth: number;
  noteRotation: number;
  notePositionX: number;
  notePositionY: number;
  saveNoteCallback;
  deleteNoteCallback;
  updateNoteCallback?;
}
