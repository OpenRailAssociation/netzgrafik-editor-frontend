import {Component, Inject, OnDestroy} from "@angular/core";
import {SBB_DIALOG_DATA, SbbDialog, SbbDialogRef} from "@sbb-esta/angular/dialog";
import {FormModel} from "../../../utils/form-model";
import {FilterableLabelsFormComponentModel} from "./filterable-labels-form/filterable-label-form.component";
import {Observable, Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {ConfirmationDialogParameter} from "../confirmation-dialog/confirmation-dialog.component";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";

@Component({
  selector: "sbb-filterable-label-dialog",
  templateUrl: "./filterable-label-dialog.component.html",
  styleUrls: ["./filterable-label-dialog.component.scss"],
})
export class FilterableLabelDialogComponent implements OnDestroy {
  readonly formModel: FormModel<FilterableLabelsFormComponentModel>;
  public dialogTitle: string = "";
  private destroyed = new Subject<void>();
  private deleteLabelCallback = null;
  private transferLabelCallback = null;
  private saveLabelCallback = null;
  private originalLabel: string;
  private currentDialog = null;

  constructor(
    private uiInteractionService: UiInteractionService,
    public readonly dialogRef: SbbDialogRef<
      FilterableLabelDialogComponent,
      FilterableLabelsFormComponentModel
    >,
    @Inject(SBB_DIALOG_DATA) data: FilterableLabelsFormComponentModel,
  ) {
    data.updateLabelCallback = () => this.updateLabel();

    this.formModel = new FormModel<FilterableLabelsFormComponentModel>(
      data ?? {
        name: "",
        dialogTitle: "",
        saveLabelCallback: null,
        deleteLabelCallback: null,
        transferLabelCallback: null,
        updateLabelCallback: null,
      },
    );

    this.dialogTitle = data.dialogTitle;
    this.originalLabel = data.name;
    this.deleteLabelCallback = data.deleteLabelCallback;
    this.saveLabelCallback = data.saveLabelCallback;
    this.transferLabelCallback = data.transferLabelCallback;
    this.currentDialog = dialogRef;

    this.dialogRef
      .beforeClosed()
      .pipe(takeUntil(this.destroyed))
      .subscribe(() => {
        this.updateLabel();
      });
  }

  public static open(
    dialog: SbbDialog,
    initData: FilterableLabelsFormComponentModel,
  ): Observable<FilterableLabelsFormComponentModel> {
    return dialog.open(FilterableLabelDialogComponent, {data: initData}).afterClosed();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  onTransferClicked(): void {
    const dialogTitle = $localize`:@@app.view.dialogs.filterable-labels-dialog.filterable-label-dialog-component.transfer.title:Transfer`;
    const dialogContent = $localize`:@@app.view.dialogs.filterable-labels-dialog.filterable-label-dialog-component.transfer.content:Should the label ${this.originalLabel}:label: be applied on all visible ${dialogTitle}:element:?`;
    const confirmationDialogParameter = new ConfirmationDialogParameter(dialogTitle, dialogContent);
    this.uiInteractionService
      .showConfirmationDiagramDialog(confirmationDialogParameter)
      .subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.transferLabelCallback(this.originalLabel);
          this.dialogRef.close();
        }
      });
  }

  onDeleteClicked(): void {
    const dialogTitle = $localize`:@@app.view.dialogs.filterable-labels-dialog.filterable-label-dialog-component.delete.title:Delete`;
    const dialogContent = $localize`:@@app.view.dialogs.filterable-labels-dialog.filterable-label-dialog-component.delete.content:Should the label ${this.originalLabel}:label: be definitely delete on all visible ${dialogTitle}:element:?`;
    const confirmationDialogParameter = new ConfirmationDialogParameter(dialogTitle, dialogContent);
    this.uiInteractionService
      .showConfirmationDiagramDialog(confirmationDialogParameter)
      .subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.deleteLabelCallback(this.originalLabel);
          this.dialogRef.close();
        }
      });
  }

  private updateLabel() {
    this.formModel.tryGetValid();
    const labelValue: string = this.formModel.getControl("name").value;
    this.saveLabelCallback(this.originalLabel, labelValue);
    this.originalLabel = labelValue;
  }
}
