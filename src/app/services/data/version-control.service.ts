import {Injectable, OnDestroy} from "@angular/core";
import {HttpErrorResponse} from "@angular/common/http";
import {
  VariantControllerBackendService,
  VariantDto,
  VersionControllerBackendService,
  VersionDto,
} from "../../api/generated";
import {filter, finalize, map, switchMap, take, takeUntil, tap, timeout} from "rxjs/operators";
import {BehaviorSubject, EMPTY, Observable, of, Subject, TimeoutError} from "rxjs";
import {DataService} from "./data.service";
import {NetzgrafikDto} from "../../data-structures/business.data.structures";
import {AutoSaveService} from "./auto-save.service";
import {LogService} from "../../logger/log.service";
import {VersionId} from "../../view/variant/variant-view/variant-history/model";
import {UndoService} from "./undo.service";
import {environment} from "../../../environments/environment";
import {AutosaveBackendService} from "./autosave-backend.service";

export type SaveState = "idle" | "saving" | "error";

interface SaveRequest {
  // Only set for manual saves (rename), undefined for autosave.
  newName?: string;
}

const mergeSaveRequests = (older: SaveRequest | null, newer: SaveRequest): SaveRequest => ({
  newName: newer.newName ?? older?.newName,
});

@Injectable({
  providedIn: "root",
})
export class VersionControlService implements OnDestroy {
  // Max. duration of a save (POST snapshot + GET variant). A save running longer is aborted,
  // which releases the save lock for the next save.
  static readonly SAVE_TIMEOUT_MS = 180_000;

  readonly variantSubject = new BehaviorSubject<VariantDto | null>(null);
  readonly variant$ = this.variantSubject.asObservable();

  readonly versionCreatedSubject = new Subject<VersionId>();
  readonly versionCreated$ = this.versionCreatedSubject.asObservable();

  private readonly saveStateSubject = new BehaviorSubject<SaveState>("idle");
  readonly saveState$ = this.saveStateSubject.asObservable();

  private readonly destroyed = new Subject<void>();

  private previousVariantDto: VariantDto = undefined;
  private variantChanged = false;

  // Save lock: at most one save (or version operation) runs at a time. Save requests arriving
  // in the meantime are coalesced into pendingSave and executed afterward.
  private readonly busySubject = new BehaviorSubject<boolean>(false);
  private saveSequence = 0;
  private pendingSave: SaveRequest | null = null;
  // After a failed/aborted save the backend state is unknown -> reload latestVersion first.
  private refreshVariantBeforeSave = false;
  // Set while local changes are being replaced by a backend model (restore, drop changes).
  private discardingLocalChanges = false;

  constructor(
    private readonly variantsBackendService: VariantControllerBackendService,
    private readonly versionsBackendService: VersionControllerBackendService,
    private readonly autosaveBackendService: AutosaveBackendService,
    private readonly dataService: DataService,
    private readonly autoSaveService: AutoSaveService,
    private readonly undoService: UndoService,
    private readonly logService: LogService,
  ) {
    if (!environment.disableBackend) {
      autoSaveService.autosaveTrigger$
        .pipe(
          takeUntil(this.destroyed),
          filter(() => this.variant.isWritable),
        )
        .subscribe(() => {
          logService.debug("auto saving changes");
          this.requestSave({});
        });
    }
  }

  get variant(): VariantDto {
    return this.variantSubject.value;
  }

  get saveState(): SaveState {
    return this.saveStateSubject.value;
  }

