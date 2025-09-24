import {parse, ParseResult} from "papaparse";
import {Component, ElementRef, ViewChild} from "@angular/core";
import * as svg from "save-svg-as-png";
import {DataService} from "../../services/data/data.service";
import {TrainrunService} from "../../services/data/trainrun.service";
import {NodeService} from "../../services/data/node.service";
import {FilterService} from "../../services/ui/filter.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {StammdatenService} from "../../services/data/stammdaten.service";
import {LogService} from "../../logger/log.service";
import {VersionControlService} from "../../services/data/version-control.service";
import {
  HaltezeitFachCategories,
  NetzgrafikDto,
  NodeDto,
  TrainrunCategoryHaltezeit,
  TrainrunSectionDto,
} from "../../data-structures/business.data.structures";
import {downloadBlob} from "../util/download-utils";
import {map} from "rxjs/operators";
import {LabelService} from "../../services/data/label.service";
import {NetzgrafikColoringService} from "../../services/data/netzgrafikColoring.service";
import {ViewportCullService} from "../../services/ui/viewport.cull.service";
import {LevelOfDetailService} from "../../services/ui/level.of.detail.service";
import {TrainrunSectionValidator} from "../../services/util/trainrunsection.validator";
import {OriginDestinationService} from "src/app/services/analytics/origin-destination/components/origin-destination.service";
import {EditorMode} from "../editor-menu/editor-mode";
import {NODE_TEXT_AREA_HEIGHT, RASTERING_BASIC_GRID_SIZE} from "../rastering/definitions";

interface ContainertoExportData {
  documentToExport: HTMLElement;
  exportParameter: any;
  essentialProps: string[];
}

@Component({
  selector: "sbb-editor-tools-view-component",
  templateUrl: "./editor-tools-view.component.html",
  styleUrls: ["./editor-tools-view.component.scss"],
})
export class EditorToolsViewComponent {
  @ViewChild("stammdatenFileInput", {static: false})
  stammdatenFileInput: ElementRef;
  @ViewChild("netgrafikJsonFileInput", {static: false})
  netgrafikJsonFileInput: ElementRef;

  public isDeletable$ = this.versionControlService.variant$.pipe(map((v) => v?.isDeletable));
  public isWritable$ = this.versionControlService.variant$.pipe(map((v) => v?.isWritable));

  constructor(
    private dataService: DataService,
    private trainrunService: TrainrunService,
    private nodeService: NodeService,
    public filterService: FilterService,
    private trainrunSectionService: TrainrunSectionService,
    private uiInteractionService: UiInteractionService,
    private stammdatenService: StammdatenService,
    private labelService: LabelService,
    private logger: LogService,
    private versionControlService: VersionControlService,
    private netzgrafikColoringService: NetzgrafikColoringService,
    private viewportCullService: ViewportCullService,
    private levelOfDetailService: LevelOfDetailService,
    private originDestinationService: OriginDestinationService,
  ) {}

  onLoadButton() {
    this.netgrafikJsonFileInput.nativeElement.click();
  }

  onLoad(param) {
    const file = param.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      let netzgrafikDto: any;
      try {
        netzgrafikDto = JSON.parse(reader.result.toString());
      } catch (err: any) {
        const msg = $localize`:@@app.view.editor-side-view.editor-tools-view-component.import-netzgrafik-error:JSON error`;
        this.logger.error(msg);
        return;
      }

      if (netzgrafikDto === undefined) {
        const msg = $localize`:@@app.view.editor-side-view.editor-tools-view-component.import-netzgrafik-error:JSON error`;
        this.logger.error(msg);
        return;
      }

      if (
        "nodes" in netzgrafikDto &&
        "trainrunSections" in netzgrafikDto &&
        "trainruns" in netzgrafikDto &&
        "resources" in netzgrafikDto &&
        "metadata" in netzgrafikDto
      ) {
        this.processNetzgrafikJSON(netzgrafikDto);
        return;
      }

      const msg = $localize`:@@app.view.editor-side-view.editor-tools-view-component.import-netzgrafik-error:JSON error`;
      this.logger.error(msg);
    };
    reader.readAsText(file);

