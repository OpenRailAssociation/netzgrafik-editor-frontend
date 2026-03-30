import { Injectable } from "@angular/core";
import { parse, ParseResult } from "papaparse";
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
  node_type?: 'start' | 'end' | 'junction' | 'major_stop' | 'minor_stop';
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
  route_desc?: string;  // Category description (e.g., "InterCity", "S-Bahn")
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

export interface GTFSData {
  agencies: GTFSAgency[];
  allAgencies?: GTFSAgency[];  // All agencies before filtering
  stops: GTFSStop[];
  routes: GTFSRoute[];
  trips: GTFSTrip[];
  stopTimes: GTFSStopTime[];
  calendar?: GTFSCalendar[];
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
    stopTimes: GTFSStopTime[]
  ): void {
    console.log('  📊 Calculating route frequencies from stop_times (one direction only)...');
    
    // Group stop_times by route AND direction
    const routeDirectionStopTimesMap = new Map<string, GTFSStopTime[]>();
    
    // Build trip to route+direction mapping
    const tripToRouteDirection = new Map<string, { routeId: string, directionId: string }>();
    for (const trip of trips) {
      tripToRouteDirection.set(trip.trip_id, {
        routeId: trip.route_id,
        directionId: trip.direction_id || '0'
      });
    }
    
    // Group stop_times by route+direction
    for (const st of stopTimes) {
      const routeDir = tripToRouteDirection.get(st.trip_id);
      if (!routeDir) continue;
      
      const key = `${routeDir.routeId}_${routeDir.directionId}`;
      if (!routeDirectionStopTimesMap.has(key)) {
        routeDirectionStopTimesMap.set(key, []);
      }
      routeDirectionStopTimesMap.get(key)!.push(st);
    }
    
    // Calculate frequency for each route (using only one direction)
    for (const route of routes) {
      // Try direction_id=0 first, then fall back to any available direction
      let routeStopTimes = routeDirectionStopTimesMap.get(`${route.route_id}_0`);
      
      if (!routeStopTimes || routeStopTimes.length === 0) {
        // Try direction_id=1
        routeStopTimes = routeDirectionStopTimesMap.get(`${route.route_id}_1`);
      }
      
      if (!routeStopTimes || routeStopTimes.length === 0) {
        route.frequency = 60; // Default 60 minutes
        // Try to find a sample trip for this route
        const routeTrip = trips.find(t => t.route_id === route.route_id);
        if (routeTrip) {
          route.sample_trip_id = routeTrip.trip_id;
        }
        continue;
      }
      
      // Get departure times from first stop of each trip (single direction only)
      const tripFirstStops = new Map<string, number>();
      for (const st of routeStopTimes) {
        if (!tripFirstStops.has(st.trip_id)) {
          const depTime = st.departure_time || st.arrival_time;
          if (depTime) {
            tripFirstStops.set(st.trip_id, GTFSParserService.timeToMinutes(depTime));
          }
        }
      }
      
      // Sort departure times and get sample trip
      const tripDepartures = Array.from(tripFirstStops.entries()).sort((a, b) => a[1] - b[1]);
      const departures = tripDepartures.map(td => td[1]);
      
      // Set sample trip (first trip in time window)
      if (tripDepartures.length > 0) {
        route.sample_trip_id = tripDepartures[0][0];
      }
      
      if (departures.length < 2) {
        route.frequency = 60;
        continue;
      }
      
      // Calculate intervals between departures
      const intervals: number[] = [];
      for (let i = 1; i < departures.length; i++) {
        intervals.push(departures[i] - departures[i - 1]);
      }
      
      // Find most common interval (rounded to standard values: 15, 20, 30, 60, 120)
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      
      // Round to nearest standard frequency
      if (avgInterval <= 17) {
        route.frequency = 15;
      } else if (avgInterval <= 25) {
        route.frequency = 20;
      } else if (avgInterval <= 45) {
        route.frequency = 30;
      } else if (avgInterval <= 90) {
        route.frequency = 60;
      } else {
        route.frequency = 120;
      }
    }
    
    // Log frequency distribution
    const freqDist = {
      15: routes.filter(r => r.frequency === 15).length,
      20: routes.filter(r => r.frequency === 20).length,
      30: routes.filter(r => r.frequency === 30).length,
      60: routes.filter(r => r.frequency === 60).length,
      120: routes.filter(r => r.frequency === 120).length,
    };
    console.log('  ✓ Calculated frequencies for', routes.length, 'routes');
    console.log('  📊 Frequency distribution:', freqDist);
  }

  /**
   * Classify stops/nodes based on network topology
   * New algorithm: Build undirected graph at STATION level (parent_station, makroskopisch)
   */
  private classifyNodes(stops: GTFSStop[], stopTimes: GTFSStopTime[], trips: GTFSTrip[]): void {
    console.log('  🏛️  Classifying nodes based on topology (MAKROSKOPISCH - Station level)...');
    
    // Step 1: Build stop_id -> parent_station mapping (same as in identifyTripPatterns)
    const stopToStation = new Map<string, string>();
    stops.forEach(stop => {
      if (stop.parent_station && stop.parent_station !== '') {
        stopToStation.set(stop.stop_id, stop.parent_station);
      } else {
        // This stop is a station itself (no parent)
        stopToStation.set(stop.stop_id, stop.stop_id);
      }
    });
    console.log('  📍 Built stop-to-station mapping for', stopToStation.size, 'stops');
    
    // Step 2: Filter to only station nodes (location_type = 1 or no parent_station)
    const stationStops = stops.filter(s => 
      s.location_type === '1' || !s.parent_station || s.parent_station === ''
    );
    console.log('  ℹ️  Found', stationStops.length, 'station nodes (parent_station level)');
    
    // Step 3: Initialize node properties at STATION level (parent_station IDs)
    const nodeStartTag = new Set<string>(); // station_ids tagged as start
    const nodeEndTag = new Set<string>();   // station_ids tagged as end
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
    
    console.log('  🔄 Processing', tripStopTimes.size, 'trips to build STATION-level graph...');
    
    // Step 5: Build graph at STATION level (map platform stop_ids to parent_station)
    for (const [tripId, sts] of tripStopTimes.entries()) {
      // Sort by stop_sequence
      const sorted = sts.sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
      
      if (sorted.length === 0) continue;
      
      // Convert stop_ids to station_ids (parent_station)
      const stationSequence = sorted.map(st => stopToStation.get(st.stop_id) || st.stop_id);
      
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
        const isActualStop = sorted[i].pickup_type !== '1' && sorted[i].drop_off_type !== '1';
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
    
    console.log('  ✓ Built undirected STATION-level graph with', nodeEdges.size, 'nodes');
    console.log('  📊 Graph stats:', {
      startNodes: nodeStartTag.size,
      endNodes: nodeEndTag.size,
      actualStops: nodeIsStop.size,
      totalEdges: Array.from(nodeEdges.values()).reduce((sum, edges) => sum + edges.size, 0) / 2 // divide by 2 for undirected
    });
    
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
        stop.node_type = 'start';
      } else if (isEnd) {
        stop.node_type = 'end';
      } else if (degree === 2) {
        // degree == 2 and at least one stop → minor node
        stop.node_type = hasStop ? 'minor_stop' : 'minor_stop';
      } else if (degree > 2) {
        // degree > 2 and at least one stop → major node
        // degree > 2 and no stop → junction only
        stop.node_type = hasStop ? 'major_stop' : 'junction';
      } else {
        // degree < 2 (isolated or single connection)
        stop.node_type = 'minor_stop';
      }
    }
    
    // Count node types
    const typeCounts = {
      start: stationStops.filter(s => s.node_type === 'start').length,
      end: stationStops.filter(s => s.node_type === 'end').length,
      junction: stationStops.filter(s => s.node_type === 'junction').length,
      major_stop: stationStops.filter(s => s.node_type === 'major_stop').length,
      minor_stop: stationStops.filter(s => s.node_type === 'minor_stop').length,
    };
    
    console.log('  ✓ Node classification (MAKROSKOPISCH):', typeCounts);
    
    // Debug: Show some examples
    const examples = {
      start: stationStops.filter(s => s.node_type === 'start').slice(0, 3),
      end: stationStops.filter(s => s.node_type === 'end').slice(0, 3),
      junction: stationStops.filter(s => s.node_type === 'junction').slice(0, 3),
      major_stop: stationStops.filter(s => s.node_type === 'major_stop').slice(0, 3),
    };
    
    console.log('  📋 Example classifications (Station-level):');
    Object.entries(examples).forEach(([type, nodes]) => {
      if (nodes.length > 0) {
        console.log(`    ${type}:`, nodes.map(n => `${n.stop_name} (degree: ${n.degree})`));
      }
    });
  }

  /**
   * Reduce trips to representatives (one per route + direction + headsign)
   * This dramatically reduces the number of trips to load stop_times for
   */
  private reduceTripsToRepresentatives(trips: GTFSTrip[], routes: GTFSRoute[]): GTFSTrip[] {
    // Group trips by route_id + direction_id + trip_headsign
    const groupMap = new Map<string, GTFSTrip[]>();
    
    for (const trip of trips) {
      const key = `${trip.route_id}|${trip.direction_id || '0'}|${trip.trip_headsign || ''}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(trip);
    }
    
    console.log('  📊 Found', groupMap.size, 'unique route/direction/headsign combinations');
    
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
   * Parse multiple GTFS files from a ZIP file
   * @param file The ZIP file containing GTFS data
   * @param allowedRouteTypes Optional array of GTFS route_type values to filter (e.g., [0, 1, 2] for tram, metro, rail)
   * @param allowedAgencies Optional array of agency names to filter (e.g., ['SBB', 'DB'])
   * @returns Promise with parsed GTFS data
   */
  async parseGTFSZip(file: File, allowedRouteTypes?: number[], allowedAgencies?: string[]): Promise<GTFSData> {
    console.log('🗂️  GTFS Parser: Starting to parse ZIP file:', file.name);
    console.log('📦 ZIP file size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    if (allowedRouteTypes && allowedRouteTypes.length > 0) {
      console.log('🔍 Route type filter active:', allowedRouteTypes);
    }
    if (allowedAgencies && allowedAgencies.length > 0) {
      console.log('🏢 Agency filter active:', allowedAgencies);
    }
    
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);
    console.log('✅ ZIP file loaded successfully');

    const gtfsData: GTFSData = {
      agencies: [],
      stops: [],
      routes: [],
      trips: [],
      stopTimes: [],
      calendar: [],
    };

    // Parse agency.txt
    console.log('🏢 Parsing agency.txt...');
    const agencyFile = zipContent.file("agency.txt");
    if (agencyFile) {
      const agencyText = await agencyFile.async("text");
      gtfsData.agencies = this.parseCSV<GTFSAgency>(agencyText);
      console.log('  ✓ Parsed', gtfsData.agencies.length, 'agencies');
      
      // Store all agencies before filtering
      gtfsData.allAgencies = [...gtfsData.agencies];
      
      // Debug: Show all agency names
      const uniqueAgencyNames = new Set(gtfsData.agencies.map(a => a.agency_name));
      console.log('  🔍 All agency names found:', Array.from(uniqueAgencyNames).slice(0, 20));
      if (uniqueAgencyNames.size > 20) {
        console.log('  ... and', uniqueAgencyNames.size - 20, 'more');
      }
      
      // Apply agency filter if specified
      if (allowedAgencies && allowedAgencies.length > 0) {
        const beforeFilter = gtfsData.agencies.length;
        gtfsData.agencies = gtfsData.agencies.filter(agency => {
          // Check if agency name contains any of the allowed agency identifiers
          const agencyName = agency.agency_name || '';
          const matches = allowedAgencies.some(allowed => 
            agencyName.toUpperCase().includes(allowed.toUpperCase())
          );
          return matches;
        });
        console.log('  🏢 Filtered to', gtfsData.agencies.length, 'agencies matching', allowedAgencies.join(', '), '(removed', beforeFilter - gtfsData.agencies.length, 'agencies)');
        
        if (gtfsData.agencies.length > 0) {
          console.log('  ✓ Kept agencies:', gtfsData.agencies.slice(0, 5).map(a => a.agency_name));
        }
      }
    } else {
      console.warn('  ⚠️  agency.txt not found in ZIP');
    }

    // Parse stops.txt
    console.log('📍 Parsing stops.txt...');
    const stopsFile = zipContent.file("stops.txt");
    if (stopsFile) {
      const stopsText = await stopsFile.async("text");
      gtfsData.stops = this.parseCSV<GTFSStop>(stopsText);
      console.log('  ✓ Parsed', gtfsData.stops.length, 'stops');
    } else {
      console.warn('  ⚠️  stops.txt not found in ZIP');
    }

    // Parse routes.txt
    console.log('🚂 Parsing routes.txt...');
    const routesFile = zipContent.file("routes.txt");
    if (routesFile) {
      const routesText = await routesFile.async("text");
      gtfsData.routes = this.parseCSV<GTFSRoute>(routesText);
      console.log('  ✓ Parsed', gtfsData.routes.length, 'routes');
      
      // Apply agency filter if specified (filter by agency)
      if (allowedAgencies && allowedAgencies.length > 0) {
        const beforeFilter = gtfsData.routes.length;
        const allowedAgencyIds = new Set(gtfsData.agencies.map(a => a.agency_id));
        gtfsData.routes = gtfsData.routes.filter(route => {
          // If route has no agency_id, include it (could be default agency)
          if (!route.agency_id) return allowedAgencyIds.size === 0 || gtfsData.agencies.length === 0;
          return allowedAgencyIds.has(route.agency_id);
        });
        console.log('  🏢 Filtered to', gtfsData.routes.length, 'routes by agency (removed', beforeFilter - gtfsData.routes.length, 'routes)');
      }
      
      // Apply route type filter if specified
      if (allowedRouteTypes && allowedRouteTypes.length > 0) {
        // Debug: Show unique route types
        const uniqueRouteTypes = new Set(gtfsData.routes.map(r => r.route_type));
        console.log('  🔍 DEBUG: Unique route_type values found:', Array.from(uniqueRouteTypes).sort());
        
        const beforeFilter = gtfsData.routes.length;
        gtfsData.routes = gtfsData.routes.filter(route => {
          const routeType = parseInt(route.route_type?.toString() || '3', 10);
          return allowedRouteTypes.includes(routeType);
        });
        console.log('  🔍 Filtered to', gtfsData.routes.length, 'routes by type (removed', beforeFilter - gtfsData.routes.length, 'routes)');
        
        if (gtfsData.routes.length === 0 && beforeFilter > 0) {
          console.warn('  ⚠️  WARNING: All routes filtered out by route_type! You may need to include extended GTFS route_type values (100-117)');
        }
      }
      
      // Debug: Show route_desc distribution
      const routeDescCounts = new Map<string, number>();
      gtfsData.routes.forEach(route => {
        const desc = route.route_desc || 'UNKNOWN';
        routeDescCounts.set(desc, (routeDescCounts.get(desc) || 0) + 1);
      });
      console.log('  📋 Route descriptions found:', Array.from(routeDescCounts.entries()).slice(0, 10));
    } else {
      console.warn('  ⚠️  routes.txt not found in ZIP');
    }

    // Parse trips.txt
    console.log('🎫 Parsing trips.txt...');
    const tripsFile = zipContent.file("trips.txt");
    if (tripsFile) {
      const tripsText = await tripsFile.async("text");
      gtfsData.trips = this.parseCSV<GTFSTrip>(tripsText);
      console.log('  ✓ Parsed', gtfsData.trips.length, 'trips');
      
      // Filter trips by route filter if specified
      if ((allowedRouteTypes && allowedRouteTypes.length > 0) || (allowedAgencies && allowedAgencies.length > 0)) {
        const beforeFilter = gtfsData.trips.length;
        const allowedRouteIds = new Set(gtfsData.routes.map(r => r.route_id));
        gtfsData.trips = gtfsData.trips.filter(trip => allowedRouteIds.has(trip.route_id));
        console.log('  🔍 Filtered to', gtfsData.trips.length, 'trips (removed', beforeFilter - gtfsData.trips.length, 'trips)');
      }
      
      // Reduce trips to representatives (one per route/direction) to save memory
      console.log('  🔄 Analyzing trip patterns and reducing to representatives...');
      const reducedTrips = this.reduceTripsToRepresentatives(gtfsData.trips, gtfsData.routes);
      console.log('  ✓ Reduced to', reducedTrips.length, 'representative trips (removed', gtfsData.trips.length - reducedTrips.length, 'trips)');
      gtfsData.trips = reducedTrips;
    } else {
      console.warn('  ⚠️  trips.txt not found in ZIP');
    }

    // Parse stop_times.txt using streaming approach (chunk-by-chunk to avoid memory issues)
    console.log('⏰ Parsing stop_times.txt...');
    const stopTimesFile = zipContent.file("stop_times.txt");
    gtfsData.stopTimes = []; // Initialize empty
    
    if (stopTimesFile) {
      try {
        console.log('  ℹ️  Streaming stop_times for', gtfsData.trips.length, 'representative trips');
        console.log('  ℹ️  Filtering to 4-hour time window (06:00-10:00) to reduce memory usage');
        
        // Create Set of allowed trip IDs for fast lookup
        const allowedTripIds = new Set(gtfsData.trips.map(t => t.trip_id));
        const minTime = 6 * 60;   // 06:00 in minutes
        const maxTime = 10 * 60;  // 10:00 in minutes
        
        // Use arraybuffer and process in chunks to avoid string length limit
        const chunkSize = 10 * 1024 * 1024; // 10MB chunks
        const arrayBuffer = await stopTimesFile.async("arraybuffer");
        const totalSize = arrayBuffer.byteLength;
        
        console.log('  📦 File size:', (totalSize / (1024 * 1024)).toFixed(2), 'MB');
        console.log('  🔄 Processing in', Math.ceil(totalSize / chunkSize), 'chunks...');
        
        const decoder = new TextDecoder('utf-8');
        let leftover = '';
        let header: string[] = [];
        let lineCount = 0;
        let keepCount = 0;
        const filteredStopTimes: GTFSStopTime[] = [];
        
        for (let offset = 0; offset < totalSize; offset += chunkSize) {
          const chunk = new Uint8Array(arrayBuffer, offset, Math.min(chunkSize, totalSize - offset));
          const text = leftover + decoder.decode(chunk, { stream: offset + chunkSize < totalSize });
          const lines = text.split('\n');
          
          // Keep last incomplete line for next chunk
          leftover = lines.pop() || '';
          
          for (const line of lines) {
            lineCount++;
            if (lineCount === 1) {
              // Parse header
              header = line.split(',').map(h => h.trim().replace(/['"]/g, ''));
              continue;
            }
            
            if (!line.trim()) continue;
            
            // Parse line manually (faster than CSV parser for simple cases)
            const values = line.split(',');
            if (values.length < header.length) continue;
            
            // Get trip_id (usually first column)
            const tripIdIndex = header.indexOf('trip_id');
            const departureTimeIndex = header.indexOf('departure_time');
            const arrivalTimeIndex = header.indexOf('arrival_time');
            
            if (tripIdIndex < 0 || tripIdIndex >= values.length) continue;
            
            const tripId = values[tripIdIndex].trim().replace(/['"]/g, '');
            
            // Quick filter: only process if trip_id matches
            if (!allowedTripIds.has(tripId)) continue;
            
            // Get departure time
            let depTime = '';
            if (departureTimeIndex >= 0 && departureTimeIndex < values.length) {
              depTime = values[departureTimeIndex].trim().replace(/['"]/g, '');
            } else if (arrivalTimeIndex >= 0 && arrivalTimeIndex < values.length) {
              depTime = values[arrivalTimeIndex].trim().replace(/['"]/g, '');
            }
            
            // Filter by time window
            if (depTime) {
              const minutes = GTFSParserService.timeToMinutes(depTime);
              if (minutes < minTime || minutes > maxTime) continue;
            }
            
            // Parse full record
            const record: any = {};
            for (let i = 0; i < header.length && i < values.length; i++) {
              record[header[i]] = values[i].trim().replace(/['"]/g, '');
            }
            
            filteredStopTimes.push(record as GTFSStopTime);
            keepCount++;
          }
          
          // Log progress every 50MB
          if ((offset / (1024 * 1024)) % 50 < (chunkSize / (1024 * 1024))) {
            console.log('  📍 Progress:', ((offset / totalSize) * 100).toFixed(0) + '%', '-', keepCount, 'stop_times kept');
          }
        }
        
        gtfsData.stopTimes = filteredStopTimes;
        console.log('  ✅ Streaming complete:', keepCount, 'stop_times loaded from', lineCount, 'lines');
        
      } catch (error: any) {
        console.error('  ❌ Error parsing stop_times.txt:', error.message || error);
        console.warn('  ⚠️  Skipping stop_times due to error');
        gtfsData.stopTimes = [];
      }
    } else {
      console.warn('  ⚠️  stop_times.txt not found in ZIP');
    }

    // Parse calendar.txt (optional)
    console.log('📅 Parsing calendar.txt (optional)...');
    const calendarFile = zipContent.file("calendar.txt");
    if (calendarFile) {
      const calendarText = await calendarFile.async("text");
      gtfsData.calendar = this.parseCSV<GTFSCalendar>(calendarText);
      console.log('  ✓ Parsed', gtfsData.calendar.length, 'calendar entries');
    } else {
      console.log('  ℹ️  calendar.txt not found (optional)');
    }

    // Post-processing: Calculate frequencies and classify nodes
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('POST-PROCESSING: ANALYSIS & ENRICHMENT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (gtfsData.stopTimes.length > 0) {
      this.calculateRouteFrequencies(gtfsData.routes, gtfsData.trips, gtfsData.stopTimes);
      this.classifyNodes(gtfsData.stops, gtfsData.stopTimes, gtfsData.trips);
    } else {
      console.warn('  ⚠️  Skipping frequency calculation and node classification (no stop_times data)');
    }

    console.log('\n✅ GTFS parsing complete!');
    console.log('📊 Summary:', {
      agencies: gtfsData.agencies.length,
      stops: gtfsData.stops.length,
      routes: gtfsData.routes.length,
      trips: gtfsData.trips.length,
      stopTimes: gtfsData.stopTimes.length,
      calendar: gtfsData.calendar?.length || 0
    });

    return gtfsData;
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
}
