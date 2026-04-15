### Feature 6: Erzeugung und Behandlung von Knoten (Nodes) aus parent_station_name

**Story 6.1:** Als Entwickler möchte ich, dass für jeden in den GTFS-Daten vorkommenden parent_station_name ein eindeutiger Knoten (Node) mit allen relevanten Attributen erzeugt wird.
  - **Task 6.1.1:** Alle parent_station_name aus stop_times.txt und stops.txt extrahieren und eindeutige Knotenliste erzeugen.
  - **Task 6.1.2:** Für jeden Knoten die Koordinaten (lat/lon) aus stops.txt übernehmen. Falls mehrere Stops denselben parent_station_name haben, Mittelwert der Koordinaten berechnen.
  - **Task 6.1.3:** Weitere Attribute wie Name, ID, ggf. Typ (z.B. Bahnhof, Haltestelle) und Referenzen auf zugehörige Stops speichern.
  - **Task 6.1.4:** Die erzeugten Knoten als Node-Objekte im Netzgrafik-Editor bereitstellen und für die Pfad- und Gruppierungslogik verwenden.
  - **Task 6.1.5:** Sicherstellen, dass die Knoten konsistent und eindeutig sind, auch bei Namensvarianten oder Dubletten.

*Beschreibung:*
Im Importprozess werden alle in den GTFS-Daten vorkommenden parent_station_name aus stop_times.txt und stops.txt gesammelt. Für jeden eindeutigen Namen wird ein Node erzeugt. Die Koordinaten werden aus den zugehörigen Stops übernommen; bei mehreren Stops pro parent_station_name wird der Mittelwert gebildet. Jeder Node erhält alle relevanten Attribute (Name, ID, Typ, Referenzen). Diese Nodes bilden die Grundlage für die Pfadlogik, Gruppierung und Visualisierung im Netzgrafik-Editor. Die Eindeutigkeit und Konsistenz der Knoten ist sicherzustellen, insbesondere bei Namensvarianten oder mehrfach vergebenen Namen.
---


## Algorithmus (Pseudocode) zur Umsetzung des GTFS-Imports

```typescript
// Datenstrukturen (TypeScript-ähnlich):
interface GTFSAgency { id: string; name: string; }
interface GTFSRoute { id: string; agencyId: string; type: string; desc?: string; name: string; }
interface GTFSTrip { id: string; routeId: string; serviceId: string; directionId?: number; stopTimes: GTFSStopTime[]; }
interface GTFSStopTime { stopId: string; arrival: number; departure: number; parentStationName: string; }
interface FilterState {
  agencies: string[];
  routeTypes: string[];
  routeDescs: string[];
  routeNames: string[];
  transportTypes: string[];
  operationDay: Date;
}

// Hauptalgorithmus:
function importGTFS(gtfsZip: File, filter: FilterState) {
  // 1. Entpacken und Parsen
  const { agencies, routes, trips, stopTimes, calendar } = unzipAndParseGTFS(gtfsZip);

  // 2. Agency-Filter
  const filteredAgencies = agencies.filter(a => filter.agencies.includes(a.id));

  // 3. Routen-Filter
  const filteredRoutes = routes.filter(r =>
    filteredAgencies.some(a => a.id === r.agencyId) &&
    (filter.routeTypes.length === 0 || filter.routeTypes.includes(r.type)) &&
    (filter.routeDescs.length === 0 || filter.routeDescs.includes(r.desc || "")) &&
    (filter.routeNames.length === 0 || filter.routeNames.includes(r.name))
  );

  // 4. Verkehrstyp-Filter (Checkboxen)
  const filteredRoutesByTransport = filteredRoutes.filter(r => filter.transportTypes.includes(r.type));

  // 5. Trips am Betriebstag
  const validServiceIds = getServiceIdsForDay(calendar, filter.operationDay);
  const filteredTrips = trips.filter(t =>
    filteredRoutesByTransport.some(r => r.id === t.routeId) &&
    validServiceIds.includes(t.serviceId)
  );

  // 6. Gruppierung: Agency → Route → Direction/Path → Trips
  const grouped = groupTrips(filteredTrips, routes, agencies);

  // 7. Für jede Gruppe: Pfadlogik, Frequenzberechnung, Master-Path, Symmetrie
  for (const agency of grouped) {
    for (const route of agency.routes) {
      for (const direction of route.directions) {
        // Trips nach Abfahrtszeit sortieren
        direction.trips.sort((a, b) => getFirstDeparture(a) - getFirstDeparture(b));

        // Frequenz berechnen (kleinste Differenz der Abfahrten)
        const deltas = getDepartureDeltas(direction.trips);
        const minDelta = Math.min(...deltas);
        direction.frequency = matchFrequency(minDelta); // 15, 20, 30, 60, 120

        // Master-Path bestimmen (meiste Fahrten)
        // ...

        // Symmetrie prüfen und Round-Trip/One-Way bestimmen
        // ...
      }
    }
  }

  // 8. Ergebnisobjekte für Netzgrafik erzeugen
  // ...
}

// Hilfsfunktionen: unzipAndParseGTFS, getServiceIdsForDay, groupTrips, getFirstDeparture, getDepartureDeltas, matchFrequency
```

