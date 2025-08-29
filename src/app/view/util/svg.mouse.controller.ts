import * as d3 from "d3";
import {Vec2D} from "../../utils/vec2D";
import {StaticDomTags} from "../editor-main-view/data-views/static.dom.tags";
import {ViewboxProperties} from "../../services/ui/ui.interaction.service";
import {UndoService} from "../../services/data/undo.service";

export interface SVGMouseControllerObserver {
  onEarlyReturnFromMousemove(): boolean;

  onGraphContainerMouseup(mousePosition: Vec2D, onPaning: boolean);

  zoomFactorChanged(newZoomFactor: number);

  onViewboxChanged(viewboxProperties: ViewboxProperties);

  onStartMultiSelect();

  updateMultiSelect(topLeft: Vec2D, bottomRight: Vec2D);

  onEndMultiSelect();

  onScaleNetzgrafik(factor: number, scaleCenter: Vec2D);
}

export class SVGMouseController {
  private static ZOOM_FACTOR_PERCENT = 10;
  private viewboxProperties: ViewboxProperties;

  private svgDrawingContext: any;
  private cachedSvgDrawingContextNode = null;
  private previousPanMousePosition: Vec2D = null;
  private previousMultiSelectShiftPosition: Vec2D = null;
  private mouseMoveMousePosition: Vec2D = null;
  private onPanning = false;
  private viewboxIsFixed = false;

  private lastMouseEventTimeStamp: number = undefined;
  private ctrlKeyPressed = false;

  constructor(
    private svgName: string,
    private svgMouseControllerObserver: SVGMouseControllerObserver,
    private undoService: UndoService,
  ) {
    this.ctrlKeyDownListener = this.ctrlKeyDownListener.bind(this);
    this.ctrlKeyUpListener = this.ctrlKeyUpListener.bind(this);
  }

  private ctrlKeyDownListener(e: KeyboardEvent) {
    if (e.key === "Control") this.ctrlKeyPressed = true;
  }
  private ctrlKeyUpListener(e: KeyboardEvent) {
    if (e.key === "Control") this.ctrlKeyPressed = false;
  }

  init(viewboxProperties: ViewboxProperties) {
    this.viewboxProperties = viewboxProperties;
    const element = d3.select("html").node();
    const rectHtml = element.getBoundingClientRect();
    const height = rectHtml.height;
    const width = rectHtml.width;

    this.cachedSvgDrawingContextNode = null;

    this.svgDrawingContext = d3.select("#" + this.svgName);
    this.svgDrawingContext
      .attr("oncontextmenu", "return false;")
      .attr("x", rectHtml.x)
      .attr("y", rectHtml.y)
      .attr("height", height)
      .attr("width", width);

    if (this.svgDrawingContext.node() === null) {
      return undefined;
    }
    this.registerCallbacks();
    const rect = this.svgDrawingContext.node().getBoundingClientRect();
    this.viewboxProperties.origWidth = rect.width;
    this.viewboxProperties.origHeight = rect.height;
    if (this.viewboxProperties.currentViewBox !== null) {
      this.setViewbox();
    } else {
      this.resize(rect.width, rect.height);
    }

    // Listens to ctrl key events to differentiate
    // between pinch-to-zoom touchpad gesture and ctrl + mousewheel
    window.addEventListener("keydown", this.ctrlKeyDownListener);
    window.addEventListener("keyup", this.ctrlKeyUpListener);

    return this.svgDrawingContext.append(StaticDomTags.GROUP_DOM_REF);
  }

  destroy() {
    window.removeEventListener("keydown", this.ctrlKeyDownListener);
    window.removeEventListener("keyup", this.ctrlKeyUpListener);
  }

  fixViewbox() {
    this.viewboxIsFixed = true;
  }

  resize(width: number, height: number) {
    this.svgDrawingContext.attr("width", width);
    this.svgDrawingContext.attr("height", height);
    if (!(this.viewboxProperties.panZoomWidth > 0 && this.viewboxProperties.panZoomHeight > 0)) {
      // initial values
      this.viewboxProperties.panZoomLeft = 0;
      this.viewboxProperties.panZoomTop = 0;
      this.viewboxProperties.panZoomHeight = height;
      this.viewboxProperties.panZoomWidth = width;
    } else {
      this.viewboxProperties.origHeight = height;
      this.viewboxProperties.origWidth = width;
      this.updateZoomCenter(new Vec2D(0.5, 0.5));
    }
    this.setViewbox();
    this.svgMouseControllerObserver.zoomFactorChanged(this.viewboxProperties.zoomFactor);
  }

