import {Injectable} from "@angular/core";
import {
  GTFSData,
  GTFSParserService,
  GTFSRoute,
  GTFSStop,
  GTFSStopTime,
  GTFSTrip,
} from "./gtfs-parser.service";
import {
  NetzgrafikDto,
  NodeDto,
  TrainrunDto,
  TrainrunSectionDto,
  Direction,
  MetadataDto,
  HaltezeitFachCategories,
  TrainrunCategoryHaltezeit,
  TrainrunCategory,
  TrainrunFrequency,
  TrainrunTimeCategory,
  LabelDto,
  LabelGroupDto,
  LabelRef,
} from "../../data-structures/business.data.structures";
import {
  TrainrunSectionText,
  TrainrunSectionTextPositions,
} from "../../data-structures/technical.data.structures";

/**
 * Interface for a trip pattern (group of trips with same stop sequence)
 */
interface TripPattern {
  routeId: string;
  directionId: string; // GTFS direction_id (0 or 1)
  stopSequence: string[]; // Array of stop IDs in order
  trips: GTFSTrip[];
  stopTimes: Map<string, GTFSStopTime[]>; // trip_id -> stop times
}

/**
 * Service to convert GTFS data to Netzgrafik format
 */
@Injectable({
  providedIn: "root",
})
export class GTFSConverterService {
  // Swiss coordinate system reference point (approximate center)
  private readonly SWISS_CENTER_LAT = 46.8;
  private readonly SWISS_CENTER_LON = 8.2;
  private readonly SCALE_FACTOR = 15000; // Scale factor for coordinate transformation

  private categoryIdCounter = 1;
  private frequencyIdCounter = 1;
  private timeCategoryIdCounter = 1;

  constructor() {}

  /**
   * Map GTFS route_desc to TrainrunCategory, create new if needed
   */
  private mapCategories(
    routes: GTFSRoute[],
    existingMetadata?: MetadataDto,
  ): {
    categories: TrainrunCategory[];
    categoryMap: Map<string, number>;
  } {
    const categories: TrainrunCategory[] = existingMetadata?.trainrunCategories || [];
    const categoryMap = new Map<string, number>();

    // Build existing category maps (by shortName and name)
    const existingCategoryByShortName = new Map<string, TrainrunCategory>();
    const existingCategoryByName = new Map<string, TrainrunCategory>();
    categories.forEach((cat) => {
      if (cat.shortName) {
        existingCategoryByShortName.set(cat.shortName.toUpperCase(), cat);
      }
      if (cat.name) {
        existingCategoryByName.set(cat.name.toUpperCase(), cat);
      }
    });

    // Find highest existing ID to continue numbering
    if (categories.length > 0) {
      const maxId = Math.max(...categories.map((c) => c.id));
      this.categoryIdCounter = maxId + 1;
    }

    // Map each route to a category
    const uniqueDescriptions = new Set<string>();
    routes.forEach((route) => {
      const desc = route.route_desc || route.route_short_name || "Train";
      uniqueDescriptions.add(desc);
    });

    // Create or find category for each unique description
    uniqueDescriptions.forEach((desc) => {
      const normalizedDesc = desc.toUpperCase();
      const shortDesc = desc.substring(0, 10).toUpperCase();

      // Priority 1: Match by shortName (Abkürzung)
      if (existingCategoryByShortName.has(shortDesc)) {
        const existingCategory = existingCategoryByShortName.get(shortDesc)!;
        categoryMap.set(desc, existingCategory.id);
      }
      // Priority 2: Match by full name
      else if (existingCategoryByName.has(normalizedDesc)) {
        const existingCategory = existingCategoryByName.get(normalizedDesc)!;
        categoryMap.set(desc, existingCategory.id);
      }
      // Create new category
      else {
        // Create new category with JAHR000i format
        const newId = 2026_0000 + this.categoryIdCounter++;
        const newCategory: TrainrunCategory = {
          id: newId,
          order: this.categoryIdCounter - 1,
          name: desc,
          shortName: desc.substring(0, 10),
          colorRef: this.getCategoryColor(desc),
          fachCategory: HaltezeitFachCategories.IPV,
          minimalTurnaroundTime: 4,
          nodeHeadwayStop: 2,
          nodeHeadwayNonStop: 2,
          sectionHeadway: 2,
        };
        categories.push(newCategory);
        categoryMap.set(desc, newId);
      }
    });

    // Map routes to categories
    routes.forEach((route) => {
      const desc = route.route_desc || route.route_short_name || "Train";
      route.category_id = categoryMap.get(desc);
    });

    return {categories, categoryMap};
  }

  /**
   * Map GTFS frequencies to Netzgrafik frequencies
   */
  private mapFrequencies(
    routes: GTFSRoute[],
    existingMetadata?: MetadataDto,
  ): {
    frequencies: TrainrunFrequency[];
    frequencyMap: Map<number, number>;
  } {
    const frequencies: TrainrunFrequency[] = existingMetadata?.trainrunFrequencies || [];
    const frequencyMap = new Map<number, number>();

    // Build existing frequency -> ID map
    const existingFreqMap = new Map<number, number>();
    frequencies.forEach((freq) => {
      existingFreqMap.set(freq.frequency, freq.id);
    });

    // Find highest existing ID
    if (frequencies.length > 0) {
      const maxId = Math.max(...frequencies.map((f) => f.id));
      this.frequencyIdCounter = maxId + 1;
    }

    // Get all unique frequencies from routes
    const uniqueFrequencies = new Set<number>();
    const validFrequencies = [15, 20, 30, 60, 120, 121];
    routes.forEach((route) => {
      if (route.frequency) {
        // Validate frequency and normalize to 60 if invalid
        if (!validFrequencies.includes(route.frequency)) {
          console.warn(
            `  ⚠️  Invalid frequency ${route.frequency} in route ${route.route_id}, normalizing to 60`,
          );
          route.frequency = 60;
        }
        uniqueFrequencies.add(route.frequency);
      }
    });

    // Create or find frequency for each unique value
    uniqueFrequencies.forEach((freq) => {
      if (existingFreqMap.has(freq)) {
        // Use existing frequency
        frequencyMap.set(freq, existingFreqMap.get(freq)!);
      } else {
        // Create new frequency with JAHR000i format
        const newId = 2026_0000 + this.frequencyIdCounter++;
        const newFrequency: TrainrunFrequency = {
          id: newId,
          order: this.frequencyIdCounter - 1,
          frequency: freq,
          offset: 0,
          name: freq + " min",
          shortName: freq.toString(),
          linePatternRef: freq.toString() as any,
        };
        frequencies.push(newFrequency);
        frequencyMap.set(freq, newId);
      }
    });

    return {frequencies, frequencyMap};
  }

