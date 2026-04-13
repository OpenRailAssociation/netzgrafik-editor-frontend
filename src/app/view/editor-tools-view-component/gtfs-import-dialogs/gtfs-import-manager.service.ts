import {Injectable} from "@angular/core";
import {BehaviorSubject, Observable} from "rxjs";
import {GTFSParserService} from "../../../services/data/gtfs-parser.service";
import {GTFSConverterService} from "../../../services/data/gtfs-converter.service";
import {DataService} from "../../../services/data/data.service";
import {LabelService} from "../../../services/data/label.service";
import {LogService} from "../../../logger/log.service";
import {LabelRef, NetzgrafikDto} from "../../../data-structures/business.data.structures";
import {
  GTFSImportState,
  GTFSImportPhase,
  GTFSSubPhase,
  GTFSImportSummary,
  DEFAULT_GTFS_IMPORT_PHASES,
  DEFAULT_ROUTE_TYPE_FILTER,
  DEFAULT_NODE_FILTER,
  DEFAULT_TIME_SYNC_TOLERANCE,
} from "./gtfs-import.models";

/**
 * Service to manage GTFS import workflow including:
 * - Light parsing for filter options
 * - Filter management (agencies, categories, lines)
 * - Full parsing and conversion
 * - Progress tracking
 */
@Injectable({
  providedIn: "root",
})
export class GtfsImportManagerService {
  private stateSubject = new BehaviorSubject<GTFSImportState>(this.getInitialState());
  public state$: Observable<GTFSImportState> = this.stateSubject.asObservable();

  constructor(
    private gtfsParserService: GTFSParserService,
    private gtfsConverterService: GTFSConverterService,
    private dataService: DataService,
    private labelService: LabelService,
    private logger: LogService,
  ) {}

  private getInitialState(): GTFSImportState {
    // Set default date to today in YYYY-MM-DD format (for HTML date input)
    const today = new Date();
    const defaultDate =
      today.getFullYear().toString() +
      "-" +
      (today.getMonth() + 1).toString().padStart(2, "0") +
      "-" +
      today.getDate().toString().padStart(2, "0");

    return {
      file: null,
      lightData: null,
      availableAgencies: [],
      availableCategories: [],
      availableRoutes: [],
      selectedAgencies: [],
      selectedCategories: [],
      selectedLines: [],
      selectedDate: defaultDate,
      serviceDateRange: null,
      filteredAgencies: [],
      filteredCategories: [],
      filteredLines: [],
      noCategoriesWarning: false,
      noLinesWarning: false,
      filterDialogVisible: false,
      importOverlayVisible: false,
      importComplete: false,
      importPhases: JSON.parse(JSON.stringify(DEFAULT_GTFS_IMPORT_PHASES)),
      importSummary: null,
      routeTypeFilter: {...DEFAULT_ROUTE_TYPE_FILTER},
      nodeFilter: {...DEFAULT_NODE_FILTER},
      timeSyncTolerance: DEFAULT_TIME_SYNC_TOLERANCE,
    };
  }

  getState(): GTFSImportState {
    return this.stateSubject.value;
  }

  private updateState(partial: Partial<GTFSImportState>): void {
    this.stateSubject.next({...this.stateSubject.value, ...partial});
  }

  reset(): void {
    this.stateSubject.next(this.getInitialState());
  }

  // Route Type Filter conversions
  private convertRouteTypeFilterToNumbers(): number[] {
    const filter = this.getState().routeTypeFilter;
    const allowedRouteTypes: number[] = [];

    if (filter.tram) allowedRouteTypes.push(0);
    if (filter.metro) allowedRouteTypes.push(1);
    if (filter.rail) {
      allowedRouteTypes.push(2, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 117);
    }
    if (filter.bus) allowedRouteTypes.push(3);
    if (filter.ferry) allowedRouteTypes.push(4);

    return allowedRouteTypes;
  }

