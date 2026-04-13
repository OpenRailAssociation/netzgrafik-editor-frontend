import {Injectable} from "@angular/core";
import JSZip from "jszip";
import {parse, ParseResult} from "papaparse";

export interface GTFSCalendarDate {
  service_id: string;
  date: string; // YYYYMMDD
  exception_type: string; // 1 = added, 2 = removed
}
export interface GTFSAgency {
  agency_id: string;
  agency_name: string;
  // ...
}
export interface GTFSRoute {
  route_id: string;
  route_short_name: string;
  route_long_name?: string;
  route_desc?: string;
  agency_id?: string;
  route_type?: string | number;
  frequency?: number;
  sample_trip_id?: string;
  offsetHour?: number;
  category_id?: string | number;
  // ...
}
export interface GTFSTrip {
  trip_id: string;
  route_id: string;
  direction_id?: string;
  trip_headsign?: string;
  service_id?: string;
  trip_short_name?: string;
  // ...
}
export interface GTFSStopTime {
  trip_id: string;
  stop_id: string;
  stop_sequence: string;
  arrival_time?: string;
  departure_time?: string;
  pickup_type?: string;
  drop_off_type?: string;
  // ...
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
  // ...
}
export interface GTFSStop {
  stop_id: string;
  stop_name?: string;
  parent_station?: string;
  location_type?: string | number;
  degree?: number;
  node_type?: string;
  stop_lat?: string;
  stop_lon?: string;
  // ...
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
 * @param betriebstag Optional: YYYY-MM-DD, filtert Trips/StopTimes auf diesen Tag
 */
@Injectable({
  providedIn: "root",
})
export class GTFSParserService {
  /**
   * Erzeugt eine Übersicht pro agency/route mit allen Trips am Tag (forward/backward getrennt)
   * und Zusatzobjekt mit Details zum meistfrequenten Trip je Richtung.
   */
  public getRouteTripOverviewByAgency(gtfsData: GTFSData): any[] {
    // --- Erweiterung: Direction-Independent Path Grouping & Statistik ---
    // 1. Trips nach Path (Haltefolge) gruppieren (direction-unabhängig), aber nur aktive Trips am Betriebstag
    const betriebstag = (gtfsData as any).betriebstag || new Date().toISOString().slice(0, 10);
    const pathToTrips: Map<string, GTFSTrip[]> = new Map();
    const tripIdToPathKey: Map<string, string> = new Map();
    for (const trip of gtfsData.trips) {
      if (!tripIsActiveOnDate(trip, betriebstag)) continue;
      const stopTimes = gtfsData.stopTimes
        .filter((st: GTFSStopTime) => st.trip_id === trip.trip_id)
        .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
      const parentNames = stopTimes
        .map((st: GTFSStopTime) => {
          const stop = gtfsData.stops.find((s: GTFSStop) => s.stop_id === st.stop_id);
          if (stop?.parent_station) {
            const parent = gtfsData.stops.find((s: GTFSStop) => s.stop_id === stop.parent_station);
            return parent?.stop_name || stop.parent_station;
          }
          return stop?.stop_name || st.stop_id;
        })
        .map((x) => x ?? "");
      const pathKey = parentNames.join("-");
      if (!pathToTrips.has(pathKey)) pathToTrips.set(pathKey, []);
      pathToTrips.get(pathKey)!.push(trip);
      tripIdToPathKey.set(trip.trip_id, pathKey);
    }

    // 2. Reverse Path Matching: Finde für jeden Path das Reverse
    const pathKeys = Array.from(pathToTrips.keys());
    const matchedPaths: Set<string> = new Set();
    const directionIndependentGroups: any[] = [];
    for (const pathKey of pathKeys) {
      if (matchedPaths.has(pathKey)) continue;
      const tripsA = pathToTrips.get(pathKey)!;
      const pathArr = pathKey.split("-");
      const reversePathKey = [...pathArr].reverse().join("-");
      const tripsB = pathToTrips.get(reversePathKey);
      // Forward/Backward zuordnen
      let trips_forward: GTFSTrip[] = tripsA;
      let trips_backward: GTFSTrip[] = [];
      let hasRoundTrip = false;
      if (tripsB && reversePathKey !== pathKey) {
        trips_backward = tripsB;
        hasRoundTrip = true;
        matchedPaths.add(reversePathKey);
      }
      matchedPaths.add(pathKey);

      // Symmetrieprüfung: Abfahrts-/Ankunftszeiten vergleichen (Toleranz 5min)
      let symmetry = false;
      if (hasRoundTrip && trips_forward.length > 0 && trips_backward.length > 0) {
        // Nimm mittleren Trip je Richtung als Repräsentant
        const getDepArr = (trip: GTFSTrip) => {
          const st = gtfsData.stopTimes
            .filter((s) => s.trip_id === trip.trip_id)
            .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
          return {
            dep: st[0]?.departure_time || st[0]?.arrival_time,
            arr: st[st.length - 1]?.arrival_time || st[st.length - 1]?.departure_time,
          };
        };
        const tripF = trips_forward[Math.floor(trips_forward.length / 2)];
        const tripB = trips_backward[Math.floor(trips_backward.length / 2)];
        const f = getDepArr(tripF);
        const b = getDepArr(tripB);
        if (f.dep && b.arr) {
          const fDepMin = GTFSParserService.timeToMinutes(f.dep);
          const bArrMin = GTFSParserService.timeToMinutes(b.arr);
          symmetry = Math.abs(fDepMin - bArrMin) <= 5;
        }
      }

      // Trips mit Abfahrtszeit und -ort anreichern
      function enrichTrips(trips: GTFSTrip[]): any[] {
        return trips
          .map(trip => {
            const stopTimes = gtfsData.stopTimes
              .filter(st => st.trip_id === trip.trip_id)
              .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
            const firstStopTime = stopTimes[0];
            const stop = firstStopTime ? gtfsData.stops.find(s => s.stop_id === firstStopTime.stop_id) : undefined;
            return {
              ...trip,
              departure_time: firstStopTime?.departure_time || firstStopTime?.arrival_time || null,
              departure_location: stop?.stop_name || firstStopTime?.stop_id || null
            };
          })
          .sort((a, b) => {
            if (!a.departure_time && !b.departure_time) return 0;
            if (!a.departure_time) return 1;
            if (!b.departure_time) return -1;
            return a.departure_time.localeCompare(b.departure_time);
          });
      }
      directionIndependentGroups.push({
        path: pathArr,
        reverse_path: pathArr.slice().reverse(),
        anzahl_trips_forward: trips_forward.length,
        anzahl_trips_backward: trips_backward.length,
        anzahl_trips_total: trips_forward.length + trips_backward.length,
        trips_forward: enrichTrips(trips_forward),
        trips_backward: enrichTrips(trips_backward),
        round_trip: hasRoundTrip,
        symmetry,
      });
    }

    // Statistik-Array gruppiert nach agency und route (nur einmal deklariert und befüllt)
    const agencyRouteGroups: Record<string, Record<string, any[]>> = {};
    for (const group of directionIndependentGroups) {
      let agency_id = "unknown", agency_name = "unknown", route_id = "unknown", from = "", to = "";
      const exampleTrip = group.trips_forward[0] || group.trips_backward[0];
      if (exampleTrip) {
        const route = gtfsData.routes.find(r => r.route_id === exampleTrip.route_id);
        if (route) {
          route_id = route.route_id;
          agency_id = route.agency_id || "unknown";
          const agency = gtfsData.agencies.find(a => a.agency_id === agency_id);
          if (agency) agency_name = agency.agency_name;
        }
      }
      if (group.path && group.path.length > 0) {
        from = group.path[0];
        to = group.path[group.path.length - 1];
      }
      group.agency_id = agency_id;
      group.agency_name = agency_name;
      group.route_id = route_id;
      group.from = from;
      group.to = to;
      group.summary = `Agency: ${agency_name} (ID: ${agency_id}), Route: ${route_id}, From: ${from}, To: ${to}, Trips: ${group.anzahl_trips_total}`;
      if (!agencyRouteGroups[agency_id]) agencyRouteGroups[agency_id] = {};
      if (!agencyRouteGroups[agency_id][route_id]) agencyRouteGroups[agency_id][route_id] = [];
      agencyRouteGroups[agency_id][route_id].push(group);
    }

    // Menschlich lesbare Zusammenfassung für agency und route
    let agencyRouteSummaries: Record<string, any> = {};
    if (Object.keys(agencyRouteGroups).length > 0) {
      agencyRouteSummaries = {};
      for (const agencyId of Object.keys(agencyRouteGroups)) {
        const agency = gtfsData.agencies.find(a => a.agency_id === agencyId);
        const agencyName = agency ? agency.agency_name : agencyId;
        agencyRouteSummaries[agencyId] = {
          summary: `Agency: ${agencyName} (ID: ${agencyId})`,
          routes: {}
        };
        for (const routeId of Object.keys(agencyRouteGroups[agencyId])) {
          const firstGroup = agencyRouteGroups[agencyId][routeId][0];
          const from = firstGroup ? firstGroup.from : '';
          const to = firstGroup ? firstGroup.to : '';
          agencyRouteSummaries[agencyId].routes[routeId] = {
            summary: `Route: ${routeId}, From: ${from}, To: ${to}`,
            groups: agencyRouteGroups[agencyId][routeId]
          };
        }
      }
      // eslint-disable-next-line no-console
      console.info('[GTFS-Statistik][Direction-Independent-Groups][by agency/route][summaries]:', agencyRouteSummaries);
    }
    // Hilfsfunktion: Prüft, ob ein Trip am Betriebstag fährt
    function tripIsActiveOnDate(trip: GTFSTrip, date: string): boolean {
      // date: YYYY-MM-DD
      const yyyymmdd = date.replace(/-/g, "");
      // calendar.txt
      const cal = gtfsData.calendar?.find((c) => c.service_id === trip.service_id);
      let baseActive = false;
      if (cal) {
        // Wochentag prüfen
        const weekday = new Date(date).getDay(); // 0=So, 1=Mo, ...
        const weekdayMap: (keyof GTFSCalendar)[] = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ];
        const validWeek = (cal[weekdayMap[weekday] as keyof GTFSCalendar]) === "1";
        baseActive = validWeek && yyyymmdd >= cal.start_date && yyyymmdd <= cal.end_date;
      }
      // calendar_dates.txt
      let exception: GTFSCalendarDate | undefined = undefined;
      if (gtfsData.calendarDates) {
        exception = gtfsData.calendarDates.find(
          (cd) => cd.service_id === trip.service_id && cd.date === yyyymmdd,
        );
      }
      if (exception) {
        return exception.exception_type === "1"; // 1=added, 2=removed
      }
      return baseActive;
    }

