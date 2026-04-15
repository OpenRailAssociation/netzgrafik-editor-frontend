
# GTFS-Import im Netzgrafik-Editor – Verbindliche Anforderung und Ablauf

## 1. Ziel, Nutzen und technische Rahmenbedingungen

- Die gesamte Import-, Filter- und Mapping-Logik wird vollständig in TypeScript im Netzgrafik-Editor (Frontend) implementiert.
- Keine serverseitigen Filter- oder Mapping-Operationen – alle Verarbeitungsschritte laufen im Browser.
- Die Filterung der GTFS-Daten muss performant und speichereffizient erfolgen, auch für große Datenmengen (mehrere 100.000 Fahrten).
- Effiziente Datenstrukturen (Maps, Sets, Typed Arrays) und Algorithmen sind zu verwenden, unnötige Iterationen und Kopien zu vermeiden.
- Lazy Evaluation und Streaming-Ansätze sind zu bevorzugen.
- Die UI muss so gestaltet sein, dass Filteroperationen sofortige Rückmeldung geben (keine langen Ladezeiten, keine Blockierung des Haupt-Threads).

## 2. Verbindlicher Ablauf und UI-/Filterlogik

1. **Daten laden und entpacken:**
   - Die GTFS-Daten werden als ZIP geladen und entpackt.
   - Direkt nach dem Entpacken werden alle Agency (Unternehmen) extrahiert.
   - Für die Filterung wird ein Mehrfachauswahl-Autocomplete-Chip-Input verwendet (UI-Element von angular.sbb.ch). Der Nutzer sieht alle Agency als auswählbare Chips.

2. **Routen- und Routenbeschreibung-Filter:**
   - Alle `route_type` werden extrahiert und als Chip-Filter angeboten (wie oben, angular.sbb.ch).
   - Alle `route_desc` (sofern vorhanden) werden ebenfalls als Chip-Filter angeboten.
   - Zusätzlich wird der Routenname (`route_name`) als dritter Chip-Filter bereitgestellt.
   - Es gibt somit drei unabhängige Chip-Autocomplete-Filter (agency, route_type, route_desc/route_name), alle mit angular.sbb.ch UI-Komponenten.

3. **Verkehrstyp-Filter:**
   - Verkehrstypen wie Bahn, Tram etc. werden als Checkboxen dargestellt.
   - Die Default-Auswahl und die Extraktion der Typen sind exakt wie im Proof-of-Concept umzusetzen und zu dokumentieren. Die Default-Auswahl entspricht dem PoC.

4. **Betriebstag und Datumsbereich:**
   - Ganz oben im UI wird der Betriebstag (relevanter Tag) ausgewählt.
   - Auf derselben Zeile wird angezeigt, von wann bis wann Daten im Import vorliegen (Datumsbereich aus calendar extrahieren).


5. **Filterpipeline beim Import:**
  - Nach dem Import werden zuerst alle Agency gemäß Filter ausgewählt.
  - Danach werden nur Routen weiterverarbeitet, die zu einer gefilterten Agency gehören und die gesetzten Routen-Filter (route_type, route_desc, route_name) erfüllen.
  - Im Anschluss werden nur Trips weiterverarbeitet, die zu einer der gefilterten Routen gehören und am gewählten Betriebstag verkehren (gültig gem. GTFS-Spezifikation).
  - Trips, die keiner gültigen Route zugeordnet sind, werden ausgeschlossen.
  - Nur diese gefilterten Daten (Agency, Route, Trip) werden für die weitere Verarbeitung (Gruppierung, Mapping etc.) verwendet.

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
   - Falls nicht, wird die Minute genommen, die am häufigsten vorkommt pro Ort (parent_station_name) und daraus der Master-Forward- und -Backward-Path mit minimalen Abfahrts- und Ankunftszeiten erstellt.
   - Die Deltas werden als Fahrzeit berechnet.
   - Es wird versucht, Forward- und Backward-Zeiten symmetrisch zu machen (Summe aus Ankunft Forward + Abfahrt Backward = 60 → symmetrisch, sonst nicht).
   - Sind alle Zeiten symmetrisch, wird ein Round-Trip erstellt, sonst One-Way.
   - Round-Trips werden zu einer Linie mit Standard-Netzgrafik-Trainrun und TrainrunSection transformiert, sonst One-Way.

9. **Symmetrie und Toleranz:**
   - Für die Symmetrie-Bestimmung ist eine Toleranz (z.B. 180s/3min) zu berücksichtigen. Diese Toleranz kann und soll der Nutzer einstellen können.
   - Symmetrie gilt als gegeben, wenn die Zeitdifferenzen innerhalb der Toleranz liegen.

10. **Beispiel für die Logik:**
   - Am Betriebstag X (gültig gem. GTFS) gibt es eine Zug-Agency SBB mit route_id=1 und Trips:
     - B - C - D | Abfahrt um 04:50 in B
     - A - B - C - D | Abfahrt um 05:20 in A, 06:20 in A, ... 22:20 in A
     - A - B - C | Abfahrt um 23:30 in A
   - Züge enden oder starten nicht immer am gleichen Ort. Hier ergibt sich ein Stundentakt, da das Delta 60 ist.
   - Beispiel 2: Ein Zug fährt in X um 04:53, 05:20, 05:52, 06:21, 06:32 ... Es braucht eine Symmetrie- und Toleranzprüfung. Hier ergibt sich 30min, da alles innerhalb der Toleranz (180s/3min) ist.

Alle Schritte und UI-Elemente sind exakt wie beschrieben umzusetzen. Die Filterlogik, Gruppierung, Frequenz- und Symmetrie-Berechnung sowie die Beispiele sind verbindlich. Abweichungen sind nur nach expliziter Rücksprache zulässig.

