import {Component, OnDestroy, TemplateRef, ViewChild} from "@angular/core";
import {SbbDialog, SbbDialogConfig, SbbDialogPosition} from "@sbb-esta/angular/dialog";
import {Vec2D} from "../../../utils/vec2D";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {GeneralViewFunctions} from "../../util/generalViewFunctions";
import {Subject} from "rxjs";
import {NoteFormComponentModel} from "./note-form/note-form.component";
import {takeUntil} from "rxjs/operators";

export enum NoteDialogType {
  NOTE_DIALOG,
  NOTE_FILTERABLE_LABELS_DIALOG,
}

export class NoteDialogParameter {
  public type: NoteDialogType;
  public position: Vec2D;
  public offset: number;
  public noteFormComponentModel: NoteFormComponentModel;

  constructor(type: NoteDialogType, position: Vec2D) {
    this.type = type;
    this.position = position;
    this.offset = 0;
  }

  setOffset(offset: number) {
    this.offset = offset;
  }
}

@Component({
  selector: "sbb-note-dialog",
  templateUrl: "./note-dialog.component.html",
  styleUrls: ["./note-dialog.component.scss"],
})
export class NoteDialogComponent implements OnDestroy {
  @ViewChild("noteEditorTabsViewTemplate", {static: true})
  noteEditorTabsViewTemplate: TemplateRef<any>;

  public data = null;
  public noteId: number;
  public noteTitle: string;
  public noteText: string;

  private destroyed = new Subject<void>();
  private deleteNoteCallback = null;
  private saveNoteCallback = null;
  private updateNoteCallback = null;

  private dialogRef = null;
  private dialogConfig = null;
  private dialogPos = null;
  private dialogMovementLastPosition: Vec2D = undefined;

  constructor(
    public dialog: SbbDialog,
    private uiInteractionService: UiInteractionService,
  ) {
    this.uiInteractionService.noteDialog.pipe(takeUntil(this.destroyed)).subscribe((parameter) => {
      this.data = parameter;

      this.noteText = this.data.noteText;
      this.noteId = this.data.id;
      this.noteTitle = this.data.noteTitle;
      this.deleteNoteCallback = this.data.deleteNoteCallback;
      this.saveNoteCallback = this.data.saveNoteCallback;
      this.updateNoteCallback = this.data.updateNoteCallback;

      this.openDialog(parameter);
    });
  }

  static getDialogConfig(parameter: NoteDialogParameter): SbbDialogConfig {
    const width = 630;
    const height = 477;
    const dialogConfig = new SbbDialogConfig();

    const xPosition = parameter.position.getX();
    const yPosition = parameter.position.getY();
    const topLeft = GeneralViewFunctions.calcDialogTopLeftScreenCoordinate(
      new Vec2D(xPosition, yPosition),
      new Vec2D(width, height),
    );
    dialogConfig.position = {
      top: topLeft.getY() + "px",
      left: topLeft.getX() + "px",
    };

    dialogConfig.width = width + "px";
    dialogConfig.minWidth = dialogConfig.width;
    dialogConfig.maxWidth = dialogConfig.width;
    dialogConfig.height = height + "px";
    dialogConfig.minHeight = dialogConfig.height;
    dialogConfig.maxHeight = dialogConfig.height;
    dialogConfig.panelClass = "";
    dialogConfig.id = "NoteEditorTabsViewId";
    return dialogConfig;
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  openDialog(parameter: NoteDialogParameter) {
    this.dialogConfig = NoteDialogComponent.getDialogConfig(parameter);
    this.dialogRef = this.dialog.open(this.noteEditorTabsViewTemplate, this.dialogConfig);
    this.dialogPos = {
      bottom: parseInt(this.dialogConfig.position.top, 10) + parseInt(this.dialogConfig.height, 10),
      left: parseInt(this.dialogConfig.position.left, 10),
      right: parseInt(this.dialogConfig.position.left, 10) + parseInt(this.dialogConfig.width, 10),
      top: parseInt(this.dialogConfig.position.top, 10),
    };
  }

  onMouseUp(event: MouseEvent) {
    this.dialogMovementLastPosition = undefined;
  }

  onMouseDown(event: MouseEvent) {
    if (event.buttons === 1) {
      const eventTarget = event.target as HTMLElement;
      if (eventTarget.className === "sbb-tab-labels") {
        this.dialogMovementLastPosition = new Vec2D(event.screenX, event.screenY);
      }
    }
  }

  onMouseMove(event: MouseEvent) {
    if (event.buttons === 1) {
      if (this.dialogMovementLastPosition !== undefined) {
        const newLayer = new Vec2D(event.screenX, event.screenY);
        const movement = Vec2D.sub(newLayer, this.dialogMovementLastPosition);
        this.dialogMovementLastPosition = newLayer;
        this.dialogPos.top += movement.getY();
        this.dialogPos.bottom += movement.getY();
        this.dialogPos.left += movement.getX();
        this.dialogPos.right += movement.getX();
        this.dialogRef.updatePosition(this.convertDialogPos(this.dialogPos));
        event.preventDefault();
      }
    }
  }

  closeDialog() {
    if (this.dialogRef !== null) {
      this.dialogRef.close();
    }
  }

  private convertDialogPos(dialogPos: SbbDialogPosition): SbbDialogPosition {
    return {
      bottom: dialogPos.bottom + "px",
      left: dialogPos.left + "px",
      right: dialogPos.right + "px",
      top: dialogPos.top + "px",
    };
  }
}