  /**
   * Get a color for a category based on its name
   */
  private getCategoryColor(categoryName: string): string {
    const name = categoryName.toUpperCase();
    const colorMap: {[key: string]: string} = {
      IC: "EC", // InterCity
      INTERCITY: "EC",
      EC: "EC", // EuroCity
      IR: "IR", // InterRegio
      INTERREGIO: "IR",
      RE: "RE", // RegionalExpress
      REGIONALEXPRESS: "RE",
      R: "R", // Regional
      REGIONAL: "R",
      S: "S", // S-Bahn
      "S-BAHN": "S",
      SBAHN: "S",
      PE: "PE", // Peak Express
      NIGHTJET: "NJ",
      TGV: "EC",
      ICE: "EC",
    };

    // Check if category name contains any keyword
    for (const [key, color] of Object.entries(colorMap)) {
      if (name.includes(key)) {
        return color;
      }
    }

    return "RE"; // Default
  }

  /**
   * Convert GTFS data to Netzgrafik format
   * @param gtfsData Parsed GTFS data
   * @param options Conversion options
   * @param existingMetadata Optional existing metadata to extend
   * @returns NetzgrafikDto
   */
  convertToNetzgrafik(
    gtfsData: GTFSData,
    options: {
      maxTripsPerRoute?: number;
      onlyRegularService?: boolean;
      minStopsPerTrip?: number;
      existingMetadata?: MetadataDto;
      labelCreator?: (labelText: string) => number; // Callback to create labels and return label ID
      timeSyncTolerance?: number; // Tolerance in seconds for round-trip time matching (default: 150)
    } = {},
  ): NetzgrafikDto {
    const maxTripsPerRoute = options.maxTripsPerRoute || 10;
    const minStopsPerTrip = options.minStopsPerTrip || 3;

    // Step 1: Identify trip patterns (group trips with same stop sequence)
    const tripPatterns = this.identifyTripPatterns(gtfsData, minStopsPerTrip);

    // Step 2: Select representative trips from each pattern
    const selectedPatterns = tripPatterns; // Use ALL patterns instead of limiting

    // Step 3: Create nodes from stops used in selected patterns
    const usedStopIds = new Set<string>();
    selectedPatterns.forEach((pattern) => {
      pattern.stopSequence.forEach((stopId) => usedStopIds.add(stopId));
    });

    // The stopSequence contains parent_station IDs (from identifyTripPatterns)
    // Some of these parent_station IDs might NOT exist as actual stops in stops.txt
    // We need to create virtual parent stops for these cases

    const stopMap = new Map<string, GTFSStop>();

    // First, add all existing stops that match usedStopIds
    gtfsData.stops.forEach((stop) => {
      if (usedStopIds.has(stop.stop_id)) {
        stopMap.set(stop.stop_id, stop);
      }
    });

    // Second, create virtual parent stops for missing parent_station IDs
    const missingParentIds = Array.from(usedStopIds).filter((id) => !stopMap.has(id));
    if (missingParentIds.length > 0) {
      missingParentIds.forEach((parentId) => {
        // Find all child platforms that reference this parent
        const children = gtfsData.stops.filter((s) => s.parent_station === parentId);

        if (children.length > 0) {
          // Create virtual parent stop from first child's data
          const firstChild = children[0];
          const virtualParent: GTFSStop = {
            stop_id: parentId,
            stop_name: firstChild.stop_name
              .replace(/\s+(Gleis|Track|Platform|Quai)\s+.*$/i, "")
              .trim(), // Remove platform suffix
            stop_lat: firstChild.stop_lat,
            stop_lon: firstChild.stop_lon,
            location_type: "1", // Station
            parent_station: "", // No parent (is top-level)
          };
          stopMap.set(parentId, virtualParent);
        }
      });
    }

    const nodes = this.createNodes(Array.from(stopMap.values()), gtfsData.stops);

    // Center all node coordinates around (0,0)
    if (nodes.length > 0) {
      const sumX = nodes.reduce((sum, node) => sum + node.positionX, 0);
      const sumY = nodes.reduce((sum, node) => sum + node.positionY, 0);
      const centerX = sumX / nodes.length;
      const centerY = sumY / nodes.length;

      nodes.forEach((node) => {
        node.positionX -= centerX;
        node.positionY -= centerY;
      });
    }

    // Step 4: Create node ID mapping (map GTFS stop_id to Netzgrafik node ID)
    const nodeIdMap = new Map<string, number>();
    const stopsArray = Array.from(stopMap.values());

    // Build stop_id -> parent_station mapping for platforms
    const stopToStation = new Map<string, string>();
    gtfsData.stops.forEach((stop) => {
      if (stop.parent_station && stop.parent_station !== "") {
        stopToStation.set(stop.stop_id, stop.parent_station);
      } else {
        stopToStation.set(stop.stop_id, stop.stop_id);
      }
    });

    // Map each station to its node ID
    stopsArray.forEach((stop, index) => {
      const nodeId = index + 1; // Same ID generation logic as in createNodes
      nodeIdMap.set(stop.stop_id, nodeId);
    });

    // Also map all platforms to their parent station's node ID
    gtfsData.stops.forEach((stop) => {
      if (stop.parent_station && stop.parent_station !== "") {
        const parentNodeId = nodeIdMap.get(stop.parent_station);
        if (parentNodeId) {
          // Map platform ID to parent station's node ID
          nodeIdMap.set(stop.stop_id, parentNodeId);
        }
      }
    });

    // Step 4.5: Map categories and frequencies
    const {categories, categoryMap} = this.mapCategories(gtfsData.routes, options.existingMetadata);
    const {frequencies, frequencyMap} = this.mapFrequencies(
      gtfsData.routes,
      options.existingMetadata,
    );

    // Create default time category if needed
    const timeCategories: TrainrunTimeCategory[] = options.existingMetadata
      ?.trainrunTimeCategories || [
      {
        id: 20260001,
        order: 0,
        name: "7/24",
        shortName: "7/24",
        dayTimeInterval: [],
        weekday: [1, 2, 3, 4, 5, 6, 7],
        linePatternRef: "7/24" as any,
      },
    ];
    const defaultTimeCategoryId = timeCategories[0].id;

    // Step 5: Create trainruns and trainrun sections
    const trainruns: TrainrunDto[] = [];
    const trainrunSections: TrainrunSectionDto[] = [];
    const routeMap = new Map<string, GTFSRoute>();
    gtfsData.routes.forEach((route) => routeMap.set(route.route_id, route));

    let trainrunId = 1;
    let sectionId = 1;

    selectedPatterns.forEach((pattern, patternIndex) => {
      const route = routeMap.get(pattern.routeId);

      const representativeTrip = pattern.trips[0];
      const stopTimes = pattern.stopTimes.get(representativeTrip.trip_id);
      if (!stopTimes || stopTimes.length < 2) {
        return;
      }

      // Get category and frequency IDs
      const routeDesc = route.route_desc || route.route_short_name || "Train";
      const categoryId = categoryMap.get(routeDesc) || categories[0]?.id || 1;
      const frequencyId = route.frequency
        ? frequencyMap.get(route.frequency) || frequencies[0]?.id || 1
        : frequencies[0]?.id || 1;

      // Create trainrun with direction and destination in name
      const directionSuffix = pattern.directionId === "1" ? " ↩" : " →";
      const headsign = representativeTrip.trip_headsign || "";
      const tripShortName = representativeTrip.trip_short_name || "";

      // Build name: "15 → Luzern (2505)" or "15 → Luzern" or "15 →"
      // Remove category prefix from route name to avoid duplication in display (e.g., "IR" + "IR15" → "IRIR15")
      let routeName = route.route_short_name || route.route_long_name || `Trip ${patternIndex + 1}`;
      const categoryPrefix = routeDesc.trim();
      if (routeName.toUpperCase().startsWith(categoryPrefix.toUpperCase())) {
        routeName = routeName.substring(categoryPrefix.length).trim();
      }

      let trainrunName = routeName;

      if (headsign) {
        trainrunName += ` → ${headsign}`;
      } else {
        trainrunName += directionSuffix;
      }

      if (tripShortName) {
        trainrunName += ` (${tripShortName})`;
      }

      // Create debug label showing GTFS route info
      const labelIds: number[] = [];
      if (options.labelCreator) {
        // Get first and last stop names for the label
        const firstStopId = pattern.stopSequence[0];
        const lastStopId = pattern.stopSequence[pattern.stopSequence.length - 1];
        const firstStop = gtfsData.stops.find((s) => s.stop_id === firstStopId);
        const lastStop = gtfsData.stops.find((s) => s.stop_id === lastStopId);
        const firstStopName = firstStop?.stop_name || firstStopId;
        const lastStopName = lastStop?.stop_name || lastStopId;

        // Format: "IR15 → Genf → Luzern" or "IR15 → Luzern → Genf"
        const debugLabel = `${routeName} → ${firstStopName} → ${lastStopName}`;
        const labelId = options.labelCreator(debugLabel);
        labelIds.push(labelId);
      }

      const trainrun: TrainrunDto = {
        id: trainrunId++,
        name: trainrunName,
        categoryId: categoryId,
        frequencyId: frequencyId,
        trainrunTimeCategoryId: defaultTimeCategoryId,
        labelIds: labelIds,
        direction: Direction.ONE_WAY,
      };
      trainruns.push(trainrun);

      // Create trainrun sections
      // Process all stations in sequence, including non-stop (through) stations
      let sectionsCreated = 0;

      // Group consecutive stops by station (parent_station)
      // Each group represents one station with potentially multiple platforms
      const stationGroups: {
        nodeId: number;
        stops: GTFSStopTime[];
        isStop: boolean; // true if at least one platform allows boarding/alighting
      }[] = [];

      let currentGroup: (typeof stationGroups)[0] | null = null;

      for (const stopTime of stopTimes) {
        const nodeId = nodeIdMap.get(stopTime.stop_id);
        if (!nodeId) continue;

        // Check if this is an actual stop (not a through-run)
        const isStop = stopTime.pickup_type !== "1" || stopTime.drop_off_type !== "1";

        if (!currentGroup || currentGroup.nodeId !== nodeId) {
          // Start a new station group
          if (currentGroup) {
            stationGroups.push(currentGroup);
          }
          currentGroup = {
            nodeId,
            stops: [stopTime],
            isStop: isStop,
          };
        } else {
          // Add to current group
          currentGroup.stops.push(stopTime);
          // If ANY platform in this station allows boarding/alighting, mark as stop
          currentGroup.isStop = currentGroup.isStop || isStop;
        }
      }

      // Don't forget the last group
      if (currentGroup) {
        stationGroups.push(currentGroup);
      }

      // DEBUG: Print stop sequence with station names
      stationGroups.forEach((group, idx) => {
        // Get node info
        const node = nodes.find((n) => n.id === group.nodeId);
        const nodeName = node ? node.betriebspunktName : `Node#${group.nodeId}`;
        const nodeFullName = node ? node.fullName : "";

        // Get first stop time for this station
        const firstStop = group.stops[0];
        const arrivalTime = GTFSParserService.timeToMinutes(firstStop.arrival_time);
        const departureTime = GTFSParserService.timeToMinutes(
          firstStop.departure_time || firstStop.arrival_time,
        );

        const stopType = group.isStop ? "🔵 HALT" : "🔴 DURCH";
        const timeStr = group.isStop
          ? `${Math.floor(arrivalTime / 60)
              .toString()
              .padStart(2, "0")}:${(arrivalTime % 60).toString().padStart(2, "0")} - ${Math.floor(
              departureTime / 60,
            )
              .toString()
              .padStart(2, "0")}:${(departureTime % 60).toString().padStart(2, "0")}`
          : `${Math.floor(arrivalTime / 60)
              .toString()
              .padStart(2, "0")}:${(arrivalTime % 60).toString().padStart(2, "0")} (durch)`;
      });

      // Create sections between consecutive stations
      for (let i = 0; i < stationGroups.length - 1; i++) {
        const sourceGroup = stationGroups[i];
        const targetGroup = stationGroups[i + 1];

        // Get the last stop time in source station (departure)
        const sourceStop = sourceGroup.stops[sourceGroup.stops.length - 1];
        // Get the first stop time in target station (arrival)
        const targetStop = targetGroup.stops[0];

        const departureTime = GTFSParserService.timeToMinutes(
          sourceStop.departure_time || sourceStop.arrival_time,
        );
        const arrivalTime = GTFSParserService.timeToMinutes(
          targetStop.arrival_time || targetStop.departure_time,
        );
        const travelTime = this.calculateTravelTime(departureTime, arrivalTime);

        // Get node names for debug output
        const sourceNode = nodes.find((n) => n.id === sourceGroup.nodeId);
        const targetNode = nodes.find((n) => n.id === targetGroup.nodeId);

        // === STEP 1: ENFORCE SYMMETRY (60-x rule) ===
        // Extract minutes ONLY (0-59) for forward direction from GTFS
        const sourceDep_minute = departureTime % 60; // Forward: source departure (e.g., :05)
        const targetArr_minute = arrivalTime % 60; // Forward: target arrival (e.g., :52)

        // Calculate backward (return) times using 60-x symmetry
        const sourceArr_minute = (60 - sourceDep_minute) % 60; // Backward: source arrival = 60-5 = :55
        const targetDep_minute = (60 - targetArr_minute) % 60; // Backward: target departure = 60-52 = :08

        const section: TrainrunSectionDto = {
          id: sectionId++,
          sourceNodeId: sourceGroup.nodeId,
          sourcePortId: 0,
          targetNodeId: targetGroup.nodeId,
          targetPortId: 0,
          sourceSymmetry: false,
          targetSymmetry: false,
          // SYMMETRISCHE ZEITEN (60-x Regel für ONE_WAY):
          sourceArrival: {
            time: sourceArr_minute,
            consecutiveTime: 0,
            lock: false,
            warning: null,
            timeFormatter: null,
          }, // Backward: 60 - sourceDep
          sourceDeparture: {
            time: sourceDep_minute,
            consecutiveTime: 0,
            lock: false,
            warning: null,
            timeFormatter: null,
          }, // Forward: GTFS minute
          targetArrival: {
            time: targetArr_minute,
            consecutiveTime: 0,
            lock: false,
            warning: null,
            timeFormatter: null,
          }, // Forward: GTFS minute
          targetDeparture: {
            time: targetDep_minute,
            consecutiveTime: 0,
            lock: false,
            warning: null,
            timeFormatter: null,
          }, // Backward: 60 - targetArr
          travelTime: {
            time: travelTime,
            consecutiveTime: 0,
            lock: false,
            warning: null,
            timeFormatter: null,
          }, // FULL minutes from GTFS (can be > 60)
          backwardTravelTime: {
            time: travelTime,
            consecutiveTime: 0,
            lock: false,
            warning: null,
            timeFormatter: null,
          }, // Same as forward
          numberOfStops: 0, // No intermediate stops between consecutive stations in this model
          trainrunId: trainrun.id,
          resourceId: 0,
          specificTrainrunSectionFrequencyId: null,
          path: undefined,
          warnings: [],
        };
        trainrunSections.push(section);
        sectionsCreated++;
      }
    });

    // Step 5.1: Match and merge round-trip patterns
    const timeSyncTolerance = options.timeSyncTolerance || 150; // seconds

    // Build trainrun -> pattern map
    const trainrunToPattern = new Map<number, TripPattern>();
    selectedPatterns.forEach((pattern, index) => {
      // Trainrun IDs start at 1, and match pattern order
      const trainrunId = index + 1;
      if (trainruns.find((t) => t.id === trainrunId)) {
        trainrunToPattern.set(trainrunId, pattern);
      }
    });

    const matchingStatus = this.matchAndMergeRoundTrips(
      trainruns,
      trainrunSections,
      trainrunToPattern,
      gtfsData,
      timeSyncTolerance,
    );

    const roundTripCount = trainruns.filter((t) => t.direction === Direction.ROUND_TRIP).length;
    const oneWayCount = trainruns.filter((t) => t.direction === Direction.ONE_WAY).length;

    // Step 5.2: Create labels for round-trip matching status
    const {labels, labelGroup} = this.createMatchingStatusLabels(trainruns, matchingStatus);

    // Step 5.5: Apply topology-preserving spring layout
    const edgeLengthBefore = this.calculateEdgeLengthRange(nodes, trainrunSections);

    // Initial proportional scaling to get into reasonable range
    const avgEdgeLength = this.calculateAverageEdgeLength(nodes, trainrunSections);
    if (avgEdgeLength > 0) {
      const initialScale = 500 / avgEdgeLength;
      nodes.forEach((node) => {
        node.positionX *= initialScale;
        node.positionY *= initialScale;
      });
    }

    // Apply spring layout with topology preservation
    this.applyTopologyPreservingSpringLayout(nodes, trainrunSections, {
      idealEdgeLength: 500,
      iterations: 100,
      springStrength: 0.05,
      dampingFactor: 0.9,
    });

    const edgeLengthAfter = this.calculateEdgeLengthRange(nodes, trainrunSections);

    const xCoords = nodes.map((n) => n.positionX);
    const yCoords = nodes.map((n) => n.positionY);

    // Step 6: Create metadata

    const metadata: MetadataDto = {
      trainrunCategories: categories,
      trainrunFrequencies: frequencies,
      trainrunTimeCategories: timeCategories,
      netzgrafikColors: options.existingMetadata?.netzgrafikColors || this.createDefaultColors(),
      analyticsSettings: options.existingMetadata?.analyticsSettings || {
        originDestinationSettings: {
          connectionPenalty: 5,
        },
      },
    };

    // Step 7: Create NetzgrafikDto
    const netzgrafikDto: NetzgrafikDto = {
      nodes: nodes,
      trainrunSections: trainrunSections,
      trainruns: trainruns,
      resources: [],
      metadata: metadata,
      freeFloatingTexts: [],
      labels: labels,
      labelGroups: [labelGroup],
      filterData: {
        filterSettings: [],
      },
    };

    return netzgrafikDto;
  }

