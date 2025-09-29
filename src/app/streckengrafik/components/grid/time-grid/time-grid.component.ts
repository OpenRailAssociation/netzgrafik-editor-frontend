import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
} from "@angular/core";
import {Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {SliderChangeInfo} from "../../../model/util/sliderChangeInfo";
import {ViewBoxChangeInfo} from "../../../model/util/viewBoxChangeInfo";
import {TimeSliderService} from "../../../services/time-slider.service";
import {ViewBoxService} from "../../../services/util/view-box.service";
import {
  UpdateCounterController,
  UpdateCounterHandler,
  UpdateCounterTriggerService,
} from "../../../services/util/update-counter.service";

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: "[sbb-time-grid]",
  templateUrl: "./time-grid.component.html",
  styleUrls: ["./time-grid.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeGridComponent implements OnInit, OnDestroy, UpdateCounterHandler {
  @Input() horizontal = true;

  timesTicksIndices: number[] = [];
  timesTicks: number[] = [];
  delayedRendering = false;
  private readonly destroyed$ = new Subject<void>();
  private sliderChangeInfo: SliderChangeInfo = new SliderChangeInfo();
  private viewBoxChangeInfo: ViewBoxChangeInfo = new ViewBoxChangeInfo();
  private fullDetailRenderingUpdateCounter = 0;
  private updateCounterController: UpdateCounterController = undefined;

  constructor(
    private timeSliderService: TimeSliderService,
    private readonly viewBoxService: ViewBoxService,
    private readonly updateCounterTriggerService: UpdateCounterTriggerService,
    private readonly cd: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.timeSliderService
      .getSliderChangeObservable()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((sliderChangeInfo: SliderChangeInfo) => {
        const changed =
          this.sliderChangeInfo.zoom !== sliderChangeInfo.zoom ||
          this.sliderChangeInfo.move !== sliderChangeInfo.move;
        if (sliderChangeInfo.recalc) {
          this.delayedRendering = true;
        }
        if (this.sliderChangeInfo.zoom !== sliderChangeInfo.zoom) {
          this.timesTicksIndices = [];
        }
        this.sliderChangeInfo = sliderChangeInfo;
        if (changed) {
          this.cd.markForCheck();
        }
        this.render();
      });

    this.viewBoxService
      .getViewBox()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((viewBoxChangeInfo: ViewBoxChangeInfo) => {
        const changed =
          this.viewBoxChangeInfo.width !== viewBoxChangeInfo.width ||
          this.viewBoxChangeInfo.height !== viewBoxChangeInfo.height ||
          this.viewBoxChangeInfo.x !== viewBoxChangeInfo.x ||
          this.viewBoxChangeInfo.y !== viewBoxChangeInfo.y;
        this.viewBoxChangeInfo = viewBoxChangeInfo;
        if (changed) {
          this.cd.markForCheck();
        }
        this.render();
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  getTimeGridClassTag(time: number): string {
    if (time % 60 === 0) {
      return "TimeGrid TimeFullHour";
    }
    if (time % 30 === 0) {
      return "TimeGrid TimeHalfHour";
    }
    return "TimeGrid";
  }

  getScaleFactor(): number {
    return this.sliderChangeInfo.zoom;
  }

  getInverseScaleFactor(): number {
    if (this.sliderChangeInfo.zoom > 0.0) {
      return 1.0 / this.sliderChangeInfo.zoom;
    }
    return 1.0;
  }

  updateCounterCallback() {
    // implements UpdateCounterHandler -> updateCounterCallback()
    this.updateTicksRenderingSpace();
    this.delayedRendering = true;
    this.cd.markForCheck();
  }

  private delayedRender() {
    this.delayedRendering = false;
    // This method introduce a delay to render full details (performance: more interactive)
    this.fullDetailRenderingUpdateCounter += 1;
    if (this.updateCounterController !== undefined) {
      this.updateCounterController.clear();
    }
    if (this.sliderChangeInfo.recalc) {
      this.updateCounterCallback();
    } else {
      this.updateCounterController = new UpdateCounterController(
        this.fullDetailRenderingUpdateCounter,
        this,
      );
    }
  }

  getUpdateCounterTriggerService(): UpdateCounterTriggerService {
    return this.updateCounterTriggerService;
  }

  getCurrentUpdateCounter(): number {
    // implements UpdateCounterHandler -> getCurrentUpdateCounter()
    return this.fullDetailRenderingUpdateCounter;
  }

  render() {
    this.delayedRender();
  }

  private updateTicksRenderingSpace() {
    const block = this.getInverseScaleFactor() / 15;
    let minTime = !this.horizontal
      ? Math.floor(this.viewBoxChangeInfo.x * block)
      : Math.floor(this.viewBoxChangeInfo.y * block);
    let maxTime = !this.horizontal
      ? Math.ceil((this.viewBoxChangeInfo.x + this.viewBoxChangeInfo.width) * block)
      : Math.ceil((this.viewBoxChangeInfo.y + this.viewBoxChangeInfo.height) * block);

    if (this.timesTicks.length > 0) {
      const first = this.timesTicks[0] / 15;
      const last = this.timesTicks[this.timesTicks.length - 1] / 15;
      if (first > minTime && last < maxTime) {
        return;
      }
      minTime = Math.min(minTime, first);
      maxTime = Math.max(maxTime, last);
    }
    this.timesTicks = [];
    for (let idx = minTime; idx <= maxTime; idx++) {
      if (this.sliderChangeInfo.zoom > 1.2) {
        this.timesTicks.push(idx * 15);
      } else {
        if (this.sliderChangeInfo.zoom > 0.6) {
          if (idx % 2 === 0) {
            this.timesTicks.push(idx * 15);
          }
        } else {
          if (idx % 4 === 0) {
            this.timesTicks.push(idx * 15);
          }
        }
      }
    }
  }
}
