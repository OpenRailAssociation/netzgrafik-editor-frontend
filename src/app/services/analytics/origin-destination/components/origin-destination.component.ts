import {OriginDestination, OriginDestinationService} from "./origin-destination.service";
import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from "@angular/core";
import * as d3 from "d3";

import {Subject, takeUntil} from "rxjs";
import {
  SVGMouseController,
  SVGMouseControllerObserver,
} from "src/app/view/util/svg.mouse.controller";
import {UiInteractionService, ViewboxProperties} from "src/app/services/ui/ui.interaction.service";
import {Vec2D} from "src/app/utils/vec2D";
import {UndoService} from "src/app/services/data/undo.service";

// Fields that can be used for the color scale and display text.
type FieldName = "totalCost" | "travelTime" | "transfers";
// Palettes that can be used for the color scale.
type ColorSetName = "red" | "blue" | "orange" | "gray";

/**
 * Component to display the origin-destination matrix.
 * Initialization (DOM scaffold, axes, controller) is separated
 * from updates (cell content, colors, text).
 * It also provides options to change the color scale and display field.
 * The component is initialized with data from the OriginDestinationService.
 */
@Component({
  selector: "sbb-origin-destination",
  templateUrl: "./origin-destination.component.html",
  styleUrls: ["./origin-destination.component.scss"],
})
export class OriginDestinationComponent implements OnInit, OnDestroy {
  @ViewChild("div") divRef: ElementRef;

  private readonly destroyed$ = new Subject<void>();

  constructor(
    private originDestinationService: OriginDestinationService,
    private uiInteractionService: UiInteractionService,
    private undoService: UndoService,
  ) {}

  private matrixData: OriginDestination[] = [];
  private nodeNames: {shortName: string; fullName: string}[] = [];

  private colorScale: d3.ScaleLinear<string, string>;
  private controller: SVGMouseController;

  // Field used for the color scale.
  colorBy: FieldName = "totalCost";
  // Field used to display the value in the cell.
  displayBy: FieldName = "totalCost";
  // Palette used for the color scale.
  colorSetName: ColorSetName = "red";

  private cellSize: number = 30;

  // avoid multiple dom access / creating (share)
  private tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;

  // cached selections for updates
  private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  private graphContentGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private xScale: d3.ScaleBand<string>;
  private yScale: d3.ScaleBand<string>;

  private extractNumericODValues(odList: OriginDestination[], field: FieldName): any {
    // This call avoids out-of-memory issue for very big netzgrafik.
    let minValue = undefined;
    let maxValue = undefined;
    odList
      .filter((od) => od["found"])
      .map((od) => {
        const v = od[field];
        if (minValue !== undefined) {
          if (v < minValue) {
            minValue = v;
          } else {
            if (v > maxValue) {
              maxValue = v;
            }
          }
        } else {
          minValue = v;
          maxValue = minValue;
        }
      });
    if (minValue === undefined) {
      return {
        minValue: 0,
        maxValue: 1,
      };
    }
    return {
      minValue: minValue,
      maxValue: maxValue,
    };
  }

  ngOnInit(): void {
    // create tooltip (only once)
    this.createTooltip();

    // compute matrix data (expensive) once
    this.matrixData = this.originDestinationService.originDestinationData();

    // Add diagonal entries so we can mouseover diagonal cells
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

    // compute nodes and nodeNames once
    const nodes = this.originDestinationService.getODOutputNodes();
    this.nodeNames = nodes.map((node) => ({
      shortName: node.getBetriebspunktName(),
      fullName: node.getFullName(),
    }));

    // initialize DOM scaffold, axes and controller (only once)
    this.initView();

    // initial population of cells (and color scale)
    this.updateView();

    // wire zoom observables
    this.uiInteractionService.zoomInObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe((zoomCenter: Vec2D) => this.controller.zoomIn(zoomCenter));

    this.uiInteractionService.zoomOutObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe((zoomCenter: Vec2D) => this.controller.zoomOut(zoomCenter));

    this.uiInteractionService.zoomResetObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe((zoomCenter: Vec2D) => this.controller.zoomReset(zoomCenter));
  }

  private createTooltip(): void {
    // Ensure we don't create multiple tooltips
    const root = d3.select("#main-origin-destination-container-root");
    const existing = root.select<HTMLDivElement>(".tooltip");
    if (!existing.empty()) {
      this.tooltip = existing as any;
      return;
    }

    this.tooltip = root
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("background-color", "white")
      .style("border", "solid")
      .style("border-width", "2px")
      .style("border-radius", "5px")
      .style("padding", "5px")
      .style("user-select", "none")
      .style("pointer-events", "none");
  }