  /**
   * Create labels for round-trip matching status
   * Returns labels and a label group for filtering trainruns by matching status
   */
  private createMatchingStatusLabels(
    trainruns: TrainrunDto[],
    matchingStatus: Map<number, string>,
  ): {labels: LabelDto[]; labelGroup: LabelGroupDto} {
    // Create the label group for matching status
    const labelGroup: LabelGroupDto = {
      id: 1,
      name: "Round-Trip Matching",
      labelRef: LabelRef.Trainrun,
    };

    // Collect all unique status messages
    const statusMessages = new Set<string>();
    matchingStatus.forEach((status) => {
      // Don't create label for merged trainruns (they no longer exist)
      if (status !== "✓ Round-Trip (merged)") {
        statusMessages.add(status);
      }
    });

    // Create a label for each status message
    const labels: LabelDto[] = [];
    let labelIdCounter = 1;
    const statusToLabelId = new Map<string, number>();

    statusMessages.forEach((status) => {
      const label: LabelDto = {
        id: labelIdCounter,
        label: status,
        labelGroupId: labelGroup.id,
        labelRef: LabelRef.Trainrun,
      };
      labels.push(label);
      statusToLabelId.set(status, labelIdCounter);
      labelIdCounter++;
    });

    // Assign labels to trainruns based on their matching status
    trainruns.forEach((trainrun) => {
      const status = matchingStatus.get(trainrun.id);
      if (status && status !== "✓ Round-Trip (merged)") {
        const labelId = statusToLabelId.get(status);
        if (labelId !== undefined && !trainrun.labelIds.includes(labelId)) {
          trainrun.labelIds.push(labelId);
        }
      }
    });

    return {labels, labelGroup};
  }

