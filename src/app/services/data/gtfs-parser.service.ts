import {Injectable} from "@angular/core";
import {parse, ParseResult} from "papaparse";
import * as JSZip from "jszip";

/**
 * GTFS Data Structures
 * Based on https://gtfs.org/schedule/reference/
 */

export interface GTFSStop {
  stop_id: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
  location_type?: string;
  parent_station?: string;
  platform_code?: string;
  // Enriched data for Netzgrafik
  node_type?: "start" | "end" | "junction" | "major_stop" | "minor_stop";
  degree?: number;
}

export interface GTFSAgency {
  agency_id: string;
  agency_name: string;
  agency_url?: string;
  agency_timezone?: string;
  agency_lang?: string;
  agency_phone?: string;
}

export interface GTFSRoute {
  route_id: string;
  agency_id?: string;
  route_short_name: string;
  route_long_name: string;
  route_desc?: string; // Category description (e.g., "InterCity", "S-Bahn")
  route_type: string;
  route_color?: string;
  route_text_color?: string;
  // Enriched data for Netzgrafik
  frequency?: number; // Calculated frequency in minutes (15, 20, 30, 60, 120)
  sample_trip_id?: string; // Representative trip for this route
  category_id?: number; // Mapped Netzgrafik category ID
}

export interface GTFSTrip {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign?: string;
  trip_short_name?: string;
  direction_id?: string;
  block_id?: string;
}

export interface GTFSStopTime {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: string;
  pickup_type?: string;
  drop_off_type?: string;
}

export interface GTFSCalendar {
  service_id: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
  start_date: string;
  end_date: string;
}

export interface GTFSCalendarDate {
  service_id: string;
  date: string; // YYYYMMDD
  exception_type: string; // 1 = added, 2 = removed
}

export interface GTFSData {
  agencies: GTFSAgency[];
  allAgencies?: GTFSAgency[]; // All agencies before filtering
  stops: GTFSStop[];
  routes: GTFSRoute[];
  trips: GTFSTrip[];
  stopTimes: GTFSStopTime[];
  calendar?: GTFSCalendar[];
  calendarDates?: GTFSCalendarDate[];
}

/**
 * Service to parse GTFS data files
 */
