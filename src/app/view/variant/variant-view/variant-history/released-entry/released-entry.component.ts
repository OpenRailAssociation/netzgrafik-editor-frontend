import {Component, EventEmitter, Input, Output} from "@angular/core";
import {HistoryEntryAction} from "../history-entry/history-entry.component";
import {DownloadVersionModel, VersionId} from "../model";
import {UserId} from "../version-entry-layout/version-entry-layout.component";

@Component({
  selector: "sbb-released-entry",
  templateUrl: "./released-entry.component.html",
  styleUrls: ["./released-entry.component.scss"],
  standalone: false,
})
export class ReleasedEntryComponent {
  @Input() model: ReleasedEntryModel;
  @Input() isWritable = false;

  @Output() dropChanges = new EventEmitter<void>();
  @Output() saveAsNewVariant = new EventEmitter<VersionId>();
  @Output() ignoreConflict = new EventEmitter<void>();
  @Output() restore = new EventEmitter<VersionId>();
  @Output() display = new EventEmitter<VersionId | null>();
  @Output() download = new EventEmitter<DownloadVersionModel>();

  get actions(): HistoryEntryAction[] {
    const download = {
      name: $localize`:@@app.view.variant.variant-view.variant-history.released-entry.download:Download`,
      icon: "download-small",
      onClick: () =>
        this.download.next({
          versionId: this.model.id,
          fileName: `netzgrafik_version_${this.model.releaseVersion}.json`,
        }),
    };

    if (!this.isWritable) {
      return [download];
    }

    if (this.model.conflict) {
      return [
        {
          name: $localize`:@@app.view.variant.variant-view.variant-history.released-entry.discard-changes:Discard changes`,
          icon: "trash-small",
          onClick: () => this.dropChanges.emit(),
        },
        {
          name: $localize`:@@app.view.variant.variant-view.variant-history.released-entry.ignore-conflict:Ignore conflict`,
          icon: "tick-small",
          onClick: () => this.ignoreConflict.emit(),
        },
        download,
      ];
    }

    return [
      {
        name: $localize`:@@app.view.variant.variant-view.variant-history.released-entry.restore:Restore`,
        icon: "arrows-circle-small",
        onClick: () => this.restore.next(this.model.id),
      },
      {
        name: $localize`:@@app.view.variant.variant-view.variant-history.released-entry.as-new-variant:As new variant`,
        icon: "circle-plus-small",
        onClick: () => this.saveAsNewVariant.emit(this.model.id),
      },
      download,
    ];
  }

  getState(): "conflict" | "added" | undefined {
    if (this.model.conflict) {
      return "conflict";
    }
    if (this.model.lastAdded) {
      return "added";
    }

    return undefined;
  }

  getMessage(): string | undefined {
    if (this.model.conflict) {
      return $localize`:@@app.view.variant.variant-view.variant-history.released-entry.version-already-available:Version already available`;
    }
    if (this.model.lastAdded) {
      return $localize`:@@app.view.variant.variant-view.variant-history.released-entry.successfully-published:Successfully published`;
    }

    return undefined;
  }

  getUserId(): UserId {
    return new UserId(this.model.createdBy);
  }
}

export interface ReleasedEntryModel {
  id: VersionId;
  releaseVersion: number;
  comment: string;
  createdAt: Date;
  createdBy: string;
  conflict?: boolean;
  lastAdded?: boolean;
}