  /**
   * Load GTFS file and perform light parse to extract filter options
   */
  async loadGTFSFile(file: File): Promise<void> {
    if (!file) {
      return;
    }

    // Reset state
    this.updateState({
      file,
      lightData: null,
      availableAgencies: [],
      availableCategories: [],
      availableRoutes: [],
      selectedAgencies: [],
      selectedCategories: [],
      selectedLines: [],
      filteredAgencies: [],
      filteredCategories: [],
      filteredLines: [],
    });

    try {
      // Convert transport mode filter to route_type numbers
      const allowedRouteTypes = this.convertRouteTypeFilterToNumbers();

      // Light parse - only agencies and routes
      const lightData = await this.gtfsParserService.parseGTFSZipLight(file, allowedRouteTypes);

      // Extract available agencies
      const availableAgencies = lightData.agencies
        .map((a: any) => a.agency_name)
        .filter((name: string, idx: number, arr: string[]) => arr.indexOf(name) === idx)
        .sort();

      // Extract categories from route_desc and route_short_name
      const categorySet = new Set<string>();
      lightData.routes.forEach((route: any) => {
        const desc = (route.route_desc || "").trim();
        if (desc) {
          categorySet.add(desc.toUpperCase());
        } else {
          const shortName = (route.route_short_name || "").trim();
          if (shortName) {
            const match = shortName.match(/^[A-Za-z]+/);
            if (match) {
              categorySet.add(match[0].toUpperCase());
            }
          }
        }
      });
      const availableCategories = Array.from(categorySet).sort();

      // Extract available route names
      const availableRoutes = lightData.routes
        .map((r: any) => r.route_short_name || r.route_long_name || "")
        .filter((name: string, idx: number, arr: string[]) => name && arr.indexOf(name) === idx)
        .sort();

      // Set smart defaults
      const sbbAgency =
        availableAgencies.find(
          (a: string) =>
            a.toUpperCase().includes("SCHWEIZERISCHE") && a.toUpperCase().includes("BUNDESBAHNEN"),
        ) || availableAgencies.find((a: string) => a.toUpperCase().includes("SBB"));

      const defaultCategories = ["EC", "IC", "IR", "RE", "S"];
      const selectedCategories = defaultCategories.filter((cat) =>
        availableCategories.includes(cat),
      );

      this.updateState({
        lightData,
        availableAgencies,
        availableCategories,
        availableRoutes,
        selectedAgencies: sbbAgency ? [sbbAgency] : [],
        selectedCategories,
        selectedLines: [],
        filteredAgencies: [...availableAgencies],
        filteredCategories: [...availableCategories],
        filteredLines: [...availableRoutes],
        serviceDateRange: lightData.serviceDateRange || null,
        filterDialogVisible: true,
      });

      // Update cascading filters
      this.updateAvailableFilters();
    } catch (error: any) {
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
      throw error;
    }
  }

  // Filter management
  addAgency(agency: string): void {
    const state = this.getState();
    if (!state.selectedAgencies.includes(agency)) {
      this.updateState({
        selectedAgencies: [...state.selectedAgencies, agency],
      });
      this.updateAvailableFilters();
    }
  }

  removeAgency(agency: string): void {
    const state = this.getState();
    this.updateState({
      selectedAgencies: state.selectedAgencies.filter((a) => a !== agency),
    });
    this.updateAvailableFilters();
  }

  addCategory(category: string): void {
    const state = this.getState();
    if (!state.selectedCategories.includes(category)) {
      this.updateState({
        selectedCategories: [...state.selectedCategories, category],
      });
      this.updateAvailableFilters();
    }
  }

  removeCategory(category: string): void {
    const state = this.getState();
    this.updateState({
      selectedCategories: state.selectedCategories.filter((c) => c !== category),
    });
    this.updateAvailableFilters();
  }

  addLine(line: string): void {
    const state = this.getState();
    if (!state.selectedLines.includes(line)) {
      this.updateState({
        selectedLines: [...state.selectedLines, line],
      });
    }
  }

  removeLine(line: string): void {
    const state = this.getState();
    this.updateState({
      selectedLines: state.selectedLines.filter((l) => l !== line),
    });
  }

  setSelectedDate(date: string | null): void {
    this.updateState({
      selectedDate: date,
    });
  }

