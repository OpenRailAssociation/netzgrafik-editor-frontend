import {Component, EventEmitter, Input, OnInit, Output} from "@angular/core";
import {VersionDto} from "../../../../../api/generated";
import {ReleasedEntryModel} from "../released-entry/released-entry.component";
import {DownloadVersionModel, VersionId} from "../model";
import {PublishEntryModel} from "../publish-entry/publish-entry.component";
import {SnapshotEntryModel} from "../snapshot-entry/snapshot-entry.component";

@Component({
  selector: "sbb-version-entries",
  templateUrl: "./version-entries.component.html",
  styleUrls: ["./version-entries.component.scss"],
})
export class VersionEntriesComponent implements OnInit {
  private static SHOW_MORE_JUNK_SIZE = 3;

  @Input() isWritable = false;
  @Input() model: VersionEntries;
  @Input() lastAddedVersion?: number;
  @Input() publishDisabled = false;

  @Output() dropChanges = new EventEmitter<void>();
  @Output() saveAsNewVariant = new EventEmitter<VersionId>();
  @Output() ignoreConflict = new EventEmitter<void>();
  @Output() restore = new EventEmitter<VersionId>();
  @Output() display = new EventEmitter<VersionId | null>();
  @Output() publish = new EventEmitter<string>();
  @Output() download = new EventEmitter<DownloadVersionModel>();

  releasedEntry?: ReleasedEntryModel;
  publishEntry?: PublishEntryModel;
  snapshotEntries: SnapshotEntryModel[];

  private nrDisplayedSnapshots = VersionEntriesComponent.SHOW_MORE_JUNK_SIZE;

  ngOnInit(): void {
    this.releasedEntry = this.createReleasedEntry();
    this.publishEntry = this.createPublishEntry();
    this.snapshotEntries = this.createSnapshotEntries();
  }

  onShowMoreSnapshots(): void {
    this.nrDisplayedSnapshots += VersionEntriesComponent.SHOW_MORE_JUNK_SIZE;
    this.snapshotEntries = this.createSnapshotEntries();
  }

  onShowLessSnapshots(): void {
    this.nrDisplayedSnapshots -= VersionEntriesComponent.SHOW_MORE_JUNK_SIZE;
    this.snapshotEntries = this.createSnapshotEntries();
  }

  canShowMoreSnapshots(): boolean {
    return this.nrDisplayedSnapshots < this.model.snapshotVersions.length;
  }

  canHideSnapshots(): boolean {
    return this.nrDisplayedSnapshots > 3;
  }

  private createReleasedEntry(): ReleasedEntryModel | undefined {
    if (this.model.releasedVersion) {
      const version = this.model.releasedVersion;
      return {
        id: version.id,
        releaseVersion: version.releaseVersion,
        createdAt: new Date(version.createdAt),
        createdBy: version.createdBy,
        comment: version.comment,
        conflict: this.hasReleaseConflict(),
        lastAdded: this.isLastAdded(version.id),
      };
    }
    return undefined;
  }

  private createPublishEntry(): PublishEntryModel | undefined {
    if (!this.model.releasedVersion && this.model.snapshotVersions.length > 0) {
      return {
        nextReleaseVersion: this.model.snapshotVersions[0].releaseVersion,
      };
    }
    return undefined;
  }

  private createSnapshotEntries(): SnapshotEntryModel[] {
    return this.model.snapshotVersions.slice(0, this.nrDisplayedSnapshots).map((version) => ({
      id: version.id,
      releaseVersion: version.releaseVersion,
      snapshotVersion: version.snapshotVersion,
      createdAt: new Date(version.createdAt),
      createdBy: version.createdBy,
      comment: version.comment,
      lastAdded: this.isLastAdded(version.id),
    }));
  }

  private hasReleaseConflict(): boolean {
    return this.model.releasedVersion && this.model.snapshotVersions.length > 0;
  }

  private isLastAdded(versionId: number): boolean {
    return this.lastAddedVersion === versionId;
  }
}

export interface VersionEntries {
  readonly releasedVersion?: VersionDto;
  readonly snapshotVersions: VersionDto[];
}