@Injectable({
  providedIn: "root",
})
export class GTFSParserService {
  /**
   * Calculate frequency for each route based on stop_times
   * Analyzes a 4-hour window per route and determines the takt
   * Only considers one direction (direction_id=0 or first available) to avoid counting both directions
   */
  private calculateRouteFrequencies(
    routes: GTFSRoute[],
    trips: GTFSTrip[],
    stopTimes: GTFSStopTime[],
  ): void {
    // Build trip to route+direction mapping
    const tripToRouteDirection = new Map<string, {routeId: string; directionId: string}>();
    for (const trip of trips) {
      tripToRouteDirection.set(trip.trip_id, {
        routeId: trip.route_id,
        directionId: trip.direction_id || "0",
      });
    }

    // Calculate frequency for each route (using only one direction)
    for (const route of routes) {
      // Try direction_id=0 first, then fall back to any available direction
      const directionToUse = "0";

      // Group stop_times by route + direction + station
      const stationDepartures = new Map<string, number[]>(); // stop_id -> [departure times in minutes]

      for (const st of stopTimes) {
        const routeDir = tripToRouteDirection.get(st.trip_id);
        if (!routeDir) continue;
        if (routeDir.routeId !== route.route_id) continue;

        // Use only one direction (prefer '0', fallback to '1')
        if (routeDir.directionId !== directionToUse && stationDepartures.size === 0) {
          // If no data yet, accept any direction
        } else if (routeDir.directionId !== directionToUse) {
          continue; // Skip other directions once we have data
        }

        const depTime = st.departure_time || st.arrival_time;
        if (!depTime) continue;

        const depMinutes = GTFSParserService.timeToMinutes(depTime);

        if (!stationDepartures.has(st.stop_id)) {
          stationDepartures.set(st.stop_id, []);
        }
        stationDepartures.get(st.stop_id)!.push(depMinutes);
      }

      if (stationDepartures.size === 0) {
        route.frequency = GTFSParserService.normalizeFrequency(60); // Default 60 minutes
        const routeTrip = trips.find((t) => t.route_id === route.route_id);
        if (routeTrip) {
          route.sample_trip_id = routeTrip.trip_id;
        }
        continue;
      }

      // For each station: sort departures and calculate intervals
      const allRoundedFrequencies: number[] = [];

      for (const [stopId, departures] of stationDepartures.entries()) {
        if (departures.length < 2) continue;

        // Sort departures chronologically
        departures.sort((a, b) => a - b);

        // Calculate intervals between consecutive departures
        for (let i = 1; i < departures.length; i++) {
          const interval = departures[i] - departures[i - 1];

          // Round interval to standard frequency: 15, 20, 30, 60, 120
          let roundedFreq: number;
          if (interval <= 17) {
            roundedFreq = 15;
          } else if (interval <= 25) {
            roundedFreq = 20;
          } else if (interval <= 45) {
            roundedFreq = 30;
          } else if (interval <= 90) {
            roundedFreq = 60;
          } else if (interval <= 150) {
            roundedFreq = 120;
          } else {
            // >150 min (e.g., 3h, 4h, 6h) -> default to 60
            roundedFreq = 60;
          }

          allRoundedFrequencies.push(roundedFreq);
        }
      }

      if (allRoundedFrequencies.length === 0) {
        route.frequency = GTFSParserService.normalizeFrequency(60);
        const routeTrip = trips.find((t) => t.route_id === route.route_id);
        if (routeTrip) {
          route.sample_trip_id = routeTrip.trip_id;
        }
        continue;
      }

      // Create histogram: count occurrences of each frequency
      const histogram = new Map<number, number>();
      for (const freq of allRoundedFrequencies) {
        histogram.set(freq, (histogram.get(freq) || 0) + 1);
      }

      // Find most common frequency (mode)
      let mostCommonFreq = 60; // default
      let maxCount = 0;
      for (const [freq, count] of histogram.entries()) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonFreq = freq;
        }
      }

      // For 120 min frequency: check if even or odd hours
      let finalFrequency = mostCommonFreq;
      if (mostCommonFreq === 120) {
        // Get all first departures to determine even/odd pattern
        const firstDepartures: number[] = [];
        for (const departures of stationDepartures.values()) {
          if (departures.length > 0) {
            firstDepartures.push(Math.min(...departures));
          }
        }

        if (firstDepartures.length > 0) {
          // Check first departure hour
          const firstDepMinutes = Math.min(...firstDepartures);
          const firstHour = Math.floor(firstDepMinutes / 60);

          if (firstHour % 2 === 1) {
            // Odd hours: use 120 but mark as offset (we'll use default freq metadata)
            finalFrequency = 120; // Keep as 120, metadata will handle offset
          }
        }
      }

      route.frequency = GTFSParserService.normalizeFrequency(finalFrequency);

      // Select representative trip: find trip that matches the frequency pattern
      const allTripDepartures: Array<[string, number]> = [];
      for (const st of stopTimes) {
        const routeDir = tripToRouteDirection.get(st.trip_id);
        if (!routeDir || routeDir.routeId !== route.route_id) continue;
        if (routeDir.directionId !== directionToUse) continue;

        if (!allTripDepartures.find((td) => td[0] === st.trip_id)) {
          const depTime = st.departure_time || st.arrival_time;
          if (depTime) {
            allTripDepartures.push([st.trip_id, GTFSParserService.timeToMinutes(depTime)]);
          }
        }
      }

      allTripDepartures.sort((a, b) => a[1] - b[1]);

      // Select trip based on frequency pattern
      let selectedTrip: string | undefined;
      for (const [tripId, depMinutes] of allTripDepartures) {
        const hour = Math.floor(depMinutes / 60);
        const minute = depMinutes % 60;

        let matches = false;
        switch (route.frequency) {
          case 15:
            matches = minute === 0 || minute === 15 || minute === 30 || minute === 45;
            break;
          case 20:
            matches = minute === 0 || minute === 20 || minute === 40;
            break;
          case 30:
            matches = minute === 0 || minute === 30;
            break;
          case 60:
            matches = minute === 0;
            break;
          case 120:
            matches = minute === 0 && (hour % 2 === 0 || hour % 2 === 1); // Accept both even/odd
            break;
          default:
            matches = true;
        }

        if (matches) {
          selectedTrip = tripId;
          break;
        }
      }