  /**
   * Update available filter options based on selected filters (cascading)
   */
  private updateAvailableFilters(): void {
    const state = this.getState();
    if (!state.lightData) {
      return;
    }

    let filteredRoutes = [...state.lightData.routes];

    // Apply agency filter
    if (state.selectedAgencies.length > 0) {
      const selectedAgencyIds = state.lightData.agencies
        .filter((a: any) => state.selectedAgencies.includes(a.agency_name))
        .map((a: any) => a.agency_id);

      filteredRoutes = filteredRoutes.filter((route: any) =>
        selectedAgencyIds.includes(route.agency_id),
      );
    }

    // Extract available categories from filtered routes
    const categorySet = new Set<string>();
    filteredRoutes.forEach((route: any) => {
      const desc = (route.route_desc || "").trim();
      if (desc) {
        categorySet.add(desc.toUpperCase());
      } else {
        const shortName = (route.route_short_name || "").trim();
        if (shortName) {
          const match = shortName.match(/^[A-Za-z]+/);
          if (match) {
            categorySet.add(match[0].toUpperCase());
          }
        }
      }
    });
    const availableCategories = Array.from(categorySet).sort();

    // Apply category filter
    if (state.selectedCategories.length > 0) {
      filteredRoutes = filteredRoutes.filter((route: any) => {
        const desc = (route.route_desc || "").toUpperCase();
        const shortName = (route.route_short_name || "").toUpperCase();

        return state.selectedCategories.some((cat) => {
          const catUpper = cat.toUpperCase();
          if (desc.includes(catUpper)) {
            return true;
          }
          const prefixMatch = shortName.match(/^[A-Za-z]+/);
          if (prefixMatch && prefixMatch[0] === catUpper) {
            return true;
          }
          return false;
        });
      });
    }

    // Extract available lines from filtered routes
    const availableRoutes = filteredRoutes
      .map((r: any) => r.route_short_name || r.route_long_name || "")
      .filter((name: string, idx: number, arr: string[]) => name && arr.indexOf(name) === idx)
      .sort();

    // Remove selected items that are no longer available
    const selectedCategories = state.selectedCategories.filter((c) =>
      availableCategories.includes(c),
    );
    const selectedLines = state.selectedLines.filter((l) => availableRoutes.includes(l));

    this.updateState({
      availableCategories,
      filteredCategories: [...availableCategories],
      availableRoutes,
      filteredLines: [...availableRoutes],
      selectedCategories,
      selectedLines,
      noCategoriesWarning: availableCategories.length === 0,
      noLinesWarning: availableRoutes.length === 0,
    });
  }

  closeFilterDialog(): void {
    this.updateState({
      filterDialogVisible: false,
      file: null,
      lightData: null,
    });
  }

