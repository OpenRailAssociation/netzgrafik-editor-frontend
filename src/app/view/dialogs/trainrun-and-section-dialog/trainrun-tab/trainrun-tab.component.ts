import {Component, EventEmitter, Input, OnDestroy, Output} from "@angular/core";
import {
  TrainrunCategory,
  TrainrunFrequency,
  TrainrunTimeCategory,
} from "../../../../data-structures/business.data.structures";
import {Trainrun} from "../../../../models/trainrun.model";
import {TrainrunService} from "../../../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../../../services/data/trainrunsection.service";
import {UiInteractionService} from "../../../../services/ui/ui.interaction.service";
import {ConfirmationDialogParameter} from "../../confirmation-dialog/confirmation-dialog.component";
import {DataService} from "../../../../services/data/data.service";
import {StaticDomTags} from "../../../editor-main-view/data-views/static.dom.tags";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {TrainrunDialogParameter} from "../trainrun-and-section-dialog.component";
import {VersionControlService} from "../../../../services/data/version-control.service";

@Component({
  selector: "sbb-trainrun-tab",
  templateUrl: "./trainrun-tab.component.html",
  styleUrls: ["./trainrun-tab.component.scss"],
})
export class TrainrunTabComponent implements OnDestroy {
  @Output() trainrunDeleted = new EventEmitter<void>();
  @Input() toolbarVisible = true;
  @Input() isIntegratedComponent = false;
  @Input() trainrunDialogParameter: TrainrunDialogParameter;

  public selectedTrainrun: Trainrun;
  public selectedFrequency: TrainrunFrequency;
  public selectedCategory: TrainrunCategory;
  public selectedTimeCategory: TrainrunTimeCategory;
  public trainrunTitle: string;

  private destroyed = new Subject<void>();

  constructor(
    public dataService: DataService,
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private uiInteractionService: UiInteractionService,
    private versionControlService: VersionControlService,
  ) {
    this.initializeWithCurrentSelectedTrainrun();
    this.trainrunService.trainruns.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.initializeWithCurrentSelectedTrainrun();
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  getContentClassTag(): string {
    const readonlyTag: string = this.versionControlService.getVariantIsWritable()
      ? " "
      : " readonly";
    if (this.isIntegratedComponent) {
      return "EditTrainrunDialogTabContent IntegratedComponent" + readonlyTag;
    }
    return "EditTrainrunDialogTabContent" + readonlyTag;
  }

  getContentFooterClassTag(): string {
    const retVal: string = "EditTrainrunDialogTabFooter";
    if (this.versionControlService.getVariantIsWritable()) {
      return retVal;
    }
    return retVal + " readonly";
  }

  getFrequencyClassname(trainrunFrequency: TrainrunFrequency): string {
    if (trainrunFrequency.id === this.selectedFrequency.id) {
      return (
        "TrainrunDialog Frequency Frequency_" +
        trainrunFrequency.linePatternRef +
        " " +
        StaticDomTags.TAG_SELECTED
      );
    }
    return "TrainrunDialog Frequency Frequency_" + trainrunFrequency.linePatternRef;
  }

  getCategoryClassname(trainrunCategory: TrainrunCategory): string {
    if (trainrunCategory.id === this.selectedCategory.id) {
      return (
        "TrainrunDialog " +
        StaticDomTags.makeClassTag(StaticDomTags.TAG_COLOR_REF, trainrunCategory.colorRef) +
        " " +
        StaticDomTags.TAG_SELECTED
      );
    }
    return (
      "TrainrunDialog " +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_COLOR_REF, trainrunCategory.colorRef)
    );
  }

  getTimeCategoryClassname(trainrunTimeCategory: TrainrunTimeCategory): string {
    if (trainrunTimeCategory.id === this.selectedTimeCategory.id) {
      return (
        "TrainrunDialog TimeCategory " +
        StaticDomTags.makeClassTag(
          StaticDomTags.TAG_LINEPATTERN_REF,
          trainrunTimeCategory.linePatternRef,
        ) +
        " " +
        StaticDomTags.TAG_SELECTED
      );
    }
    return (
      "TrainrunDialog TimeCategory " +
      StaticDomTags.makeClassTag(
        StaticDomTags.TAG_LINEPATTERN_REF,
        trainrunTimeCategory.linePatternRef,
      )
    );
  }

  onTrainrunTitleChanged() {
    this.trainrunService.updateTrainrunTitle(this.selectedTrainrun, this.trainrunTitle);
  }

  onCategoryChanged(trainrunCategory: TrainrunCategory) {
    this.selectedCategory = trainrunCategory;
    this.trainrunService.updateTrainrunCategory(this.selectedTrainrun, this.selectedCategory);
  }

  onTimeCategoryChanged(trainrunTimeCategory: TrainrunTimeCategory) {
    this.selectedTimeCategory = trainrunTimeCategory;
    this.trainrunService.updateTrainrunTimeCategory(
      this.selectedTrainrun,
      this.selectedTimeCategory,
    );
  }

  onFrequencyChanged(trainrunFrequency: TrainrunFrequency) {
    this.selectedFrequency = trainrunFrequency;
    const freqOffset = this.trainrunService.updateTrainrunFrequency(
      this.selectedTrainrun,
      this.selectedFrequency,
      this.trainrunDialogParameter === undefined ? 0 : this.trainrunDialogParameter.offset,
    );
    if (this.trainrunDialogParameter !== undefined) {
      this.trainrunDialogParameter.offset -= freqOffset;
    }
  }

  makeButtonLabel(label: string): string {
    if (label.length > 4) {
      return label.substring(0, 3) + "...";
    }
    return label;
  }

  onDeleteTrainrun() {
    const dialogTitle = $localize`:@@app.view.dialogs.trainrun-and-section-dialog.trainrun-tab.delete:Delete`;
    const dialogContent = $localize`:@@app.view.dialogs.trainrun-and-section-dialog.trainrun-tab.deleteConfirmationQuestion:Should the entire train route be definitively deleted?`;
    const confirmationDialogParamter = new ConfirmationDialogParameter(dialogTitle, dialogContent);
    this.uiInteractionService
      .showConfirmationDiagramDialog(confirmationDialogParamter)
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

  private initializeWithCurrentSelectedTrainrun() {
    this.selectedTrainrun = this.trainrunService.getSelectedTrainrun();
    if (this.selectedTrainrun !== null) {
      this.selectedFrequency = this.selectedTrainrun.getTrainrunFrequency();
      this.selectedCategory = this.selectedTrainrun.getTrainrunCategory();
      this.selectedTimeCategory = this.selectedTrainrun.getTrainrunTimeCategory();
      this.trainrunTitle = this.selectedTrainrun.getTitle();
    }
  }
}
