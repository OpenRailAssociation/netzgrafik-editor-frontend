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
import {NetzgrafikDefault} from "../../sample-netzgrafik/netzgrafik.default";
import {Node} from "../../models/node.model";

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
  private readonly ENABLE_VERBOSE_GTFS_LOGS = false;

  private categoryIdCounter = 1;
  private frequencyIdCounter = 1;
  private timeCategoryIdCounter = 1;

  constructor() {}

  private verboseLog(...args: unknown[]): void {
    if (this.ENABLE_VERBOSE_GTFS_LOGS) {
      console.info(...args);
    }
  }

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
   * For 120-min frequency: creates/finds two entries (even and odd hours) using default metadata
   */
  private mapFrequencies(
    routes: GTFSRoute[],
    existingMetadata?: MetadataDto,
  ): {
    frequencies: TrainrunFrequency[];
    frequencyMap: Map<string, number>; // Changed to string key: "freq" or "freq_offset"
  } {
    // If no existing frequencies, start with defaults from NetzgrafikDefault
    const defaultNetzgrafik = NetzgrafikDefault.getDefaultNetzgrafik();
    const frequencies: TrainrunFrequency[] =
      existingMetadata?.trainrunFrequencies && existingMetadata.trainrunFrequencies.length > 0
        ? [...existingMetadata.trainrunFrequencies]
        : [...defaultNetzgrafik.metadata.trainrunFrequencies];

    const frequencyMap = new Map<string, number>();

    // Build existing frequency+offset -> ID map
    const existingFreqMap = new Map<string, number>();
    frequencies.forEach((freq) => {
      const key = freq.frequency === 120 ? `${freq.frequency}_${freq.offset}` : `${freq.frequency}`;
      existingFreqMap.set(key, freq.id);
    });

    // Find highest existing ID
    if (frequencies.length > 0) {
      const maxId = Math.max(...frequencies.map((f) => f.id));
      this.frequencyIdCounter = maxId + 1;
    }

    // Get all unique frequencies from routes and map to existing entries
    routes.forEach((route) => {
      if (route.frequency) {
        // Validate frequency
        if (![15, 20, 30, 60, 120].includes(route.frequency)) {
          console.warn(
            `  ⚠️  Invalid frequency ${route.frequency} in route ${route.route_id}, normalizing to 60`,
          );
          route.frequency = 60;
        }

        // Build frequency key: for 120-min with offsetHour, use "120_0" or "120_60"
        let freqKey: string;
        if (route.frequency === 120 && route.offsetHour !== undefined) {
          const offset = route.offsetHour === 0 ? 0 : 60;
          freqKey = `120_${offset}`;
        } else {
          freqKey = route.frequency.toString();
        }

        // Find matching frequency entry
        if (!frequencyMap.has(freqKey)) {
          const matchingFreq = existingFreqMap.get(freqKey);
          if (matchingFreq !== undefined) {
            frequencyMap.set(freqKey, matchingFreq);
          } else {
            // Should not happen if defaults are complete - fallback to first entry
            console.warn(`  ⚠️  No frequency found for ${freqKey}, using first available`);
            if (frequencies.length > 0) {
              frequencyMap.set(freqKey, frequencies[0].id);
            }
          }
        }
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
      enableTopologyConsolidation?: boolean; // Q6: Topology consolidation toggle from UI
      topologyDetourPercent?: number; // Allowed detour (+%) for alternative path mapping
      topologyDetourAbsoluteMinutes?: number; // Allowed detour (absolute minutes) for alternative path mapping
      mergeRoundTrips?: boolean; // Merge opposite directions into ROUND_TRIP (default: false when topology consolidation is enabled)
    } = {},
  ): NetzgrafikDto {
    const maxTripsPerRoute = options.maxTripsPerRoute || 10;
    const minStopsPerTrip = options.minStopsPerTrip || 3;

    // Step 1: Identify trip patterns (group trips with same stop sequence)
    this.verboseLog("> 1.0 Identifying trip patterns...");
    const tripPatterns = this.identifyTripPatterns(gtfsData, minStopsPerTrip);

    // Step 1.5: Q6 — Optional topology consolidation (enable per default)
    let enrichedPatternsWithTopology: Array<{
      pattern: TripPattern;
      nodeSequence: string[];
      halts: Set<string>;
      timing: Map<string, {arrivalMin?: number; departureMin?: number; isPassThrough: boolean}>;
    }> | null = null;
    
    const enableTopologyConsolidation = options.enableTopologyConsolidation !== false;
    const topologyDetourPercent = Math.max(0, options.topologyDetourPercent ?? 35);
    const topologyDetourAbsoluteMinutes = Math.max(0, options.topologyDetourAbsoluteMinutes ?? 3);
    if (enableTopologyConsolidation && tripPatterns.length > 1) {
      try {
        const topologyResult = this.synthesizeTopologyGraph(
          tripPatterns,
          gtfsData,
          topologyDetourPercent,
          topologyDetourAbsoluteMinutes,
        );
        enrichedPatternsWithTopology = topologyResult.enrichedPatterns;
        console.info(
          `> [Q6] Topology consolidation enabled (detour <= +${topologyDetourPercent}% OR +${topologyDetourAbsoluteMinutes}min)`,
        );
      } catch (err) {
        console.warn("> [Q6] Topology consolidation failed, falling back to direct mapping", err);
        enrichedPatternsWithTopology = null;
      }
    }

    // Step 2: Select representative trips from each pattern
    this.verboseLog("> 2.0 Selecting representative trips...");
    const selectedPatterns = tripPatterns; // Use ALL patterns instead of limiting

    // Step 3: Create nodes from stops used in selected patterns
    this.verboseLog("> 3.0 Creating nodes...");
    const usedStopIds = new Set<string>();
    selectedPatterns.forEach((pattern) => {
      pattern.stopSequence.forEach((stopId) => usedStopIds.add(stopId));
    });

    // The stopSequence contains parent_station IDs (from identifyTripPatterns)
    // Some of these parent_station IDs might NOT exist as actual stops in stops.txt
    // We need to create virtual parent stops for these cases
    this.verboseLog("> 4.0 Stop ID mapping and virtual parent stop creation...");
    const stopMap = new Map<string, GTFSStop>();

    // First, add all existing stops that match usedStopIds
    gtfsData.stops.forEach((stop) => {
      if (usedStopIds.has(stop.stop_id)) {
        stopMap.set(stop.stop_id, stop);
      }
    });

    // Second, create virtual parent stops for missing parent_station IDs
    this.verboseLog("> 4.1 Creating virtual parent stops for missing parent_station IDs");
    const missingParentIds = Array.from(usedStopIds).filter((id) => !stopMap.has(id));
    if (missingParentIds.length > 0) {
      missingParentIds.forEach((parentId) => {
        // Find all child platforms that reference this parent
        const children = gtfsData.stops.filter((s) => s.parent_station === parentId);

        if (children.length > 0) {
          // Create virtual parent stop from first child's data
          const firstChild = children[0];
          const firstChildName = (firstChild.stop_name || parentId)
            .replace(/\s+(Gleis|Track|Platform|Quai)\s+.*$/i, "")
            .trim();
          const virtualParent: GTFSStop = {
            stop_id: parentId,
            stop_name: firstChildName, // Remove platform suffix
            stop_lat: firstChild.stop_lat,
            stop_lon: firstChild.stop_lon,
            location_type: "1", // Station
            parent_station: "", // No parent (is top-level)
          };
          stopMap.set(parentId, virtualParent);
        }
      });
    }

    this.verboseLog(`> 4.2 Total nodes to create: ${stopMap.size}`);
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

    // Step 5: Create node ID mapping (map GTFS stop_id to Netzgrafik node ID)
    this.verboseLog("> 5.0 Mapping GTFS stops to node IDs...");
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

    // Step 5.1: Map categories and frequencies
    this.verboseLog("> 5.1 Mapping categories and frequencies...");
    const {categories, categoryMap} = this.mapCategories(gtfsData.routes, options.existingMetadata);
    const {frequencies, frequencyMap} = this.mapFrequencies(
      gtfsData.routes,
      options.existingMetadata,
    );

    // Use default time categories from NetzgrafikDefault if none provided
    const defaultNetzgrafik = NetzgrafikDefault.getDefaultNetzgrafik();
    const timeCategories: TrainrunTimeCategory[] =
      options.existingMetadata?.trainrunTimeCategories &&
      options.existingMetadata.trainrunTimeCategories.length > 0
        ? options.existingMetadata.trainrunTimeCategories
        : defaultNetzgrafik.metadata.trainrunTimeCategories;
    const defaultTimeCategoryId = timeCategories[0].id;

    // Step 5.2: Create trainruns and trainrun sections
    this.verboseLog("> 5.2 Creating trainruns and sections...");
    const trainruns: TrainrunDto[] = [];
    const trainrunSections: TrainrunSectionDto[] = [];
    const trainrunToTrips = new Map<number, string[]>(); // Map trainrun ID to trip IDs
    const createdTrainrunToPattern = new Map<number, TripPattern>();
    
    // Q6: Build mapping from pattern to enriched topology info
    const patternToEnrichedInfo = new Map<
      number,
      {
        pattern: TripPattern;
        nodeSequence: string[];
        halts: Set<string>;
        timing: Map<string, {arrivalMin?: number; departureMin?: number; isPassThrough: boolean}>;
      }
    >();
    if (enrichedPatternsWithTopology) {
      selectedPatterns.forEach((pattern, idx) => {
        const enriched = enrichedPatternsWithTopology!.find((e) => e.pattern === pattern);
        if (enriched) {
          patternToEnrichedInfo.set(idx, enriched);
        }
      });
    }
    
    const routeMap = new Map<string, GTFSRoute>();
    gtfsData.routes.forEach((route) => routeMap.set(route.route_id, route));

    let trainrunId = 1;
    let sectionId = 1;

    selectedPatterns.forEach((pattern, patternIndex) => {
      const route =
        routeMap.get(pattern.routeId) ||
        ({
          route_id: pattern.routeId,
          route_short_name: `Trip ${patternIndex + 1}`,
          route_long_name: `Trip ${patternIndex + 1}`,
        } as GTFSRoute);

      const representativeTrip = pattern.trips[0];
      const stopTimesRaw = pattern.stopTimes.get(representativeTrip.trip_id);
      if (!stopTimesRaw || stopTimesRaw.length < 2) {
        return;
      }
      const stopTimes = [...stopTimesRaw].sort(
        (a, b) => parseInt(a.stop_sequence, 10) - parseInt(b.stop_sequence, 10),
      );

      // Get category and frequency IDs
      const routeDesc = route.route_desc || route.route_short_name || "Train";
      const categoryId = categoryMap.get(routeDesc) || categories[0]?.id || 1;

      // Get frequency ID: for 120-min with offsetHour, use correct offset
      let frequencyKey = route.frequency ? route.frequency.toString() : "60";
      if (route.frequency === 120 && route.offsetHour !== undefined) {
        const offset = route.offsetHour === 0 ? 0 : 60;
        frequencyKey = `120_${offset}`;
      }
      const frequencyId = frequencyMap.get(frequencyKey) || frequencies[0]?.id || 1;

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
      createdTrainrunToPattern.set(trainrun.id, pattern);

      // Store mapping: trainrun ID -> trip IDs (all trips in this pattern)
      trainrunToTrips.set(
        trainrun.id,
        pattern.trips.map((t) => t.trip_id),
      );

      // Create trainrun sections
      // Process all stations in sequence, including non-stop (through) stations
      let sectionsCreated = 0;

      // Group consecutive stops by station (parent_station)
      // Each group represents one station with potentially multiple platforms
      const enrichedPattern = patternToEnrichedInfo.get(patternIndex);

      const stationGroups: {
        stationStopId: string;
        nodeId: number;
        stops: GTFSStopTime[];
        isStop: boolean; // true if at least one platform allows boarding/alighting
        arrivalTimeMinutes: number;
        departureTimeMinutes: number;
      }[] = [];

      let currentGroup: (typeof stationGroups)[0] | null = null;

      for (const stopTime of stopTimes) {
        const nodeId = nodeIdMap.get(stopTime.stop_id);
        if (!nodeId) continue;

        const stationStopId = stopToStation.get(stopTime.stop_id) || stopTime.stop_id;

        // Check if this is an actual stop (not a through-run)
        const isStop = stopTime.pickup_type !== "1" || stopTime.drop_off_type !== "1";

        const arrivalTimeMinutes = GTFSParserService.timeToMinutes(
          stopTime.arrival_time || stopTime.departure_time || "00:00",
        );
        const departureTimeMinutes = GTFSParserService.timeToMinutes(
          stopTime.departure_time || stopTime.arrival_time || "00:00",
        );

        if (!currentGroup || currentGroup.nodeId !== nodeId) {
          // Start a new station group
          if (currentGroup) {
            stationGroups.push(currentGroup);
          }
          currentGroup = {
            stationStopId,
            nodeId,
            stops: [stopTime],
            isStop: isStop,
            arrivalTimeMinutes,
            departureTimeMinutes,
          };
        } else {
          // Add to current group
          currentGroup.stops.push(stopTime);
          // If ANY platform in this station allows boarding/alighting, mark as stop
          currentGroup.isStop = currentGroup.isStop || isStop;
          // Keep the earliest arrival and latest departure inside the group
          currentGroup.arrivalTimeMinutes = Math.min(currentGroup.arrivalTimeMinutes, arrivalTimeMinutes);
          currentGroup.departureTimeMinutes = Math.max(
            currentGroup.departureTimeMinutes,
            departureTimeMinutes,
          );
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
        const arrivalTime = group.arrivalTimeMinutes;
        const departureTime = group.departureTimeMinutes;

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

      // Create sections between consecutive real stops. If topology mapping provides
      // intermediate nodes for this segment, split it into multiple sub-sections.
      for (let i = 0; i < stationGroups.length - 1; i++) {
        const sourceGroup = stationGroups[i];
        const targetGroup = stationGroups[i + 1];

        const sectionGroups: Array<{
          stationStopId: string;
          nodeId: number;
          isStop: boolean;
          arrivalTimeMinutes: number;
          departureTimeMinutes: number;
        }> = [sourceGroup];

        if (enrichedPattern && enrichedPattern.nodeSequence.length > 1) {
          const startIdx = enrichedPattern.nodeSequence.indexOf(sourceGroup.stationStopId);
          const endIdx = enrichedPattern.nodeSequence.indexOf(targetGroup.stationStopId);

          if (startIdx >= 0 && endIdx >= 0 && startIdx !== endIdx) {
            const step = endIdx > startIdx ? 1 : -1;

            for (let idx = startIdx + step; idx !== endIdx; idx += step) {
              const intermediateStationId = enrichedPattern.nodeSequence[idx];
              const intermediateNodeId = nodeIdMap.get(intermediateStationId);
              if (!intermediateNodeId) {
                continue;
              }

              const timingInfo = enrichedPattern.timing.get(intermediateStationId);
              if (!timingInfo) {
                continue;
              }

              const interpolatedMinute =
                timingInfo.arrivalMin ?? timingInfo.departureMin ?? sourceGroup.departureTimeMinutes;

              sectionGroups.push({
                stationStopId: intermediateStationId,
                nodeId: intermediateNodeId,
                isStop: !timingInfo.isPassThrough,
                arrivalTimeMinutes: interpolatedMinute,
                departureTimeMinutes: interpolatedMinute,
              });
            }
          }
        }

        sectionGroups.push(targetGroup);

        for (let segIdx = 0; segIdx < sectionGroups.length - 1; segIdx++) {
          const sourceSegmentGroup = sectionGroups[segIdx];
          const targetSegmentGroup = sectionGroups[segIdx + 1];

          const departureTime = sourceSegmentGroup.departureTimeMinutes;
          const arrivalTime = targetSegmentGroup.arrivalTimeMinutes;
          const travelTime = Math.max(1, this.calculateTravelTime(departureTime, arrivalTime));

          // === STEP 1: ENFORCE SYMMETRY (60-x rule) ===
          // Extract minutes ONLY (0-59) for forward direction from GTFS
          const sourceDep_minute = departureTime % 60; // Forward: source departure (e.g., :05)
          const targetArr_minute = arrivalTime % 60; // Forward: target arrival (e.g., :52)

          // Calculate backward (return) times using 60-x symmetry
          const sourceArr_minute = (60 - sourceDep_minute) % 60; // Backward: source arrival = 60-5 = :55
          const targetDep_minute = (60 - targetArr_minute) % 60; // Backward: target departure = 60-52 = :08

          const section: TrainrunSectionDto = {
            id: sectionId++,
            sourceNodeId: sourceSegmentGroup.nodeId,
            sourcePortId: 0,
            targetNodeId: targetSegmentGroup.nodeId,
            targetPortId: 0,
          sourceSymmetry: false,
          targetSymmetry: false,
          // SYMMETRISCHE ZEITEN (60-x Regel für ONE_WAY):
          sourceArrival: {
            time: sourceArr_minute,
            consecutiveTime: 0,
            lock: false,
            warning: undefined,
            timeFormatter: undefined,
          }, // Backward: 60 - sourceDep
          sourceDeparture: {
            time: sourceDep_minute,
            consecutiveTime: 0,
            lock: false,
            warning: undefined,
            timeFormatter: undefined,
          }, // Forward: GTFS minute
          targetArrival: {
            time: targetArr_minute,
            consecutiveTime: 0,
            lock: false,
            warning: undefined,
            timeFormatter: undefined,
          }, // Forward: GTFS minute
          targetDeparture: {
            time: targetDep_minute,
            consecutiveTime: 0,
            lock: false,
            warning: undefined,
            timeFormatter: undefined,
          }, // Backward: 60 - targetArr
          travelTime: {
            time: travelTime,
            consecutiveTime: 0,
            lock: false,
            warning: undefined,
            timeFormatter: undefined,
          }, // FULL minutes from GTFS (can be > 60)
          backwardTravelTime: {
            time: travelTime,
            consecutiveTime: 0,
            lock: false,
            warning: undefined,
            timeFormatter: undefined,
          }, // Same as forward
          // Mark sections touching through-pass stations as containing pass-through behavior.
          numberOfStops: sourceSegmentGroup.isStop && targetSegmentGroup.isStop ? 0 : 1,
          trainrunId: trainrun.id,
          resourceId: 0,
          specificTrainrunSectionFrequencyId: null,
          path: {
            path: [],
            textPositions: {
              [TrainrunSectionText.SourceArrival]: {x: 0, y: 0},
              [TrainrunSectionText.SourceDeparture]: {x: 0, y: 0},
              [TrainrunSectionText.TargetArrival]: {x: 0, y: 0},
              [TrainrunSectionText.TargetDeparture]: {x: 0, y: 0},
              [TrainrunSectionText.TrainrunSectionName]: {x: 0, y: 0},
              [TrainrunSectionText.TrainrunSectionTravelTime]: {x: 0, y: 0},
              [TrainrunSectionText.TrainrunSectionBackwardTravelTime]: {x: 0, y: 0},
              [TrainrunSectionText.TrainrunSectionNumberOfStops]: {x: 0, y: 0},
            },
          },
            warnings: [],
          };
          trainrunSections.push(section);
          sectionsCreated++;
        }
      }
    });

    // Step 5.1: Match and merge round-trip patterns
    const mergeRoundTrips = options.mergeRoundTrips ?? true;
    const timeSyncTolerance = options.timeSyncTolerance ?? 180; // seconds (default matches DEFAULT_TIME_SYNC_TOLERANCE in gtfs-import.models.ts)

    let matchingStatus = new Map<number, string>();
    if (mergeRoundTrips) {
      matchingStatus = this.matchAndMergeRoundTrips(
        trainruns,
        trainrunSections,
        createdTrainrunToPattern,
        gtfsData,
        timeSyncTolerance,
        nodes,
      );
    } else {
      trainruns.forEach((trainrun) => {
        matchingStatus.set(trainrun.id, "⊚ Round-trip merge disabled");
      });
      this.verboseLog(
        "> [GTFS] Round-trip merge disabled to preserve strict per-trip node ordering",
      );
    }

    const roundTripCount = trainruns.filter((t) => t.direction === Direction.ROUND_TRIP).length;
    const oneWayCount = trainruns.filter((t) => t.direction === Direction.ONE_WAY).length;

    // Step 5.1b: Log GTFS Path vs TrainrunSections comparison
    this.verboseLog("\n========== [GTFS][PATH_vs_SECTIONS] COMPARISON ==========\n");
    
    // Build map of sections per trainrun for analysis
    const sectionsByTrainrun = new Map<number, TrainrunSectionDto[]>();
    trainrunSections.forEach((section) => {
      const trainrunId = section.trainrunId;
      if (!sectionsByTrainrun.has(trainrunId)) {
        sectionsByTrainrun.set(trainrunId, []);
      }
      sectionsByTrainrun.get(trainrunId)!.push(section);
    });

    selectedPatterns.forEach((pattern, index) => {
      const trainrunId = index + 1;
      const trainrun = trainruns.find((t) => t.id === trainrunId);
      if (!trainrun) return;

      const enrichedPattern = enrichedPatternsWithTopology ? enrichedPatternsWithTopology.find((e) => e.pattern === pattern) : null;
      const route = gtfsData.routes.find((r) => r.route_id === pattern.routeId);
      const routeName = route?.route_short_name || pattern.routeId;
      const sections = sectionsByTrainrun.get(trainrunId) || [];
      
      this.verboseLog(`[GTFS][PATH_vs_SECTIONS] Route: ${routeName}`, {
        trainrunId,
        direction: trainrun.direction,
        pathLength: enrichedPattern?.nodeSequence?.length || 0,
        pathNodes: enrichedPattern?.nodeSequence || [],
        pathHalts: enrichedPattern?.halts ? Array.from(enrichedPattern.halts) : [],
        sectionCount: sections.length,
        sectionEdges: sections.map((s) => `${s.sourceNodeId}→${s.targetNodeId}`),
        expectedEdgesFromPath: Math.max(0, (enrichedPattern?.nodeSequence?.length || 1) - 1),
        actualEdgesFromSections: sections.length,
        overhead: sections.length - Math.max(0, (enrichedPattern?.nodeSequence?.length || 1) - 1),
      });
    });

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

    // Add trainrun-to-trips mapping as additional property (not part of standard NetzgrafikDto)
    (netzgrafikDto as any).trainrunToTrips = trainrunToTrips;

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
    nodes: NodeDto[],
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
          // Determine which trainrun should be the main direction (NW → SE preferred)
          const sections1 = trainrunSections.filter((s) => s.trainrunId === trainrun1.id);
          const sections2 = trainrunSections.filter((s) => s.trainrunId === trainrun2.id);

          let keepTrainrun1 = trainrun1;
          let removeTrainrun2 = trainrun2;
          let keepIndex = i;
          let removeIndex = j;

          // Compare first sections to determine preferred direction
          if (sections1.length > 0 && sections2.length > 0) {
            const section1 = sections1[0];
            const section2 = sections2[0];

            // Get node positions
            const node1Source = nodes.find((n) => n.id === section1.sourceNodeId);
            const node1Target = nodes.find((n) => n.id === section1.targetNodeId);
            const node2Source = nodes.find((n) => n.id === section2.sourceNodeId);
            const node2Target = nodes.find((n) => n.id === section2.targetNodeId);

            if (node1Source && node1Target && node2Source && node2Target) {
              // Calculate direction vectors
              const dx1 = node1Target.positionX - node1Source.positionX;
              const dy1 = node1Target.positionY - node1Source.positionY;
              const dx2 = node2Target.positionX - node2Source.positionX;
              const dy2 = node2Target.positionY - node2Source.positionY;

              // Prefer direction with positive X (west→east) and positive Y (north→south)
              // Score: +1 for eastward, +1 for southward
              const score1 = (dx1 > 0 ? 1 : 0) + (dy1 > 0 ? 1 : 0);
              const score2 = (dx2 > 0 ? 1 : 0) + (dy2 > 0 ? 1 : 0);

              // If trainrun2 has better direction score, swap them
              if (score2 > score1) {
                keepTrainrun1 = trainrun2;
                removeTrainrun2 = trainrun1;
                keepIndex = j;
                removeIndex = i;
              }
            }
          }

          // Merge: Keep preferred trainrun, remove other
          keepTrainrun1.direction = Direction.ROUND_TRIP;
          keepTrainrun1.labelIds = [...keepTrainrun1.labelIds, ...removeTrainrun2.labelIds]; // Combine labels

          // Mark both as successfully matched
          matchingStatus.set(keepTrainrun1.id, "✓ Round-Trip");
          matchingStatus.set(removeTrainrun2.id, "✓ Round-Trip (merged)");

          // Mark removed trainrun for deletion
          matched.add(removeIndex);
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
    // 1. Same line (prefer route_short_name, fallback to route_long_name)
    const line1 = (route1.route_short_name || route1.route_long_name || "").trim().toUpperCase();
    const line2 = (route2.route_short_name || route2.route_long_name || "").trim().toUpperCase();
    if (line1 && line2 && line1 !== line2) {
      return "✗ Different line";
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

    // 4. Reversed stopSequence
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

    // 5. Check time symmetry with tolerance
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

    // Sort stop times by canonical GTFS order.
    stopTimesByTrip.forEach((stopTimes) => {
      stopTimes.sort(
        (a, b) => parseInt(a.stop_sequence, 10) - parseInt(b.stop_sequence, 10),
      );
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
      // and collapse immediate duplicates (same station via multiple platform rows).
      const stopSequenceRaw = stopTimes.map((st) => stopToStation.get(st.stop_id) || st.stop_id);
      const stopSequence: string[] = [];
      stopSequenceRaw.forEach((stationId) => {
        if (stopSequence.length === 0 || stopSequence[stopSequence.length - 1] !== stationId) {
          stopSequence.push(stationId);
        }
      });

      if (stopSequence.length < minStopsPerTrip) {
        skippedTrips++;
        return;
      }

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
   * Identify system paths (most frequently used paths) for each route+direction
   * Returns a map of pattern key -> isSystemPath boolean
   */
  private identifySystemPaths(patterns: TripPattern[]): Map<string, boolean> {
    const systemPaths = new Map<string, boolean>();

    // Group patterns by route_id + direction_id
    const patternsByRouteDirection = new Map<string, TripPattern[]>();
    patterns.forEach((pattern) => {
      const key = `${pattern.routeId}_${pattern.directionId}`;
      if (!patternsByRouteDirection.has(key)) {
        patternsByRouteDirection.set(key, []);
      }
      patternsByRouteDirection.get(key)!.push(pattern);
    });

    // For each route+direction group, identify the most frequent path
    patternsByRouteDirection.forEach((groupPatterns, routeDirKey) => {
      if (groupPatterns.length === 0) return;

      // Sort by trip count (descending)
      groupPatterns.sort((a, b) => b.trips.length - a.trips.length);

      // The first pattern (most trips) is the system path
      const systemPattern = groupPatterns[0];
      const systemPatternKey = `${systemPattern.routeId}_${systemPattern.directionId}_${systemPattern.stopSequence.join("-")}`;

      // Mark patterns
      groupPatterns.forEach((pattern) => {
        const patternKey = `${pattern.routeId}_${pattern.directionId}_${pattern.stopSequence.join("-")}`;
        systemPaths.set(patternKey, patternKey === systemPatternKey);
      });
    });

    return systemPaths;
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
      const stationName = station.stop_name || station.stop_id;
      const coords = this.convertCoordinates(
        parseFloat(station.stop_lat || "0"),
        parseFloat(station.stop_lon || "0"),
      );

      // Find all platforms/tracks that belong to this station
      const platforms = allStops.filter(
        (stop) => stop.parent_station === station.stop_id && stop.stop_id !== station.stop_id,
      );

      // Build fullName with platform count
      const fullName =
        platforms.length > 0
          ? `${stationName} -> #Platform (${platforms.length})`
          : stationName;

      // Use station name as betriebspunktName (truncate if too long)
      const betriebspunktName =
        stationName.length <= 50 ? stationName : stationName.substring(0, 50);

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
        trainrunCategoryHaltezeiten: Node.getDefaultHaltezeit(),
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
    const stopName = stop.stop_name || stop.stop_id;
    // Use stop_id, or create from stop_name
    if (stop.stop_id.length <= 8) {
      return stop.stop_id;
    }

    // Create abbreviation from stop name
    const words = stopName.split(/\s+/);
    if (words.length === 1) {
      return stopName.substring(0, 8).toUpperCase();
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
    // Normalize to [0, 1439] to handle extended GTFS times like "25:10:00"
    // which timeToMinutes() returns as values > 1440.
    const dep = departureMinutes % (24 * 60);
    const arr = arrivalMinutes % (24 * 60);
    let travelTime = arr - dep;
    if (travelTime < 0) {
      travelTime += 24 * 60; // Handle midnight crossing
    }
    return Math.max(1, travelTime);
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
  private(): TrainrunCategoryHaltezeit {
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
   * TOPOLOGY CONSOLIDATION (Phases T1-T6)
   * Synthesize a consolidated topology graph from all trip patterns,
   * mapping patterns to shared backbone edges with interpolated pass-through times.
   */

  /**
   * T1-T6: Main topology synthesis orchestrator
   * Input: All identified trip patterns
   * Output: Enriched patterns with backbone mapping and timing
   */
  synthesizeTopologyGraph(
    patterns: TripPattern[],
    gtfsData: GTFSData,
    topologyDetourPercent: number,
    topologyDetourAbsoluteMinutes: number,
  ): {
    backboneNodes: Set<string>; // All nodes in synthesized backbone
    backboneEdges: Map<string, {from: string; to: string; travelTimeMinutes: number}>; // Edge key -> edge
    enrichedPatterns: Array<{
      pattern: TripPattern;
      nodeSequence: string[]; // Mapped to backbone
      halts: Set<string>; // Actual halts of this pattern
      timing: Map<string, {arrivalMin?: number; departureMin?: number; isPassThrough: boolean}>; // stop_id -> timing
    }>;
  } {
    this.verboseLog("> [T1-T6] Synthesizing consolidated topology...");

    // Build observed trainrun-like edges (source->target with measured travel times)
    // from the same representative trips that are later converted into trainruns.
    const observedTrainrunEdges = this.extractObservedTrainrunEdges(patterns, gtfsData);

    // Build directed precedence graph from all observed pattern edges.
    const {dag} = this.buildPrecedenceDAGAndAnchors(patterns, gtfsData);
    const {backboneNodes, backboneEdges} = this.buildObservedBackboneGraph(observedTrainrunEdges);

    // T4: Use minimum travel time per observed edge as requested basis-graph weight.
    const edgeTravelTimes = this.calculateEdgeTravelTimes(observedTrainrunEdges, backboneEdges);

    // T5: For every pair of real halts, search a path in the graph and insert intermediate nodes.
    const enrichedPatterns = this.mapPatternsToBackbone(
      patterns,
      gtfsData,
      dag,
      backboneNodes,
      edgeTravelTimes,
      topologyDetourPercent,
      topologyDetourAbsoluteMinutes,
    );

    this.verboseLog(
      `> [T1-T6] Topology: ${backboneNodes.size} nodes, ${backboneEdges.size} edges, ${enrichedPatterns.length} patterns mapped`,
    );

    return {
      backboneNodes,
      backboneEdges,
      enrichedPatterns,
    };
  }

  private extractObservedTrainrunEdges(
    patterns: TripPattern[],
    gtfsData: GTFSData,
  ): Array<{from: string; to: string; travelTimeMinutes: number}> {
    const observedEdges: Array<{from: string; to: string; travelTimeMinutes: number}> = [];

    const stopToStation = new Map<string, string>();
    gtfsData.stops.forEach((stop) => {
      stopToStation.set(
        stop.stop_id,
        stop.parent_station && stop.parent_station !== "" ? stop.parent_station : stop.stop_id,
      );
    });

    patterns.forEach((pattern) => {
      if (pattern.trips.length === 0) {
        return;
      }

      const representativeTripId = pattern.trips[0].trip_id;
      const rawStopTimes = pattern.stopTimes.get(representativeTripId);
      if (!rawStopTimes || rawStopTimes.length < 2) {
        return;
      }

      const stopTimes = [...rawStopTimes].sort(
        (a, b) => parseInt(a.stop_sequence, 10) - parseInt(b.stop_sequence, 10),
      );

      const stationGroups: Array<{stationId: string; arrivalMin: number; departureMin: number}> = [];
      let currentGroup: {stationId: string; arrivalMin: number; departureMin: number} | null = null;

      stopTimes.forEach((stopTime) => {
        const stationId = stopToStation.get(stopTime.stop_id) || stopTime.stop_id;
        const arrivalMin = GTFSParserService.timeToMinutes(
          stopTime.arrival_time || stopTime.departure_time || "00:00",
        );
        const departureMin = GTFSParserService.timeToMinutes(
          stopTime.departure_time || stopTime.arrival_time || "00:00",
        );

        if (!currentGroup || currentGroup.stationId !== stationId) {
          if (currentGroup) {
            stationGroups.push(currentGroup);
          }
          currentGroup = {
            stationId,
            arrivalMin,
            departureMin,
          };
        } else {
          currentGroup.arrivalMin = Math.min(currentGroup.arrivalMin, arrivalMin);
          currentGroup.departureMin = Math.max(currentGroup.departureMin, departureMin);
        }
      });

      if (currentGroup) {
        stationGroups.push(currentGroup);
      }

      for (let index = 0; index < stationGroups.length - 1; index++) {
        const fromGroup = stationGroups[index];
        const toGroup = stationGroups[index + 1];
        const travelTimeMinutes = Math.max(
          1,
          this.calculateTravelTime(fromGroup.departureMin, toGroup.arrivalMin),
        );

        observedEdges.push({
          from: fromGroup.stationId,
          to: toGroup.stationId,
          travelTimeMinutes,
        });
      }
    });

    return observedEdges;
  }

  private buildObservedBackboneGraph(
    observedTrainrunEdges: Array<{from: string; to: string; travelTimeMinutes: number}>,
  ): {
    backboneNodes: Set<string>;
    backboneEdges: Map<string, {from: string; to: string; travelTimeMinutes: number}>;
  } {
    const backboneNodes = new Set<string>();
    const backboneEdges = new Map<string, {from: string; to: string; travelTimeMinutes: number}>();

    observedTrainrunEdges.forEach((edge) => {
      backboneNodes.add(edge.from);
      backboneNodes.add(edge.to);
      const edgeKey = `${edge.from}→${edge.to}`;

      // Keep minimal observed travel time on each directed edge.
      const existing = backboneEdges.get(edgeKey);
      if (!existing || edge.travelTimeMinutes < existing.travelTimeMinutes) {
        backboneEdges.set(edgeKey, {
          from: edge.from,
          to: edge.to,
          travelTimeMinutes: edge.travelTimeMinutes,
        });
      }
    });

    this.verboseLog(
      `> [T3] Observed graph built: ${backboneNodes.size} nodes, ${backboneEdges.size} edges`,
    );

    return {backboneNodes, backboneEdges};
  }

  /**
   * T1 & T2: Build precedence DAG from all patterns and identify anchor nodes
   */
  private buildPrecedenceDAGAndAnchors(
    patterns: TripPattern[],
    gtfsData: GTFSData,
  ): {
    dag: Map<string, Set<string>>; // from -> Set(to)
    anchors: Set<string>; // Important nodes
  } {
    const dag = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();
    const nodeAppearances = new Map<string, number>();

    // Build DAG from all patterns
    patterns.forEach((pattern) => {
      const seq = pattern.stopSequence;
      nodeAppearances.set(seq[0], (nodeAppearances.get(seq[0]) || 0) + 1); // Start
      nodeAppearances.set(seq[seq.length - 1], (nodeAppearances.get(seq[seq.length - 1]) || 0) + 1); // End

      for (let i = 0; i < seq.length - 1; i++) {
        const from = seq[i];
        const to = seq[i + 1];
        if (!dag.has(from)) dag.set(from, new Set());
        dag.get(from)!.add(to);
        outDegree.set(from, (outDegree.get(from) || 0) + 1);
        inDegree.set(to, (inDegree.get(to) || 0) + 1);
      }
    });

    // T2: Identify anchor nodes
    const anchors = new Set<string>();

    // Criterion 1: Start/End nodes of patterns
    patterns.forEach((pattern) => {
      anchors.add(pattern.stopSequence[0]);
      anchors.add(pattern.stopSequence[pattern.stopSequence.length - 1]);
    });

    // Criterion 2: Nodes with degree ≥ 3 (junctions)
    dag.forEach((tos, from) => {
      if (tos.size >= 3) anchors.add(from);
      if (inDegree.get(from)! + tos.size >= 3) anchors.add(from);
    });

    // Criterion 3: Frequently appearing nodes (threshold: > 30% of patterns)
    const threshold = patterns.length * 0.3;
    nodeAppearances.forEach((count, node) => {
      if (count >= threshold) anchors.add(node);
    });

    this.verboseLog(`> [T2] Identified ${anchors.size} anchor nodes`);

    return {dag, anchors};
  }

  /**
   * T3: Synthesize backbone from DAG via topological sort
   */
  private synthesizeBackboneFromDAG(
    dag: Map<string, Set<string>>,
    anchors: Set<string>,
    patterns: TripPattern[],
  ): {
    backboneNodes: Set<string>;
    backboneEdges: Map<string, {from: string; to: string; travelTimeMinutes: number}>;
    nodeToSequence: Map<string, string[]>; // Edge key (from-to) -> Full node sequence
  } {
    const backboneNodes = new Set<string>();
    const backboneEdges = new Map<string, {from: string; to: string; travelTimeMinutes: number}>();
    const nodeToSequence = new Map<string, string[]>();

    // Topological sort of DAG to establish consistent ordering
    const sorted = this.topologicalSort(dag);
    sorted.forEach((node) => backboneNodes.add(node));

    // For each anchor-to-anchor pair, find the densest backbone path
    for (const pattern of patterns) {
      const seq = pattern.stopSequence;
      let i = 0;
      while (i < seq.length) {
        const from = seq[i];
        if (!anchors.has(from)) {
          i++;
          continue;
        }

        // Find next anchor in this pattern
        let j = i + 1;
        while (j < seq.length && !anchors.has(seq[j])) {
          j++;
        }

        if (j >= seq.length) break; // No more anchors

        const to = seq[j];
        const edgeKey = `${from}→${to}`;
        const subSeq = seq.slice(i, j + 1);

        // Register this path (or update if we already have one)
        if (!nodeToSequence.has(edgeKey)) {
          nodeToSequence.set(edgeKey, subSeq);
          backboneEdges.set(edgeKey, {from, to, travelTimeMinutes: 1}); // Default 1 min, will be updated in T4
        } else {
          // If multiple patterns offer different sequences, keep the longest (most stops)
          const existing = nodeToSequence.get(edgeKey)!;
          if (subSeq.length > existing.length) {
            nodeToSequence.set(edgeKey, subSeq);
          }
        }

        // Add intermediate nodes to backbone
        subSeq.forEach((node) => backboneNodes.add(node));

        i = j;
      }
    }

    this.verboseLog(
      `> [T3] Synthesized backbone: ${backboneNodes.size} nodes, ${backboneEdges.size} edges`,
    );

    return {backboneNodes, backboneEdges, nodeToSequence};
  }

  /**
   * Topological sort of DAG
   */
  private topologicalSort(dag: Map<string, Set<string>>): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (node: string) => {
      if (visited.has(node)) return;
      visited.add(node);
      const neighbors = dag.get(node);
      if (neighbors) {
        Array.from(neighbors).forEach((neighbor) => visit(neighbor));
      }
      result.unshift(node);
    };

    // Visit all nodes
    dag.forEach((_, node) => visit(node));
    dag.forEach((tos) => {
      tos.forEach((node) => visit(node));
    });

    return result;
  }

  /**
   * T4: Calculate minimum travel times for each backbone edge
   */
  private calculateEdgeTravelTimes(
    observedTrainrunEdges: Array<{from: string; to: string; travelTimeMinutes: number}>,
    backboneEdges: Map<string, {from: string; to: string; travelTimeMinutes: number}>,
  ): Map<string, number> {
    const minTravelTimes = new Map<string, number>();

    observedTrainrunEdges.forEach((edge) => {
      const edgeKey = `${edge.from}→${edge.to}`;
      const currentMin = minTravelTimes.get(edgeKey);
      const nextMin = Math.max(1, edge.travelTimeMinutes);
      if (currentMin === undefined || nextMin < currentMin) {
        minTravelTimes.set(edgeKey, nextMin);
      }
    });

    // Apply minimum travel time map to backbone edges.
    const result = new Map<string, number>();
    backboneEdges.forEach((_, edgeKey) => {
      const minTravel = Math.max(1, minTravelTimes.get(edgeKey) || 1);
      result.set(edgeKey, minTravel);

      if (backboneEdges.has(edgeKey)) {
        const edge = backboneEdges.get(edgeKey)!;
        edge.travelTimeMinutes = minTravel;
      }
    });

    return result;
  }

  /**
   * T4-T5: Map each pattern to backbone nodes and calculate interpolated timing
   */
  private mapPatternsToBackbone(
    patterns: TripPattern[],
    gtfsData: GTFSData,
    dag: Map<string, Set<string>>,
    backboneNodes: Set<string>,
    edgeTravelTimes: Map<string, number>,
    topologyDetourPercent: number,
    topologyDetourAbsoluteMinutes: number,
  ): Array<{
    pattern: TripPattern;
    nodeSequence: string[];
    halts: Set<string>;
    timing: Map<string, {arrivalMin?: number; departureMin?: number; isPassThrough: boolean}>;
  }> {
    void dag;

    type StationGroup = {
      stationId: string;
      isStop: boolean;
      arrivalMin: number;
      departureMin: number;
    };

    type PatternContext = {
      patternIndex: number;
      pattern: TripPattern;
      routeName: string;
      representativeTripId: string;
      stationGroups: StationGroup[];
      effectiveHalts: StationGroup[];
      actualHalts: Set<string>;
    };

    type OriginalSection = {
      id: number;
      patternIndex: number;
      segmentIndex: number;
      from: string;
      to: string;
      directTravelMin: number;
      sourceDepartureMin: number;
      targetArrivalMin: number;
    };

    const result: Array<{
      pattern: TripPattern;
      nodeSequence: string[];
      halts: Set<string>;
      timing: Map<string, {arrivalMin?: number; departureMin?: number; isPassThrough: boolean}>;
    }> = [];

    // Build station name mapping
    const stationIdToName = new Map<string, string>();
    gtfsData.stops.forEach((stop) => {
      const stationId = stop.parent_station && stop.parent_station !== "" ? stop.parent_station : stop.stop_id;
      if (!stationIdToName.has(stationId)) {
        stationIdToName.set(stationId, stop.stop_name || stop.stop_id);
      }
    });

    // Build stop_id -> station_id mapping once.
    const stopToStation = new Map<string, string>();
    gtfsData.stops.forEach((stop) => {
      stopToStation.set(
        stop.stop_id,
        stop.parent_station && stop.parent_station !== "" ? stop.parent_station : stop.stop_id,
      );
    });

    const patternContexts: PatternContext[] = [];
    const originalSections: OriginalSection[] = [];
    const sectionKeyToId = new Map<string, number>();

    // 1) Build the original section list from all patterns (source/target/traveltime).
    let sectionIdCounter = 1;
    patterns.forEach((pattern, patternIndex) => {
      const stopTimesMap = pattern.stopTimes;
      if (pattern.trips.length === 0 || !stopTimesMap.has(pattern.trips[0].trip_id)) {
        patternContexts.push({
          patternIndex,
          pattern,
          routeName: pattern.routeId,
          representativeTripId: "unknown-trip",
          stationGroups: [],
          effectiveHalts: [],
          actualHalts: new Set<string>(),
        });
        return;
      }

      const representativeTripId = pattern.trips[0].trip_id;
      const tripStopTimes = [...stopTimesMap.get(representativeTripId)!].sort(
        (a, b) => parseInt(a.stop_sequence, 10) - parseInt(b.stop_sequence, 10),
      );

      const stationGroups: StationGroup[] = [];
      let currentGroup: StationGroup | null = null;
      tripStopTimes.forEach((stopTime) => {
        const stationId = stopToStation.get(stopTime.stop_id) || stopTime.stop_id;
        const isStop = stopTime.pickup_type !== "1" || stopTime.drop_off_type !== "1";
        const arrivalMin = GTFSParserService.timeToMinutes(
          stopTime.arrival_time || stopTime.departure_time || "00:00",
        );
        const departureMin = GTFSParserService.timeToMinutes(
          stopTime.departure_time || stopTime.arrival_time || "00:00",
        );

        if (!currentGroup || currentGroup.stationId !== stationId) {
          if (currentGroup) {
            stationGroups.push(currentGroup);
          }
          currentGroup = {
            stationId,
            isStop,
            arrivalMin,
            departureMin,
          };
        } else {
          currentGroup.isStop = currentGroup.isStop || isStop;
          currentGroup.arrivalMin = Math.min(currentGroup.arrivalMin, arrivalMin);
          currentGroup.departureMin = Math.max(currentGroup.departureMin, departureMin);
        }
      });
      if (currentGroup) {
        stationGroups.push(currentGroup);
      }

      const haltGroups = stationGroups.filter((group) => group.isStop);
      const effectiveHalts = haltGroups.length >= 2 ? haltGroups : stationGroups;
      const actualHalts = new Set(effectiveHalts.map((group) => group.stationId));

      const route = gtfsData.routes.find((r) => r.route_id === pattern.routeId);
      const routeName = route?.route_short_name || route?.route_long_name || pattern.routeId;

      patternContexts.push({
        patternIndex,
        pattern,
        routeName,
        representativeTripId,
        stationGroups,
        effectiveHalts,
        actualHalts,
      });

      for (let haltIndex = 0; haltIndex < effectiveHalts.length - 1; haltIndex++) {
        const sourceHalt = effectiveHalts[haltIndex];
        const targetHalt = effectiveHalts[haltIndex + 1];
        const directTravelMin = Math.max(
          1,
          this.calculateTravelTime(sourceHalt.departureMin, targetHalt.arrivalMin),
        );

        const section: OriginalSection = {
          id: sectionIdCounter++,
          patternIndex,
          segmentIndex: haltIndex,
          from: sourceHalt.stationId,
          to: targetHalt.stationId,
          directTravelMin,
          sourceDepartureMin: sourceHalt.departureMin,
          targetArrivalMin: targetHalt.arrivalMin,
        };

        originalSections.push(section);
        sectionKeyToId.set(`${patternIndex}:${haltIndex}`, section.id);
      }
    });

    // 2) Consolidate graph edges to min travel time per node pair.
    // Prefer observed per-edge minima from topology extraction (T4), then
    // fall back to section-derived minima when needed.
    const minUndirectedWeights = new Map<string, number>();

    edgeTravelTimes.forEach((travelTime, edgeKey) => {
      const [from, to] = edgeKey.split("→");
      if (!from || !to) {
        return;
      }
      const weight = Math.max(1, travelTime || 1);
      const undirectedKey = this.getUndirectedEdgeKey(from, to);
      const existing = minUndirectedWeights.get(undirectedKey);
      if (existing === undefined || weight < existing) {
        minUndirectedWeights.set(undirectedKey, weight);
      }
    });

    originalSections.forEach((section) => {
      const edgeKey = this.getUndirectedEdgeKey(section.from, section.to);
      const existing = minUndirectedWeights.get(edgeKey);
      if (existing === undefined || section.directTravelMin < existing) {
        minUndirectedWeights.set(edgeKey, section.directTravelMin);
      }
    });

    const consolidatedEdgeTravelTimes = new Map<string, number>();
    minUndirectedWeights.forEach((weight, edgeKey) => {
      const [a, b] = edgeKey.split("↔");
      if (!a || !b) {
        return;
      }
      consolidatedEdgeTravelTimes.set(`${a}→${b}`, weight);
      consolidatedEdgeTravelTimes.set(`${b}→${a}`, weight);
    });

    // 3) Group sections by edge (undirected)
    const edgeToSections = new Map<string, OriginalSection[]>();
    originalSections.forEach((section) => {
      const edgeKey = this.getUndirectedEdgeKey(section.from, section.to);
      if (!edgeToSections.has(edgeKey)) {
        edgeToSections.set(edgeKey, []);
      }
      edgeToSections.get(edgeKey)!.push(section);
    });

    // 3b) Sort edge groups by min travel time of their sections
    const sortedEdgeGroups = Array.from(edgeToSections.entries())
      .map(([edgeKey, sections]) => ({
        edgeKey,
        sections,
        minTravelMin: Math.min(...sections.map((s) => s.directTravelMin)),
      }))
      .sort((a, b) => a.minTravelMin - b.minTravelMin);

    // 4) Iterate edge groups atomically: all sections of an edge consolidate together or not at all
    const doneSections = new Set<number>();
    const replacementPathBySectionId = new Map<number, string[]>();
    const consolidatedDetailsByPatternIndex = new Map<
      number,
      Array<{
        from: string;
        to: string;
        directTravelMin: number;
        pathTravelMin: number;
        allowedTravelMin: number;
        insertedNodes: number;
        path: string[];
      }>
    >();

    let totalSegmentsEvaluated = originalSections.length;
    let totalSegmentsConsolidated = 0;
    let totalInsertedNodes = 0;

    sortedEdgeGroups.forEach(({ edgeKey, sections }) => {
      // Skip if all sections of this edge are already done
      if (sections.every((s) => doneSections.has(s.id))) {
        return;
      }

      // Use the section with lowest travel time as representative
      const representative = sections.reduce((min, s) =>
        s.directTravelMin < min.directTravelMin ? s : min,
      );

      // Exclude both directions of this edge
      const excludedEdgeKeys = new Set<string>([
        `${representative.from}→${representative.to}`,
        `${representative.to}→${representative.from}`,
      ]);

      const alternativePath = this.findShortestPathByTravelTime(
        representative.from,
        representative.to,
        consolidatedEdgeTravelTimes,
        excludedEdgeKeys,
      );

      const pathTravelMin = alternativePath
        ? this.calculatePathTravelTime(alternativePath, consolidatedEdgeTravelTimes)
        : Infinity;

      const canConsolidate =
        alternativePath &&
        alternativePath.length >= 3 &&
        pathTravelMin > representative.directTravelMin * 1.01 && // Must be a genuinely different path (not the base edge itself with rounding errors)
        (pathTravelMin <= representative.directTravelMin * (1 + topologyDetourPercent / 100) ||
         pathTravelMin <= representative.directTravelMin + topologyDetourAbsoluteMinutes);

      // Apply decision to ALL sections of this edge group
      sections.forEach((section) => {
        if (doneSections.has(section.id)) {
          return;
        }
        doneSections.add(section.id);

        if (!canConsolidate) {
          return;
        }

        // Determine path for this section
        let pathForSection: string[];
        if (section.from === representative.from && section.to === representative.to) {
          // Same direction
          pathForSection = alternativePath!;
        } else if (section.from === representative.to && section.to === representative.from) {
          // Reverse direction
          pathForSection = [...alternativePath!].reverse();
        } else {
          // Different edge (shouldn't happen, but skip)
          return;
        }

        replacementPathBySectionId.set(section.id, pathForSection);
        totalSegmentsConsolidated++;
        totalInsertedNodes += Math.max(0, pathForSection.length - 2);

        const pathTravelMin = this.calculatePathTravelTime(pathForSection, consolidatedEdgeTravelTimes);
        const allowedTravelMin = section.directTravelMin * (1 + topologyDetourPercent / 100);

        if (!consolidatedDetailsByPatternIndex.has(section.patternIndex)) {
          consolidatedDetailsByPatternIndex.set(section.patternIndex, []);
        }
        consolidatedDetailsByPatternIndex.get(section.patternIndex)!.push({
          from: section.from,
          to: section.to,
          directTravelMin: section.directTravelMin,
          pathTravelMin,
          allowedTravelMin,
          insertedNodes: Math.max(0, pathForSection.length - 2),
          path: [...pathForSection],
        });
      });

      // Remove the edge from graph AFTER all sections are processed
      if (canConsolidate) {
        consolidatedEdgeTravelTimes.delete(`${representative.from}→${representative.to}`);
        consolidatedEdgeTravelTimes.delete(`${representative.to}→${representative.from}`);
      }
    });

    // 5) Materialize merged sections into mapped node sequences and timing interpolation.
    patternContexts.forEach((context) => {
      const {patternIndex, pattern, routeName, representativeTripId, effectiveHalts, actualHalts} = context;

      if (effectiveHalts.length === 0) {
        result.push({
          pattern,
          nodeSequence: pattern.stopSequence,
          halts: new Set(pattern.stopSequence),
          timing: new Map(),
        });
        return;
      }

      const mappedSequence: string[] = [];
      const timing = new Map<string, {arrivalMin?: number; departureMin?: number; isPassThrough: boolean}>();
      const consolidatedSegments = consolidatedDetailsByPatternIndex.get(patternIndex) || [];

      if (effectiveHalts.length > 0) {
        const firstHalt = effectiveHalts[0];
        mappedSequence.push(firstHalt.stationId);
        timing.set(firstHalt.stationId, {
          arrivalMin: firstHalt.arrivalMin,
          departureMin: firstHalt.departureMin,
          isPassThrough: false,
        });
      }

      for (let haltIndex = 0; haltIndex < effectiveHalts.length - 1; haltIndex++) {
        const sourceHalt = effectiveHalts[haltIndex];
        const targetHalt = effectiveHalts[haltIndex + 1];
        const actualTotalTravelTime = Math.max(
          1,
          this.calculateTravelTime(sourceHalt.departureMin, targetHalt.arrivalMin),
        );

        const sectionId = sectionKeyToId.get(`${patternIndex}:${haltIndex}`);
        const replacementPath = sectionId ? replacementPathBySectionId.get(sectionId) : null;
        const path = replacementPath || [sourceHalt.stationId, targetHalt.stationId];

        const pathTravelMin = this.calculatePathTravelTime(path, consolidatedEdgeTravelTimes);
        const allowedTravelTime = actualTotalTravelTime * (1 + topologyDetourPercent / 100);

        const pathWithNames = path.map(id => `${id} (${stationIdToName.get(id) || id})`);
        this.verboseLog("[GTFS][Topology][PathSelection]", {
          routeId: pattern.routeId,
          routeName,
          tripId: representativeTripId,
          from: `${sourceHalt.stationId} (${stationIdToName.get(sourceHalt.stationId) || sourceHalt.stationId})`,
          to: `${targetHalt.stationId} (${stationIdToName.get(targetHalt.stationId) || targetHalt.stationId})`,
          foundPath: !!replacementPath,
          preferredPathTravelTime: pathTravelMin,
          directSectionTravelTime: actualTotalTravelTime,
          allowedTravelTime,
          path: pathWithNames,
        });

        const segmentWeights: number[] = [];
        let totalWeight = 0;
        for (let pathIndex = 0; pathIndex < path.length - 1; pathIndex++) {
          const forwardKey = `${path[pathIndex]}→${path[pathIndex + 1]}`;
          // Use only forward direction (edges are directional)
          const weight = Math.max(1, consolidatedEdgeTravelTimes.get(forwardKey) ?? 1);
          segmentWeights.push(weight);
          totalWeight += weight;
        }

        let cumulativeWeight = 0;
        for (let pathIndex = 1; pathIndex < path.length; pathIndex++) {
          cumulativeWeight += segmentWeights[pathIndex - 1] || 1;
          const nodeId = path[pathIndex];

          if (!mappedSequence.includes(nodeId)) {
            mappedSequence.push(nodeId);
          }

          // Skip if timing already exists for this node (prevents duplicate insertion)
          if (timing.has(nodeId)) {
            continue;
          }

          if (nodeId === targetHalt.stationId) {
            timing.set(nodeId, {
              arrivalMin: targetHalt.arrivalMin,
              departureMin: targetHalt.departureMin,
              isPassThrough: false,
            });
            continue;
          }

          const interpolatedMinute =
            sourceHalt.departureMin + Math.round((actualTotalTravelTime * cumulativeWeight) / totalWeight);
          // Keep timing for all intermediate backbone nodes so section splitting can
          // materialize both pass-through and optional halt-based corridor mappings.
          if (backboneNodes.has(nodeId)) {
            const isPassThrough = !actualHalts.has(nodeId);
            timing.set(nodeId, {
              arrivalMin: interpolatedMinute,
              departureMin: interpolatedMinute,
              isPassThrough,
            });
          }
        }
      }

      result.push({
        pattern,
        nodeSequence: mappedSequence,
        halts: actualHalts,
        timing,
      });

      if (consolidatedSegments.length > 0) {
        console.info("[GTFS][Topology][ConsolidationApplied]", {
          routeId: pattern.routeId,
          routeName,
          tripId: representativeTripId,
          evaluatedSegments: Math.max(0, effectiveHalts.length - 1),
          consolidatedSegments: consolidatedSegments.length,
          insertedNodes: consolidatedSegments.reduce((sum, seg) => sum + seg.insertedNodes, 0),
          details: consolidatedSegments,
        });
      } else {
        console.info("[GTFS][Topology][ConsolidationApplied]", {
          routeId: pattern.routeId,
          routeName,
          tripId: representativeTripId,
          evaluatedSegments: Math.max(0, effectiveHalts.length - 1),
          consolidatedSegments: 0,
          insertedNodes: 0,
        });
      }

      const mappedSequenceWithNames = mappedSequence.map(id => `${id} (${stationIdToName.get(id) || id})`);
      this.verboseLog("[GTFS][Topology][MappedPattern]", {
        routeId: pattern.routeId,
        routeName,
        tripId: representativeTripId,
        haltCount: effectiveHalts.length,
        mappedNodeCount: mappedSequence.length,
        mappedSequence: mappedSequenceWithNames,
      });
    });

    this.verboseLog(`> [T5] Mapped ${result.length} patterns to backbone`);
    console.info("[GTFS][Topology][ConsolidationSummary]", {
      evaluatedSegments: totalSegmentsEvaluated,
      consolidatedSegments: totalSegmentsConsolidated,
      insertedNodes: totalInsertedNodes,
      consolidationRate:
        totalSegmentsEvaluated > 0
          ? `${Math.round((totalSegmentsConsolidated / totalSegmentsEvaluated) * 100)}%`
          : "0%",
    });

    // Final summary: complete path info for each route
    this.verboseLog("\n========== [GTFS][TOPOLOGY][FINAL_SUMMARY] ==========\n");
    result.forEach((mappedPattern) => {
      const {pattern, nodeSequence, halts, timing} = mappedPattern;
      const route = gtfsData.routes.find((r) => r.route_id === pattern.routeId);
      const routeName = route?.route_short_name || route?.route_long_name || pattern.routeId;
      
      const nodeDetails = nodeSequence.map((nodeId) => {
        const stationName = stationIdToName.get(nodeId) || nodeId;
        const timingInfo = timing.get(nodeId);
        const isHalt = halts.has(nodeId);
        const isPassThrough = timingInfo?.isPassThrough || false;
        
        return {
          nodeId,
          stationName,
          isHalt,
          isPassThrough,
          arrivalMin: timingInfo?.arrivalMin,
          departureMin: timingInfo?.departureMin,
        };
      });
      
      this.verboseLog(`[${routeName}] Complete Path:`, {
        routeId: pattern.routeId,
        routeName,
        tripId: pattern.trips[0]?.trip_id || "unknown",
        totalNodes: nodeSequence.length,
        halts: Array.from(halts).map((id: string) => `${id} (${stationIdToName.get(id) || id})`),
        nodes: nodeDetails,
      });
    });
    this.verboseLog("\n====================================================\n");

    return result;
  }

  private getUndirectedEdgeKey(a: string, b: string): string {
    return a <= b ? `${a}↔${b}` : `${b}↔${a}`;
  }

  private findPreferredPathInDag(
    dag: Map<string, Set<string>>,
    sourceNodeId: string,
    targetNodeId: string,
    edgeUsage: Map<string, number>,
    edgeTravelTimes: Map<string, number>,
  ): string[] | null {
    void dag;
    void edgeUsage;

    if (sourceNodeId === targetNodeId) {
      return [sourceNodeId];
    }

    const shortestPath = this.findShortestPathByTravelTime(
      sourceNodeId,
      targetNodeId,
      edgeTravelTimes,
    );
    if (!shortestPath) {
      return null;
    }

    // If shortest path already has intermediate nodes, it is a valid consolidation candidate.
    if (shortestPath.length >= 3) {
      return shortestPath;
    }

    // Otherwise, try best alternative path that does not use the direct edge.
    const excludedEdgeKeys = new Set<string>([
      `${sourceNodeId}→${targetNodeId}`,
      `${targetNodeId}→${sourceNodeId}`,
    ]);

    const alternativePath = this.findShortestPathByTravelTime(
      sourceNodeId,
      targetNodeId,
      edgeTravelTimes,
      excludedEdgeKeys,
    );

    if (alternativePath && alternativePath.length >= 3) {
      return alternativePath;
    }

    return shortestPath;
  }

  private findShortestPathByTravelTime(
    sourceNodeId: string,
    targetNodeId: string,
    edgeTravelTimes: Map<string, number>,
    excludedEdgeKeys: Set<string> = new Set<string>(),
  ): string[] | null {
    const adjacency = this.buildUndirectedMinTravelAdjacency(edgeTravelTimes, excludedEdgeKeys);
    const distances = new Map<string, number>();
    const hops = new Map<string, number>();
    const predecessor = new Map<string, string>();
    const queue = new Set<string>();

    distances.set(sourceNodeId, 0);
    hops.set(sourceNodeId, 0);
    queue.add(sourceNodeId);

    while (queue.size > 0) {
      let current: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      let bestHops = Number.POSITIVE_INFINITY;

      queue.forEach((candidate) => {
        const d = distances.get(candidate) ?? Number.POSITIVE_INFINITY;
        const h = hops.get(candidate) ?? Number.POSITIVE_INFINITY;
        if (d < bestDistance || (d === bestDistance && h < bestHops)) {
          current = candidate;
          bestDistance = d;
          bestHops = h;
        }
      });

      if (!current) {
        break;
      }

      queue.delete(current);
      if (current === targetNodeId) {
        break;
      }

      const neighbors = Array.from(adjacency.get(current)?.entries() || []).sort((a, b) =>
        a[0].localeCompare(b[0]),
      );
      for (const [neighbor, weight] of neighbors) {
        const tentativeDistance = bestDistance + weight;
        const tentativeHops = bestHops + 1;
        const knownDistance = distances.get(neighbor) ?? Number.POSITIVE_INFINITY;
        const knownHops = hops.get(neighbor) ?? Number.POSITIVE_INFINITY;

        if (
          tentativeDistance < knownDistance ||
          (tentativeDistance === knownDistance && tentativeHops < knownHops)
        ) {
          distances.set(neighbor, tentativeDistance);
          hops.set(neighbor, tentativeHops);
          predecessor.set(neighbor, current);
          queue.add(neighbor);
        }
      }
    }

    if (!predecessor.has(targetNodeId)) {
      return null;
    }

    const path: string[] = [targetNodeId];
    let cursor = targetNodeId;
    while (cursor !== sourceNodeId) {
      const previous = predecessor.get(cursor);
      if (!previous) {
        return null;
      }
      path.push(previous);
      cursor = previous;
    }

    return path.reverse();
  }

  private buildUndirectedMinTravelAdjacency(
    edgeTravelTimes: Map<string, number>,
    excludedEdgeKeys: Set<string> = new Set<string>(),
  ): Map<string, Map<string, number>> {
    const adjacency = new Map<string, Map<string, number>>();

    const ensure = (nodeId: string) => {
      if (!adjacency.has(nodeId)) {
        adjacency.set(nodeId, new Map<string, number>());
      }
      return adjacency.get(nodeId)!;
    };

    edgeTravelTimes.forEach((travelTime, edgeKey) => {
      if (excludedEdgeKeys.has(edgeKey)) {
        return;
      }

      const parts = edgeKey.split("→");
      if (parts.length !== 2) {
        return;
      }
      const from = parts[0];
      const to = parts[1];
      const weight = Math.max(1, travelTime || 1);

      const fromAdj = ensure(from);

      const currentForward = fromAdj.get(to);
      if (currentForward === undefined || weight < currentForward) {
        fromAdj.set(to, weight);
      }
      // NOTE: Do NOT add reverse edges. GTFS routes are directional.
      // Allowing backwards traversal creates cycles (A-B-C-B-A).
    });

    return adjacency;
  }

  private calculatePathTravelTime(path: string[], edgeTravelTimes: Map<string, number>): number {
    if (path.length < 2) {
      return 0;
    }

    let total = 0;
    for (let idx = 0; idx < path.length - 1; idx++) {
      const from = path[idx];
      const to = path[idx + 1];
      // Use only forward direction (edges are directional, not bidirectional)
      const weight = edgeTravelTimes.get(`${from}→${to}`) ?? 1;
      total += Math.max(1, weight);
    }

    return total;
  }

  private findAlternativePathHopCount(
    dag: Map<string, Set<string>>,
    sourceNodeId: string,
    targetNodeId: string,
    excludedEdgeKey: string,
    maxDepth = 12,
  ): number | null {
    const queue: Array<{nodeId: string; hops: number}> = [{nodeId: sourceNodeId, hops: 0}];
    const visited = new Set<string>([sourceNodeId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.hops >= maxDepth) {
        continue;
      }

      const neighbors = Array.from(dag.get(current.nodeId) || []);
      for (const neighbor of neighbors) {
        const edgeKey = `${current.nodeId}→${neighbor}`;
        if (edgeKey === excludedEdgeKey) {
          continue;
        }

        const nextHops = current.hops + 1;
        if (neighbor === targetNodeId) {
          return nextHops;
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({nodeId: neighbor, hops: nextHops});
        }
      }
    }

    return null;
  }

  private buildEdgeUsageCounts(patterns: TripPattern[]): Map<string, number> {
    const usage = new Map<string, number>();

    patterns.forEach((pattern) => {
      const sequence = pattern.stopSequence;
      for (let index = 0; index < sequence.length - 1; index++) {
        const from = sequence[index];
        const to = sequence[index + 1];
        const edgeKey = `${from}→${to}`;
        usage.set(edgeKey, (usage.get(edgeKey) || 0) + 1);
      }
    });

    return usage;
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
