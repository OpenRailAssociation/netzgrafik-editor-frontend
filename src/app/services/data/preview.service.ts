import {Injectable, OnDestroy} from "@angular/core";
import {VersionControllerBackendService} from "../../api/generated";
import {map, takeUntil} from "rxjs/operators";
import {DataService} from "./data.service";
import {NetzgrafikDto} from "../../data-structures/business.data.structures";
import {AutoSaveService} from "./auto-save.service";
import {VersionControlService} from "./version-control.service";
import {Subject} from "rxjs";

@Injectable({
  providedIn: "root",
})
export class PreviewService implements OnDestroy {
  private destroyed = new Subject<void>();

  private previewActive = false;

  constructor(
    private readonly dataService: DataService,
    private readonly autoSaveService: AutoSaveService,
    private readonly versionsBackendService: VersionControllerBackendService,
    private readonly versionControlService: VersionControlService,
  ) {}

  enablePreview(versionId: number): void {
    this.autoSaveService.disable();
    this.versionsBackendService
      .getVersionModel(versionId)
      .pipe(
        takeUntil(this.destroyed),
        map((model) => model as NetzgrafikDto),
      )
      .subscribe((netzgrafik) => {
        this.dataService.loadNetzgrafikDto(netzgrafik, true);
      });
    this.previewActive = true;
  }

  disablePreview(): void {
    if (!this.previewActive) {
      return;
    }

    this.versionControlService.loadModel(this.versionControlService.variant.latestVersion);
    this.previewActive = true;
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }
}
