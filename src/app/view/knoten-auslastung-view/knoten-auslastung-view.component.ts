import * as d3 from "d3";
import {AfterViewInit, Component, OnDestroy, ChangeDetectionStrategy} from "@angular/core";
import {NodeService} from "../../services/data/node.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {TrainrunService} from "../../services/data/trainrun.service";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {StaticDomTags} from "../editor-main-view/data-views/static.dom.tags";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Trainrun} from "../../models/trainrun.model";
import {ResourceService} from "../../services/data/resource.service";
import {KnotenAuslastungDataPreparation} from "./knoten.auslastung.data.preparation";
import {takeUntil} from "rxjs/operators";
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
export class KnotenAuslastungViewComponent implements AfterViewInit, OnDestroy {
  private svgDrawingContext: d3.Selection<SVGElement, undefined, Element, undefined>;
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

    if (selectedTrainrun !== null && selectedTrainrun.getId() === trainrunSection.getTrainrunId()) {
      classAttribute += " " + StaticDomTags.TAG_SELECTED;
    }
    if (
      KnotenAuslastungViewComponent.isMuted(trainrunSection, selectedTrainrun, connectedTrainIds)
    ) {
      classAttribute += " " + StaticDomTags.TAG_MUTED;
    }
    return classAttribute;
  }

  ngAfterViewInit(): void {
    this.svgDrawingContext = d3
      .select<SVGElement, undefined>("#knotenAuslastungContainer")
      .on("contextmenu", (event: MouseEvent) => {
        event.preventDefault();
      });

    this.init();
  }

  init() {
    this.subscribeViewToServices();
    this.update();
  }

  ngOnDestroy(): void {
    this.knotenAuslastungDataPreparation.destroy();
    this.destroyed.next();
    this.destroyed.complete();
  }

  private subscribeViewToServices() {
    this.uiInteractionService.updateNodeBaseDataWindow
      .pipe(takeUntil(this.destroyed))
      .subscribe(() => {
        this.update();
      });
    this.knotenAuslastungDataPreparation.updates.pipe(takeUntil(this.destroyed)).subscribe(() => {
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
    const selectedNode = this.nodeService.getSelectedNode();
    if (selectedNode === null || selectedNode === undefined) {
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
    const pixelRadius = (0.9 * Math.min(width, height)) / 2;

    if (recalculate) {
      this.knotenAuslastungDataPreparation.computeAuslastungsMatrix(selectedNode);
      this.showHourToggle = this.knotenAuslastungDataPreparation.hasDifferentHours();
      if (!this.showHourToggle) {
        this.oddHour = false;
      }
    }
    const projection = this.knotenAuslastungDataPreparation.getProjection(this.oddHour);
    const nbrUsedOfTrackFound = projection.usedTrackCount - 1;
    const nbrOfTrackFound = projection.trackCount - 1;
    const nodeDatas = projection.nodeDatas;
    const resourceDatas = projection.resourceDatas;

    const arc = d3
      .arc()
      .startAngle((d) => d.startAngle)
      .endAngle((d) => d.endAngle)
      .innerRadius(
        (d) =>
          ((1 + (d.innerRadius + 0.05)) / (2 + Math.max(nbrOfTrackFound, 0))) * pixelRadius,
      )
      .outerRadius(
        (d) =>
          ((1 + (d.outerRadius + 0.95)) / (2 + Math.max(nbrOfTrackFound, 0))) * pixelRadius,
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
          ),
      )
      .attr("d", arc)
      .on("mousedown", (_, d) =>
        this.selectTrainrun(d.trainrunSection.getTrainrunId()),
      )
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
}
