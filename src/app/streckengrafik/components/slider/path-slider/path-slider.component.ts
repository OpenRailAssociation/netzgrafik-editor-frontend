import {Component, Input, OnDestroy, ViewChild} from "@angular/core";
import {Subject} from "rxjs";
import {ResizeChangeInfo} from "../../../model/util/resizeChangeInfo";
import {ViewBoxChangeInfo} from "../../../model/util/viewBoxChangeInfo";
import {ResizeService} from "../../../services/util/resize.service";
import {ViewBoxService} from "../../../services/util/view-box.service";
import {takeUntil} from "rxjs/operators";
import {SgSelectedTrainrun} from "../../../model/streckengrafik-model/sg-selected-trainrun";
import {SgPath} from "../../../model/streckengrafik-model/sg-path";
import {Sg4ToggleTrackOccupierService} from "../../../services/sg-4-toggle-track-occupier.service";
import {Sg8RenderService} from "../../../services/sg-8-render.service";

@Component({
  selector: "sbb-path-slider",
  templateUrl: "./path-slider.component.html",
  styleUrls: ["./path-slider.component.scss"],
})
export class PathSliderComponent implements OnDestroy {
  @Input()
  horizontal = true;

  @Input()
  showRailTrackSlider = true;

  @ViewChild("svg")
  svgRef: any;

  viewBox: string;

  width = 0;
  start = 0;
  end = 0;

  public selectedTrainrun: SgSelectedTrainrun;

  private resizeChangeInfo: ResizeChangeInfo = new ResizeChangeInfo();
  private viewBoxChangeInfo: ViewBoxChangeInfo = new ViewBoxChangeInfo();

  private readonly destroyed$ = new Subject<void>();

  constructor(
    private readonly resizeService: ResizeService,
    private readonly viewBoxService: ViewBoxService,
    private readonly sg4ToggleTrackOccupierService: Sg4ToggleTrackOccupierService,
    private readonly sg8RenderService: Sg8RenderService,
  ) {
    this.sg8RenderService
      .getSgSelectedTrainrun()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((selectedTrainrun) => {
        if (selectedTrainrun) {
          this.selectedTrainrun = selectedTrainrun;
        }
      });

    this.resizeService
      .getResizeChangeInfo()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((resizeChangeInfo) => {
        this.resizeChangeInfo = resizeChangeInfo;
        this.renderResize();
      });

    this.viewBoxService
      .getViewBox()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((viewBoxChangeInfo) => {
        this.viewBoxChangeInfo = viewBoxChangeInfo;
        this.renderViewBox();
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  getTranslateX(pathSliderItem: SgPath) {
    return Math.round(pathSliderItem.startPosition);
  }

  public getSelectedTrainrunPaths() {
    if (this.selectedTrainrun) {
      if (this.selectedTrainrun.paths) {
        return this.selectedTrainrun.paths;
      }
    }
    return [];
  }

  getHorizontalineClassTag(path: SgPath): string {
    if (path.isNode()) {
      return "Horizontaline PathNode";
    }
    return "Horizontaline";
  }

  getNodeTextClassTag(path: SgPath): string {
    if (this.isNodeLocatedAtEdge(path) === 1) {
      return "NodeShortNameText LeftNode";
    }
    if (this.isNodeLocatedAtEdge(path) === 2) {
      return "NodeShortNameText RightNode";
    }
    return "NodeShortNameText";
  }

  pathSliderLine(path: SgPath) {
    if (path.isNode()) {
      return "M 0,40 L " + this.nodeWidth(path) + ",40";
    }
    return "M 0,40 L " + path.zoomedXPath() + ",40";
  }

  pathSliderStartLine() {
    return "M " + this.start + ",5 V 40";
  }

  pathSliderEndLine() {
    return "M " + this.end + ",5 V 40";
  }

  isPathNode(path: SgPath) {
    return path.isNode();
  }

  isPathSection(path: SgPath) {
    return path.isSection();
  }

  getNodeShortName(path: SgPath) {
    if (path.isNode()) {
      return path.getPathNode().nodeShortName;
    }
    return "";
  }

  isTrackOccupier(path: SgPath) {
    if (path.isNode()) {
      return path.getPathNode().trackOccupier;
    }
    return false;
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

  nodeWidth(path: SgPath) {
    if (path.isNode()) {
      return path.getPathNode().nodeWidth();
    }
    return 0;
  }

  sectionWidth(path: SgPath) {
    if (path.isSection()) {
      return path.getPathSection().zoomedXPath();
    }
    return 0;
  }

  doClick(path: SgPath) {
    if (path.isNode()) {
      this.sg4ToggleTrackOccupierService.toggleTrackOccupier(path.getPathNode().nodeId);
    }
  }

  private renderResize() {
    this.width = this.resizeChangeInfo.width;
    this.start = 0;
    this.end = this.resizeChangeInfo.width;
  }

  private renderViewBox() {
    const pathSliderMove = 0;
    if (this.horizontal) {
      this.viewBox = " " + pathSliderMove + " " + "0 " + this.viewBoxChangeInfo.width + " " + 40;
    } else {
      this.viewBox = "0 " + pathSliderMove + " " + 40 + " " + this.viewBoxChangeInfo.height;
    }
  }

  private isNodeLocatedAtEdge(path: SgPath): number {
    if (this.horizontal) {
      if (path.startPosition <= this.viewBoxChangeInfo.x) {
        return 1;
      }
      if (path.startPosition + 10 >= this.viewBoxChangeInfo.x + this.viewBoxChangeInfo.width) {
        return 2;
      }
    } else {
      if (path.startPosition <= this.viewBoxChangeInfo.y) {
        return 1;
      }
      if (path.startPosition + 10 >= this.viewBoxChangeInfo.y + this.viewBoxChangeInfo.height) {
        return 2;
      }
    }
    return 0;
  }
}