  /**
   * Match and merge round-trip patterns
   * Finds pairs of patterns that can be combined into ROUND_TRIP trainruns
   * Returns a map of trainrun IDs to matching failure reasons (or "✓ Round-Trip" for success)
   */
  private matchAndMergeRoundTrips(
    trainruns: TrainrunDto[],
    trainrunSections: TrainrunSectionDto[],
    trainrunToPattern: Map<number, TripPattern>,
    gtfsData: GTFSData,
    timeSyncTolerance: number,
  ): Map<number, string> {
    const routeMap = new Map<string, GTFSRoute>();
    gtfsData.routes.forEach((r) => routeMap.set(r.route_id, r));

    const matched = new Set<number>(); // Track which trainruns have been merged
    const matchingStatus = new Map<number, string>(); // trainrun ID -> status message
    let mergeCount = 0;

    // For each trainrun, try to find its reverse pattern
    for (let i = 0; i < trainruns.length; i++) {
      if (matched.has(i)) continue; // Already merged

      const trainrun1 = trainruns[i];
      const pattern1 = trainrunToPattern.get(trainrun1.id);
      if (!pattern1) {
        matchingStatus.set(trainrun1.id, "⊚ No pattern data");
        continue;
      }

      const route1 = routeMap.get(pattern1.routeId);
      if (!route1) {
        matchingStatus.set(trainrun1.id, "⊚ Route not found");
        continue;
      }

      let foundMatch = false;

      // Search for matching reverse pattern
      for (let j = i + 1; j < trainruns.length; j++) {
        if (matched.has(j)) continue;

        const trainrun2 = trainruns[j];
        const pattern2 = trainrunToPattern.get(trainrun2.id);
        if (!pattern2) continue;

        const route2 = routeMap.get(pattern2.routeId);
        if (!route2) continue;

        // Check matching criteria (returns null if match, error message if no match)
        const failureReason = this.checkRoundTripMatch(
          pattern1,
          pattern2,
          route1,
          route2,
          trainrun1,
          trainrun2,
          trainrunSections,
          timeSyncTolerance,
        );

        if (failureReason === null) {
          // Success! Merge the trainruns
          // Merge: Keep trainrun1, remove trainrun2
          trainrun1.direction = Direction.ROUND_TRIP;
          trainrun1.labelIds = [...trainrun1.labelIds, ...trainrun2.labelIds]; // Combine labels

          // Mark both as successfully matched
          matchingStatus.set(trainrun1.id, "✓ Round-Trip");
          matchingStatus.set(trainrun2.id, "✓ Round-Trip (merged)");

          // Mark trainrun2 for deletion
          matched.add(j);
          mergeCount++;
          foundMatch = true;

          break; // Found match for this trainrun, move to next
        }
      }

      // If no match was found, record why the first attempt failed
      if (!foundMatch) {
        // Try to find the best failure reason by checking against the most likely candidate
        let bestFailureReason = "⊚ No reverse pattern";
        for (let j = i + 1; j < trainruns.length; j++) {
          if (matched.has(j)) continue;

          const trainrun2 = trainruns[j];
          const pattern2 = trainrunToPattern.get(trainrun2.id);
          if (!pattern2) continue;

          const route2 = routeMap.get(pattern2.routeId);
          if (!route2) continue;

          // Check if this is a potential match for the same route
          if (pattern1.routeId === pattern2.routeId) {
            const failureReason = this.checkRoundTripMatch(
              pattern1,
              pattern2,
              route1,
              route2,
              trainrun1,
              trainrun2,
              trainrunSections,
              timeSyncTolerance,
            );
            if (failureReason !== null) {
              bestFailureReason = failureReason;
              break; // Found a same-route failure
            }
          }
        }
        matchingStatus.set(trainrun1.id, bestFailureReason);
      }
    }

    // Remove matched trainruns (in reverse order to preserve indices)
    const indicesToRemove = Array.from(matched).sort((a, b) => b - a);
    for (const index of indicesToRemove) {
      const removedTrainrun = trainruns[index];
      // Remove trainrun
      trainruns.splice(index, 1);

      // Remove associated sections
      const sectionsToRemove = trainrunSections.filter((s) => s.trainrunId === removedTrainrun.id);
      sectionsToRemove.forEach((section) => {
        const sectionIndex = trainrunSections.indexOf(section);
        if (sectionIndex >= 0) {
          trainrunSections.splice(sectionIndex, 1);
        }
      });
    }

    return matchingStatus;
  }

