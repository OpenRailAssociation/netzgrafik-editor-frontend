import {parse} from "papaparse";
import {Component, ElementRef, ViewChild} from "@angular/core";
import * as svg from "save-svg-as-png";
import {DataService} from "../../services/data/data.service";
import {TrainrunService} from "../../services/data/trainrun.service";
import {NodeService} from "../../services/data/node.service";
import {FilterService} from "../../services/ui/filter.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {BaseDataService} from "../../services/data/basedata.service";
import {LogService} from "../../logger/log.service";
import {VersionControlService} from "../../services/data/version-control.service";
import {
  Direction,
  HaltezeitFachCategories,
  LabelRef,
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
import {ResourceService} from "../../services/data/resource.service";
import {GTFSParserService} from "../../services/data/gtfs-parser.service";
import {GTFSConverterService} from "../../services/data/gtfs-converter.service";
import {GtfsImportManagerService} from "./gtfs-import-dialogs/gtfs-import-manager.service";
import {MathUtils} from "src/app/utils/math";

interface ContainertoExportData {
  documentToExport: HTMLElement;
  exportParameter: any;
  essentialProps: string[];
}

@Component({
  selector: "sbb-editor-tools-view-component",
  templateUrl: "./editor-tools-view.component.html",
  styleUrls: ["./editor-tools-view.component.scss"],
  standalone: false,
})
export class EditorToolsViewComponent {
  @ViewChild("baseDataFileInput", {static: false})
  baseDataFileInput: ElementRef;
  @ViewChild("netzgrafikJsonFileInput", {static: false})
  netzgrafikJsonFileInput: ElementRef;
  @ViewChild("gtfsFileInput", {static: false})
  gtfsFileInput: ElementRef;

  public isDeletable$ = this.versionControlService.variant$.pipe(map((v) => v?.isDeletable));
  public isWritable$ = this.versionControlService.variant$.pipe(map((v) => v?.isWritable));

  // GTFS Route Type Filter (GTFS route_type values)
  public gtfsRouteTypeFilter = {
    tram: false, // 0 - Tram, Streetcar, Light rail
    metro: false, // 1 - Subway, Metro
    rail: true, // 2 - Rail (intercity, regional)
    bus: false, // 3 - Bus
    ferry: false, // 4 - Ferry
  };

  // Available values extracted from parsed GTFS data
  public gtfsAvailableAgencies: string[] = [];
  public gtfsAvailableRoutes: string[] = [];

  // Store light data for dynamic filtering
  private gtfsLightData: any = null;

  // GTFS Filter Dialog
  public gtfsFilterDialogVisible = false;
  public gtfsParsedData: any = null; // Holds parsed GTFS data before filtering
  public gtfsDataIsLoading = false; // Loading state for dialog
  private gtfsFile: File | null = null; // Store file for later full parse

  // Agency filter (chip input with autocomplete)
  public gtfsSelectedAgencies: string[] = [];
  public gtfsFilteredAgencies: string[] = [];

  // Category filter (chip input with autocomplete)
  public gtfsSelectedCategories: string[] = [];
  public gtfsFilteredCategories: string[] = [];
  public gtfsAvailableCategories: string[] = [];

  // Line filter (chip input with autocomplete)
  public gtfsSelectedLines: string[] = [];
  public gtfsFilteredLines: string[] = [];

  // Selected operating day
  public gtfsSelectedDate: string | null = null;

  // Service date range from GTFS calendar (min/max gütlig)
  public gtfsServiceDateRange: {startDate: string; endDate: string} | null = null;

  // Warnings for empty filters
  public gtfsNoCategoriesWarning = false;
  public gtfsNoLinesWarning = false;

  // Time sync tolerance for round-trip matching (in seconds)
  public gtfsTimeSyncTolerance = 180; // ±180 seconds (3 minutes) default

  // Topology consolidation toggle
  public gtfsEnableTopologyConsolidation = true;
  public gtfsTopologyDetourPercent = 35;
  public gtfsTopologyDetourAbsoluteMinutes = 3;

  // GTFS Import Progress Overlay
  public gtfsImportOverlayVisible = false;

  // Import phase tracking
  public gtfsImportPhases = [
    {
      id: "parse",
      labelKey: "app.view.editor-side-view.gtfs-import-dialogs.phase-parsing",
      status: "pending",
      subPhases: [] as {label: string; status: string}[],
    },
    {
      id: "filter",
      labelKey: "app.view.editor-side-view.gtfs-import-dialogs.phase-filter",
      status: "pending",
      subPhases: [] as {label: string; status: string}[],
    },
    {
      id: "convert",
      labelKey: "app.view.editor-side-view.gtfs-import-dialogs.phase-convert",
      status: "pending",
      subPhases: [] as {label: string; status: string}[],
    },
    {
      id: "import",
      labelKey: "app.view.editor-side-view.gtfs-import-dialogs.phase-import",
      status: "pending",
      subPhases: [] as {label: string; status: string}[],
    },
  ];
  public gtfsImportComplete = false;
  public gtfsImportSummary: any = null;

  // GTFS Node/Stop Filter (by classification)
  public gtfsNodeFilter = {
    start: true, // Start nodes (trip origins)
    end: true, // End nodes (trip destinations)
    junction: true, // Junction nodes (branching, no stop)
    major_stop: true, // Major stops (multiple routes)
    minor_stop: true, // Minor stops (degree 2, single route) - NOW ENABLED BY DEFAULT!
  };

  constructor(
    private dataService: DataService,
    private trainrunService: TrainrunService,
    private nodeService: NodeService,
    public filterService: FilterService,
    private trainrunSectionService: TrainrunSectionService,
    private uiInteractionService: UiInteractionService,
    private baseDataService: BaseDataService,
    private labelService: LabelService,
    private logger: LogService,
    private versionControlService: VersionControlService,
    private netzgrafikColoringService: NetzgrafikColoringService,
    private viewportCullService: ViewportCullService,
    private levelOfDetailService: LevelOfDetailService,
    private originDestinationService: OriginDestinationService,
    private resourceService: ResourceService,
    private gtfsParserService: GTFSParserService,
    private gtfsConverterService: GTFSConverterService,
    private gtfsImportManagerService: GtfsImportManagerService,
  ) {
    // Subscribe to GTFS import state changes
    this.gtfsImportManagerService.state$.subscribe((state) => {
      this.gtfsFilterDialogVisible = state.filterDialogVisible;
      this.gtfsImportOverlayVisible = state.importOverlayVisible;
      this.gtfsImportComplete = state.importComplete;
      this.gtfsImportPhases = state.importPhases;
      this.gtfsImportSummary = state.importSummary;
      this.gtfsAvailableAgencies = state.availableAgencies;
      this.gtfsAvailableCategories = state.availableCategories;
      this.gtfsAvailableRoutes = state.availableRoutes;
      this.gtfsSelectedAgencies = state.selectedAgencies;
      this.gtfsSelectedCategories = state.selectedCategories;
      this.gtfsSelectedLines = state.selectedLines;
      this.gtfsSelectedDate = state.selectedDate;
      this.gtfsServiceDateRange = state.serviceDateRange;
      this.gtfsFilteredAgencies = state.filteredAgencies;
      this.gtfsFilteredCategories = state.filteredCategories;
      this.gtfsFilteredLines = state.filteredLines;
      this.gtfsNoCategoriesWarning = state.noCategoriesWarning;
      this.gtfsNoLinesWarning = state.noLinesWarning;
      this.gtfsRouteTypeFilter = state.routeTypeFilter;
      this.gtfsNodeFilter = state.nodeFilter;
      this.gtfsTimeSyncTolerance = state.timeSyncTolerance;
      this.gtfsEnableTopologyConsolidation = state.enableTopologyConsolidation;
      this.gtfsTopologyDetourPercent = state.topologyDetourPercent;
      this.gtfsTopologyDetourAbsoluteMinutes = state.topologyDetourAbsoluteMinutes;
    });
  }

  getTodayString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  onLoadButton() {
    this.netzgrafikJsonFileInput.nativeElement.click();
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

  onExportContainerAsSVG() {
    // option 2: save svg as svg
    // https://www.npmjs.com/package/save-svg-as-png
    this.levelOfDetailService.disableLevelOfDetailRendering();
    this.viewportCullService.onViewportChangeUpdateRendering(false);

    const containerInfo = this.getContainerToExport();
    this.prepareStyleForExport(containerInfo);

    // SVG scaling does not affect resolution since SVGs are rendered as vector graphics.
    // To ensure a good initial scale, we define the target width as 2000 pixels.
    const scaleToTargetWidth = 2000 / containerInfo.exportParameter.width;
    containerInfo.exportParameter.scale = scaleToTargetWidth;

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

  onLoadBaseDataButton() {
    this.baseDataFileInput.nativeElement.click();
  }

  onLoadBaseData(param) {
    const file = param.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const finalResult = parse(reader.result.toString(), {
        header: true,
        delimiter: ";",
      });
      this.baseDataService.setBaseData(finalResult.data);
      if (this.baseDataService.didLastImportUseLegacyColumns()) {
        // -------------------------
        // legacy base data imported
        // -------------------------
        const msg = $localize`:@@app.view.editor-side-view.editor-tools-view-component.import-basedata-legacy-info:Legacy base data imported - please have a look into the documentation and update your stammdaten files to ensure that future version still supports the data import`;
        this.logger.info(msg);
      }
    };
    reader.readAsText(file);

    // set the event target value to null in order to be able to load the same file multiple times after one another
    param.target.value = null;
  }

  onExportBaseData() {
    const filename =
      $localize`:@@app.view.editor-side-view.editor-tools-view-component.baseDataFile:basedaten` +
      ".csv";
    const csvData = this.convertToBaseDataCSV();
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

  onImportGTFSButton() {
    this.gtfsFileInput.nativeElement.click();
  }

  async onLoadGTFS(event: any) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    try {
      await this.gtfsImportManagerService.loadGTFSFile(file);
    } catch (error) {
      let userMessage = "";
      if (
        error?.message?.includes("Invalid string length") ||
        error?.message?.includes("out of memory")
      ) {
        userMessage =
          "Die GTFS-Datei ist zu groß für den Browser-Speicher. " +
          "Bitte verwenden Sie eine kleinere GTFS-Datei oder filtern Sie die Daten vor dem Import.";
      } else {
        userMessage = error?.message || String(error);
      }

      this.logger.error(
        $localize`:@@app.view.editor-side-view.editor-tools-view-component.gtfs-error:Error scanning GTFS data: ${userMessage}`,
      );
    }

    // Reset input to allow importing same file again
    event.target.value = null;
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

  private convertToBaseDataCSV(): string {
    const headers: string[] = [
      "StationCode",
      "StationName",
      "Category",
      "Region",
      "MinimumStopTime_IPV",
      "PassingThroughStation_IPV",
      "MinimumStopTime_A",
      "PassingThroughStation_A",
      "MinimumStopTime_B",
      "PassingThroughStation_B",
      "MinimumStopTime_C",
      "PassingThroughStation_C",
      "MinimumStopTime_D",
      "PassingThroughStation_D",
      "ZAZ (Train dispatching time)",
      "ConnectionTime",
      "Labels",
      "XCoord",
      "YCoord",
      "Create",
    ];

    const rows: string[][] = [];
    this.nodeService.getNodes().forEach((nodeElement) => {
      const trainrunCategoryHaltezeit: TrainrunCategoryHaltezeit =
        nodeElement.getTrainrunCategoryHaltezeit();
      const baseData = this.baseDataService.getBaseDataByBetriebspunktName(
        nodeElement.getBetriebspunktName(),
      );
      const trainDispatchingTime = baseData !== null ? baseData.getBufferTime() : 0;
      const erstellen = baseData !== null ? baseData.getCreate() : 1;
      const kategorien = baseData !== null ? baseData.getCategories() : [];
      const regions = baseData !== null ? baseData.getRegions() : [];

      const getPassingThroughStation = (cat: HaltezeitFachCategories): boolean =>
        trainrunCategoryHaltezeit[cat].no_halt;
      const getMinimumStopTime = (cat: HaltezeitFachCategories): number =>
        getPassingThroughStation(cat)
          ? 0
          : MathUtils.round(trainrunCategoryHaltezeit[cat].haltezeit - trainDispatchingTime, 2);
      const getPassingThroughStationFlag = (cat: HaltezeitFachCategories): number =>
        getPassingThroughStation(cat) ? 1 : 0;

      const labels = nodeElement
        .getLabelIds()
        .map((labelID) => {
          const labelOfInterest = this.labelService.getLabelFromId(labelID);
          return labelOfInterest !== undefined ? labelOfInterest.getLabel() : "";
        })
        .filter((s) => s !== "")
        .join(",");

      const row: string[] = [
        nodeElement.getBetriebspunktName(),
        nodeElement.getFullName(),
        kategorien.join(","),
        regions.join(","),
        "" + getMinimumStopTime(HaltezeitFachCategories.IPV),
        "" + getPassingThroughStationFlag(HaltezeitFachCategories.IPV),
        "" + getMinimumStopTime(HaltezeitFachCategories.A),
        "" + getPassingThroughStationFlag(HaltezeitFachCategories.A),
        "" + getMinimumStopTime(HaltezeitFachCategories.B),
        "" + getPassingThroughStationFlag(HaltezeitFachCategories.B),
        "" + getMinimumStopTime(HaltezeitFachCategories.C),
        "" + getPassingThroughStationFlag(HaltezeitFachCategories.C),
        "" + getMinimumStopTime(HaltezeitFachCategories.D),
        "" + getPassingThroughStationFlag(HaltezeitFachCategories.D),
        "" + trainDispatchingTime,
        "" + nodeElement.getConnectionTime(),
        '"' + labels + '"',
        "" + nodeElement.getPositionX(),
        "" + nodeElement.getPositionY(),
        "" + erstellen,
      ];
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
      "width",
      "min-width",
      "max-width",
      "height",
      "min-height",
      "max-height",
      "overflow",
      "margin-bottom",
      "margin-top",
      "margin-left",
      "margin-right",
      "margin",
      "padding",
      "display",
      "grid-template-columns",
      "grid-template-rows",
      "grid-gap",
      "background",
      "background-color",
      "border-right",
      "border-left",
      "border-top",
      "border-bottom",
      "border",
      "box-sizing",
      "paint-order",
    ];

    return {
      documentToExport: htmlElementToExport,
      exportParameter: param,
      essentialProps: essentialProps,
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
      scale: 1.0,
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
        const startNode = this.trainrunService.getLeftOrTopNodeWithTrainrunId(trainrun.getId());
        const startTrainrunSection = startNode.getExtremityTrainrunSection(trainrun.getId());
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

        // Remove category prefix from trainrun name for export
        const categoryPrefix = trainrun.getTrainrunCategory().shortName.trim();
        let trainrunName = trainrun.getTitle().trim();
        if (trainrunName.toUpperCase().startsWith(categoryPrefix.toUpperCase())) {
          trainrunName = trainrunName.substring(categoryPrefix.length).trim();
        }

        const row: string[] = [];
        row.push(categoryPrefix);
        row.push(trainrunName);
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
        netzgrafikDto.nodes.length
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

    const gtfsInitialStopNodeIdsByTrainrun = (netzgrafikDto as any)
      .gtfsInitialStopNodeIdsByTrainrun as Map<number, number[]> | undefined;

    // step(3) Check whether a transitions object was given when not
    //         departureTime - arrivatelTime == 0 => non-stop
    if (gtfsInitialStopNodeIdsByTrainrun && gtfsInitialStopNodeIdsByTrainrun.size > 0) {
      this.nodeService.applyGtfsInitialStopNodeIdsByTrainrun(gtfsInitialStopNodeIdsByTrainrun);
    } else {
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
      this.nodeService.transitionsUpdated();
    }

    this.nodeService.getNodes().forEach((n) => {
      const res = this.resourceService.createAndGetResource(false);
      n.setResourceId(res.getId());
    });

    // step(4) Migrate 3rd party imported trainruns/node/resource to ensure direction is set
    this.dataService.ensureAllResourcesLinkedToNetzgrafikObjects();
    this.trainrunService.getTrainruns().forEach((t) => {
      const currentDirection = t.getDirection();
      if (currentDirection === undefined) {
        t.setDirection(Direction.ROUND_TRIP);
      }
    });

    // step(5) Recalc/propagate consecutive times
    this.trainrunService.propagateInitialConsecutiveTimes();

    // step(6) Validate all trainrun sections
    this.trainrunSectionService.getTrainrunSections().forEach((ts) => {
      TrainrunSectionValidator.validateOneSection(ts);
      TrainrunSectionValidator.validateTravelTime(ts, this.filterService.getTimeDisplayPrecision());
    });
  }

  private async processNetzgrafikJSON(netzgrafikDto: NetzgrafikDto): Promise<void> {
    // prepare JSON import
    this.uiInteractionService.showNetzgrafik();
    this.uiInteractionService.closeNodeBaseData();
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

  // GTFS Filter Dialog Functions
  closeGtfsFilterDialog(): void {
    this.gtfsImportManagerService.closeFilterDialog();
  }

  addGtfsAgency(agency: string): void {
    this.gtfsImportManagerService.addAgency(agency);
  }

  removeGtfsAgency(agency: string): void {
    this.gtfsImportManagerService.removeAgency(agency);
  }

  addGtfsCategory(category: string): void {
    this.gtfsImportManagerService.addCategory(category);
  }

  removeGtfsCategory(category: string): void {
    this.gtfsImportManagerService.removeCategory(category);
  }

  addGtfsLine(line: string): void {
    this.gtfsImportManagerService.addLine(line);
  }

  removeGtfsLine(line: string): void {
    this.gtfsImportManagerService.removeLine(line);
  }

  setGtfsSelectedDate(date: string): void {
    this.gtfsImportManagerService.setSelectedDate(date);
  }

  setGtfsTimeSyncTolerance(value: number): void {
    this.gtfsImportManagerService.updateTimeSyncTolerance(value);
  }

  setGtfsEnableTopologyConsolidation(value: boolean): void {
    this.gtfsImportManagerService.updateEnableTopologyConsolidation(value);
  }

  setGtfsTopologyDetourPercent(value: number): void {
    this.gtfsImportManagerService.updateTopologyDetourPercent(value);
  }

  setGtfsTopologyDetourAbsoluteMinutes(value: number): void {
    this.gtfsImportManagerService.updateTopologyDetourAbsoluteMinutes(value);
  }

  async applyGtfsFiltersAndImport(): Promise<void> {
    await this.gtfsImportManagerService.applyFiltersAndImport((netzgrafikDto) =>
      this.processNetzgrafikJSON(netzgrafikDto),
    );
  }

  closeGtfsImportOverlay(): void {
    this.gtfsImportManagerService.closeImportOverlay();
  }
}