## 3. Mapping, Fehlerquellen, Tests, Zusammenfassung

### Mapping: GTFS → Trainrun und TrainrunSection
...existing code...

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


### 5.4. Beispiele (korrekt)

**Beispiel 1: Regelmäßiger Takt**
- Abfahrten: 6:00, 7:00, 8:00, 9:00, 10:00
- Zeitspanne: 4 Stunden (6:00 bis 10:00)
- Anzahl Fahrten: 5
- Takt: 60 Minuten

**Beispiel 2: Unregelmäßige Abstände**
- Abfahrten: 7:01, 7:30, 7:59, 8:30, 8:58, 9:30
- Abstände: 29, 29, 31, 28, 32 Minuten - Toleranz 2 
- Also alles i.O. da Abstände [28,32] -> Takt 30 - 2x pro Stunde

**Hinweis:**
Headway-basierte Fahrten (frequencies.txt) werden im GTFS als Mindestabstand (headway_secs) angegeben. Die tatsächliche Frequenz ergibt sich aus der Anzahl der Fahrten pro Zeitspanne, nicht direkt aus dem Headway-Wert. Die Berechnung muss immer auf den realen Abfahrtszeiten basieren.

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



...existing code...


## Verbindliche Ablaufbeschreibung und UI-/Filterlogik (exakte Umsetzungsvorgabe)

1. **Daten laden und entpacken:**
  - Die GTFS-Daten werden als ZIP geladen und entpackt.
  - Direkt nach dem Entpacken werden alle Agency (Unternehmen) extrahiert.
  - Für die Filterung wird ein Mehrfachauswahl-Autocomplete-Chip-Input verwendet (UI-Element von angular.sbb.ch). Der Nutzer sieht alle Agency als auswählbare Chips.

2. **Routen- und Routenbeschreibung-Filter:**
  - Alle `route_type` werden extrahiert und als Chip-Filter angeboten (wie oben, angular.sbb.ch).
  - Alle `route_desc` (sofern vorhanden) werden ebenfalls als Chip-Filter angeboten.
  - Zusätzlich wird der Routenname (`route_name`) als dritter Chip-Filter bereitgestellt.
  - Es gibt somit drei unabhängige Chip-Autocomplete-Filter (agency, route_type, route_desc/route_name), alle mit angular.sbb.ch UI-Komponenten.

3. **Verkehrstyp-Filter:**
  - Verkehrstypen wie Bahn, Tram etc. werden als Checkboxen dargestellt.
  - Die Default-Auswahl und die Extraktion der Typen sind exakt wie im Proof-of-Concept umzusetzen und zu dokumentieren. Die Default-Auswahl entspricht dem PoC.

4. **Betriebstag und Datumsbereich:**
  - Ganz oben im UI wird der Betriebstag (relevanter Tag) ausgewählt.
  - Auf derselben Zeile wird angezeigt, von wann bis wann Daten im Import vorliegen (Datumsbereich aus calendar extrahieren).

5. **Filterpipeline beim Import:**
  - Nach dem Import werden zuerst alle Agency gemäß Filter ausgewählt.
  - Danach werden alle Routen gemäß den gesetzten Filtern gefiltert.
  - Im Anschluss werden alle Trips gefiltert, die am gewählten Betriebstag verkehren (gültig gem. GTFS-Spezifikation).
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
  - Falls nicht, wird die Minute genommen, die am häufigsten vorkommt pro Ort (parent_station_name) und daraus der Master-Forward- und -Backward-Path mit minimalen Abfahrts- und Ankunftszeiten erstellt.
  - Die Deltas werden als Fahrzeit berechnet.
  - Es wird versucht, Forward- und Backward-Zeiten symmetrisch zu machen (Summe aus Ankunft Forward + Abfahrt Backward = 60 → symmetrisch, sonst nicht).
  - Sind alle Zeiten symmetrisch, wird ein Round-Trip erstellt, sonst One-Way.
  - Round-Trips werden zu einer Linie mit Standard-Netzgrafik-Trainrun und TrainrunSection transformiert, sonst One-Way.

9. **Symmetrie und Toleranz:**
  - Für die Symmetrie-Bestimmung ist eine Toleranz (z.B. 180s/3min) zu berücksichtigen. Diese Toleranz kann und soll der Nutzer einstellen können.
  - Symmetrie gilt als gegeben, wenn die Zeitdifferenzen innerhalb der Toleranz liegen.

10. **Beispiel für die Logik:**
  - Am Betriebstag X (gültig gem. GTFS) gibt es eine Zug-Agency SBB mit route_id=1 und Trips:
    - B - C - D | Abfahrt um 04:50 in B
    - A - B - C - D | Abfahrt um 05:20 in A, 06:20 in A, ... 22:20 in A
    - A - B - C | Abfahrt um 23:30 in A
  - Züge enden oder starten nicht immer am gleichen Ort. Hier ergibt sich ein Stundentakt, da das Delta 60 ist.
  - Beispiel 2: Ein Zug fährt in X um 04:53, 05:20, 05:52, 06:21, 06:32 ... Es braucht eine Symmetrie- und Toleranzprüfung. Hier ergibt sich 30min, da alles innerhalb der Toleranz (180s/3min) ist.

Alle Schritte und UI-Elemente sind exakt wie beschrieben umzusetzen. Die Filterlogik, Gruppierung, Frequenz- und Symmetrie-Berechnung sowie die Beispiele sind verbindlich. Abweichungen sind nur nach expliziter Rücksprache zulässig.

---