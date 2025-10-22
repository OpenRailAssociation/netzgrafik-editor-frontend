import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from "@angular/core";
import * as d3 from "d3";
import {Subject, takeUntil} from "rxjs";
import {OriginDestination, OriginDestinationService} from "./origin-destination.service";
import {
  SVGMouseController,
  SVGMouseControllerObserver,
} from "src/app/view/util/svg.mouse.controller";
import {UiInteractionService, ViewboxProperties} from "src/app/services/ui/ui.interaction.service";
import {Vec2D} from "src/app/utils/vec2D";
import {UndoService} from "src/app/services/data/undo.service";
import {ThemeBase} from "../../../../view/themes/theme-base";
import {FilterService} from "../../../ui/filter.service";

type FieldName = "totalCost" | "travelTime" | "transfers";
type ColorSetName = "red" | "blue" | "orange" | "gray";

@Component({
  selector: "sbb-origin-destination",
  templateUrl: "./origin-destination.component.html",
  styleUrls: ["./origin-destination.component.scss"],
})
export class OriginDestinationComponent implements OnInit, OnDestroy {
  @ViewChild("div") divRef!: ElementRef;

  private readonly destroyed$ = new Subject<void>();

  constructor(
    private originDestinationService: OriginDestinationService,
    private uiInteractionService: UiInteractionService,
    private undoService: UndoService,
    private filterService: FilterService,
  ) {}

  private matrixData: OriginDestination[] = [];
  private nodeNames: {shortName: string; fullName: string}[] = [];

  colorBy: FieldName = "totalCost";
  displayBy: FieldName = "totalCost";
  colorSetName: ColorSetName = "red";

  // rendering
  private zoomFactor = 1;
  private cellSize = 1;
  private offsetX = 1;
  private offsetY = 1;
  private cellSizeOrg = 64;
  private offsetXOrg = 160;
  private offsetYOrg = 160;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private tooltip!: any; // d3 Selection simplified to any to avoid signature issues
  private highlight: any;

  // controller
  private controller!: SVGMouseController;
  private currentViewbox: ViewboxProperties | null = null;