// Die Datenstrukturen und der Ablauf sind so gewählt, dass eine effiziente, nachvollziehbare und wartbare Umsetzung in TypeScript möglich ist.
---

## Detaillierte Ablaufbeschreibung und verbindliche Umsetzungsvorgaben

Die folgenden Schritte beschreiben exakt, wie der GTFS-Import und die Filterung im Netzgrafik-Editor umgesetzt werden müssen. Die Reihenfolge und Logik sind verbindlich einzuhalten:

1. **Daten laden und entpacken:**
  - Die GTFS-Daten werden als ZIP geladen und entpackt.
  - Direkt nach dem Entpacken werden alle Agency (Unternehmen) extrahiert.
  - Für die Filterung wird ein Mehrfachauswahl-Autocomplete-Chip-Input verwendet (UI-Element von angular.sbb.ch). Der Nutzer sieht alle Agency als auswählbare Chips.

2. **Routen- und Routenbeschreibung-Filter:**
  - Alle `route_type` werden extrahiert und als Chip-Filter angeboten (wie oben, angular.sbb.ch).
  - Alle `route_desc` (sofern vorhanden) werden ebenfalls als Chip-Filter angeboten.
  - Zusätzlich wird der Routenname (`route_name`) als dritter Chip-Filter bereitgestellt.
  - Es gibt somit drei unabhängige Chip-Autocomplete-Filter (agency, route_type, route_desc/route_name).

3. **Verkehrstyp-Filter:**
  - Verkehrstypen wie Bahn, Tram etc. werden als Checkboxen dargestellt (Default-Auswahl wie im PoC).
  - Die Default-Auswahl und die Extraktion der Typen sind exakt wie im Proof-of-Concept umzusetzen und zu dokumentieren.

4. **Betriebstag und Datumsbereich:**
  - Ganz oben im UI wird der Betriebstag (relevanter Tag) ausgewählt.
  - Auf derselben Zeile wird angezeigt, von wann bis wann Daten im Import vorliegen (Datumsbereich aus calendar extrahieren).

5. **Filterpipeline beim Import:**
  - Nach dem Import werden zuerst alle Agency gemäß Filter ausgewählt.
  - Danach werden alle Routen gemäß den gesetzten Filtern gefiltert.
  - Im Anschluss werden alle Trips gefiltert, die am gewählten Betriebstag verkehren.
  - Nur diese Daten werden weiterverarbeitet.

6. **Hierarchische Gruppierung und Pfadlogik:**
  - Für jede Agency werden alle zugehörigen Routen gruppiert.
  - Zu jeder Route werden die zugehörigen Trips zugeordnet.
  - Innerhalb der Routen werden die Trips nach Richtung gruppiert. Falls keine Richtung existiert oder alle gleich sind, wird aus den parent_station_name-Folgen (Pfad) gruppiert.
  - Es gibt einen Forward- und einen Backward-Path. Ein Master-Path wird gebildet, indem vorne oder hinten gekürzt wird. Alle Pfade werden gruppiert, Forward/Backward werden erkannt und hierarchisch sortiert: Agency → Route → Direction (Direction oder/und Path-Array) → Trips.
  - Innerhalb jeder Gruppe werden die Trips nach Zeit sortiert.

7. **Frequenzberechnung und Zuordnung:**
  - Für jede Gruppe wird das Delta der Abfahrtszeiten (in Minuten) berechnet.
  - Die kleinste Differenz wird ermittelt und geprüft, ob sie 15, 20, 30, 60, 120 ist.
  - Wichtig: 120 bedeutet Fahrt zur geraden Stunde, 120+ zur ungeraden Stunde. Dies sind die möglichen Frequenzen. Die Abfahrtszeit in eine Richtung gibt dies vor (z.B. Abfahrt um 08:00 → 120, Abfahrt um 09:00 → 120+).
  - Die Frequenzen werden aus den Netzgrafik-Metadaten (Default) entnommen und das Objekt mit der gefundenen Frequenz verknüpft.