  private get busy(): boolean {
    return this.busySubject.value;
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  load(variantId: number, loadModel: boolean): void {
    if (this.variant?.id !== variantId) {
      this.onVariantSwitch();
    }
    this.variantsBackendService
      .getVariant(variantId)
      .pipe(takeUntil(this.destroyed))
      .subscribe((variant) => {
        this.updateVarianteChangedInfo(variant);
        this.variantSubject.next(variant);
        if (loadModel) {
          this.loadModel(variant.latestVersion);
        } else {
          this.autoSaveService.reset();
          this.undoService.reset(variantId);
        }
      });
  }

  loadNetzgrafikDTO(netzgrafik: NetzgrafikDto) {
    this.dataService.loadNetzgrafikDto(netzgrafik);
    this.autoSaveService.reset();
    this.undoService.reset(this.undoService.getCurrentVariantId() + 1);
  }

  reload(loadModel = false): void {
    this.load(this.variant.id, loadModel);
  }

  getVariantIsWritable(): boolean {
    if (this.variant === null) {
      return true;
    }
    return this.variant.isWritable;
  }

  createSnapshot(newName?: string): void {
    this.requestSave({newName});
  }

  /** Retries a failed save (e.g. triggered from the save status in the editor menu). */
  retrySave(): void {
    this.requestSave({});
  }

  /** True if there are changes which are not (yet) persisted in the backend. */
  hasUnsavedChanges(): boolean {
    return (
      this.busy ||
      this.pendingSave?.newName !== undefined ||
      (this.getVariantIsWritable() && this.autoSaveService.isModified())
    );
  }

  createRelease(comment: string): void {
    this.runVersionOperation(
      () =>
        this.versionsBackendService.createReleaseVersion(this.variant.latestVersion.id, {comment}),
      (versionId) => {
        this.versionCreatedSubject.next(versionId);
        this.reload();
      },
    );
  }

  restoreVersion(versionId: number): void {
    this.runVersionOperation(
      () => this.versionsBackendService.restoreVersion(versionId),
      (newVersionId) => {
        this.versionCreatedSubject.next(newVersionId);
        this.reload(true);
      },
      true,
    );
  }

  loadModel(version: VersionDto): void {
    this.versionsBackendService
      .getVersionModel(this.variant.latestVersion.id)
      .pipe(
        takeUntil(this.destroyed),
        map((model) => model as NetzgrafikDto),
      )
      .subscribe((netzgrafik) => {
        this.dataService.loadNetzgrafikDto(netzgrafik);
        this.autoSaveService.reset();
        this.undoService.reset(version.variantId);
        this.discardingLocalChanges = false;
      });
  }

  dropChanges(): void {
    this.runVersionOperation(
      () => this.variantsBackendService.dropSnapshots(this.variant.id),
      () => this.reload(true),
      true,
    );
  }

  raiseSnapshotsToNewestReleaseVersion(): void {
    this.runVersionOperation(
      () => this.variantsBackendService.raiseSnapshotsToNewestReleaseVersion(this.variant.id),
      () => this.reload(),
    );
  }

  archiveVariant(): void {
    this.variantsBackendService
      .archiveVariant(this.variant.id)
      .pipe(takeUntil(this.destroyed))
      .subscribe(() => this.reload());
  }

  unarchiveVariant(): void {
    this.variantsBackendService
      .unarchiveVariant(this.variant.id)
      .pipe(takeUntil(this.destroyed))
      .subscribe(() => this.reload());
  }

  archiveVariantWithId(variantId: number): Observable<void> {
    return this.variantsBackendService.archiveVariant(variantId).pipe(takeUntil(this.destroyed));
  }

  unarchiveVariantWithId(variantId: number): Observable<void> {
    return this.variantsBackendService.unarchiveVariant(variantId).pipe(takeUntil(this.destroyed));
  }

  deleteVariant(): Observable<void> {
    return this.variantsBackendService.deleteVariant(this.variant.id).pipe(map((): void => null));
  }

  getAndClearVarianteChangedSignal(): boolean {
    const retVal = this.variantChanged;
    this.variantChanged = false;
    return retVal;
  }

  private requestSave(request: SaveRequest): void {
    const merged = mergeSaveRequests(this.pendingSave, request);
    if (this.busy) {
      this.logService.debug("save in progress, postponing save");
      this.pendingSave = merged;
      return;
    }
    this.pendingSave = null;
    if (!this.runSave(merged)) {
      this.saveStateSubject.next("idle");
    }
  }

  /** Starts a save. Returns false if there is nothing to save. */
  private runSave(request: SaveRequest): boolean {
    if (!this.variant || this.discardingLocalChanges) {
      return false;
    }
    if (request.newName === undefined && !this.autoSaveService.isModified()) {
      return false;
    }

    const sequence = this.lock();
    const variantId = this.variant.id;
    const startTime = Date.now();
    let savedNetzgrafikJson: string;
    this.saveStateSubject.next("saving");

    const refreshVariant$ = this.refreshVariantBeforeSave
      ? this.autosaveBackendService
          .getVariant(variantId)
          .pipe(tap((variant) => this.applyVariant(variantId, variant)))
      : of(null);

    refreshVariant$
      .pipe(
        switchMap(() => {
          if (this.variant?.id !== variantId) {
            // variant switched meanwhile -> the current model does not belong to variantId
            return EMPTY;
          }
          const latestVersion = this.variant.latestVersion;
          savedNetzgrafikJson = this.autoSaveService.getCurrentNetzgrafikJson();
          this.logService.debug(
            `saving variant ${variantId} based on version ${latestVersion.id} ` +
              `(${savedNetzgrafikJson.length} chars)`,
          );
          return this.autosaveBackendService.createSnapshotVersion(latestVersion.id, {
            name: request.newName || latestVersion.name,
            comment: request.newName
              ? $localize`:@@app.services.data.version-control.new-name-comment:New name: ${request.newName}`
              : "",
            model: savedNetzgrafikJson,
          });
        }),
        switchMap((versionId) =>
          this.autosaveBackendService
            .getVariant(variantId)
            .pipe(map((variant) => ({versionId, variant}))),
        ),
        timeout({first: VersionControlService.SAVE_TIMEOUT_MS}),
        takeUntil(this.destroyed),
      )
      .subscribe({
        next: ({versionId, variant}) => {
          this.logService.debug(`saved version ${versionId} in ${Date.now() - startTime} ms`);
          this.refreshVariantBeforeSave = false;
          if (this.applyVariant(variantId, variant)) {
            this.autoSaveService.markSaved(savedNetzgrafikJson);
          }
          this.versionCreatedSubject.next(versionId);
          this.finishSave(sequence, false);
        },
        error: (error: unknown) => this.onSaveError(sequence, variantId, request, error, startTime),
        complete: () => this.finishSave(sequence, false),
      });
    return true;
  }

  private onSaveError(
    sequence: number,
    variantId: number,
    request: SaveRequest,
    error: unknown,
    startTime: number,
  ): void {
    if (sequence !== this.saveSequence) {
      return;
    }
    const reason =
      error instanceof TimeoutError
        ? `timeout after ${VersionControlService.SAVE_TIMEOUT_MS} ms`
        : error instanceof HttpErrorResponse
          ? `HTTP ${error.status}`
          : String(error);
    this.logService.debug(`save failed after ${Date.now() - startTime} ms: ${reason}`);
    // The outcome of the failed save is unknown (e.g. timeout: backend may still commit).
    this.refreshVariantBeforeSave = true;
    if (this.variant?.id !== variantId) {
      this.finishSave(sequence, false);
      return;
    }
    // keep a requested rename for the retry
    this.pendingSave = mergeSaveRequests(request, this.pendingSave ?? {});
    this.logService.warn(
      $localize`:@@app.services.data.version-control.save-failed:Changes could not be saved. Saving will be retried with the next change.`,
    );
    this.finishSave(sequence, true);
  }

  /**
   * Runs a version operation (release, restore, ...) exclusively: waits for a running save
   * and blocks saves while it runs, as these operations depend on/modify latestVersion.
   */
  private runVersionOperation<T>(
    operation: () => Observable<T>,
    onSuccess: (result: T) => void,
    discardsLocalChanges = false,
  ): void {
    this.busySubject
      .pipe(
        filter((busy) => !busy),
        take(1),
        switchMap(() => {
          const sequence = this.lock();
          if (discardsLocalChanges) {
            this.discardingLocalChanges = true;
            this.pendingSave = null;
          }
          return operation().pipe(
            tap({
              next: (result) => {
                this.refreshVariantBeforeSave = true;
                onSuccess(result);
              },
              error: () => (this.discardingLocalChanges = false),
            }),
            finalize(() => {
              if (discardsLocalChanges) {
                this.pendingSave = null;
              }
              this.finishSave(sequence, false);
            }),
          );
        }),
        takeUntil(this.destroyed),
      )
      .subscribe();
  }

  private lock(): number {
    this.busySubject.next(true);
    return ++this.saveSequence;
  }

  private finishSave(sequence: number, failed: boolean): void {
    if (sequence !== this.saveSequence || !this.busy) {
      return;
    }
    if (failed) {
      this.saveStateSubject.next("error");
      this.busySubject.next(false);
      return;
    }
    const pending = this.pendingSave;
    this.pendingSave = null;
    // The follow-up save takes over the lock without releasing it, so that waiting
    // version operations cannot run in between.
    if (pending && this.runSave(pending)) {
      return;
    }
    this.saveStateSubject.next("idle");
    this.busySubject.next(false);
  }

  private applyVariant(variantId: number, variant: VariantDto): boolean {
    if (this.variant?.id !== variantId) {
      return false;
    }
    this.updateVarianteChangedInfo(variant);
    this.variantSubject.next(variant);
    return true;
  }

  private onVariantSwitch(): void {
    this.autoSaveService.disable();
    this.pendingSave = null;
    this.refreshVariantBeforeSave = false;
    if (!this.busy && this.saveState === "error") {
      this.saveStateSubject.next("idle");
    }
  }

  private updateVarianteChangedInfo(variant: VariantDto) {
    if (variant === null) {
      return;
    }
    if (this.previousVariantDto === undefined) {
      this.previousVariantDto = variant;
      this.variantChanged = true;
      return;
    }
    this.variantChanged =
      this.previousVariantDto.projectId !== variant.projectId &&
      this.previousVariantDto.id !== variant.id;
    this.previousVariantDto = variant;
  }
}