    // set the event target value to null in order to be able to load the same file multiple times after one another
    param.target.value = null;
  }

  onSave() {
    const data: NetzgrafikDto = this.dataService.getNetzgrafikDto();
    const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
    downloadBlob(
      blob,
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.netzgrafikFile:netzgrafik` +
        ".json",
    );
  }

  onPrintContainer() {
    this.uiInteractionService.closeFilter();
    setTimeout(() => {
      this.uiInteractionService.print();
    }, 1500); // to allow cd-layout-filter to close
  }

  private prepareStyleForExport(containerInfo: ContainertoExportData) {
    const element2export = containerInfo.documentToExport;

    const elements = element2export.querySelectorAll("*");
    elements.forEach((el) => {
      const style = window.getComputedStyle(el);
      const essentialPropsArray =
        containerInfo.essentialProps !== undefined
          ? containerInfo.essentialProps
          : Array.from(style);
      const inlineStyle = essentialPropsArray
        .map((key) => `${key}:${style.getPropertyValue(key)};`)
        .join(" ");
      el.setAttribute("style", inlineStyle);
    });
  }

  onExportContainerAsSVG() {
    // option 2: save svg as svg
    // https://www.npmjs.com/package/save-svg-as-png
    this.levelOfDetailService.disableLevelOfDetailRendering();
    this.viewportCullService.onViewportChangeUpdateRendering(false);

    const containerInfo = this.getContainerToExport();
    this.prepareStyleForExport(containerInfo);

    svg.svgAsDataUri(containerInfo.documentToExport, containerInfo.exportParameter).then((uri) => {
      const a = document.createElement("a");
      document.body.appendChild(a);
      a.href = uri;
      a.download = this.getFilenameToExport() + ".svg";
      a.click();
      URL.revokeObjectURL(a.href);
      a.remove();
      this.levelOfDetailService.enableLevelOfDetailRendering();
    });
  }

  onExportContainerAsPNG() {
    // option 1: save svg as png
    // https://www.npmjs.com/package/save-svg-as-png
    this.levelOfDetailService.disableLevelOfDetailRendering();
    this.viewportCullService.onViewportChangeUpdateRendering(false);

    const containerInfo = this.getContainerToExport();
    this.prepareStyleForExport(containerInfo);

    svg.saveSvgAsPng(
      containerInfo.documentToExport,
      this.getFilenameToExport() + ".png",
      containerInfo.exportParameter,
    );

    this.levelOfDetailService.enableLevelOfDetailRendering();
  }

  onLoadStammdatenButton() {
    this.stammdatenFileInput.nativeElement.click();
  }

  onLoadStammdaten(param) {
    const file = param.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const finalResult: ParseResult = parse(reader.result.toString(), {
        header: true,
      });
      this.stammdatenService.setStammdaten(finalResult.data);
    };
    reader.readAsText(file);

    // set the event target value to null in order to be able to load the same file multiple times after one another
    param.target.value = null;
  }

  onExportStammdaten() {
    const filename =
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.baseDataFile:baseData` +
      ".csv";
    const csvData = this.convertToStammdatenCSV();
    this.onExport(filename, csvData);
  }

  onExportZuglauf() {
    const filename =
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.trainrunFile:trainrun` +
      ".csv";
    const csvData = this.convertToZuglaufCSV();
    this.onExport(filename, csvData);
  }

  onExportOriginDestination() {
    const filename =
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.originDestinationFile:originDestination` +
      ".csv";
    const csvData = this.convertToOriginDestinationCSV();
    this.onExport(filename, csvData);
  }

  onExport(filename: string, csvData: string) {
    const blob = new Blob([csvData], {
      type: "text/csv",
    });
    const url = window.URL.createObjectURL(blob);

    const nav = window.navigator as any;
    if (nav.msSaveOrOpenBlob) {
      nav.msSaveBlob(blob, filename);
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    window.URL.revokeObjectURL(url);
  }

  getVariantIsWritable() {
    return this.versionControlService.getVariantIsWritable();
  }

  getContainerName() {
    const editorMode = this.uiInteractionService.getEditorMode();
    switch (editorMode) {
      case EditorMode.StreckengrafikEditing:
        return $localize`:@@app.view.editor-side-view.editor-tools-view-component.spaceTimeChart:Space-time chart`;
      case EditorMode.OriginDestination:
        return $localize`:@@app.view.editor-side-view.editor-tools-view-component.originDestination:Origin-destination matrix`;
      default:
        return $localize`:@@app.view.editor-side-view.editor-tools-view-component.netzgrafik:Netzgrafik`;
    }
  }

  private buildCSVString(headers: string[], rows: string[][]): string {
    const separator = ";";

    const contentData: string[] = [];
    contentData.push(headers.join(separator));
    rows.forEach((row) => {
      contentData.push(row.join(separator));
    });
    return contentData.join("\n");
  }

  private convertToStammdatenCSV(): string {
    const comma = ",";

    const headers: string[] = [];
    headers.push($localize`:@@app.view.editor-side-view.editor-tools-view-component.bp:BP`);
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.station:Station`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.category:category`,
    );
    headers.push($localize`:@@app.view.editor-side-view.editor-tools-view-component.region:Region`);
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.passengerConnectionTimeIPV:passengerConnectionTimeIPV`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.passengerConnectionTimeA:Passenger_connection_time_A`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.passengerConnectionTimeB:Passenger_connection_time_B`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.passengerConnectionTimeC:Passenger_connection_time_C`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.passengerConnectionTimeD:Passenger_connection_time_D`,
    );
    headers.push($localize`:@@app.view.editor-side-view.editor-tools-view-component.ZAZ:ZAZ`);
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.transferTime:Transfer_time`,
    );
    headers.push($localize`:@@app.view.editor-side-view.editor-tools-view-component.labels:Labels`);
    headers.push($localize`:@@app.view.editor-side-view.editor-tools-view-component.X:X`);
    headers.push($localize`:@@app.view.editor-side-view.editor-tools-view-component.Y:Y`);
    headers.push($localize`:@@app.view.editor-side-view.editor-tools-view-component.create:Create`);

    const rows: string[][] = [];
    this.nodeService.getNodes().forEach((nodeElement) => {
      const trainrunCategoryHaltezeit: TrainrunCategoryHaltezeit =
        nodeElement.getTrainrunCategoryHaltezeit();
      const stammdaten = this.stammdatenService.getBPStammdaten(nodeElement.getBetriebspunktName());
      const zaz = stammdaten !== null ? stammdaten.getZAZ() : 0;
      const erstellen = stammdaten !== null ? stammdaten.getErstellen() : "JA";
      const kategorien = stammdaten !== null ? stammdaten.getKategorien() : [];
      const regions = stammdaten !== null ? stammdaten.getRegions() : [];

      const row: string[] = [];
      row.push(nodeElement.getBetriebspunktName());
      row.push(nodeElement.getFullName());
      row.push(kategorien.map((kat) => "" + kat).join(comma));
      row.push(regions.map((reg) => "" + reg).join(comma));
      row.push(
        "" +
          (trainrunCategoryHaltezeit[HaltezeitFachCategories.IPV].no_halt
            ? 0
            : trainrunCategoryHaltezeit[HaltezeitFachCategories.IPV].haltezeit - zaz),
      );
      row.push(
        "" +
          (trainrunCategoryHaltezeit[HaltezeitFachCategories.A].no_halt
            ? 0
            : trainrunCategoryHaltezeit[HaltezeitFachCategories.A].haltezeit - zaz),
      );
      row.push(
        "" +
          (trainrunCategoryHaltezeit[HaltezeitFachCategories.B].no_halt
            ? 0
            : trainrunCategoryHaltezeit[HaltezeitFachCategories.B].haltezeit - zaz),
      );
      row.push(
        "" +
          (trainrunCategoryHaltezeit[HaltezeitFachCategories.C].no_halt
            ? 0
            : trainrunCategoryHaltezeit[HaltezeitFachCategories.C].haltezeit - zaz),
      );
      row.push(
        "" +
          (trainrunCategoryHaltezeit[HaltezeitFachCategories.D].no_halt
            ? 0
            : trainrunCategoryHaltezeit[HaltezeitFachCategories.D].haltezeit - zaz),
      );
      row.push("" + zaz);
      row.push("" + nodeElement.getConnectionTime());
      row.push(
        nodeElement
          .getLabelIds()
          .map((labelID) => {
            const labelOfInterest = this.labelService.getLabelFromId(labelID);
            if (labelOfInterest !== undefined) {
              return labelOfInterest.getLabel();
            }
            return "";
          })
          .join(comma),
      );
      row.push("" + nodeElement.getPositionX());
      row.push("" + nodeElement.getPositionY());
      row.push(erstellen);
      rows.push(row);
    });
    return this.buildCSVString(headers, rows);
  }

  private getStreckengrafikEditingContainerToExport(): ContainertoExportData {
    const htmlElementToExport = document.getElementById("main-streckengrafik-container");
    const param = {
      encoderOptions: 1.0,
      scale: 1.0,
      left: 0,
      top: 0,
      width: htmlElementToExport.offsetWidth,
      height: htmlElementToExport.offsetHeight,
      backgroundColor: this.uiInteractionService.getActiveTheme().backgroundColor,
    };

    return {
      documentToExport: htmlElementToExport,
      exportParameter: param,
      essentialProps: undefined,
    };
  }

  private getOriginDestinationContainerToExport(): ContainertoExportData {
    const htmlElementToExport = document.getElementById("main-origin-destination-container");
    if (htmlElementToExport === null) {
      return undefined;
    }
    const bbox = (htmlElementToExport as unknown as SVGGElement).getBBox();
    const padding = 10;
    const param = {
      encoderOptions: 1.0,
      scale: 1.0,
      left: bbox.x - padding,
      top: bbox.y - padding,
      width: bbox.width + 2 * padding,
      height: bbox.height + 2 * padding,
      backgroundColor: this.uiInteractionService.getActiveTheme().backgroundColor,
    };

    const essentialProps = [
      "fill",
      "stroke",
      "stroke-width",
      "stroke-dasharray",
      "font-family",
      "font-size",
      "font-weight",
      "opacity",
      "text-anchor",
      "dominant-baseline",
    ];

    return {
      documentToExport: htmlElementToExport,
      exportParameter: param,
      essentialProps: essentialProps,
    };
  }

  private getNetzgrafikEditingContainerToExport(): ContainertoExportData {
    const htmlElementToExport = document.getElementById("graphContainer");
    if (htmlElementToExport === null) {
      return undefined;
    }
    const boundingBox = this.nodeService.getNetzgrafikBoundingBox();
    const param = {
      encoderOptions: 1.0,
      scale: 2.0,
      left: boundingBox.minCoordX - 2.0 * RASTERING_BASIC_GRID_SIZE,
      top: boundingBox.minCoordY - 2.0 * RASTERING_BASIC_GRID_SIZE,
      width: boundingBox.maxCoordX - boundingBox.minCoordX + 4.0 * RASTERING_BASIC_GRID_SIZE,
      height:
        boundingBox.maxCoordY -
        boundingBox.minCoordY +
        4.0 * RASTERING_BASIC_GRID_SIZE +
        NODE_TEXT_AREA_HEIGHT,
      backgroundColor: this.uiInteractionService.getActiveTheme().backgroundColor,
    };

    const essentialProps = [
      "fill",
      "stroke",
      "stroke-width",
      "stroke-dasharray",
      "font-family",
      "font-size",
      "font-weight",
      "opacity",
      "text-anchor",
      "dominant-baseline",
    ];

    return {
      documentToExport: htmlElementToExport,
      exportParameter: param,
      essentialProps: essentialProps,
    };
  }

  private getContainerToExport(): ContainertoExportData {
    const editorMode = this.uiInteractionService.getEditorMode();
    switch (editorMode) {
      case EditorMode.StreckengrafikEditing:
        return this.getStreckengrafikEditingContainerToExport();
      case EditorMode.OriginDestination:
        return this.getOriginDestinationContainerToExport();
      default:
        return this.getNetzgrafikEditingContainerToExport();
    }
  }

  private convertToZuglaufCSV(): string {
    const comma = ",";
    const headers: string[] = [];
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.trainCategory:Train category`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.trainName:Train name`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.startStation:Start station`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.destinationStation:Destination station`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.trafficPeriod:Traffic period`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.frequence:Frequence`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.departureMinuteAtStart:Minute of departure at start node`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.travelTimeStartDestination:Travel time start-destination`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.arrivalMinuteAtDestination:Arrival minute at destination node`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.turnaroundTimeDestination:Turnaround time at destination station`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.departureMinuteDeparture:Departure minute at destination node`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.travelTimeDestinationStart:Travel time destination-start`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.arrivalMinuteAtStart:Arrival minute at start node`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.turnaroundTimeStart:Turnaround time at start station`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.turnaroundTime:Turnaround time`,
    );
    headers.push($localize`:@@app.view.editor-side-view.editor-tools-view-component.labels:Labels`);

    const rows: string[][] = [];
    this.trainrunService
      .getTrainruns()
      .filter((trainrun) => this.filterService.filterTrainrun(trainrun))
      .forEach((trainrun) => {
        let startBetriebspunktName = "";
        let endBetriebspunktName = "";

        // Retrieve start -> end with:
        // start {startNode, startTrainrunSection}
        // end {iterator.current.node, iterator.current.trainrunSection}
        const startNode = this.trainrunService.getStartNodeWithTrainrunId(trainrun.getId());
        const startTrainrunSection = startNode.getStartTrainrunSection(trainrun.getId());
        const iterator = this.trainrunService.getIterator(startNode, startTrainrunSection);
        while (iterator.hasNext()) {
          iterator.next();
        }

        startBetriebspunktName = startNode.getBetriebspunktName();
        endBetriebspunktName = iterator.current().node.getBetriebspunktName();
        const departureTimeAtStart =
          startTrainrunSection.getSourceNodeId() === startNode.getId()
            ? startTrainrunSection.getSourceDepartureConsecutiveTime()
            : startTrainrunSection.getTargetDepartureConsecutiveTime();
        const arrivalTimeAtEnd =
          iterator.current().trainrunSection.getSourceNodeId() === iterator.current().node.getId()
            ? iterator.current().trainrunSection.getSourceArrivalConsecutiveTime()
            : iterator.current().trainrunSection.getTargetArrivalConsecutiveTime();
        const travelTime = arrivalTimeAtEnd - departureTimeAtStart;

        const startNodeDeparture =
          startTrainrunSection.getSourceNodeId() === startNode.getId()
            ? startTrainrunSection.getSourceDeparture()
            : startTrainrunSection.getTargetDeparture();
        const endNodeArrival =
          iterator.current().trainrunSection.getSourceNodeId() === iterator.current().node.getId()
            ? iterator.current().trainrunSection.getSourceArrival()
            : iterator.current().trainrunSection.getTargetArrival();

        const endNodeDeparture =
          iterator.current().trainrunSection.getSourceNodeId() === iterator.current().node.getId()
            ? iterator.current().trainrunSection.getSourceDeparture()
            : iterator.current().trainrunSection.getTargetDeparture();
        const startNodeArrival =
          startTrainrunSection.getSourceNodeId() === startNode.getId()
            ? startTrainrunSection.getSourceArrival()
            : startTrainrunSection.getTargetArrival();

        let waitingTimeOnStartStation = startNodeDeparture - startNodeArrival;
        let waitingTimeOnEndStation = endNodeDeparture - endNodeArrival;

        if (trainrun.getFrequency() > 60) {
          // special case - if the freq is bigger than 60min (1h) - then just mirror
          waitingTimeOnStartStation = 2.0 * (trainrun.getFrequency() / 2.0 - startNodeArrival);
          waitingTimeOnEndStation = 2.0 * (trainrun.getFrequency() / 2.0 - endNodeArrival);
        } else {
          // find next freq (departing)
          while (waitingTimeOnStartStation < 0) {
            waitingTimeOnStartStation += trainrun.getFrequency();
          }
          while (waitingTimeOnEndStation < 0) {
            waitingTimeOnEndStation += trainrun.getFrequency();
          }
        }

        if (trainrun.getFrequency() < 60) {
          waitingTimeOnEndStation = waitingTimeOnEndStation % trainrun.getFrequency();
          waitingTimeOnStartStation = waitingTimeOnStartStation % trainrun.getFrequency();
        }

        const timeOfCirculation =
          travelTime + waitingTimeOnEndStation + travelTime + waitingTimeOnStartStation;
        const row: string[] = [];
        row.push(trainrun.getTrainrunCategory().shortName.trim());
        row.push(trainrun.getTitle().trim());
        row.push(startBetriebspunktName.trim());
        row.push(endBetriebspunktName.trim());
        row.push("Verkehrt: " + trainrun.getTrainrunTimeCategory().shortName.trim());
        row.push("" + trainrun.getTrainrunFrequency().shortName.trim());
        row.push("" + startNodeDeparture);
        row.push("" + travelTime);
        row.push("" + endNodeArrival);
        row.push("" + waitingTimeOnEndStation);
        row.push("" + endNodeDeparture);
        row.push("" + travelTime);
        row.push("" + startNodeArrival);
        row.push("" + waitingTimeOnStartStation);
        row.push("" + timeOfCirculation);
        row.push(
          trainrun
            .getLabelIds()
            .map((labelID) => {
              const label = this.labelService.getLabelFromId(labelID);
              if (label) {
                return label.getLabel().trim();
              }
              return "";
            })
            .join(comma),
        );

        rows.push(row);
      });
    return this.buildCSVString(headers, rows);
  }

  private convertToOriginDestinationCSV(): string {
    const headers: string[] = [];
    headers.push($localize`:@@app.view.editor-side-view.editor-tools-view-component.origin:Origin`);
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.destination:Destination`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.travelTime:Travel time`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.transfers:Transfers`,
    );
    headers.push(
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.totalCost:Total cost`,
    );

    const matrixData = this.originDestinationService.originDestinationData();

    const rows = [];
    matrixData.forEach((d) => {
      if (!d.found) {
        rows.push([d.origin, d.destination, "", "", ""]);
        return;
      }
      const row = [
        d.origin,
        d.destination,
        d.travelTime.toString(),
        d.transfers.toString(),
        d.totalCost.toString(),
      ];
      rows.push(row);
    });

    return this.buildCSVString(headers, rows);
  }

  private detectNetzgrafikJSON3rdParty(netzgrafikDto: NetzgrafikDto): boolean {
    return (
      netzgrafikDto.nodes.find((n: NodeDto) => n.ports === undefined) !== undefined ||
      netzgrafikDto.nodes.filter((n: NodeDto) => n.ports?.length === 0).length ===
        netzgrafikDto.nodes.length ||
      netzgrafikDto.trainrunSections.find(
        (ts: TrainrunSectionDto) =>
          ts.path === undefined || ts.path?.path === undefined || ts.path?.path?.length === 0,
      ) !== undefined
    );
  }

  private processNetzgrafikJSON3rdParty(netzgrafikDto: NetzgrafikDto) {
    // --------------------------------------------------------------------------------
    // 3rd party generated JSON detected
    // --------------------------------------------------------------------------------
    const msg = $localize`:@@app.view.editor-side-view.editor-tools-view-component.import-netzgrafik-as-json-info-3rd-party:3rd party import`;
    this.logger.info(msg);

    // --------------------------------------------------------------------------------
    // (Step 1) Import only nodes
    const netzgrafikOnlyNodeDto: NetzgrafikDto = Object.assign({}, netzgrafikDto);
    netzgrafikOnlyNodeDto.trainruns = [];
    netzgrafikOnlyNodeDto.trainrunSections = [];
    this.dataService.loadNetzgrafikDto(netzgrafikOnlyNodeDto);

    // (Step 2) Import nodes and trainrunSectiosn by trainrun inseration (copy => create)
    this.dataService.insertCopyNetzgrafikDto(netzgrafikDto, false);

    // step(3) Check whether a transitions object was given when not
    //         departureTime - arrivatelTime == 0 => non-stop
    this.nodeService.getNodes().forEach((n) => {
      n.getTransitions().forEach((trans) => {
        const p1 = n.getPort(trans.getPortId1());
        const p2 = n.getPort(trans.getPortId2());
        let arrivalTime = p1.getTrainrunSection().getTargetArrival();
        if (p1.getTrainrunSection().getSourceNodeId() === n.getId()) {
          arrivalTime = p1.getTrainrunSection().getSourceArrival();
        }
        let departureTime = p2.getTrainrunSection().getTargetDeparture();
        if (p2.getTrainrunSection().getSourceNodeId() === n.getId()) {
          departureTime = p2.getTrainrunSection().getSourceDeparture();
        }
        trans.setIsNonStopTransit(arrivalTime - departureTime === 0);
      });
    });

    // step(4) Recalc/propagate consecutive times
    this.trainrunService.propagateInitialConsecutiveTimes();

    // step(5) Validate all trainrun sections
    this.trainrunSectionService.getTrainrunSections().forEach((ts) => {
      TrainrunSectionValidator.validateOneSection(ts);
      TrainrunSectionValidator.validateTravelTime(ts);
    });
  }

  private processNetzgrafikJSON(netzgrafikDto: NetzgrafikDto) {
    // prepare JSON import
    this.uiInteractionService.showNetzgrafik();
    this.uiInteractionService.closeNodeStammdaten();
    this.uiInteractionService.closePerlenkette();
    this.uiInteractionService.resetEditorMode();
    this.nodeService.unselectAllNodes();

    // import data
    if (
      netzgrafikDto.trainrunSections.length === 0 ||
      !this.detectNetzgrafikJSON3rdParty(netzgrafikDto)
    ) {
      // -----------------------------------------------
      // Default: Netzgrafik-Editor exported JSON
      // -----------------------------------------------
      this.dataService.loadNetzgrafikDto(netzgrafikDto);
      // -----------------------------------------------
    } else {
      // -----------------------------------------------
      // 3rd Party: Netzgrafik-Editor exported JSON
      // -----------------------------------------------
      this.processNetzgrafikJSON3rdParty(netzgrafikDto);
    }

    // recompute viewport
    this.uiInteractionService.viewportCenteringOnNodesBoundingBox();
  }

  private getFilenameToExport() {
    const editorMode = this.uiInteractionService.getEditorMode();
    switch (editorMode) {
      case EditorMode.StreckengrafikEditing:
        return $localize`:@@app.view.editor-side-view.editor-tools-view-component.spaceTimeChartFile:spaceTimeChart`;
      case EditorMode.OriginDestination:
        return $localize`:@@app.view.editor-side-view.editor-tools-view-component.originDestinationFile:originDestination`;
      default:
        return $localize`:@@app.view.editor-side-view.editor-tools-view-component.netzgrafikFile:netzgrafik`;
    }
  }
}
