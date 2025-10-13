import {AfterViewInit, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from "@angular/core";
import {Subject} from "rxjs";
import {ResizeChangeInfo} from "../../../model/util/resizeChangeInfo";
import {ViewBoxChangeInfo} from "../../../model/util/viewBoxChangeInfo";
import {ResizeService} from "../../../services/util/resize.service";
import {ViewBoxService} from "../../../services/util/view-box.service";
import {NodeService} from "../../../../services/data/node.service";
import {takeUntil} from "rxjs/operators";
import {TrackData} from "../../../model/trackData";
import {Sg7PathSliderService} from "../../../services/sg-7-path-slider.service";
import {SgSelectedTrainrun} from "../../../model/streckengrafik-model/sg-selected-trainrun";
import {SgPath} from "../../../model/streckengrafik-model/sg-path";

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: "[sbb-path-grid]",
  templateUrl: "./path-grid.component.html",
  styleUrls: ["./path-grid.component.scss"],
})
export class PathGridComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input()
  horizontal = true;

  @Input()
  renderOnlyGrid = false;

  @Input()
  renderTrackLabels = false;

  selectedTrainrun: SgSelectedTrainrun;

  width = 0;
  start = 0;
  end = 0;

  trackWidth = 20;

  private readonly destroyed$ = new Subject<void>();

  private resizeChangeInfo: ResizeChangeInfo = new ResizeChangeInfo();
  public viewBoxChangeInfo: ViewBoxChangeInfo = new ViewBoxChangeInfo();

  constructor(
    private readonly sgPathSliderService: Sg7PathSliderService,
    private readonly resizeService: ResizeService,
    private readonly viewBoxService: ViewBoxService,
    private readonly nodeService: NodeService,
    private readonly cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sgPathSliderService
      .getSgSelectedTrainrun()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((sgSelectedTrainrun) => {
        if (sgSelectedTrainrun) {
          this.selectedTrainrun = sgSelectedTrainrun;
        }
      });

    this.resizeService
      .getResizeChangeInfo()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((resizeChangeInfo) => {
        this.resizeChangeInfo = resizeChangeInfo;
        this.render();
      });

    this.viewBoxService
      .getViewBox()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((viewBoxChangeInfo) => {
        this.viewBoxChangeInfo = viewBoxChangeInfo;
      });
  }

  ngAfterViewInit() {
    this.render();
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  public getSelectedTrainrunPaths() {
    if (this.selectedTrainrun) {
      if (this.selectedTrainrun.paths) {
        return this.selectedTrainrun.paths;
      }
    }
    return [];
  }

  private render() {
    this.width = this.resizeChangeInfo.width;
    this.start = 0;
    this.end = this.resizeChangeInfo.width;
  }

  getGridTrackPositions(path: SgPath): number[] {
    const gridTrackPositions = [];
    for (let idx = this.trackWidth; idx < this.nodeWidth(path); idx += this.trackWidth) {
      gridTrackPositions.push(idx);
    }
    return gridTrackPositions;
  }

  isStartOrEndNode(path: SgPath) {
    if (path.isNode()) {
      return (
        path.getPathNode().departurePathSection === undefined ||
        path.getPathNode().arrivalPathSection === undefined
      );
    }
    return false;
  }

  getRenderLabelPosY(gridTrackPos: number, isTextPos: boolean): number {
    if (!this.horizontal) {
      return 30;
    }
    const offset = isTextPos ? 35 : 38;
    return offset + ((((gridTrackPos - this.trackWidth) / this.trackWidth) % 2) - 1) * 7;
  }

  getTrackData(path: SgPath, gridTrackPos: number): TrackData {
    const trackNbr = Math.round(1 + (gridTrackPos - this.trackWidth) / this.trackWidth);
    const pathNode = path.getPathNode();
    const nodeTracks = pathNode.trackData.getNodeTracks();
    const trackIdx = trackNbr - 1;
    return trackIdx < nodeTracks.length ? nodeTracks[trackIdx] : pathNode.trackData;
  }

  getTrackLabel(path: SgPath, gridTrackPos: number): string {
    const trackNbr = Math.round(1 + (gridTrackPos - this.trackWidth) / this.trackWidth);
    return "" + trackNbr;
  }

  getTrackTitel(path: SgPath, gridTrackPos: number): string {
    const trackData = this.getTrackData(path, gridTrackPos);
    if (trackData.nodeId1 === undefined && trackData.nodeId2 === undefined) {
      return "";
    }

    let ret = "[ ";
    if (trackData.nodeId1 !== undefined) {
      const node1 = this.nodeService.getNodeFromId(trackData.nodeId1);
      if (node1 !== undefined && node1) {
        ret += node1.getBetriebspunktName();
      }
    }

    if (trackData.nodeId2 !== undefined) {
      const node2 = this.nodeService.getNodeFromId(trackData.nodeId2);
      if (node2 !== undefined && node2) {
        if (ret !== "") {
          ret += " , ";
        }
        ret += node2.getBetriebspunktName();
      }
    }

    return ret + " ]";
  }

  isTrackOccupier(path: SgPath) {
    if (path.isNode()) {
      return path.trackOccupier;
    }
    return false;
  }

  nodeWidth(path: SgPath) {
    if (path.isNode()) {
      return path.getPathNode().nodeWidth();
    }
    return 0;
  }

  getTranslateX(path: SgPath) {
    return Math.round(path.startPosition);
  }

  getClassTag(tag: string, path: SgPath): string {
    if (this.isTrackOccupier(path)) {
      return tag + " TrackOccupier";
    }
    return tag;
  }

  getClassTagWithTrackPos(tag: string, path: SgPath, gridTrackPos: number): string {
    let ret = this.getClassTag(tag, path);
    const trackData = this.getTrackData(path, gridTrackPos);
    if (trackData !== undefined) {
      const grp = trackData.getTrackGrp();
      ret += " TrackGroup_" + (grp % 2);
    }
    return ret;
  }
}
