import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {ViewBoxChangeInfo} from "../../model/util/viewBoxChangeInfo";
import {TimeSliderService} from "../time-slider.service";
import {ResizeService} from "./resize.service";
import {takeUntil} from "rxjs/operators";
import {SliderChangeInfo} from "../../model/util/sliderChangeInfo";
import {ResizeChangeInfo} from "../../model/util/resizeChangeInfo";

@Injectable({
  providedIn: "root",
})
export class ViewBoxService implements OnDestroy {
  private readonly viewBoxChangeInfoSubject = new BehaviorSubject<ViewBoxChangeInfo>(
    new ViewBoxChangeInfo(),
  );
  private readonly viewBoxChangeInfo$ = this.viewBoxChangeInfoSubject.asObservable();

  private readonly destroyed$ = new Subject<void>();

  private sliderChangeInfo: SliderChangeInfo = new SliderChangeInfo();
  private resizeChangeInfo: ResizeChangeInfo = new ResizeChangeInfo();

  constructor(
    private readonly timeSliderService: TimeSliderService,
    private readonly resizeService: ResizeService,
  ) {
    this.timeSliderService
      .getSliderChangeObservable()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((sliderChangeInfo) => {
        this.sliderChangeInfo = sliderChangeInfo;
        this.renderViewBox();
      });

    this.resizeService
      .getResizeChangeInfo()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((resizeChangeInfo) => {
        this.resizeChangeInfo = resizeChangeInfo;
        this.renderViewBox();
      });
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  getViewBox(): Observable<ViewBoxChangeInfo> {
    return this.viewBoxChangeInfo$;
  }

  private renderViewBox() {
    this.viewBoxChangeInfoSubject.next(
      new ViewBoxChangeInfo(
        0,
        this.sliderChangeInfo.move,
        this.resizeChangeInfo.width,
        this.resizeChangeInfo.height,
      ),
    );
  }
}