  /**
   * Check if two patterns can be merged into a round-trip
   * Returns null if patterns match, or a string describing the failure reason
   */
  /**
   * Check if two patterns can be merged into a round-trip
   * Returns null if patterns match, or a string describing the failure reason
   */
  private checkRoundTripMatch(
    pattern1: TripPattern,
    pattern2: TripPattern,
    route1: GTFSRoute,
    route2: GTFSRoute,
    trainrun1: TrainrunDto,
    trainrun2: TrainrunDto,
    trainrunSections: TrainrunSectionDto[],
    timeSyncTolerance: number,
  ): string | null {
    // 1. Same route_id
    if (pattern1.routeId !== pattern2.routeId) {
      return "✗ Different route";
    }

    // 2. Same category (route_desc)
    const category1 = route1.route_desc || route1.route_short_name || "";
    const category2 = route2.route_desc || route2.route_short_name || "";
    if (category1 !== category2) {
      return "✗ Different category";
    }

    // 3. Same frequency
    if (route1.frequency !== route2.frequency) {
      return "✗ Different frequency";
    }

    // 4. Different direction_id
    if (pattern1.directionId === pattern2.directionId) {
      return "✗ Same direction";
    }

    // 5. Reversed stopSequence
    const reversed2 = [...pattern2.stopSequence].reverse();
    if (pattern1.stopSequence.length !== reversed2.length) {
      return "✗ Path mismatch";
    }

    let pathMismatch = -1;
    for (let i = 0; i < pattern1.stopSequence.length; i++) {
      if (pattern1.stopSequence[i] !== reversed2[i]) {
        pathMismatch = i;
        break;
      }
    }

    if (pathMismatch >= 0) {
      return "✗ Path mismatch";
    }

    // 6. Check time symmetry with tolerance
    const sections1 = trainrunSections.filter((s) => s.trainrunId === trainrun1.id);
    const sections2 = trainrunSections.filter((s) => s.trainrunId === trainrun2.id);

    if (sections1.length !== sections2.length) {
      return "✗ Section count mismatch";
    }

    // Check each corresponding section pair for symmetry
    for (let i = 0; i < sections1.length; i++) {
      const sec1 = sections1[i];
      const sec2 = sections2[sections2.length - 1 - i]; // Reversed order

      // Check source departure symmetry
      const sourceDep1 = sec1.sourceDeparture.time;
      const targetArr2 = sec2.targetArrival.time;
      const expectedArr2 = (60 - sourceDep1) % 60;
      const diffSource = Math.min(
        Math.abs(targetArr2 - expectedArr2),
        60 - Math.abs(targetArr2 - expectedArr2), // Handle wrap-around (e.g., 59 vs 1)
      );

      if (diffSource * 60 > timeSyncTolerance) {
        return "✗ Time symmetry failed";
      }

      // Check target arrival symmetry
      const targetArr1 = sec1.targetArrival.time;
      const sourceDep2 = sec2.sourceDeparture.time;
      const expectedDep2 = (60 - targetArr1) % 60;
      const diffTarget = Math.min(
        Math.abs(sourceDep2 - expectedDep2),
        60 - Math.abs(sourceDep2 - expectedDep2),
      );

      if (diffTarget * 60 > timeSyncTolerance) {
        return "✗ Time symmetry failed";
      }
    }

    // All checks passed!
    return null;
  }