  /**
   * initView
   * - creates svg, axes, scales, container group and mouse-controller
   * - does NOT create cells content (that is done by updateView)
   */
  private initView(): void {
    const width = this.cellSize * this.nodeNames.length;
    const height = this.cellSize * this.nodeNames.length;

    // remove existing svg if any (defensive)
    d3.select("#main-origin-destination-container").remove();

    this.svg = d3
      .select("#main-origin-destination-container-root")
      .append("svg")
      .classed("main-origin-destination-container", true)
      .attr("id", "main-origin-destination-container")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    const container = document.getElementById("main-origin-destination-container");
    const containerHeight = container ? container.clientHeight : window.innerHeight;
    const containerWidth = container ? container.clientWidth : window.innerWidth;
    const offsetX = Math.max(0, (containerWidth - width) / 2);
    const offsetY = Math.max(0, (containerHeight - height) / 2);

    this.graphContentGroup = this.svg
      .append("g")
      .attr("id", "zoom-group")
      .attr("transform", `translate(${offsetX}, ${offsetY})`);

    // Build X scales and axis:
    this.xScale = d3
      .scaleBand()
      .range([0, width])
      .domain(this.nodeNames.map((n) => n.shortName))
      .padding(0.05);

    this.graphContentGroup
      .append("g")
      .attr("id", "od-x-axis")
      .style("pointer-events", "none")
      .attr("transform", "translate(0, -20)")
      .call(d3.axisBottom(this.xScale).tickSize(0))
      .style("user-select", "none")
      .call((g) =>
        g
          .selectAll("text")
          .attr("data-origin-label", (d: string) => d)
          .style("text-anchor", "start")
          .attr("dx", "-0.8em")
          .attr("dy", "0.4em")
          .attr("transform", "rotate(-45)")
          .style("user-select", "none"),
      )
      .select(".domain")
      .remove();

    // Build Y scales and axis:
    this.yScale = d3
      .scaleBand()
      .range([height, 0])
      .domain(this.nodeNames.map((n) => n.shortName).reverse())
      .padding(0.05);

    this.graphContentGroup
      .append("g")
      .attr("id", "od-y-axis")
      .style("pointer-events", "none")
      .call(d3.axisLeft(this.yScale).tickSize(0))
      .style("user-select", "none")
      .call((g) => g.selectAll("text").attr("data-destination-label", (d: string) => d))
      .select(".domain")
      .remove();

    // create mouse controller (only once)
    this.controller = new SVGMouseController(
      "main-origin-destination-container",
      this.createSvgMouseControllerObserver(),
      this.undoService,
    );
    this.controller.init(this.createInitialViewboxProperties(this.nodeNames.length));
  }

  /**
   * updateView
   * - recomputes color scale based on current matrixData and colorBy
   * - creates/updates cells (enter/update/exit) and texts
   * - keeps axes and controller intact
   */
  private updateView(): void {
    if (!this.graphContentGroup) {
      return;
    }

    // compute color scale
    const numericValues = this.extractNumericODValues(this.matrixData, this.colorBy);
    this.colorScale = this.getColorScale(numericValues.minValue, numericValues.maxValue);

    // Prepare nodeNameMap and tooltip
    const nodeNameMap = new Map(this.nodeNames.map((n) => [n.shortName, n.fullName]));
    const tooltip = this.tooltip;

    const totalCostTranslation = $localize`:@@app.origin-destination.tooltip.total-cost:Total cost`;
    const transfersTranslation = $localize`:@@app.origin-destination.tooltip.transfers:Transfers`;
    const travelTimeTranslation = $localize`:@@app.origin-destination.tooltip.travel-time:Travel time`;

    // mouse handlers reference closure values
    const mouseover = function (d: OriginDestination) {
      if (d.found) {
        tooltip.style("opacity", 1);
        d3.select(this).style("stroke", "black").style("stroke-width", "2px").style("opacity", 1);
      }
      d3.selectAll(`[data-origin-label="${d.origin}"]`)
        .style("font-weight", "bold")
        .style("font-size", "12px");
      d3.selectAll(`[data-destination-label="${d.destination}"]`)
        .style("font-weight", "bold")
        .style("font-size", "12px");
    };

    const mousemove = function (d: OriginDestination) {
      let details = "";
      if (d.found) {
        details += "<br><hr> ";
        details += `${totalCostTranslation}: ${d.totalCost}<br>`;
        details += `${travelTimeTranslation}: ${d.travelTime}<br>`;
        details += `${transfersTranslation}: ${d.transfers}`;
      }
      tooltip
        .html(
          `${nodeNameMap.get(d.origin)} (<b>${d.origin}</b>) &#x2192;
        ${nodeNameMap.get(d.destination)} (<b>${d.destination}</b>)
        ${details}`,
        )
        .style("left", `${(d3.event as any).offsetX + 64}px`)
        .style(
          "top",
          `${(d3.event as any).offsetY + 64 < 0 ? 0 : (d3.event as any).offsetY + 64}px`,
        );
    };

    const mouseleave = function (_d: OriginDestination) {
      tooltip.style("opacity", 0);
      d3.select(this)
        .style("stroke", "none")
        .style("opacity", (d: OriginDestination) => (d.origin === d.destination ? 0 : 0.8));
      d3.selectAll(`[data-origin-label="${_d.origin}"]`)
        .style("font-weight", null)
        .style("font-size", null);
      d3.selectAll(`[data-destination-label="${_d.destination}"]`)
        .style("font-weight", null)
        .style("font-size", null);
    };

    // Build a color cache for performance
    const colorCache = new Map<string, string>();
    this.matrixData.forEach((d) => {
      const key = `${d.origin}-${d.destination}`;
      const value = this.getCellValue(d, this.colorBy);
      colorCache.set(key, value === undefined ? "#76767633" : this.colorScale(value));
    });

    // DATA JOIN for cells (group elements)
    const cells = this.graphContentGroup
      .selectAll<SVGGElement, OriginDestination>("g.cell")
      .data(this.matrixData, (d: any) => `${d.origin}-${d.destination}`);

    // EXIT
    cells.exit().remove();

    // ENTER
    const enterCells = cells
      .enter()
      .append("g")
      .classed("cell", true)
      .attr(
        "transform",
        (d) => `translate(${this.xScale(d.origin)}, ${this.yScale(d.destination)})`,
      );

    enterCells
      .append("rect")
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("width", this.xScale.bandwidth())
      .attr("height", this.yScale.bandwidth())
      .style("pointer-events", "auto")
      .on("mouseover", mouseover)
      .on("mousemove", mousemove)
      .on("mouseleave", mouseleave);

    enterCells
      .append("text")
      .attr("x", this.xScale.bandwidth() / 2)
      .attr("y", this.yScale.bandwidth() / 2)
      .style("text-anchor", "middle")
      .style("alignment-baseline", "middle")
      .style("font-size", "10px")
      .style("pointer-events", "none")
      .style("user-select", "none")
      .style("fill", "white");

    // UPDATE (both existing and newly entered)
    const merged = enterCells.merge(cells as any);

    merged.attr(
      "transform",
      (d) => `translate(${this.xScale(d.origin)}, ${this.yScale(d.destination)})`,
    );

    // Directly select rects and set fill from cache/scale
    merged
      .select("rect")
      .style("fill", (d: OriginDestination) => {
        const key = `${d.origin}-${d.destination}`;
        return colorCache.get(key) ?? "#76767633";
      })
      .style("stroke-width", 4)
      .style("stroke", "none")
      .style("opacity", (d: OriginDestination) => (d.origin === d.destination ? 0 : 0.8));

    // Update texts
    merged.select("text").text((d: OriginDestination) => this.getCellText(d));
  }

