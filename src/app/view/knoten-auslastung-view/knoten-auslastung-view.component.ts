import * as d3 from "d3";
import {
  AfterViewInit,
  Component,
  EventEmitter,
  OnDestroy,
  ChangeDetectionStrategy,
  ElementRef,
  Input,
  OnChanges,
  Output,
  ViewChild,
} from "@angular/core";
import {NodeService} from "../../services/data/node.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {TrainrunService} from "../../services/data/trainrun.service";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {StaticDomTags} from "../editor-main-view/data-views/static.dom.tags";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Trainrun} from "../../models/trainrun.model";
import {ResourceService} from "../../services/data/resource.service";
import {
  KnotenAuslastungDataPreparation,
  KnotenAuslastungSnapshot,
} from "./knoten.auslastung.data.preparation";
import {auditTime, takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {InfrastructureEstimatorService} from "../../services/infrastructure/infrastructure-estimator.service";
import {FilterService} from "../../services/ui/filter.service";
import {IsTrainrunSelectedService} from "../../services/data/is-trainrun-section.service";

@Component({
  selector: "sbb-knoten-auslastung-view",
  templateUrl: "./knoten-auslastung-view.component.html",
  styleUrls: ["./knoten-auslastung-view.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class KnotenAuslastungViewComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() snapshot: KnotenAuslastungSnapshot;
  @Input() highlightedTrainrunId: number | null = null;
  @Input() hasExternalLabel = false;
  @Output() trainrunHoverChange = new EventEmitter<number | null>();
  @ViewChild("knotenAuslastungContainer", {static: true})
  container: ElementRef<SVGElement>;
  private svgDrawingContext: d3.Selection<SVGElement, undefined, Element, undefined>;
  private resizeObserver: ResizeObserver;
  private intersectionObserver: IntersectionObserver;
  private isVisible = false;
  private hasProjection = false;
  private knotenAuslastungDataPreparation: KnotenAuslastungDataPreparation;
  private destroyed = new Subject<void>();
  public showHourToggle = false;
  public oddHour = false;

  constructor(
    private uiInteractionService: UiInteractionService,
    private nodeService: NodeService,
    private resourceService: ResourceService,
    trainrunSectionService: TrainrunSectionService,
    private trainrunService: TrainrunService,
    infrastructureEstimatorService: InfrastructureEstimatorService,
    filterService: FilterService,
    private isTrainrunSelectedService: IsTrainrunSelectedService,
  ) {
    this.knotenAuslastungDataPreparation = new KnotenAuslastungDataPreparation(
      trainrunService,
      resourceService,
      trainrunSectionService,
      infrastructureEstimatorService,
      filterService,
      nodeService,
    );
  }

  static isMuted(
    trainrunSection: TrainrunSection,
    selectedTrainrun: Trainrun,
    connectedTrainIds: number[],
  ): boolean {
    if (
      connectedTrainIds !== undefined &&
      connectedTrainIds.indexOf(trainrunSection.getTrainrunId()) !== -1
    ) {
      return false;
    }
    if (selectedTrainrun !== null) {
      if (trainrunSection.getTrainrunId() !== selectedTrainrun.getId()) {
        return true;
      }
    }
    return false;
  }

  static createTrainrunSectionFrequencyClassAttribute(
    trainrunSection: TrainrunSection,
    selectedTrainrun: Trainrun,
    connectedTrainIds: number[],
    highlightedTrainrunId: number | null = null,
  ): string {
    let classAttribute =
      StaticDomTags.makeClassTag(
        StaticDomTags.FREQ_LINE_PATTERN,
        trainrunSection.getFrequencyLinePatternRef(),
      ) +
      StaticDomTags.makeClassTag(
        StaticDomTags.TAG_COLOR_REF,
        trainrunSection.getTrainrun().getCategoryColorRef(),
      );

    const isHighlighted = highlightedTrainrunId !== null;
    if (
      !isHighlighted &&
      selectedTrainrun !== null &&
      selectedTrainrun.getId() === trainrunSection.getTrainrunId()
    ) {
      classAttribute += " " + StaticDomTags.TAG_SELECTED;
    }
    const isMuted = isHighlighted
      ? trainrunSection.getTrainrunId() !== highlightedTrainrunId
      : KnotenAuslastungViewComponent.isMuted(trainrunSection, selectedTrainrun, connectedTrainIds);
    if (isMuted) {
      classAttribute += " " + StaticDomTags.TAG_MUTED;
    }
    return classAttribute;
  }

  ngAfterViewInit(): void {
    this.svgDrawingContext = d3
      .select<SVGElement, undefined>(this.container.nativeElement)
      .on("contextmenu", (event: MouseEvent) => {
        event.preventDefault();
      });

    this.init();

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.isVisible) {
          this.update(false);
        }
      });
      this.resizeObserver.observe(this.container.nativeElement);
    }
    if (typeof IntersectionObserver !== "undefined") {
      this.intersectionObserver = new IntersectionObserver((entries) => {
        this.isVisible = entries.some((entry) => entry.isIntersecting);
        if (this.isVisible) {
          this.update(false);
        }
      });
      this.intersectionObserver.observe(this.container.nativeElement);
    } else {
      this.isVisible = true;
      this.update();
    }
  }

  ngOnChanges(): void {
    if (this.svgDrawingContext !== undefined) {
      this.update();
    }
  }

  init() {
    this.subscribeViewToServices();
    this.update();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.knotenAuslastungDataPreparation.destroy();
    this.destroyed.next();
    this.destroyed.complete();
  }

  private subscribeViewToServices() {
    this.uiInteractionService.updateNodeBaseDataWindow
      .pipe(takeUntil(this.destroyed))
      .subscribe(() => {
        this.update(false);
      });
    this.knotenAuslastungDataPreparation.updates
      .pipe(auditTime(16), takeUntil(this.destroyed))
      .subscribe(() => {
        this.update();
      });
    this.isTrainrunSelectedService
      .getTrainrunIdSelected()
      .pipe(takeUntil(this.destroyed))
      .subscribe(() => this.update(false));
    this.resourceService.resourceObservable.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.update();
    });
  }

  private update(recalculate = true) {
    const selectedNode = this.snapshot?.node ?? this.nodeService.getSelectedNode();
    if (selectedNode === null || selectedNode === undefined) {
      return;
    }
    if (!this.isVisible) {
      if (recalculate) {
        this.hasProjection = false;
      }
      return;
    }

    const selectedTrainrun = this.trainrunService.getSelectedTrainrun();
    let connectedTrainIds: number[] = [];
    if (selectedTrainrun !== null) {
      connectedTrainIds = this.trainrunService.getConnectedTrainrunIdsFirstOrder(
        selectedTrainrun.getId(),
      );
    }

    const element = this.svgDrawingContext.node();
    const rectHtml = element.getBoundingClientRect();
    const width = rectHtml.width;
    const height = rectHtml.height;
    if (width === 0 || height === 0) {
      this.hasProjection = false;
      return;
    }
    const pixelRadius = (0.9 * Math.min(width, height)) / 2;

    if (this.snapshot !== undefined) {
      this.showHourToggle = this.snapshot.hoursDiffer;
      if (!this.showHourToggle) {
        this.oddHour = false;
      }
    } else if (recalculate || !this.hasProjection) {
      this.knotenAuslastungDataPreparation.computeAuslastungsMatrix(selectedNode);
      this.hasProjection = true;
      this.showHourToggle = this.knotenAuslastungDataPreparation.hasDifferentHours();
      if (!this.showHourToggle) {
        this.oddHour = false;
      }
    }
    const projection =
      this.snapshot === undefined
        ? this.knotenAuslastungDataPreparation.getProjection(this.oddHour)
        : this.oddHour
          ? this.snapshot.oddHour
          : this.snapshot.evenHour;
    const nbrUsedOfTrackFound = projection.usedTrackCount - 1;
    const nbrOfTrackFound = projection.trackCount - 1;
    const nodeDatas = projection.nodeDatas;
    const resourceDatas = projection.resourceDatas;

    const arc = d3
      .arc()
      .startAngle((d) => d.startAngle)
      .endAngle((d) => d.endAngle)
      .innerRadius(
        (d) => ((1 + (d.innerRadius + 0.05)) / (2 + Math.max(nbrOfTrackFound, 0))) * pixelRadius,
      )
      .outerRadius(
        (d) => ((1 + (d.outerRadius + 0.95)) / (2 + Math.max(nbrOfTrackFound, 0))) * pixelRadius,
      );

    this.svgDrawingContext.selectAll("g.KnotenAuslastungResourceGroup").remove();
    const rootResourceGroup = this.svgDrawingContext
      .selectAll("g.KnotenAuslastungResourceGroup")
      .data(resourceDatas);
    rootResourceGroup
      .enter()
      .append(StaticDomTags.GROUP_SVG)
      .attr("class", "KnotenAuslastungResourceGroup")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
      .append("path")
      .attr("class", "KnotenAuslastungResourceGroup")
      .attr("d", arc)
      .classed("capacityLimitReached", (d) => d.capacityLimitReached);

    this.svgDrawingContext.selectAll(StaticDomTags.KNOTENAUSLASTUNG_DATA_GROUP_G).remove();
    const rootDataGroup = this.svgDrawingContext
      .selectAll(StaticDomTags.KNOTENAUSLASTUNG_DATA_GROUP_G)
      .data(nodeDatas);
    rootDataGroup
      .enter()
      .append(StaticDomTags.GROUP_SVG)
      .attr("class", StaticDomTags.KNOTENAUSLASTUNG_DATA_GROUP)
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
      .append("path")
      .attr(
        "class",
        (d) =>
          StaticDomTags.KNOTENAUSLASTUNG_DATA_GROUP +
          KnotenAuslastungViewComponent.createTrainrunSectionFrequencyClassAttribute(
            d.trainrunSection,
            selectedTrainrun,
            connectedTrainIds,
            this.highlightedTrainrunId,
          ),
      )
      .attr("d", arc)
      .on("mousedown", (_, d) => this.selectTrainrun(d.trainrunSection.getTrainrunId()))
      .on("mouseenter", (_, d) => this.trainrunHoverChange.emit(d.trainrunId))
      .on("mouseleave", (event) => this.clearTrainrunHover(event))
      .append("title")
      .html((d) => d.tooltip);

    this.svgDrawingContext.selectAll("g.KnotenAuslastungHeadwayGroup").remove();
    const headwayGroup = this.svgDrawingContext
      .selectAll("g.KnotenAuslastungHeadwayGroup")
      .data(nodeDatas.filter((data) => data.headwayEndAngle > data.headwayStartAngle));
    headwayGroup
      .enter()
      .append(StaticDomTags.GROUP_SVG)
      .attr("class", "KnotenAuslastungHeadwayGroup")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
      .append("path")
      .attr(
        "class",
        (d) =>
          StaticDomTags.KNOTENAUSLASTUNG_DATA_GROUP +
          " KnotenAuslastungHeadwayGroup " +
          KnotenAuslastungViewComponent.createTrainrunSectionFrequencyClassAttribute(
            d.trainrunSection,
            selectedTrainrun,
            connectedTrainIds,
            this.highlightedTrainrunId,
          ),
      )
      .style("opacity", 0.25)
      .attr("d", (d) =>
        arc({
          ...d,
          startAngle: d.headwayStartAngle,
          endAngle: d.headwayEndAngle,
        }),
      )
      .on("mousedown", (_, d) => this.selectTrainrun(d.trainrunSection.getTrainrunId()))
      .on("mouseenter", (_, d) => this.trainrunHoverChange.emit(d.trainrunId))
      .on("mouseleave", (event) => this.clearTrainrunHover(event))
      .append("title")
      .html((d) => d.tooltip);

    rootDataGroup
      .enter()
      .append(StaticDomTags.GROUP_SVG)
      .attr("class", StaticDomTags.KNOTENAUSLASTUNG_DATA_GROUP)
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
      .append("text")
      .attr(
        "class",
        (d) =>
          StaticDomTags.KNOTENAUSLASTUNG_DATA_GROUP +
          KnotenAuslastungViewComponent.createTrainrunSectionFrequencyClassAttribute(
            d.trainrunSection,
            selectedTrainrun,
            connectedTrainIds,
            this.highlightedTrainrunId,
          ),
      )
      .attr("transform", (d) => {
        const midAngle =
          d.endAngle < Math.PI
            ? d.startAngle / 2 + d.endAngle / 2
            : d.startAngle / 2 + d.endAngle / 2 + Math.PI;
        let angle = Math.round((midAngle * 180) / Math.PI) % 180;
        if (angle > 180) {
          angle += 180;
        }
        if (angle < -180) {
          angle += 180;
        }
        return (
          "translate(" +
          arc.centroid(d)[0] +
          "," +
          arc.centroid(d)[1] +
          ") rotate(-90) rotate(" +
          angle +
          ")"
        );
      })
      .attr("dy", ".35em")
      .attr("x", 0)
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .on("mousedown", (_, d) => this.selectTrainrun(d.trainrunSection.getTrainrunId()))
      .on("mouseenter", (_, d) => this.trainrunHoverChange.emit(d.trainrunId))
      .on("mouseleave", (event) => this.clearTrainrunHover(event))
      .append("title")
      .html((d) => d.name + "<br>" + d.tooltip);

    this.svgDrawingContext.selectAll("g.KnotenAuslastungNbrTrackGroup").remove();
    const nbrOfTrackGroup = this.svgDrawingContext
      .selectAll("g.KnotenAuslastungNbrTrackGroup")
      .data([nbrUsedOfTrackFound + 1]);
    nbrOfTrackGroup
      .enter()
      .append(StaticDomTags.GROUP_SVG)
      .attr("class", "KnotenAuslastungNbrTrackGroup")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
      .append("text")
      .attr("class", "KnotenAuslastungNbrTrackGroup")
      .attr("x", 0)
      .attr("y", 6)
      .attr("text-anchor", "middle")
      .html(
        (d) =>
          "" +
          Math.round(
            (100 * d) /
              this.resourceService.getResource(selectedNode.getResourceId())?.getCapacity(),
          ) +
          "%",
      );

    this.svgDrawingContext.selectAll("g.KnotenAuslastungTimeGroup").remove();
    const timeGroup = this.svgDrawingContext
      .selectAll("g.KnotenAuslastungTimeGroup")
      .data([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    timeGroup
      .enter()
      .append(StaticDomTags.GROUP_SVG)
      .attr("class", "KnotenAuslastungTimeGroup")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
      .append("text")
      .attr("class", "KnotenAuslastungTimeGroup")
      .attr("x", (d) => (pixelRadius / 0.95) * Math.sin(Math.PI - (d / 60) * 2.0 * Math.PI))
      .attr("y", (d) => 6 + (pixelRadius / 0.95) * Math.cos(Math.PI - (d / 60) * 2.0 * Math.PI))
      .attr("text-anchor", "middle")
      .text((d) => "" + d);

    this.svgDrawingContext.attr("viewBox", "0 -4 " + width + " " + (height + 8));
  }

  public onHourChanged(oddHour: boolean): void {
    this.oddHour = oddHour;
    this.update(false);
  }

  private selectTrainrun(trainrunId: number): void {
    this.trainrunService.setTrainrunAsSelected(trainrunId);
    this.isTrainrunSelectedService.setTrainrunIdSelectedByClick(trainrunId);
  }

  private clearTrainrunHover(event: MouseEvent): void {
    const relatedTarget = event.relatedTarget;
    if (
      relatedTarget instanceof Element &&
      relatedTarget.closest(".KnotenAuslastungDataGroup") !== null
    ) {
      return;
    }
    this.trainrunHoverChange.emit(null);
  }
}