8. **Master-Path und Richtungserkennung:**
  - Die Anzahl Trips pro Gruppe wird berechnet.
  - Die Gruppe (Forward/Backward) mit den meisten Fahrten am Betriebstag wird als Master-Path definiert.
  - Der Master-Path wird auf gleiche Frequenz für Forward/Backward geprüft. Existiert nur eine Richtung, ist es One-Way. Existieren beide, wird geprüft, ob die Minuten für alle Fahrten gleich sind pro Richtung und Ort (parent_station_name).
  - Falls nicht, wird die Minute genommen, die am häufigsten vorkommt pro Ort und daraus der Master-Forward- und -Backward-Path mit minimalen Abfahrts- und Ankunftszeiten erstellt.
  - Die Deltas werden als Fahrzeit berechnet.
  - Es wird versucht, Forward- und Backward-Zeiten symmetrisch zu machen (Summe aus Ankunft Forward + Abfahrt Backward = 60 → symmetrisch, sonst nicht).
  - Sind alle Zeiten symmetrisch, wird ein Round-Trip erstellt, sonst One-Way.
  - Round-Trips werden zu einer Linie mit Standard-Netzgrafik-Trainrun und TrainrunSection transformiert, sonst One-Way.

Alle Schritte sind exakt wie beschrieben umzusetzen. Die UI-Elemente, Filterlogik, Gruppierung und Frequenzberechnung müssen der obigen Vorgabe folgen. Abweichungen sind nur nach expliziter Rücksprache zulässig.

---



# EPIC: GTFS-Import im Netzgrafik-Editor


## Technische Rahmenbedingungen

- Die gesamte Import-, Filter- und Mapping-Logik muss vollständig in TypeScript im Netzgrafik-Editor (Frontend) implementiert werden.
- Es dürfen keine serverseitigen Filter- oder Mapping-Operationen erfolgen – alle Verarbeitungsschritte laufen im Browser.
- Die Filterung der GTFS-Daten muss so performant und speichereffizient wie möglich erfolgen, um auch große Datenmengen (mehrere 100.000 Fahrten) mit minimalem Speicherverbrauch und maximaler Geschwindigkeit zu verarbeiten.
- Es sind effiziente Datenstrukturen (z.B. Maps, Sets, Typed Arrays) und Algorithmen zu verwenden, um unnötige Iterationen und Kopien zu vermeiden.
- Lazy Evaluation und Streaming-Ansätze sind zu bevorzugen, um Speicherbedarf gering zu halten.
- Die UI muss so gestaltet sein, dass Filteroperationen sofortige Rückmeldung geben (keine langen Ladezeiten, keine Blockierung des Haupt-Threads).


## Ziel und Nutzen

Der GTFS-Import ermöglicht es, standardisierte Fahrplandaten (GTFS) automatisiert in Netzgrafiken, Fahrten (Trainruns) und Fahrtenabschnitte (TrainrunSections) zu überführen. Damit werden Planungs-, Analyse- und Visualisierungsprozesse im ÖPNV und SPNV beschleunigt. Der Import bietet umfangreiche Filter, Validierung, Fehlerbehandlung und eine intuitive UI, sodass auch komplexe GTFS-Datensätze effizient verarbeitet werden können.

---


## Features, Stories und Tasks


### Feature 1: GTFS-Datei-Upload und Grundvalidierung


**Story 1.1:** Als Nutzer möchte ich eine GTFS-Datei (ZIP oder Ordner) hochladen, damit ich Fahrplandaten importieren kann.
    - **Task 1.1.1:** UI-Komponente für Datei-Upload implementieren (Drag&Drop, Dateiauswahl)
    - **Task 1.1.2:** Backend-Endpoint für Dateiannahme bereitstellen
    - **Task 1.1.3:** GTFS-Datei auf Vollständigkeit und Lesbarkeit prüfen (alle Pflichtdateien vorhanden?)
    - **Task 1.1.4:** Fehlerhafte oder unvollständige Dateien mit klarer Fehlermeldung ablehnen


