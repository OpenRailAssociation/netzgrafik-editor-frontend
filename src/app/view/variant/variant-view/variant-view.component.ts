import {Component, OnDestroy} from "@angular/core";
import {VersionControlService} from "../../../services/data/version-control.service";
import {filter, mergeMap, takeUntil} from "rxjs/operators";
import {ConfirmationDialogParameter} from "../../dialogs/confirmation-dialog/confirmation-dialog.component";
import {Subject} from "rxjs";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {VariantDialogComponent} from "../variant-dialog/variant-dialog.component";
import {SbbDialog} from "@sbb-esta/angular/dialog";
import {NavigationService} from "../../../services/ui/navigation.service";

@Component({
  selector: "sbb-variant-view",
  templateUrl: "./variant-view.component.html",
  styleUrls: ["./variant-view.component.scss"],
})
export class VariantViewComponent implements OnDestroy {
  private readonly destroyed = new Subject<void>();

  constructor(
    readonly versionControlService: VersionControlService,
    private readonly dialog: SbbDialog,
    private navigationService: NavigationService,
    private uiInteractionService: UiInteractionService,
  ) {}

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  onOpenVariantDialog() {
    VariantDialogComponent.open(this.dialog, {
      name: this.versionControlService.variant.latestVersion.name,
    })
      .pipe(takeUntil(this.destroyed))
      .subscribe((model) => this.versionControlService.createSnapshot(model.name));
  }

  onDeleteVariant() {
    const projectId = this.versionControlService.variant.projectId;
    this.uiInteractionService
      .showConfirmationDiagramDialog(
        new ConfirmationDialogParameter(
          $localize`:@@app.view.variant.variant-view.delete-variant.title:Delete variant`,
          $localize`:@@app.view.variant.variant-view.delete-variant.content:Do you want to permanently delete the variant and all versions it contains? This action cannot be undone.`,
        ),
      )
      .pipe(
        filter((confirmed) => confirmed),
        mergeMap(() => this.versionControlService.deleteVariant()),
        takeUntil(this.destroyed),
      )
      .subscribe(() => this.navigationService.navigateToVariants(projectId));
  }
}