  /**
   * Apply filters and start full GTFS import
   */
  async applyFiltersAndImport(processNetzgrafikJSON: (dto: NetzgrafikDto) => void): Promise<void> {
    const state = this.getState();
    if (!state.file) {
      return;
    }

    // Close filter dialog, show progress overlay
    this.updateState({
      filterDialogVisible: false,
      importOverlayVisible: true,
      importComplete: false,
      importSummary: null,
      importPhases: JSON.parse(JSON.stringify(DEFAULT_GTFS_IMPORT_PHASES)),
    });

    try {
      const allowedRouteTypes = this.convertRouteTypeFilterToNumbers();

      // PHASE 1: Full GTFS parse
      this.updatePhaseStatus(0, "running", [
        {label: "agency.txt", status: "running" as const},
        {label: "stops.txt", status: "pending" as const},
        {label: "routes.txt", status: "pending" as const},
        {label: "trips.txt", status: "pending" as const},
        {label: "stop_times.txt", status: "pending" as const},
        {label: "calendar.txt", status: "pending" as const},
      ]);

      const gtfsData = await this.gtfsParserService.parseGTFSZip(
        state.file,
        allowedRouteTypes,
        state.selectedAgencies,
        (fileName: string) => {
          // Find the sub-phase for the completed file
          const state = this.getState();
          const subPhases = state.importPhases[0].subPhases;
          const currentIndex = subPhases.findIndex((sp) => sp.label === fileName);

          if (currentIndex >= 0) {
            // Mark current file as completed
            this.updateSubPhaseStatus(0, currentIndex, "completed");

            // Mark next file as running (if exists)
            if (currentIndex + 1 < subPhases.length) {
              this.updateSubPhaseStatus(0, currentIndex + 1, "running");
            }
          }
        },
      );

      // All parsing subphases should be completed via callbacks
      this.updatePhaseStatus(0, "completed");

      this.logger.info(
        $localize`:@@app.view.editor-side-view.editor-tools-view-component.gtfs-converting:Converting GTFS to Netzgrafik format...`,
      );

      // PHASE 2: Apply filters
      this.updatePhaseStatus(1, "running", [
        {label: "Kategorie-Filter", status: "running" as const},
        {label: "Linien-Filter", status: "pending" as const},
        {label: "Knoten-Filter", status: "pending" as const},
      ]);

      // Apply category filter
      if (state.selectedCategories.length > 0) {
        gtfsData.routes = gtfsData.routes.filter((route: any) => {
          const desc = (route.route_desc || "").toUpperCase();
          const shortName = (route.route_short_name || "").toUpperCase();

          return state.selectedCategories.some((cat) => {
            const catUpper = cat.toUpperCase();
            if (desc.includes(catUpper)) {
              return true;
            }
            const prefixMatch = shortName.match(/^[A-Za-z]+/);
            if (prefixMatch && prefixMatch[0] === catUpper) {
              return true;
            }
            return false;
          });
        });

        const validRouteIds = new Set(gtfsData.routes.map((r: any) => r.route_id));
        gtfsData.trips = gtfsData.trips.filter((t: any) => validRouteIds.has(t.route_id));

        const validTripIds = new Set(gtfsData.trips.map((t: any) => t.trip_id));
        gtfsData.stopTimes = gtfsData.stopTimes.filter((st: any) => validTripIds.has(st.trip_id));
      }
      this.updateSubPhaseStatus(1, 0, "completed");

      // Apply line filter
      this.updateSubPhaseStatus(1, 1, "running");

      if (state.selectedLines.length > 0) {
        gtfsData.routes = gtfsData.routes.filter((route: any) => {
          const shortName = (route.route_short_name || "").toUpperCase();
          return state.selectedLines.some((line) => shortName === line.toUpperCase());
        });

        const validRouteIds = new Set(gtfsData.routes.map((r: any) => r.route_id));
        gtfsData.trips = gtfsData.trips.filter((t: any) => validRouteIds.has(t.route_id));

        const validTripIds = new Set(gtfsData.trips.map((t: any) => t.trip_id));
        gtfsData.stopTimes = gtfsData.stopTimes.filter((st: any) => validTripIds.has(st.trip_id));

        const usedStopIds = new Set(gtfsData.stopTimes.map((st: any) => st.stop_id));
        const usedStopIdsWithParents = new Set(usedStopIds);
        gtfsData.stops.forEach((stop: any) => {
          if (usedStopIds.has(stop.stop_id) && stop.parent_station) {
            usedStopIdsWithParents.add(stop.parent_station);
          }
        });
        gtfsData.stops = gtfsData.stops.filter((stop: any) =>
          usedStopIdsWithParents.has(stop.stop_id),
        );
      }
      this.updateSubPhaseStatus(1, 1, "completed");

      // Apply node classification filter
      this.updateSubPhaseStatus(1, 2, "running");

      const activeNodeTypes = Object.keys(state.nodeFilter).filter(
        (key) => state.nodeFilter[key as keyof typeof state.nodeFilter],
      );

      if (activeNodeTypes.length > 0 && activeNodeTypes.length < 5) {
        const acceptedClassifications = new Set(activeNodeTypes);
        gtfsData.stops = gtfsData.stops.filter(
          (stop: any) => !stop.node_type || acceptedClassifications.has(stop.node_type),
        );
      }
      this.updateSubPhaseStatus(1, 2, "completed");
      this.updatePhaseStatus(1, "completed");

      // PHASE 3: Convert to Netzgrafik
      this.updatePhaseStatus(2, "running", [
        {label: "Knoten erstellen", status: "running" as const},
        {label: "Zugläufe konvertieren", status: "pending" as const},
        {label: "Abschnitte generieren", status: "pending" as const},
        {label: "Round-Trip Matching", status: "pending" as const},
        {label: "Layout berechnen", status: "pending" as const},
      ]);

      const existingNetzgrafik = this.dataService.getNetzgrafikDto();
      const existingMetadata = existingNetzgrafik?.metadata;

      let netzgrafikDto: NetzgrafikDto;
      try {
        netzgrafikDto = await this.gtfsConverterService.convertToNetzgrafik(gtfsData, {
          maxTripsPerRoute: 10,
          minStopsPerTrip: 3,
          existingMetadata: existingMetadata,
          timeSyncTolerance: state.timeSyncTolerance,
          labelCreator: (labelText: string) => {
            const label = this.labelService.getOrCreateLabel(labelText, LabelRef.Trainrun);
            return label.getId();
          },
        });

        this.markAllSubPhasesCompleted(2);
        this.updatePhaseStatus(2, "completed");
      } catch (convertError) {
        this.updatePhaseStatus(2, "error");
        throw convertError;
      }

      // PHASE 4: Import into editor
      this.updatePhaseStatus(3, "running");

      processNetzgrafikJSON(netzgrafikDto);

      this.updatePhaseStatus(3, "completed");

      // Generate summary
      const summary = this.generateImportSummary(netzgrafikDto, gtfsData, state.selectedDate);
      this.updateState({
        importSummary: summary,
        importComplete: true,
      });

      this.logger.info(
        $localize`:@@app.view.editor-side-view.editor-tools-view-component.gtfs-success:GTFS data imported successfully`,
      );
    } catch (error: any) {
      this.logger.error("GTFS import failed: " + (error?.message || String(error)));

      // Mark current phase as error
      const currentState = this.getState();
      const runningPhaseIndex = currentState.importPhases.findIndex((p) => p.status === "running");
      if (runningPhaseIndex >= 0) {
        this.updatePhaseStatus(runningPhaseIndex, "error");
      }

      this.updateState({importComplete: true});
    }
  }

