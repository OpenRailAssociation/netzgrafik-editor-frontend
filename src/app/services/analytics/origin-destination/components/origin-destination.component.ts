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
import {FilterService} from "../../../ui/filter.service";
import {NodeService} from "../../../data/node.service";

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
    private nodeService: NodeService,
  ) {}

  // Data
  private matrixData: OriginDestination[] = [];
  private nodeNames: {shortName: string; fullName: string; id: number}[] = [];

  // Controls
  colorBy: FieldName = "totalCost";
  displayBy: FieldName = "totalCost";
  colorSetName: ColorSetName = "red";

  // Rendering configuration
  private zoomFactor = 100; // logical zoom factor (100%)
  private cellSize = 1;
  private offsetX = 1;
  private offsetY = 1;
  private readonly cellSizeOrg = 64;
  private readonly offsetXOrg = 160;
  private readonly offsetYOrg = 160;

  // DOM & drawing
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null;
  private highlight: HTMLElement | null = null;
  private isCrossHighlighting = false;

  // Controller
  private controller!: SVGMouseController;
  private currentViewbox: ViewboxProperties | null = null;

  ngOnInit(): void {
    // create tooltip and highlight first so offsetParent is available
    this.createTooltipIfNeeded();
    this.createHighlightIfNeeded();

    // subscribe to observables (subscriptions do not reload data, only redraw)
    this.subscribeToObservables();

    // load data only once
    this.loadMatrixData();

    // create canvas & controller
    this.initViewbox();
    this.initCanvasView();

    // initial render exactly once at the end of initialization
    this.drawCanvasMatrix();
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();

    // remove handlers
    if (this.canvas) {
      this.canvas.removeEventListener("mousemove", this.handleCanvasMouseMoveBound);
      this.canvas.removeEventListener("mouseleave", this.handleCanvasMouseLeaveBound);
    }

    this.cleanupDom();
  }

  // -------------------------
  // Initialization helpers
  // -------------------------

  private initViewbox(): void {
    this.controller = new SVGMouseController(
      "main-origin-destination-container-root",
      this.createSvgMouseControllerObserver(),
      this.undoService,
    );
    this.controller.init(this.createInitialViewboxProperties(this.nodeNames.length));
  }

  private loadMatrixData(): void {
    // Load raw OD data and ensure diagonal entries exist (only once on init)
    const raw = this.originDestinationService.originDestinationData() ?? [];
    this.matrixData = raw.slice();

    // create diagonal entries for all involved node ids
    const idSet = new Set<number>();
    for (const od of this.matrixData) {
      idSet.add(od.originId);
      idSet.add(od.destinationId);
    }

    for (const nodeId of Array.from(idSet)) {
      // Ensures only missing diagonal elements are added
      const exists = this.matrixData.some(
        (d) => d.originId === nodeId && d.destinationId === nodeId,
      );
      if (!exists) {
        // only add the diagonal element if it not exists
        // it helps prevent future issues—such as if the calculation of
        // this.originDestinationService.originDestinationData()
        // changes and diagonal elements end up being sent as well.
        const node = this.nodeService.getNodeFromId(nodeId);
        this.matrixData.push({
          origin: node.getBetriebspunktName(),
          destination: node.getBetriebspunktName(),
          originId: nodeId,
          destinationId: nodeId,
          totalCost: undefined,
          travelTime: undefined,
          transfers: undefined,
          found: false,
        });
      }
    }

    // node names used for axes
    const nodes = this.originDestinationService.getODOutputNodes() ?? [];
    this.nodeNames = nodes.map((node: any) => ({
      shortName: node.getBetriebspunktName(),
      fullName: node.getFullName(),
      id: node.getId(),
    }));
  }

  private createTooltipIfNeeded(): void {
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
      .style("border", "solid 1px")
      .style("border-radius", "4px")
      .style("padding", "6px")
      .style("user-select", "none")
      .style("pointer-events", "none");
  }

  private createHighlightIfNeeded(): void {
    // create highlight element and append to same offsetParent as tooltip, or document.body fallback
    const tooltipNode = this.tooltip?.node() ?? null;
    const offsetParent = tooltipNode?.offsetParent as HTMLElement | null;
    const parent = offsetParent ?? document.body;

    if (!this.highlight) {
      const hp = document.createElement("div");
      hp.style.position = "absolute";
      hp.style.pointerEvents = "none";
      hp.style.border = "3px solid var(--NODE_TEXT_FOCUS)";
      hp.style.boxSizing = "border-box";
      hp.style.borderRadius = "6px";
      hp.style.background = "none";
      hp.style.display = "none";
      hp.style.opacity = "0";
      parent.appendChild(hp);
      this.highlight = hp;
    }
  }

  private initCanvasView(): void {
    // compute cell size based on zoom and node count (keeps consistent sizing)
    const zf = this.zoomFactor / (100.0 + 10.0 * Math.sqrt(Math.max(1, this.nodeNames.length)));
    this.cellSize = this.cellSizeOrg * zf;
    this.offsetX = this.offsetXOrg;
    this.offsetY = this.offsetYOrg;

    const width = Math.round(2 * this.offsetX + this.cellSize * Math.max(1, this.nodeNames.length));
    const height = Math.round(
      2 * this.offsetY + this.cellSize * Math.max(1, this.nodeNames.length),
    );

    // remove previous nodes
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

    // canvas element
    this.canvas = document.createElement("canvas");
    this.canvas.id = "main-origin-destination-canvas";
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.display = "block";
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.style.touchAction = "none";
    containerNode.appendChild(this.canvas);

    // attach stable bound handlers
    this.canvas.addEventListener("mousemove", this.handleCanvasMouseMoveBound);
    this.canvas.addEventListener("mouseleave", this.handleCanvasMouseLeaveBound);

    // create rendering context
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D context not available");
    this.ctx = ctx;
  }

  private subscribeToObservables(): void {
    // zoom commands: controller handles zooming; these do not reload data
    this.uiInteractionService.zoomInObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe((c: Vec2D) => {
        this.controller?.zoomIn(c);
      });
    this.uiInteractionService.zoomOutObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe((c: Vec2D) => {
        this.controller?.zoomOut(c);
      });
    this.uiInteractionService.zoomResetObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe((c: Vec2D) => {
        this.controller?.zoomReset(c);
      });

    // theme changes only trigger redraw
    this.uiInteractionService.themeChangedObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        this.drawCanvasMatrix();
      });

    // filter changes should only reload and redraw
    this.filterService.filter.pipe(takeUntil(this.destroyed$)).subscribe(() => {
      if (!this.ctx || !this.canvas) return;
      this.loadMatrixData();
      this.drawCanvasMatrix();
    });
  }

  private cleanupDom(): void {
    d3.select("#main-origin-destination-canvas").remove();
    this.tooltip?.remove();
    d3.select("#main-origin-destination-container").remove();
  }

  private drawMatrixCell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    color: string,
  ): void {
    ctx.beginPath();
    // rounded rectangle via arcTo
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  private drawCanvasMatrix(xIndex?: number, yIndex?: number): void {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const idNames = this.nodeNames.map((n) => n.id);
    const nameIndex = new Map<number, number>(idNames.map((id, i) => [id, i]));

    const numericValues = this.extractNumericODValues(this.matrixData, this.colorBy);
    const colorScaleAlphaCellColor = this.getColorScale(
      numericValues.minValue,
      numericValues.maxValue,
      "CC",
    );
    const colorScaleAlphaForeground = this.getColorScale(
      numericValues.minValue,
      numericValues.maxValue,
      "FF",
    );
    const colorScaleAlphaBackground = this.getColorScale(
      numericValues.minValue,
      numericValues.maxValue,
      "44",
    );

    for (let i = 0, len = this.matrixData.length; i < len; i++) {
      const d = this.matrixData[i];
      const ox = nameIndex.get(d.originId);
      const oy = nameIndex.get(d.destinationId);
      if (ox === undefined || oy === undefined) continue;

      const x = ox * this.cellSize + this.offsetX;
      const y = oy * this.cellSize + this.offsetY;
      const value = this.getCellValue(d, this.colorBy);
      let color = "#76767633"; // fallback translucent gray

      if (value !== undefined) {
        if (xIndex !== undefined || yIndex !== undefined) {
          color =
            ox === xIndex || oy === yIndex
              ? colorScaleAlphaForeground(value)
              : colorScaleAlphaBackground(value);
        } else {
          color = colorScaleAlphaCellColor(value);
        }
      }

      // small inset (1px) to provide crisp cell borders
      this.drawMatrixCell(
        ctx,
        Math.round(x) + 1,
        Math.round(y) + 1,
        Math.max(0, this.cellSize - 2),
        Math.max(0, this.cellSize - 2),
        4,
        color,
      );
    }

    if (this.zoomFactor > 50) {
      this.drawCellTexts();
    }

    this.drawXAxis(xIndex);
    this.drawYAxis(yIndex);
  }

  private drawCellTexts(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fontSize = Math.max(
      8,
      Math.floor(this.cellSize * 0.35 * Math.min(1.5, Math.sqrt(this.zoomFactor / 100.0))),
    );
    ctx.font = `${fontSize}px SBBWeb Roman`;

    const idNames = this.nodeNames.map((n) => n.id);
    const nameIndex = new Map<number, number>(idNames.map((id, i) => [id, i]));

    for (let i = 0, len = this.matrixData.length; i < len; i++) {
      const d = this.matrixData[i];
      const ox = nameIndex.get(d.originId);
      const oy = nameIndex.get(d.destinationId);
      if (ox === undefined || oy === undefined) continue;
      const cx = ox * this.cellSize + this.offsetX + this.cellSize / 2;
      const cy = oy * this.cellSize + this.offsetY + this.cellSize / 2;
      const text = this.getCellText(d);
      if (text) ctx.fillText(text, cx, cy);
    }
  }

  private drawYAxis(highlightIndex?: number): void {
    const colorRGB = this.uiInteractionService.getActiveTheme().isDark ? "255,255,255" : "0,0,0";

    this.ctx.textAlign = "right";
    this.ctx.textBaseline = "middle";

    for (let i = 0; i < this.nodeNames.length; i++) {
      const name = this.nodeNames[i].shortName;
      const y = this.offsetY + i * this.cellSize + this.cellSize / 2;
      if (highlightIndex !== i) {
        const alpha = highlightIndex === undefined ? 1.0 : 0.75;
        this.ctx.fillStyle = `rgba(${colorRGB},${alpha})`;
        this.ctx.font = `${Math.max(10, Math.floor((this.cellSize * 0.25 * this.zoomFactor) / 100.0))}px SBBWeb Roman`;
      } else {
        this.ctx.fillStyle = `rgba(${colorRGB},1)`;
        this.ctx.font = `bold ${Math.max(14, 4 + Math.floor((this.cellSize * 0.25 * this.zoomFactor) / 100.0))}px SBBWeb Roman`;
      }
      this.ctx.fillText(name, this.offsetX - 8, y);
    }
  }

  private drawXAxis(highlightIndex?: number): void {
    const colorRGB = this.uiInteractionService.getActiveTheme().isDark ? "255,255,255" : "0,0,0";

    this.ctx.textAlign = "left";
    this.ctx.textBaseline = "middle";

    for (let i = 0; i < this.nodeNames.length; i++) {
      const name = this.nodeNames[i].shortName;
      const x = this.offsetX + i * this.cellSize + this.cellSize / 2;
      this.ctx.save();
      this.ctx.translate(x, this.offsetY - 12);
      this.ctx.rotate(-Math.PI / 4);
      if (highlightIndex !== i) {
        const alpha = highlightIndex === undefined ? 1.0 : 0.75;
        this.ctx.fillStyle = `rgba(${colorRGB},${alpha})`;
        this.ctx.font = `${Math.max(10, Math.floor((this.cellSize * 0.25 * this.zoomFactor) / 100.0))}px SBBWeb Roman`;
      } else {
        this.ctx.fillStyle = `rgba(${colorRGB},1)`;
        this.ctx.font = `bold ${Math.max(14, 4 + Math.floor((this.cellSize * 0.25 * this.zoomFactor) / 100.0))}px SBBWeb Roman`;
      }
      this.ctx.fillText(name, 0, 0);
      this.ctx.restore();
    }
  }

  private handleCanvasMouseMove(e: MouseEvent): void {
    if (!this.canvas || !this.ctx || !this.tooltip) return;

    const rect = this.canvas.getBoundingClientRect();
    const zf = this.zoomFactor / 100.0;

    const xIndex = Math.floor(
      (e.clientX - rect.left) / zf / this.cellSize - this.offsetX / this.cellSize,
    );
    const yIndex = Math.floor(
      (e.clientY - rect.top) / zf / this.cellSize - this.offsetY / this.cellSize,
    );

    this.ctx.clearRect(0, 0, this.offsetXOrg, this.canvas.height);
    this.ctx.clearRect(0, 0, this.canvas.width, this.offsetYOrg);

    if (this.isCrossHighlighting) {
      this.drawCanvasMatrix(xIndex, yIndex);
    } else {
      this.drawXAxis(xIndex);
      this.drawYAxis(yIndex);
    }

    const origin = this.nodeNames[xIndex]?.shortName;
    const destination = this.nodeNames[yIndex]?.shortName;

    if (!origin || !destination) {
      this.hideTooltipAndHighlight();
      return;
    }

    const d = this.matrixData.find((m) => m.origin === origin && m.destination === destination);
    if (!d || !d.found) {
      this.hideTooltipAndHighlight();
      return;
    }

    this.showTooltipForCell(e, rect, xIndex, yIndex, d);
    this.showHighlightForCell(e, rect, xIndex, yIndex);
  }

  private hideTooltipAndHighlight(): void {
    this.tooltip?.style("opacity", 0);
    if (this.highlight) {
      this.highlight.style.display = "none";
    }
  }

  private showTooltipForCell(
    e: MouseEvent,
    rect: DOMRect,
    xIndex: number,
    yIndex: number,
    d: OriginDestination,
  ): void {
    const nodeNameMap = new Map(this.nodeNames.map((n) => [n.shortName, n.fullName]));
    const totalCostTranslation = $localize`:@@app.origin-destination.tooltip.total-cost:Total cost`;
    const transfersTranslation = $localize`:@@app.origin-destination.tooltip.transfers:Transfers`;
    const travelTimeTranslation = $localize`:@@app.origin-destination.tooltip.travel-time:Travel time`;

    const tooltipNode = this.tooltip!.node() as HTMLElement | null;
    const offsetParent = tooltipNode?.offsetParent as HTMLElement | null;

    let tooltipLeft: number;
    let tooltipTop: number;

    if (offsetParent) {
      const parentRect = offsetParent.getBoundingClientRect();
      tooltipLeft = e.clientX - parentRect.left + (this.cellSize * 0.75 * this.zoomFactor) / 100.0;
      tooltipTop = e.clientY - parentRect.top + (this.cellSize * 0.75 * this.zoomFactor) / 100.0;
    } else {
      tooltipLeft = e.pageX;
      tooltipTop = e.pageY;
    }

    this.tooltip!.style("opacity", 1)
      .style("left", `${Math.round(tooltipLeft)}px`)
      .style("top", `${Math.round(tooltipTop)}px`)
      .html(
        `${nodeNameMap.get(d.origin)} (<b>${d.origin}</b>) &#x2192; ${nodeNameMap.get(d.destination)} (<b>${d.destination}</b>)<br><hr>
      ${totalCostTranslation}: ${d.totalCost}<br>
      ${travelTimeTranslation}: ${d.travelTime}<br>
      ${transfersTranslation}: ${d.transfers}`,
      );
  }

  private showHighlightForCell(e: MouseEvent, rect: DOMRect, xIndex: number, yIndex: number): void {
    const tooltipNode = this.tooltip!.node() as HTMLElement | null;
    const offsetParent = tooltipNode?.offsetParent as HTMLElement | null;

    const cellLogicalX = this.offsetX + xIndex * this.cellSize;
    const cellLogicalY = this.offsetY + yIndex * this.cellSize;

    const cellScreenX = rect.left + (cellLogicalX * this.zoomFactor) / 100.0;
    const cellScreenY = rect.top + (cellLogicalY * this.zoomFactor) / 100.0;
    const cellScreenW = (this.cellSize * this.zoomFactor) / 100.0;
    const cellScreenH = (this.cellSize * this.zoomFactor) / 100.0;

    let highlightLeft: number;
    let highlightTop: number;
    if (offsetParent) {
      const parentRect = offsetParent.getBoundingClientRect();
      highlightLeft = cellScreenX - parentRect.left;
      highlightTop = cellScreenY - parentRect.top;
    } else {
      highlightLeft = cellScreenX + window.scrollX;
      highlightTop = cellScreenY + window.scrollY;
    }

    if (this.highlight) {
      this.highlight.style.opacity = "1";
      this.highlight.style.display = "block";
      this.highlight.style.left = `${Math.round(highlightLeft)}px`;
      this.highlight.style.top = `${Math.round(highlightTop)}px`;
      this.highlight.style.width = `${Math.round(cellScreenW)}px`;
      this.highlight.style.height = `${Math.round(cellScreenH)}px`;
    }
  }

  // Bound handlers so they can be removed reliably if needed
  private readonly handleCanvasMouseMoveBound = (e: MouseEvent) => this.handleCanvasMouseMove(e);
  private readonly handleCanvasMouseLeaveBound = (_e: MouseEvent) => {
    this.tooltip?.style("opacity", 0);
    if (this.highlight) {
      this.highlight.style.opacity = "0";
      this.highlight.style.display = "none";
    }

    this.ctx.clearRect(0, 0, this.offsetXOrg, this.canvas.height);
    this.ctx.clearRect(0, 0, this.canvas.width, this.offsetYOrg);

    if (this.isCrossHighlighting) {
      this.drawCanvasMatrix();
    } else {
      this.drawXAxis(undefined);
      this.drawYAxis(undefined);
    }
  };

  private extractNumericODValues(
    odList: OriginDestination[],
    field: FieldName,
  ): {minValue: number; maxValue: number} {
    let minValue: number | undefined;
    let maxValue: number | undefined;

    for (const od of odList) {
      if (!od.found) continue;
      const v = (od as any)[field];
      if (v === undefined || v === null) continue;
      if (minValue === undefined) {
        minValue = v;
        maxValue = v;
      } else {
        if (v < minValue) minValue = v;
        if (v > (maxValue as number)) maxValue = v;
      }
    }

    if (minValue === undefined || maxValue === undefined) {
      return {minValue: 0, maxValue: 1};
    }

    // ensure min != max for color interpolation
    if (minValue === maxValue) {
      return {minValue: minValue - 1, maxValue: maxValue + 1};
    }

    return {minValue: minValue, maxValue: maxValue};
  }

  private getCellValue(d: OriginDestination, field: FieldName): number | undefined {
    return d.found ? (d as any)[field] : undefined;
  }

  private getCellText(d: OriginDestination): string {
    const value = this.getCellValue(d, this.displayBy);
    return value === undefined ? "" : String(value);
  }

  getColorScale(min: number, max: number, alpha = "CC"): d3.ScaleLinear<string, string> {
    const d1 = min + (max - min) * 0.33;
    const d2 = min + (max - min) * 0.66;
    const addAlphaChannel = (arr: string[], a: string) => arr.map((v) => v + a);

    switch (this.colorSetName) {
      case "red":
        return d3
          .scaleLinear<string>()
          .domain([min, d1, d2, max])
          .range(addAlphaChannel(["#2166AC", "#67A9CF", "#FDAE61", "#B2182B"], alpha))
          .clamp(true);
      case "gray":
        return d3
          .scaleLinear<string>()
          .domain([min, d1, d2, max])
          .range(addAlphaChannel(["#CCCCCC", "#999999", "#666666", "#333333"], alpha))
          .clamp(true);
      case "blue":
        return d3
          .scaleLinear<string>()
          .domain([min, d1, d2, max])
          .range(addAlphaChannel(["#003366", "#00A3E0", "#FDAE61", "#E60000"], alpha))
          .clamp(true);
      case "orange":
        return d3
          .scaleLinear<string>()
          .domain([min, d1, d2, max])
          .range(addAlphaChannel(["#4CAF50", "#FFCA28", "#F57C00", "#C60018"], alpha))
          .clamp(true);
      default:
        return d3
          .scaleLinear<string>()
          .domain([min, d1, d2, max])
          .range(addAlphaChannel(["#003366", "#00A3E0", "#FDAE61", "#E60000"], alpha))
          .clamp(true);
    }
  }

  onChangePalette(name: ColorSetName): void {
    this.colorSetName = name;
    this.drawCanvasMatrix();
  }

  onChangeColorBy(field: FieldName): void {
    this.colorBy = field;
    this.drawCanvasMatrix();
  }

  onChangeDisplayBy(field: FieldName): void {
    this.displayBy = field;
    this.drawCanvasMatrix();
  }

  toggleCrossHighlighting(): void {
    this.isCrossHighlighting = !this.isCrossHighlighting;
    this.drawCanvasMatrix();
  }

  getCrossHighlightingTag(): string {
    return this.isCrossHighlighting ? "isCrossHighlighting" : "";
  }

  onResetButton(): void {
    this.initViewbox();
    this.colorBy = "totalCost";
    this.displayBy = "totalCost";
    this.colorSetName = "red";
    this.isCrossHighlighting = false;
    this.drawCanvasMatrix();
  }

  private createSvgMouseControllerObserver(): SVGMouseControllerObserver {
    return {
      onEarlyReturnFromMousemove: () => false,
      onGraphContainerMouseup: () => {},
      zoomFactorChanged: (zoomFactor: number) => {
        // zoomFactor comes as percentage from controller
        this.zoomFactor = zoomFactor;
        this.uiInteractionService.zoomFactorChanged(zoomFactor);
        this.drawCanvasMatrix();
        if (this.highlight) {
          this.highlight.style.opacity = "0";
        }
      },
      onViewboxChanged: (viewboxProperties: ViewboxProperties) => {
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
    const matrixSize = this.cellSize * Math.max(1, numberOfNodes);
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
