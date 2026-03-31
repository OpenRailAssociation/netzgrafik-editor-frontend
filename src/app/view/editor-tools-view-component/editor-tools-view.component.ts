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
  Direction,
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
import {ResourceService} from "../../services/data/resource.service";
import {GTFSParserService} from "../../services/data/gtfs-parser.service";
import {GTFSConverterService} from "../../services/data/gtfs-converter.service";

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
  @ViewChild("gtfsFileInput", {static: false})
  gtfsFileInput: ElementRef;

  public isDeletable$ = this.versionControlService.variant$.pipe(map((v) => v?.isDeletable));
  public isWritable$ = this.versionControlService.variant$.pipe(map((v) => v?.isWritable));

  // GTFS Route Type Filter (GTFS route_type values)
  public gtfsRouteTypeFilter = {
    tram: false,     // 0 - Tram, Streetcar, Light rail
    metro: false,    // 1 - Subway, Metro
    rail: true,      // 2 - Rail (intercity, regional)
    bus: false,      // 3 - Bus
    ferry: false,    // 4 - Ferry
  };

  // Available values extracted from parsed GTFS data
  public gtfsAvailableAgencies: string[] = [];
  public gtfsAvailableRoutes: string[] = [];

  // GTFS Filter Dialog
  public gtfsFilterDialogVisible = false;
  public gtfsParsedData: any = null; // Holds parsed GTFS data before filtering
  public gtfsDataIsLoading = false; // Loading state for dialog
  private gtfsFile: File | null = null; // Store file for later full parse
  
  // Agency filter (chip input)
  public gtfsSelectedAgencies: string[] = [];
  public gtfsAgencySearchText = '';
  public gtfsFilteredAgencies: string[] = [];
  
  // Category filter (chip input)
  public gtfsSelectedCategories: string[] = [];
  public gtfsCategorySearchText = '';
  public gtfsFilteredCategories: string[] = [];
  public gtfsAvailableCategories: string[] = [];
  
  // Line filter (chip input with autocomplete)
  public gtfsSelectedLines: string[] = [];
  public gtfsLineSearchText = '';
  public gtfsFilteredLines: string[] = [];
  // Legacy text input (kept for backward compatibility, but replaced with chip input)
  public gtfsLineFilter = '';

  // GTFS Import Progress Overlay
  public gtfsImportOverlayVisible = false;
  public gtfsImportLogs: string[] = [];
  private originalConsoleLog: any;
  
  // Import phase tracking
  public gtfsImportPhases = [
    { id: 'parse', label: 'GTFS Parsing', status: 'pending' },
    { id: 'filter', label: 'Filter anwenden', status: 'pending' },
    { id: 'convert', label: 'Netzgrafik Konvertierung', status: 'pending' },
    { id: 'import', label: 'Editor Import', status: 'pending' }
  ];
  public gtfsImportComplete = false;

  // GTFS Node/Stop Filter (by classification)
  public gtfsNodeFilter = {
    start: true,       // Start nodes (trip origins)
    end: true,         // End nodes (trip destinations)
    junction: true,    // Junction nodes (branching, no stop)
    major_stop: true,  // Major stops (multiple routes)
    minor_stop: true,  // Minor stops (degree 2, single route) - NOW ENABLED BY DEFAULT!
  };

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
    private resourceService: ResourceService,
    private gtfsParserService: GTFSParserService,
    private gtfsConverterService: GTFSConverterService,
  ) {}

  getTodayString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

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

  onImportGTFSButton() {
    this.gtfsFileInput.nativeElement.click();
  }

  async onLoadGTFS(event: any) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    console.log('\n════════════════════════════════════════════');
    console.log('🚀 GTFS FILE SELECTED');
    console.log('════════════════════════════════════════════\n');
    console.log('📁 File:', file.name);
    console.log('📦 Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    
    // Store file for later full parsing
    this.gtfsFile = file;
    
    // Show filter dialog immediately with loading state
    this.gtfsFilterDialogVisible = true;
    this.gtfsDataIsLoading = true;
    this.gtfsParsedData = null;
    this.gtfsAvailableAgencies = [];
    this.gtfsAvailableCategories = [];
    this.gtfsAvailableRoutes = [];
    this.gtfsSelectedAgencies = [];
    this.gtfsSelectedCategories = [];
    this.gtfsSelectedLines = [];
    this.gtfsLineFilter = '';
    
    // Start capturing console logs for display in filter dialog
    this.gtfsImportLogs = [];
    this.startCapturingConsoleLogs();
    
    try {
      // PHASE 1: LIGHT PARSE - Only read agencies and routes for filter autocomplete
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('PHASE 1: QUICK SCAN FOR FILTER OPTIONS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // Convert transport mode filter to route_type numbers
      const allowedRouteTypes: number[] = [];
      if (this.gtfsRouteTypeFilter.tram) allowedRouteTypes.push(0);
      if (this.gtfsRouteTypeFilter.metro) allowedRouteTypes.push(1);
      if (this.gtfsRouteTypeFilter.rail) {
        allowedRouteTypes.push(2, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 117);
      }
      if (this.gtfsRouteTypeFilter.bus) allowedRouteTypes.push(3);
      if (this.gtfsRouteTypeFilter.ferry) allowedRouteTypes.push(4);
      
      console.log('🔍 Transport mode filter:', allowedRouteTypes);
      console.log('⚡ Using LIGHT parse - only reading agencies + routes (skipping trips, stops, etc.)');
      
      // Light parse - only agencies and routes
      const lightData = await this.gtfsParserService.parseGTFSZipLight(file, allowedRouteTypes);
      
      console.log('\n✅ Quick scan complete!');
      console.log('📊 Found filter options:');
      console.log('  - Agencies:', lightData.agencies.length);
      console.log('  - Routes:', lightData.routes.length);
      
      // PHASE 2: Extract available filter values (very fast - just Set operations)
      console.log('\n🔍 Building autocomplete lists...');
      this.gtfsAvailableAgencies = lightData.agencies
        .map(a => a.agency_name)
        .filter((name, idx, arr) => arr.indexOf(name) === idx) // Unique
        .sort();
      
      // Extract categories from route_desc and route_short_name
      const categorySet = new Set<string>();
      lightData.routes.forEach(route => {
        // From route_desc (if present) - this is the primary source for categories
        const desc = (route.route_desc || '').trim();
        if (desc) {
          categorySet.add(desc.toUpperCase());
        } else {
          // If route_desc is empty, extract category prefix from route_short_name
          // E.g., "IR15" -> "IR", "S1" -> "S", "IC8" -> "IC"
          const shortName = (route.route_short_name || '').trim();
          if (shortName) {
            // Extract leading letters (category prefix) before numbers
            const match = shortName.match(/^[A-Za-z]+/);
            if (match) {
              categorySet.add(match[0].toUpperCase());
            }
          }
        }
      });
      this.gtfsAvailableCategories = Array.from(categorySet).sort();
      
      // DEBUG: Show which routes contributed which categories
      console.log('\n🔍 Category extraction debug (first 20 routes):');
      lightData.routes.slice(0, 20).forEach(route => {
        const desc = (route.route_desc || '').trim();
        const shortName = (route.route_short_name || '').trim();
        console.log(`  route_short_name="${shortName}", route_desc="${desc}"`);
      });
      
      // Extract available route names (optional for future use)
      this.gtfsAvailableRoutes = lightData.routes
        .map(r => r.route_short_name || r.route_long_name || '')
        .filter((name, idx, arr) => name && arr.indexOf(name) === idx)
        .sort();
      
      console.log('\n📋 Available agencies:', this.gtfsAvailableAgencies.length);
      console.log('   Sample:', this.gtfsAvailableAgencies.slice(0, 5));
      console.log('📋 Available categories:', this.gtfsAvailableCategories);
      
      // PHASE 3: Set smart defaults
      // Default agency: Schweizerische Bundesbahnen SBB (prefer full name)
      const sbbAgency = this.gtfsAvailableAgencies.find(a => 
        a.toUpperCase().includes('SCHWEIZERISCHE') && a.toUpperCase().includes('BUNDESBAHNEN')
      ) || this.gtfsAvailableAgencies.find(a => 
        a.toUpperCase().includes('SBB')
      );
      this.gtfsSelectedAgencies = sbbAgency ? [sbbAgency] : [];
      
      // Default categories: EC, IC, IR, RE, S (if available)
      const defaultCategories = ['EC', 'IC', 'IR', 'RE', 'S'];
      this.gtfsSelectedCategories = defaultCategories.filter(cat => 
        this.gtfsAvailableCategories.includes(cat)
      );
      
      // Default line filter: empty (no lines selected by default = all lines)
      this.gtfsSelectedLines = [];
      this.gtfsLineFilter = '';
      
      // Initialize autocomplete
      this.gtfsAgencySearchText = '';
      this.gtfsFilteredAgencies = [...this.gtfsAvailableAgencies];
      this.gtfsCategorySearchText = '';
      this.gtfsFilteredCategories = [...this.gtfsAvailableCategories];
      this.gtfsLineSearchText = '';
      this.gtfsFilteredLines = [...this.gtfsAvailableRoutes];
      this.gtfsFilteredCategories = [...this.gtfsAvailableCategories];
      
      console.log('\n✅ Smart defaults set:');
      console.log('  - Agencies:', this.gtfsSelectedAgencies);
      console.log('  - Categories:', this.gtfsSelectedCategories);
      
      // Stop capturing logs
      this.stopCapturingConsoleLogs();
      
      // End loading state - show filter options and import button
      this.gtfsDataIsLoading = false;
      
      console.log('\n🎛️  Filter dialog ready!');
      console.log('ℹ️  Full GTFS parsing will happen when you click "Import starten"');
      
    } catch (error) {
      this.stopCapturingConsoleLogs();
      console.error('\n❌ ERROR SCANNING GTFS:');
      console.error('Error:', error);
      
      let userMessage = '';
      if (error?.message?.includes('Invalid string length') || error?.message?.includes('out of memory')) {
        userMessage = 'Die GTFS-Datei ist zu groß für den Browser-Speicher. ' +
                     'Bitte verwenden Sie eine kleinere GTFS-Datei oder filtern Sie die Daten vor dem Import.';
      } else {
        userMessage = error?.message || String(error);
      }
      
      this.logger.error($localize`:@@app.view.editor-side-view.editor-tools-view-component.gtfs-error:Error scanning GTFS data: ${userMessage}`);
      
      // Keep dialog open with logs visible so user can see the error
      // gtfsDataIsLoading stays true to show log view
      // User can close dialog with "Abbrechen" button
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

  // GTFS Filter Dialog Functions
  closeGtfsFilterDialog(): void {
    this.gtfsFilterDialogVisible = false;
    this.gtfsParsedData = null;
    this.gtfsDataIsLoading = false;
    this.gtfsFile = null;
  }

  onGtfsAgencySearch(): void {
    const search = this.gtfsAgencySearchText.toLowerCase();
    this.gtfsFilteredAgencies = this.gtfsAvailableAgencies.filter(a => 
      a.toLowerCase().includes(search)
    );
  }

  addGtfsAgency(agency: string): void {
    if (!this.gtfsSelectedAgencies.includes(agency)) {
      this.gtfsSelectedAgencies.push(agency);
    }
    this.gtfsAgencySearchText = '';
    this.gtfsFilteredAgencies = [...this.gtfsAvailableAgencies];
  }

  removeGtfsAgency(agency: string): void {
    this.gtfsSelectedAgencies = this.gtfsSelectedAgencies.filter(a => a !== agency);
  }

  onGtfsCategorySearch(): void {
    const search = this.gtfsCategorySearchText.toLowerCase();
    this.gtfsFilteredCategories = this.gtfsAvailableCategories.filter(c => 
      c.toLowerCase().includes(search)
    );
  }

  addGtfsCategory(category: string): void {
    if (!this.gtfsSelectedCategories.includes(category)) {
      this.gtfsSelectedCategories.push(category);
    }
    this.gtfsCategorySearchText = '';
    this.gtfsFilteredCategories = [...this.gtfsAvailableCategories];
  }

  removeGtfsCategory(category: string): void {
    this.gtfsSelectedCategories = this.gtfsSelectedCategories.filter(c => c !== category);
  }

  onGtfsLineSearch(): void {
    const search = this.gtfsLineSearchText.toLowerCase();
    this.gtfsFilteredLines = this.gtfsAvailableRoutes.filter(line => 
      line.toLowerCase().includes(search)
    );
  }

  addGtfsLine(line: string): void {
    if (!this.gtfsSelectedLines.includes(line)) {
      this.gtfsSelectedLines.push(line);
    }
    this.gtfsLineSearchText = '';
    this.gtfsFilteredLines = [...this.gtfsAvailableRoutes];
  }

  removeGtfsLine(line: string): void {
    this.gtfsSelectedLines = this.gtfsSelectedLines.filter(l => l !== line);
  }

  async applyGtfsFiltersAndImport(): Promise<void> {
    if (!this.gtfsFile) {
      console.error('No GTFS file loaded');
      return;
    }

    // Close filter dialog, show progress overlay
    this.gtfsFilterDialogVisible = false;
    this.gtfsImportOverlayVisible = true;
    this.gtfsImportLogs = [];
    this.gtfsImportComplete = false;
    this.gtfsImportPhases.forEach(p => p.status = 'pending');
    this.startCapturingConsoleLogs();

    try {
      console.log('\n════════════════════════════════════════════');
      console.log('🚀 GTFS FULL IMPORT WITH SELECTED FILTERS');
      console.log('════════════════════════════════════════════\n');
      console.log('🏢 Selected agencies:', this.gtfsSelectedAgencies);
      console.log('🚆 Selected categories:', this.gtfsSelectedCategories);
      console.log('🚂 Selected lines:', this.gtfsSelectedLines.length > 0 ? this.gtfsSelectedLines : '(all lines)');
      
      // PHASE 1: Full GTFS parse with filters
      this.gtfsImportPhases[0].status = 'running';
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('PHASE 1: FULL GTFS PARSING (trips, stops, etc.)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // Convert transport mode filter to route_type numbers
      const allowedRouteTypes: number[] = [];
      if (this.gtfsRouteTypeFilter.tram) allowedRouteTypes.push(0);
      if (this.gtfsRouteTypeFilter.metro) allowedRouteTypes.push(1);
      if (this.gtfsRouteTypeFilter.rail) {
        allowedRouteTypes.push(2, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 117);
      }
      if (this.gtfsRouteTypeFilter.bus) allowedRouteTypes.push(3);
      if (this.gtfsRouteTypeFilter.ferry) allowedRouteTypes.push(4);
      
      console.log('🔍 Filters:');
      console.log('  - Transport modes:', allowedRouteTypes);
      console.log('  - Agencies:', this.gtfsSelectedAgencies.length > 0 ? this.gtfsSelectedAgencies : '(all)');
      
      // Full parse with agency filter (NO date filter)
      let gtfsData = await this.gtfsParserService.parseGTFSZip(
        this.gtfsFile, 
        allowedRouteTypes, 
        this.gtfsSelectedAgencies
      );
      
      console.log('\n✅ Full GTFS parsed!');
      console.log('📊 Data after agency filter:');
      console.log('  - Routes:', gtfsData.routes.length);
      console.log('  - Trips:', gtfsData.trips.length);
      console.log('  - Stops:', gtfsData.stops.length);
      
      // Debug: Show sample routes with their desc and short_name
      if (gtfsData.routes.length > 0) {
        console.log('\n📋 Sample routes (first 10):');
        gtfsData.routes.slice(0, 10).forEach(route => {
          console.log(`  - route_short_name="${route.route_short_name}", route_desc="${route.route_desc}", route_type=${route.route_type}`);
        });
      }
      
      this.gtfsImportPhases[0].status = 'completed';
      
      this.logger.info($localize`:@@app.view.editor-side-view.editor-tools-view-component.gtfs-converting:Converting GTFS to Netzgrafik format...`);
      
      // PHASE 2: Apply category filter
      this.gtfsImportPhases[1].status = 'running';
      console.log('\n🔍 Applying category filter...');
      if (this.gtfsSelectedCategories.length > 0) {
        console.log('  📋 Selected categories:', this.gtfsSelectedCategories);
        const beforeFilter = gtfsData.routes.length;
        gtfsData.routes = gtfsData.routes.filter(route => {
          const desc = (route.route_desc || '').toUpperCase();
          const shortName = (route.route_short_name || '').toUpperCase();
          
          // Check if any selected category matches:
          // 1. route_desc (primary source)
          // 2. OR the category prefix extracted from route_short_name (e.g., "IR" from "IR15")
          const matches = this.gtfsSelectedCategories.some(cat => {
            const catUpper = cat.toUpperCase();
            
            // Match if route_desc contains category
            if (desc.includes(catUpper)) {
              return true;
            }
            
            // Or match if route_short_name starts with the category prefix
            // Extract category prefix from route_short_name (letters before numbers)
            const prefixMatch = shortName.match(/^[A-Za-z]+/);
            if (prefixMatch && prefixMatch[0] === catUpper) {
              return true;
            }
            
            return false;
          });
          
          if (!matches) {
            console.log(`    ❌ Filtered out: ${route.route_short_name} (desc="${route.route_desc}", short="${route.route_short_name}")`);
          }
          return matches;
        });
        console.log('  🔍 Filtered routes from', beforeFilter, 'to', gtfsData.routes.length);
        
        if (gtfsData.routes.length === 0) {
          console.error('  ❌ NO ROUTES LEFT AFTER FILTERING!');
          console.error('  💡 Check if selected categories match route_desc or route_short_name');
          console.error('  💡 Selected categories:', this.gtfsSelectedCategories);
        }
        
        const validRouteIds = new Set(gtfsData.routes.map(r => r.route_id));
        const beforeTrips = gtfsData.trips.length;
        gtfsData.trips = gtfsData.trips.filter(t => validRouteIds.has(t.route_id));
        console.log('  🔍 Filtered trips from', beforeTrips, 'to', gtfsData.trips.length);
        
        const validTripIds = new Set(gtfsData.trips.map(t => t.trip_id));
        const beforeStopTimes = gtfsData.stopTimes.length;
        gtfsData.stopTimes = gtfsData.stopTimes.filter(st => validTripIds.has(st.trip_id));
        console.log('  🔍 Filtered stop_times from', beforeStopTimes, 'to', gtfsData.stopTimes.length);
      } else {
        console.log('  ℹ️  No category filter - keeping all categories');
      }
      
      // Apply line filter
      console.log('\n🔍 Applying line filter...');
      if (this.gtfsSelectedLines.length > 0) {
        console.log('  🚂 Selected lines:', this.gtfsSelectedLines);
        
        const beforeFilter = gtfsData.routes.length;
        gtfsData.routes = gtfsData.routes.filter(route => {
          const shortName = (route.route_short_name || '').toUpperCase();
          return this.gtfsSelectedLines.some(line => shortName === line.toUpperCase());
        });
        console.log('  🔍 Filtered routes from', beforeFilter, 'to', gtfsData.routes.length);
        
        const validRouteIds = new Set(gtfsData.routes.map(r => r.route_id));
        const beforeTrips = gtfsData.trips.length;
        gtfsData.trips = gtfsData.trips.filter(t => validRouteIds.has(t.route_id));
        console.log('  🔍 Filtered trips from', beforeTrips, 'to', gtfsData.trips.length);
        
        const validTripIds = new Set(gtfsData.trips.map(t => t.trip_id));
        const beforeStopTimes = gtfsData.stopTimes.length;
        gtfsData.stopTimes = gtfsData.stopTimes.filter(st => validTripIds.has(st.trip_id));
        console.log('  🔍 Filtered stop_times from', beforeStopTimes, 'to', gtfsData.stopTimes.length);
        
        const usedStopIds = new Set(gtfsData.stopTimes.map(st => st.stop_id));
        const usedStopIdsWithParents = new Set(usedStopIds);
        gtfsData.stops.forEach(stop => {
          if (usedStopIds.has(stop.stop_id) && stop.parent_station) {
            usedStopIdsWithParents.add(stop.parent_station);
          }
        });
        const beforeStops = gtfsData.stops.length;
        gtfsData.stops = gtfsData.stops.filter(stop => usedStopIdsWithParents.has(stop.stop_id));
        console.log('  🔍 Filtered stops from', beforeStops, 'to', gtfsData.stops.length);
      } else {
        console.log('  ℹ️  No line filter - keeping all lines');
      }
      
      // Continue with node classification filter and conversion
      console.log('\n🔍 Applying node classification filter...');
      const activeNodeTypes = Object.keys(this.gtfsNodeFilter).filter(key => this.gtfsNodeFilter[key]);
      console.log('  Active node types:', activeNodeTypes);
      
      if (activeNodeTypes.length > 0 && activeNodeTypes.length < 5) {
        const acceptedClassifications = new Set(activeNodeTypes);
        const beforeFilter = gtfsData.stops.length;
        gtfsData.stops = gtfsData.stops.filter(stop => 
          !stop.node_type || acceptedClassifications.has(stop.node_type)
        );
        console.log('  ✓ Filtered stops from', beforeFilter, 'to', gtfsData.stops.length);
      } else {
        console.log('  ℹ️  All node types selected or none classified - keeping all stops');
      }
      this.gtfsImportPhases[1].status = 'completed';
      
      // Convert to Netzgrafik format
      this.gtfsImportPhases[2].status = 'running';
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('PHASE 2: CONVERTING TO NETZGRAFIK FORMAT');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      const existingNetzgrafik = this.dataService.getNetzgrafikDto();
      const existingMetadata = existingNetzgrafik?.metadata;
      
      let netzgrafikDto;
      try {
        netzgrafikDto = this.gtfsConverterService.convertToNetzgrafik(gtfsData, {
          maxTripsPerRoute: 10,
          minStopsPerTrip: 3,
          existingMetadata: existingMetadata,
        });
        console.log('\n✅ Phase 2 complete! Data converted successfully.');
        this.gtfsImportPhases[2].status = 'completed';
      } catch (convertError) {
        console.error('\n❌ Phase 2 FAILED!');
        console.error('Convert error:', convertError);
        this.gtfsImportPhases[2].status = 'error';
        throw convertError;
      }
      
      // Import into editor
      this.gtfsImportPhases[3].status = 'running';
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('PHASE 3: IMPORTING INTO EDITOR');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('🎯 Importing', netzgrafikDto.nodes.length, 'nodes');
      console.log('🎯 Importing', netzgrafikDto.trainruns.length, 'trainruns');
      console.log('🎯 Importing', netzgrafikDto.trainrunSections.length, 'sections');
      
      this.processNetzgrafikJSON(netzgrafikDto);
      
      console.log('\n✅ Import complete!');
      console.log('\n════════════════════════════════════════════');
      this.gtfsImportPhases[3].status = 'completed';
      
      this.stopCapturingConsoleLogs();
      this.gtfsImportComplete = true;
      this.logger.info($localize`:@@app.view.editor-side-view.editor-tools-view-component.gtfs-success:GTFS data imported successfully`);
      
    } catch (error) {
      this.stopCapturingConsoleLogs();
      console.error('\n❌ ERROR:', error);
      this.logger.error('GTFS import failed: ' + (error?.message || String(error)));
      this.gtfsImportComplete = true; // Allow closing on error
      // Mark current phase as error
      const runningPhase = this.gtfsImportPhases.find(p => p.status === 'running');
      if (runningPhase) {
        runningPhase.status = 'error';
      }
    }
  }

  closeGtfsImportOverlay(): void {
    this.gtfsImportOverlayVisible = false;
    this.gtfsImportLogs = [];
    this.gtfsImportComplete = false;
    // Reset phases
    this.gtfsImportPhases.forEach(p => p.status = 'pending');
  }

  private startCapturingConsoleLogs(): void {
    // Save original console.log
    this.originalConsoleLog = console.log;
    
    // Override console.log to capture messages
    console.log = (...args: any[]) => {
      // Convert arguments to string
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      // Add to overlay logs
      this.gtfsImportLogs.push(message);
      
      // Also call original console.log (for browser console)
      this.originalConsoleLog.apply(console, args);
      
      // Auto-scroll to bottom (with small delay for DOM update)
      setTimeout(() => {
        // Check filter dialog log container first (during loading phase)
        const filterLogContainer = document.getElementById('gtfsFilterDialogLogContainer');
        if (filterLogContainer) {
          filterLogContainer.scrollTop = filterLogContainer.scrollHeight;
          return;
        }
        
        // Otherwise check import overlay log container (during import phase)
        const logContainer = document.getElementById('gtfsImportLogContainer');
        if (logContainer) {
          logContainer.scrollTop = logContainer.scrollHeight;
        }
      }, 10);
    };
  }

  private stopCapturingConsoleLogs(): void {
    // Restore original console.log
    if (this.originalConsoleLog) {
      console.log = this.originalConsoleLog;
      this.originalConsoleLog = null;
    }
  }
}