  private createSvgMouseControllerObserver(): SVGMouseControllerObserver {
    return {
      onEarlyReturnFromMousemove: () => false,
      onGraphContainerMouseup: () => {},
      zoomFactorChanged: (zoomFactor) => {
        this.uiInteractionService.zoomFactorChanged(zoomFactor);
      },
      onViewboxChanged: (viewboxProperties) => {
        const svg = d3.select("#main-origin-destination-container");
        svg.attr(
          "viewBox",
          `${viewboxProperties.panZoomLeft} ${viewboxProperties.panZoomTop} ${viewboxProperties.panZoomWidth} ${viewboxProperties.panZoomHeight}`,
        );
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
    const container = document.getElementById("main-origin-destination-container");
    const containerHeight = container ? container.clientHeight : window.innerHeight;
    const containerWidth = container ? container.clientWidth : window.innerWidth;
    const panZoomTop = Math.max(0, (containerHeight - matrixSize) / 2);
    const panZoomLeft = Math.max(0, (containerWidth - matrixSize) / 2);
    return {
      zoomFactor: 100,
      origWidth: matrixSize,
      origHeight: matrixSize,
      panZoomLeft: panZoomLeft,
      panZoomTop: panZoomTop,
      panZoomWidth: matrixSize,
      panZoomHeight: matrixSize,
      currentViewBox: null,
    };
  }

  private getCellValue(d: OriginDestination, field: FieldName): number | undefined {
    return d["found"] ? d[field] : undefined;
  }

  private getCellColor(d: OriginDestination): string {
    const value = this.getCellValue(d, this.colorBy);
    return value === undefined ? "#76767633" : this.colorScale(value);
  }

  private getCellText(d: OriginDestination): string {
    const value = this.getCellValue(d, this.displayBy);
    return value === undefined ? "" : value.toString();
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
    // optional cleanup
    d3.select("#main-origin-destination-container").remove();
    this.tooltip?.remove();
  }

  // Return the color scale based on the selected color set.
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

  // Update palette and refresh cells without full re-init.
  onChangePalette(name: ColorSetName) {
    this.colorSetName = name;
    this.updateView();
  }

  // Update color field and refresh cells without full re-init.
  onChangeColorBy(field: FieldName) {
    this.colorBy = field;
    this.updateView();
  }

  // Update display field and refresh cells without full re-init.
  onChangeDisplayBy(field: FieldName) {
    this.displayBy = field;
    this.updateView();
  }
}