      route.sample_trip_id =
        selectedTrip || (allTripDepartures.length > 0 ? allTripDepartures[0][0] : undefined);
    }

    // Log frequency distribution
    const freqDist = {
      15: routes.filter((r) => r.frequency === 15).length,
      20: routes.filter((r) => r.frequency === 20).length,
      30: routes.filter((r) => r.frequency === 30).length,
      60: routes.filter((r) => r.frequency === 60).length,
      120: routes.filter((r) => r.frequency === 120).length,
    };
  }

  /**
   * Classify stops/nodes based on network topology
   * New algorithm: Build undirected graph at STATION level (parent_station, makroskopisch)
   */
  private classifyNodes(stops: GTFSStop[], stopTimes: GTFSStopTime[], trips: GTFSTrip[]): void {

    // Step 1: Build stop_id -> parent_station mapping (same as in identifyTripPatterns)
    const stopToStation = new Map<string, string>();
    stops.forEach((stop) => {
      if (stop.parent_station && stop.parent_station !== "") {
        stopToStation.set(stop.stop_id, stop.parent_station);
      } else {
        // This stop is a station itself (no parent)
        stopToStation.set(stop.stop_id, stop.stop_id);
      }
    });

    // Step 2: Filter to only station nodes (location_type = 1 or no parent_station)
    const stationStops = stops.filter(
      (s) => s.location_type === "1" || !s.parent_station || s.parent_station === "",
    );

    // Step 3: Initialize node properties at STATION level (parent_station IDs)
    const nodeStartTag = new Set<string>(); // station_ids tagged as start
    const nodeEndTag = new Set<string>(); // station_ids tagged as end
    const nodeEdges = new Map<string, Set<string>>(); // undirected edges: station_id -> Set of connected station_ids
    const nodeIsStop = new Set<string>(); // stations where trains actually stop

    // Step 4: Group stop_times by trip
    const tripStopTimes = new Map<string, GTFSStopTime[]>();
    for (const st of stopTimes) {
      if (!tripStopTimes.has(st.trip_id)) {
        tripStopTimes.set(st.trip_id, []);
      }
      tripStopTimes.get(st.trip_id)!.push(st);
    }

    // Step 5: Build graph at STATION level (map platform stop_ids to parent_station)
    for (const [tripId, sts] of tripStopTimes.entries()) {
      // Sort by stop_sequence
      const sorted = sts.sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

      if (sorted.length === 0) continue;

      // Convert stop_ids to station_ids (parent_station)
      const stationSequence = sorted.map((st) => stopToStation.get(st.stop_id) || st.stop_id);

      // Process each station in the sequence
      for (let i = 0; i < stationSequence.length; i++) {
        const stationId = stationSequence[i];

        // Tag first element as start node
        if (i === 0) {
          nodeStartTag.add(stationId);
        }

        // Tag last element as end node
        if (i === stationSequence.length - 1) {
          nodeEndTag.add(stationId);
        }

        // Check if this is an actual stop (not just pass-through)
        const isActualStop = sorted[i].pickup_type !== "1" && sorted[i].drop_off_type !== "1";
        if (isActualStop) {
          nodeIsStop.add(stationId);
        }

        // Build undirected edge to previous station
        if (i > 0) {
          const prevStationId = stationSequence[i - 1];

          // Skip if same station (can happen if multiple platforms in sequence)
          if (prevStationId === stationId) continue;

          // Add edge in both directions (undirected)
          if (!nodeEdges.has(stationId)) {
            nodeEdges.set(stationId, new Set());
          }
          nodeEdges.get(stationId)!.add(prevStationId);

          if (!nodeEdges.has(prevStationId)) {
            nodeEdges.set(prevStationId, new Set());
          }
          nodeEdges.get(prevStationId)!.add(stationId);
        }
      }
    }

    // Step 6: Classify each station stop based on degree and properties
    for (const stop of stationStops) {
      const stationId = stop.stop_id; // This is a parent_station (station-level stop)
      const edges = nodeEdges.get(stationId) || new Set();
      const degree = edges.size;
      const isStart = nodeStartTag.has(stationId);
      const isEnd = nodeEndTag.has(stationId);
      const hasStop = nodeIsStop.has(stationId);

      stop.degree = degree;

      // Classification based on algorithm:
      if (isStart) {
        stop.node_type = "start";
      } else if (isEnd) {
        stop.node_type = "end";
      } else if (degree === 2) {
        // degree == 2 and at least one stop → minor node
        stop.node_type = hasStop ? "minor_stop" : "minor_stop";
      } else if (degree > 2) {
        // degree > 2 and at least one stop → major node
        // degree > 2 and no stop → junction only
        stop.node_type = hasStop ? "major_stop" : "junction";
      } else {
        // degree < 2 (isolated or single connection)
        stop.node_type = "minor_stop";
      }
    }

    // Count node types
    const typeCounts = {
      start: stationStops.filter((s) => s.node_type === "start").length,
      end: stationStops.filter((s) => s.node_type === "end").length,
      junction: stationStops.filter((s) => s.node_type === "junction").length,
      major_stop: stationStops.filter((s) => s.node_type === "major_stop").length,
      minor_stop: stationStops.filter((s) => s.node_type === "minor_stop").length,
    };

    // Debug: Show some examples
    const examples = {
      start: stationStops.filter((s) => s.node_type === "start").slice(0, 3),
      end: stationStops.filter((s) => s.node_type === "end").slice(0, 3),
      junction: stationStops.filter((s) => s.node_type === "junction").slice(0, 3),
      major_stop: stationStops.filter((s) => s.node_type === "major_stop").slice(0, 3),
    };
  }

  /**
   * Reduce trips to representatives (one per route + direction + headsign)
   * This dramatically reduces the number of trips to load stop_times for
   */
  private reduceTripsToRepresentatives(trips: GTFSTrip[], routes: GTFSRoute[]): GTFSTrip[] {
    // Group trips by route_id + direction_id + trip_headsign
    const groupMap = new Map<string, GTFSTrip[]>();

    for (const trip of trips) {
      const key = `${trip.route_id}|${trip.direction_id || "0"}|${trip.trip_headsign || ""}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(trip);
    }

    // Select one representative trip per group
    const representatives: GTFSTrip[] = [];
    for (const [key, groupTrips] of groupMap.entries()) {
      // Just take the first trip as representative
      // TODO: Could analyze service_id to pick a representative weekday service
      representatives.push(groupTrips[0]);
    }

    return representatives;
  }

  /**
   * Lightweight GTFS parser - only reads agencies and routes for filter autocomplete
   * Much faster than full parse, used to populate filter options quickly
   * @param file The ZIP file containing GTFS data
   * @param allowedRouteTypes Optional array of GTFS route_type values to filter
   * @returns Promise with agencies and routes
   */
  async parseGTFSZipLight(
    file: File,
    allowedRouteTypes?: number[],
  ): Promise<{
    agencies: GTFSAgency[];
    routes: GTFSRoute[];
  }> {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    const result = {
      agencies: [] as GTFSAgency[],
      routes: [] as GTFSRoute[],
    };

    // Parse agency.txt only
    const agencyFile = zipContent.file("agency.txt");
    if (agencyFile) {
      const agencyText = await agencyFile.async("text");
      result.agencies = this.parseCSV<GTFSAgency>(agencyText);
    }

    // Parse routes.txt only (for categories)
    const routesFile = zipContent.file("routes.txt");
    if (routesFile) {
      const routesText = await routesFile.async("text");
      result.routes = this.parseCSV<GTFSRoute>(routesText);

      // Apply route type filter if specified
      if (allowedRouteTypes && allowedRouteTypes.length > 0) {
        const beforeFilter = result.routes.length;
        result.routes = result.routes.filter((route) => {
          const routeType = parseInt(route.route_type?.toString() || "3", 10);
          return allowedRouteTypes.includes(routeType);
        });
      }
    }

    return result;
  }

  /**
   * Helper: Parse GTFS date string (YYYYMMDD) to Date object
   */
  private parseGTFSDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.length !== 8) return null;
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // 0-based
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  }

  /**
   * Parse multiple GTFS files from a ZIP file
   * @param file The ZIP file containing GTFS data
   * @param allowedRouteTypes Optional array of GTFS route_type values to filter (e.g., [0, 1, 2] for tram, metro, rail)
   * @param allowedAgencies Optional array of agency names to filter (e.g., ['SBB', 'DB'])
   * @returns Promise with parsed GTFS data
   */
  async parseGTFSZip(
    file: File,
    allowedRouteTypes?: number[],
    allowedAgencies?: string[],
    progressCallback?: (fileName: string) => void,
  ): Promise<GTFSData> {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    const gtfsData: GTFSData = {
      agencies: [],
      stops: [],
      routes: [],
      trips: [],
      stopTimes: [],
      calendar: [],
    };

    // Parse agency.txt
    const agencyFile = zipContent.file("agency.txt");
    if (agencyFile) {
      const agencyText = await agencyFile.async("text");
      gtfsData.agencies = this.parseCSV<GTFSAgency>(agencyText);

      // Store all agencies before filtering
      gtfsData.allAgencies = [...gtfsData.agencies];

      // Apply agency filter if specified
      if (allowedAgencies && allowedAgencies.length > 0) {
        const beforeFilter = gtfsData.agencies.length;
        gtfsData.agencies = gtfsData.agencies.filter((agency) => {
          // Check if agency name contains any of the allowed agency identifiers
          const agencyName = agency.agency_name || "";
          const matches = allowedAgencies.some((allowed) =>
            agencyName.toUpperCase().includes(allowed.toUpperCase()),
          );
          return matches;
        });
      }
    }

    // Parse stops.txt
    const stopsFile = zipContent.file("stops.txt");
    if (stopsFile) {
      const stopsText = await stopsFile.async("text");
      gtfsData.stops = this.parseCSV<GTFSStop>(stopsText);
    }

    // Parse routes.txt
    const routesFile = zipContent.file("routes.txt");
    if (routesFile) {
      const routesText = await routesFile.async("text");
      gtfsData.routes = this.parseCSV<GTFSRoute>(routesText);

      // Apply agency filter if specified (filter by agency)
      if (allowedAgencies && allowedAgencies.length > 0) {
        const beforeFilter = gtfsData.routes.length;
        const allowedAgencyIds = new Set(gtfsData.agencies.map((a) => a.agency_id));
        gtfsData.routes = gtfsData.routes.filter((route) => {
          // If route has no agency_id, include it (could be default agency)
          if (!route.agency_id)
            return allowedAgencyIds.size === 0 || gtfsData.agencies.length === 0;
          return allowedAgencyIds.has(route.agency_id);
        });
      }

      // Apply route type filter if specified
      if (allowedRouteTypes && allowedRouteTypes.length > 0) {
        const beforeFilter = gtfsData.routes.length;
        gtfsData.routes = gtfsData.routes.filter((route) => {
          const routeType = parseInt(route.route_type?.toString() || "3", 10);
          return allowedRouteTypes.includes(routeType);
        });

     
      }

      // Debug: Show route_desc distribution
      const routeDescCounts = new Map<string, number>();
      gtfsData.routes.forEach((route) => {
        const desc = route.route_desc || "UNKNOWN";
        routeDescCounts.set(desc, (routeDescCounts.get(desc) || 0) + 1);
      });
    }

    // Parse trips.txt
    const tripsFile = zipContent.file("trips.txt");
    if (tripsFile) {
      const tripsText = await tripsFile.async("text");
      gtfsData.trips = this.parseCSV<GTFSTrip>(tripsText);

      // Filter trips by route filter if specified
      if (
        (allowedRouteTypes && allowedRouteTypes.length > 0) ||
        (allowedAgencies && allowedAgencies.length > 0)
      ) {
        const beforeFilter = gtfsData.trips.length;
        const allowedRouteIds = new Set(gtfsData.routes.map((r) => r.route_id));
        gtfsData.trips = gtfsData.trips.filter((trip) => allowedRouteIds.has(trip.route_id));
      }

      // Keep ALL trips - will select most frequent per route AFTER parsing stop_times
    }

    // Parse stop_times.txt using streaming approach (chunk-by-chunk to avoid memory issues)
    const stopTimesFile = zipContent.file("stop_times.txt");
    gtfsData.stopTimes = []; // Initialize empty

    if (stopTimesFile) {
      try {
        // Create Set of allowed trip IDs for fast lookup
        const allowedTripIds = new Set(gtfsData.trips.map((t) => t.trip_id));

        // Use arraybuffer and process in chunks to avoid string length limit
        const chunkSize = 10 * 1024 * 1024; // 10MB chunks
        const arrayBuffer = await stopTimesFile.async("arraybuffer");
        const totalSize = arrayBuffer.byteLength;

        const decoder = new TextDecoder("utf-8");
        let leftover = "";
        let header: string[] = [];
        let lineCount = 0;
        let keepCount = 0;
        const filteredStopTimes: GTFSStopTime[] = [];

        for (let offset = 0; offset < totalSize; offset += chunkSize) {
          const chunk = new Uint8Array(
            arrayBuffer,
            offset,
            Math.min(chunkSize, totalSize - offset),
          );
          const text = leftover + decoder.decode(chunk, {stream: offset + chunkSize < totalSize});
          const lines = text.split("\n");

          // Keep last incomplete line for next chunk
          leftover = lines.pop() || "";

          for (const line of lines) {
            lineCount++;
            if (lineCount === 1) {
              // Parse header
              header = line.split(",").map((h) => h.trim().replace(/['"]/g, ""));
              continue;
            }

            if (!line.trim()) continue;

            // Parse line manually (faster than CSV parser for simple cases)
            const values = line.split(",");
            if (values.length < header.length) continue;

            // Get trip_id (usually first column)
            const tripIdIndex = header.indexOf("trip_id");
            const departureTimeIndex = header.indexOf("departure_time");
            const arrivalTimeIndex = header.indexOf("arrival_time");

            if (tripIdIndex < 0 || tripIdIndex >= values.length) continue;

            const tripId = values[tripIdIndex].trim().replace(/['"]/g, "");

            // Quick filter: only process if trip_id matches
            if (!allowedTripIds.has(tripId)) continue;

            // Parse full record
            const record: any = {};
            for (let i = 0; i < header.length && i < values.length; i++) {
              record[header[i]] = values[i].trim().replace(/['"]/g, "");
            }

            filteredStopTimes.push(record as GTFSStopTime);
            keepCount++;
          }
        }

        gtfsData.stopTimes = filteredStopTimes;
      } catch (error: any) {
        gtfsData.stopTimes = [];
      }
    }

    // Parse calendar.txt (optional)
    const calendarFile = zipContent.file("calendar.txt");
    if (calendarFile) {
      const calendarText = await calendarFile.async("text");
      gtfsData.calendar = this.parseCSV<GTFSCalendar>(calendarText);
    }

    // Parse calendar_dates.txt (optional)
    const calendarDatesFile = zipContent.file("calendar_dates.txt");
    if (calendarDatesFile) {
      const calendarDatesText = await calendarDatesFile.async("text");
      gtfsData.calendarDates = this.parseCSV<GTFSCalendarDate>(calendarDatesText);
    }

    // Post-processing: Calculate frequencies and classify nodes

    if (gtfsData.stopTimes.length > 0) {
      // Select most frequent trip per route (8-16h window, includes frequency calculation)
      this.selectMostFrequentTripPatterns(gtfsData);

      // Always classify nodes
      this.classifyNodes(gtfsData.stops, gtfsData.stopTimes, gtfsData.trips);
    }

    return gtfsData;
  }

  /**
   * Select most frequent trip pattern per route+direction
   * Analyzes ALL trips across all service days to find the most common pattern
   * Filters to 8-16h time window per Swiss GTFS standards
   * @param gtfsData GTFS data to filter in-place
   */
  private selectMostFrequentTripPatterns(gtfsData: GTFSData): void {
    const TIME_WINDOW_START = 8 * 60; // 08:00
    const TIME_WINDOW_END = 16 * 60; // 16:00

    // Build trip_id -> stop_sequence pattern mapping
    const tripPatterns = new Map<string, string>();
    const tripFirstDeparture = new Map<string, number>(); // trip_id -> first departure time in minutes

    // Build full patterns (sorted stop_ids) and extract first departure time
    const tripStopTimes = new Map<string, GTFSStopTime[]>();
    for (const st of gtfsData.stopTimes) {
      if (!tripStopTimes.has(st.trip_id)) {
        tripStopTimes.set(st.trip_id, []);
      }
      tripStopTimes.get(st.trip_id)!.push(st);
    }

    for (const [tripId, stopTimes] of tripStopTimes.entries()) {
      const sorted = stopTimes.sort(
        (a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence),
      );
      const pattern = sorted.map((st) => st.stop_id).join(",");
      tripPatterns.set(tripId, pattern);

      // Extract first departure time
      if (sorted.length > 0) {
        const firstStop = sorted[0];
        const depTime = firstStop.departure_time || firstStop.arrival_time;
        if (depTime) {
          tripFirstDeparture.set(tripId, GTFSParserService.timeToMinutes(depTime));
        }
      }
    }

    // Group trips by route_id + direction_id
    const routeGroups = new Map<string, GTFSTrip[]>();
    for (const trip of gtfsData.trips) {
      const key = `${trip.route_id}|${trip.direction_id || "0"}`;
      if (!routeGroups.has(key)) {
        routeGroups.set(key, []);
      }
      routeGroups.get(key)!.push(trip);
    }

    // For each group, find most frequent pattern AND calculate frequency
    const selectedTripIds = new Set<string>();
    let totalPatternsByRoute = 0;
    let totalTripsKept = 0;
    let tripsInTimeWindow = 0;
    let tripsOutsideWindow = 0;

    for (const [routeKey, trips] of routeGroups.entries()) {
      // Filter trips to time window (8-16h)
      const tripsInWindow = trips.filter((trip) => {
        const depTime = tripFirstDeparture.get(trip.trip_id);
        return depTime !== undefined && depTime >= TIME_WINDOW_START && depTime < TIME_WINDOW_END;
      });

      tripsInTimeWindow += tripsInWindow.length;
      tripsOutsideWindow += trips.length - tripsInWindow.length;

      // If no trips in time window, skip this route
      if (tripsInWindow.length === 0) {
        continue;
      }

      // Count pattern frequencies (only in time window)
      const patternCounts = new Map<string, number>();
      const patternExamples = new Map<string, string[]>(); // pattern -> array of trip_ids

      for (const trip of tripsInWindow) {
        const pattern = tripPatterns.get(trip.trip_id);
        if (pattern) {
          patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
          if (!patternExamples.has(pattern)) {
            patternExamples.set(pattern, []);
          }
          patternExamples.get(pattern)!.push(trip.trip_id);
        }
      }

      if (patternCounts.size === 0) continue;

      // Find most frequent pattern
      let maxCount = 0;
      let mostFrequentPattern = "";
      for (const [pattern, count] of patternCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          mostFrequentPattern = pattern;
        }
      }

      // Get all trips with most frequent pattern
      const representativeTrips = patternExamples.get(mostFrequentPattern) || [];

      // Calculate frequency: Count how often this pattern appears (across all days)
      // This represents the frequency over the entire GTFS validity period
      const departureTimes = representativeTrips
        .map((tid) => tripFirstDeparture.get(tid))
        .filter((t) => t !== undefined)
        .sort((a, b) => a! - b!);

      let frequency = 60; // default
      if (departureTimes.length >= 2) {
        // Count unique departure times (same time = same takt)
        const uniqueTimes = new Set(departureTimes);

        // If many trips with same departure time → high frequency
        // Average trips per unique time gives us frequency indicator
        const tripsPerTime = representativeTrips.length / uniqueTimes.size;

        // Calculate intervals between unique departure times
        const uniqueTimesArray = Array.from(uniqueTimes).sort((a, b) => a - b);
        const intervals: number[] = [];
        for (let i = 1; i < uniqueTimesArray.length; i++) {
          intervals.push(uniqueTimesArray[i] - uniqueTimesArray[i - 1]);
        }

        if (intervals.length > 0) {
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

          // Round to standard frequencies
          if (avgInterval <= 17) frequency = 15;
          else if (avgInterval <= 25) frequency = 20;
          else if (avgInterval <= 45) frequency = 30;
          else if (avgInterval <= 90) frequency = 60;
          else if (avgInterval <= 150) frequency = 120;
          else frequency = 121; // 120+
        }
      }
      // Normalize frequency to ensure only valid values are used
      frequency = GTFSParserService.normalizeFrequency(frequency);

      // Select ONE representative trip (prefer one in middle of time window)
      let representativeTripId = representativeTrips[0];
      if (representativeTrips.length > 1) {
        // Find trip closest to 12:00 (middle of day)
        const midDay = 12 * 60;
        let minDiff = Infinity;
        for (const tid of representativeTrips) {
          const depTime = tripFirstDeparture.get(tid);
          if (depTime !== undefined) {
            const diff = Math.abs(depTime - midDay);
            if (diff < minDiff) {
              minDiff = diff;
              representativeTripId = tid;
            }
          }
        }
      }

      if (representativeTripId) {
        selectedTripIds.add(representativeTripId);
        totalTripsKept++;

        // Store frequency in route (for later use)
        const route = gtfsData.routes.find((r) => r.route_id === routeKey.split("|")[0]);
        if (route && !route.frequency) {
          route.frequency = GTFSParserService.normalizeFrequency(frequency);
        }
      }

      totalPatternsByRoute += patternCounts.size;
    }

    // Filter trips and stopTimes
    const beforeTrips = gtfsData.trips.length;
    gtfsData.trips = gtfsData.trips.filter((trip) => selectedTripIds.has(trip.trip_id));
    const beforeStopTimes = gtfsData.stopTimes.length;
    gtfsData.stopTimes = gtfsData.stopTimes.filter((st) => selectedTripIds.has(st.trip_id));
  }

  /**
   * Parse a single CSV text content
   * @param text CSV text content
   * @returns Array of parsed objects
   */
  private parseCSV<T>(text: string): T[] {
    const result: ParseResult<T> = parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });
    return result.data;
  }

  /**
   * Convert GTFS time string (HH:MM:SS) to minutes since midnight
   * @param timeStr Time string in format HH:MM:SS
   * @returns Minutes since midnight
   */
  static timeToMinutes(timeStr: string): number {
    const parts = timeStr.split(":");
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes since midnight to time string (HH:MM)
   * @param minutes Minutes since midnight
   * @returns Time string in format HH:MM
   */
  static minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  }

  /**
   * Normalize frequency to standard values: 15, 20, 30, 60, 120, 121
   * If frequency is not one of these values, default to 60
   * @param frequency Frequency value to normalize
   * @returns Normalized frequency (15, 20, 30, 60, 120, or 121)
   */
  private static normalizeFrequency(frequency: number): number {
    const validFrequencies = [15, 20, 30, 60, 120, 121];
    if (validFrequencies.includes(frequency)) {
      return frequency;
    }
    return 60;
  }

  /**
   * Get all service_ids that operate on a specific date
   * @param dateStr Date in YYYY-MM-DD format
   * @param calendar Calendar entries
   * @param calendarDates Calendar dates (exceptions)
   * @returns Set of service_ids operating on this date
   */
  private getServiceIdsForDate(
    dateStr: string,
    calendar: GTFSCalendar[],
    calendarDates: GTFSCalendarDate[],
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
}