  closeImportOverlay(): void {
    this.updateState({
      importOverlayVisible: false,
      importComplete: false,
      importSummary: null,
      importPhases: JSON.parse(JSON.stringify(DEFAULT_GTFS_IMPORT_PHASES)),
    });
  }

  private generateImportSummary(
    netzgrafikDto: NetzgrafikDto,
    gtfsData: any,
    selectedDate: string | null,
  ): GTFSImportSummary {
    const trainruns = netzgrafikDto.trainruns || [];
    const sections = netzgrafikDto.trainrunSections || [];
    const nodes = netzgrafikDto.nodes || [];
    const metadata: any = netzgrafikDto.metadata || {};

    const roundTripCount = trainruns.filter((t: any) => t.direction === "round_trip").length;
    const oneWayCount = trainruns.filter((t: any) => t.direction === "one_way").length;

    const byCategory: Record<string, number> = {};
    const categories = metadata.trainrunCategories || [];
    trainruns.forEach((trainrun: any) => {
      const category = categories.find((c: any) => c.id === trainrun.categoryId);
      if (category) {
        const catName = category.shortName || category.name;
        byCategory[catName] = (byCategory[catName] || 0) + 1;
      }
    });

    const byFrequency: Record<string, number> = {};
    const frequencies = metadata.trainrunFrequencies || [];
    trainruns.forEach((trainrun: any) => {
      const freq = frequencies.find((f: any) => f.id === trainrun.frequencyId);
      if (freq) {
        const freqValue = freq.frequency.toString();
        byFrequency[freqValue] = (byFrequency[freqValue] || 0) + 1;
      }
    });

    const byLabel: Record<string, number> = {};
    const labels = netzgrafikDto.labels || [];
    trainruns.forEach((trainrun: any) => {
      if (trainrun.labelIds && trainrun.labelIds.length > 0) {
        trainrun.labelIds.forEach((labelId: number) => {
          const label = labels.find((l: any) => l.id === labelId);
          if (label) {
            byLabel[label.label] = (byLabel[label.label] || 0) + 1;
          }
        });
      }
    });

    // Generate trip details for selected operating day
    const trainrunToTrips = (netzgrafikDto as any).trainrunToTrips || new Map<number, string[]>();
    const tripDetails = this.generateTripDetails(gtfsData, selectedDate, trainrunToTrips);

    return {
      nodes: nodes.length,
      trainruns: trainruns.length,
      sections: sections.length,
      roundTripCount,
      oneWayCount,
      byCategory,
      byFrequency,
      byLabel,
      tripDetails,
    };
  }