  scaleIn(scaleCenter: Vec2D) {
    this.svgMouseControllerObserver.onScaleNetzgrafik(1.125, scaleCenter);
  }

  scaleOut(scaleCenter: Vec2D) {
    this.svgMouseControllerObserver.onScaleNetzgrafik(1.0 / 1.125, scaleCenter);
  }

  zoomIn(zoomCenter: Vec2D, factor = 1.0) {
    if (this.viewboxIsFixed) {
      return;
    }
    if (this.viewboxProperties.zoomFactor < 300) {
      const sigmoid = 1.0 / (1.0 + Math.exp(-this.viewboxProperties.zoomFactor - 300));
      this.viewboxProperties.zoomFactor +=
        factor !== 1.0
          ? factor * sigmoid * this.viewboxProperties.zoomFactor
          : SVGMouseController.ZOOM_FACTOR_PERCENT;
      this.viewboxProperties.zoomFactor = Math.min(300, this.viewboxProperties.zoomFactor);
      this.viewboxProperties.zoomFactor = Math.round(this.viewboxProperties.zoomFactor / 10) * 10;
      this.temporaryDisableUndoServicePushCurrentVersion();
      this.updateZoomCenter(zoomCenter);
      this.svgMouseControllerObserver.zoomFactorChanged(this.viewboxProperties.zoomFactor);
    }
  }

  zoomOut(zoomCenter: Vec2D, factor = 1.0) {
    if (this.viewboxIsFixed) {
      return;
    }
    if (this.viewboxProperties.zoomFactor > 1) {
      const sigmoid = 1.0 / (1.0 + Math.exp(-this.viewboxProperties.zoomFactor - 300));
      this.viewboxProperties.zoomFactor -=
        factor !== 1.0
          ? factor * sigmoid * this.viewboxProperties.zoomFactor
          : SVGMouseController.ZOOM_FACTOR_PERCENT;
      this.viewboxProperties.zoomFactor = Math.max(10.0, this.viewboxProperties.zoomFactor);
      this.viewboxProperties.zoomFactor = Math.round(this.viewboxProperties.zoomFactor / 10) * 10;
      this.temporaryDisableUndoServicePushCurrentVersion();
      this.updateZoomCenter(zoomCenter);
      this.svgMouseControllerObserver.zoomFactorChanged(this.viewboxProperties.zoomFactor);
    }
  }

  zoomReset(zoomCenter: Vec2D) {
    if (this.viewboxIsFixed) {
      return;
    }
    this.viewboxProperties.zoomFactor = 100;
    this.temporaryDisableUndoServicePushCurrentVersion();
    this.updateZoomCenter(zoomCenter);
    this.svgMouseControllerObserver.zoomFactorChanged(this.viewboxProperties.zoomFactor);
  }

  getCurrentMousePosition(): Vec2D {
    if (this.cachedSvgDrawingContextNode === null) {
      this.cachedSvgDrawingContextNode = this.svgDrawingContext.node();
    }
    const point = d3.mouse(this.cachedSvgDrawingContextNode);
    return new Vec2D(point[0], point[1]);
  }

  moveNetzgrafikEditorViewFocalPoint(center: Vec2D) {
    if (this.viewboxProperties === undefined) {
      return;
    }
    this.viewboxProperties.panZoomLeft = center.getX() - this.viewboxProperties.panZoomWidth / 2.0;
    this.viewboxProperties.panZoomTop = center.getY() - this.viewboxProperties.panZoomHeight / 2.0;
    this.setViewbox();
  }

  setViewbox() {
    this.viewboxProperties.currentViewBox = this.makeViewboxString();
    this.svgDrawingContext.attr("viewBox", this.viewboxProperties.currentViewBox);
    this.svgMouseControllerObserver.onViewboxChanged(this.viewboxProperties);
  }

  getViewboxProperties(): ViewboxProperties {
    return Object.assign({}, this.viewboxProperties);
  }

