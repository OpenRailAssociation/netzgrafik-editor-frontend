import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from "@angular/core";
import {DataService} from "../../../../services/data/data.service";
import {LabelService} from "../../../../services/data/label.service";
import {LabelRef} from "../../../../data-structures/business.data.structures";
import {LabelGroupService} from "../../../../services/data/labelgroup.service";
import {Subject} from "rxjs";
import {NoteService} from "../../../../services/data/note.service";
import {takeUntil} from "rxjs/operators";
import {Note} from "../../../../models/note.model";
import {NoteDialogParameter} from "../note-dialog.component";
import {SbbChipEvent, SbbChipInputEvent} from "@sbb-esta/angular/chips";
import {COMMA, ENTER} from "@angular/cdk/keycodes";

@Component({
  selector: "sbb-note-filter-tab",
  templateUrl: "./note-filter-tab.component.html",
  styleUrls: ["./note-filter-tab.component.scss"],
})
export class NoteFilterTabComponent implements OnInit, OnDestroy {
  @Input() noteDialogParameter: NoteDialogParameter;
  @Output() noteDeleted = new EventEmitter<void>();

  public note: Note;
  public noteLabels: string[];
  private initialNoteLabels: string[];
  noteLabelsAutoCompleteOptions: string[] = [];
  readonly separatorKeysCodes = [ENTER, COMMA];
  private destroyed = new Subject<void>();
  private isLabelBeingEdited = false;

  constructor(
    public dataService: DataService,
    private noteService: NoteService,
    private labelService: LabelService,
    private labelGroupService: LabelGroupService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.initializeWithCurrentNote();
    this.noteService.notes.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.updateNoteLabelsAutoCompleteOptions();
    });
    this.noteService.notes.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.initializeWithCurrentNote();
    });
    this.updateNoteLabelsAutoCompleteOptions();
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  remove(chipEvent: SbbChipEvent): void {
    if (!this.noteLabels) return;

    const valueDelete = chipEvent.chip.value as string;
    const value = (valueDelete || "").trim();
    if (!value) {
      return;
    }
    this.noteLabels = this.noteLabels.filter((labels) => labels !== valueDelete);
    this.isLabelBeingEdited = true;
    this.checkAndSetLabels();
    this.isLabelBeingEdited = false;
  }

  add(chipInputEvent: SbbChipInputEvent): void {
    if (!this.noteLabels) return;

    const value = (chipInputEvent.value || "").trim();
    if (!value) {
      return;
    }
    this.noteLabels.push(value);
    this.isLabelBeingEdited = true;
    this.checkAndSetLabels();
    this.isLabelBeingEdited = false;
    chipInputEvent.chipInput!.clear();
  }

  onLabelsFocusout() {
    if (this.isLabelBeingEdited) return;

    const keyboardEvent = new KeyboardEvent("keydown", {
      code: "Enter",
      key: "Enter",
      charCode: 13,
      keyCode: 13,
      view: window,
      bubbles: true,
    });
    document.getElementById("noteLabelsInput").dispatchEvent(keyboardEvent);
    this.checkAndSetLabels();
  }

  onDeleteNote(): void {
    this.noteService.deleteNote(this.noteDialogParameter.noteFormComponentModel.id);
    this.noteDeleted.emit();
  }

  getAutoCompleteLabels(): string[] {
    return this.labelGroupService.getAutoCompleteLabels(this.noteLabels, LabelRef.Note);
  }

  private initializeWithCurrentNote() {
    this.note = this.noteService.getNoteFromId(this.noteDialogParameter.noteFormComponentModel.id);
    if (!this.note) return;
    this.noteLabels = this.labelService.getTextLabelsFromIds(this.note.getLabelIds());
    this.initialNoteLabels = [...this.noteLabels]; // initialize labels
  }

  private updateNoteLabelsAutoCompleteOptions() {
    this.noteLabelsAutoCompleteOptions = this.getAutoCompleteLabels();
    this.cd.detectChanges();
  }

  // set labels only if any of it has changed
  private checkAndSetLabels() {
    if (!this.noteLabels || !this.initialNoteLabels) return;
    if (
      this.noteLabels.length !== this.initialNoteLabels.length ||
      !this.noteLabels.every((label, index) => label === this.initialNoteLabels[index])
    ) {
      this.noteService.setLabels(this.note.getId(), this.noteLabels);
      this.initialNoteLabels = [...this.noteLabels];
    }
  }
}