**Story 1.2:** Als Nutzer möchte ich eine Vorschau der enthaltenen Agenturen, Linien und Zeiträume sehen, um meine Auswahl zu treffen.
    - **Task 1.2.1:** GTFS-Metadaten (agency, routes, calendar) nach Upload extrahieren
    - **Task 1.2.2:** UI-Dialog zur Anzeige der wichtigsten Metadaten bereitstellen

---


### Feature 2: Filterung und Auswahl der Importdaten


**Story 2.1:** Als Nutzer möchte ich nach Betriebstagen, Agenturen, Linien, Zeiträumen, Frequenzen, Kategorien, Symmetrie/Asymmetrie und One-Way/Round-Trip filtern können.
    - **Task 2.1.1:** Filter-UI für alle genannten Filter implementieren (Checkboxen, Dropdowns, Datumsfelder)
    - **Task 2.1.2:** Filterlogik im Backend implementieren (Trips/Routes nach Filterkriterien einschränken)
    - **Task 2.1.3:** Validierung der Filterkombinationen (z.B. keine Daten bei zu engen Filtern)
    - **Task 2.1.4:** UI-Feedback bei leeren oder widersprüchlichen Filtern


**Story 2.2:** Als Nutzer möchte ich eine Vorschau der gefilterten Fahrten und Abschnitte sehen.
    - **Task 2.2.1:** Nach Anwendung der Filter eine Liste der betroffenen Trips und deren Abschnitte anzeigen
    - **Task 2.2.2:** UI-Komponente für die Vorschau implementieren (inkl. Fahrzeiten, Richtung, Symmetrie)

---


### Feature 3: Mapping und Modell-Erzeugung


**Story 3.1:** Als Entwickler möchte ich, dass jeder Trip zu einem Trainrun und jede Stop-Kombination zu einer TrainrunSection wird.
    - **Task 3.1.1:** Mapping-Logik GTFS → Trainrun/TrainrunSection im Backend implementieren
    - **Task 3.1.2:** Fehlerhafte oder unvollständige Trips/Abschnitte erkennen und markieren
    - **Task 3.1.3:** UI-Feedback für fehlerhafte oder übersprungene Einträge



**Story 3.2:** Als Nutzer möchte ich nachvollziehen können, wie die Frequenz einer Linie berechnet wurde.

*Beschreibung*: 
Der Nutzer soll im Netzgrafik-Editor transparent nachvollziehen können, wie sich die Frequenz (Takt) einer Linie ergibt. Die Frequenz ist ein zentrales Merkmal für die Angebotsdichte und wird im Editor sowohl angezeigt als auch für Filter und Visualisierung verwendet. Die Berechnung und Anzeige der Frequenz muss für den Nutzer verständlich und nachvollziehbar sein. Dabei sind auch Sonderfälle wie unregelmäßige Abstände oder Fahrten über Mitternacht zu berücksichtigen.

  - **Task 3.2.1:** Frequenzberechnung nach spezifizierter Formel in TypeScript (Frontend) implementieren
    - *Was wird gemacht?* 
      Die Frequenz einer Linie wird im Frontend anhand der importierten GTFS-Daten berechnet oder übernommen. Im aktuellen PoC ist dies ein statischer Wert, der im `TrainrunFrequency`-Objekt als Minutenwert hinterlegt ist. Für die finale Lösung kann alternativ eine dynamische Berechnung implementiert werden, bei der die Differenz der Abfahrtszeiten aller Fahrten einer Linie im betrachteten Zeitraum ausgewertet und daraus der durchschnittliche Takt berechnet wird. Die Implementierung erfolgt in TypeScript, sodass die Berechnung direkt im Browser und ohne Backend-Logik stattfindet.

  - **Task 3.2.2:** Frequenz im UI anzeigen, inkl. Tooltip mit Berechnungsgrundlage
    - *Was wird gemacht?* 
      Im User Interface wird die berechnete oder übernommene Frequenz für jede Linie und ggf. für einzelne Fahrten angezeigt. Zusätzlich wird ein Tooltip oder eine Info-Fläche bereitgestellt, die dem Nutzer die Berechnungsgrundlage (z.B. „Takt basiert auf durchschnittlichem Abstand der Abfahrten zwischen 6:00 und 20:00 Uhr“) erläutert. So kann der Nutzer die Herkunft und Aussagekraft des angezeigten Takts nachvollziehen.

  - **Task 3.2.3:** Sonderfälle (unregelmäßige Abstände, Mitternacht, headway) korrekt behandeln
    - *Was wird gemacht?* 
      Die Implementierung muss auch Sonderfälle abdecken, z.B. wenn Fahrten nicht exakt im festen Takt fahren (unregelmäßige Abstände), wenn Fahrten über Mitternacht hinausgehen oder wenn im GTFS explizite Headway-Werte (Mindestabstände) hinterlegt sind. In diesen Fällen wird die Frequenzberechnung angepasst, etwa indem der größte Abstand als Takt verwendet oder ein Hinweis auf die Unregelmäßigkeit angezeigt wird. Ziel ist, dass die Frequenzanzeige immer eine realistische und für den Nutzer verständliche Information liefert.