  isPanning(): boolean {
    return this.onPanning;
  }

  getLastMousePosition(): Vec2D {
    return this.mouseMoveMousePosition;
  }

  private registerCallbacks() {
    this.svgDrawingContext
      .on("mousedown", () => this.onGraphContainerMousedown())
      .on("mousemove", () => this.onGraphContainerMousemove())
      .on("mouseup", () => this.onGraphContainerMouseup())
      .on("dblclick", () => this.onDblclick())
      .on("wheel", () => this.onWheel());
  }

  private onGraphContainerMousedown() {
    // reset to initial value (start panning)
    if (
      d3.event.shiftKey ||
      (d3.event.buttons === 2 && this.lastMouseEventTimeStamp === undefined)
    ) {
      this.previousMultiSelectShiftPosition = this.getCurrentMousePosition();
      this.temporaryDisableUndoServicePushCurrentVersion();
      this.svgMouseControllerObserver.onStartMultiSelect();
    } else {
      this.previousPanMousePosition = null;
    }

    this.onMouseDownZoom();

    d3.event.stopPropagation();
  }

  private onGraphContainerMousemove() {
    this.lastMouseEventTimeStamp = undefined;

    this.mouseMoveMousePosition = this.getCurrentMousePosition();
    if (this.svgMouseControllerObserver.onEarlyReturnFromMousemove()) {
      return;
    }

    if (d3.event.buttons > 0) {
      if (this.previousMultiSelectShiftPosition === null) {
        if (this.onPanning) {
          this.panDrawingContext();
        } else if (d3.event.button === 0) {
          if (this.previousPanMousePosition !== null) {
            const delta = Vec2D.norm(
              Vec2D.sub(this.previousPanMousePosition, this.getCurrentMousePosition()),
            );
            if (delta > 2) {
              // only start panning if the mouse cursor has moved more than 2 pixel (initial move check)
              this.onPanning = true;
            }
          }
          this.previousPanMousePosition = this.getCurrentMousePosition();
        }
      } else {
        if (d3.event.shiftKey || d3.event.buttons === 2) {
          const curPos = this.getCurrentMousePosition();
          const topLef = new Vec2D(
            Math.min(this.previousMultiSelectShiftPosition.getX(), curPos.getX()),
            Math.min(this.previousMultiSelectShiftPosition.getY(), curPos.getY()),
          );
          const bottomRight = new Vec2D(
            Math.max(this.previousMultiSelectShiftPosition.getX(), curPos.getX()),
            Math.max(this.previousMultiSelectShiftPosition.getY(), curPos.getY()),
          );
          this.temporaryDisableUndoServicePushCurrentVersion();
          this.svgMouseControllerObserver.updateMultiSelect(topLef, bottomRight);
        } else {
          this.svgMouseControllerObserver.onEndMultiSelect();
          this.previousMultiSelectShiftPosition = null;
        }
      }
    } else {
      if (this.previousMultiSelectShiftPosition !== null) {
        this.svgMouseControllerObserver.onEndMultiSelect();
        this.previousMultiSelectShiftPosition = null;
      }
    }

    d3.event.stopPropagation();
  }

  private onGraphContainerMouseup() {
    this.svgMouseControllerObserver.onGraphContainerMouseup(
      this.getCurrentMousePosition(),
      this.onPanning,
    );
    this.onPanning = false;
    if (this.previousMultiSelectShiftPosition !== null) {
      this.svgMouseControllerObserver.onEndMultiSelect();
      this.previousMultiSelectShiftPosition = null;
    }
    d3.event.stopPropagation();
  }

  private onWheel() {
    const zoomCenter: Vec2D = new Vec2D(
      d3.event.offsetX / this.viewboxProperties.origWidth,
      d3.event.offsetY / this.viewboxProperties.origHeight,
    );

    // We can't use d3.event.ctrlKey because it'll be set to true during
    // pinch-to-zoom touchpad gestures. Use keydown/keyup event listeners instead.
    if (!this.ctrlKeyPressed) {
      // mouse wheel
      if (d3.event.deltaY > 0) {
        this.zoomOut(zoomCenter);
      } else {
        this.zoomIn(zoomCenter);
      }
    } else {
      // ctrl and mouse wheel
      if (d3.event.deltaY > 0) {
        this.scaleOut(zoomCenter);
      } else {
        this.scaleIn(zoomCenter);
      }
    }

    d3.event.preventDefault();
    d3.event.stopPropagation();
  }