  /**
   * Identify trip patterns by grouping trips with same stop sequence
   */
  private identifyTripPatterns(gtfsData: GTFSData, minStopsPerTrip: number): TripPattern[] {
    const patterns = new Map<string, TripPattern>();

    // Build stop_id -> station mapping (use parent_station if available)
    const stopToStation = new Map<string, string>();
    gtfsData.stops.forEach((stop) => {
      // If this stop has a parent_station, map to parent
      // Otherwise, map to itself
      if (stop.parent_station && stop.parent_station !== "") {
        stopToStation.set(stop.stop_id, stop.parent_station);
      } else {
        stopToStation.set(stop.stop_id, stop.stop_id);
      }
    });

    // Group stop times by trip
    const stopTimesByTrip = new Map<string, GTFSStopTime[]>();
    gtfsData.stopTimes.forEach((stopTime) => {
      if (!stopTimesByTrip.has(stopTime.trip_id)) {
        stopTimesByTrip.set(stopTime.trip_id, []);
      }
      stopTimesByTrip.get(stopTime.trip_id)!.push(stopTime);
    });

    // Sort stop times by departure time (chronological), then by sequence as fallback
    stopTimesByTrip.forEach((stopTimes, tripId) => {
      const beforeSort = stopTimes.map((st) => `${st.stop_id}@${st.departure_time}`).join(" → ");

      stopTimes.sort((a, b) => {
        // Primary: sort by departure time (chronological)
        const timeA = GTFSParserService.timeToMinutes(a.departure_time || a.arrival_time);
        const timeB = GTFSParserService.timeToMinutes(b.departure_time || b.arrival_time);

        if (timeA !== timeB) {
          return timeA - timeB;
        }

        // Secondary: sort by stop_sequence if times are equal
        return parseInt(a.stop_sequence) - parseInt(b.stop_sequence);
      });

      const afterSort = stopTimes.map((st) => `${st.stop_id}@${st.departure_time}`).join(" → ");
    });

    // Create patterns
    let processedTrips = 0;
    let skippedTrips = 0;
    gtfsData.trips.forEach((trip) => {
      processedTrips++;
      const stopTimes = stopTimesByTrip.get(trip.trip_id);
      if (!stopTimes || stopTimes.length < minStopsPerTrip) {
        skippedTrips++;
        return;
      }

      // Use parent_station IDs for stop sequence (map platforms to their parent stations)
      const stopSequence = stopTimes.map((st) => stopToStation.get(st.stop_id) || st.stop_id);
      const directionId = trip.direction_id || "0";
      const patternKey = `${trip.route_id}_${directionId}_${stopSequence.join("-")}`;

      if (!patterns.has(patternKey)) {
        patterns.set(patternKey, {
          routeId: trip.route_id,
          directionId: directionId,
          stopSequence: stopSequence,
          trips: [],
          stopTimes: new Map(),
        });
      }

      const pattern = patterns.get(patternKey)!;
      pattern.trips.push(trip);
      pattern.stopTimes.set(trip.trip_id, stopTimes);
    });

    return Array.from(patterns.values());
  }

