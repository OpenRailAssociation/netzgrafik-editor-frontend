import {fakeAsync, tick} from "@angular/core/testing";
import {HttpErrorResponse} from "@angular/common/http";
import {Observable, of, Subject} from "rxjs";
import {VariantDto} from "../../api/generated";
import {VersionControlService} from "./version-control.service";
import {AutosaveBackendService} from "./autosave-backend.service";
import {AutoSaveService} from "./auto-save.service";
import {LogService} from "../../logger/log.service";

class AutoSaveServiceMock {
  readonly trigger = new Subject<void>();
  readonly autosaveTrigger$ = this.trigger.asObservable();
  modified = false;
  model = "model-1";
  readonly markSaved = jasmine.createSpy("markSaved");
  readonly reset = jasmine.createSpy("reset");
  readonly disable = jasmine.createSpy("disable");

  isModified(): boolean {
    return this.modified;
  }

  getCurrentNetzgrafikJson(): string {
    return this.model;
  }
}

interface SnapshotCall {
  baseVersionId: number;
  name: string;
  model: string;
  response: Subject<number>;
}

const variantWithLatestVersion = (latestVersionId: number, name = "Variant"): VariantDto =>
  ({
    id: 1,
    projectId: 1,
    isWritable: true,
    latestVersion: {id: latestVersionId, name, variantId: 1},
  }) as unknown as VariantDto;