  private onMouseDownZoom() {
    const d = d3.select(d3.event.srcElement);
    if (d.attr("id") !== "graphContainer") {
      return;
    }
    if (d3.event.buttons !== 2) {
      this.lastMouseEventTimeStamp = undefined;
      return;
    }

    const lastTimeStamp = this.lastMouseEventTimeStamp;
    this.lastMouseEventTimeStamp = d3.event.timeStamp;
    if (lastTimeStamp === undefined) {
      return;
    }
    const delta = this.lastMouseEventTimeStamp - lastTimeStamp;
    if (delta > 300) {
      return;
    }
    this.lastMouseEventTimeStamp = undefined;

    const zoomCenter: Vec2D = new Vec2D(
      d3.event.offsetX / this.viewboxProperties.origWidth,
      d3.event.offsetY / this.viewboxProperties.origHeight,
    );
    this.zoomOut(zoomCenter, 0.25);
    d3.event.preventDefault();
    d3.event.stopPropagation();
  }

  private onDblclick() {
    const d = d3.select(d3.event.srcElement);
    if (d.attr("id") !== "graphContainer") {
      return;
    }
    const zoomCenter: Vec2D = new Vec2D(
      d3.event.offsetX / this.viewboxProperties.origWidth,
      d3.event.offsetY / this.viewboxProperties.origHeight,
    );
    this.zoomIn(zoomCenter, 0.25);
    d3.event.preventDefault();
    d3.event.stopPropagation();
  }

  private updateZoomCenter(zoomCenter: Vec2D) {
    const oldZoomCenter = new Vec2D(
      this.viewboxProperties.panZoomLeft + zoomCenter.getX() * this.viewboxProperties.panZoomWidth,
      this.viewboxProperties.panZoomTop + zoomCenter.getY() * this.viewboxProperties.panZoomHeight,
    );

    const zoomFactor = 100.0 / this.viewboxProperties.zoomFactor;
    this.viewboxProperties.panZoomHeight = this.viewboxProperties.origHeight * zoomFactor;
    this.viewboxProperties.panZoomWidth = this.viewboxProperties.origWidth * zoomFactor;
    this.viewboxProperties.panZoomHeight = Math.max(this.viewboxProperties.panZoomHeight, 1);
    this.viewboxProperties.panZoomWidth = Math.max(this.viewboxProperties.panZoomWidth, 1);

    const newZoomCenter = new Vec2D(
      this.viewboxProperties.panZoomLeft + zoomCenter.getX() * this.viewboxProperties.panZoomWidth,
      this.viewboxProperties.panZoomTop + zoomCenter.getY() * this.viewboxProperties.panZoomHeight,
    );

    this.viewboxProperties.panZoomLeft -= newZoomCenter.getX() - oldZoomCenter.getX();
    this.viewboxProperties.panZoomTop -= newZoomCenter.getY() - oldZoomCenter.getY();
    this.setViewbox();
  }

  private panDrawingContext() {
    if (this.viewboxIsFixed) {
      return;
    }

    if (this.previousPanMousePosition !== null) {
      const delta: Vec2D = Vec2D.sub(this.previousPanMousePosition, this.getCurrentMousePosition());

      this.viewboxProperties.panZoomLeft += delta.getX();
      this.viewboxProperties.panZoomTop += delta.getY();
      this.temporaryDisableUndoServicePushCurrentVersion();
      this.setViewbox();
    }

    this.previousPanMousePosition = this.getCurrentMousePosition();
  }

  private makeViewboxString(): string {
    return (
      this.viewboxProperties.panZoomLeft +
      " " +
      this.viewboxProperties.panZoomTop +
      " " +
      this.viewboxProperties.panZoomWidth +
      " " +
      this.viewboxProperties.panZoomHeight
    );
  }

  private temporaryDisableUndoServicePushCurrentVersion() {
    // temporary disable undoService push current version
    if (this.undoService !== undefined) {
      this.undoService.setIgnoreNextPushCurrentVersionCall();
    }
  }
}
