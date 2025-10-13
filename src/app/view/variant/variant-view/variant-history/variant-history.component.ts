import {Component, Input, OnChanges, OnDestroy, SimpleChanges} from "@angular/core";
import {DownloadVersionModel, VersionId} from "./model";
import {VersionControlService} from "../../../../services/data/version-control.service";
import {
  VariantDto,
  VersionControllerBackendService,
  VersionDto,
  VariantControllerBackendService,
} from "../../../../api/generated";
import {VersionEntries} from "./version-entries/version-entries.component";
import {Subject} from "rxjs";
import {mergeMap, takeUntil} from "rxjs/operators";
import {PreviewService} from "../../../../services/data/preview.service";
import {UiInteractionService} from "../../../../services/ui/ui.interaction.service";
import {ConfirmationDialogParameter} from "../../../dialogs/confirmation-dialog/confirmation-dialog.component";
import {downloadBlob} from "../../../util/download-utils";
import {VariantDialogComponent} from "../../variant-dialog/variant-dialog.component";
import {SbbDialog} from "@sbb-esta/angular/dialog";
import {NavigationService} from "../../../../services/ui/navigation.service";
import {AutoSaveService} from "../../../../services/data/auto-save.service";

@Component({
  selector: "sbb-variant-history",
  templateUrl: "./variant-history.component.html",
  styleUrls: ["./variant-history.component.scss"],
})
export class VariantHistoryComponent implements OnChanges, OnDestroy {
  @Input() variant: VariantDto;
  @Input() lastAddedVersion?: number;

  versionEntries: VersionEntries[] = [];

  publishDisabled = this.autoSaveService.modified$;

  private readonly destroyed = new Subject<void>();

  constructor(
    private readonly uiInteractionService: UiInteractionService,
    private readonly versionControlService: VersionControlService,
    private readonly previewService: PreviewService,
    private readonly dialog: SbbDialog,
    private readonly navigationService: NavigationService,
    private readonly variantsBackendService: VariantControllerBackendService,
    private readonly versionBackendService: VersionControllerBackendService,
    private readonly autoSaveService: AutoSaveService,
  ) {
    versionControlService.versionCreated$.pipe(takeUntil(this.destroyed)).subscribe((versionId) => {
      this.lastAddedVersion = versionId;
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.versionEntries = this.groupVersionsByReleaseNumber([...this.variant.versions].reverse());
  }

  onPublishClicked(comment: string): void {
    this.uiInteractionService
      .showConfirmationDiagramDialog(
        new ConfirmationDialogParameter(
          $localize`:@@app.view.variant.variant-view.variant-history.new-version-published.title:New version published`,
          $localize`:@@app.view.variant.variant-view.variant-history.new-version-published.content:Would you like to publish your personal changes as a new version?`,
        ),
      )
      .pipe(takeUntil(this.destroyed))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.versionControlService.createRelease(comment);
        }
      });
  }

  onDropChangesClicked(): void {
    this.uiInteractionService
      .showConfirmationDiagramDialog(
        new ConfirmationDialogParameter(
          $localize`:@@app.view.variant.variant-view.variant-history.discard-changes.title:Discard changes`,
          $localize`:@@app.view.variant.variant-view.variant-history.discard-changes.content:Would you like to irrevocably discard your personal changes?`,
        ),
      )
      .pipe(takeUntil(this.destroyed))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.versionControlService.dropChanges();
        }
      });
  }

  onDisplay(versionId: VersionId): void {
    if (versionId) {
      this.previewService.enablePreview(versionId);
    } else {
      this.previewService.disablePreview();
    }
  }

  onRestore(versionId: VersionId): void {
    this.uiInteractionService
      .showConfirmationDiagramDialog(
        new ConfirmationDialogParameter(
          $localize`:@@app.view.variant.variant-view.variant-history.restore-version.title:Restore version`,
          $localize`:@@app.view.variant.variant-view.variant-history.restore-version.content:Would you like to restore the status of this version?`,
        ),
      )
      .pipe(takeUntil(this.destroyed))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.versionControlService.restoreVersion(versionId);
        }
      });
  }

  onIgnoreConflict(): void {
    this.uiInteractionService
      .showConfirmationDiagramDialog(
        new ConfirmationDialogParameter(
          $localize`:@@app.view.variant.variant-view.variant-history.ignore-conflict.title:Ignore conflict`,
          $localize`:@@app.view.variant.variant-view.variant-history.ignore-conflict.content:Would you like the current version to be based on the highest published version?`,
        ),
      )
      .pipe(takeUntil(this.destroyed))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.versionControlService.raiseSnapshotsToNewestReleaseVersion();
        }
      });
  }

  onSaveAsNewVariant(versionId: VersionId): void {
    VariantDialogComponent.open(this.dialog)
      .pipe(
        takeUntil(this.destroyed),
        mergeMap((dialogData) =>
          this.variantsBackendService.createVariantFromVersion(versionId, {
            name: dialogData.name,
          }),
        ),
      )
      .subscribe((variantId) =>
        this.navigationService.navigateToEditor(this.variant.projectId, variantId),
      );
  }

  onDownload(downloadVersion: DownloadVersionModel): void {
    this.versionBackendService
      .getVersionModel(downloadVersion.versionId)
      .pipe(takeUntil(this.destroyed))
      .subscribe((model) => {
        const blob = new Blob([JSON.stringify(model)], {
          type: "application/json",
        });
        downloadBlob(blob, downloadVersion.fileName);
      });
  }

  private groupVersionsByReleaseNumber(versions: VersionDto[]): VersionEntries[] {
    return versions.reduce(
      (previousValue, currentValue) => this.addVersionToGroup(previousValue, currentValue),
      new Array<VersionEntries>(),
    );
  }

  private addVersionToGroup(groups: VersionEntries[], version: VersionDto): VersionEntries[] {
    const previousVersion = groups.length > 0 ? groups[groups.length - 1] : null;

    if (!version.snapshotVersion) {
      // is a release
      groups.push({
        releasedVersion: version,
        snapshotVersions: [],
      });

      return groups;
    }

    if (!previousVersion) {
      // starts with snapshot
      groups.push({
        snapshotVersions: [version],
      });

      return groups;
    }

    previousVersion.snapshotVersions.push(version);
    return groups;
  }
}
