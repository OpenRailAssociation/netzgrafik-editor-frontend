import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from "@angular/core";
import {Trainrun} from "../../../../models/trainrun.model";
import {TrainrunService} from "../../../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../../../services/data/trainrunsection.service";
import {UiInteractionService} from "../../../../services/ui/ui.interaction.service";
import {ConfirmationDialogParameter} from "../../confirmation-dialog/confirmation-dialog.component";
import {DataService} from "../../../../services/data/data.service";
import {Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {VersionControlService} from "../../../../services/data/version-control.service";
import {Direction} from "src/app/data-structures/business.data.structures";

@Component({
  selector: "sbb-trainrun-roundtrip-tab",
  templateUrl: "./trainrun-roundtrip-tab.component.html",
  styleUrls: ["./trainrun-roundtrip-tab.component.scss"],
})
export class TrainrunRoundtripTabComponent implements OnInit, OnDestroy {
  @Output() trainrunDeleted = new EventEmitter<void>();
  @Input() toolbarVisible = true;
  @Input() isIntegratedComponent = false;
  @Input() minHeightPx = "250px";
  @Input() innerContentScaleFactor = "1.0";
  public selectedTrainrun: Trainrun;
  private destroyed = new Subject<void>();
  public isOneWay: boolean = false;

  constructor(
    public dataService: DataService,
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private uiInteractionService: UiInteractionService,
    private versionControlService: VersionControlService,
    private cd: ChangeDetectorRef,
  ) {
    this.initializeWithCurrentSelectedTrainrun();
  }

  ngOnInit() {
    this.trainrunSectionService.trainrunSections.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.initializeWithCurrentSelectedTrainrun();
      this.updateTrainrunLabelsAutoCompleteOptions();
    });

    this.updateTrainrunLabelsAutoCompleteOptions();
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  getContentClassTag(): string {
    let retVal = "EditTrainrunRoundTripDialogTabContent";
    if (this.isIntegratedComponent) {
      retVal += " IntegratedComponent ";
    }
    if (this.versionControlService.getVariantIsWritable()) {
      return retVal;
    }
    return retVal + " readonly";
  }

  getContentStyleTag(): string {
    return "min-height: " + this.minHeightPx + ";";
  }

  getContentFooterClassTag(): string {
    const retVal: string = "EditTrainrunDialogTabFooter";
    if (this.versionControlService.getVariantIsWritable()) {
      return retVal;
    }
    return retVal + " readonly";
  }

  onIsOneWayChanged(isChecked: boolean) {
    this.isOneWay = isChecked;
    if (!isChecked && !this.selectedTrainrun.isRoundTrip()) {
      this.trainrunService.updateDirection(this.selectedTrainrun, Direction.ROUND_TRIP);
    }
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
    if (this.selectedTrainrun) this.isOneWay = !this.selectedTrainrun.isRoundTrip();
  }

  private updateTrainrunLabelsAutoCompleteOptions() {
    this.cd.detectChanges();
  }
}