**Aktuelle Logik im PoC (Stand 2026):**

Im Proof-of-Concept (PoC) wird die Frequenz eines Zuglaufs (`Trainrun`) über das zugehörige `TrainrunFrequency`-Objekt bestimmt. Die Frequenz ist dort als Minutenwert (`frequency: number`) hinterlegt und wird in der Methode `getFrequency()` der Klasse `Trainrun` einfach zurückgegeben. Beispiel (TypeScript):

```typescript
// src/app/models/trainrun.model.ts
getFrequency(): number {
  return this.trainrunFrequency.frequency;
}
```

Die Frequenz ist somit ein statischer Wert, der beim Import oder der Bearbeitung gesetzt wird. Eine dynamische Berechnung (z.B. aus Abfahrtszeiten) findet im aktuellen PoC nicht statt. Für die finale Implementierung ist zu prüfen, ob eine dynamische Berechnung (z.B. aus den tatsächlichen Abfahrtszeiten der Trips) notwendig ist.

**Story 3.3:** Als Nutzer möchte ich erkennen, ob eine Fahrt One-Way, Round-Trip, symmetrisch oder asymmetrisch ist.
  - **Task 3.3.1:** Erkennungslogik für One-Way/Round-Trip und Symmetrie im Backend implementieren
  - **Task 3.3.2:** UI-Visualisierung (Icons, Tags, Tooltips) für diese Attribute

---


### Feature 4: Validierung, Fehlerbehandlung und Logging

**Story 4.1:** Als Nutzer möchte ich Fehler und Konflikte vor dem Import erkennen und beheben können.
  - **Task 4.1.1:** Validierungslogik für GTFS-Daten (Vollständigkeit, Konsistenz, Plausibilität)
  - **Task 4.1.2:** UI-Anzeige aller Fehler, Warnungen und Hinweise
  - **Task 4.1.3:** Option zum Überspringen/Beheben einzelner Fehler

**Story 4.2:** Als Entwickler möchte ich alle Importaktionen und Fehler nachvollziehbar loggen.
  - **Task 4.2.1:** Logging aller Aktionen, Fehler und Warnungen im Backend
  - **Task 4.2.2:** Download/Anzeige der Logs im UI für Entwickler und Nutzer

---


### Feature 5: Undo/Redo und Abschluss des Imports
### Feature 6: Erzeugung und Behandlung von Knoten (Nodes) aus parent_station_name

**Story 6.1:** Als Entwickler möchte ich, dass für jeden in den GTFS-Daten vorkommenden parent_station_name ein eindeutiger Knoten (Node) mit allen relevanten Attributen erzeugt wird.
  - **Task 6.1.1:** Alle parent_station_name aus stop_times.txt und stops.txt extrahieren und eindeutige Knotenliste erzeugen.
  - **Task 6.1.2:** Für jeden Knoten die Koordinaten (lat/lon) aus stops.txt übernehmen. Falls mehrere Stops denselben parent_station_name haben, Mittelwert der Koordinaten berechnen.
  - **Task 6.1.3:** Weitere Attribute wie Name, ID, ggf. Typ (z.B. Bahnhof, Haltestelle) und Referenzen auf zugehörige Stops speichern.
  - **Task 6.1.4:** Die erzeugten Knoten als Node-Objekte im Netzgrafik-Editor bereitstellen und für die Pfad- und Gruppierungslogik verwenden.
  - **Task 6.1.5:** Sicherstellen, dass die Knoten konsistent und eindeutig sind, auch bei Namensvarianten oder Dubletten.

