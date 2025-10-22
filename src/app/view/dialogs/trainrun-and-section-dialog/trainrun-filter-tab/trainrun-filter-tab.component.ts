import {ChangeDetectorRef, Component, EventEmitter, OnDestroy, OnInit, Output} from "@angular/core";
import {Trainrun} from "../../../../models/trainrun.model";
import {TrainrunService} from "../../../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../../../services/data/trainrunsection.service";
import {UiInteractionService} from "../../../../services/ui/ui.interaction.service";
import {ConfirmationDialogParameter} from "../../confirmation-dialog/confirmation-dialog.component";
import {DataService} from "../../../../services/data/data.service";
import {LabelService} from "../../../../services/data/label.service";
import {LabelRef} from "../../../../data-structures/business.data.structures";
import {LabelGroupService} from "../../../../services/data/labelgroup.service";
import {Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {SbbChipEvent, SbbChipInputEvent} from "@sbb-esta/angular/chips";
import {COMMA, ENTER} from "@angular/cdk/keycodes";
import {VersionControlService} from "../../../../services/data/version-control.service";

@Component({
  selector: "sbb-trainrun-filter-tab",
  templateUrl: "./trainrun-filter-tab.component.html",
  styleUrls: ["./trainrun-filter-tab.component.scss"],
})
export class TrainrunFilterTabComponent implements OnInit, OnDestroy {
  @Output() trainrunDeleted = new EventEmitter<void>();

  public selectedTrainrun: Trainrun;
  public trainrunLabels: string[];
  private initialTrainrunLabels: string[];
  trainrunLabelsAutoCompleteOptions: string[] = [];
  readonly separatorKeysCodes = [ENTER, COMMA];
  private destroyed = new Subject<void>();
  private isLabelBeingEdited = false;

  constructor(
    public dataService: DataService,
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private labelService: LabelService,
    private labelGroupService: LabelGroupService,
    private uiInteractionService: UiInteractionService,
    private versionControlService: VersionControlService,
    private cd: ChangeDetectorRef,
  ) {
    this.initializeWithCurrentSelectedTrainrun();
  }

  ngOnInit() {
    this.trainrunSectionService.trainrunSections.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.updateTrainrunLabelsAutoCompleteOptions();
    });

    this.trainrunSectionService.trainrunSections.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.initializeWithCurrentSelectedTrainrun();
    });

    this.updateTrainrunLabelsAutoCompleteOptions();
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  getContentClassTag(): string {
    const retVal = "EditTrainrunFilterableLabelsDialogTabContent";
    if (this.versionControlService.getVariantIsWritable()) {
      return retVal;
    }
    return retVal + " readonly";
  }

  getContentFooterClassTag(): string {
    const retVal: string = "EditTrainrunDialogTabFooter";
    if (this.versionControlService.getVariantIsWritable()) {
      return retVal;
    }
    return retVal + " readonly";
  }

  remove(chipEvent: SbbChipEvent): void {
    const valueDelete = chipEvent.chip.value as string;
    const value = (valueDelete || "").trim();
    if (!value) {
      return;
    }
    this.trainrunLabels = this.trainrunLabels.filter((labels) => labels !== valueDelete);
    this.isLabelBeingEdited = true;
    this.checkAndSetLabels();
    this.isLabelBeingEdited = false;
  }

  add(inputEvent: SbbChipInputEvent): void {
    const value = (inputEvent.value || "").trim();
    if (!value) {
      return;
    }
    this.trainrunLabels.push(value);
    this.isLabelBeingEdited = true;
    this.checkAndSetLabels();
    this.isLabelBeingEdited = false;
    inputEvent.chipInput!.clear();
  }

  onDeleteTrainrun() {
    const dialogTitle = $localize`:@@app.view.dialogs.trainrun-and-section-dialog.trainrun-tab.delete:Delete`;
    const dialogContent = $localize`:@@app.view.dialogs.trainrun-and-section-dialog.trainrun-tab.deleteConfirmationQuestion:Should the entire train route be definitively deleted?`;
    const confirmationDialogParameter = new ConfirmationDialogParameter(dialogTitle, dialogContent);
    this.uiInteractionService
      .showConfirmationDiagramDialog(confirmationDialogParameter)
      .subscribe((confirmed: boolean) => {
        if (confirmed) {
          this.trainrunSectionService.deleteAllTrainrunSectionsOfTrainrun(
            this.selectedTrainrun.getId(),
          );
          this.trainrunDeleted.emit();
        }
      });
  }

  onDuplicateTrainrun() {
    this.trainrunService.duplicateTrainrunAndSections(this.selectedTrainrun.getId());
    this.initializeWithCurrentSelectedTrainrun();
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
    document.getElementById("trainrunLabelsInput").dispatchEvent(keyboardEvent);
    this.checkAndSetLabels();
  }

  getAutoCompleteLabels(): string[] {
    return this.labelGroupService.getAutoCompleteLabels(this.trainrunLabels, LabelRef.Trainrun);
  }

  private initializeWithCurrentSelectedTrainrun() {
    this.selectedTrainrun = this.trainrunService.getSelectedTrainrun();
    if (this.selectedTrainrun === null) return;
    this.trainrunLabels = this.labelService.getTextLabelsFromIds(
      this.selectedTrainrun.getLabelIds(),
    );
    this.initialTrainrunLabels = [...this.trainrunLabels]; // initialize labels
  }

  private updateTrainrunLabelsAutoCompleteOptions() {
    this.trainrunLabelsAutoCompleteOptions = this.getAutoCompleteLabels();
    this.cd.detectChanges();
  }

  // set labels only if any of it has changed
  private checkAndSetLabels() {
    if (
      this.trainrunLabels.length !== this.initialTrainrunLabels.length ||
      !this.trainrunLabels.every((label, index) => label === this.initialTrainrunLabels[index])
    ) {
      this.trainrunService.setLabels(this.selectedTrainrun.getId(), this.trainrunLabels);
      this.initialTrainrunLabels = [...this.trainrunLabels];
    }
  }
}
