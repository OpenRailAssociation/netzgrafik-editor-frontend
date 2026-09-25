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
import {SgTrainrunSection} from "../../model/streckengrafik-model/sg-trainrun-section";
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
  offset = 0;

  @Input()
  trackReservation: SgTrainrunNodeTrackReservation;

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
    return this.nodePaths().join(" ");
  }

  nodePaths(): string[] {
    return this.directTrackConnectionPath(
      this.isTrackOccupier() ? this.halfStrokeWidth : 0,
    );
  }

  getTransitLineId(pathIndex: number): string {
    return this.getId() + "_TransitLine_" + pathIndex;
  }

  collapsedNodePath() {
    const reservation = this.getTrackReservation();
    if (reservation === undefined) {
      return "";
    }
    const arrivalTime = reservation.arrivalTime * this.yZoom;
    const departureTime = reservation.departureTime * this.yZoom;
    return "M 0 " + arrivalTime + " L 0 " + departureTime;
  }

  private directTrackConnectionPath(trackInset: number): string[] {
    const node = this.sgTrainrunItem.getTrainrunNode();
    const reservation = this.getTrackReservation();
    if (reservation === undefined) {
      return [];
    }
    const nodeWidth = this.sgTrainrunItem.getPathNode().nodeWidth();
    const track = reservation.track * this.trackWidth;
    const arrivalTime = reservation.arrivalTime * this.yZoom;
    const departureTime = reservation.departureTime * this.yZoom;
    const path: string[] = [];
    const arrivalSection = this.getReservationSection(
      reservation.arrivalSectionId,
      node.arrivalPathSection,
    );
    const departureSection = this.getReservationSection(
      reservation.departureSectionId,
      node.departurePathSection,
    );

    if (arrivalSection !== undefined) {
      const arrivalOnLeft = this.sectionIsOnLeft(node, arrivalSection, true);
      const arrivalX = arrivalOnLeft ? 0 : nodeWidth;
      const arrivalTrackX = arrivalOnLeft ? track - trackInset : track + trackInset;
      path.push("M " + arrivalX + " " + arrivalTime + " L " + arrivalTrackX + " " + arrivalTime);
    }
    if (departureSection !== undefined) {
      const departureOnLeft = this.sectionIsOnLeft(node, departureSection, false);
      const departureX = departureOnLeft ? 0 : nodeWidth;
      const departureTrackX = departureOnLeft ? track - trackInset : track + trackInset;
      path.push(
        "M " + departureTrackX + " " + departureTime + " L " + departureX + " " + departureTime,
      );
    }
    return path;
  }

  private getReservationSection(
    sectionId: number | undefined,
    fallback: SgTrainrunSection | undefined,
  ): SgTrainrunSection | undefined {
    if (sectionId === undefined) {
      return fallback;
    }
    const node = this.sgTrainrunItem.getTrainrunNode();
    return [node.arrivalPathSection, node.departurePathSection].find(
      (section) => section?.trainrunSectionId === sectionId,
    ) ?? fallback;
  }

  private sectionIsOnLeft(
    node: SgTrainrunNode,
    section: SgTrainrunSection,
    isArrival: boolean,
  ): boolean {
    const pathSection = section.pathSection;
    const sectionStartPosition = pathSection?.startPosition;
    const nodeStartPosition = node.sgPathNode.startPosition;

    const neighborTrainrunNode = isArrival
      ? section.departurePathNode
      : section.arrivalPathNode;
    const otherPathNode = neighborTrainrunNode?.sgPathNode ?? (isArrival
      ? section.backward
        ? pathSection?.arrivalPathNode
        : pathSection?.departurePathNode
      : section.backward
        ? pathSection?.departurePathNode
        : pathSection?.arrivalPathNode);
    if (otherPathNode?.startPosition !== undefined && nodeStartPosition !== undefined) {
      if (otherPathNode.startPosition !== nodeStartPosition) {
        return otherPathNode.startPosition < nodeStartPosition;
      }
      if (otherPathNode.index !== node.sgPathNode.index) {
        return otherPathNode.index < node.sgPathNode.index;
      }
    }

    if (
      sectionStartPosition !== undefined &&
      nodeStartPosition !== undefined &&
      sectionStartPosition !== nodeStartPosition
    ) {
      return sectionStartPosition < nodeStartPosition;
    }

    if (section.pathSection?.arrivalPathNode === node.sgPathNode) {
      return true;
    }
    if (section.pathSection?.departurePathNode === node.sgPathNode) {
      return false;
    }
    return false;
  }

  pathGleisbelegung() {
    const reservation = this.getTrackReservation();
    if (reservation === undefined) {
      return "";
    }
    const departureTime = reservation.departureTime * this.yZoom;
    const arrivalTime = reservation.arrivalTime * this.yZoom;
    const track = reservation.track * this.trackWidth;
    if (this.sgTrainrunItem.backward) {
      return "M " + track + " " + departureTime + " L " + track + " " + arrivalTime;
    }
    return "M " + track + " " + arrivalTime + " L " + track + " " + departureTime;
  }

  pathHeadwayReservation() {
    const reservation = this.getTrackReservation();
    if (reservation === undefined) {
      return "";
    }
    const track = reservation.track * this.trackWidth;
    const departureTime = reservation.departureTime * this.yZoom;
    const headwayTime = reservation.headwayUntilTime * this.yZoom;
    return "M " + track + " " + departureTime + " L " + track + " " + headwayTime;
  }

  private getTrackReservation() {
    if (this.trackReservation !== undefined) {
      return {
        ...this.trackReservation,
        arrivalTime: this.trackReservation.arrivalTime - this.offset,
        departureTime: this.trackReservation.departureTime - this.offset,
        headwayUntilTime: this.trackReservation.headwayUntilTime - this.offset,
      };
    }
    return undefined;
  }

  hasTrackReservation() {
    return this.trackReservation !== undefined;
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

  checkUnrollAllowed(): boolean {
    return this.sgTrainrunItem.checkUnrollAllowed(this.offset / this.frequency);
  }

  bringToFront(event: MouseEvent, pathIndex?: number) {
    if (event.buttons !== 0) {
      return;
    }
    const key = "#" + (pathIndex === undefined ? this.getId() : this.getTransitLineId(pathIndex));
    d3.select(key).raise();
  }
}
