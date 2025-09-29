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
import {Sg6TrackService} from "../../services/sg-6-track.service";
import {
  InformSelectedTrainrunClick,
  TrainrunSectionService,
} from "../../../services/data/trainrunsection.service";
import {NodeService} from "../../../services/data/node.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {StreckengrafikDisplayElementService} from "../../services/util/streckengrafik-display-element.service";
import {SliderChangeInfo} from "../../model/util/sliderChangeInfo";
import * as d3 from "d3";

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: "[sbb-trainrun-node]",
  templateUrl: "./trainrun-node.component.html",
  styleUrls: ["./trainrun-node.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  frequency: number;

  yZoom = 1;
  trackWidth = 20;
  halfStrokeWidth = 6;

  private readonly destroyed$ = new Subject<void>();

  constructor(
    private readonly timeSliderService: TimeSliderService,
    private readonly trainDataService: TrainDataService,
    private readonly sg6TrackService: Sg6TrackService,
    private readonly trainrunService: TrainrunService,
    private readonly nodeService: NodeService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly uiInteractionService: UiInteractionService,
    private readonly streckengrafikDisplayElementService: StreckengrafikDisplayElementService,
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
    /* DEBUG
    if (this.checkRotated()) {
      retTag += ' rotate ';
    }
    retTag += this.sgTrainrunItem.backward ? ' backward ' : ' forward ';
    retTag += ' idx0_arr_' + (this.sgTrainrunItem.getTrainrunNode().arrivalPathSection !== undefined ? this.sgTrainrunItem.getTrainrunNode().arrivalPathSection.index : '_undef') + ' ';
    retTag += ' idx1_index_' + this.sgTrainrunItem.index + ' ';
    retTag += ' idx2_dep_' + (this.sgTrainrunItem.getTrainrunNode().departurePathSection !== undefined ? +this.sgTrainrunItem.getTrainrunNode().departurePathSection.index : '_undef') + ' ';
    */
    return retTag + " ColorRef_" + this.trainrun.colorRef + " ";
  }

  checkRotated(): boolean {
    /**** Adrian Egli (adrian.egli@sbb.ch)
     TODO - This checkRotated is a hot fix for special case if there is a trainrun running from
     [ A - B - C - B - D | A - B - B - C | .... or ... ] -> passes two times same node
     There is sill an issue in the CODE - if the trainrun passes the second time a node, the in-/out
     branching edge will not all be rendered!
     */
    if (!this.trackOccupier) {
      return false;
    }
    const tn = this.sgTrainrunItem.getTrainrunNode();
    let idx_arr =
      this.sgTrainrunItem.getTrainrunNode().arrivalPathSection !== undefined
        ? this.sgTrainrunItem.getTrainrunNode().arrivalPathSection.index
        : undefined;
    let idx_dep =
      this.sgTrainrunItem.getTrainrunNode().departurePathSection !== undefined
        ? this.sgTrainrunItem.getTrainrunNode().departurePathSection.index
        : undefined;

    if (idx_arr === undefined) {
      if (!tn.backward && tn.index !== 0) {
        return tn.index > idx_dep;
      }
      idx_arr = tn.index;
    }
    if (idx_dep === undefined) {
      if (tn.backward && tn.index !== 0) {
        return idx_arr < tn.index;
      }
      idx_dep = tn.index;
    }

    if (idx_arr === idx_dep) {
      if (tn.index < idx_arr) {
        return true;
      }
    } else {
      const deltaArr = Math.abs(tn.index - idx_arr);
      const deltaDep = Math.abs(tn.index - idx_dep);
      if (deltaArr > 1 && deltaDep > 1) {
        return !tn.backward;
      }
      if (deltaArr > 1) {
        if (!tn.backward) {
          return tn.index > idx_arr ? tn.index > idx_dep : tn.index < idx_dep;
        } else {
          return tn.index < idx_arr ? tn.index < idx_dep : tn.index > idx_dep;
        }
      }
      if (deltaDep > 1) {
        if (tn.backward) {
          return tn.index > idx_dep ? tn.index > idx_arr : tn.index < idx_arr;
        } else {
          return tn.index < idx_dep ? tn.index < idx_arr : tn.index > idx_arr;
        }
      }
    }

    return false;
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
    const departureTime = this.sgTrainrunItem.departureTime * this.yZoom;
    const arrivalTime = this.sgTrainrunItem.arrivalTime * this.yZoom;
    const track = this.sgTrainrunItem.getTrainrunNode().trackData.track * this.trackWidth;
    const nodeWidth = this.sgTrainrunItem.getPathNode().nodeWidth();

    const doRot = this.checkRotated();

    if (this.isTrackOccupier()) {
      const tn = this.sgTrainrunItem.getTrainrunNode();
      if (tn.isEndNode()) {
        if (this.sgTrainrunItem.getTrainrunNode().isTurnaround) {
          if (this.sgTrainrunItem.backward) {
            let p = tn.departurePathSection === undefined ? nodeWidth : 0;
            if (doRot) {
              p = p === 0 ? nodeWidth : 0;
            }
            const orientation = p === 0 ? 1 : -1;
            return (
              "M " +
              p +
              " " +
              arrivalTime +
              " L " +
              (track + orientation * this.halfStrokeWidth) +
              " " +
              arrivalTime +
              " M " +
              (track + orientation * this.halfStrokeWidth) +
              " " +
              departureTime +
              " L " +
              p +
              " " +
              departureTime
            );
          }
          let p = tn.arrivalPathSection === undefined ? nodeWidth : 0;
          if (doRot) {
            p = p === 0 ? nodeWidth : 0;
          }
          const s = p === 0 ? 1 : -1;
          return (
            "M " +
            p +
            " " +
            arrivalTime +
            " L " +
            (track + s * this.halfStrokeWidth) +
            " " +
            arrivalTime +
            " M " +
            (track + s * this.halfStrokeWidth) +
            " " +
            departureTime +
            " L " +
            p +
            " " +
            departureTime
          );
        }
        if (this.sgTrainrunItem.backward) {
          let path = "";
          // Extremity node on the target side (backward)
          if (tn.departurePathSection !== undefined && tn.departurePathSection.backward) {
            const x0 = doRot ? nodeWidth : 0;
            path +=
              " M " +
              x0 +
              " " +
              departureTime +
              " L " +
              (track + this.halfStrokeWidth) +
              " " +
              departureTime;
            if (this.sgTrainrunItem.getTrainrunNode().isTurnaround) {
              path +=
                " M " +
                x0 +
                " " +
                arrivalTime +
                " L " +
                (track + this.halfStrokeWidth) +
                " " +
                arrivalTime;
            }
          }
          // Extremity node on the source side (backward)
          if (tn.arrivalPathSection !== undefined && tn.arrivalPathSection.backward) {
            const x1 = doRot ? 0 : nodeWidth;
            path +=
              " M " +
              (track - this.halfStrokeWidth) +
              " " +
              arrivalTime +
              " L " +
              x1 +
              " " +
              arrivalTime;
            if (this.sgTrainrunItem.getTrainrunNode().isTurnaround) {
              path +=
                " M " +
                (track - this.halfStrokeWidth) +
                " " +
                departureTime +
                " L " +
                x1 +
                " " +
                departureTime;
            }
          }
          return path;
        }
        let path = "";
        // Extremity node on the target side (forward)
        if (tn.arrivalPathSection !== undefined && !tn.arrivalPathSection.backward) {
          const x0 = doRot ? nodeWidth : 0;
          path +=
            " M " +
            x0 +
            " " +
            arrivalTime +
            " L " +
            (track + this.halfStrokeWidth) +
            " " +
            arrivalTime;
          if (this.sgTrainrunItem.getTrainrunNode().isTurnaround) {
            path +=
              " M " +
              x0 +
              " " +
              departureTime +
              " L " +
              (track + this.halfStrokeWidth) +
              " " +
              departureTime;
          }
        }
        // Extremity node on the source side (forward)
        if (tn.departurePathSection !== undefined && !tn.departurePathSection.backward) {
          const x1 = doRot ? 0 : nodeWidth;
          path +=
            " M " +
            (track - this.halfStrokeWidth) +
            " " +
            departureTime +
            " L " +
            x1 +
            " " +
            departureTime;
          if (this.sgTrainrunItem.getTrainrunNode().isTurnaround) {
            path +=
              " M " +
              (track - this.halfStrokeWidth) +
              " " +
              arrivalTime +
              " L " +
              x1 +
              " " +
              arrivalTime;
          }
        }
        return path;
      }
      if (this.sgTrainrunItem.backward) {
        const x0 = doRot ? nodeWidth : 0;
        return (
          "M " +
          x0 +
          " " +
          departureTime +
          " L " +
          (track + this.halfStrokeWidth) +
          " " +
          departureTime +
          " M " +
          (track - this.halfStrokeWidth) +
          " " +
          arrivalTime +
          " L " +
          (nodeWidth - x0) +
          " " +
          arrivalTime
        );
      }
      const x0 = doRot ? nodeWidth : 0;
      return (
        "M " +
        x0 +
        " " +
        arrivalTime +
        " L " +
        (track + this.halfStrokeWidth) +
        " " +
        arrivalTime +
        " M " +
        (track - this.halfStrokeWidth) +
        " " +
        departureTime +
        " L " +
        (nodeWidth - x0) +
        " " +
        departureTime
      );
    }
    const x0 = doRot ? nodeWidth : 0;
    return "M " + x0 + " " + arrivalTime + " V " + departureTime;
  }

  pathGleisbelegung() {
    const delta =
      this.sgTrainrunItem.departureTime - this.sgTrainrunItem.arrivalTime === 0 ? 0.1 : 0.0;
    const departureTime = (this.sgTrainrunItem.departureTime + delta) * this.yZoom;
    const arrivalTime = (this.sgTrainrunItem.arrivalTime - delta) * this.yZoom;
    const track = this.sgTrainrunItem.getTrainrunNode().trackData.track * this.trackWidth;
    if (this.sgTrainrunItem.backward) {
      return "M " + track + " " + departureTime + " L " + track + " " + arrivalTime;
    }
    return "M " + track + " " + arrivalTime + " L " + track + " " + departureTime;
  }

  pathHeadwayReservation() {
    const track = this.sgTrainrunItem.getTrainrunNode().trackData.track * this.trackWidth;
    const departureTime =
      (this.sgTrainrunItem.departureTime + this.sgTrainrunItem.minimumHeadwayTime) * this.yZoom;
    const arrivalTime = this.sgTrainrunItem.arrivalTime * this.yZoom;
    return "M " + track + " " + arrivalTime + " L " + track + " " + departureTime;
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
