import {Component, Inject} from "@angular/core";
import {SBB_DIALOG_DATA, SbbDialog, SbbDialogRef} from "@sbb-esta/angular/dialog";
import {FormModel} from "../../../utils/form-model";
import {VariantFormComponentModel} from "./variant-form/variant-form.component";
import {Observable} from "rxjs";
import {filter} from "rxjs/operators";

@Component({
  selector: "sbb-variant-dialog",
  templateUrl: "./variant-dialog.component.html",
  styleUrls: ["./variant-dialog.component.scss"],
})
export class VariantDialogComponent {
  readonly formModel: FormModel<VariantFormComponentModel>;
  readonly isNewVariant: boolean;

  constructor(
    public readonly dialogRef: SbbDialogRef<VariantDialogComponent, VariantFormComponentModel>,
    @Inject(SBB_DIALOG_DATA) data?: VariantFormComponentModel,
  ) {
    this.formModel = new FormModel<VariantFormComponentModel>(data ?? {name: ""});
    this.isNewVariant = !!!data;
  }

  public static open(
    dialog: SbbDialog,
    initData?: VariantFormComponentModel,
  ): Observable<VariantFormComponentModel> {
    return dialog
      .open(VariantDialogComponent, initData ? {data: initData} : undefined)
      .afterClosed()
      .pipe(filter((variant) => !!variant));
  }

  onCreateClicked(): void {
    const formdata = this.formModel.tryGetValid();

    if (formdata) {
      this.dialogRef.close(formdata);
    }
  }

  onCancelClicked(): void {
    this.dialogRef.close();
  }
}
