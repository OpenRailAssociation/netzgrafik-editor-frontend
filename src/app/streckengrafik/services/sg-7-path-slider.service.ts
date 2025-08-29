import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {SgSelectedTrainrun} from "../model/streckengrafik-model/sg-selected-trainrun";
import {ResizeService} from "./util/resize.service";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {ResizeChangeInfo} from "../model/util/resizeChangeInfo";
import {StreckengrafikRenderingType} from "../../view/themes/streckengrafik-rendering-type";
import {SgPath} from "../model/streckengrafik-model/sg-path";
import {Sg6TrackService} from "./sg-6-track.service";

@Injectable({
  providedIn: "root",
})
export class Sg7PathSliderService implements OnDestroy {
  private readonly sgSelectedTrainrunSubject = new BehaviorSubject<SgSelectedTrainrun>(undefined);
  private readonly sgSelectedTrainrun$ = this.sgSelectedTrainrunSubject.asObservable();

  private selectedTrainrun: SgSelectedTrainrun;

  private resizeChangeInfo: ResizeChangeInfo;

  private readonly destroyed$ = new Subject<void>();

  constructor(
    private readonly sg6TrackService: Sg6TrackService,
    private readonly resizeService: ResizeService,
    private readonly uiInteractionService: UiInteractionService,
  ) {
    this.sg6TrackService
      .getSgSelectedTrainrun()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((selectedTrainrun) => {
        this.selectedTrainrun = selectedTrainrun;
        this.render();
      });

    this.resizeService
      .getResizeChangeInfo()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((resizeChangeInfo) => {
        this.resizeChangeInfo = resizeChangeInfo;
        this.render();
      });
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  public getSgSelectedTrainrun(): Observable<SgSelectedTrainrun> {
    return this.sgSelectedTrainrun$;
  }

  private render() {
    if (!this.selectedTrainrun) {
      return;
    }
    if (!this.resizeChangeInfo) {
      return;
    }

    let xPathFix = 0;
    let xPathSection = 0;
    let xPathSectionCount = 0;
    this.selectedTrainrun.paths.forEach((path) => {
      if (path.xPathFix()) {
        xPathFix += path.xPath();
      } else {
        if (path.isSection()) {
          xPathSection += path.xPath();
          ++xPathSectionCount;
        }
      }
    });

    // fahrzeitskaliert oder false gleichmässig
    let startPosition = 0;
    this.selectedTrainrun.paths.forEach((path) => {
      path.xZoom = this.getXZoom(path, xPathFix, xPathSection, xPathSectionCount);
      const zommedXPath = path.zoomedXPath();
      path.startPosition = startPosition;
      startPosition += zommedXPath;
    });

    this.sgSelectedTrainrunSubject.next(this.selectedTrainrun);
  }

  getXZoom(path: SgPath, xPathFix: number, xPathSection: number, xPathSectionCount: number) {
    if (
      this.uiInteractionService.getActiveStreckengrafikRenderingType() ===
      StreckengrafikRenderingType.TimeScaledDistance
    ) {
      return (this.resizeChangeInfo.width - xPathFix) / xPathSection;
    } else {
      return (this.resizeChangeInfo.width - xPathFix) / xPathSectionCount / path.travelTime();
    }
  }
}
