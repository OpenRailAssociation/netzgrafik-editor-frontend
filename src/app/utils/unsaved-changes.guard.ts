import {inject} from "@angular/core";
import {CanDeactivateFn} from "@angular/router";
import {VersionControlService} from "../services/data/version-control.service";
import {environment} from "../../environments/environment";

export const UnsavedChangesGuard: CanDeactivateFn<unknown> = () => {
  if (environment.disableBackend || !inject(VersionControlService).hasUnsavedChanges()) {
    return true;
  }
  return window.confirm(
    $localize`:@@app.netzgrafik-application.unsaved-changes:There are unsaved changes. Do you really want to leave this page?`,
  );
};