  /**
   * Generate trip details for a specific operating day
   * Shows ALL trips (not just patterns) with full information
   */
  private generateTripDetails(
    gtfsData: any,
    selectedDate: string | null,
    trainrunToTrips: Map<number, string[]>,
  ): any[] {
    if (!selectedDate || !gtfsData) {
      return [];
    }

    // Filter trips by operating day using calendar and calendar_dates
    const activeServiceIds = this.getServiceIdsForDate(
      selectedDate,
      gtfsData.calendar || [],
      gtfsData.calendarDates || [],
    );

    // Filter trips that are active on this date
    const activeTrips = (gtfsData.trips || []).filter((trip: any) =>
      activeServiceIds.has(trip.service_id),
    );

    // Build route map for quick lookup
    const routeMap = new Map<string, any>();
    (gtfsData.routes || []).forEach((route: any) => {
      routeMap.set(route.route_id, route);
    });

    // Build stop times map for stop sequence
    const stopTimesMap = new Map<string, any[]>();
    (gtfsData.stopTimes || []).forEach((st: any) => {
      if (!stopTimesMap.has(st.trip_id)) {
        stopTimesMap.set(st.trip_id, []);
      }
      stopTimesMap.get(st.trip_id)!.push(st);
    });

    // Build stop map for stop names
    const stopMap = new Map<string, any>();
    (gtfsData.stops || []).forEach((stop: any) => {
      stopMap.set(stop.stop_id, stop);
    });

    // Build stop-to-parent-station mapping
    const stopToParent = new Map<string, string>();
    (gtfsData.stops || []).forEach((stop: any) => {
      if (stop.parent_station && stop.parent_station !== "") {
        stopToParent.set(stop.stop_id, stop.parent_station);
      } else {
        stopToParent.set(stop.stop_id, stop.stop_id);
      }
    });

    // Identify system paths (most frequent path per route+direction)
    const systemPaths = this.identifySystemPathsForTrips(activeTrips, stopTimesMap, stopToParent);

    // Create trip details for ALL trips
    const tripDetails = activeTrips
      .map((trip: any) => {
        const route = routeMap.get(trip.route_id);

        // Sort stop times by stop_sequence (within a trip)
        const stopTimes = (stopTimesMap.get(trip.trip_id) || []).sort(
          (a: any, b: any) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence),
        );

        if (stopTimes.length === 0) {
          return null; // Skip trips without stop times
        }

        // Get first and last stops
        const firstStopTime = stopTimes[0];
        const lastStopTime = stopTimes[stopTimes.length - 1];

        const firstStop = stopMap.get(firstStopTime.stop_id);
        const lastStop = stopMap.get(lastStopTime.stop_id);

        // Get parent station IDs for path comparison
        const parentStopSequence = stopTimes.map(
          (st: any) => stopToParent.get(st.stop_id) || st.stop_id,
        );

        // Build stop sequence with names
        const stopSequence = stopTimes.map((st: any) => {
          const stop = stopMap.get(st.stop_id);
          return stop?.stop_name || st.stop_id;
        });

        // Format times (HH:MM)
        const formatTime = (timeStr: string) => {
          if (!timeStr) return "-";
          const parts = timeStr.split(":");
          return `${parts[0]}:${parts[1]}`; // HH:MM
        };

        const startTime = formatTime(firstStopTime.departure_time || firstStopTime.arrival_time);
        const endTime = formatTime(lastStopTime.arrival_time || lastStopTime.departure_time);

        const category = route?.route_desc || route?.route_short_name || "-";
        const frequency = route?.frequency ? `${route.frequency} min` : "-";

        // Check if this trip uses the system path
        const pathKey = `${trip.route_id}_${trip.direction_id || "0"}_${parentStopSequence.join("-")}`;
        const isSystemPath = systemPaths.has(pathKey) && systemPaths.get(pathKey);

        // Determine path variant
        let pathVariant = "Other";
        if (isSystemPath) {
          pathVariant = "System";
        } else {
          // Check if this is a shortened trip
          const systemPathKey = this.findSystemPathKey(
            trip.route_id,
            trip.direction_id || "0",
            systemPaths,
          );
          if (systemPathKey) {
            const systemStops = systemPathKey.split("_")[2].split("-");
            const tripStops = parentStopSequence;

            // Check if trip starts later (shortened at start)
            if (systemStops.length > tripStops.length) {
              const startsAt = systemStops.indexOf(tripStops[0]);
              const endsAt = systemStops.indexOf(tripStops[tripStops.length - 1]);

              if (startsAt > 0 && endsAt === systemStops.length - 1) {
                pathVariant = "Shortened-Start";
              } else if (startsAt === 0 && endsAt < systemStops.length - 1) {
                pathVariant = "Shortened-End";
              } else if (startsAt > 0 && endsAt < systemStops.length - 1) {
                pathVariant = "Shortened-Both";
              }
            }
          }
        }

        // Find trainrun ID for this trip
        let trainrunId: number | null = null;
        for (const [tId, tripIds] of trainrunToTrips.entries()) {
          if (tripIds.includes(trip.trip_id)) {
            trainrunId = tId;
            break;
          }
        }

        return {
          tripId: trip.trip_id,
          routeShortName: route?.route_short_name || "-",
          routeLongName: route?.route_long_name || "-",
          tripHeadsign: trip.trip_headsign || "-",
          category: category,
          frequency: frequency,
          trainrunId: trainrunId,
          direction:
            trip.direction_id === "0"
              ? "Outbound →"
              : trip.direction_id === "1"
                ? "Inbound ↩"
                : "-",
          startStation: firstStop?.stop_name || "-",
          endStation: lastStop?.stop_name || "-",
          startTime: startTime,
          endTime: endTime,
          stopCount: stopTimes.length,
          isSystemPath: isSystemPath,
          pathVariant: pathVariant,
          stopSequence: stopSequence,
        };
      })
      .filter((detail: any) => detail !== null); // Remove null entries