describe("VersionControlService (save)", () => {
  let service: VersionControlService;
  let autoSave: AutoSaveServiceMock;
  let snapshotCalls: SnapshotCall[];
  let backendLatestVersionId: number;
  let getVariantCalls: number;
  let versionsBackend: jasmine.SpyObj<{
    restoreVersion: (id: number) => Observable<number>;
    createReleaseVersion: () => Observable<number>;
    getVersionModel: () => Observable<unknown>;
  }>;

  beforeEach(() => {
    autoSave = new AutoSaveServiceMock();
    snapshotCalls = [];
    backendLatestVersionId = 10;
    getVariantCalls = 0;

    const autosaveBackend = {
      createSnapshotVersion: (baseVersionId: number, dto: {name: string; model: string}) => {
        const response = new Subject<number>();
        snapshotCalls.push({baseVersionId, name: dto.name, model: dto.model, response});
        return response.asObservable();
      },
      getVariant: () => {
        getVariantCalls++;
        return of(variantWithLatestVersion(backendLatestVersionId));
      },
    } as unknown as AutosaveBackendService;

    versionsBackend = jasmine.createSpyObj("VersionControllerBackendService", [
      "restoreVersion",
      "createReleaseVersion",
      "getVersionModel",
    ]);
    versionsBackend.getVersionModel.and.returnValue(of({}));
    const variantsBackend = {
      getVariant: () => of(variantWithLatestVersion(backendLatestVersionId)),
    };
    const dataService = {loadNetzgrafikDto: jasmine.createSpy("loadNetzgrafikDto")};
    const undoService = {reset: jasmine.createSpy("reset")};
    const logService = jasmine.createSpyObj<LogService>("LogService", ["debug", "warn", "error"]);

    service = new VersionControlService(
      variantsBackend as never,
      versionsBackend as never,
      autosaveBackend,
      dataService as never,
      autoSave as unknown as AutoSaveService,
      undoService as never,
      logService,
    );
    service.variantSubject.next(variantWithLatestVersion(10));
  });

  const completeSnapshot = (call: SnapshotCall, newVersionId: number) => {
    backendLatestVersionId = newVersionId;
    call.response.next(newVersionId);
    call.response.complete();
  };

  const triggerAutosave = (times = 1) => {
    autoSave.modified = true;
    for (let i = 0; i < times; i++) {
      autoSave.trigger.next();
    }
  };

  it("does not start a second save while a save is running", () => {
    triggerAutosave();
    triggerAutosave();

    expect(snapshotCalls.length).toBe(1);
    expect(snapshotCalls[0].baseVersionId).toBe(10);
  });

  it("runs exactly one follow-up save based on the new latest version", () => {
    triggerAutosave();
    autoSave.model = "model-2";
    triggerAutosave(5);

    completeSnapshot(snapshotCalls[0], 11);

    expect(autoSave.markSaved).toHaveBeenCalledWith("model-1");
    expect(snapshotCalls.length).toBe(2);
    expect(snapshotCalls[1].baseVersionId).toBe(11);
    expect(snapshotCalls[1].model).toBe("model-2");

    autoSave.modified = false;
    completeSnapshot(snapshotCalls[1], 12);

    expect(snapshotCalls.length).toBe(2);
    expect(service.saveState).toBe("idle");
    expect(service.variant.latestVersion.id).toBe(12);
  });

  it("does not save if nothing is modified", () => {
    autoSave.modified = false;
    autoSave.trigger.next();

    expect(snapshotCalls.length).toBe(0);
  });

  it("keeps a manual rename requested during a running autosave", () => {
    triggerAutosave();
    service.createSnapshot("New name");

    completeSnapshot(snapshotCalls[0], 11);

    expect(snapshotCalls.length).toBe(2);
    expect(snapshotCalls[1].name).toBe("New name");
  });

  it("aborts a save after the timeout and refreshes the variant before the next save", fakeAsync(() => {
    triggerAutosave();
    expect(snapshotCalls[0].response.observed).toBeTrue();

    tick(VersionControlService.SAVE_TIMEOUT_MS);

    expect(snapshotCalls[0].response.observed).toBeFalse();
    expect(service.saveState).toBe("error");

    // backend committed the aborted save anyway
    backendLatestVersionId = 11;
    const getVariantCallsBefore = getVariantCalls;
    triggerAutosave();

    expect(getVariantCalls).toBe(getVariantCallsBefore + 1);
    expect(snapshotCalls.length).toBe(2);
    expect(snapshotCalls[1].baseVersionId).toBe(11);
  }));

  it("does not run into the timeout if the save completes in time", fakeAsync(() => {
    triggerAutosave();
    tick(VersionControlService.SAVE_TIMEOUT_MS - 1);
    completeSnapshot(snapshotCalls[0], 11);
    tick(1);

    expect(service.saveState).toBe("idle");
  }));

  it("sets the error state on a failed save and retries on request", () => {
    triggerAutosave();
    snapshotCalls[0].response.error(new HttpErrorResponse({status: 409}));

    expect(service.saveState).toBe("error");
    expect(service.hasUnsavedChanges()).toBeTrue();

    backendLatestVersionId = 11;
    service.retrySave();

    expect(snapshotCalls.length).toBe(2);
    expect(snapshotCalls[1].baseVersionId).toBe(11);
    expect(service.saveState).toBe("saving");
  });

  it("keeps a rename after a failed save for the retry", () => {
    service.createSnapshot("New name");
    snapshotCalls[0].response.error(new HttpErrorResponse({status: 500}));

    service.retrySave();

    expect(snapshotCalls[1].name).toBe("New name");
  });

  it("waits for a running save before restoring a version", () => {
    versionsBackend.restoreVersion.and.returnValue(of(20));
    triggerAutosave();

    service.restoreVersion(5);
    expect(versionsBackend.restoreVersion).not.toHaveBeenCalled();

    completeSnapshot(snapshotCalls[0], 11);
    expect(versionsBackend.restoreVersion).toHaveBeenCalledWith(5);
  });

  it("does not save local changes while a restore is running", () => {
    const restoreResponse = new Subject<number>();
    versionsBackend.restoreVersion.and.returnValue(restoreResponse.asObservable());

    service.restoreVersion(5);
    triggerAutosave();
    restoreResponse.next(20);
    restoreResponse.complete();

    expect(snapshotCalls.length).toBe(0);
  });

  it("reports unsaved changes while a save is running", () => {
    triggerAutosave();
    autoSave.modified = false;

    expect(service.hasUnsavedChanges()).toBeTrue();

    completeSnapshot(snapshotCalls[0], 11);
    expect(service.hasUnsavedChanges()).toBeFalse();
  });
});
