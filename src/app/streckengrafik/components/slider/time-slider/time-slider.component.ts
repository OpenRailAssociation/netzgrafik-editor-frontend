import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
} from "@angular/core";
import {TimeSliderService} from "../../../services/time-slider.service";
import {SliderChangeInfo} from "../../../model/util/sliderChangeInfo";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {ViewBoxChangeInfo} from "../../../model/util/viewBoxChangeInfo";
import {ViewBoxService} from "../../../services/util/view-box.service";
import {TimeFormatter} from "../../../model/util/timeFormatter";
import {
  UpdateCounterController,
  UpdateCounterHandler,
  UpdateCounterTriggerService,
} from "../../../services/util/update-counter.service";

@Component({
  selector: "sbb-time-slider",
  templateUrl: "./time-slider.component.html",
  styleUrls: ["./time-slider.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeSliderComponent implements OnInit, OnDestroy, UpdateCounterHandler {
  @Input()
  sliderLinePos = 0;

  @Input()
  sliderTextPos = 16;

  @Input()
  horizontal = false;

  @Input()
  roundTimeLine = 1;

  @Input()
  enableTimeLine = true;

  @Input()
  disableText = false;

  times: TimeDate[] = [];
  timesTicks: TimeDate[] = [];
  timesTicksIndices: number[] = [];

  orgTimes: TimeDate[] = [];
  orgTimesTicks: TimeDate[] = [];

  viewBox: string;

  timeLinePos: number = undefined;
  delayedRendering = false;
  timelineChangeInfo: number = undefined;
  public sliderChangeInfo: SliderChangeInfo = new SliderChangeInfo();
  private viewBoxChangeInfo: ViewBoxChangeInfo = new ViewBoxChangeInfo();
  private timeResolution: number = undefined;
  private fullDetailRenderingUpdateCounter = 0;
  private updateCounterController: UpdateCounterController = undefined;
  private readonly destroyed$ = new Subject<void>();
  private lastMouseMoveButtons = 0;

  constructor(
    private readonly timeSliderService: TimeSliderService,
    private readonly viewBoxService: ViewBoxService,
    private readonly updateCounterTriggerService: UpdateCounterTriggerService,
    private readonly cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.timeSliderService
      .getSliderChangeObservable()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((sliderChangeInfo: SliderChangeInfo) => {
        const changed =
          this.sliderChangeInfo.zoom !== sliderChangeInfo.zoom ||
          this.sliderChangeInfo.move !== sliderChangeInfo.move ||
          sliderChangeInfo.recalc;
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
        this.render();
        if (changed) {
          this.cd.markForCheck();
        }
      });

    this.timeSliderService
      .getTimelineChangeObservable()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((timeLinePos: number) => {
        const changed = this.timelineChangeInfo !== timeLinePos;
        this.timelineChangeInfo = timeLinePos;
        if (!this.delayedRendering) {
          this.updateCounterCallback();
          this.cd.markForCheck();
        }
      });

    this.timeSliderService.changeZoom(this.timeSliderService.getYZoom() + 0.000001);
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  @HostListener("wheel", ["$event"])
  public onScroll(event: WheelEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (this.horizontal) {
      this.timeSliderService.handleWheelZoom(event.offsetX, event.deltaY, event.timeStamp);
    } else {
      this.timeSliderService.handleWheelZoom(event.offsetY, event.deltaY, event.timeStamp);
    }
  }

  @HostListener("mousemove", ["$event"])
  public onMouseMove(event: MouseEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.buttons !== 0) {
      if (this.horizontal) {
        this.timeSliderService.yMoveChange(this.timeSliderService.getYMove() - event.movementX);
      } else {
        this.timeSliderService.yMoveChange(this.timeSliderService.getYMove() - event.movementY);
      }
      this.lastMouseMoveButtons = event.buttons;
    }
    return;
  }

  @HostListener("mouseup", ["$event"])
  public onMouseUp(event: MouseEvent) {
    if (this.lastMouseMoveButtons !== 0) {
      this.timeSliderService.stopHandleZoomPanning();
    }
    this.lastMouseMoveButtons = 0;
  }

  patternScaleTransform(x: number): number {
    return Math.floor(x);
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

  getTimeLineLen(): number {
    return 34;
  }

  getSliderTimeLineLen(time: TimeDate): number {
    if (this.disableText) {
      return time.sliderTimeLineLen;
    } else {
      if (time.text !== "") {
        return 34;
      }
    }
    return 6;
  }

  private transformSliderTimeToLineLen(time: number): number {
    if (time % 60 === 0) {
      return 34;
    }
    if (time % 30 === 0) {
      return 24;
    }
    if (time % 15 === 0) {
      return 16;
    }
    if (time % 5 === 0) {
      return 9;
    }
    return 6;
  }

  getTimeSliderTextClassTag(time: TimeDate): string {
    const tag = "TimeSliderComponent Text " + this.getTimeGroupClassTag(time);
    if (this.horizontal) {
      return tag + " Horizontal";
    }
    return tag;
  }

  getTimeSliderClassTag(time: TimeDate): string {
    return "TimeSliderComponent HorizontalLine " + this.getTimeGroupClassTag(time);
  }

  getTimeLineClassTag(): string {
    return "TimeSliderComponent TimeLine";
  }

  getTimeLineTextClassTag(): string {
    const tag = "TimeSliderComponent Text TimeLine";
    if (this.horizontal) {
      return tag + " Horizontal";
    }
    return tag;
  }

  getTimeLineText(time: number): string {
    return TimeFormatter.formatHHMM(time * 60 + 30);
  }

  renderTimeLine() {
    if (!this.enableTimeLine) {
      this.timeLinePos = undefined;
      return;
    }
    this.timeLinePos =
      (this.timelineChangeInfo + this.sliderChangeInfo.move) / this.sliderChangeInfo.zoom;
    if (this.roundTimeLine > 0.01) {
      this.timeLinePos = Math.round(this.timeLinePos / this.roundTimeLine) * this.roundTimeLine;
    }
    if (isNaN(this.timeLinePos)) {
      this.timeLinePos = undefined;
    }
  }

  private render() {
    if (this.horizontal) {
      this.viewBox =
        " " + this.sliderChangeInfo.move + " " + "0 " + this.viewBoxChangeInfo.width + " " + 40;
    } else {
      this.viewBox =
        "0 " + this.sliderChangeInfo.move + " " + 40 + " " + this.viewBoxChangeInfo.height;
    }
    this.delayedRender();
  }

  private delayedRender() {
    // This method introduce a delay to render full details (performance: more interactive)
    this.delayedRendering = false;
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

  updateCounterCallback() {
    // implements UpdateCounterHandler -> updateCounterCallback()
    this.updateYZoom();
    this.renderTimeLine();
    this.delayedRendering = true;
    this.cd.markForCheck();
  }

  updateTicksRenderingSpace() {
    const block = 60 * this.getScaleFactor();
    let minTime = this.horizontal
      ? Math.floor(this.viewBoxChangeInfo.x / block)
      : Math.floor(this.viewBoxChangeInfo.y / block);
    let maxTime = this.horizontal
      ? Math.ceil((this.viewBoxChangeInfo.x + this.viewBoxChangeInfo.width) / block)
      : Math.ceil((this.viewBoxChangeInfo.y + this.viewBoxChangeInfo.height) / block);

    if (this.timesTicksIndices.length > 0) {
      const first = this.timesTicksIndices[0];
      const last = this.timesTicksIndices[this.timesTicksIndices.length - 1];
      if (first > minTime && last < maxTime) {
        return;
      }
      minTime = Math.min(minTime, first);
      maxTime = Math.max(maxTime, last);
    }

    this.timesTicksIndices = [];
    for (let idx = minTime; idx <= maxTime; idx++) {
      this.timesTicksIndices.push(idx);
    }
    this.timesTicks = this.orgTimesTicks.filter(
      (t: TimeDate) => t.time < 60 * (maxTime - minTime) + 1,
    );
    this.times = this.orgTimes.filter(
      (t: TimeDate) => t.time > 60 * minTime - 1 && t.time < 60 * maxTime + 1,
    );
  }

  updateYZoom() {
    const yZoom = this.sliderChangeInfo.zoom;
    switch (true) {
      case yZoom >= 41.6: // 15min
        this.createOrUpdateTimeData(1, 1);
        break;
      case yZoom >= 20.8: // 30min
        this.createOrUpdateTimeData(1, 1);
        break;
      case yZoom >= 10.4: // 60min
        this.createOrUpdateTimeData(15, 1);
        break;
      case yZoom >= 5.2: // 120min
        this.createOrUpdateTimeData(30, 5);
        break;
      case yZoom >= 2.6: // 240min
        this.createOrUpdateTimeData(60, 15);
        break;
      case yZoom >= 0.0:
        this.createOrUpdateTimeData(120, 30);
        break;
    }
    this.updateTicksRenderingSpace();
  }

  private getTimeGroupClassTag(time: TimeDate): string {
    return time.timeGroupClassTag;
  }

  private transformTimeGroupClassTag(time: number): string {
    if (time % 60 === 0) {
      return "Hour Full";
    }
    if (time % 30 === 0) {
      return "Hour Half";
    }
    if (time % 15 === 0) {
      return "Hour Quarter";
    }
    if (time % 5 === 0) {
      return "Hour Five";
    }
    return "";
  }

  private createOrUpdateTimeData(timeResolution: number, timeVisualResolution: number) {
    if (this.timeResolution !== timeResolution || this.times.length === 0) {
      const block = 60 * this.getScaleFactor();
      let timeRangeMinValueSeconds = this.horizontal
        ? Math.floor(this.viewBoxChangeInfo.x / block)
        : Math.floor(this.viewBoxChangeInfo.y / block);
      let timeRangeMaxValueSeconds = this.horizontal
        ? Math.ceil((this.viewBoxChangeInfo.x + this.viewBoxChangeInfo.width) / block)
        : Math.ceil((this.viewBoxChangeInfo.y + this.viewBoxChangeInfo.height) / block);
      timeRangeMinValueSeconds = timeRangeMinValueSeconds * 3600 - 24 * 3600;
      timeRangeMaxValueSeconds = timeRangeMaxValueSeconds * 3600 + 24 * 3600;

      const times: TimeDate[] = [];
      const timesTicks: TimeDate[] = [];
      const minTime = timeRangeMinValueSeconds / (timeVisualResolution * 60);
      const maxTime = timeRangeMaxValueSeconds / (timeVisualResolution * 60);
      for (let i = minTime; i <= maxTime; i++) {
        const time = i * timeVisualResolution;
        const check = time % timeResolution === 0 && time % 15 === 0;
        if (check) {
          times.push({
            text: TimeFormatter.formatHHMM(time * 60),
            time: time,
            sliderTimeLineLen: this.transformSliderTimeToLineLen(time),
            timeGroupClassTag: this.transformTimeGroupClassTag(time),
          });
        }
      }

      for (let i = 0; i < 24 * 15; i++) {
        const time = i * timeVisualResolution;
        const check = time % timeResolution === 0 && time % 15 === 0;
        timesTicks.push({
          text: check ? "FullHour" : "",
          time: time,
          sliderTimeLineLen: this.transformSliderTimeToLineLen(time),
          timeGroupClassTag: this.transformTimeGroupClassTag(time),
        });
      }

      this.times = times;
      this.orgTimes = times;
      this.timesTicks = timesTicks;
      this.orgTimesTicks = timesTicks;
      this.timeResolution = timeResolution;
    }
  }
}

export class TimeDate {
  text: string;
  time: number;
  sliderTimeLineLen: number;
  timeGroupClassTag: string;
}