*Beschreibung:*
Im Importprozess werden alle in den GTFS-Daten vorkommenden parent_station_name aus stop_times.txt und stops.txt gesammelt. Für jeden eindeutigen Namen wird ein Node erzeugt. Die Koordinaten werden aus den zugehörigen Stops übernommen; bei mehreren Stops pro parent_station_name wird der Mittelwert gebildet. Jeder Node erhält alle relevanten Attribute (Name, ID, Typ, Referenzen). Diese Nodes bilden die Grundlage für die Pfadlogik, Gruppierung und Visualisierung im Netzgrafik-Editor. Die Eindeutigkeit und Konsistenz der Knoten ist sicherzustellen, insbesondere bei Namensvarianten oder mehrfach vergebenen Namen.

**Story 5.1:** Als Nutzer möchte ich Importaktionen rückgängig machen oder wiederholen können.
  - **Task 5.1.1:** Undo/Redo-Mechanismus für Importaktionen im Frontend implementieren
  - **Task 5.1.2:** UI-Buttons und Statusanzeige für Undo/Redo

**Story 5.2:** Als Nutzer möchte ich nach erfolgreichem Import eine Bestätigung und Zusammenfassung erhalten.
  - **Task 5.2.1:** Abschlussdialog mit Zusammenfassung der importierten Daten
  - **Task 5.2.2:** Option zum Download der Netzgrafik oder zum Start weiterer Aktionen

---

## 3. Filtermöglichkeiten

- **Betriebstage:** Auswahl nach Wochentagen, Feiertagen, spezifischen Datumsbereichen (calendar.txt, calendar_dates.txt)
- **Agenturen:** Auswahl nach agency_id (agencies.txt)
- **Linien:** Auswahl nach route_id, route_short_name, route_long_name (routes.txt)
- **Zeiträume:** Filterung nach Abfahrts-/Ankunftszeiten (stop_times.txt)
- **Frequenzen:** Filterung nach Anzahl Fahrten pro Zeitintervall (z.B. pro Stunde, pro Tag)
- **Kategorien:** Auswahl nach route_type (z.B. Zug, Bus, Tram)
- **Symmetrie/Asymmetrie:** Filterung nach Umlaufstruktur (siehe Abschnitt 7)
- **One-Way/Round-Trip:** Filterung nach Fahrtrichtung und Rückfahrten
- **Weitere:** Filter nach Trip-Attributen (z.B. trip_headsign, direction_id)

---

## 4. Zusammenspiel der GTFS-Daten

- **calendar.txt:** Definiert Regelbetriebstage (z.B. Mo-Fr, Sa, So)
- **calendar_dates.txt:** Ergänzt/überschreibt calendar.txt für Ausnahmen (z.B. Feiertage)
- **trips.txt:** Enthält einzelne Fahrten (trip_id), referenziert route_id, service_id, direction_id
- **routes.txt:** Definiert Linien (route_id), Name, Typ, zugehörige agency_id
- **agencies.txt:** Definiert Verkehrsunternehmen (agency_id)
- **stop_times.txt:** Enthält Reihenfolge und Zeiten der Halte für jede Fahrt (trip_id, stop_id, arrival_time, departure_time)
- **stops.txt:** Definiert Haltestellen (stop_id, Name, Koordinaten)

**Zusammenhang:**
Ein Trip (trips.txt) gehört zu einer Route (routes.txt), wird von einer Agency (agencies.txt) durchgeführt, fährt an bestimmten Tagen (calendar.txt/calendar_dates.txt) und besteht aus einer Sequenz von Stopps (stop_times.txt), die wiederum in stops.txt definiert sind.

---


## 5. Frequenzberechnung (detailliert)

Die Frequenz beschreibt, wie oft eine Fahrt (Trip) auf einer bestimmten Linie (Route) oder einem Abschnitt (TrainrunSection) innerhalb eines definierten Zeitraums stattfindet. Sie ist ein zentrales Maß für die Angebotsdichte im Fahrplan.

### 5.1. Grundformel

\[
	ext{Frequenz} = \frac{\text{Anzahl der Fahrten}}{\text{Zeitspanne (in Stunden)}}
\]

**Begriffe:**
- Anzahl der Fahrten: Alle relevanten Trips im gewählten Zeitraum und Filter.
- Zeitspanne: Differenz zwischen frühester und spätester Abfahrtszeit am Startpunkt.

### 5.2. Schritt-für-Schritt-Berechnung

1. **Trips filtern:**
   - Alle Trips einer Route (und ggf. Richtung, Kategorie, Betriebstag) im gewählten Zeitraum bestimmen.
2. **Abfahrtszeiten extrahieren:**
   - Für jeden Trip die Abfahrtszeit am Start-Stop (stop_times.txt, stop_sequence = 1) ermitteln.