    // Betriebstag wird im äußeren Scope deklariert und hier nicht erneut benötigt
    const agencyResult: Record<string, {agency: any; routen: any[]}> = {};
        // Vorberechnung: Map route_id -> Trips
        const agenciesById = new Map(gtfsData.agencies.map((a: GTFSAgency) => [a.agency_id, a]));
        const routeToTrips: Record<string, GTFSTrip[]> = {};
        for (const trip of gtfsData.trips) {
          if (!routeToTrips[trip.route_id]) routeToTrips[trip.route_id] = [];
          routeToTrips[trip.route_id].push(trip);
        }
        // Gruppiere Trips nach agency, route, direction
        const grouped: Record<string, {forward: GTFSTrip[], backward: GTFSTrip[]}> = {};
        for (const route of gtfsData.routes) {
          const agency = agenciesById.get(route.agency_id || "");
          if (!agency) continue;
          const key = `${agency.agency_id}|${route.route_id}`;
          if (!grouped[key]) grouped[key] = {forward: [], backward: []};
          const trips = routeToTrips[route.route_id] || [];
          for (const trip of trips) {
            const dir = trip.direction_id === "1" ? "backward" : "forward";
            grouped[key][dir].push(trip);
          }
        }
    // Helper: Details zum meistfrequenten Trip und Statistik aller Stopfolgen
    function getMostFrequentTrip(
      trips: GTFSTrip[],
      directionLabel: string,
      route_id?: string,
    ): any {
      // route_id must be passed as argument
      if (!trips.length) return null;
      // Gruppiere nach Path (Stopfolge)
      const pathMap = new Map<string, GTFSTrip[]>();
      // Typ: Array beliebiger Objekte mit path, anzahl_trips, trips etc.
      const pathDebugArr: any[] = [];
      for (const trip of trips) {
        const stopTimes = gtfsData.stopTimes
          .filter((st: GTFSStopTime) => st.trip_id === trip.trip_id)
          .sort(
            (a: GTFSStopTime, b: GTFSStopTime) =>
              parseInt(a.stop_sequence) - parseInt(b.stop_sequence),
          );
        // Stopfolge als parent_station_name-Array
        const parentNames = stopTimes
          .map((st: GTFSStopTime) => {
            const stop = gtfsData.stops.find((s: GTFSStop) => s.stop_id === st.stop_id);
            if (stop?.parent_station) {
              const parent = gtfsData.stops.find(
                (s: GTFSStop) => s.stop_id === stop.parent_station,
              );
              return parent?.stop_name || stop.parent_station;
            }
            return stop?.stop_name || st.stop_id;
          })
          .map((x) => x ?? ""); // ensure string[]
        const pathKey = parentNames.join("-");
        if (!pathMap.has(pathKey)) pathMap.set(pathKey, []);
        pathMap.get(pathKey)!.push(trip);
      }
      // Statistik-Array für Debug: Alle Stopfolgen und Abfahrtszeiten
      for (const [pathKey, tripsArr] of pathMap.entries()) {
        // Trip-Infos für diese Gruppe
        const tripInfos = tripsArr.map((trip) => {
          const st = gtfsData.stopTimes
            .filter((st: GTFSStopTime) => st.trip_id === trip.trip_id)
            .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
          const dep = st[0]?.departure_time || st[0]?.arrival_time || null;
          return {
            trip_id: trip.trip_id,
            abfahrt_erst: dep,
          };
        });
        // parent_station_name Array zurückgewinnen
        const stopNames =
          tripsArr.length > 0
            ? gtfsData.stopTimes
                .filter((st: GTFSStopTime) => st.trip_id === tripsArr[0].trip_id)
                .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))
                .map((st: GTFSStopTime) => {
                  const stop = gtfsData.stops.find((s: GTFSStop) => s.stop_id === st.stop_id);
                  if (stop?.parent_station) {
                    const parent = gtfsData.stops.find(
                      (s: GTFSStop) => s.stop_id === stop.parent_station,
                    );
                    return parent?.stop_name || stop.parent_station;
                  }
                  return stop?.stop_name || st.stop_id;
                })
            : [];
        pathDebugArr.push({
          path: stopNames,
          anzahl_trips: tripsArr.length,
          trips: tripInfos,
        });
      }
      // Debug-Ausgabe
      if (pathDebugArr.length > 0) {
        // eslint-disable-next-line no-console
        console.info(
          `[GTFS-Statistik] Route ${directionLabel} (route_id: ${route_id ?? "unknown"}):`,
          pathDebugArr,
        );
      }
      // Finde Path mit meisten Fahrten
      let maxTrips: GTFSTrip[] = [];
      let maxPath = "";
      for (const [path, tripsArr] of pathMap.entries()) {
        if (tripsArr.length > maxTrips.length) {
          maxTrips = tripsArr;
          maxPath = path;
        }
      }
      if (!maxTrips.length) return null;
      // Nimm mittleren Trip als Repräsentant
      const trip = maxTrips[Math.floor(maxTrips.length / 2)];
      const stopTimes = gtfsData.stopTimes
        .filter((st: GTFSStopTime) => st.trip_id === trip.trip_id)
        .sort(
          (a: GTFSStopTime, b: GTFSStopTime) =>
            parseInt(a.stop_sequence) - parseInt(b.stop_sequence),
        );
      const stops = stopTimes.map((st: GTFSStopTime) => {
        const stop = gtfsData.stops.find((s: GTFSStop) => s.stop_id === st.stop_id);
        return {
          stop_id: st.stop_id,
          stop_name: stop?.stop_name || st.stop_id,
          arrival: st.arrival_time,
          departure: st.departure_time,
        };
      });
      return {
        trip_id: trip.trip_id,
        path: maxPath,
        stops,
        departure: stopTimes[0]?.departure_time,
        arrival: stopTimes[stopTimes.length - 1]?.arrival_time,
        count: maxTrips.length,
      };
    }

    // Helper: Get first departure time in minutes for sorting
    function getFirstDep(trip: GTFSTrip): number {
      const st = gtfsData.stopTimes
        .filter((st: GTFSStopTime) => st.trip_id === trip.trip_id)
        .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
      return st.length
        ? GTFSParserService.timeToMinutes(st[0].departure_time || st[0].arrival_time || "00:00")
        : 0;
    }

    // Helper: Pair forward/backward trips and check symmetry
    function getTimePairs(forward: GTFSTrip[], backward: GTFSTrip[]): any[] {
      const sortedF = [...forward].sort((a, b) => getFirstDep(a) - getFirstDep(b));
      const sortedB = [...backward].sort((a, b) => getFirstDep(a) - getFirstDep(b));
      const pairs: any[] = [];
      const len = Math.max(sortedF.length, sortedB.length);
      for (let i = 0; i < len; i++) {
        const f = sortedF[i];
        const b = sortedB[i];
        let fDep = null,
          fArr = null,
          fStart = null,
          fEnd = null;
        let bDep = null,
          bArr = null,
          bStart = null,
          bEnd = null;
        if (f) {
          const st = gtfsData.stopTimes
            .filter((st) => st.trip_id === f.trip_id)
            .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
          fDep = st[0]?.departure_time || st[0]?.arrival_time || null;
          fArr = st[st.length - 1]?.arrival_time || st[st.length - 1]?.departure_time || null;
          const startStop = gtfsData.stops.find((s) => s.stop_id === st[0]?.stop_id);
          const endStop = gtfsData.stops.find((s) => s.stop_id === st[st.length - 1]?.stop_id);
          fStart = startStop?.stop_name || st[0]?.stop_id;
          fEnd = endStop?.stop_name || st[st.length - 1]?.stop_id;
        }
        if (b) {
          const st = gtfsData.stopTimes
            .filter((st) => st.trip_id === b.trip_id)
            .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
          bDep = st[0]?.departure_time || st[0]?.arrival_time || null;
          bArr = st[st.length - 1]?.arrival_time || st[st.length - 1]?.departure_time || null;
          const startStop = gtfsData.stops.find((s) => s.stop_id === st[0]?.stop_id);
          const endStop = gtfsData.stops.find((s) => s.stop_id === st[st.length - 1]?.stop_id);
          bStart = startStop?.stop_name || st[0]?.stop_id;
          bEnd = endStop?.stop_name || st[st.length - 1]?.stop_id;
        }
        // Symmetrie: 60-x-Regel auf Minuten
        let symmetry = null;
        if (fDep && bArr) {
          const fDepMin = GTFSParserService.timeToMinutes(fDep);
          const bArrMin = GTFSParserService.timeToMinutes(bArr);
          symmetry = (fDepMin + bArrMin) % 60 === 0;
        }
        pairs.push({
          forward: {departure: fDep, arrival: fArr, start: fStart, end: fEnd, trip_id: f?.trip_id},
          backward: {departure: bDep, arrival: bArr, start: bStart, end: bEnd, trip_id: b?.trip_id},
          symmetry,
        });
      }
      return pairs;
    }

    // Für jede agency/route: Übersicht bauen
    for (const key of Object.keys(grouped)) {
      const [agency_id, route_id] = key.split("|");
      const agency = agenciesById.get(agency_id);
      const route = gtfsData.routes.find((r: GTFSRoute) => r.route_id === route_id);
      // Nur Trips, die am Betriebstag verkehren
      const forwardTrips = grouped[key].forward.filter((trip) =>
        tripIsActiveOnDate(trip, betriebstag),
      );
      const backwardTrips = grouped[key].backward.filter((trip) =>
        tripIsActiveOnDate(trip, betriebstag),
      );
      // Helper to get trip details
      function tripDetails(trip: GTFSTrip) {
        const stopTimes = gtfsData.stopTimes
          .filter((st) => st.trip_id === trip.trip_id)
          .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
        const first = stopTimes[0];
        const last = stopTimes[stopTimes.length - 1];
        const firstStop = first
          ? gtfsData.stops.find((s) => s.stop_id === first.stop_id)?.stop_name || first.stop_id
          : undefined;
        const lastStop = last
          ? gtfsData.stops.find((s) => s.stop_id === last.stop_id)?.stop_name || last.stop_id
          : undefined;
        return {
          fahrtnummer: trip.trip_id,
          zieltext: trip.trip_headsign,
          erster_halt: firstStop,
          abfahrt_erst: first?.departure_time || first?.arrival_time,
          letzter_halt: lastStop,
          ankunft_letzter: last?.arrival_time || last?.departure_time,
        };
      }
      // Trips mit Details anreichern und Duplikate filtern
      let forwardTripsDetailed = forwardTrips.map(tripDetails);
      // Duplikate entfernen: gleiche erster_halt, abfahrt_erst, letzter_halt, ankunft_letzter
      const seen = new Set<string>();
      forwardTripsDetailed = forwardTripsDetailed.filter((trip) => {
        const key = `${trip.erster_halt}|${trip.abfahrt_erst}|${trip.letzter_halt}|${trip.ankunft_letzter}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      // Nach Abfahrtszeit des ersten Halts sortieren
      forwardTripsDetailed.sort((a, b) => {
        if (!a.abfahrt_erst && !b.abfahrt_erst) return 0;
        if (!a.abfahrt_erst) return 1;
        if (!b.abfahrt_erst) return -1;
        return a.abfahrt_erst.localeCompare(b.abfahrt_erst);
      });
      const backwardTripsDetailed = backwardTrips.map(tripDetails);
      const routeObj = {
        route: {
          route_id,
          route_short_name: route?.route_short_name,
          route_long_name: route?.route_long_name,
        },
        forwardTrips: forwardTripsDetailed,
        backwardTrips: backwardTripsDetailed,
        mostFrequentForward: getMostFrequentTrip(forwardTrips, "forward", route_id),
        mostFrequentBackward: getMostFrequentTrip(backwardTrips, "backward", route_id),
        timePairs: getTimePairs(forwardTrips, backwardTrips),
      };
      if (!agencyResult[agency_id]) {
        agencyResult[agency_id] = {
          agency: {agency_id, agency_name: agency?.agency_name},
          routen: [],
        };
      }
      agencyResult[agency_id].routen.push(routeObj);
    }
    // (Nur noch eine Ausgabe im aufrufenden Code, nicht hier)
    return Object.values(agencyResult);
  }
  /**
   * Parst ein GTFS-ZIP und filtert optional auf einen Betriebstag (YYYY-MM-DD)
   */
  // ...existing code...
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
      let offsetHour: number | undefined = undefined;

      if (mostCommonFreq === 120) {
        // Get all first departures to determine even/odd pattern
        const firstDepartures: number[] = [];
        for (const departures of stationDepartures.values()) {
          firstDepartures.push(Math.min(...departures));
        }

        if (firstDepartures.length > 0) {
          // Check first departure hour
          const firstDepMinutes = Math.min(...firstDepartures);
          const firstHour = Math.floor(firstDepMinutes / 60);

          // Store offset: 0 = even hours (0, 2, 4, 6...), 1 = odd hours (1, 3, 5, 7...)
          offsetHour = firstHour % 2;
        }
        finalFrequency = 120;
      }

      route.frequency = GTFSParserService.normalizeFrequency(finalFrequency);
      if (offsetHour !== undefined) {
        route.offsetHour = offsetHour;
      }

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
        // degree === 2 and at least one stop → minor node
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
    serviceDateRange: {startDate: string; endDate: string} | null;
  }> {
    const zip = JSZip();
    const zipContent = await zip.loadAsync(file);

    const result = {
      agencies: [] as GTFSAgency[],
      routes: [] as GTFSRoute[],
      serviceDateRange: null as {startDate: string; endDate: string} | null,
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

    // Parse calendar.txt to get service date range
    const calendarFile = zipContent.file("calendar.txt");
    if (calendarFile) {
      const calendarText = await calendarFile.async("text");
      const calendarEntries = this.parseCSV<any>(calendarText);

      if (calendarEntries.length > 0) {
        let minDate = calendarEntries[0].start_date;
        let maxDate = calendarEntries[0].end_date;

        calendarEntries.forEach((entry: any) => {
          if (entry.start_date && entry.start_date < minDate) {
            minDate = entry.start_date;
          }
          if (entry.end_date && entry.end_date > maxDate) {
            maxDate = entry.end_date;
          }
        });

        result.serviceDateRange = {
          startDate: minDate,
          endDate: maxDate,
        };
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
    const zip = JSZip();
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
    progressCallback?.("agency.txt");

    // Parse stops.txt
    const stopsFile = zipContent.file("stops.txt");
    if (stopsFile) {
      const stopsText = await stopsFile.async("text");
      gtfsData.stops = this.parseCSV<GTFSStop>(stopsText);
    }
    progressCallback?.("stops.txt");

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
          if (!route.agency_id) {
            return allowedAgencyIds.size === 0 || gtfsData.agencies.length === 0;
          }
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
    }
    progressCallback?.("routes.txt");

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
    progressCallback?.("trips.txt");

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
            if (keepCount % 100000 === 0) {
              console.log(`[stop_times.txt] Parsed ${keepCount} records so far...`);
            }
          }
          // Fortschritt nach jedem Chunk anzeigen
          console.log(`[stop_times.txt] Progress: ${Math.min(offset + chunkSize, totalSize)}/${totalSize} bytes (${Math.round(100 * Math.min(offset + chunkSize, totalSize) / totalSize)}%)`);
        }

        gtfsData.stopTimes = filteredStopTimes;
      } catch (error: any) {
        gtfsData.stopTimes = [];
      }
    }
    progressCallback?.("stop_times.txt");

    // Parse calendar.txt (optional)
    const calendarFile = zipContent.file("calendar.txt");
    if (calendarFile) {
      const calendarText = await calendarFile.async("text");
      gtfsData.calendar = this.parseCSV<GTFSCalendar>(calendarText);
    }
    progressCallback?.("calendar.txt");

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

    // Logge die neue Übersicht nach dem Import/Filter
    console.info("[GTFS-Import Übersicht]", this.getRouteTripOverviewByAgency(gtfsData));
    return gtfsData;
  }

  /**
   * Select most frequent trip pattern per route+direction
   * Analyzes ALL trips across all service days to find the most common pattern
   * Filters to 8-16h time window per Swiss GTFS standards
   * @param gtfsData GTFS data to filter in-place
   */
  /**
   * Selektiert häufigste Trip-Patterns pro Route+Richtung, NACH Betriebstags-Filterung!
   */
  private selectMostFrequentTripPatterns(gtfsData: GTFSData): void {
    function calcFreq(depTimes: number[]): number {
      if (depTimes.length < 2) return 60;
      const intervals = [];
      for (let i = 1; i < depTimes.length; i++) intervals.push(depTimes[i] - depTimes[i - 1]);
      if (intervals.length === 0) return 60;
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avg <= 17) return 15;
      if (avg <= 25) return 20;
      if (avg <= 45) return 30;
      if (avg <= 90) return 60;
      return 120;
    }
    // ⚠️ TIME FILTER DISABLED: No longer restricting to 8-16h window
    // const TIME_WINDOW_START = 8 * 60; // 08:00
    // const TIME_WINDOW_END = 16 * 60; // 16:00

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

    // Gruppiere Trips nach route_id, Richtung (direction_id) und Path (Stop-Folge)
    // Falls direction_id fehlt, Richtung aus Path ableiten (A->B... vs B->A...)
    const pathGroups = new Map<string, GTFSTrip[]>();
    const tripPathMap = new Map<string, string>();
    const tripDirMap = new Map<string, string>();
    // Parent-Station-Map aufbauen
    const stopIdToParent = new Map<string, string>();
    if (gtfsData.stops) {
      for (const stop of gtfsData.stops) {
        stopIdToParent.set(stop.stop_id, stop.parent_station || stop.stop_id);
      }
    }
    for (const trip of gtfsData.trips) {
      const stopTimes = gtfsData.stopTimes
        .filter((st) => st.trip_id === trip.trip_id)
        .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
      if (stopTimes.length === 0) continue;
      const parentPathArr = stopTimes.map((st) => stopIdToParent.get(st.stop_id) || st.stop_id);
      const path = parentPathArr.join("-");
      let dir = trip.direction_id;
      if (dir === null || dir === undefined || dir === "") {
        // Richtung aus Path ableiten: lexikographisch vergleichen
        dir = parentPathArr[0] < parentPathArr[parentPathArr.length - 1] ? "0" : "1";
      }
      tripDirMap.set(trip.trip_id, dir);
      const key = `${trip.route_id}|${dir}|${path}`;
      tripPathMap.set(trip.trip_id, path);
      if (!pathGroups.has(key)) pathGroups.set(key, []);
      pathGroups.get(key)!.push(trip);
    }

    // Mapping für Hin- und Rückfahrt (symmetrisch, gleiche Frequenz)
    const selectedTripIds = new Set<string>();
    const usedGroupKeys = new Set<string>();
    for (const [key, trips] of pathGroups.entries()) {
      if (usedGroupKeys.has(key)) continue; // schon verarbeitet
      // Key: route_id|dir|path
      const [route_id, dir, path] = key.split("|");
      // Gegenrichtung suchen (gleicher Path reversed, dir 0<->1)
      const revDir = dir === "0" ? "1" : "0";
      const revPath = path.split("-").reverse().join("-");
      const revKey = `${route_id}|${revDir}|${revPath}`;
      const tripsA = trips;
      const tripsB = pathGroups.get(revKey) || [];

      // Übersicht aller Trips für diese Route+Path+Richtung
      function tripList(trips: GTFSTrip[], directionLabel: string) {
        // Sortiere Trips nach erster Abfahrtszeit
        const sortedTrips = [...trips].sort((a, b) => {
          const aTime = (() => {
            const st = gtfsData.stopTimes
              .filter((st) => st.trip_id === a.trip_id)
              .sort((x, y) => parseInt(x.stop_sequence) - parseInt(y.stop_sequence));
            return st.length
              ? GTFSParserService.timeToMinutes(
                  st[0].departure_time || st[0].arrival_time || "00:00",
                )
              : 0;
          })();
          const bTime = (() => {
            const st = gtfsData.stopTimes
              .filter((st) => st.trip_id === b.trip_id)
              .sort((x, y) => parseInt(x.stop_sequence) - parseInt(y.stop_sequence));
            return st.length
              ? GTFSParserService.timeToMinutes(
                  st[0].departure_time || st[0].arrival_time || "00:00",
                )
              : 0;
          })();
          return aTime - bTime;
        });
        return sortedTrips
          .map((trip) => {
            const stopTimes = gtfsData.stopTimes
              .filter((st) => st.trip_id === trip.trip_id)
              .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
            if (!stopTimes.length) return null;
            const first = stopTimes[0];
            const last = stopTimes[stopTimes.length - 1];
            const dep = first.departure_time ? first.departure_time.slice(0, 5) : "--:--";
            const startStop = gtfsData.stops?.find((s) => s.stop_id === first.stop_id);
            const endStop = gtfsData.stops?.find((s) => s.stop_id === last.stop_id);
            // Parent-Station-Namen für den Trip als Array
            const parent_station_names = stopTimes.map((st) => {
              const stop = gtfsData.stops?.find((s) => s.stop_id === st.stop_id);
              if (!stop) return st.stop_id;
              if (stop.parent_station) {
                const parent = gtfsData.stops?.find((s) => s.stop_id === stop.parent_station);
                return parent?.stop_name || stop.parent_station;
              }
              return stop.stop_name || stop.stop_id;
            });
            return {
              trip_id: trip.trip_id,
              direction: directionLabel,
              departure: dep,
              path: `${startStop?.stop_name || first.stop_id} → ${endStop?.stop_name || last.stop_id}`,
              start: startStop?.stop_name || first.stop_id,
              end: endStop?.stop_name || last.stop_id,
              parent_station_names,
            };
          })
          .filter(Boolean);
      }
      const forwardTrips = dir === "0" ? tripList(tripsA, "forward") : tripList(tripsB, "forward");
      const backwardTrips =
        dir === "1" ? tripList(tripsA, "backward") : tripList(tripsB, "backward");

      // Häufigster Trip (repräsentativer Trip) je Richtung
      function getMostFrequentTrip(trips: GTFSTrip[]) {
        if (!trips.length) return null;
        // Annahme: mittlerer Trip ist repräsentativ
        const trip = trips[Math.floor(trips.length / 2)];
        const stopTimes = gtfsData.stopTimes
          .filter((st) => st.trip_id === trip.trip_id)
          .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
        if (!stopTimes.length) return null;
        const first = stopTimes[0];
        const last = stopTimes[stopTimes.length - 1];
        const dep = first.departure_time ? first.departure_time.slice(0, 5) : "--:--";
        const arr = last.arrival_time ? last.arrival_time.slice(0, 5) : "--:--";
        const startStop = gtfsData.stops?.find((s) => s.stop_id === first.stop_id);
        const endStop = gtfsData.stops?.find((s) => s.stop_id === last.stop_id);
        return {
          trip_id: trip.trip_id,
          departure: dep,
          arrival: arr,
          path: `${startStop?.stop_name || first.stop_id} → ${endStop?.stop_name || last.stop_id}`,
          start: startStop?.stop_name || first.stop_id,
          end: endStop?.stop_name || last.stop_id,
        };
      }
      const mostFrequentForward = getMostFrequentTrip(tripsA);
      const mostFrequentBackward = getMostFrequentTrip(tripsB);

      // Frequenz für beide Richtungen
      const depA = tripsA
        .map((t) => tripFirstDeparture.get(t.trip_id))
        .filter((t) => t !== undefined)
        .sort((a, b) => a! - b!);
      const depB = tripsB
        .map((t) => tripFirstDeparture.get(t.trip_id))
        .filter((t) => t !== undefined)
        .sort((a, b) => a! - b!);
      // calcFreq already defined above, do not redeclare
      const freqA = GTFSParserService.normalizeFrequency(calcFreq(depA));
      const freqB = GTFSParserService.normalizeFrequency(calcFreq(depB));

      // Frequenz und Zeiten für beide Gruppen berechnen
      function getDepTimes(trips: GTFSTrip[]): number[] {
        return trips
          .map((t) => tripFirstDeparture.get(t.trip_id))
          .filter((t) => t !== undefined)
          .sort((a, b) => a! - b!);
      }
      // duplicate calcFreq removed
      // bereits oben deklariert: depA, depB, freqA, freqB

      // Symmetrie-Toleranz (z.B. max 10min Differenz pro Zeitpaar)
      function isSymmetric(timesA: number[], timesB: number[], tolerance = 10): boolean {
        if (timesA.length !== timesB.length) return false;
        for (let i = 0; i < timesA.length; i++) {
          if (Math.abs(timesA[i] - timesB[i]) > tolerance) return false;
        }
        return true;
      }

      if (tripsB.length > 0 && freqA === freqB && isSymmetric(depA, depB)) {
        // Symmetrisch: als Hin- und Rückfahrt (ein Zugpaar)
        // Einen repräsentativen Trip pro Richtung wählen (z.B. mittlerer)
        const repA = tripsA[Math.floor(tripsA.length / 2)];
        const repB = tripsB[Math.floor(tripsB.length / 2)];
        selectedTripIds.add(repA.trip_id);
        selectedTripIds.add(repB.trip_id);
        // Frequenz im Route-Objekt speichern
        const route = gtfsData.routes.find((r) => r.route_id === route_id);
        if (route && !route.frequency) route.frequency = freqA;
        usedGroupKeys.add(key);
        usedGroupKeys.add(revKey);
      } else {
        // eslint-disable-next-line no-console
        // Trip- und Asymmetrie-Übersicht werden weiter oben geloggt
        // Nicht symmetrisch oder keine Gegenrichtung: alle als one-way importieren
        for (const t of tripsA) selectedTripIds.add(t.trip_id);
        if (tripsB.length > 0) for (const t of tripsB) selectedTripIds.add(t.trip_id);
        // Frequenz im Route-Objekt speichern
        const route = gtfsData.routes.find((r) => r.route_id === route_id);
        if (route && !route.frequency) route.frequency = freqA;
        usedGroupKeys.add(key);
        if (tripsB.length > 0) usedGroupKeys.add(revKey);
      }
    }

    // Filter trips and stopTimes
    gtfsData.trips = gtfsData.trips.filter((trip) => selectedTripIds.has(trip.trip_id));
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
      transformHeader: (header: string) => header.trim(),
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
   * Normalize frequency to standard values: 15, 20, 30, 60, 120
   * If frequency is not one of these values, default to 60
   * @param frequency Frequency value to normalize
   * @returns Normalized frequency (15, 20, 30, 60, or 120)
   */
  private static normalizeFrequency(frequency: number): number {
    const validFrequencies = [15, 20, 30, 60, 120];
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
