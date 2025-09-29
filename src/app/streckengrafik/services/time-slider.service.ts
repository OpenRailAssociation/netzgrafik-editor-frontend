import {Injectable, NgZone, OnDestroy} from "@angular/core";
import {BehaviorSubject, interval, Observable, Subject, take} from "rxjs";
import {DrawingBackgroundMouseListenerService} from "./util/drawingBackgroundMouseListener.service";
import {SliderChangeInfo} from "../model/util/sliderChangeInfo";
import {takeUntil} from "rxjs/operators";
import {UpdateCounterTriggerService} from "./util/update-counter.service";

@Injectable({
  providedIn: "root",
})
export class TimeSliderService implements OnDestroy {
  private initYZoom = 10.4;
  private initYMove = (8 * 60 - 2) * this.initYZoom;
  private yMove = this.initYMove;
  private yZoom = this.initYZoom;
  private maxZoom = 32;
  private minZoom = 0.3;

  private wheelZoomCounter = 0;

  private readonly sliderChangeSubject = new BehaviorSubject<SliderChangeInfo>(
    new SliderChangeInfo(this.yZoom, this.yMove),
  );
  private readonly sliderChange$ = this.sliderChangeSubject.asObservable();
  private readonly timelineChangeSubject = new BehaviorSubject<number>(undefined);
  private readonly timelineChange$ = this.timelineChangeSubject.asObservable();
  private readonly destroyed$ = new Subject<void>();

  constructor(
    private readonly drawingBackgroundMouseListenerService: DrawingBackgroundMouseListenerService,
    private readonly updateCounterTriggerService: UpdateCounterTriggerService,
    private readonly ngZone: NgZone,
  ) {
    drawingBackgroundMouseListenerService
      .getMouseMoveObservable()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((event: MouseEvent) => {
        if (event) {
          if (event.buttons !== 0) {
            this.yMoveChange(this.getYMove() - event.movementY);
          }
        }
      });

    this.sliderChangeSubject.next(new SliderChangeInfo(this.yZoom, this.yMove));
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  public reset() {
    this.yMove = this.initYMove;
    this.yZoom = this.initYZoom;
    this.sliderChangeSubject.next(new SliderChangeInfo(this.yZoom, this.yMove, true));
  }

  public getTimelineChangeObservable(): Observable<number> {
    return this.timelineChange$;
  }

  changeTimeLinePosition(pos: number) {
    this.timelineChangeSubject.next(pos);
  }

  public getSliderChangeObservable(): Observable<SliderChangeInfo> {
    return this.sliderChange$;
  }

  yMoveChange(yMove: number) {
    this.yMove = yMove;
    this.sliderChangeSubject.next(new SliderChangeInfo(this.yZoom, this.yMove, false));
  }

  yMoveAndZoomChange(yZoom: number, yMove: number, recalc = false) {
    this.yZoom = yZoom;
    this.yMove = yMove;
    this.sliderChangeSubject.next(new SliderChangeInfo(this.yZoom, this.yMove, recalc));
  }

  changeZoom(yZoom: number) {
    const zoomingPoint = 0.0;
    const prevZoom = this.yZoom;
    const localCoord = this.getYMove() + zoomingPoint;
    const deltaMove = localCoord / prevZoom - localCoord / yZoom;
    this.yMove = this.getYMove() + deltaMove * yZoom;
    this.yZoom = yZoom;
    this.sliderChangeSubject.next(new SliderChangeInfo(this.yZoom, this.yMove, true));
  }

  getYMove(): number {
    return this.yMove;
  }

  getYZoom(): number {
    return this.yZoom;
  }

  handleWheelZoom(zoomingPoint: number, zoomingDelta: number, timeStamp: number) {
    const prevZoom = this.getYZoom();
    let yZoom =
      this.getYZoom() -
      zoomingDelta * 0.005 * (1.0 + 0.1 * Math.exp(-(1.0 / (this.minZoom + this.getYZoom()))));
    yZoom = Math.max(this.minZoom, Math.min(this.maxZoom, yZoom));
    const localCoord = this.getYMove() + zoomingPoint;
    const deltaMove = localCoord / prevZoom - localCoord / yZoom;
    this.yMoveAndZoomChange(yZoom, this.getYMove() + deltaMove * yZoom, false);

    // Update delay 500ms
    this.wheelZoomCounter = timeStamp;
    this.ngZone.runOutsideAngular(() => {
      interval(500)
        .pipe(take(1))
        .subscribe(() => {
          if (this.wheelZoomCounter === timeStamp) {
            this.stopHandleZoomPanning();
          }
        });
    });
  }

  stopHandleZoomPanning() {
    this.updateCounterTriggerService.sendUpdateTrigger();
  }
}