3. **Sortieren:**
   - Abfahrtszeiten aufsteigend sortieren.
4. **Zeitspanne berechnen:**
   - Zeitspanne = späteste Abfahrt - früheste Abfahrt (in Stunden, ggf. über Mitternacht berücksichtigen).
5. **Frequenz berechnen:**
   - Frequenz = Anzahl Trips / Zeitspanne

### 5.3. Sonderfälle und Alternativen

- **Unregelmäßige Abstände:**
  - Wenn die Abstände zwischen den Fahrten stark schwanken, kann zusätzlich der Median oder Modus der Abfahrtsintervalle berechnet werden:
    \[
    	ext{Medianabstand} = \text{Median}(t_{i+1} - t_i)
    \]
  - Die "effektive Frequenz" ist dann der Kehrwert des Medianabstands:
    \[
    	ext{Effektive Frequenz} = \frac{60}{\text{Medianabstand (in Minuten)}}
    \]
- **Über Mitternacht:**
  - Wenn die erste Abfahrt z.B. 23:30 und die letzte 01:00 ist, wird die Zeitspanne als 1,5 Stunden berechnet (24h-Format beachten).
- **Frequenzfahrten (headway):**
  - Falls im GTFS headway-basierte Fahrten (frequencies.txt) vorhanden sind, wird die Frequenz direkt aus dem headway-Wert berechnet:
    \[
    	ext{Frequenz} = \frac{60}{\text{headway (in Minuten)}}
    \]

### 5.4. Beispiele

**Beispiel 1: Regelmäßiger Takt**
- 10 Fahrten zwischen 6:00 und 10:00 Uhr
- Zeitspanne: 4 Stunden
- Frequenz: 10 / 4 = 2,5 Fahrten pro Stunde

**Beispiel 2: Unregelmäßige Abstände**
- Abfahrten: 7:00, 7:10, 7:30, 8:00, 8:30, 9:00
- Abstände: 10, 20, 30, 30, 30 Minuten
- Medianabstand: 30 Minuten
- Effektive Frequenz: 60 / 30 = 2 Fahrten pro Stunde

**Beispiel 3: Über Mitternacht**
- Abfahrten: 23:30, 00:30, 01:00
- Zeitspanne: 1,5 Stunden (23:30 → 01:00)
- Frequenz: 3 / 1,5 = 2 Fahrten pro Stunde

**Beispiel 4: Frequenzfahrten (headway)**
- headway = 15 Minuten
- Frequenz: 60 / 15 = 4 Fahrten pro Stunde

### 5.5. Hinweise zur Implementierung

- Alle Zeitangaben müssen in Minuten oder Sekunden seit Mitternacht umgerechnet werden, um Differenzen korrekt zu berechnen.
- Bei Zeitspannen über Mitternacht: Wenn späteste Abfahrt < früheste Abfahrt, dann Zeitspanne = (24*60 - früheste) + späteste (in Minuten).
- Bei sehr wenigen Fahrten (z.B. nur 1), Frequenz als "n/a" oder 0 ausgeben.
- Frequenz immer im UI anzeigen, ggf. mit Tooltip zur Berechnungsgrundlage.

---

## 6. Mapping: GTFS → Trainrun und TrainrunSection

### 6.1. Trainrun

- **Entstehung:** Jeder Trip (trips.txt) wird zu einem Trainrun.
- **Attribute:**
  - `id`: trip_id
  - `route`: route_id (mit Name aus routes.txt)
  - `agency`: agency_id
  - `service_days`: aus calendar.txt/calendar_dates.txt
  - `direction`: direction_id
  - `headsign`: trip_headsign
  - `category`: route_type
  - `frequency`: berechnet (siehe oben)
  - `symmetry`: berechnet (siehe unten)
  - `one_way`: berechnet (siehe unten)

### 6.2. TrainrunSection

- **Entstehung:** Jede aufeinanderfolgende Stop-Kombination eines Trips wird zu einer TrainrunSection.
- **Attribute:**
  - `from_stop`: stop_id (Name, Koordinaten aus stops.txt)
  - `to_stop`: stop_id
  - `departure_time`: stop_times.txt
  - `arrival_time`: stop_times.txt
  - `sequence`: stop_sequence
  - `distance`: optional, falls in stops.txt verfügbar

### 6.3. Regeln und Sonderfälle

