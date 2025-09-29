import * as d3 from "d3";
import {AfterViewInit, Component, Input, OnDestroy} from "@angular/core";
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

@Component({
  selector: "sbb-knoten-auslastung-view",
  templateUrl: "./knoten-auslastung-view.component.html",
  styleUrls: ["./knoten-auslastung-view.component.scss"],
})
export class KnotenAuslastungViewComponent implements AfterViewInit, OnDestroy {
  private svgDrawingContext: any;
  private knotenAuslastungDataPreparation: KnotenAuslastungDataPreparation;
  private destroyed = new Subject<void>();

  constructor(
    private uiInteractionService: UiInteractionService,
    private nodeService: NodeService,
    private resourceService: ResourceService,
    private trainrunSectionService: TrainrunSectionService,
    private trainrunService: TrainrunService,
  ) {
    this.knotenAuslastungDataPreparation = new KnotenAuslastungDataPreparation(
      trainrunService,
      resourceService,
      trainrunSectionService,
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
      .select("#knotenAuslastungContainer")
      .attr("oncontextmenu", "return false;");

    this.init();
  }

  init() {
    this.subscribeViewToServices();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  private subscribeViewToServices() {
    this.uiInteractionService.updateNodeStammdatenWindow
      .pipe(takeUntil(this.destroyed))
      .subscribe(() => {
        this.update();
      });
    this.nodeService.nodes.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.update();
    });
    this.trainrunService.trainruns.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.update();
    });
    this.trainrunSectionService.trainrunSections.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.update();
    });
    this.resourceService.resourceObservable.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.update();
    });
  }

  private update() {
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

    this.knotenAuslastungDataPreparation.computeAuslastungsMatrix(selectedNode);
    const nbrUsedOfTrackFound = this.knotenAuslastungDataPreparation.getNrUsedTrackFound();
    const nodeDatas = this.knotenAuslastungDataPreparation.getNodesData();
    const resourceDatas = this.knotenAuslastungDataPreparation.getResourcesData();

    const arc = d3
      .arc()
      .startAngle((d) => d.startAngle)
      .endAngle((d) => d.endAngle)
      .innerRadius(
        (d) =>
          ((1 + (d.innerRadius + 0.05)) / (2 + Math.max(nbrUsedOfTrackFound, 0))) * pixelRadius,
      )
      .outerRadius(
        (d) =>
          ((1 + (d.outerRadius + 0.95)) / (2 + Math.max(nbrUsedOfTrackFound, 0))) * pixelRadius,
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
      .on("mousedown", (d) =>
        this.trainrunService.setTrainrunAsSelected(d.trainrunSection.getTrainrunId()),
      )
      .append("title")
      .html((d) => d.tooltip);

    const groupText = rootDataGroup
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
      .on("mousedown", (d) =>
        this.trainrunService.setTrainrunAsSelected(d.trainrunSection.getTrainrunId()),
      )
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
              this.resourceService.getResource(selectedNode.getResourceId()).getCapacity(),
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
}
