import {Component, Inject, ChangeDetectionStrategy} from "@angular/core";
import {CommonModule} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {SBB_DIALOG_DATA, SbbDialog, SbbDialogModule, SbbDialogRef} from "@sbb-esta/angular/dialog";
import {ProjectFormComponentModel} from "./project-form/project-form.component";
import {I18nModule} from "../../../core/i18n/i18n.module";
import {FormModel} from "../../../utils/form-model";
import {Observable} from "rxjs";
import {filter} from "rxjs/operators";
import {ProjectFormComponent} from "./project-form/project-form.component";

@Component({
  selector: "sbb-project-dialog",
  templateUrl: "./project-dialog.component.html",
  styleUrls: ["./project-dialog.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    I18nModule,
    FormsModule,
    ReactiveFormsModule,
    SbbDialogModule,
    ProjectFormComponent,
  ],
})
export class ProjectDialogComponent {
  readonly formModel: FormModel<ProjectFormComponentModel>;
  readonly isNewProject: boolean;

  constructor(
    public readonly dialogRef: SbbDialogRef<ProjectDialogComponent, ProjectFormComponentModel>,
    @Inject(SBB_DIALOG_DATA) data?: ProjectFormComponentModel,
  ) {
    this.formModel = new FormModel<ProjectFormComponentModel>(
      data ?? {
        name: "",
        description: "",
        summary: "",
        writeUsers: [],
        readUsers: [],
      },
    );
    this.isNewProject = !!!data;
  }

  public static open(
    dialog: SbbDialog,
    initData?: ProjectFormComponentModel,
  ): Observable<ProjectFormComponentModel> {
    return dialog
      .open(ProjectDialogComponent, initData ? {data: initData} : undefined)
      .afterClosed()
      .pipe(filter((project) => typeof project === "object"));
  }

  onCreateClicked(): void {
    const formData = this.formModel.tryGetValid();

    if (formData) {
      this.dialogRef.close(formData);
    }
  }

  onCancelClicked(): void {
    if (this.dialogRef !== null) {
      this.dialogRef.close();
    }
  }
}