  ngOnInit(): void {
    // create the tooltip div which is use when mouse hovers over a cell
    this.createTooltip();

    // create the highlight div which is use when mouse hovers over a cell
    this.createHighlight();

    // load the data and create the rendering system (canvas)
    this.createAndRenderCanvas();

    // wire zoom observables (controller created in initCanvasView)
    this.uiInteractionService.zoomInObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe((zoomCenter: Vec2D) => this.controller?.zoomIn(zoomCenter));
    this.uiInteractionService.zoomOutObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe((zoomCenter: Vec2D) => this.controller?.zoomOut(zoomCenter));
    this.uiInteractionService.zoomResetObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe((zoomCenter: Vec2D) => this.controller?.zoomReset(zoomCenter));
    this.uiInteractionService.themeChangedObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => this.drawCanvasMatrix());
    this.filterService.filter
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => this.createAndRenderCanvas());
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
    try {
      d3.select("#main-origin-destination-canvas").remove();
      this.tooltip?.remove();
      d3.select("#main-origin-destination-container").remove();
    } catch {
      // ignore
    }
  }

  private createAndRenderCanvas() {
    // load the matrix data
    this.loadMatrixData();
    // initialize the canvas view
    this.initCanvasView();
    // render the data matrix with help of canvas
    this.drawCanvasMatrix();
    // create or update view box
    this.createOrUpdateViewbox();
  }

  private createOrUpdateViewbox() {
    // create controller (existing API)
    this.controller = new SVGMouseController(
      "main-origin-destination-container-root",
      this.createSvgMouseControllerObserver(),
      this.undoService,
    );
    this.controller.init(this.createInitialViewboxProperties(this.nodeNames.length));
  }

  private loadMatrixData() {
    // load data
    this.matrixData = this.originDestinationService.originDestinationData() ?? [];

    // add diagonal entries to ensure diagonal exists
    const origins = this.matrixData.map((d) => d.origin);
    const destinations = this.matrixData.map((d) => d.destination);
    const uniqueOriginsDestinations = [...new Set([...origins, ...destinations])];
    const diagonalData: OriginDestination[] = uniqueOriginsDestinations.map((name) => ({
      origin: name,
      destination: name,
      totalCost: undefined,
      travelTime: undefined,
      transfers: undefined,
      found: false,
    }));
    this.matrixData = [...this.matrixData, ...diagonalData];

    // node names
    const nodes = this.originDestinationService.getODOutputNodes() ?? [];
    this.nodeNames = nodes.map((node: any) => ({
      shortName: node.getBetriebspunktName(),
      fullName: node.getFullName(),
    }));
  }

  private createHighlight() {
    const tooltipNode = this.tooltip.node() as HTMLElement | null;
    const offsetParent = tooltipNode?.offsetParent as HTMLElement | null;

    // create a simple absolutely positioned div used as highlight
    const hp = document.createElement("div");
    hp.style.position = "absolute";
    hp.style.pointerEvents = "none";
    hp.style.border = "3px solid var(--NODE_TEXT_FOCUS)"; // blue border
    hp.style.boxSizing = "border-box";
    hp.style.borderRadius = "4px";
    hp.style.background = "none"; // subtle fill
    // append to same offsetParent as tooltip (or document.body if none)
    const parentToAppend = offsetParent ?? document.body;
    parentToAppend.appendChild(hp);
    this.highlight = hp;
  }

  private createTooltip(): void {
    const root = d3.select("#main-origin-destination-container-root");
    if (root.empty()) return;

    const existing = root.select(".tooltip");
    if (!existing.empty()) {
      this.tooltip = existing as any;
      return;
    }

    this.tooltip = root
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("border", "solid")
      .style("border-width", "1px")
      .style("border-radius", "4px")
      .style("padding", "6px")
      .style("user-select", "none")
      .style("pointer-events", "none");
  }

  private initCanvasView(): void {
    const zf = this.zoomFactor / (1 + 0.1 * Math.sqrt(this.nodeNames.length));
    this.cellSize = this.cellSizeOrg * zf;
    this.offsetX = this.offsetXOrg;
    this.offsetY = this.offsetYOrg;
    const width = this.offsetX + this.cellSize * Math.max(1, this.nodeNames.length);
    const height = this.offsetY + this.cellSize * Math.max(1, this.nodeNames.length);

    // cleanup
    d3.select("#main-origin-destination-canvas").remove();
    d3.select("#main-origin-destination-container").remove();

    const root = d3.select("#main-origin-destination-container-root");
    if (root.empty()) {
      throw new Error("Container root #main-origin-destination-container-root not found");
    }

    const containerNode = root
      .append("div")
      .attr("id", "main-origin-destination-container")
      .style("position", "relative")
      .node() as HTMLElement;

    this.canvas = document.createElement("canvas");
    this.canvas.id = "main-origin-destination-canvas";
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.display = "block";
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.style.touchAction = "none";
    containerNode.appendChild(this.canvas);

    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D context not available");
    this.ctx = ctx;

    // events
    this.canvas.addEventListener("mousemove", this.handleCanvasMouseMove.bind(this));
    this.canvas.addEventListener("mouseleave", () => {
      this.tooltip?.style("opacity", 0);
      if (this.highlight) {
        this.highlight.style.opacity = "0";
      }
    });
  }

  private makeCell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    color: string,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  private drawCanvasMatrix(): void {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const shortNames = this.nodeNames.map((n) => n.shortName);
    const nameIndex = new Map(shortNames.map((name, i) => [name, i]));

    const numericValues = this.extractNumericODValues(this.matrixData, this.colorBy);
    const colorScale = this.getColorScale(numericValues.minValue, numericValues.maxValue);

    for (let i = 0, len = this.matrixData.length; i < len; i++) {
      const d = this.matrixData[i];
      const ox = nameIndex.get(d.origin);
      const oy = nameIndex.get(d.destination);
      if (ox === undefined || oy === undefined) continue;
      const x = ox * this.cellSize + this.offsetX;
      const y = oy * this.cellSize + this.offsetY;
      const value = this.getCellValue(d, this.colorBy);
      const color = value === undefined ? "#76767633" : colorScale(value);

      this.makeCell(ctx, x + 1, y + 1, this.cellSize - 2, this.cellSize - 2, 2, color);
    }

    // optional cell text
    if (this.cellSize >= 8) {
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.max(8, Math.floor(this.cellSize * 0.35 * Math.min(1.5, Math.sqrt(this.zoomFactor))))}px SBBWeb Roman`;

      for (let i = 0, len = this.matrixData.length; i < len; i++) {
        const d = this.matrixData[i];
        const ox = nameIndex.get(d.origin);
        const oy = nameIndex.get(d.destination);
        if (ox === undefined || oy === undefined) continue;
        const cx = ox * this.cellSize + this.offsetX + this.cellSize / 2;
        const cy = oy * this.cellSize + this.offsetY + this.cellSize / 2;
        const text = this.getCellText(d);
        if (text) ctx.fillText(text, cx, cy);
      }
    }

    // Y axis labels (left)
    ctx.fillStyle = this.uiInteractionService.getActiveTheme().isDark ? "white" : "black";
    ctx.font = `${Math.max(10, Math.floor(this.cellSize * 0.25 * this.zoomFactor))}px SBBWeb Roman`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i < this.nodeNames.length; i++) {
      const name = this.nodeNames[i].shortName;
      const y = this.offsetY + i * this.cellSize + this.cellSize / 2;
      ctx.fillText(name, this.offsetX - 8, y);
    }

    // X axis labels (top, rotated)
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let i = 0; i < this.nodeNames.length; i++) {
      const name = this.nodeNames[i].shortName;
      const x = this.offsetX + i * this.cellSize + this.cellSize / 2;
      ctx.save();
      ctx.translate(x, this.offsetY - 12);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(name, 0, 0);
      ctx.restore();
    }
  }

  private handleCanvasMouseMove(e: MouseEvent): void {
    if (!this.canvas || !this.tooltip) return;

    const rect = this.canvas.getBoundingClientRect();
    const zf = this.zoomFactor;

    // logical indices (same logic you already use)
    const xIndex = Math.floor(
      (e.clientX - rect.left) / zf / this.cellSize - this.offsetX / this.cellSize,
    );
    const yIndex = Math.floor(
      (e.clientY - rect.top) / zf / this.cellSize - this.offsetY / this.cellSize,
    );

    const origin = this.nodeNames[xIndex]?.shortName;
    const destination = this.nodeNames[yIndex]?.shortName;
    if (!origin || !destination) {
      this.tooltip.style("opacity", 0);
      // hide highlight if exists
      if (this.highlight) this.highlight.style.display = "none";
      return;
    }

    const d = this.matrixData.find((m) => m.origin === origin && m.destination === destination);
    if (!d || !d.found) {
      this.tooltip.style("opacity", 0);
      if (this.highlight) this.highlight.style.display = "none";
      return;
    }

    const nodeNameMap = new Map(this.nodeNames.map((n) => [n.shortName, n.fullName]));
    const totalCostTranslation = $localize`:@@app.origin-destination.tooltip.total-cost:Total cost`;
    const transfersTranslation = $localize`:@@app.origin-destination.tooltip.transfers:Transfers`;
    const travelTimeTranslation = $localize`:@@app.origin-destination.tooltip.travel-time:Travel time`;

    // ---------- Tooltip: position exactly under pointer ----------
    // Tooltip is positioned in the same coordinate space as its offsetParent, so convert client -> parent coords
    const tooltipNode = this.tooltip.node() as HTMLElement | null;
    const offsetParent = tooltipNode?.offsetParent as HTMLElement | null;
    let tooltipLeft: number;
    let tooltipTop: number;
    let parentRect: DOMRect = undefined;
    if (offsetParent) {
      parentRect = offsetParent.getBoundingClientRect();
      tooltipLeft = e.clientX - parentRect.left + this.cellSize * 0.75 * zf;
      tooltipTop = e.clientY - parentRect.top + this.cellSize * 0.75 * zf;
    } else {
      tooltipLeft = e.pageX;
      tooltipTop = e.pageY;
    }

    // set tooltip (no additional offset so it's exactly under mouse; add small offset if you want)
    this.tooltip
      .style("opacity", 1)
      .style("left", `${tooltipLeft}px`)
      .style("top", `${tooltipTop}px`)
      .html(
        `${nodeNameMap.get(d.origin)} (<b>${d.origin}</b>) &#x2192; ${nodeNameMap.get(
          d.destination,
        )} (<b>${d.destination}</b>)<br><hr>
      ${totalCostTranslation}: ${d.totalCost}<br>
      ${travelTimeTranslation}: ${d.travelTime}<br>
      ${transfersTranslation}: ${d.transfers}`,
      );

    // ---------- Highlight: compute the hovered cell rectangle in screen (parent) coords ----------
    // Logical cell top-left in canvas-local coordinates
    const cellLogicalX = this.offsetX + xIndex * this.cellSize;
    const cellLogicalY = this.offsetY + yIndex * this.cellSize;

    // Convert to pixel coordinates on screen (canvas pixels after zoom) and then to offsetParent space
    const cellScreenX = rect.left + cellLogicalX * zf;
    const cellScreenY = rect.top + cellLogicalY * zf;
    const cellScreenW = this.cellSize * zf;
    const cellScreenH = this.cellSize * zf;

    let highlightLeft: number;
    let highlightTop: number;
    if (parentRect) {
      highlightLeft = cellScreenX - parentRect.left;
      highlightTop = cellScreenY - parentRect.top;
    } else {
      highlightLeft = cellScreenX + window.scrollX;
      highlightTop = cellScreenY + window.scrollY;
    }

    // Show and position highlight
    this.highlight.style.opacity = "1.0";
    this.highlight.style.display = "block";
    this.highlight.style.left = `${Math.round(highlightLeft)}px`;
    this.highlight.style.top = `${Math.round(highlightTop)}px`;
    this.highlight.style.width = `${Math.round(cellScreenW)}px`;
    this.highlight.style.height = `${Math.round(cellScreenH)}px`;
  }

  private extractNumericODValues(odList: OriginDestination[], field: FieldName): any {
    let minValue: number | undefined = undefined;
    let maxValue: number | undefined = undefined;
    odList
      .filter((od) => od["found"])
      .forEach((od) => {
        const v = od[field];
        if (v === undefined || v === null) return;
        if (minValue !== undefined) {
          if (v < minValue) minValue = v;
          if (v > maxValue!) maxValue = v;
        } else {
          minValue = v;
          maxValue = v;
        }
      });
    if (minValue === undefined) {
      return {minValue: 0, maxValue: 1};
    }
    return {minValue, maxValue: maxValue!};
  }

  private getCellValue(d: OriginDestination, field: FieldName): number | undefined {
    return d["found"] ? (d as any)[field] : undefined;
  }

  private getCellText(d: OriginDestination): string {
    const value = this.getCellValue(d, this.displayBy);
    return value === undefined ? "" : value.toString();
  }

  getColorScale(min: number, max: number): d3.ScaleLinear<string, string> {
    const d1 = min + (max - min) * 0.33;
    const d2 = min + (max - min) * 0.66;
    switch (this.colorSetName) {
      case "red":
        return d3
          .scaleLinear<string>()
          .domain([min, d1, d2, max])
          .range(["#2166AC", "#67A9CF", "#FDAE61", "#B2182B"])
          .clamp(true);
      case "gray":
        return d3
          .scaleLinear<string>()
          .domain([min, d1, d2, max])
          .range(["#CCCCCC", "#999999", "#666666", "#333333"])
          .clamp(true);
      case "blue":
        return d3
          .scaleLinear<string>()
          .domain([min, d1, d2, max])
          .range(["#003366", "#00A3E0", "#FDAE61", "#E60000"])
          .clamp(true);
      case "orange":
        return d3
          .scaleLinear<string>()
          .domain([min, d1, d2, max])
          .range(["#4CAF50", "#FFCA28", "#F57C00", "#C60018"])
          .clamp(true);
      default:
        return d3
          .scaleLinear<string>()
          .domain([min, d1, d2, max])
          .range(["#003366", "#00A3E0", "#FDAE61", "#E60000"])
          .clamp(true);
    }
  }

  onChangePalette(name: ColorSetName) {
    this.colorSetName = name;
    this.drawCanvasMatrix();
  }

  onChangeColorBy(field: FieldName) {
    this.colorBy = field;
    this.drawCanvasMatrix();
  }

  onChangeDisplayBy(field: FieldName) {
    this.displayBy = field;
    this.drawCanvasMatrix();
  }

  private createSvgMouseControllerObserver(): SVGMouseControllerObserver {
    return {
      onEarlyReturnFromMousemove: () => false,
      onGraphContainerMouseup: () => {},
      zoomFactorChanged: (zoomFactor) => {
        this.zoomFactor = zoomFactor / 100;
        this.uiInteractionService.zoomFactorChanged(zoomFactor);
        this.drawCanvasMatrix();
        if (this.highlight) {
          this.highlight.style.opacity = "0";
        }
        if (d3.event?.type === "wheel") {
          this.handleCanvasMouseMove(d3.event);
        }
      },
      onViewboxChanged: (viewboxProperties) => {
        this.currentViewbox = viewboxProperties;
        const scaleX = viewboxProperties.origWidth / viewboxProperties.panZoomWidth;
        const scaleY = viewboxProperties.origHeight / viewboxProperties.panZoomHeight;
        const scale = Math.min(scaleX, scaleY);
        const tx = -viewboxProperties.panZoomLeft * scale;
        const ty = -viewboxProperties.panZoomTop * scale;
        if (this.canvas) {
          this.canvas.style.transformOrigin = "0 0";
          this.canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
        }
      },
      onStartMultiSelect: () => {},
      updateMultiSelect: () => {},
      onEndMultiSelect: () => {},
      onScaleNetzgrafik: () => {},
      onCtrlKeyChanged: () => {},
    };
  }

  private createInitialViewboxProperties(numberOfNodes: number): ViewboxProperties {
    const matrixSize = this.cellSize * numberOfNodes;
    const container = document.getElementById("main-origin-destination-container-root");
    const containerHeight = container ? container.clientHeight : window.innerHeight;
    const containerWidth = container ? container.clientWidth : window.innerWidth;
    const panZoomTop = Math.max(0, (containerHeight - matrixSize) / 2);
    const panZoomLeft = Math.max(0, (containerWidth - matrixSize) / 2);
    return {
      zoomFactor: 100,
      origWidth: matrixSize,
      origHeight: matrixSize,
      panZoomLeft,
      panZoomTop,
      panZoomWidth: matrixSize,
      panZoomHeight: matrixSize,
      currentViewBox: null,
    };
  }
}
