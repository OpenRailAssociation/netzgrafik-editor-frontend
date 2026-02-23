import {Injectable, OnDestroy} from "@angular/core";
import {
  VariantControllerBackendService,
  VariantDto,
  VersionControllerBackendService,
  VersionDto,
} from "../../api/generated";
import {filter, map, takeUntil} from "rxjs/operators";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {DataService} from "./data.service";
import {NetzgrafikDto} from "../../data-structures/business.data.structures";
import {AutoSaveService} from "./auto-save.service";
import {LogService} from "../../logger/log.service";
import {VersionId} from "../../view/variant/variant-view/variant-history/model";
import {UndoService} from "./undo.service";
import {environment} from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class VersionControlService implements OnDestroy {
  readonly variantSubject = new BehaviorSubject<VariantDto | null>(null);
  readonly variant$ = this.variantSubject.asObservable();

  readonly versionCreatedSubject = new Subject<VersionId>();
  readonly versionCreated$ = this.versionCreatedSubject.asObservable();

  private readonly destroyed = new Subject<void>();

  private previousVariantDto: VariantDto = undefined;
  private variantChanged = false;

  constructor(
    private readonly variantsBackendService: VariantControllerBackendService,
    private readonly versionsBackendService: VersionControllerBackendService,
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
          this.createSnapshot();
        });
    }
  }

  get variant(): VariantDto {
    return this.variantSubject.value;
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  load(variantId: number, loadModel: boolean): void {
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
    const name = newName || this.variant.latestVersion.name;
    this.versionsBackendService
      .createSnapshotVersion(this.variant.latestVersion.id, {
        name,
        comment: newName
          ? $localize`:@@app.services.data.version-control.new-name-comment:New name: ${newName}`
          : "",
        model: JSON.stringify(this.dataService.getNetzgrafikDto()),
      })
      .pipe(takeUntil(this.destroyed))
      .subscribe((versionId) => {
        this.versionCreatedSubject.next(versionId);
        this.reload();
      });
  }

  createRelease(comment: string): void {
    this.versionsBackendService
      .createReleaseVersion(this.variant.latestVersion.id, {
        comment,
      })
      .pipe(takeUntil(this.destroyed))
      .subscribe((versionId) => {
        this.versionCreatedSubject.next(versionId);
        this.reload();
      });
  }

  restoreVersion(versionId: number): void {
    this.versionsBackendService
      .restoreVersion(versionId)
      .pipe(takeUntil(this.destroyed))
      .subscribe((newVersionId) => {
        this.versionCreatedSubject.next(newVersionId);
        this.reload(true);
      });
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
      });
  }

  dropChanges(): void {
    this.variantsBackendService
      .dropSnapshots(this.variant.id)
      .pipe(takeUntil(this.destroyed))
      .subscribe(() => this.reload(true));
  }

  raiseSnapshotsToNewestReleaseVersion(): void {
    this.variantsBackendService
      .raiseSnapshotsToNewestReleaseVersion(this.variant.id)
      .pipe(takeUntil(this.destroyed))
      .subscribe(() => this.reload());
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

  archiveVariantWithId(variantId: number): Observable<any> {
    return this.variantsBackendService.archiveVariant(variantId).pipe(takeUntil(this.destroyed));
  }

  unarchiveVariantWithId(variantId: number): Observable<any> {
    return this.variantsBackendService.unarchiveVariant(variantId).pipe(takeUntil(this.destroyed));
  }

  deleteVariant(): Observable<void> {
    return this.variantsBackendService.deleteVariant(this.variant.id).pipe(map(() => null));
  }

  getAndClearVarianteChangedSignal(): boolean {
    const retVal = this.variantChanged;
    this.variantChanged = false;
    return retVal;
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
