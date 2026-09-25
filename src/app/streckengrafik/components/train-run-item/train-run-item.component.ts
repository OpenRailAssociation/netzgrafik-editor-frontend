import {
  ChangeDetectorRef,
  Component,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
} from "@angular/core";
import {SgTrainrun} from "../../model/streckengrafik-model/sg-trainrun";
import {SgTrainrunItem} from "../../model/streckengrafik-model/sg-trainrun-item";
import {SgTrainrunNodeTrackReservation} from "../../model/streckengrafik-model/sg-trainrun-node";
import {TimeSliderService} from "../../services/time-slider.service";
import {takeUntil} from "rxjs/operators";
import {SliderChangeInfo} from "../../model/util/sliderChangeInfo";
import {interval, Subject} from "rxjs";
import {ViewBoxChangeInfo} from "../../model/util/viewBoxChangeInfo";
import {ViewBoxService} from "../../services/util/view-box.service";
import * as d3 from "d3";
import {
  UpdateCounterController,
  UpdateCounterHandler,
  UpdateCounterTriggerService,
} from "../../services/util/update-counter.service";

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: "[sbb-train-run-item]",
  templateUrl: "./train-run-item.component.html",
  styleUrls: ["./train-run-item.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TrainRunItemComponent implements OnInit, OnDestroy, UpdateCounterHandler {
  @Input()
  trainrun: SgTrainrun;

  @Input()
  horizontal = true;

  @Input()
  doShowTrainruns = false;

  public yZoom = 0;
  public yMove = 0;
  public offsets: number[] = [];

  public viewBoxChangeInfo: ViewBoxChangeInfo = new ViewBoxChangeInfo();

  private readonly destroyed$ = new Subject<void>();

  private extraBount = 0;
  private fullDetailRenderingUpdateCounter = 0;
  private updateCounterController: UpdateCounterController = undefined;
  private recalc: boolean;
  private internalDoShowTrainruns = false;

  constructor(
    private readonly timeSliderService: TimeSliderService,
    private readonly viewBoxService: ViewBoxService,
    private readonly updateCounterTriggerService: UpdateCounterTriggerService,
    private readonly cd: ChangeDetectorRef,
    private readonly ngZone: NgZone,
  ) {
    // use ngOnInit because @Input this.trainrun is used
    this.ngZone.runOutsideAngular(() => {
      const stopLoop$ = new Subject<void>();
      interval(50)
        .pipe(takeUntil(stopLoop$))
        .subscribe(() => {
          if (!this.internalDoShowTrainruns) {
            this.internalDoShowTrainruns = true;
            this.cd.markForCheck();
            this.cd.detectChanges();
            stopLoop$.next();
            stopLoop$.complete();
          }
        });
    });
  }

  ngOnInit(): void {
    this.timeSliderService
      .getSliderChangeObservable()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((sliderChangeInfo: SliderChangeInfo) => {
        if (this.yZoom !== sliderChangeInfo.zoom) {
          this.offsets = [];
        }
        this.recalc = sliderChangeInfo.recalc;
        if (this.yZoom !== sliderChangeInfo.zoom) {
          this.recalc = true;
        }
        this.yZoom = sliderChangeInfo.zoom;
        this.yMove = sliderChangeInfo.move;
        this.doDelayedExtraBound();
      });

    this.viewBoxService
      .getViewBox()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((viewBoxChangeInfo: ViewBoxChangeInfo) => {
        this.viewBoxChangeInfo = viewBoxChangeInfo;
        this.doDelayedExtraBound();
      });

    if (this.doShowTrainruns) {
      this.internalDoShowTrainruns = true;
    }
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  public showSection(path: SgTrainrunItem): boolean {
    return path.isSection();
  }

  public showNode(path: SgTrainrunItem) {
    return path.isNode();
  }

  public getTrackReservations(
    item: SgTrainrunItem,
    offset: number,
  ): (SgTrainrunNodeTrackReservation | undefined)[] {
    if (!item.isNode()) {
      return [];
    }
    const reservations = item
      .getTrainrunNode()
      .getTrackReservations(offset, this.trainrun.trainrunId);
    return reservations.length > 0 ? reservations : [undefined];
  }

  public trackReservationKey(
    index: number,
    reservation: SgTrainrunNodeTrackReservation | undefined,
  ): string {
    return reservation === undefined
      ? "empty-" + index
      : `${reservation.trainrunId}-${reservation.occurrenceIndex}-${reservation.offset}-${index}`;
  }

  public getTranslate(path: SgTrainrunItem): string {
    return "" + path.getStartposition();
  }

  isElementNotFrustumCulled(item: SgTrainrunItem, offset: number, yZoom: number): boolean {
    if (!this.internalDoShowTrainruns) {
      return false;
    }
    if (!this.horizontal) {
      return true;
    }
    if (this.viewBoxChangeInfo.height === 0 && this.viewBoxChangeInfo.width) {
      return false;
    }
    // extend view box for frustum culling (the 2 * yZoom extra space is just a heuristics - might
    // thus must be more calculated based on pixel height !!!
    const fromTime = this.viewBoxChangeInfo.y - 2 * yZoom;
    const toTime = this.viewBoxChangeInfo.height + this.viewBoxChangeInfo.y + 2 * yZoom;
    const isInView = (fromPoint: number, toPoint: number): boolean =>
      (fromPoint >= fromTime && fromPoint <= toTime) ||
      (toPoint >= fromTime && toPoint <= toTime) ||
      (fromPoint <= fromTime && toPoint >= toTime);
    let fromPoint = 0;
    let toPoint = 0;
    if (item.isNode()) {
      const node = item.getTrainrunNode();
      const reservations = this.getTrackReservations(item, offset).filter(
        (reservation): reservation is SgTrainrunNodeTrackReservation => reservation !== undefined,
      );
      if (reservations.length > 0) {
        return reservations.some((reservation) => {
          let reservationFromPoint =
            Math.min(reservation.arrivalTime, reservation.departureTime) * yZoom;
          let reservationToPoint =
            Math.max(
              reservation.arrivalTime,
              reservation.departureTime,
              reservation.headwayUntilTime,
            ) * yZoom;
          if (node.isEndNode()) {
            reservationFromPoint -= 2 * this.trainrun.frequency * yZoom;
            reservationToPoint += 2 * this.trainrun.frequency * yZoom;
          }
          return isInView(reservationFromPoint, reservationToPoint);
        });
      }
      const arrivalTime = node.arrivalTime;
      const departureTime = node.departureTime;
      const headwayUntilTime = node.departureTime + node.minimumHeadwayTime;
      const timeOffset = offset;
      fromPoint = (Math.min(arrivalTime, departureTime) + timeOffset) * yZoom;
      toPoint = (Math.max(arrivalTime, departureTime, headwayUntilTime) + timeOffset) * yZoom;
      if (node.isEndNode()) {
        if (!item.getPathNode().trackOccupier && reservations.length === 0) {
          return false;
        }
        fromPoint -= 2 * this.trainrun.frequency * yZoom;
        toPoint += 2 * this.trainrun.frequency * yZoom;
      }
      if (!item.getPathNode().trackOccupier && reservations.length === 0) {
        if (departureTime === arrivalTime) {
          return false;
        }
      }
    }
    if (item.isSection()) {
      const ts = item.getTrainrunSection();
      fromPoint = (ts.departureTime + offset) * yZoom;
      toPoint = (ts.arrivalTime + offset + ts.minimumHeadwayTime) * yZoom;
    }
    return isInView(fromPoint, toPoint);
  }

  getId(trainrun: SgTrainrun, trainrunItem: SgTrainrunItem) {
    const itemType = trainrunItem.isNode() ? "node" : "section";
    return "streckengrafik_trainrun_item_" + trainrun.getId() + "_" + itemType + "_" + trainrunItem.getId();
  }

  bringToFront(trainrun: SgTrainrun, trainrunItem: SgTrainrunItem, event: MouseEvent) {
    if (event.buttons !== 0) {
      return;
    }
    const key = "#" + this.getId(trainrun, trainrunItem);
    d3.selectAll(key).raise();
  }

  getUpdateCounterTriggerService(): UpdateCounterTriggerService {
    return this.updateCounterTriggerService;
  }

  updateCounterCallback() {
    this.extraBount = 3;
    this.getOffsets();
  }

  getCurrentUpdateCounter(): number {
    return this.fullDetailRenderingUpdateCounter;
  }

  private doDelayedExtraBound() {
    this.fullDetailRenderingUpdateCounter++;
    this.extraBount = 0;

    if (this.updateCounterController !== undefined) {
      this.updateCounterController.clear();
    }
    if (this.recalc) {
      this.extraBount = 1;
      this.getOffsets();
    } else {
      this.updateCounterController = new UpdateCounterController(
        this.fullDetailRenderingUpdateCounter,
        this,
      );
    }
  }

  private getOffsets() {
    if (!this.trainrun) {
      return;
    }

    const frequency = this.trainrun.frequency * this.yZoom;
    const startTime = this.trainrun.startTime * this.yZoom;
    const endTime = this.trainrun.endTime * this.yZoom;
    const lowerBound = -Math.floor((endTime - this.yMove) / frequency);
    const upperBound = Math.ceil(
      (this.yMove + this.viewBoxChangeInfo.height - startTime) / frequency,
    );

    if (this.offsets.length === 0) {
      this.updateOffsets(lowerBound, upperBound);
    } else {
      const lb = this.offsets[0];
      if (lb > lowerBound * this.trainrun.frequency) {
        this.updateOffsets(lowerBound, upperBound);
        return;
      }

      const up = this.offsets[this.offsets.length - 1];
      if (up < upperBound * this.trainrun.frequency) {
        this.updateOffsets(lowerBound, upperBound);
        return;
      }
    }
  }

  private updateOffsets(inLowerBound: number, inUpperBound: number) {
    const lowerBound = inLowerBound - 1 - this.extraBount;
    const upperBound = inUpperBound + 1 + this.extraBount;
    for (let offset = lowerBound; offset <= upperBound; offset++) {
      this.offsets.push(offset * this.trainrun.frequency);
    }
    // unique
    this.offsets = this.offsets.filter((v, i, a) => a.indexOf(v) === i);
  }
}
