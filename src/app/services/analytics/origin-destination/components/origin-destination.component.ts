import {OriginDestination, OriginDestinationService} from "./origin-destination.service";
import {AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild} from "@angular/core";
import * as d3 from "d3";

import {Subject, takeUntil} from "rxjs";
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

/**
 * Component to display the origin-destination matrix.
 * It also provides options to change the color scale and display field.
 * The component is initialized with data from the OriginDestinationService.
 */
@Component({
  selector: "sbb-origin-destination",
  templateUrl: "./origin-destination.component.html",
  styleUrls: ["./origin-destination.component.scss"],
})
export class OriginDestinationComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild("div") divRef: ElementRef;

  private readonly destroyed$ = new Subject<void>();

  constructor(
    private originDestinationService: OriginDestinationService,
    private uiInteractionService: UiInteractionService,
    private undoService: UndoService,
    private filterService: FilterService,
    private nodeService: NodeService,
  ) {}

  private matrixData: OriginDestination[] = [];

  private colorScale: d3.ScaleLinear<string, string>;

  private controller: SVGMouseController;

  // Field used for the color scale.
  colorBy: FieldName = "totalCost";
  // Field used to display the value in the cell.
  displayBy: FieldName = "totalCost";
  // Palette used for the color scale.
  colorSetName: ColorSetName = "red";

  private cellSize: number = 30;

  private isReadyToRender = false;

  private extractNumericODValues(odList: OriginDestination[], field: FieldName): number[] {
    return odList.filter((od) => od["found"]).map((od) => od[field]);
  }

  private renderView() {
    if (!this.isReadyToRender) {
      return;
    }
    console.log("renderView");

    const nodes = this.originDestinationService.getODOutputNodes();
    const nodeNames = nodes.map((node) => ({
      shortName: node.getBetriebspunktName(),
      fullName: node.getFullName(),
      id: node.getId(),
    }));

    this.rendermatrixOD(nodeNames);

    this.controller = new SVGMouseController(
      "main-origin-destination-container",
      this.createSvgMouseControllerObserver(),
      this.undoService,
    );
    this.controller.init(this.createInitialViewboxProperties(nodeNames.length));
  }

  // Compute the matrix (expensive) and render the default view.
  ngOnInit(): void {
    this.uiInteractionService.zoomInObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe((zoomCenter: Vec2D) => this.controller.zoomIn(zoomCenter));

    this.uiInteractionService.zoomOutObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe((zoomCenter: Vec2D) => this.controller.zoomOut(zoomCenter));

    this.uiInteractionService.zoomResetObservable
      .pipe(takeUntil(this.destroyed$))
      .subscribe((zoomCenter: Vec2D) => this.controller.zoomReset(zoomCenter));

    // filter changes should only reload and redraw
    this.filterService.filter.pipe(takeUntil(this.destroyed$)).subscribe(() => {
      this.loadMatrixData();
      d3.select("#main-origin-destination-container").remove();
      this.renderView();
    });
  }

  ngAfterViewInit() {
    this.isReadyToRender = true;
    this.loadMatrixData();
    this.renderView();
  }

  private loadMatrixData(): void {
    if (!this.isReadyToRender) {
      return;
    }
    console.trace("loadMatrixData");
    // Load raw OD data and ensure diagonal entries exist (only once on init)
    this.matrixData = this.originDestinationService.originDestinationData();

    // Add some data so we can mouseover the diagonal cells.
    const origins = this.matrixData.map((d) => d.originId);
    const destinations = this.matrixData.map((d) => d.destinationId);
    const uniqueOriginsDestinations = [...new Set([...origins, ...destinations])];
    const diagonalData: OriginDestination[] = uniqueOriginsDestinations.map((nodeId) => ({
      origin: this.nodeService.getNodeFromId(nodeId).getBetriebspunktName(),
      destination: this.nodeService.getNodeFromId(nodeId).getBetriebspunktName(),
      originId: nodeId,
      destinationId: nodeId,
      totalCost: undefined,
      travelTime: undefined,
      transfers: undefined,
      found: false,
    }));
    this.matrixData = [...this.matrixData, ...diagonalData];
  }

  // Render the matrix with the given node names.
  rendermatrixOD(nodeNames: {shortName: string; fullName: string; id: number}[]) {
    const width = this.cellSize * nodeNames.length;
    const height = this.cellSize * nodeNames.length;
    // append the svg object to the body of the page
    const svg = d3
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

    const graphContentGroup = svg
      .append("g")
      .attr("id", "zoom-group")
      .attr("transform", `translate(${offsetX}, ${offsetY})`);

    // Build X scales and axis:
    const x = d3
      .scaleBand()
      .range([0, width])
      .domain(nodeNames.map((n) => n.id))

      .padding(0.05);

    graphContentGroup
      .append("g")
      .style("pointer-events", "none")
      .attr("transform", "translate(0, -20)")
      .call(
        d3
          .axisBottom(x)
          .tickSize(0)
          .tickFormat((d) => this.nodeService.getNodeFromId(d).getBetriebspunktName()),
      )
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
    const y = d3
      .scaleBand()
      .range([height, 0])
      .domain(nodeNames.map((n) => n.id).reverse())
      .padding(0.05);
    graphContentGroup
      .append("g")
      .style("pointer-events", "none")
      .call(
        d3
          .axisLeft(y)
          .tickSize(0)
          .tickFormat((d) => this.nodeService.getNodeFromId(d).getBetriebspunktName()),
      )
      .style("user-select", "none")
      .call((g) => g.selectAll("text").attr("data-destination-label", (d: string) => d))
      .select(".domain")
      .remove();

    const numericValues = this.extractNumericODValues(this.matrixData, this.colorBy);
    const maxValue = numericValues.length ? Math.max(...numericValues) : 1;
    const minValue = numericValues.length ? Math.min(...numericValues) : 0;
    this.colorScale = this.getColorScale(minValue, maxValue);

    // create a tooltip
    const tooltip = d3
      .select("#main-origin-destination-container-root")
      .append("div")
      .style("opacity", 0)
      .attr("class", "tooltip")
      .style("background-color", "white")
      .style("border", "solid")
      .style("border-width", "2px")
      .style("border-radius", "5px")
      .style("padding", "5px")
      .style("user-select", "none")
      .style("pointer-events", "none");

    // Three function that change the tooltip when user hover / move / leave a cell
    const mouseover = function (d: OriginDestination) {
      if (d.found) {
        tooltip.style("opacity", 1);
        d3.select(this).style("stroke", "black").style("stroke-width", "2px").style("opacity", 1);
      }

      // Highlight axis labels in bold when hovering over a cell
      d3.selectAll(`[data-origin-label="${d.originId}"]`)
        .style("font-weight", "bold")
        .style("font-size", "12px");
      d3.selectAll(`[data-destination-label="${d.destinationId}"]`)
        .style("font-weight", "bold")
        .style("font-size", "12px");
    };

    const totalCostTranslation = $localize`:@@app.origin-destination.tooltip.total-cost:Total cost`;
    const transfersTranslation = $localize`:@@app.origin-destination.tooltip.transfers:Transfers`;
    const travelTimeTranslation = $localize`:@@app.origin-destination.tooltip.travel-time:Travel time`;

    const nodeNameMap = new Map(nodeNames.map((n) => [n.id, n.fullName]));

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
          `${nodeNameMap.get(d.originId)} (<b>${d.origin}</b>) &#x2192;
          ${nodeNameMap.get(d.destinationId)} (<b>${d.destination}</b>)
          ${details}`,
        )
        .style("left", `${d3.event.offsetX + 64}px`)
        .style("top", `${d3.event.offsetY + 64 < 0 ? 0 : d3.event.offsetY + 64}px`);
    };

    const mouseleave = function (_d) {
      tooltip.style("opacity", 0);
      d3.select(this)
        .style("stroke", "none")
        .style("opacity", (d: OriginDestination) => (d.originId === d.destinationId ? 0 : 0.8));

      // Remove boldness from the axis labels
      d3.selectAll(`[data-origin-label="${_d.originId}"]`)
        .style("font-weight", null)
        .style("font-size", null);
      d3.selectAll(`[data-destination-label="${_d.destinationId}"]`)
        .style("font-weight", null)
        .style("font-size", null);
    };

    // add the squares
    graphContentGroup
      .selectAll()
      .data(this.matrixData)
      .enter()
      .append("rect")
      .attr("x", (d: OriginDestination) => {
        return x(d.originId);
      })
      .attr("y", function (d: OriginDestination) {
        return y(d.destinationId);
      })
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())

      .style("fill", (d: OriginDestination) => this.getCellColor(d))

      .style("stroke-width", 4)
      .style("stroke", "none")
      .style("opacity", (d: OriginDestination) => (d.originId === d.destinationId ? 0 : 0.8))
      .style("pointer-events", "auto")

      .on("mouseover", mouseover)
      .on("mousemove", mousemove)
      .on("mouseleave", mouseleave);

    graphContentGroup
      .selectAll()
      .data(this.matrixData)
      .enter()
      .append("text")
      .style("pointer-events", "none")
      .attr("x", (d: OriginDestination) => {
        return x(d.originId) + x.bandwidth() / 2;
      })
      .attr("y", function (d: OriginDestination) {
        return y(d.destinationId) + y.bandwidth() / 2;
      })
      .text((d: OriginDestination) => this.getCellText(d))
      .style("text-anchor", "middle")
      .style("alignment-baseline", "middle")
      .style("font-size", "10px")
      .style("pointer-events", "none")
      .style("user-select", "none")
      .style("fill", "white");
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

  // Update color set and re-render the view.
  onChangePalette(name: ColorSetName) {
    this.colorSetName = name;
    d3.select("#main-origin-destination-container").remove();
    this.renderView();
  }

  // Update color field and re-render the view.
  onChangeColorBy(field: FieldName) {
    this.colorBy = field;
    d3.select("#main-origin-destination-container").remove();
    this.renderView();
  }

  // Update display field and re-render the view.
  onChangeDisplayBy(field: FieldName) {
    // TODO: why is that needed?
    this.displayBy = field;
    d3.select("#main-origin-destination-container").remove();
    this.renderView();
  }
}