  /**
   * Create nodes from GTFS stops
   * Only uses station-level stops (location_type=1 or no parent_station)
   * Filters out platforms/tracks
   */
  private createNodes(stationStops: GTFSStop[], allStops: GTFSStop[]): NodeDto[] {
    // Filter to only station-level stops (Betriebspunkte)
    const stations = stationStops.filter(
      (stop) => stop.location_type === "1" || !stop.parent_station || stop.parent_station === "",
    );

    return stations.map((station, index) => {
      const coords = this.convertCoordinates(
        parseFloat(station.stop_lat),
        parseFloat(station.stop_lon),
      );

      // Find all platforms/tracks that belong to this station
      const platforms = allStops.filter(
        (stop) => stop.parent_station === station.stop_id && stop.stop_id !== station.stop_id,
      );

      // Build fullName with platform count
      const fullName =
        platforms.length > 0
          ? `${station.stop_name} -> #Platform (${platforms.length})`
          : station.stop_name;

      // Use station name as betriebspunktName (truncate if too long)
      const betriebspunktName =
        station.stop_name.length <= 50 ? station.stop_name : station.stop_name.substring(0, 50);

      return {
        id: index + 1,
        betriebspunktName: betriebspunktName,
        fullName: fullName,
        positionX: coords.x,
        positionY: coords.y,
        ports: [], // Empty array - 3rd party detection will trigger because ALL nodes have empty ports
        transitions: [], // Empty array - will be created during 3rd party import
        connections: [], // Empty array - will be created during 3rd party import
        resourceId: 0,
        perronkanten: 2,
        connectionTime: 4,
        trainrunCategoryHaltezeiten: this.createDefaultHaltezeiten(),
        symmetryAxis: 0,
        warnings: [],
        labelIds: [],
      };
    });
  }

  /**
   * Create a short stop code from GTFS stop
   */
  private createStopCode(stop: GTFSStop): string {
    // Use stop_id, or create from stop_name
    if (stop.stop_id.length <= 8) {
      return stop.stop_id;
    }

    // Create abbreviation from stop name
    const words = stop.stop_name.split(/\s+/);
    if (words.length === 1) {
      return stop.stop_name.substring(0, 8).toUpperCase();
    }

    // Use initials
    let code = words
      .map((w) => w[0])
      .join("")
      .toUpperCase();

    if (code.length > 8) {
      code = code.substring(0, 8);
    }

    return code;
  }

  /**
   * Convert lat/lon coordinates to canvas coordinates
   */
  private convertCoordinates(lat: number, lon: number): {x: number; y: number} {
    // Simple mercator-like projection centered on Switzerland
    const x = (lon - this.SWISS_CENTER_LON) * this.SCALE_FACTOR;
    const y = -(lat - this.SWISS_CENTER_LAT) * this.SCALE_FACTOR; // Invert Y axis

    return {x, y};
  }

  /**
   * Calculate travel time in minutes
   */
  private calculateTravelTime(departureMinutes: number, arrivalMinutes: number): number {
    let travelTime = arrivalMinutes - departureMinutes;
    if (travelTime < 0) {
      travelTime += 24 * 60; // Handle midnight crossing
    }
    return travelTime;
  }

  /**
   * Count intermediate stops between two station stops (excluding through-runs)
   * A stop is counted if it's NOT a through-run (pickup_type != '1' OR drop_off_type != '1')
   * AND it belongs to a different station (parent_station) than source and target
   * @param stopTimes All stop times for the trip, sorted by stop_sequence
   * @param startIndex Index of the source stop
   * @param endIndex Index of the target stop
   * @param nodeIdMap Map from stop_id to node_id (to identify which station each stop belongs to)
   * @param sourceNodeId Node ID of the source station
   * @param targetNodeId Node ID of the target station
   * @returns Number of actual intermediate stops at different stations (excluding through-runs and same-station stops)
   */
  private countIntermediateStops(
    stopTimes: GTFSStopTime[],
    startIndex: number,
    endIndex: number,
    nodeIdMap: Map<string, number>,
    sourceNodeId: number,
    targetNodeId: number,
  ): number {
    let count = 0;
    // Count stops between startIndex and endIndex (exclusive)
    for (let i = startIndex + 1; i < endIndex; i++) {
      const stop = stopTimes[i];

      // Get the node (station) this stop belongs to
      const stopNodeId = nodeIdMap.get(stop.stop_id);
      if (!stopNodeId) continue;

      // Skip if this stop belongs to the same station as source or target
      if (stopNodeId === sourceNodeId || stopNodeId === targetNodeId) {
        continue;
      }

      // A stop is counted if passengers CAN board OR alight (not a through-run)
      // through-run: pickup_type === '1' AND drop_off_type === '1'
      const isActualStop = stop.pickup_type !== "1" || stop.drop_off_type !== "1";
      if (isActualStop) {
        count++;
      }
    }
    return count;
  }

  /**
   * Create default Haltezeiten object
   */
  private createDefaultHaltezeiten(): TrainrunCategoryHaltezeit {
    return {
      [HaltezeitFachCategories.IPV]: {haltezeit: 2, no_halt: false},
      [HaltezeitFachCategories.A]: {haltezeit: 2, no_halt: false},
      [HaltezeitFachCategories.B]: {haltezeit: 2, no_halt: false},
      [HaltezeitFachCategories.C]: {haltezeit: 2, no_halt: false},
      [HaltezeitFachCategories.D]: {haltezeit: 2, no_halt: false},
      [HaltezeitFachCategories.Uncategorized]: {haltezeit: 0, no_halt: true},
    };
  }

