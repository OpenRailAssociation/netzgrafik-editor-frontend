import {Component, Input} from "@angular/core";
import {LogService} from "../../../../../logger/log.service";

@Component({
  selector: "sbb-version-entry-layout",
  templateUrl: "./version-entry-layout.component.html",
  styleUrls: ["./version-entry-layout.component.scss"],
})
export class VersionEntryLayoutComponent {
  @Input() state?: "conflict" | "added";
  @Input() message?: string;

  @Input() titleField: string | UserId;
  @Input() dateField: Date;
  @Input() commentField?: string;

  constructor(private readonly logService: LogService) {}

  isInConflictState(): boolean {
    return this.state === "conflict";
  }

  isInAddedState(): boolean {
    return this.state === "added";
  }

  public getEntryStyle(): Record<string, boolean> {
    return {
      "in-conflict": this.isInConflictState(),
      "new-added": this.isInAddedState(),
    };
  }

  getUserId(): string | undefined {
    if (this.titleField instanceof UserId) {
      return this.titleField.value;
    }
    return undefined;
  }

  copyComment() {
    const comment = this.commentField;
    if (!comment) {
      return;
    }
    navigator.clipboard.writeText(comment);
    const msg = $localize`:@@app.view.variant.variant-view.variant-history.version-entry-layout.user-id-copied:copied ${comment}:msg:`;
    this.logService.info(msg);
  }

  copyUserId() {
    const userId = this.getUserId();
    if (!userId) {
      return;
    }
    navigator.clipboard.writeText(userId);
    const msg = $localize`:@@app.view.variant.variant-view.variant-history.version-entry-layout.user-id-copied:copied ${userId}:msg:`;
    this.logService.info(msg);
  }

  getTitle(): string | undefined {
    if (typeof this.titleField === "string") {
      return this.titleField;
    }
    return undefined;
  }
}

export class UserId {
  constructor(readonly value: string) {}
}
