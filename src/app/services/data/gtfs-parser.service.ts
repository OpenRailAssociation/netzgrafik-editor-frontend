import {Injectable} from "@angular/core";
import {BlobReader, TextWriter, ZipReader} from "@zip.js/zip.js";

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
// Für produktive Speed-Tests: Performance-/KPI-/Debug-Logs ausschalten.
const LOG_GTFS_PERF_KPI = false;
const LOG_GTFS_PATTERN_DEBUG = false;

@Injectable({
  providedIn: "root",
})
export class GTFSParserService {
  /**
   * Erzeugt eine Übersicht pro agency/route mit allen Trips am Tag (forward/backward getrennt)
   * und Zusatzobjekt mit Details zum meistfrequenten Trip je Richtung.
   */
  public getRouteTripOverviewByAgency(
    gtfsData: GTFSData,
  ): Record<string, {summary: string; routes: Record<string, {summary: string; groups: any[]}>}> {
    // --- Erweiterung: Direction-Independent Path Grouping & Statistik ---
    // 1. Trips nach Path (Haltefolge) gruppieren (direction-unabhängig), aber nur aktive Trips am Betriebstag
    const betriebstag = (gtfsData as any).betriebstag || new Date().toISOString().slice(0, 10);
    const pathToTrips: Map<string, GTFSTrip[]> = new Map();
    const toleranceSeconds = Number((gtfsData as any).timeSyncTolerance ?? 300);
    const toleranceMinutes = Math.max(0, toleranceSeconds / 60);
    const circularMinuteDistance = (aMin: number, bMin: number): number => {
      const a = ((aMin % 60) + 60) % 60;
      const b = ((bMin % 60) + 60) % 60;
      const diff = Math.abs(a - b);
      return Math.min(diff, 60 - diff);
    };
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
    // --- Helper must be declared before use ---
    function enrichTrips(trips: GTFSTrip[]): any[] {
      // Trips mit Abfahrtszeit und -ort anreichern
      return trips
        .map((trip) => {
          const stopTimes = gtfsData.stopTimes
            .filter((st) => st.trip_id === trip.trip_id)
            .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
          const firstStopTime = stopTimes[0];
          const stop = firstStopTime
            ? gtfsData.stops.find((s) => s.stop_id === firstStopTime.stop_id)
            : undefined;
          return {
            ...trip,
            departure_time: firstStopTime?.departure_time || firstStopTime?.arrival_time || null,
            departure_location: stop?.stop_name || firstStopTime?.stop_id || null,
          };
        })
        .map((trip) => {
          const stopTimes = gtfsData.stopTimes
            .filter((st) => st.trip_id === trip.trip_id)
            .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
          const departure = stopTimes[0];
          const arrival = stopTimes[stopTimes.length - 1];
          return {
            ...trip,
            departure_time: departure?.departure_time || departure?.arrival_time,
            departure_location:
              gtfsData.stops.find((s) => s.stop_id === departure?.stop_id)?.stop_name ||
              departure?.stop_id,
            arrival_time: arrival?.arrival_time || arrival?.departure_time,
            arrival_location:
              gtfsData.stops.find((s) => s.stop_id === arrival?.stop_id)?.stop_name ||
              arrival?.stop_id,
          };
        })
        .sort((a, b) => {
          if (!a.departure_time && !b.departure_time) return 0;
          if (!a.departure_time) return 1;
          if (!b.departure_time) return -1;
          return a.departure_time.localeCompare(b.departure_time);
        });
    }

    for (const pathKey of pathKeys) {
      if (matchedPaths.has(pathKey)) continue;
      const tripsA = pathToTrips.get(pathKey)!;
      const pathArr = pathKey.split("-");
      const reversePathKey = [...pathArr].reverse().join("-");
      const tripsB = pathToTrips.get(reversePathKey);
      // Forward/Backward zuordnen
      const trips_forward: GTFSTrip[] = tripsA;
      let trips_backward: GTFSTrip[] = [];
      let hasRoundTrip = false;
      if (tripsB && reversePathKey !== pathKey) {
        trips_backward = tripsB;
        hasRoundTrip = true;
        matchedPaths.add(reversePathKey);
      }
      matchedPaths.add(pathKey);

      // Symmetrieprüfung: Abfahrts-/Ankunftszeiten vergleichen (UI-Toleranz)
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
          const expectedBackwardArr = (60 - (fDepMin % 60)) % 60;
          symmetry = circularMinuteDistance(bArrMin, expectedBackwardArr) <= toleranceMinutes;
        }
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
      let agency_id = "unknown",
        agency_name = "unknown",
        route_id = "unknown",
        from = "",
        to = "";
      const exampleTrip = group.trips_forward[0] || group.trips_backward[0];
      if (exampleTrip) {
        const route = gtfsData.routes.find((r) => r.route_id === exampleTrip.route_id);
        if (route) {
          route_id = route.route_id;
          agency_id = route.agency_id || "unknown";
          const agency = gtfsData.agencies.find((a) => a.agency_id === agency_id);
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

    // Hierarchie Agency -> Routes -> Groups als Objekt zurückgeben
    const agencyRouteSummaries: Record<
      string,
      {summary: string; routes: Record<string, {summary: string; groups: any[]}>}
    > = {};
    for (const agencyId of Object.keys(agencyRouteGroups)) {
      const agency = gtfsData.agencies.find((a) => a.agency_id === agencyId);
      const agencyName = agency ? agency.agency_name : agencyId;
      agencyRouteSummaries[agencyId] = {
        summary: `Agency: ${agencyName} (ID: ${agencyId})`,
        routes: {},
      };
      for (const routeId of Object.keys(agencyRouteGroups[agencyId])) {
        const firstGroup = agencyRouteGroups[agencyId][routeId][0];
        const from = firstGroup ? firstGroup.from : "";
        const to = firstGroup ? firstGroup.to : "";
        agencyRouteSummaries[agencyId].routes[routeId] = {
          summary: `Route: ${routeId}, From: ${from}, To: ${to}`,
          groups: agencyRouteGroups[agencyId][routeId],
        };
      }
    }
    return agencyRouteSummaries;
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
        const validWeek = cal[weekdayMap[weekday] as keyof GTFSCalendar] === "1";
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
    const grouped: Record<string, {forward: GTFSTrip[]; backward: GTFSTrip[]}> = {};
    for (const route of gtfsData.routes) {
      const agencyId = route.agency_id || "";
      if (!agenciesById.has(agencyId)) {
        continue;
      }
      const key = `${agencyId}|${route.route_id}`;
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
        // Symmetrie: 60-x-Regel auf Minuten mit UI-Toleranz
        let symmetry = null;
        if (fDep && bArr) {
          const fDepMin = GTFSParserService.timeToMinutes(fDep);
          const bArrMin = GTFSParserService.timeToMinutes(bArr);
          const expectedBackwardArr = (60 - (fDepMin % 60)) % 60;
          symmetry = circularMinuteDistance(bArrMin, expectedBackwardArr) <= toleranceMinutes;
        }
        pairs.push({
          forward: {departure: fDep, arrival: fArr, start: fStart, end: fEnd, trip_id: f?.trip_id},
          backward: {departure: bDep, arrival: bArr, start: bStart, end: bEnd, trip_id: b?.trip_id},
          symmetry,
        });
      }
      return pairs;
    }

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
    // Agency->Route->Groups Hierarchie als Objekt zurückgeben
    const result: Record<
      string,
      {summary: string; routes: Record<string, {summary: string; groups: any[]}>}
    > = {};
    for (const agency_id of Object.keys(agencyResult)) {
      const agency = agencyResult[agency_id].agency;
      result[agency_id] = {
        summary: `Agency: ${agency.agency_name || agency_id} (ID: ${agency_id})`,
        routes: {},
      };
      for (const routeObj of agencyResult[agency_id].routen) {
        const route_id = routeObj.route.route_id;
        result[agency_id].routes[route_id] = {
          summary: `Route: ${route_id}, From: ${routeObj.route.route_short_name || ""}, To: ${routeObj.route.route_long_name || ""}`,
          groups: [routeObj],
        };
      }
    }
    return result;
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

  private findZipEntry(entries: any[], fileName: string): any | undefined {
    const target = fileName.toLowerCase();

    return entries.find((entry) => {
      const name = String(entry.filename || "").toLowerCase();
      return name === target || name.endsWith(`/${target}`);
    });
  }

  private async readZipEntryText(entries: any[], fileName: string): Promise<string | null> {
    const entry = this.findZipEntry(entries, fileName);
    if (!entry) return null;

    const text = await entry.getData(new TextWriter());
    return text ?? null;
  }

  /**
   * Streamt eine ZIP-Entry als Text zeilenweise.
   * Wichtig: Die Datei wird nicht komplett als string/arrayBuffer geladen.
   *
   * Profiling-Erweiterung:
   * - getDataWallMs misst die komplette entry.getData(...)-Zeit.
   * - writeActiveMs misst nur Zeit innerhalb unserer WritableStream.write(...)-Callbacks.
   * - writeGapMs / firstChunkDelayMs messen Wartezeit zwischen zip.js und unserem Code.
   */
  private async streamZipEntryLines(
    entry: any,
    onLine: (line: string, lineNo: number) => void | Promise<void>,
    onProgress?: (loaded: number, total: number) => void,
    streamStats?: {
      chunks: number;
      bytes: number;
      decodeMs: number;
      splitMs: number;
      onLineMs: number;

      getDataWallMs?: number;
      writeActiveMs?: number;
      writeGapMs?: number;
      firstChunkDelayMs?: number;
      maxWriteGapMs?: number;
    },
  ): Promise<void> {
    const decoder = new TextDecoder("utf-8");
    let leftover = "";
    let lineNo = 0;

    let getDataStartMs = 0;
    let lastWriteEndMs = 0;
    let firstChunkSeen = false;

    const writable = new WritableStream<Uint8Array>({
      write: async (chunk) => {
        const writeStartMs = performance.now();

        if (streamStats) {
          streamStats.chunks++;
          streamStats.bytes += chunk.byteLength;

          if (!firstChunkSeen) {
            firstChunkSeen = true;
            streamStats.firstChunkDelayMs = writeStartMs - getDataStartMs;
          } else if (lastWriteEndMs > 0) {
            const gapMs = writeStartMs - lastWriteEndMs;
            streamStats.writeGapMs = (streamStats.writeGapMs ?? 0) + gapMs;
            streamStats.maxWriteGapMs = Math.max(streamStats.maxWriteGapMs ?? 0, gapMs);
          }
        }

        let t0 = performance.now();

        const decoded = decoder.decode(chunk, {stream: true});

        if (streamStats) {
          streamStats.decodeMs += performance.now() - t0;
        }

        t0 = performance.now();

        const text = leftover + decoded;
        const lines = text.split("\n");
        leftover = lines.pop() ?? "";

        if (streamStats) {
          streamStats.splitMs += performance.now() - t0;
        }

        for (const rawLine of lines) {
          const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
          lineNo++;

          if (streamStats) {
            const tLine = performance.now();
            const maybePromise = onLine(line, lineNo) as any;

            if (maybePromise && typeof maybePromise.then === "function") {
              await maybePromise;
            }

            streamStats.onLineMs += performance.now() - tLine;
          } else {
            const maybePromise = onLine(line, lineNo) as any;

            if (maybePromise && typeof maybePromise.then === "function") {
              await maybePromise;
            }
          }
        }

        const writeEndMs = performance.now();

        if (streamStats) {
          streamStats.writeActiveMs =
            (streamStats.writeActiveMs ?? 0) + (writeEndMs - writeStartMs);
          lastWriteEndMs = writeEndMs;
        }
      },

      close: async () => {
        const closeStartMs = performance.now();

        const tail = decoder.decode();
        const finalLine = leftover + tail;

        if (finalLine.length > 0) {
          const line = finalLine.endsWith("\r") ? finalLine.slice(0, -1) : finalLine;
          lineNo++;

          if (streamStats) {
            const tLine = performance.now();
            const maybePromise = onLine(line, lineNo) as any;

            if (maybePromise && typeof maybePromise.then === "function") {
              await maybePromise;
            }

            streamStats.onLineMs += performance.now() - tLine;
          } else {
            const maybePromise = onLine(line, lineNo) as any;

            if (maybePromise && typeof maybePromise.then === "function") {
              await maybePromise;
            }
          }
        }

        if (streamStats) {
          const closeEndMs = performance.now();
          streamStats.writeActiveMs =
            (streamStats.writeActiveMs ?? 0) + (closeEndMs - closeStartMs);
          lastWriteEndMs = closeEndMs;
        }
      },
    });

    /**
     * zip.js erwartet einen Writer mit writable/init/getData.
     * WritableWriter ist in manchen Versionen nur ein Type, deshalb bauen wir ihn selbst.
     */
    const writer = {
      writable,

      async init() {
        return writable;
      },

      async getData() {
        return undefined;
      },
    } as any;

    getDataStartMs = performance.now();

    await entry.getData(writer, {
      onprogress: (loaded: number, total: number) => {
        onProgress?.(loaded, total);
      },
    });

    if (streamStats) {
      streamStats.getDataWallMs = performance.now() - getDataStartMs;
    }
  }

  /**
   * CSV-Zeile parsern, ohne komplette Datei via PapaParse zu laden.
   * Reicht für stop_times.txt und unterstützt Quotes.
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Liest genau ein CSV-Feld an targetIndex.
   * Viel schneller als parseCSVLine(), wenn wir zuerst nur trip_id brauchen.
   */
  private getCSVFieldAtIndex(line: string, targetIndex: number): string {
    // Fast path: GTFS stop_times.txt ist normalerweise unquoted.
    if (!line.includes('"')) {
      let currentIndex = 0;
      let start = 0;

      for (let i = 0; i < line.length; i++) {
        if (line.charCodeAt(i) === 44) {
          // comma
          if (currentIndex === targetIndex) {
            return line.slice(start, i);
          }

          currentIndex++;
          start = i + 1;
        }
      }

      if (currentIndex === targetIndex) {
        return line.slice(start);
      }

      return "";
    }

    // Fallback für quoted CSV.
    return this.parseCSVLine(line)[targetIndex] ?? "";
  }

  /**
   * Spezial-Fast-Path für stop_times.txt trip_id.
   *
   * Wenn trip_id die erste Spalte ist, ist indexOf(",") deutlich schneller
   * als ein generischer CSV-Feldparser.
   *
   * Falls trip_id nicht erste Spalte ist oder quoted ist, wird sicher auf
   * getCSVFieldAtIndex(...) zurückgefallen.
   */
  private getStopTimeTripIdFast(line: string, tripIdIndex: number): string {
    if (tripIdIndex === 0) {
      // GTFS trip_id ist normalerweise unquoted.
      // Wenn die Zeile doch quoted startet, sichere Fallback-Logik verwenden.
      if (line.length > 0 && line.charCodeAt(0) !== 34) {
        const commaIndex = line.indexOf(",");
        return commaIndex === -1 ? line : line.slice(0, commaIndex);
      }
    }

    return this.getCSVFieldAtIndex(line, tripIdIndex);
  }

  private cleanCSVValue(value: string | undefined): string {
    return (value ?? "").trim().replace(/^\uFEFF/, "");
  }

  private getMemoryInfo(): string {
    const memory = (performance as any).memory;

    if (!memory) {
      return "heap=n/a";
    }

    const usedMb = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    const totalMb = Math.round(memory.totalJSHeapSize / 1024 / 1024);
    const limitMb = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);

    return `heap=${usedMb}/${totalMb}MB limit=${limitMb}MB`;
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
    const zipReader = new ZipReader(new BlobReader(file));

    try {
      const entries = await zipReader.getEntries();

      const result = {
        agencies: [] as GTFSAgency[],
        routes: [] as GTFSRoute[],
        serviceDateRange: null as {startDate: string; endDate: string} | null,
      };

      const agencyText = await this.readZipEntryText(entries, "agency.txt");
      if (agencyText) {
        result.agencies = this.parseCSV<GTFSAgency>(agencyText);
      }

      const routesText = await this.readZipEntryText(entries, "routes.txt");
      if (routesText) {
        result.routes = this.parseCSV<GTFSRoute>(routesText);

        if (allowedRouteTypes && allowedRouteTypes.length > 0) {
          result.routes = result.routes.filter((route) => {
            const routeType = parseInt(route.route_type?.toString() || "3", 10);
            return allowedRouteTypes.includes(routeType);
          });
        }
      }

      const calendarText = await this.readZipEntryText(entries, "calendar.txt");
      if (calendarText) {
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
    } finally {
      await zipReader.close();
    }
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
    allowedCategories?: string[],
    progressCallback?: (fileName: string) => void,
    betriebstag?: string | null,
    timeSyncTolerance?: number,
  ): Promise<GTFSData> {
    const totalImportStartMs = performance.now();

    const zipReader = new ZipReader(new BlobReader(file));

    try {
      const entries = await zipReader.getEntries();

      const gtfsData: GTFSData = {
        agencies: [],
        stops: [],
        routes: [],
        trips: [],
        stopTimes: [],
        calendar: [],
        calendarDates: [],
      };

      (gtfsData as any).betriebstag = betriebstag || null;
      (gtfsData as any).timeSyncTolerance =
        typeof timeSyncTolerance === "number" ? timeSyncTolerance : 300;

      // agency.txt
      const agencyText = await this.readZipEntryText(entries, "agency.txt");
      if (agencyText) {
        gtfsData.agencies = this.parseCSV<GTFSAgency>(agencyText);
        gtfsData.allAgencies = [...gtfsData.agencies];

        if (allowedAgencies && allowedAgencies.length > 0) {
          const beforeFilter = gtfsData.agencies.length;

          const nameToIdMap = new Map<string, string>();
          gtfsData.agencies.forEach((agency) => {
            if (agency.agency_name) {
              nameToIdMap.set(agency.agency_name.toUpperCase(), agency.agency_id);
            }
          });

          const allowedAgencyIds = new Set<string>();
          allowedAgencies.forEach((agencyName) => {
            const agencyId = nameToIdMap.get(agencyName.toUpperCase());
            if (agencyId) allowedAgencyIds.add(agencyId);
          });

          gtfsData.agencies = gtfsData.agencies.filter((agency) =>
            allowedAgencyIds.has(agency.agency_id),
          );

          console.info(`[GTFS][Agency-Filter] ${beforeFilter} → ${gtfsData.agencies.length}`);
        }
      }
      progressCallback?.("agency.txt");

      // stops.txt
      const stopsText = await this.readZipEntryText(entries, "stops.txt");
      if (stopsText) {
        gtfsData.stops = this.parseCSV<GTFSStop>(stopsText);
      }
      progressCallback?.("stops.txt");

      // routes.txt
      const routesText = await this.readZipEntryText(entries, "routes.txt");
      if (routesText) {
        gtfsData.routes = this.parseCSV<GTFSRoute>(routesText);

        if (allowedAgencies && allowedAgencies.length > 0) {
          const allowedAgencyIds = new Set(gtfsData.agencies.map((a) => a.agency_id));

          gtfsData.routes = gtfsData.routes.filter((route) => {
            if (!route.agency_id) {
              return allowedAgencyIds.size === 0 || gtfsData.agencies.length === 0;
            }

            return allowedAgencyIds.has(route.agency_id);
          });
        }

        if (allowedRouteTypes && allowedRouteTypes.length > 0) {
          gtfsData.routes = gtfsData.routes.filter((route) => {
            const routeType = parseInt(route.route_type?.toString() || "3", 10);
            return allowedRouteTypes.includes(routeType);
          });
        }

        if (gtfsData.routes.length > 0) {
          const routeKeys = Object.keys(gtfsData.routes[0]);

          if (!routeKeys.includes("route_desc")) {
            console.warn(
              "[GTFS][Category-Filter] Kein route_desc-Feld in routes.txt gefunden. Kategorie-Filter wird übersprungen.",
            );
          } else if (allowedCategories && allowedCategories.length > 0) {
            const allowedCategorySet = new Set(
              allowedCategories.map((category) => category.toUpperCase()),
            );

            gtfsData.routes = gtfsData.routes.filter((route) =>
              allowedCategorySet.has((route.route_desc || "").toUpperCase()),
            );
          }
        }

        console.info("[GTFS][Routes] Anzahl Routen nach Filtern:", gtfsData.routes.length);
      }
      progressCallback?.("routes.txt");

      // calendar.txt
      const calendarText = await this.readZipEntryText(entries, "calendar.txt");
      if (calendarText) {
        gtfsData.calendar = this.parseCSV<GTFSCalendar>(calendarText);
      }

      // calendar_dates.txt
      const calendarDatesText = await this.readZipEntryText(entries, "calendar_dates.txt");
      if (calendarDatesText) {
        gtfsData.calendarDates = this.parseCSV<GTFSCalendarDate>(calendarDatesText);
      }

      progressCallback?.("calendar.txt");

      // trips.txt
      const tripsTotalStartMs = performance.now();

      const tripsReadStartMs = performance.now();
      const tripsText = await this.readZipEntryText(entries, "trips.txt");
      const tripsReadMs = performance.now() - tripsReadStartMs;

      if (tripsText) {
        if (LOG_GTFS_PERF_KPI) {
          console.info(
            `[GTFS][trips][Timing] readZipEntryText: ${Math.round(tripsReadMs)}ms, ` +
              `textMB=${Math.round((tripsText.length / 1024 / 1024) * 10) / 10}, ` +
              `${this.getMemoryInfo()}`,
          );
        }

        const tripsParseStartMs = performance.now();
        gtfsData.trips = this.parseCSV<GTFSTrip>(tripsText);
        const tripsParseMs = performance.now() - tripsParseStartMs;

        console.info(
          `[GTFS][trips][Timing] parseCSV: ${Math.round(tripsParseMs)}ms, ` +
            `trips=${gtfsData.trips.length}, ${this.getMemoryInfo()}`,
        );

        if (
          (allowedRouteTypes && allowedRouteTypes.length > 0) ||
          (allowedAgencies && allowedAgencies.length > 0) ||
          (allowedCategories && allowedCategories.length > 0)
        ) {
          const tripsRouteFilterStartMs = performance.now();

          const beforeRouteFilterTrips = gtfsData.trips.length;
          const allowedRouteIds = new Set(gtfsData.routes.map((r) => r.route_id));
          gtfsData.trips = gtfsData.trips.filter((trip) => allowedRouteIds.has(trip.route_id));

          const tripsRouteFilterMs = performance.now() - tripsRouteFilterStartMs;

          console.info(
            `[GTFS][trips][Timing] Route/Agency/Category-Filter: ` +
              `${Math.round(tripsRouteFilterMs)}ms, ` +
              `${beforeRouteFilterTrips} → ${gtfsData.trips.length} Trips, ` +
              `${this.getMemoryInfo()}`,
          );
        }

        // Betriebstag-Filter
        if (betriebstag) {
          const tripsBetriebstagFilterStartMs = performance.now();
          const beforeBetriebstag = gtfsData.trips.length;

          const activeServiceStartMs = performance.now();

          // Optimiert:
          // Für genau einen Betriebstag bestimmen wir zuerst die aktiven service_ids.
          // Dadurch vermeiden wir eine grosse excMap mit `${service_id}|${date}` Keys.
          const activeServiceIds = this.getServiceIdsForDate(
            betriebstag,
            gtfsData.calendar || [],
            gtfsData.calendarDates || [],
          );

          const activeServiceMs = performance.now() - activeServiceStartMs;

          console.info(
            `[GTFS][trips][Timing] Active service_ids: ` +
              `${Math.round(activeServiceMs)}ms, ` +
              `active=${activeServiceIds.size}, ${this.getMemoryInfo()}`,
          );

          const tripsServiceFilterStartMs = performance.now();

          gtfsData.trips = gtfsData.trips.filter((trip) =>
            activeServiceIds.has(trip.service_id || ""),
          );

          const tripsServiceFilterMs = performance.now() - tripsServiceFilterStartMs;
          const tripsBetriebstagFilterMs = performance.now() - tripsBetriebstagFilterStartMs;

          console.info(
            `[GTFS][Betriebstag-Filter] ${betriebstag}: ${beforeBetriebstag} → ${gtfsData.trips.length} Trips`,
          );

          console.info(
            `[GTFS][trips][Timing] Betriebstag-Filter optimized: ` +
              `${Math.round(tripsBetriebstagFilterMs)}ms total, ` +
              `activeService=${Math.round(activeServiceMs)}ms, ` +
              `tripFilter=${Math.round(tripsServiceFilterMs)}ms, ` +
              `${beforeBetriebstag} → ${gtfsData.trips.length} Trips, ` +
              `${this.getMemoryInfo()}`,
          );
        }
      } else {
        console.warn("[GTFS][trips] trips.txt nicht gefunden oder leer.");
      }

      const tripsTotalMs = performance.now() - tripsTotalStartMs;
      if (LOG_GTFS_PERF_KPI) {
        console.info(
          `[GTFS][trips][Timing] trips.txt total: ${Math.round(tripsTotalMs)}ms ` +
            `= ${Math.round((tripsTotalMs / 1000) * 10) / 10}s, ` +
            `finalTrips=${gtfsData.trips.length}, ${this.getMemoryInfo()}`,
        );
      }

      progressCallback?.("trips.txt");

      // stop_times.txt STREAMING
      const stopTimesEntry = this.findZipEntry(entries, "stop_times.txt");
      gtfsData.stopTimes = [];

      if (stopTimesEntry) {
        const allowedTripIds = new Set(gtfsData.trips.map((trip) => trip.trip_id));

        let header: string[] = [];
        let tripIdIndex = -1;
        let keepCount = 0;
        let processedCount = 0;
        let lastProgressLog = 0;

        const PROFILE_STOP_TIMES = false;
        // Für produktive Speed-Tests: Performance-/KPI-/Debug-Logs ausschalten.
        // Wichtig: Der Code in diesen console.info/console.table Calls wird dann nicht evaluiert.
        const streamStats = {
          chunks: 0,
          bytes: 0,
          decodeMs: 0,
          splitMs: 0,
          onLineMs: 0,

          // Bottleneck-Beweis: Zeit ausserhalb unseres Zeilen-Codes
          getDataWallMs: 0,
          writeActiveMs: 0,
          writeGapMs: 0,
          firstChunkDelayMs: 0,
          maxWriteGapMs: 0,
        };

        const parseStats = {
          startMs: performance.now(),

          processedLines: 0,
          emptyLines: 0,
          shortRows: 0,
          keptRows: 0,
          rejectedByTripId: 0,

          parseCsvLineMs: 0,
          cleanTripIdMs: 0,
          setLookupMs: 0,
          recordBuildMs: 0,
          pushMs: 0,
          totalCallbackMs: 0,
        };

        console.info("[GTFS][stop_times] Streaming gestartet...");

        await this.streamZipEntryLines(
          stopTimesEntry,

          (line, lineNo) => {
            const callbackStart = PROFILE_STOP_TIMES ? performance.now() : 0;

            if (line.length === 0) {
              parseStats.emptyLines++;

              if (PROFILE_STOP_TIMES) {
                parseStats.totalCallbackMs += performance.now() - callbackStart;
              }

              return;
            }

            if (lineNo === 1) {
              const tParseHeader = PROFILE_STOP_TIMES ? performance.now() : 0;

              header = this.parseCSVLine(line).map((h) => this.cleanCSVValue(h));
              tripIdIndex = header.indexOf("trip_id");

              console.info(
                `[GTFS][stop_times] trip_id index=${tripIdIndex}, ` +
                  `fastPath=${tripIdIndex === 0 ? "yes" : "no"}`,
              );

              if (PROFILE_STOP_TIMES) {
                parseStats.parseCsvLineMs += performance.now() - tParseHeader;
                parseStats.totalCallbackMs += performance.now() - callbackStart;
              }

              if (tripIdIndex < 0) {
                throw new Error("[GTFS][stop_times] trip_id-Spalte nicht gefunden.");
              }

              return;
            }

            processedCount++;
            parseStats.processedLines++;

            let t0 = PROFILE_STOP_TIMES ? performance.now() : 0;

            // Erst NUR trip_id extrahieren, nicht die ganze Zeile parsen.
            // Bei keepRatio << 1% spart das sehr viel Zeit.
            const tripIdRaw = this.getStopTimeTripIdFast(line, tripIdIndex);

            if (PROFILE_STOP_TIMES) {
              // Wir zählen diese schnelle Extraktion bewusst unter cleanTripId.
              parseStats.cleanTripIdMs += performance.now() - t0;
            }

            if (!tripIdRaw) {
              parseStats.shortRows++;

              if (PROFILE_STOP_TIMES) {
                parseStats.totalCallbackMs += performance.now() - callbackStart;
              }

              return;
            }

            t0 = PROFILE_STOP_TIMES ? performance.now() : 0;

            const tripId = this.cleanCSVValue(tripIdRaw);

            if (PROFILE_STOP_TIMES) {
              parseStats.cleanTripIdMs += performance.now() - t0;
            }

            t0 = PROFILE_STOP_TIMES ? performance.now() : 0;

            const allowed = allowedTripIds.has(tripId);

            if (PROFILE_STOP_TIMES) {
              parseStats.setLookupMs += performance.now() - t0;
            }

            if (!allowed) {
              parseStats.rejectedByTripId++;

              if (PROFILE_STOP_TIMES) {
                parseStats.totalCallbackMs += performance.now() - callbackStart;
              }

              return;
            }

            // Erst jetzt komplette CSV-Zeile parsen, weil sie wirklich behalten wird.
            t0 = PROFILE_STOP_TIMES ? performance.now() : 0;

            const values = this.parseCSVLine(line);

            if (PROFILE_STOP_TIMES) {
              parseStats.parseCsvLineMs += performance.now() - t0;
            }

            if (values.length < header.length) {
              parseStats.shortRows++;

              if (PROFILE_STOP_TIMES) {
                parseStats.totalCallbackMs += performance.now() - callbackStart;
              }

              return;
            }

            t0 = PROFILE_STOP_TIMES ? performance.now() : 0;

            const record: any = {};

            for (let i = 0; i < header.length && i < values.length; i++) {
              record[header[i]] = this.cleanCSVValue(values[i]);
            }

            if (PROFILE_STOP_TIMES) {
              parseStats.recordBuildMs += performance.now() - t0;
            }

            t0 = PROFILE_STOP_TIMES ? performance.now() : 0;

            gtfsData.stopTimes.push(record as GTFSStopTime);

            if (PROFILE_STOP_TIMES) {
              parseStats.pushMs += performance.now() - t0;
            }

            keepCount++;
            parseStats.keptRows++;

            if (PROFILE_STOP_TIMES) {
              parseStats.totalCallbackMs += performance.now() - callbackStart;
            }

            if (keepCount % 100000 === 0) {
              const elapsedMs = performance.now() - parseStats.startMs;
              const rowsPerSec = Math.round((processedCount / elapsedMs) * 1000);
              const keptPerSec = Math.round((keepCount / elapsedMs) * 1000);

              console.info(
                `[GTFS][stop_times] Behaltene Records: ${keepCount}, ` +
                  `gelesene Zeilen: ${processedCount}, ` +
                  `rows/s=${rowsPerSec}, kept/s=${keptPerSec}, ` +
                  `${this.getMemoryInfo()}`,
              );
            }
          },

          (loaded, total) => {
            if (!total) return;

            const percent = Math.floor((loaded / total) * 100);

            if (percent >= lastProgressLog + 5) {
              lastProgressLog = percent;

              const elapsedMs = performance.now() - parseStats.startMs;
              const rowsPerSec =
                elapsedMs > 0 ? Math.round((processedCount / elapsedMs) * 1000) : 0;

              console.info(
                `[GTFS][stop_times] Entpackt: ${percent}% ` +
                  `loaded=${Math.round(loaded / 1024 / 1024)}MB/` +
                  `${Math.round(total / 1024 / 1024)}MB, ` +
                  `lines=${processedCount}, kept=${keepCount}, rows/s=${rowsPerSec}, ` +
                  `${this.getMemoryInfo()}`,
              );
            }
          },

          PROFILE_STOP_TIMES ? streamStats : undefined,
        );

        const totalMs = performance.now() - parseStats.startMs;

        console.info(
          `[GTFS][stop_times] Fertig. Gelesene Zeilen: ${processedCount}, behaltene StopTimes: ${keepCount}`,
        );

        if (PROFILE_STOP_TIMES) {
          const round = (value: number) => Math.round(value);

          console.table({
            total: {
              ms: round(totalMs),
              percent: "100%",
            },
            zip_decode: {
              ms: round(streamStats.decodeMs),
              percent: `${Math.round((streamStats.decodeMs / totalMs) * 100)}%`,
            },
            split_lines: {
              ms: round(streamStats.splitMs),
              percent: `${Math.round((streamStats.splitMs / totalMs) * 100)}%`,
            },
            onLine_total: {
              ms: round(streamStats.onLineMs),
              percent: `${Math.round((streamStats.onLineMs / totalMs) * 100)}%`,
            },
            parseCSVLine: {
              ms: round(parseStats.parseCsvLineMs),
              percent: `${Math.round((parseStats.parseCsvLineMs / totalMs) * 100)}%`,
            },
            cleanTripId: {
              ms: round(parseStats.cleanTripIdMs),
              percent: `${Math.round((parseStats.cleanTripIdMs / totalMs) * 100)}%`,
            },
            setLookup: {
              ms: round(parseStats.setLookupMs),
              percent: `${Math.round((parseStats.setLookupMs / totalMs) * 100)}%`,
            },
            recordBuild: {
              ms: round(parseStats.recordBuildMs),
              percent: `${Math.round((parseStats.recordBuildMs / totalMs) * 100)}%`,
            },
            push: {
              ms: round(parseStats.pushMs),
              percent: `${Math.round((parseStats.pushMs / totalMs) * 100)}%`,
            },
          });

          const getDataWallMs = streamStats.getDataWallMs ?? 0;
          const writeActiveMs = streamStats.writeActiveMs ?? 0;
          const firstChunkDelayMs = streamStats.firstChunkDelayMs ?? 0;
          const writeGapMs = streamStats.writeGapMs ?? 0;
          const maxWriteGapMs = streamStats.maxWriteGapMs ?? 0;

          const measuredInsideWriteMs =
            streamStats.decodeMs + streamStats.splitMs + streamStats.onLineMs;

          const unmeasuredInsideWriteMs = Math.max(0, writeActiveMs - measuredInsideWriteMs);
          const hiddenZipStreamPipelineMs = Math.max(0, getDataWallMs - writeActiveMs);
          const betweenWritesAndBeforeFirstChunkMs = firstChunkDelayMs + writeGapMs;

          const pctOfGetData = (value: number): string =>
            getDataWallMs > 0 ? `${Math.round((value / getDataWallMs) * 100)}%` : "0%";

          console.table({
            getData_wall_total: {
              ms: round(getDataWallMs),
              percent: "100%",
              meaning: "komplette entry.getData(...)-Zeit",
            },
            write_active_total: {
              ms: round(writeActiveMs),
              percent: pctOfGetData(writeActiveMs),
              meaning: "Zeit innerhalb unserer WritableStream.write/close callbacks",
            },
            hidden_zip_stream_pipeline: {
              ms: round(hiddenZipStreamPipelineMs),
              percent: pctOfGetData(hiddenZipStreamPipelineMs),
              meaning:
                "Zeit ausserhalb unseres Codes: zip.js inflate, Stream Scheduling, Browser, GC",
            },
            first_chunk_delay: {
              ms: round(firstChunkDelayMs),
              percent: pctOfGetData(firstChunkDelayMs),
              meaning: "Zeit bis der erste entpackte Chunk bei uns ankommt",
            },
            gaps_between_writes_total: {
              ms: round(writeGapMs),
              percent: pctOfGetData(writeGapMs),
              meaning: "Wartezeit zwischen write()-Callbacks",
            },
            max_single_gap_between_writes: {
              ms: round(maxWriteGapMs),
              percent: pctOfGetData(maxWriteGapMs),
              meaning: "grösste einzelne Pause zwischen zwei write()-Callbacks",
            },
            measured_decode_split_onLine: {
              ms: round(measuredInsideWriteMs),
              percent: pctOfGetData(measuredInsideWriteMs),
              meaning: "TextDecoder + split_lines + onLine_total",
            },
            unmeasured_inside_write: {
              ms: round(unmeasuredInsideWriteMs),
              percent: pctOfGetData(unmeasuredInsideWriteMs),
              meaning: "Rest innerhalb write(): Schleifen, CR-Handling, Profiling-Overhead",
            },
            before_or_between_writes_sum: {
              ms: round(betweenWritesAndBeforeFirstChunkMs),
              percent: pctOfGetData(betweenWritesAndBeforeFirstChunkMs),
              meaning: "first_chunk_delay + gaps_between_writes_total",
            },
          });

          console.table({
            chunks: streamStats.chunks,
            bytesMB: Math.round(streamStats.bytes / 1024 / 1024),
            processedLines: parseStats.processedLines,
            emptyLines: parseStats.emptyLines,
            shortRows: parseStats.shortRows,
            rejectedByTripId: parseStats.rejectedByTripId,
            keptRows: parseStats.keptRows,
            keepRatio:
              parseStats.processedLines > 0
                ? `${Math.round((parseStats.keptRows / parseStats.processedLines) * 10000) / 100}%`
                : "0%",
            memory: this.getMemoryInfo(),
          });
        }
      }

      progressCallback?.("stop_times.txt");

      // Post-processing
      if (gtfsData.stopTimes.length > 0) {
        const postProcessingStartMs = performance.now();

        const patternStartMs = performance.now();
        this.selectMostFrequentTripPatterns(gtfsData);
        const patternMs = performance.now() - patternStartMs;
        if (LOG_GTFS_PERF_KPI) {
          console.info(
            `[GTFS][Timing] selectMostFrequentTripPatterns: ${Math.round(patternMs)}ms ` +
              `= ${Math.round((patternMs / 1000) * 10) / 10}s`,
          );
        }

        const classifyStartMs = performance.now();
        this.classifyNodes(gtfsData.stops, gtfsData.stopTimes, gtfsData.trips);
        const classifyMs = performance.now() - classifyStartMs;
        if (LOG_GTFS_PERF_KPI) {
          console.info(
            `[GTFS][Timing] classifyNodes: ${Math.round(classifyMs)}ms ` +
              `= ${Math.round((classifyMs / 1000) * 10) / 10}s`,
          );
        }

        const postProcessingMs = performance.now() - postProcessingStartMs;
        if (LOG_GTFS_PERF_KPI) {
          console.info(
            `[GTFS][Timing] Post-processing total: ${Math.round(postProcessingMs)}ms ` +
              `= ${Math.round((postProcessingMs / 1000) * 10) / 10}s`,
          );
        }
      }

      const totalImportMs = performance.now() - totalImportStartMs;
      console.info(
        `[GTFS][TOTAL] parseGTFSZip komplett: ${Math.round(totalImportMs)}ms ` +
          `= ${Math.round((totalImportMs / 1000) * 10) / 10}s ` +
          `= ${Math.round((totalImportMs / 60000) * 10) / 10}min`,
      );

      return gtfsData;
    } finally {
      await zipReader.close();
    }
  }

  /**
   * Selektiert pro Route+Richtung den repräsentativsten Trip.
   *
   * Algorithmus:
   * 1. Alle stop_times nach trip_id gruppieren, Stop-IDs auf parent_station normalisieren
   *    (Perron/Gleis ignorieren), aufeinanderfolgende Duplikate entfernen.
   * 2. Trips nach route_id + direction + parent_station_path gruppieren.
   *    direction_id aus GTFS, oder lexikographisch abgeleitet falls fehlend.
   * 3. Pro route_id + direction die "beste Gruppe" wählen:
   *    Score = Pfadlänge × Anzahl Trips. Bei Gleichstand: meiste Trips gewinnt.
   *    → längster vollständiger Linienweg mit den häufigsten Fahrten.
   * 4. Frequenz per Histogramm (Modus der gerundeten Intervalle) im Fenster 06–22 Uhr.
   *    Standard-Frequenzen: 15 / 20 / 30 / 60 / 120 min.
   * 5. Repräsentativer Trip = Abfahrt am nächsten an 10:00 Uhr im Tagesfenster.
   * 6. Pro Richtung genau 1 Trip exportieren.
   */
  private selectMostFrequentTripPatterns(gtfsData: GTFSData): void {
    const DAY_START = 6 * 60; // 06:00
    const DAY_END = 22 * 60; // 22:00
    const TARGET_DEP_TIME = 10 * 60; // Repräsentant-Zielzeit 10:00

    // ── Step 1: parent_station map ───────────────────────────────────────────
    const stopIdToParent = new Map<string, string>();
    for (const stop of gtfsData.stops) {
      stopIdToParent.set(stop.stop_id, stop.parent_station || stop.stop_id);
    }

    // ── Step 2: stop_times nach trip_id gruppieren & sortieren ───────────────
    const tripStopTimes = new Map<string, GTFSStopTime[]>();
    for (const st of gtfsData.stopTimes) {
      if (!tripStopTimes.has(st.trip_id)) tripStopTimes.set(st.trip_id, []);
      tripStopTimes.get(st.trip_id)!.push(st);
    }
    for (const sts of tripStopTimes.values()) {
      sts.sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
    }

    // ── Step 3: Pro Trip parent_station_path + erste Abfahrtszeit ────────────
    // Path = deduplizierte parent_station IDs (Perron-Wechsel am selben Bahnhof ignorieren)
    const tripParentPath = new Map<string, string[]>(); // trip_id → parent_station_id[]
    const tripFirstDeparture = new Map<string, number>(); // trip_id → Minuten seit Mitternacht

    for (const trip of gtfsData.trips) {
      const sts = tripStopTimes.get(trip.trip_id);
      if (!sts || sts.length === 0) continue;

      const raw = sts.map((st) => stopIdToParent.get(st.stop_id) || st.stop_id);
      // Aufeinanderfolgende Duplikate entfernen
      const dedup: string[] = [raw[0]];
      for (let i = 1; i < raw.length; i++) {
        if (raw[i] !== dedup[dedup.length - 1]) dedup.push(raw[i]);
      }
      tripParentPath.set(trip.trip_id, dedup);

      const dep = sts[0].departure_time || sts[0].arrival_time;
      if (dep) tripFirstDeparture.set(trip.trip_id, GTFSParserService.timeToMinutes(dep));
    }

    // ── Step 4: Trips nach route_id + direction + path-string gruppieren ─────
    // Schlüssel-Trenner "||" um Kollisionen mit route_ids/stop_ids zu vermeiden
    const pathGroups = new Map<string, GTFSTrip[]>(); // groupKey → trips

    for (const trip of gtfsData.trips) {
      const parentPath = tripParentPath.get(trip.trip_id);
      if (!parentPath || parentPath.length === 0) continue;

      let dir = trip.direction_id;
      if (dir === null || dir === undefined || dir === "") {
        // Richtung aus erstem/letztem Halt ableiten
        dir = parentPath[0] < parentPath[parentPath.length - 1] ? "0" : "1";
      }

      const groupKey = `${trip.route_id}||${dir}||${parentPath.join("|")}`;
      if (!pathGroups.has(groupKey)) pathGroups.set(groupKey, []);
      pathGroups.get(groupKey)!.push(trip);
    }

    // ── Step 5: Alle Gruppen nach route_id + direction zusammenfassen ─────────
    // routeDirKey → Map<groupKey, trips>
    const routeDirGroups = new Map<string, Map<string, GTFSTrip[]>>();
    for (const [groupKey, trips] of pathGroups.entries()) {
      const sep = groupKey.indexOf("||");
      const sep2 = groupKey.indexOf("||", sep + 2);
      const route_id = groupKey.substring(0, sep);
      const dir = groupKey.substring(sep + 2, sep2);
      const routeDirKey = `${route_id}||${dir}`;
      if (!routeDirGroups.has(routeDirKey)) routeDirGroups.set(routeDirKey, new Map());
      routeDirGroups.get(routeDirKey)!.set(groupKey, trips);
    }

    // ── Step 6: Beste Gruppe pro route+direction wählen ───────────────────────
    const selectedTripIds = new Set<string>();

    for (const [routeDirKey, groups] of routeDirGroups.entries()) {
      const sep = routeDirKey.indexOf("||");
      const route_id = routeDirKey.substring(0, sep);

      // Beste Gruppe: maximize score = pathLength × tripCount; tiebreak: meiste Trips
      let bestGroupKey: string | null = null;
      let bestScore = -1;
      let bestTripCount = -1;
      let bestPathLength = -1;

      for (const [groupKey, trips] of groups.entries()) {
        const firstPath = tripParentPath.get(trips[0].trip_id) ?? [];
        const pathLength = firstPath.length;
        const tripCount = trips.length;
        const score = pathLength * tripCount;

        if (score > bestScore || (score === bestScore && tripCount > bestTripCount)) {
          bestScore = score;
          bestTripCount = tripCount;
          bestPathLength = pathLength;
          bestGroupKey = groupKey;
        }
      }

      if (!bestGroupKey) continue;
      const bestTrips = groups.get(bestGroupKey)!;

      // ── Step 7: Frequenz per Histogramm (06–22 Uhr) ──────────────────────
      const depTimes = bestTrips
        .map((t) => tripFirstDeparture.get(t.trip_id))
        .filter((t): t is number => t !== undefined && t >= DAY_START && t <= DAY_END)
        .sort((a, b) => a - b);

      let frequency = 60; // Default
      if (depTimes.length >= 2) {
        const histogram = new Map<number, number>();
        for (let i = 1; i < depTimes.length; i++) {
          const interval = depTimes[i] - depTimes[i - 1];
          let rounded: number;
          if (interval <= 17) rounded = 15;
          else if (interval <= 25) rounded = 20;
          else if (interval <= 45) rounded = 30;
          else if (interval <= 90) rounded = 60;
          else rounded = 120;
          histogram.set(rounded, (histogram.get(rounded) || 0) + 1);
        }
        // Modus = häufigster Intervall-Wert
        let maxCount = 0;
        for (const [freq, count] of histogram.entries()) {
          if (count > maxCount) {
            maxCount = count;
            frequency = freq;
          }
        }
      } else if (depTimes.length === 1) {
        frequency = 120;
      }

      // Frequenz am Route-Objekt setzen (immer, nicht nur wenn noch leer)
      const route = gtfsData.routes.find((r) => r.route_id === route_id);
      if (route) route.frequency = GTFSParserService.normalizeFrequency(frequency);

      // ── Step 8: Repräsentativer Trip = Abfahrt nächste an 10:00 ──────────
      let repTrip = bestTrips[0];
      let minDiff = Infinity;
      for (const trip of bestTrips) {
        const dep = tripFirstDeparture.get(trip.trip_id);
        if (dep === undefined) continue;
        const diff = Math.abs(dep - TARGET_DEP_TIME);
        if (diff < minDiff) {
          minDiff = diff;
          repTrip = trip;
        }
      }
      selectedTripIds.add(repTrip.trip_id);

      const repDep = tripFirstDeparture.get(repTrip.trip_id);
      const repDepStr = repDep !== undefined ? GTFSParserService.minutesToTime(repDep) : "?";
      const bestPath = tripParentPath.get(bestTrips[0].trip_id) ?? [];
      if (LOG_GTFS_PATTERN_DEBUG) {
        console.info(
          `[GTFS][Pattern] ${route_id} dir=${routeDirKey.substring(sep + 2)}:` +
            ` path_len=${bestPathLength}, groups=${groups.size}, best_trips=${bestTripCount},` +
            ` freq=${frequency}min, rep=${repTrip.trip_id} @${repDepStr}` +
            ` [${bestPath[0]} → ${bestPath[bestPath.length - 1]}]`,
        );
      }
    }

    // ── Step 9: Trips und StopTimes auf Repräsentanten reduzieren ────────────
    gtfsData.trips = gtfsData.trips.filter((trip) => selectedTripIds.has(trip.trip_id));
    gtfsData.stopTimes = gtfsData.stopTimes.filter((st) => selectedTripIds.has(st.trip_id));

    console.info(
      `[GTFS][Pattern] Fertig: ${selectedTripIds.size} repräsentative Trips` +
        ` aus ${routeDirGroups.size} Route+Richtungs-Kombinationen`,
    );
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
