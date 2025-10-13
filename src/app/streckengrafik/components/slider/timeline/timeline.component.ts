import {Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {SliderChangeInfo} from "../../../model/util/sliderChangeInfo";
import {TimeSliderService} from "../../../services/time-slider.service";
import {DrawingBackgroundMouseListenerService} from "../../../services/util/drawingBackgroundMouseListener.service";
import {Subject} from "rxjs";
import {ViewBoxChangeInfo} from "../../../model/util/viewBoxChangeInfo";
import {takeUntil} from "rxjs/operators";
import {ViewBoxService} from "../../../services/util/view-box.service";
import {Vec2D} from "../../../../utils/vec2D";
import {TimeFormatter} from "../../../model/util/timeFormatter";
import {
  UpdateCounterController,
  UpdateCounterHandler,
  UpdateCounterTriggerService,
} from "../../../services/util/update-counter.service";

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: "[sbb-timeline]",
  templateUrl: "./timeline.component.html",
  styleUrls: ["./timeline.component.scss"],
})
export class TimelineComponent implements OnInit, OnDestroy, UpdateCounterHandler {
  @ViewChild("componentElement")
  componentElementRef: ElementRef;

  @Input()
  horizontal = false;

  @Input()
  roundTimeLine = 1;

  drawLine = false;
  delayedRendering = true;
  private fullDetailRenderingUpdateCounter = 0;
  private readonly destroyed$ = new Subject<void>();
  private updateCounterController: UpdateCounterController = undefined;

  linePath = "M 0 0 L 0 10000";

  textPosition = new Vec2D(0.0, 0.0);

  private sliderChangeInfo: SliderChangeInfo = new SliderChangeInfo();
  private viewBoxChangeInfo: ViewBoxChangeInfo = new ViewBoxChangeInfo();
  private timelineChangeInfo: number = undefined;

  constructor(
    private timeSliderService: TimeSliderService,
    private readonly viewBoxService: ViewBoxService,
    private readonly updateCounterTriggerService: UpdateCounterTriggerService,
    private readonly drawingBackgroundMouseListenerComponent: DrawingBackgroundMouseListenerService,
  ) {}

  ngOnInit() {
    this.drawingBackgroundMouseListenerComponent
      .getMouseMoveObservable()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((event: MouseEvent) => {
        this.onMouseMove(event);
      });

    this.drawingBackgroundMouseListenerComponent
      .getMouseEnterObservable()
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        this.onMouseEnter();
      });

    this.drawingBackgroundMouseListenerComponent
      .getMouseLeaveObservable()
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        this.onMouseLeave();
      });

    this.timeSliderService
      .getSliderChangeObservable()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((sliderChangeInfo: SliderChangeInfo) => {
        this.sliderChangeInfo = sliderChangeInfo;
        this.doDelayedRendering();
      });

    this.viewBoxService
      .getViewBox()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((viewBoxChangeInfo: ViewBoxChangeInfo) => {
        this.viewBoxChangeInfo = viewBoxChangeInfo;
        this.render();
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  transformTime(): number {
    return this.sliderChangeInfo.move;
  }

  getTimeText() {
    return TimeFormatter.formatHHMM(
      30 +
        ((this.timelineChangeInfo + this.sliderChangeInfo.move) / this.sliderChangeInfo.zoom) * 60,
    );
  }

  getTimeLinePos() {
    let timeLinePos = this.timelineChangeInfo;
    if (this.roundTimeLine > 0.01) {
      timeLinePos =
        (this.timelineChangeInfo + this.sliderChangeInfo.move) / this.sliderChangeInfo.zoom;
      timeLinePos = Math.round(timeLinePos / this.roundTimeLine) * this.roundTimeLine;
      timeLinePos = timeLinePos * this.sliderChangeInfo.zoom - this.sliderChangeInfo.move;
    }
    if (isNaN(timeLinePos)) {
      timeLinePos = 0.0;
    }
    return timeLinePos;
  }

  private render() {
    const timeLinePos = this.getTimeLinePos();
    if (!isNaN(timeLinePos)) {
      if (this.horizontal) {
        this.linePath = "M " + timeLinePos + " 0 L " + timeLinePos + " " + 1000000;
      } else {
        this.linePath = "M 0 " + timeLinePos + " L " + 1000000 + " " + timeLinePos;
      }
    } else {
      this.linePath = "M 0 0 L 0 0";
    }
  }

  private transformZoomTime(timeEvent: number): number {
    return Math.ceil(timeEvent);
  }

  private onMouseEnter() {
    this.drawLine = true;
  }

  private onMouseMove(event: MouseEvent) {
    if (this.delayedRendering && this.drawLine) {
      this.handleMouseMove(event);
    }
  }

  private handleMouseMove(event: MouseEvent) {
    if (event) {
      let changed = false;
      const pos = this.textPosition.copy();
      if (this.horizontal) {
        const v = this.transformZoomTime(event.offsetX);
        if (this.timelineChangeInfo !== v) {
          this.timeSliderService.changeTimeLinePosition(v);
          this.timelineChangeInfo = v;
          pos.setX(v);
          changed = true;
        }
        const newY = Math.max(5, Math.min(event.offsetY + 64, this.viewBoxChangeInfo.height - 64));
        if (pos.getY() !== newY) {
          pos.setY(newY);
          changed = true;
        }
        if (pos.getY() + 64 > this.viewBoxChangeInfo.height - 64) {
          pos.setY(event.offsetY - 48 - 32);
          changed = true;
        }
      } else {
        const v = this.transformZoomTime(event.offsetY);
        if (this.timelineChangeInfo !== v) {
          this.timeSliderService.changeTimeLinePosition(v);
          this.timelineChangeInfo = v;
          pos.setY(v);
          changed = true;
        }
        const newX = Math.max(5, Math.min(event.offsetX + 64, this.viewBoxChangeInfo.width - 64));
        if (pos.getX() !== newX) {
          pos.setX(newX);
          changed = true;
        }
        if (pos.getX() + 64 > this.viewBoxChangeInfo.width - 64) {
          pos.setX(event.offsetX - 48 - 32);
          changed = true;
        }
      }
      if (changed) {
        this.textPosition = pos.copy();
        this.render();
      }
    }
  }

  private onMouseLeave() {
    this.drawLine = false;
    this.timeSliderService.changeTimeLinePosition(undefined);
  }

  private doDelayedRendering() {
    this.fullDetailRenderingUpdateCounter++;
    this.delayedRendering = this.fullDetailRenderingUpdateCounter < 2;
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

  updateCounterCallback() {
    this.delayedRendering = true;
    this.render();
  }

  getCurrentUpdateCounter(): number {
    return this.fullDetailRenderingUpdateCounter;
  }

  protected readonly NaN = NaN;
}
