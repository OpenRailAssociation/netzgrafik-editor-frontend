import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
} from "@angular/core";
import {Subject} from "rxjs";
import {TimeSliderService} from "../../services/time-slider.service";
import {TrainDataService} from "../../services/train-data-service";
import {TrainrunService} from "../../../services/data/trainrun.service";
import {takeUntil} from "rxjs/operators";
import {SgTrainrun} from "../../model/streckengrafik-model/sg-trainrun";
import {SgTrainrunItem} from "../../model/streckengrafik-model/sg-trainrun-item";
import {
  SgTrainrunNode,
  SgTrainrunNodeTrackReservation,
} from "../../model/streckengrafik-model/sg-trainrun-node";
import {
  InformSelectedTrainrunClick,
  TrainrunSectionService,
} from "../../../services/data/trainrunsection.service";
import {SliderChangeInfo} from "../../model/util/sliderChangeInfo";
import * as d3 from "d3";

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: "[sbb-trainrun-node]",
  templateUrl: "./trainrun-node.component.html",
  styleUrls: ["./trainrun-node.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TrainRunNodeComponent implements OnInit, OnDestroy {
  @Input()
  trainrun: SgTrainrun;

  @Input()
  sgTrainrunItem: SgTrainrunItem;

  @Input()
  trackOccupier: boolean;

  @Input()
  offset: number;

  @Input()
  trackReservations: SgTrainrunNodeTrackReservation[] = [];

  @Input()
  frequency: number;

  yZoom = 1;
  trackWidth = 20;
  halfStrokeWidth = 6;

  private readonly destroyed$ = new Subject<void>();

  constructor(
    private readonly timeSliderService: TimeSliderService,
    private readonly trainDataService: TrainDataService,
    private readonly trainrunService: TrainrunService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.timeSliderService
      .getSliderChangeObservable()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((sliderChangeInfo: SliderChangeInfo) => {
        this.yZoom = sliderChangeInfo.zoom;
        this.cd.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  getClassTag(tag: string): string {
    let retTag = tag;
    retTag += " " + this.trainDataService.createColoringClassTags(this.trainrun.trainrunId);
    return retTag + " ColorRef_" + this.trainrun.colorRef + " ";
  }

  onEdgeLineClick($event: MouseEvent) {
    $event.preventDefault();
    $event.stopImmediatePropagation();
    const node = this.sgTrainrunItem.getTrainrunNode();
    let trainrunSectionId: number = undefined;
    if (node.arrivalPathSection !== undefined) {
      trainrunSectionId = node.arrivalPathSection.trainrunSectionId;
    }
    if (trainrunSectionId === undefined) {
      if (node.departurePathSection !== undefined) {
        trainrunSectionId = node.departurePathSection.trainrunSectionId;
      }
    }

    if (!this.trainrunService.getTrainrunFromId(this.trainrun.trainrunId)?.selected()) {
      this.trainrunService.setTrainrunAsSelected(this.trainrun.trainrunId);
    } else {
      const param: InformSelectedTrainrunClick = {
        trainrunSectionId: trainrunSectionId,
        open: true,
      };
      this.trainrunSectionService.clickSelectedTrainrunSection(param);
    }
  }

  getId() {
    return (
      "streckengrafik_trainrun_item_" + this.trainrun.getId() + "_" + this.sgTrainrunItem.backward
    );
  }

  nodePath() {
    return this.directTrackConnectionPath(
      this.isTrackOccupier() ? this.halfStrokeWidth : 0,
    );
  }

  collapsedNodePath() {
    const reservation = this.getTrackReservation(this.sgTrainrunItem.getTrainrunNode(), this.offset);
    if (reservation === undefined) {
      return "";
    }
    const arrivalTime = reservation.arrivalTime * this.yZoom;
    const departureTime = reservation.departureTime * this.yZoom;
    return "M 0 " + arrivalTime + " L 0 " + departureTime;
  }

  private directTrackConnectionPath(trackInset: number): string {
    const node = this.sgTrainrunItem.getTrainrunNode();
    const reservation = this.getTrackReservation(node, this.offset);
    if (reservation === undefined) {
      return "";
    }
    const nodeWidth = this.sgTrainrunItem.getPathNode().nodeWidth();
    const track = reservation.track * this.trackWidth;
    const arrivalTime = reservation.arrivalTime * this.yZoom;
    const departureTime = reservation.departureTime * this.yZoom;
    const path: string[] = [];

    if (node.arrivalPathSection !== undefined) {
      const arrivalX = node.arrivalPathSection.backward ? nodeWidth : 0;
      const arrivalTrackX = node.arrivalPathSection.backward
        ? track + trackInset
        : track - trackInset;
      path.push("M " + arrivalX + " " + arrivalTime + " L " + arrivalTrackX + " " + arrivalTime);
    }
    if (node.departurePathSection !== undefined) {
      const departureX = node.departurePathSection.backward ? 0 : nodeWidth;
      const departureTrackX = node.departurePathSection.backward
        ? track - trackInset
        : track + trackInset;
      path.push(
        "M " + departureTrackX + " " + departureTime + " L " + departureX + " " + departureTime,
      );
    }
    return path.join(" ");
  }

  pathGleisbelegung() {
    const reservation = this.getTrackReservation(this.sgTrainrunItem.getTrainrunNode(), this.offset);
    if (reservation === undefined) {
      return "";
    }
    const delta = reservation.departureTime - reservation.arrivalTime === 0 ? 0.1 : 0.0;
    const departureTime = (reservation.departureTime + delta) * this.yZoom;
    const arrivalTime = (reservation.arrivalTime - delta) * this.yZoom;
    const track = reservation.track * this.trackWidth;
    if (this.sgTrainrunItem.backward) {
      return "M " + track + " " + departureTime + " L " + track + " " + arrivalTime;
    }
    return "M " + track + " " + arrivalTime + " L " + track + " " + departureTime;
  }

  pathHeadwayReservation() {
    const reservation = this.getTrackReservation(this.sgTrainrunItem.getTrainrunNode(), this.offset);
    if (reservation === undefined) {
      return "";
    }
    const track = reservation.track * this.trackWidth;
    const departureTime = reservation.departureTime * this.yZoom;
    const headwayTime = reservation.headwayUntilTime * this.yZoom;
    return "M " + track + " " + departureTime + " L " + track + " " + headwayTime;
  }

  private getTrackReservation(node: SgTrainrunNode, offset = 0) {
    const targetArrivalTime = node.arrivalTime + offset;
    const targetDepartureTime = node.departureTime + offset;
    const reservations =
      this.trackReservations.length > 0 ? this.trackReservations : node.trackReservations;
    const offsetOccupancy = reservations.find(
      (occupancy) =>
        occupancy.arrivalTime === targetArrivalTime &&
        occupancy.departureTime === targetDepartureTime,
    );
    if (offsetOccupancy !== undefined) {
      return {
        ...offsetOccupancy,
        arrivalTime: offsetOccupancy.arrivalTime - offset,
        departureTime: offsetOccupancy.departureTime - offset,
        headwayUntilTime: offsetOccupancy.headwayUntilTime - offset,
      };
    }
    if (reservations.length > 0) {
      return undefined;
    }
    return undefined;
  }

  hasTrackReservation() {
    return this.getTrackReservation(this.sgTrainrunItem.getTrainrunNode(), this.offset) !== undefined;
  }

  isTrackOccupier() {
    return this.trackOccupier;
  }

  isStreckenTrainrunSegment() {
    if (this.sgTrainrunItem.isNode()) {
      const tn = this.sgTrainrunItem.getTrainrunNode();
      if (tn.isEndNode()) {
        return false;
      }
      if (tn.departurePathSection !== undefined && tn.arrivalPathSection !== undefined) {
        return true;
      }
      return false;
    }
    return true;
  }

  unusedForTurnaround(): boolean {
    if (!this.sgTrainrunItem.isNode()) {
      return false;
    }
    return !this.sgTrainrunItem.getTrainrunNode().unusedForTurnaround;
  }

  checkUnrollAllowed(): boolean {
    return this.sgTrainrunItem.checkUnrollAllowed(this.offset / this.frequency);
  }

  bringToFront(event: MouseEvent) {
    if (event.buttons !== 0) {
      return;
    }
    const key = "#" + this.getId();
    d3.select(key).raise();
  }
}
