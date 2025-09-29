import {Component, OnDestroy, TemplateRef, ViewChild} from "@angular/core";
import {SbbDialog, SbbDialogConfig} from "@sbb-esta/angular/dialog";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {Observable, Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";

export class ConfirmationDialogParameter {
  public dialogTitle: string;
  public dialogContent: string;
  public dialogConfirmationButtonLabel: string;
  public dialogAbortButtonLabel: string;
  public subject: Subject<boolean>;
  public dialogFeedback: Observable<boolean>;

  constructor(
    dialogTitle: string,
    dialogContent: string,
    dialogConfirmationButtonLabel = $localize`:@@app.view.dialogs.confirmation-dialog.confirmation-default:Yes`,
    dialogAbortButtonLabel = $localize`:@@app.view.dialogs.confirmation-dialog.abort-default:No`,
  ) {
    this.dialogTitle = dialogTitle;
    this.dialogContent = dialogContent;
    this.dialogConfirmationButtonLabel = dialogConfirmationButtonLabel;
    this.dialogAbortButtonLabel = dialogAbortButtonLabel;
    const dialogFeedbackSubject = new Subject<boolean>();
    const dialogFeedback = dialogFeedbackSubject.asObservable();
    this.subject = dialogFeedbackSubject;
    this.dialogFeedback = dialogFeedback;
  }
}

@Component({
  selector: "sbb-confirmation-dialog",
  templateUrl: "./confirmation-dialog.component.html",
  styleUrls: ["./confirmation-dialog.component.scss"],
})
export class ConfirmationDialogComponent implements OnDestroy {
  @ViewChild("confirmationDialogTemplate", {static: true})
  confirmationDialogTemplate: TemplateRef<any>;

  public dialogTitle: string;
  public dialogContent: string;
  public dialogConfirmationButtonLabel: string;
  public dialogAbortButtonLabel: string;

  private destroyed = new Subject<void>();

  constructor(
    public dialog: SbbDialog,
    private uiInteractionService: UiInteractionService,
  ) {
    this.uiInteractionService.confirmationDiagramDialog
      .pipe(takeUntil(this.destroyed))
      .subscribe((parameter: ConfirmationDialogParameter) => {
        this.dialogTitle = parameter.dialogTitle;
        this.dialogContent = parameter.dialogContent;
        this.dialogConfirmationButtonLabel = parameter.dialogConfirmationButtonLabel;
        this.dialogAbortButtonLabel = parameter.dialogAbortButtonLabel;
        this.openDialog(parameter);
      });
  }

  static getDialogConfig() {
    const dialogConfig = new SbbDialogConfig();
    const width = 500;
    const height = 220;
    dialogConfig.width = width + "px";
    dialogConfig.minWidth = dialogConfig.width;
    dialogConfig.maxWidth = dialogConfig.width;
    dialogConfig.height = height + "px";
    dialogConfig.minHeight = dialogConfig.height;
    dialogConfig.maxHeight = dialogConfig.height;
    dialogConfig.panelClass = "";
    return dialogConfig;
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  openDialog(parameter: ConfirmationDialogParameter) {
    const dialogConfig = ConfirmationDialogComponent.getDialogConfig();
    const dialogRef = this.dialog.open(this.confirmationDialogTemplate, dialogConfig);
    let userHasConfirmed;
    dialogRef.afterClosed().subscribe((result) => {
      if (result === true) {
        userHasConfirmed = true;
        parameter.subject.next(userHasConfirmed);
      } else {
        userHasConfirmed = false;
        parameter.subject.next(userHasConfirmed);
      }
    });
  }
}