  /**
   * Create default text positions for path
   */
  private createDefaultTextPositions(): TrainrunSectionTextPositions {
    const defaultPoint = {x: 0, y: 0};
    return {
      [TrainrunSectionText.SourceArrival]: defaultPoint,
      [TrainrunSectionText.SourceDeparture]: defaultPoint,
      [TrainrunSectionText.TargetArrival]: defaultPoint,
      [TrainrunSectionText.TargetDeparture]: defaultPoint,
      [TrainrunSectionText.TrainrunSectionName]: defaultPoint,
      [TrainrunSectionText.TrainrunSectionTravelTime]: defaultPoint,
      [TrainrunSectionText.TrainrunSectionBackwardTravelTime]: defaultPoint,
      [TrainrunSectionText.TrainrunSectionNumberOfStops]: defaultPoint,
    };
  }

  /**
   * Calculate average edge length
   */
  private calculateAverageEdgeLength(nodes: NodeDto[], sections: TrainrunSectionDto[]): number {
    if (sections.length === 0) return 0;

    let totalLength = 0;
    sections.forEach((section) => {
      const n1 = nodes.find((n) => n.id === section.sourceNodeId);
      const n2 = nodes.find((n) => n.id === section.targetNodeId);
      if (!n1 || !n2) return;

      const dx = n2.positionX - n1.positionX;
      const dy = n2.positionY - n1.positionY;
      totalLength += Math.sqrt(dx * dx + dy * dy);
    });

    return totalLength / sections.length;
  }

  /**
   * Calculate min and max edge lengths
   */
  private calculateEdgeLengthRange(
    nodes: NodeDto[],
    sections: TrainrunSectionDto[],
  ): {min: number; max: number} {
    let min = Infinity;
    let max = 0;

    sections.forEach((section) => {
      const n1 = nodes.find((n) => n.id === section.sourceNodeId);
      const n2 = nodes.find((n) => n.id === section.targetNodeId);
      if (!n1 || !n2) return;

      const dx = n2.positionX - n1.positionX;
      const dy = n2.positionY - n1.positionY;
      const length = Math.sqrt(dx * dx + dy * dy);

      min = Math.min(min, length);
      max = Math.max(max, length);
    });

    return {min: min === Infinity ? 0 : min, max};
  }

  /**
   * Apply topology-preserving spring layout
   * Only adjusts connected nodes to approach ideal edge length
   * No global repulsion - preserves geographic structure
   */
  private applyTopologyPreservingSpringLayout(
    nodes: NodeDto[],
    sections: TrainrunSectionDto[],
    config: {
      idealEdgeLength: number;
      iterations: number;
      springStrength: number;
      dampingFactor: number;
    },
  ): void {
    const {idealEdgeLength, iterations, springStrength, dampingFactor} = config;

    // Velocities for each node
    const velocities = new Map<number, {vx: number; vy: number}>();
    nodes.forEach((node) => {
      velocities.set(node.id, {vx: 0, vy: 0});
    });

    for (let iter = 0; iter < iterations; iter++) {
      // Temperature decreases over time (simulated annealing)
      const temperature = (1 - iter / iterations) * dampingFactor;

      // Forces for this iteration
      const forces = new Map<number, {fx: number; fy: number}>();
      nodes.forEach((node) => {
        forces.set(node.id, {fx: 0, fy: 0});
      });

      // Apply spring forces ONLY between connected nodes
      sections.forEach((section) => {
        const n1 = nodes.find((n) => n.id === section.sourceNodeId);
        const n2 = nodes.find((n) => n.id === section.targetNodeId);
        if (!n1 || !n2) return;

        const dx = n2.positionX - n1.positionX;
        const dy = n2.positionY - n1.positionY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          // Hooke's law: F = k * (distance - idealLength)
          const displacement = distance - idealEdgeLength;
          const springForce = springStrength * displacement;
          const fx = (dx / distance) * springForce;
          const fy = (dy / distance) * springForce;

          const f1 = forces.get(n1.id)!;
          const f2 = forces.get(n2.id)!;

          // Apply force to both nodes
          f1.fx += fx;
          f1.fy += fy;
          f2.fx -= fx;
          f2.fy -= fy;
        }
      });

      // Update velocities and positions
      nodes.forEach((node) => {
        const force = forces.get(node.id)!;
        const velocity = velocities.get(node.id)!;

        // Update velocity with damping
        velocity.vx = (velocity.vx + force.fx) * temperature;
        velocity.vy = (velocity.vy + force.fy) * temperature;

        // Update position
        node.positionX += velocity.vx;
        node.positionY += velocity.vy;
      });

      // Log progress
      if (iter % 25 === 0 || iter === iterations - 1) {
        const currentAvg = this.calculateAverageEdgeLength(nodes, sections);
      }
    }

    // Re-center graph around (0, 0)
    const avgX = nodes.reduce((sum, n) => sum + n.positionX, 0) / nodes.length;
    const avgY = nodes.reduce((sum, n) => sum + n.positionY, 0) / nodes.length;
    nodes.forEach((node) => {
      node.positionX -= avgX;
      node.positionY -= avgY;
    });
  }

  /**
   * Create default colors
   */
  private createDefaultColors(): any[] {
    return [];
  }

  /**
   * Create default metadata (kept for backwards compatibility)
   */
  private createDefaultMetadata(): MetadataDto {
    return {
      trainrunCategories: [
        {
          id: 1,
          order: 0,
          name: "EC",
          shortName: "EC",
          fachCategory: HaltezeitFachCategories.IPV,
          colorRef: "EC",
          minimalTurnaroundTime: 4,
          nodeHeadwayStop: 2,
          nodeHeadwayNonStop: 2,
          sectionHeadway: 2,
        },
      ],
      trainrunFrequencies: [
        {
          id: 1,
          order: 0,
          frequency: 60,
          offset: 0,
          name: "60 min",
          shortName: "60",
          linePatternRef: "60" as any,
        },
      ],
      trainrunTimeCategories: [
        {
          id: 1,
          order: 0,
          name: "7/24",
          shortName: "7/24",
          dayTimeInterval: [],
          weekday: [1, 2, 3, 4, 5, 6, 7],
          linePatternRef: "7/24" as any,
        },
      ],
      netzgrafikColors: [],
      analyticsSettings: {
        originDestinationSettings: {
          connectionPenalty: 5,
        },
      },
    };
  }
}