    // Sort by route, direction, then start time
    tripDetails.sort((a: any, b: any) => {
      if (a.routeShortName !== b.routeShortName) {
        return a.routeShortName.localeCompare(b.routeShortName);
      }
      if (a.direction !== b.direction) {
        return a.direction.localeCompare(b.direction);
      }
      return a.startTime.localeCompare(b.startTime);
    });

    return tripDetails;
  }

  /**
   * Identify system paths (most frequent paths) for each route+direction
   */
  private identifySystemPathsForTrips(
    trips: any[],
    stopTimesMap: Map<string, any[]>,
    stopToParent: Map<string, string>,
  ): Map<string, boolean> {
    // Group trips by route+direction and path
    const pathCounts = new Map<string, number>();

    trips.forEach((trip: any) => {
      const stopTimes = (stopTimesMap.get(trip.trip_id) || []).sort(
        (a: any, b: any) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence),
      );

      if (stopTimes.length === 0) return;

      // Get parent station sequence
      const parentStopSequence = stopTimes.map(
        (st: any) => stopToParent.get(st.stop_id) || st.stop_id,
      );

      const pathKey = `${trip.route_id}_${trip.direction_id || "0"}_${parentStopSequence.join("-")}`;
      pathCounts.set(pathKey, (pathCounts.get(pathKey) || 0) + 1);
    });

    // For each route+direction, find the most frequent path
    const routeDirectionPaths = new Map<string, string>(); // route_dir -> most frequent pathKey
    const systemPaths = new Map<string, boolean>();

    pathCounts.forEach((count, pathKey) => {
      const parts = pathKey.split("_");
      const routeDir = `${parts[0]}_${parts[1]}`;

      if (!routeDirectionPaths.has(routeDir)) {
        routeDirectionPaths.set(routeDir, pathKey);
      } else {
        const currentBest = routeDirectionPaths.get(routeDir)!;
        if (count > (pathCounts.get(currentBest) || 0)) {
          routeDirectionPaths.set(routeDir, pathKey);
        }
      }
    });

    // Mark system paths
    pathCounts.forEach((count, pathKey) => {
      const parts = pathKey.split("_");
      const routeDir = `${parts[0]}_${parts[1]}`;
      const systemPath = routeDirectionPaths.get(routeDir);
      systemPaths.set(pathKey, pathKey === systemPath);
    });

    return systemPaths;
  }

  /**
   * Find the system path key for a specific route+direction
   */
  private findSystemPathKey(
    routeId: string,
    directionId: string,
    systemPaths: Map<string, boolean>,
  ): string | null {
    const routeDir = `${routeId}_${directionId}_`;
    for (const [key, isSystem] of systemPaths.entries()) {
      if (key.startsWith(routeDir) && isSystem) {
        return key;
      }
    }
    return null;
  }

  /**
   * Get all service_ids that operate on a specific date
   */
  private getServiceIdsForDate(
    dateStr: string,
    calendar: any[],
    calendarDates: any[],
  ): Set<string> {
    const serviceIds = new Set<string>();
    const targetDate = new Date(dateStr);
    const targetDateStr = dateStr.replace(/-/g, ""); // YYYYMMDD
    const dayOfWeek = targetDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Step 1: Check calendar.txt for regular services
    for (const cal of calendar) {
      const startDate = this.parseGTFSDate(cal.start_date);
      const endDate = this.parseGTFSDate(cal.end_date);

      if (!startDate || !endDate) continue;

      // Check if date is within service period
      if (targetDate >= startDate && targetDate <= endDate) {
        // Check if service runs on this day of week
        const runsOnDay =
          (dayOfWeek === 1 && cal.monday === "1") ||
          (dayOfWeek === 2 && cal.tuesday === "1") ||
          (dayOfWeek === 3 && cal.wednesday === "1") ||
          (dayOfWeek === 4 && cal.thursday === "1") ||
          (dayOfWeek === 5 && cal.friday === "1") ||
          (dayOfWeek === 6 && cal.saturday === "1") ||
          (dayOfWeek === 0 && cal.sunday === "1");

        if (runsOnDay) {
          serviceIds.add(cal.service_id);
        }
      }
    }

    // Step 2: Apply calendar_dates.txt exceptions
    for (const calDate of calendarDates) {
      if (calDate.date === targetDateStr) {
        if (calDate.exception_type === "1") {
          // Service added on this date
          serviceIds.add(calDate.service_id);
        } else if (calDate.exception_type === "2") {
          // Service removed on this date
          serviceIds.delete(calDate.service_id);
        }
      }
    }

    return serviceIds;
  }

  /**
   * Parse GTFS date string (YYYYMMDD) to Date object
   */
  private parseGTFSDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.length !== 8) return null;
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  }

  // Helper methods for phase management
  private updatePhaseStatus(
    phaseIndex: number,
    status: "pending" | "running" | "completed" | "error",
    subPhases?: GTFSSubPhase[],
  ): void {
    const state = this.getState();
    const newPhases = [...state.importPhases];
    newPhases[phaseIndex] = {
      ...newPhases[phaseIndex],
      status,
      ...(subPhases && {subPhases}),
    };
    this.updateState({importPhases: newPhases});
  }

  private updateSubPhaseStatus(
    phaseIndex: number,
    subPhaseIndex: number,
    status: "pending" | "running" | "completed" | "error",
  ): void {
    const state = this.getState();
    const newPhases = [...state.importPhases];
    if (newPhases[phaseIndex].subPhases[subPhaseIndex]) {
      newPhases[phaseIndex].subPhases[subPhaseIndex] = {
        ...newPhases[phaseIndex].subPhases[subPhaseIndex],
        status,
      };
      this.updateState({importPhases: newPhases});
    }
  }

  private markAllSubPhasesCompleted(phaseIndex: number): void {
    const state = this.getState();
    const newPhases = [...state.importPhases];
    newPhases[phaseIndex].subPhases = newPhases[phaseIndex].subPhases.map((sp) => ({
      ...sp,
      status: "completed" as const,
    }));
    this.updateState({importPhases: newPhases});
  }

  // Setters for filters
  updateRouteTypeFilter(filter: Partial<typeof DEFAULT_ROUTE_TYPE_FILTER>): void {
    const state = this.getState();
    this.updateState({
      routeTypeFilter: {...state.routeTypeFilter, ...filter},
    });
  }

  updateNodeFilter(filter: Partial<typeof DEFAULT_NODE_FILTER>): void {
    const state = this.getState();
    this.updateState({
      nodeFilter: {...state.nodeFilter, ...filter},
    });
  }

  updateTimeSyncTolerance(value: number): void {
    this.updateState({timeSyncTolerance: value});
  }
}