- **Fehlende Stopps:** Trip wird übersprungen oder als fehlerhaft markiert.
- **Unvollständige Zeiten:** Abschnitt wird als unvollständig markiert, UI-Feedback.
- **Doppelte Trips:** Zusammenfassen oder als separate Trainruns importieren (je nach User-Option).

---

## 7. One-Way und Round-Trip

- **Erkennung:**  
  - `direction_id` in trips.txt (0 = Hin, 1 = Rückfahrt)
  - Round-Trip: Trip-Paare mit identischer Route, aber entgegengesetzter Richtung und passenden Zeiten.
- **Verarbeitung:**  
  - Im UI als zusammengehörige Fahrten anzeigen.
  - Im Modell als verknüpfte Trainruns speichern.

---

## 8. Symmetrie und Asymmetrie

- **Symmetrisch:** Hin- und Rückfahrt verlaufen auf identischer Strecke mit spiegelbildlichen Zeiten.
- **Asymmetrisch:** Unterschiede in Strecke oder Zeiten.
- **Erkennung:**  
  - Vergleich der Stop-Sequenzen und Zeitabstände zwischen Hin- und Rückfahrt.
- **UI:**  
  - Symmetrische Fahrten mit Symbol/Tag kennzeichnen.
  - Asymmetrische Fahrten gesondert markieren.

---

## 9. Tasks und Issues für die Umsetzung

### 9.1. Backend

- GTFS-Parser für alle relevanten Dateien
- Validierung und Fehlerbehandlung
- Mapping-Logik (GTFS → Modell)
- Frequenzberechnung
- API-Endpunkte für Import, Vorschau, Validierung, Logging

### 9.2. Frontend

- Upload-Komponente für GTFS-Dateien
- Filter-UI für alle genannten Filter
- Vorschau- und Validierungsansicht
- UI für Frequenz, Symmetrie, One-Way/Round-Trip
- Fehler- und Konfliktanzeige
- Undo/Redo für Importaktionen

### 9.3. Tests

- Unit-Tests für Parser, Mapping, Frequenzberechnung
- Integrationstests für End-to-End-Import
- UI-Tests für Filter, Vorschau, Fehleranzeige

### 9.4. UI/UX

- Intuitive Filter- und Vorschau-Workflows
- Barrierefreiheit und Responsivität
- Hilfetexte und Tooltips

---

## 10. Fehlerquellen, Validierung, Logging, UI-Feedback

- **Fehlerquellen:**
  - Inkonsistente oder fehlende Daten in GTFS
  - Zeitüberschneidungen, Lücken, fehlerhafte Stop-Sequenzen
  - Nicht unterstützte GTFS-Features (z.B. Frequenzfahrten, shapes.txt)
- **Validierung:**  
  - Vor dem Import: Vollständigkeit, Konsistenz, Plausibilität
  - Nach dem Import: Mapping- und Modellintegrität
- **Logging:**  
  - Alle Importaktionen, Fehler, Warnungen
  - Detaillierte Logs für Entwickler und Nutzer
- **UI-Feedback:**  
  - Klare Fehlermeldungen, Warnungen, Hinweise
  - Fortschrittsanzeige beim Import
  - Undo/Redo-Optionen

---

## 11. Weitere Hinweise und Beispiele

### 11.1. Beispiel: Frequenzberechnung

- 6 Fahrten zwischen 7:00 und 9:00 Uhr → Frequenz: 3 Fahrten/Stunde
- Unregelmäßige Abstände: 7:00, 7:10, 7:30, 8:00, 8:30, 9:00 → Medianabstand: 20 Minuten

### 11.2. Beispiel: Mapping

- Trip 12345 (route_id: 10, direction_id: 0) mit Stopps A-B-C-D → Trainrun mit 3 TrainrunSections (A-B, B-C, C-D)
- Rückfahrt (direction_id: 1) mit Stopps D-C-B-A → als Round-Trip erkannt, Symmetrieprüfung ergibt symmetrisch

---

## 12. Zusammenfassung

Das GTFS-Import-Feature des Netzgrafik-Editors bietet eine umfassende, flexible und validierte Möglichkeit, Fahrplandaten aus GTFS-Feeds in Netzgrafiken zu überführen. Die Umsetzung umfasst Backend, Frontend, Tests und UI/UX und stellt sicher, dass alle relevanten Filter, Mappings und Validierungen abgedeckt sind. Das Entwicklerteam kann auf Basis dieses Dokuments die Implementierung ohne Rückfragen starten.
