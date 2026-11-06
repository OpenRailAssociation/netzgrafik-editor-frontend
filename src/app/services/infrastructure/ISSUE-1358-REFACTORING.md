# Refactoring: Track Estimator und Node Occupier von der Streckengrafik entkoppeln

## Kurzüberblick für den Reviewer

Als Maintainer und langjähriger Contributor möchte ich im Auftrag der SBB
die Infrastruktur- und Knotengleisschätzung von der Darstellung entkoppeln.

**Wichtige Ausgangslage:** Die betroffenen Berechnungen und Darstellungen
waren auf `main` nur sehr schwach getestet. Die neue Lösung enthält massiv
mehr automatisierte Tests, insbesondere für die Schätzlogik, ihre Integration
und bekannte Fehler- und Randfälle. Das Refactoring verbessert damit nicht
nur die Architektur, sondern auch die Absicherung des fachlichen Verhaltens.

| | Auftrag |
|---|---|
| **Ziel** | Den Gleisbedarf auf gerichteten Streckenabschnitten und die Gleisbelegung an Knoten aus den fachlichen Netzgrafik-Daten berechnen. |
| **Kernanforderung** | Die Schätzung hängt ausschliesslich von den übergebenen Daten und Berechnungsoptionen ab, nicht vom Zustand einer Ansicht oder anderer visueller Elemente. Gleiche Eingaben und Optionen liefern dieselben Ergebnisse. |
| **Verwendung** | Streckengrafik und Knotenauslastung nutzen gemeinsame Schätzergebnisse; Zuordnung, Projektion und Darstellung bleiben bei den jeweiligen Konsumenten. |
| **Nutzen** | Die wiederverwendbare Berechnung bereitet Variantenvergleiche, Analysen und Optimierungsverfahren vor. Diese Funktionen selbst sind nicht Teil dieses Refactorings. |
| **Vorgehen** | Vom aktuellen `main` zum dokumentierten Zielstand migrieren, in fachlich abgegrenzten und einzeln reviewbaren Schritten. |

**Ausgang und Ziel:** Ausgangspunkt ist der aktuelle `main`. Sollzustand ist
`aeg/refactoring_streckengrafik_complete` auf Commit
`b0311411c329da055a5560090629d45f749e833f`. Die acht Commits zwischen dem
gemeinsamen Ausgangspunkt und diesem Zielstand sind die historische
Änderungsreihe. Bei der Prüfung am 4. November 2026 lag `main` 55 Commits vor
diesem gemeinsamen Ausgangspunkt. Die alten Commits deshalb nicht direkt als
PR-Branches gegen den aktuellen `main` öffnen: Ihre Änderungen müssen auf aktuellem
`main` neu aufgebaut werden; dabei bleiben alle zwischenzeitlichen,
fachfremden Änderungen erhalten.

**Empfehlung zu Issues und PRs:** Ein Parent-Issue (#1358) bündelt das Ziel.
Die vorhandenen acht Commits können in ihrer Reihenfolge als Ausgangspunkt
für einen gestapelten Review dienen; sie müssen nicht zuerst in eine neue
Commit-Reihenfolge umgeschrieben werden. Ein Sub-Issue pro Commit ist nicht
nötig. Falls jeder Commit einen eigenen Stack-PR erhält, baut der erste
Branch auf `main` auf und jeder weitere auf dem vorherigen Stack-Schritt.
Erst wenn der ganze Stack reviewed ist, werden seine PRs in
Abhängigkeitsreihenfolge nach `main` integriert – nach dem gewünschten
Grundprinzip des
[Stack-Beispiels #1328](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/stack/1328).
Die fachlichen Sub-Issues 1–6 in Abschnitt 6 können zur Zuordnung von Tests
und Verantwortlichkeiten dienen, müssen aber nicht jeweils einem PR
entsprechen. Baseline-Erfassung und finale Gesamtregression bleiben
Review-Gates im Parent-Issue.

**Leseführung:** Abschnitt 2 ist der kopierbare Text zur Aktualisierung des
bestehenden Parent-Issues #1358. Abschnitt 6 enthält sechs
Sub-Issue-Beschreibungen, die in GitHub angelegt und mit #1358 verknüpft
werden können. Abschnitt 12 ist der konkrete Vorschlag für acht gestapelte
PRs, ihre Branches, Basen und Zuordnung zu den Sub-Issues. Abschnitte 3–7
beschreiben zusätzlich Architektur, Abhängigkeiten und Regeln; Abschnitte
8–11 enthalten konkrete Testbelege. Die übrigen Abschnitte und Anhänge
dokumentieren Commit-Historie, Fehlerfälle, Referenzen und Excel-Abgleich.

### GitHub-Einrichtung auf einen Blick

1. **Bestehendes Parent-Issue #1358 aktualisieren**, nicht duplizieren. Als
   Beschreibung dient der kopierbare Entwurf in Abschnitt 2.
2. **Status von PR #1379 prüfen.** Vor dem Anlegen neuer Stack-PRs
   sicherstellen, dass dadurch keine bereits aktive PR-Arbeit dupliziert
   wird. PR #1379 und der Referenzbranch bleiben die fachliche Quelle; ob ein
   bestehender PR geschlossen, ersetzt oder als Referenz belassen wird, muss
   anhand seines aktuellen GitHub-Status entschieden werden.
3. **Sechs Sub-Issues** mit den Titeln und Beschreibungen in Abschnitt 6
   anlegen. Jeden Sub-Issue mit #1358 verknüpfen; die Abhängigkeiten aus
   Abschnitt 5 als Issues-Beziehungen oder Checkliste erfassen.
4. **Acht PRs als Stack vorbereiten**, entsprechend der Tabelle in
   Abschnitt 12. Der erste PR hat `main` als Base; jeder folgende PR hat den
   vorherigen Stack-PR als Base. Mehrere PRs können dasselbe Sub-Issue
   umsetzen; ein Sub-Issue pro Commit wird nicht benötigt.
5. **Änderungen auf aktuellem `main` neu aufbauen.** Die acht historischen
   Commits liegen auf einem Stand, dessen Merge-Base 55 Commits hinter
   aktuellem `main` liegt. Vor dem Erstellen der PRs die Änderungen daher
   schrittweise übertragen und Konflikte so lösen, dass spätere
   `main`-Änderungen erhalten bleiben.
6. **Den gesamten Stack reviewen, dann integrieren.** PRs während der
   Review-Phase nicht nach `main` mergen. Nach Freigabe den Basis-PR zuerst
   integrieren und die folgenden PRs nacheinander in Abhängigkeitsreihenfolge
   nachziehen; alternativ den vollständig geprüften Stack über den im
   Repository unterstützten Stack-Merge integrieren.

Die Baseline-Erfassung vor der Umsetzung und die Gesamtregression vor dem
Merge sind Review-Gates im Parent-Issue, keine zusätzlichen Sub-Issues.

### Berechnungsverträge

Für eine gerichtete Kante `Node A → Node B` erhält der Estimator die beiden Knoten sowie die zugehörigen `TrainrunSection`s einschliesslich ihrer Trainrun-Daten und liefert typisierte `TrackSegmentEstimate`s zurück. Jedes Segment beschreibt mit normalisierten Positionen `start` und `end` im Intervall `[0,1]`, wie viele parallele Gleise dort benötigt werden. Die Gegenrichtung ist eine separate Schätzung und kann ein anderes Ergebnis haben.

Für einen Knoten erhält der Estimator den Knoten, die ihn besuchenden `TrainrunSection`s und optionale Berechnungsfenster- und Richtungsoptionen. Er liefert `NodeTrackEstimate`s mit Gleisnummern und periodischen `NodeTrackOccupancy`s zurück. Jede Belegung enthält Ankunft, Abfahrt, Ende der Headway-Sperrzeit, Trainrun-ID, Occurrence-Index und Richtung; passende Abschnitts- und Übergangsbezüge werden mitgeführt, soweit vorhanden.

----
- **Ground Truth / gewünschtes Ergebnis:** `aeg/refactoring_streckengrafik_complete`
- **Referenz-Commit:** `b0311411c329da055a5560090629d45f749e833f`
- **Gemeinsamer Ausgangspunkt des gemessenen Diffs:** `54edce2f1c6a23d68d2293ce06508fd3bdab34fd` (Merge-Base von `main` und Referenzbranch)
- **Ausgangspunkt für eine Neuimplementierung:** `main`
- **GitHub-Kontext:** [Issue #1358](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1358), [PR #1379](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/pull/1379)

> **Wichtig:** `main` ist die laufende Ausgangsbasis, war in den betroffenen
> Bereichen aber nur sehr schwach getestet.
> `aeg/refactoring_streckengrafik_complete` ist das gewünschte Zielbild und
> enthält eine deutlich umfangreichere automatisierte Testbasis.
> Während des Refactorings wurden in `main` vorhandene Fehler sichtbar und im
> Zielbranch gezielt behoben. Die Migration soll deshalb nicht jeden
> `main`-Output unverändert bewahren: Sie soll das Refactoring-Ziel **und die
> darin enthaltenen Bugfixes** schrittweise übernehmen. Die Excel-Datei liegt
> nicht mehr vor; der bereitgestellte Tabellenauszug ist in Anhang B
> festgehalten und den verfügbaren Tests gegenübergestellt. Verbindliche
> Referenzen für bestätigte Testerwartungen sind Zielbranch-Code, Fixtures
> und Tests. Neuere, nicht zum
> Refactoring gehörende Änderungen in `main` bleiben dabei erhalten; sie
> dürfen nicht durch ein blindes Zurücksetzen auf den älteren Referenzstand
> verloren gehen.

## 1. Mein Auftrag – gewünschter Umfang

Ich möchte mit dem Refactoring die folgenden Ergebnisse erreichen:

| Bereich | Gewünschtes Ergebnis |
|---|---|
| Gemeinsame Berechnung | Zustandslose Schätzungen für gerichtete Streckensegmente und periodische Knotengleisbelegungen. Gleiche fachliche Eingaben und Optionen liefern unabhängig von Datenquelle und visuellem Zustand dieselben Ergebnisse. Das ermöglicht später Variantenvergleich, Analysen und Optimierungsmethoden. |
| Verbraucher | Streckengrafik und Knotenauslastung verwenden dieselben Schätzergebnisse statt paralleler Schätzlogik. |
| Darstellung | Reservierungen, Headways und Transit-Verbindungen korrekt darstellen, einschliesslich One-way- und Teilpfadfällen. |
| Absicherung und Bereinigung | Zielverhalten und PR-Fehlerfälle testen; überholte Berechnungs- und Modelllogik nach der Integration entfernen und bestehendes Verhalten erhalten. |

Die Commit-Tabelle dokumentiert die historische Umsetzung. Ihre Reihenfolge
ist ein sinnvoller Ausgangspunkt für den vorgeschlagenen Review-Stack, aber
keine Pflicht, jeden Commit unverändert als eigenen PR zu übernehmen. Die
Abschnitte 4–6 strukturieren das Zielbild zusätzlich nach fachlichen
Abhängigkeiten und Review-Verantwortlichkeiten.

### Verbindliche Regel zur Delta-Rekonstruktion

Für jeden Subtask wird zuerst festgestellt, welche relevanten Dateien,
Verantwortlichkeiten, Datenverträge und Tests zwischen `main`-Baseline und
Zielbranch geändert wurden. Genau diese Änderung wird spezifiziert und
implementiert. Der Endzustand des Zielbranchs und dessen konkrete Assertions
entscheiden bei Mehrdeutigkeit; Issue-Text, Commit-Namen oder allgemeine
Refactoring-Ideen ersetzen diese Prüfung nicht.

`main` ist die Arbeitsbasis, der Zielbranch die Sollfassung. Da `main` seit
dem gemeinsamen Ausgangspunkt weitere Änderungen enthalten kann, bedeutet
„Delta zu `main`“ nicht, spätere, fachfremde `main`-Änderungen zu löschen.
Vor der Umsetzung werden Zielbranch-Änderungen gegen die gemeinsame Basis
rekonstruiert und auf die aktuelle `main`-Basis übertragen; notwendige
Konfliktauflösungen erhalten die aktuelle `main`-Funktionalität und stellen
gleichzeitig das Zielbranch-Verhalten für den Refactoring-Umfang her.

Jede nachfolgende Sub-Issue-Spezifikation muss daher konkrete
`main`-Ausgangsstellen, Zielbranch-Endstellen und das zu reproduzierende Delta
benennen. Tests belegen dieses Delta. Zusätzliche Tests dürfen Lücken bei der
Absicherung des dokumentierten Zielverhaltens schliessen, erzeugen aber keine
neuen fachlichen Anforderungen. Zusätzliche Funktionalität oder weiteres
Cleanup ist separat als Vorschlag zu kennzeichnen und nicht Teil des
`main`→Zielbranch-Umfangs, solange es nicht im Zielbranch umgesetzt ist.

## 2. Rekonstruiertes GitHub Parent Issue – Entwurf zum Kopieren

# Vereinheitliche Gleisschätzungen und Knotenauslastung in der Streckengrafik

## Ziel

Die Schätzung der benötigten Streckengleise und Knotengleisbelegung wird aus
den Streckengrafik-Konsumenten entkoppelt und als zustandslose,
wiederverwendbare Berechnung auf nativen Netzgrafik-Domainmodellen
bereitgestellt. Für eine gerichtete Kante `Node A → Node B` werden Knoten und
zugehörige `TrainrunSection`s übergeben; das Ergebnis ist eine typisierte
Liste normalisierter Streckensegmente `[start, end, tracks]` mit Positionen
im Bereich `[0,1]`. Für einen Knoten werden Knoten, besuchende Abschnitte und
optionale Zeitfenster-/Richtungsoptionen übergeben; das Ergebnis enthält
Gleiszuweisungen und Zugbelegungen mit Ankunft, Abfahrt und Ende der
Headway-Sperrzeit. Gleiches fachliches Input liefert unabhängig von
Streckengrafik- oder View-Zustand dieselbe Schätzung.

Streckengrafik und Knotenauslastungsansicht konsumieren die gemeinsame
Schätzung; Korridor-/Reservierungszuordnung, Stundenprojektion und Darstellung
bleiben Aufgaben der jeweiligen Integrations- und View-Schichten. Die
konkrete Service-Aufteilung folgt zunächst dem Referenzbranch; eine andere
Aufteilung oder Vereinfachung ist ein nachgelagerter
Refactoring-Vorschlag.

Das gewünschte Ergebnis ist im Referenzbranch
`aeg/refactoring_streckengrafik_complete` (Commit
`b0311411c329da055a5560090629d45f749e833f`) umgesetzt. Dieser Branch ist die
fachliche Ground Truth für die Neuimplementierung. `main` ist der
Ausgangspunkt. Die Umsetzung soll anhand der sechs fachlichen Sub-Issues und
des vorgeschlagenen Review-Stacks in Abschnitt 12 geprüft werden.

## Review- und Integrationsplan

Die acht Commits des Referenzbranches dienen als Ausgangspunkt für acht
gestapelte Review-Schritte, nicht als direkt gegen den aktuellen `main`
einzureichende Branches. Die Änderungen werden auf aktuellem `main`
schrittweise neu aufgebaut; spätere, fachfremde Änderungen auf `main`
bleiben erhalten. Das Parent-Issue wird mit den sechs fachlichen Sub-Issues
verknüpft. Ein eigenes Issue pro Commit ist nicht erforderlich.

Alle Stack-PRs werden zunächst reviewed. Erst wenn die gesamte Änderung
freigegeben und die Gesamtregression erfolgreich ist, werden die PRs in
Abhängigkeitsreihenfolge nach `main` integriert. Die einzelnen PRs und ihre
Base-Branches sind in Abschnitt 12 aufgeführt.

## SDD-Spezifikation des Parent-Issues

- **Umfang und Ziel:** Das Refactoring extrahiert die Strecken- und
  Knotengleisschätzung aus den bisherigen Konsumenten, integriert die
  Ergebnisse in Streckengrafik und Knotenauslastungsansicht und entfernt
  dadurch überholte doppelte Berechnungs- und Modelllogik.
- **Datenvertrag:** `estimateSectionTracks(fromNode, toNode,
  trainrunSections, ...)` liefert `TrackSegmentEstimate[]` mit normalisierten
  `start`-/`end`-Positionen und `tracks`. `estimateNodeTracks(node,
  trainrunSections, options)` liefert `NodeTrackEstimate[]`; jede Schätzung
  enthält eine Track-Nummer und periodische `NodeTrackOccupancy`s mit
  Ankunft, Abfahrt, `headwayUntilMinute`, Trainrun-/Occurrence-Bezug und
  Richtung. Die Abschnitte enthalten die zugehörigen Trainrun-Daten und werden
  dem Aufruf explizit übergeben. Beide Berechnungen sind zustandslos; die
  konkreten Typen und Assertions des Referenzbranches sind massgeblich.
- **Regeln und Randfälle:** Fahrtrichtung und One-way-Fahrten, Frequenz,
  Fahrzeit, Headway, periodische Fenster, Turnaround, sichtbare Filter,
  Knotenreservierungen, Projektion auf Stundenfenster und Rendering richten
  sich nach Referenzimplementierung und den hier aufgeführten Bugfällen.
- **Referenz und Beleg:** Ground Truth ist
  `aeg/refactoring_streckengrafik_complete` auf Commit
  `b0311411c329da055a5560090629d45f749e833f`; relevante Tests und Fixtures
  sind in Abschnitt 13 sowie in den Testfallkatalogen 8–11 aufgeführt. Die
  PR-/Issue-Reproduktionen sind in Abschnitt 2 verlinkt.
- **Delta-Regel:** Pro Arbeitspaket zeigen die konkreten Änderungen zwischen
  der relevanten `main`-Baseline und dem Zielbranch, was zu implementieren
  ist. Die Arbeit startet auf aktuellem `main`; nicht zum Refactoring
  gehörende spätere `main`-Änderungen werden erhalten.
- **Nicht-Ziele und Abhängigkeiten:** Keine zusätzlichen fachlichen
  Verhaltensänderungen ausserhalb des Referenzumfangs. Änderungen an
  Konsumenten bauen auf den zustandslosen Schätzergebnissen auf; die
  technische Reihenfolge ist in Abschnitt 5 beschrieben. Service-Aufteilung,
  weitere Codevereinfachung und zusätzliche Cleanup-Ideen werden getrennt
  vorgeschlagen statt stillschweigend in das Delta aufgenommen.
- **Abnahme:** Beide Berechnungen liefern reproduzierbare Ergebnisse für die
  spezifizierten Domain-Eingaben; Streckengrafik und Knotenauslastung
  verwenden diese Ergebnisse; alle relevanten Referenzverhalten und die
  PR-Fehlerfälle sind testbar belegt; finale Tests, Lint und Builds bestehen.

## TDD-Testplan des Parent-Issues

Die folgenden Tests prüfen das im Zielbranch vorhandene Sollverhalten und
dessen Delta gegenüber `main`. Sub-Issues weisen jeweils ihre Teilmenge aus;
das abschliessende Review-Gate führt die Gesamtregression aus. Wo die
vorhandenen Zielbranch-Tests das dokumentierte Verhalten nicht direkt abdecken, werden Tests zur
Absicherung dieses Verhaltens ergänzt; dies erweitert nicht den fachlichen
Umfang.

| Muss getestet werden | Testnachweis |
|---|---|
| Zustandslose Streckenschätzung für eine gerichtete Kante mit konkreten Segmentgrenzen und Track-Anzahl. | Estimator-Unit-Tests; Zielbranch-Fälle aus Abschnitt 8. |
| Zustandslose Knotenschätzung mit konkreten Occupancies, Headways und kollisionsfreien Gleiszuweisungen. | Estimator-Unit-Tests; Zielbranch-Fälle aus Abschnitt 9. |
| Ergebnisse werden in Streckengrafik-Modelle/Reservierungen übertragen und korrekt gerendert. | Service-Integration und Komponenten-SVG-Tests; Zielbranch-Fälle aus Abschnitt 10. |
| Knotenauslastung nutzt dieselbe Knotenschätzung; Filter, Stundenfenster, Headway und Kapazität ergeben die spezifizierte Anzeige. | Dedizierte Datenaufbereitungs-/View-Tests ergänzen; Fälle aus Abschnitt 11. |
| Alle aufgeführten Fehlerfälle sind reproduzierbar abgesichert. | Explizite Regressionen für #1375, #1376, #795, #63 und den zweistündigen Turnaround-Fall. Fehlende Tests im Zielbranch sind neu zu erstellen. |
| Bereits bestehendes Verhalten ausserhalb der Sollkorrekturen bleibt erhalten. | Zugeordnete Characterization-/Regressionstests aus den betroffenen Services, Modellen und Komponenten. |

### Testdaten für das Main-Issue

Diese Tabelle gehört direkt in den Text von Parent-Issue #1358 und steht
deshalb vor den Sub-Issues. Sie fasst die ausführbaren Kernbelege zusammen;
die jeweiligen Sub-Issues führen darunter ihre konkrete Teilmenge mit den
detaillierten Sollwerten auf.

| Bereich / Quelle | Konkrete Testdaten | Erwartetes Ergebnis |
|---|---|---|
| Abschnitts-Estimator, `infrastructure-estimator.service.spec.ts` | A=179 → B=180, Abschnitt 713; B=180 → C=181, Abschnitt 714. | A→B: `[(0,1/6,2),(1/6,1,1)]`; B→C: `[(0,1,1)]` als `(start,end,tracks)`. |
| Abschnitts-Estimator, Periodenfenster | Abschnitt 713 mit 62 Minuten Fahrzeit und Frequenz 60 Minuten. | Vier normierte Segmente: `[(0,.0290322581,2),(.0290322581,.8537634409,1),(.8537634409,.9118279570,2),(.9118279570,1,1)]`. |
| Knotengleis-Estimator, `infrastructure-estimator.node-track.spec.ts` | A1=182; Testfahrten 99/100; Fenster `[-60,271]`; getrennte Richtungsgleise. | Exakte 12-Zeilen-Zuweisung ist im Testfall von Sub-Issue 2 dokumentiert; Belegungen plus Headway kollidieren auf keinem zugewiesenen Gleis. |
| Knotengleis-Estimator, Turnaround | C3=184, Abschnitt 717; `(Frequenz, Ankunft, Abfahrt)` = `(30,30,30)`, `(15,15,45)`, `(15,45,15)`, `(20,40,20)`. | Jeweils 2 Tracks; Occupancy-Dauer/Headway-Ende relativ zum Start: 30/32, 15/17, 15/17, 20/22 Minuten. |
| Streckengrafik-Integration, JSON-Fixture | `testNetzugrafikTrackEstimator.json`; Trainruns 104 (ICX) und 105 (SX), One-way-Knoten 188–190. | ICX fährt 190→189→188 rückwärts, SX 189→190 vorwärts; am C3-One-way Gleis 2 bzw. Gleis 1. |
| Node-Rendering, `trainrun-node.component.spec.ts` | Track-X 40; Reservation 10→20; Headway bis 25; Transitpositionen 0/34/46/60. | SVG: Occupancy `M 40 10 L 40 20`, Headway `M 40 20 L 40 25`, Transit `M 0 10 L 34 10` und `M 46 20 L 60 20`. |
| Knotenauslastung / #63 und zweistündiger Turnaround | Issue-Reproduktion zu #63 sowie `networkGraphic (4).json` aus dem PR-Kommentar. | Im Referenz-Worktree wurde keine dedizierte View-Spec bzw. diese JSON-Fixture gefunden. Die konkrete Reproduktion und Soll-Clock müssen vor dem Festschreiben numerischer Werte aus dem Issue-/PR-Anhang übernommen werden; keine Testwerte erfinden. |
| Teilpfad-Rendering / #795 | `netzgrafik.8.json` aus Issue #795. | Reproduktion mit mehreren ausgewählten internen Knoten und geöffnetem Endknoten-Occupier; korrekte Darstellung ohne Artefakte. Als eigener Regressionstest dokumentieren, nicht durch einen ähnlichen Nachbarfall ersetzen. |

Einzelne Tests dürfen in der Neuimplementierung an eine passendere Testebene
verschoben werden. Die geforderte Verhaltensabdeckung und die konkreten
fachlichen Assertions dürfen dabei nicht verloren gehen.

## Fachlicher Umfang

1. Streckengleisbedarf entlang gerichteter Korridore schätzen.
2. Periodische Knotengleisbelegungen und Gleiszuweisungen schätzen.
3. Schätzungen in Streckengrafik-Modell und Rendering integrieren.
4. Knotenauslastungs-Datenaufbereitung und Darstellung auf dieselben
   Schätzergebnisse umstellen.
5. Redundante Modell- und Service-Logik entfernen, soweit sie durch die neue
   Verantwortungsaufteilung überflüssig wird; Schätzergebnisse selbst bleiben
   frei von View-, SVG- und Streckengrafik-Modellzustand.
6. Die im Rahmen der Arbeit gefundenen und im PR enthaltenen Fehler korrigieren
   (falsche Einweg-Richtung, fehlerhafte Transitlinien, Artefakte bei
   Teilpfaden, abweichende Knotenauslastung und Turnaround-Randfälle; Details
   unter „Im PR enthaltene Fehlerkorrekturen“).

## Test- und Review-Grundlage

Die betroffenen Bereiche waren auf `main` nur sehr schwach getestet. Die
vorhandenen Tests bilden eine begrenzte Ausgangs-Baseline, sind aber kein
ausreichender Nachweis für die fachliche Korrektheit. Die neue Lösung auf
`aeg/refactoring_streckengrafik_complete` sichert die gewünschte
Refactoring- und Bugfix-Lösung mit deutlich mehr automatisierten Tests ab.
Diese zusätzliche Absicherung ist Teil des zu übertragenden Ergebnisses.
Für die im PR dokumentierten Fehler sind die Reproduktion und die
korrigierten Erwartungen aus dem Referenzbranch massgeblich.

Der bereitgestellte Excel-Auszug mit Ergebnis- und Eingabedaten ist vollständig
in **Anhang B am Dokumentende** übernommen. Dort sind auch die Abweichungen
zwischen den beiden Tabellen und der Abgleich mit den Tests des aktuellen
Branches dokumentiert. Der Auszug ist
nicht automatisch als bereits getestetes Verhalten zu verstehen: Wo Fixture
und Eingaben nicht nachweislich übereinstimmen, wird keine Soll-Assertion
daraus abgeleitet. Für bestätigte Erwartungen gilt der aktuelle Branch-Code
samt Tests als Ground Truth.

## Branch-, Review- und Merge-Ablauf

Empfohlen wird ein **gestapelter PR-Ablauf**: ein Parent-Issue #1358 erfasst
das Gesamtziel; Sub-Issues beschreiben die fachlich abgegrenzten
Implementierungspakete. Jedes Paket erhält einen eigenen Branch und PR, sofern
es als Änderungssatz sinnvoll eigenständig reviewbar ist. Der erste PR geht
von `main` aus; jeder weitere PR baut auf dem vorherigen Stack-Schritt auf
und zielt auf dessen Branch, sodass der Reviewer den jeweiligen Teil-Diff
prüfen kann. Der Stack wird in Abhängigkeitsreihenfolge integriert; sein vollständiger
Endstand wird nach `main` gemergt. So bleiben Abhängigkeiten sichtbar, ohne
für jeden Commit zusätzlich ein eigenes Issue anlegen zu müssen. Ein PR pro
Commit ist als Stack möglich, aber keine Pflicht.

Die vorgeschlagene Stack-Reihenfolge ist `PR 1/8` bis `PR 8/8` gemäss
Abschnitt 12. Baseline-Erfassung und finale Gesamtregression sind verbindliche
Review-Gates, aber keine eigenen Stack-PRs oder Sub-Issues. Falls der Reviewer
einen PR teilen oder mehrere PRs zusammenfassen lässt, werden Nummerierung,
Base-Branches und die Zuordnung zu den sechs Sub-Issues in Abschnitt 12
aktualisiert.

Empfohlener Ablauf:

1. Parent-Issue und Sub-Issues mit Scope, Abhängigkeiten und Abnahmekriterien
   anlegen; den gemeinsamen Ausgangspunkt und Zielcommit festhalten.
2. Die Änderungen auf aktuellem `main` neu aufbauen. Branch-Namen und
   Base-Branches aus der Stack-Tabelle in Abschnitt 12 verwenden.
3. Die Abhängigkeiten aus Abschnitt 5 einhalten; nicht abhängige Verbraucher
   dürfen nur dann parallel entwickelt werden, wenn ihr gemeinsamer
   Integrationsstand eindeutig bleibt.
4. Pro PR das konkrete `main`→Zielbranch-Delta, betroffene Tests und
   Nicht-Ziele im PR-Text benennen. Die zugehörigen Tests ausführen und
   Review-Findings vor dem nächsten Schritt bearbeiten.
5. Den vollständig reviewten Stack in Abhängigkeitsreihenfolge integrieren.
   Vor dem ersten Merge nach `main` den Gesamtstand gegen Akzeptanzkriterien,
   relevante Tests, Lint und Builds prüfen.

Ein Sub-Issue muss nicht zwingend genau einem historischen Commit entsprechen.
Ein Sub-Issue kann mehrere historische Commits abdecken, und ein historischer
Commit kann Änderungen enthalten, die bei der Neuimplementierung auf mehrere
Pakete verteilt werden. Falls ein Sub-Issue in mehrere PRs geteilt wird,
bleibt die Issue-Zuordnung erhalten; ein neues Issue ist nur nötig, wenn ein
eigenständiges fachliches Ergebnis oder ein separat nachverfolgbarer Umfang
entsteht.

## Abnahmekriterien

- Eine zustandslose Berechnung nimmt Domain-Daten entgegen und liefert ohne
  gespeicherten Zustand Ergebnisse für gerichtete Streckenkanten
  (`Node A → Node B`) und Knotengleisbelegungen zurück. Anzahl und Aufteilung
  der Services sind nachrangig; der konkrete Zielbranch-Datenvertrag ist
  massgeblich.
- Gemeinsame Hilfsfunktionen (insbesondere mathematische Berechnungen) werden
  wiederverwendet statt mehrfach parallel implementiert. Vereinfachungen und
  weitergehende Aufteilung des Services können als nachgelagerte
  Refactoring-Vorschläge dokumentiert werden.
- Streckengrafik, Knotenauslastung und weitere Verbraucher können die
  zustandslos erzeugten Ergebnisse integrieren, ohne eigene abweichende
  Schätzlogik zu pflegen.
- Jedes relevante Zielverhalten ist durch einen passenden Test belegbar.
  Tests dürfen bei der Migration angepasst oder verschoben werden, solange
  die Verhaltensabdeckung erhalten bleibt.
- Die im PR enthaltenen und unten aufgeführten Fehlerkorrekturen werden
  als gewünschtes Verhalten übernommen und jeweils durch explizite
  Regressionstests abgesichert.
- Nach jedem Sub-Issue bestehen die diesem Arbeitspaket zugeordneten Tests;
  die Testresultate und Review-Findings werden dokumentiert.
- Jeder Stack-Schritt wird einzeln reviewed; ein eigenes Sub-Issue pro
  historischem Commit ist nicht erforderlich. Die Sub-Issues 1–6 ordnen
  fachliche Verantwortlichkeiten und Tests zu.
- Der gesamte Stack bleibt bis zum Abschluss der Reviews ungemergt. Danach
  wird er in Abhängigkeitsreihenfolge integriert; auf `main` gelangt nur der
  vollständig geprüfte Zielstand.
- Die im Repository festgelegten relevanten Test-, Lint- und Build-Commands
  sind für den finalen Feature-Branch erfolgreich.

## Nicht-Ziele

- Keine unbeabsichtigte Änderung gegenüber dem Referenzverhalten.
- Keine zusätzlichen Fehlerkorrekturen ausserhalb des beschriebenen
  Referenzumfangs und der unten aufgeführten PR-Fixes.
- Keine Implementierung des Variantenvergleichs, eigenständiger Analyse-
  Workflows oder konkreter Optimierungsalgorithmen. Dieses Refactoring soll
  durch die unabhängige Berechnung deren spätere Umsetzung ermöglichen.
- Keine Zusammenfassung aller Arbeiten in einem unreviewbaren Gross-PR.

## Im PR enthaltene Fehlerkorrekturen

PR #1379 nennt die folgenden Issues ausdrücklich als enthaltene Fixes. Diese
Fehler bestanden in der bisherigen Anwendung bzw. wurden bei der Arbeit an
der Streckengrafik sichtbar. Sie sind **bewusster Teil des Zielbilds** und
müssen beim Weg von `main` zum Zielbranch mit übernommen werden; sie sind
nicht als unbeabsichtigte Verhaltensänderungen zu behandeln.

| Issue | Fehlerbild laut Issue | Reproduktion / Testdaten | Migrationsschritt / erwartete Absicherung |
|---|---|---|---|
| [#1375](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1375) | Einweg-Züge wurden in der Streckengrafik entgegen ihrer tatsächlichen Fahrtrichtung gezeichnet. Als Beispiele sind ICX von C3-one-way nach A1-one-way und SX von B2-one-way nach C3-one-way genannt. | [Issue-Testnetz](https://github.com/user-attachments/files/33043121/refactor_netzgrafik_test_sample.json) | Sub-Issue 3: Abschnittsrichtung und Einwegfahrt müssen in Estimator und Streckengrafik-Integration übereinstimmen; Richtungstests verwenden. |
| [#1376](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1376) | Transitlinien im Knoten wurden in der Streckengrafik teilweise falsch dargestellt, unter anderem am Knoten C3-one-way. | [Issue-Testnetz](https://github.com/user-attachments/files/33043375/refactor_netzgrafik_test_sample.json) | Sub-Issue 4: Transit-Verbindungen aus Reservierung und realen Abschnittsnachbarn rendern; Renderingtests für Vorwärts-/Rückwärts- und Einweg-Endknoten verwenden. |
| [#795](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/795) | Teilweise dargestellte Trainrun-Pfade erzeugten visuelle Artefakte, wenn mehrere interne Knoten ausgewählt und der Track-Occupier am Endknoten geöffnet wurde. | [Reproduktionsnetz](https://github.com/user-attachments/files/24941143/netzgrafik.8.json) und [Video](https://github.com/user-attachments/assets/b4432766-ef26-4e6c-8079-94f6ecb240cc) | Sub-Issue 4: projizierte Pfadenden und fehlende Nachbarabschnitte explizit rendern und testen. |
| [#63](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/63) | Frequency-Clock/Knotenauslastung wich von der Knotenbelegung in der Streckengrafik ab, reagierte nicht wie erwartet auf Filter und berücksichtigte Nachbelegungs-/Headway-Zeiten nicht ausreichend; dadurch konnte der Gleisbedarf zu klein erscheinen. | [Issue mit Screenshot und Reproduktionsbeschreibung](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/63); [Kommentar zur gemeinsamen Umsetzung mit #1358](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/63#issuecomment-5716943909) | Sub-Issue 5: beide Ansichten aus derselben Estimation speisen; Filter, Headway, Gleisanzahl und Kapazitätsgrenze testen. |
| [PR-Kommentar vom 16.10.2026](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/pull/1379#issuecomment-6211729320) | Zusätzlicher Reproduktionsfall: Turnaround am Knoten C über eine zweistündige Betrachtung war nicht korrekt. | [networkGraphic (4).json](https://github.com/user-attachments/files/33535523/networkGraphic.4.json) | Sub-Issues 2 und 5: periodische Wende-/Turnaround-Zeiten sowie Projektion über zwei Stunden testen. |

Die PR-Beschreibung führt diese vier Issue-Fixes als enthalten auf. Zum
abgefragten Stand war PR #1379 noch ein offener Draft und die vier Issues
waren auf GitHub ebenfalls noch offen. „Im PR enthalten“ bedeutet daher, dass
die Fixes Bestandteil des Zielbranches sind, nicht dass die GitHub-Issues
bereits durch einen Merge geschlossen wurden. Bei der Neuimplementierung
sind die Reproduktionsschritte und die Regressionstests im Referenzbranch
nachzuvollziehen.

### Weitere PR-Links und Reviewhinweise

- [Issue #1358](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1358) ist das übergeordnete Refactoring-Issue.
- [Testdaten `refactor_netzgrafik_test_sample.json`](https://github.com/user-attachments/files/32737343/refactor_netzgrafik_test_sample.json) werden in der PR-Beschreibung als manuell erstellte Daten für Abschnitts- und Knotenschätzungen angegeben.
- Der [Kommentar zu #63](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/63#issuecomment-3815873342) hält fest, dass für den Clock-Fix eine globale, wiederverwendbare Berechnung des Node Track Occupier benötigt wird — genau die Zuständigkeit, die das Refactoring einführt.
- Im [weiteren Kommentar zu #63](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/63#issuecomment-4739420822) wird erwähnt, dass die Clock-Aktualisierung für Variantenvergleich und KPI-Berechnung relevant ist.
- Der [Kommentar zu #795](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/795#issuecomment-4739392541) hält fest, dass vor dem Fix geklärt werden sollte, ob der Variantenvergleich Änderungen an der Streckengrafik benötigt.
- [Review-Kommentar zur PR-Grösse](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/pull/1379#issuecomment-6187686559) weist darauf hin, dass die Änderung in ihrer damaligen Grösse schwer reviewbar sei und ein grosser Refactor auch neue Fehler einführen könne. Genau deshalb schneidet dieser Plan die Migration in unabhängige Schritte.
- Der [Kommentar zur Estimator-Grösse](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/pull/1379#issuecomment-6038211261) schlägt als mögliche spätere Folgearbeit vor, den gemeinsamen Service bei Bedarf in separate Abschnitts- und Knotengleis-Estimatoren aufzuteilen. Dies ist kein Muss für die Migration zum aktuellen Zielbranch.

## 3. Zielarchitektur und Datenfluss

### `InfrastructureEstimatorService`

Der Estimator ist eine zustandslose Rechenschicht. Fachliche Eingaben werden
pro Aufruf übergeben; Ergebnisse werden als typisierte Daten zurückgegeben.
Er enthält keine View-, SVG- oder Streckengrafik-Modelllogik.

- `estimateSectionTracks(fromNode, toNode, trainrunSections, ...)` liefert
  normalisierte Streckensegmente mit Start-/Endposition und Gleisanzahl.
- `estimateNodeTracks(node, trainrunSections, options)` liefert
  Gleiszuweisungen mit einzelnen periodischen Belegungen.
- Knotenausgaben enthalten Ankunft, Abfahrt, Ende der Headway-Sperrzeit,
  Fahrten-/Vorkommensbezug, Richtung sowie – sofern vorhanden – ankommende
  und abgehende Abschnitts-/Übergangsbezüge.
- Optionen erlauben ein Zeitfenster und die getrennte oder gemeinsame
  Gleisbelegung nach Richtung.

### Integration

1. `Sg6TrackService` ordnet Streckengrafik-Fahrten und Abschnitte den
   fachlichen Korridoren und Knoten zu.
2. Der Service ruft den Estimator auf und überträgt Gleisabschnitte in
   `TrackData` sowie Knotenschätzungen in Track-Reservierungen.
3. Streckengrafik-Komponenten zeichnen diese Reservierungen und deren
   Verbindungen; sie schätzen Gleisbelegung nicht selbst.
4. `KnotenAuslastungDataPreparation` berechnet die Estimation und projiziert
   dieselben Knotenschätzungen auf die jeweiligen Stundenfenster.
5. Die SVG-Ansicht zeichnet die vorbereiteten Daten einschließlich
   Belegung, Headway, Ressourcenkapazität und Stundenumschaltung.

### Grenzen der Integration

- Der Estimator bleibt unabhängig von Streckengrafik-View-Modellen.
- Datenzuordnung, Sichtbarkeitsfilter, Pfadbezug und Rendering verbleiben in
  ihren Integrationsschichten.
- Methodennamen müssen nicht den alten Namen aus `main` entsprechen; die
  Verantwortlichkeiten und Datenverträge müssen aber erkennbar bleiben.

## 4. Ausführungsstandard für Software Engineer oder Coding Agent

Dieses Dokument ist ein ausführbarer Arbeits- und Review-Auftrag, kein
Lernpfad. Ein Engineer oder Coding Agent soll jeweils ein abgegrenztes
Sub-Issue oder einen Slice daraus übernehmen können, ohne das Zielverhalten
neu erraten zu müssen. **SDD (Specification-Driven Development,
spezifikationsgetriebene Entwicklung)** hält vor der Umsetzung fest, was das
System tun soll. **TDD (Test-Driven Development, testgetriebene Entwicklung)**
macht das gewünschte Verhalten zuerst durch einen Test überprüfbar; danach
wird implementiert, bis der Test besteht. Die verbindliche Ground Truth
bleiben der Referenzbranch, seine Tests und die in diesem Dokument
bezeichneten Bugfix-Erwartungen.

### Kapitel SDD — Spezifikation des Sollverhaltens

Vor der Implementierung wird für jeden Stack-PR oder vereinbarten Slice eine
überprüfbare Spezifikation erstellt. Sie leitet das Arbeitspaket aus dem konkreten Delta
zwischen relevanter `main`-Baseline und Referenzbranch ab und beschreibt,
welchen Teil dieses Deltas der Subtask auf dem aktuellen Feature-Branch-
Zwischenstand umsetzt. Sie ist kein nachträglicher Implementierungsbericht.

Die Spezifikation hält mindestens fest:

- **Umfang und Ziel:** welches Verhalten oder welche Verantwortlichkeit
  dieses Arbeitspaket ergänzt, ändert oder entfernt.
- **Datenvertrag:** konkrete Eingaben und Vorbedingungen sowie erwartete
  Ausgaben. Für die Schätzung insbesondere gerichtete Kante
  (`Node A → Node B`) oder Knotengleisbelegung; die Berechnung ist
  zustandslos (Daten rein, Ergebnis raus).
- **Regeln und Randfälle:** Richtung, Frequenz, Fahrzeit, Headway,
  periodische Fenster, Turnaround, Filter und/oder Darstellung, soweit sie
  zum Arbeitspaket gehören.
- **Referenz und Beleg:** betroffene Dateien, Zielbranch-Tests/Assertions,
  Fixtures und gegebenenfalls Issue- oder PR-Reproduktion.
- **Konkretes Branch-Delta:** relevante `main`-Dateien/-Verantwortlichkeiten
  vor der Änderung, korrespondierende Zielbranch-Dateien/-Verantwortlichkeiten
  danach und was hinzugefügt, geändert oder entfernt wird. Pfade ohne
  festgestellte Verhaltens-/Codeänderung nicht als Implementierungsumfang
  aufnehmen.
- **Nicht-Ziele und Abhängigkeiten:** was ausdrücklich nicht geändert wird
  und welche vorherigen Stack-Schritte vorausgesetzt werden.
- **Abnahme:** konkrete beobachtbare Ergebnisse, die durch Tests oder einen
  ausdrücklich benannten manuellen Nachweis überprüfbar sind.

Widersprüche zwischen Beschreibung, Zielbranch-Implementierung und Tests
werden vor der Umsetzung sichtbar gemacht und geklärt; der Engineer oder
Coding Agent soll keine fachliche Sollregel erraten. Weitergehende
Vereinfachungen oder eine andere Service-Aufteilung werden als separater
Refactoring-Vorschlag festgehalten und nicht stillschweigend in das Delta
gemischt.

**Kopierbare Spezifikationsvorlage**

```text
Stack-PR/Slice: Nummer — Titel
main-Baseline (relevante Dateien und Verhalten):
Zielbranch-Endstand (relevante Dateien, Verhalten, Tests/Assertions):
Exaktes Delta main → Zielbranch (hinzufügen / ändern / entfernen):
Eingaben und Vorbedingungen:
Erwartete Ausgaben:
Regeln und Randfälle:
Zielbranch-Referenzdateien, Tests, Assertions und Fixtures:
Bekannte Bug-Reproduktionen:
Abhängigkeiten:
Nicht-Ziele:
Abnahmekriterien:
Zusätzliche Tests zur Absicherung bestehender Zielanforderungen (falls nötig):
```

Vor Freigabe der Spezifikation wird geprüft, dass jede geplante
Produktivcodeänderung einem konkreten Zielbranch-Delta zugeordnet ist. Ein
zusätzlicher Regressionstest ist zulässig, wenn er ein bereits im Zielbranch
implementiertes, aber dort nicht ausreichend isoliert getestetes Verhalten
absichert. Neue fachliche Regeln, UI-Funktionen oder Cleanups ohne Gegenstück
im Zielbranch werden als separate Vorschläge geführt und nicht in den
Subtask-Umfang aufgenommen.

### Kapitel TDD — Tests als Verhaltensnachweis

Die Tests machen die aus dem Zielbranch extrahierte Spezifikation ausführbar
und schützen genau dieses Delta gegenüber `main`. Für jede Abnahmeanforderung
wird ein passender Zielbranch-Test zugeordnet, übernommen oder gleichwertig
angepasst. Neue Tests ergänzen nur die Absicherung bereits im Zielbranch
implementierten Verhaltens; sie dürfen den Funktionsumfang nicht erweitern.
Entscheidend ist die erhaltene Verhaltensabdeckung, nicht, dass Testdatei
oder Testname unverändert bleiben.

- Vor Änderungen wird die relevante Testsuite auf dem aktuellen
  Feature-Branch-Zwischenstand ausgeführt und das Ergebnis festgehalten.
- Für neues oder korrigiertes Verhalten wird zuerst ein gezielter
  Regressionstest geschrieben. Wenn er auf `main` oder dem aktuellen
  Zwischenstand fehlschlägt, muss der Fehler der erwartete fachliche Fehler
  sein und darf nicht aus fehlerhaftem Test-Setup stammen. Danach wird die
  kleinstmögliche Änderung implementiert, bis der Test besteht.
- Bei rein strukturellem Refactoring werden vorhandene Characterization- und
  Vertragstests vor der Änderung grün ausgeführt und nachher erneut geprüft;
  ein künstlich fehlschlagender Test ist dafür nicht erforderlich.
- Assertions prüfen konkrete Ergebnisse und Randbedingungen, nicht nur, dass
  eine Methode ausgeführt wurde oder ein Ergebnis existiert.
- Die im PR enthaltenen Fälle #1375, #1376, #795, #63 und der
  zweistündige Turnaround-Fall werden gegen das im Zielbranch implementierte
  Verhalten geprüft. Fehlt dafür eine direkte Zielbranch-Assertion, wird ein
  Regressionstest ergänzt, der genau dieses Verhalten absichert.
- Nach jedem abgeschlossenen Stack-PR oder Slice werden die zugeordneten Tests
  ausgeführt und die Resultate im Review festgehalten. Nach Abschluss des
  gesamten Stacks läuft zusätzlich die vollständige relevante Testsuite.

Die Testfallkataloge in den Abschnitten 8–11 benennen die bereits
vorhandenen Zielbranch-Tests und kennzeichnen, wo die Neuimplementierung
zusätzliche explizite Regressionstests ergänzen muss.

### Verbindlicher Ablauf pro Arbeitspaket

| Phase | Was wird gemacht? | Review-Gate |
|---|---|---|
| 1. Spezifizieren (SDD) | Das relevante Delta von `main` zum Zielbranch pro Datei/Verantwortlichkeit ermitteln; Sollverhalten aus der Zielbranch-Endfassung und deren Tests extrahieren. | Jede geplante Produktivcodeänderung ist einem konkreten Zielbranch-Delta zugeordnet; zusätzliche Wünsche sind separat. |
| 2. Testen (TDD) | Zielbranch-Assertions zuordnen, nötige Regressionstests zur Absicherung genau dieses Zielverhaltens ergänzen und den passenden Ausgangsstand ausführen. | Test prüft das spezifizierte Delta; ein zusätzlicher Test begründet keine neue fachliche Anforderung. |
| 3. Implementieren | Nur das spezifizierte Delta umsetzen; keine nicht vereinbarte Aufräumaktion einmischen. | Zielverhalten entspricht dem Referenzbranch; keine fremden Verhaltensänderungen. |
| 4. Refactor | Bei Bedarf interne Struktur verbessern, ohne den Vertrag zu ändern. | Zugeordnete Tests bleiben grün; weitergehendes Refactoring separat dokumentieren. |
| 5. Review | Diff, Tests und Abnahmekriterien gemeinsam prüfen; Resultate und nicht ausgeführte Checks notieren. | Stack-PR ist freigegeben, bevor der Stack nach `main` integriert wird. |

### Kopierbarer Umsetzungsauftrag pro Sub-Issue/Slice

```text
Zugewiesenes Sub-Issue/Slice:
Spezifikation gemäss Kapitel SDD (main → Zielbranch Delta):
Verbindliche Zielbranch-Tests/Fixtures:
Zusätzliche Tests nur zur Absicherung des Zielverhaltens:
Nicht-Ziele / nicht zu ändernde Bereiche:
Abnahmekriterien:
Zu berichtende Ergebnisse: geänderte Dateien, Tests/Checks samt Resultat,
bekannte Abweichungen oder Blocker
```

Die vorhandenen Tests auf `main` bleiben eine begrenzte Migrations-Baseline.
Die deutlich umfangreicheren Tests auf dem Zielbranch sichern das gewünschte
Endverhalten und die im Refactoring gefundenen Korrekturen; sie müssen mit
der Lösung übertragen werden.

## 5. Abhängigkeiten und empfohlene Neuimplementierungsreihenfolge

```text
Sub-Issue 1: Abschnitts-Estimator ──┐
                                    ├─> Sub-Issue 3: Streckengrafik-Integration
Sub-Issue 2: Knoten-Estimator ──────┘             │
                    │                             └─> Sub-Issue 4: Node-Rendering
                    └─> Sub-Issue 5: Knotenauslastung
                                                  │
                    Sub-Issues 3–5 ───────────────┴─> Sub-Issue 6: Cleanup/Regression
```

Zuerst wird die bestehende Testbasis des Zielbranches als Migrations-Baseline
inventarisiert. Abschnitts- und Knotenschätzung können separat von `main`
migriert werden. Die Integration in die Streckengrafik benötigt beide.
Rendering und Knotenauslastung sind getrennte Verbraucher der
Knoten-Estimator-Ausgabe. Aufräumarbeiten erfolgen erst, wenn die neue
Datenkette integriert und mit den Zielbranch-Tests abgesichert ist.

## 6. Vorgeschlagene Arbeitspakete und Issue-Entwürfe

Die folgenden sechs Sub-Issues sind zum Anlegen unter dem bestehenden
Parent-Issue #1358 vorgesehen. Für jeden Sub-Issue den Titel und den
zugehörigen Beschreibungsteil ab der jeweiligen Überschrift bis vor die
nächste Sub-Issue-Überschrift übernehmen. Baseline-Gate und das
abschliessende Review-Gate (Gesamtabnahme) bleiben standardmässig
Checklistenpunkte im Parent-Issue und benötigen keine separaten Issues.

| Sub-Issue | Titel | Abhängigkeiten | Zugeordnete Stack-PRs |
|---|---|---|---|
| 1 | Zustandslosen Abschnitts-Gleis-Estimator implementieren | Baseline-Gate im Parent | PR 1, PR 4, PR 5 und PR 8 (nur die zugehörigen Estimator-Korrekturen) |
| 2 | Zustandslosen Knotengleis-Estimator implementieren | Baseline-Gate im Parent | PR 2, PR 3, PR 4, PR 5 und PR 8 (nur die zugehörigen Estimator-Korrekturen) |
| 3 | Estimator-Ausgaben in Streckengrafik integrieren | Sub-Issues 1 und 2 | PR 3, PR 4, PR 5 und PR 6 (Reservierungserhalt) |
| 4 | Knotenreservierungen in der Streckengrafik rendern | Sub-Issue 3 | PR 4, PR 5 und PR 6 (Render-/Reservierungsanteile) |
| 5 | Knotenauslastung auf gemeinsame Knotenschätzung umstellen | Sub-Issue 2; parallel zu 3/4 möglich | PR 6 |
| 6 | Streckengrafik-Services und Modell nach Integration vereinfachen | Sub-Issues 3, 4 und 5 | PR 7 |

Die Zuordnung markiert den fachlichen Bezug, nicht zwingend den gesamten
Dateiumfang eines historischen Commits. Insbesondere PR 4 ist ein gemischter
Stabilisierungs-Diff und PR 8 enthält abschliessende Estimator-Anpassungen.
Jeder PR soll im Text aufführen, welche Sub-Issues er voranbringt.

### Review-Gate 0 — Getestete Zielbranch-Baseline erfassen

**Abhängigkeiten:** keine; vor den Implementierungs-Sub-Issues ausführen.

#### SDD-Spezifikation

- **Umfang und Ziel:** Den Ist-Zustand und die überprüfbaren Zielverträge aus
  dem Referenzbranch erfassen, bevor Produktivcode geändert wird.
- **Datenvertrag:** Eingaben sind Referenzbranch, Commit, Tests, Fixtures und
  die verlinkten Fehlerreproduktionen; Ergebnis ist ein zugeordnetes
  Test-/Referenzinventar mit dokumentiertem Baseline-Teststatus.
- **Regeln und Randfälle:** Relevante Tests werden fachlichen Bereichen und
  Bugfällen zugeordnet; nicht vorhandene Regressionstests werden als Lücke
  markiert und nicht als bereits vorhandene Abdeckung dargestellt.
- **Referenz und Beleg:** Zielcommit `b0311411c329da055a5560090629d45f749e833f`;
  Referenzpfade in Abschnitt 13; Testfallkataloge in den Abschnitten 8–11.
  Der Excel-Auszug und sein Abgleich mit den aktuellen Tests stehen in
  Anhang B.
- **Nicht-Ziele und Abhängigkeiten:** Keine Produktivcodeänderung und keine
  unbestätigten fachlichen Anforderungen aus dem Excel-Auszug ableiten;
  Keine Abhängigkeit von anderen Sub-Issues.
- **Abnahme:** Referenz- und Testinventar ist vollständig genug, dass jeder
  folgende Sub-Issue seine relevanten Tests, Fixtures und noch offenen
  Testlücken benennen kann; der Referenz-Testlauf ist mit Ergebnis
  dokumentiert.

#### TDD-Testplan — Baseline-Inventar

- **Muss:** Auf dem Referenzcommit die vorhandenen Estimator-, Integrations-,
  Modell- und Renderingtests ausführen und Befehl sowie Resultat festhalten.
- **Muss:** Für jeden Parent-/Sub-Issue-Anforderungspunkt Testdatei und
  Assertion zuordnen oder explizit „Test fehlt“ dokumentieren.
- **Muss:** Tests für #795, #63 und den Turnaround-Fall nicht als vorhanden
  ausgeben, solange keine konkrete automatisierte Assertion identifiziert
  wurde; nötige neue Tests als Lücke notieren.
- **Abnahme des TDD-Schritts:** Es gibt eine nachvollziehbare Baseline und
  eine Liste der Tests, die in jedem nachfolgenden Stack-PR laufen müssen.

#### Testdaten — Baseline-Inventar

| Bereich | Referenzdaten/Testquelle | Im Inventar festzuhalten |
|---|---|---|
| Abschnittsschätzung | `infrastructure-estimator.service.spec.ts`; A-B/B-C, 62/60 Minuten, One-way, asymmetrische Fahrzeiten, Ausrollfenster. | Testname, Fixture/Arrange, gerichtete Eingabe und genaue Segmentassertion; die Schlüsselwerte sind unter Sub-Issue 1 dokumentiert. |
| Knotengleise | `infrastructure-estimator.node-track.spec.ts` und `testNetzugrafikTrackEstimator.json`; A1-Matrix, C3-One-way, Wrapped Turnarounds. | Testname, Knoten/Zeitraum/Optionen, konkrete Track-Zuweisung und Headway-Assertion; Werte unter Sub-Issue 2. |
| Integration/Rendering | `streckengrafik.services.spec.ts`, `trainrun-node.component.spec.ts` und JSON-Fixture. | Testname, Trainrun-/Knoten-/Occurrence-Daten und Model- oder SVG-Assertion; Werte unter Sub-Issues 3 und 4. |
| Nicht abgedeckte Fehlerfälle | Issues #795, #63 und PR-Turnaround-Reproduktion. | Reproduktionsdatei und Schritte verifizieren; fehlende automatisierte Tests ausdrücklich als Lücke protokollieren. |

**Ziel:** Die bereits gut getestete Lösung auf
`aeg/refactoring_streckengrafik_complete` als konkreten Migrations- und
Review-Massstab festhalten.

**Arbeit**

- Referenz-Commit und Dateien aus Abschnitt 13 dieses Dokuments als
  Zielzustand festhalten.
- Bestehende Estimator-, Integrations-, Modell- und Renderingtests den
  Sub-Issues zuordnen.
- Die Test-Suite des Referenzbranches ausführen und als bekannte gute
  Baseline dokumentieren.
- Testvorgaben aus den Zielbranch-Tests, Assertions und Fixtures extrahieren;
  Excel-Auszug in Anhang B als zusätzlichen Beleg dokumentieren und gegen
  konkrete Testdaten abgleichen.
- Pro Testfall Testname, Fixture/Arrange-Daten und wesentliche erwartete
  Werte in den Testtabellen dokumentieren.

**Abnahme**

- Referenzbranch, Commit und bestehende Tests sind benannt.
- Relevante Tests des Zielbranches sind erfolgreich und Sub-Issues
  zugeordnet.
- Es ist klar, welche Tests nach jedem Migrationsschritt erneut auszuführen
  sind.

### Sub-Issue 1 — Zustandslosen Abschnitts-Gleis-Estimator implementieren

**Abhängigkeiten:** Baseline-Gate im Parent-Issue.

#### SDD-Spezifikation

- **Umfang und Ziel:** Die gerichtete Abschnitts-Gleisschätzung aus dem
  Streckengrafik-Service in eine wiederverwendbare zustandslose Berechnung
  überführen.
- **Datenvertrag:** Eingabe sind Von-/Nach-Knoten, passende
  `TrainrunSection`s und gegebenenfalls Headway-Konfiguration; Ausgabe sind
  normalisierte `TrackSegmentEstimate[]` mit Start/Ende im Bereich 0–1 und
  benötigter Gleiszahl.
- **Regeln und Randfälle:** Abschnittsmatching und Fahrtrichtung,
  bidirektionale/One-way-Fahrten, asymmetrische Fahrzeiten, Frequenzoffset,
  Headway und Fahrzeit über der Frequenz sind zu berücksichtigen. Gleiche
  Eingaben müssen ohne gespeicherten Zustand dasselbe Ergebnis liefern.
- **Referenz und Beleg:** `estimateSectionTracks()` im Zielbranch;
  `infrastructure-estimator.service.spec.ts`; Abschnitts-Estimator-Einträge
  in Abschnitt 8; `src/app/utils/math.ts`.
- **Nicht-Ziele und Abhängigkeiten:** Keine Streckengrafik- oder View-Modelle
  im Schätzer und keine Änderung der Darstellung. Abhängig vom Baseline-Gate;
  die Integration erfolgt in Sub-Issue 3.
- **Abnahme:** Konkrete Segmentgrenzen und Gleiszahlen stimmen für die
  Referenzfälle; Richtung, One-way, asymmetrische Zeiten und periodisches
  Ausrollen sind getestet; relevante Estimator-Tests bestehen.

#### TDD-Testplan — Abschnitts-Estimator

- **Muss:** Bestehende Fälle für A-B/B-C, A1-B2/B2-C3,
  One-way-Richtung, asymmetrische Fahrzeiten und Ausrollfenster aus
  `infrastructure-estimator.service.spec.ts` erhalten oder gleichwertig
  nachbilden.
- **Muss:** Exakte Segmentgrenzen und Gleiszahlen prüfen, darunter die
  62-Minuten-Fahrzeit bei 60-Minuten-Frequenz; keine blossen
  „Ergebnis vorhanden“-Assertions.
- **Muss:** Nicht passende/leere Eingaben und gerichtetes Verhalten
  (`A → B` gegenüber `B → A`) prüfen.
- **Soll:** Tests für mathematische Hilfsfunktionen separat halten, sofern sie
  als gemeinsam genutzte Utils auch von anderen Estimatorteilen verwendet
  werden.
- **Testreferenz:** Zielbranch-Datei und konkrete Testnamen stehen im
  Abschnitt 8 Testfallkatalog.

#### Testdaten — Abschnitts-Estimator

Quelle: `infrastructure-estimator.service.spec.ts`.

| Testfall | Eingabe | Exaktes Soll |
|---|---|---|
| A-B / B-C Baseline | A=179→B=180, Abschnitt 713; B=180→C=181, Abschnitt 714. | A→B `[(0,1/6,2),(1/6,1,1)]`; B→C `[(0,1,1)]`. |
| Fahrzeit über der Frequenz | Abschnitt 713; Frequenz 60 Minuten; Fahrzeit, Zielankunft und consecutive arrival auf 62 Minuten. | `[(0,.0290322581,2),(.0290322581,.8537634409,1),(.8537634409,.9118279570,2),(.9118279570,1,1)]`. |
| A1→B2 | A1=182, B2=183; Abschnitte 715/718. | `[(0,3/40,3),(3/40,59/120,2),(59/120,1,1)]`. |
| One-way A→B und B→C | Frequenz 60, Offset 0, `ONE_WAY`; Zeiten A-B `6/54→0/60`, B-C `13/47→7/53`. | Beide gerichteten Korridore `[(0,1,1)]`; keine Gegenrichtungsbelegung. |
| Asymmetrische One-way-/Round-trip-Fahrten | Round-trip 60 und Rückwärts-One-way 30; One-way-Rückabschnitt Zeiten `51/59→1/9`. | A→B `[(0,59/75,1),(59/75,139/150,2),(139/150,1,1)]`. |
| Erweitertes Ausrollfenster | Frequenz 60; künstliche Abschnittszeiten source `2/187`, target `233/418`. | 13 Segmente mit 1-/2-Gleisbelegung; alle normierten Grenzen wie im Referenztest exakt vergleichen. |

**Referenzbereich:** `InfrastructureEstimatorService.estimateSectionTracks()`
und `infrastructure-estimator.service.spec.ts`.

**Ziel:** Für einen gerichteten Korridor die benötigten Gleise entlang des
Streckenverlaufs schätzen und die Berechnung aus `Sg6TrackService`
herauslösen.

**Eingabe und Ergebnis**

- Eingabe: Von-/Nach-Knoten, passende `TrainrunSection`s und optionale
  Headway-Konfiguration.
- Ergebnis: `TrackSegmentEstimate[]`; jede Schätzung enthält normalisierte
  Positionen `start`/`end` im Intervall 0 bis 1 und die dort benötigte Zahl
  paralleler Gleise.
- Gleisbedarf ist gerichtet: `A → B` ist nicht automatisch gleich `B → A`.
- Einwegzüge zählen nur in ihrer tatsächlichen Richtung.

**Zu implementieren**

- Passende Abschnitte deduplizieren und ihre Fahrtrichtung relativ zum
  angefragten Korridor bestimmen.
- Fahrzeit, Frequenz und Abschnittsheadway in die Belegung einbeziehen.
- Periodische Fahrten ausreichend weit ausrollen; das Rechenfenster muss auch
  dann reichen, wenn die Streckenfahrzeit größer als die Zugfrequenz ist.
- Belegungen entlang Distanz/Zeit in normalisierte, zusammenhängende
  Gleissegmente überführen und gleiche Nachbarsegmente normalisieren.
- Keine Service-/View-Zustände speichern.

**Tests und Abnahme**

- Tests für Hin- und Rückrichtung, bidirektionale und Einwegfahrten.
- Tests für asymmetrische Fahrzeiten, Headway und Fahrtversatz.
- Testfall: Fahrzeit größer als Frequenz (im Branch z. B. 62 Minuten
  Fahrzeit bei 60 Minuten Frequenz).
- Leere oder nicht passende Eingaben ergeben ein leeres Ergebnis, keine
  ungültigen Segmentgrenzen.
- Die bestehenden Abschnitts-Estimator-Tests des Referenzbranches bestehen;
  ihre konkreten Segment-Assertions bleiben erhalten.

**Branch-Dateien als Orientierung**

- `src/app/services/infrastructure/infrastructure-estimator.service.ts`
- `src/app/services/infrastructure/infrastructure-estimator.service.spec.ts`
- `src/app/utils/math.ts`

### Sub-Issue 2 — Zustandslosen Knotengleis-Estimator implementieren

**Abhängigkeiten:** Baseline-Gate im Parent-Issue.

#### SDD-Spezifikation

- **Umfang und Ziel:** Periodische Knotenbesuche in konfliktfreie
  Gleiszuweisungen und wiederverwendbare Occupancy-Ergebnisse umwandeln.
- **Datenvertrag:** Eingabe sind ein Knoten, zugehörige
  `TrainrunSection`s und Optionen wie Zeitfenster oder getrennte
  Richtungszuweisung. Ausgabe sind sortierte `NodeTrackEstimate`s und
  `NodeTrackOccupancy`s mit Gleis, Ankunft/Abfahrt, Headway-Ende,
  Trainrun-/Occurrence-Bezug und Richtung.
- **Regeln und Randfälle:** Durchfahrt, Halt, Wende, One-way-Endpunkt,
  Kategorie-Headway, Mindestwende, Zyklusüberlauf, periodische Wiederholungen,
  bereits vor dem Fenster beginnende Belegung sowie deterministische,
  kollisionsfreie Zuteilung sind nach Referenzregeln zu behandeln.
- **Referenz und Beleg:** `estimateNodeTracks()` und
  `infrastructure-estimator.node-track.spec.ts`; Node-Estimator-Testkatalog
  in Abschnitt 9; Netzfixture
  `src/integration-testing/test-data/testNetzugrafikTrackEstimator.json`.
- **Nicht-Ziele und Abhängigkeiten:** Keine SVG-/View-Objekte und keine
  Streckengrafik-spezifische Zuordnung im Schätzer. Abhängig vom Baseline-Gate;
  Konsumenten folgen in Sub-Issues 3–5.
- **Abnahme:** Zeit- und Gleiszuweisungen entsprechen den konkreten
  Referenzassertions; kein Gleis hat kollidierende Occupancy-/Headway-Sperren;
  Richtungs-, Perioden- und Turnaround-Fälle sind getestet.

#### TDD-Testplan — Knotengleis-Estimator

- **Muss:** A1-Matrix-Zuweisung exakt prüfen und für alle relevanten Fixture-
  Knoten nachweisen, dass Occupancy plus Headway auf einem Gleis nicht
  kollidieren.
- **Muss:** Reale C3-One-way-Fixture, getrennte Richtungen, Zeitfenstergrenzen
  und periodische Wiederholungen prüfen.
- **Muss:** Wrapped Turnaround, zu kurze Mindestwende, gültige kurze Wende
  und 05→55-Periodenfall mit konkreten erwarteten Zeiten testen.
- **Muss:** Die genaue Knotengleis-Estimator-Testsuite nach jedem Änderungssatz
  laufen lassen; exakte Referenzassertions erhalten oder gleichwertig
  nachbilden.
- **Testreferenz:** Zielbranch-Datei und konkrete Testnamen stehen im
  Abschnitt 9 Testfallkatalog.

#### Testdaten — Knotengleis-Estimator

Quelle: `infrastructure-estimator.node-track.spec.ts` und
`testNetzugrafikTrackEstimator.json`.

| Testfall | Eingabe | Exaktes Soll |
|---|---|---|
| A1-Trackmatrix | Knoten 182; Fenster `[-60,271]`; Trainruns 99/100; getrennte Richtungs-Gleise. | `(trainrun,arrival,departure,track)`: `(99,-60,0,4)`, `(100,-31,1,1)`, `(100,-1,31,2)`, `(99,0,60,3)`, `(100,29,61,1)`, `(100,59,91,2)`, `(99,60,120,4)`, `(100,89,121,1)`, `(100,119,151,2)`, `(99,120,180,3)`, `(100,149,181,1)`, `(100,179,211,2)`. |
| C3-One-way | C3=184 und C3-ONE-WAY=190; Fixture-Abschnitte; Fensterende 120; getrennte Richtungsgleise. | Track-Belegung enthält eine Occupancy mit `direction === "one_way"`. |
| Wrapped Turnarounds | C3=184, Abschnitt 717, Fenster `[0,120]`; `(Frequenz,Ankunft,Abfahrt)` = `(30,30,30)`, `(15,15,45)`, `(15,45,15)`, `(20,40,20)`. | Jeweils 2 Tracks; Dauer/Headway `(30,32)`, `(15,17)`, `(15,17)`, `(20,22)`. |
| Zu kurze Mindestwende | Frequenz 30, Mindestwende 35, Abschnitt 717, Ankunft/Abfahrt 30/30. | Die Abfahrt der Ankunft bei Minute 0 wird auf Minute 60 verschoben. |
| Gültige kurze Wende / 05→55 | Frequenz 15, Abschnitt 717; Fälle 5→10 und 5→55. | 5→10 bleibt im Zyklus; 5→55 wird periodisch auf Abfahrt 10 normalisiert. |
| Konfliktfreiheit | Alle Fixture-Knoten, Fensterende 180, gemeinsame Richtungsgleise. | Nächste Occupancy auf einem Track beginnt nicht vor dem `headwayUntilMinute` der vorherigen. |

**Referenzbereich:** `InfrastructureEstimatorService.estimateNodeTracks()`
und `infrastructure-estimator.node-track.spec.ts`.

**Ziel:** Für einen Knoten einzelne periodische Belegungen bilden und konfliktfrei
Gleisen zuweisen. Ergebnis sind Gleisnummern und konkrete Belegungsintervalle,
nicht Darstellungsobjekte.

**Ausgabe**

- Pro Gleis: `NodeTrackEstimate` mit sortierten `NodeTrackOccupancy`s.
- Pro Belegung: Ankunft, Abfahrt und `headwayUntilMinute`, Zug-ID,
  Vorkommensindex und Fahrtrichtung; Abschnitts-/Übergangs- und
  Gleisgruppenbezüge, wenn anwendbar.
- Optionale Berechnungsgrenzen sowie Option zum Separieren von Vorwärts- und
  Rückwärtsgleisen.

**Zu implementierende Regeln**

- Knotenbesuche aus den übergebenen Abschnitten mit Ankunfts- und
  Abfahrtsbezug aufbauen.
- Fälle als Durchfahrt, Round-trip-Wende oder Einweg-Endpunkt unterscheiden.
- Kategorieabhängige Haltezeit und Node-Headway verwenden; Non-stop-Transit
  und Halt können unterschiedliche Headways haben.
- Wendezeiten periodisch ausrichten. Eine nicht ausreichende Mindestwendezeit
  muss in einen zulässigen Folgezyklus verschoben werden.
- Periodische Wiederholungen erzeugen, die das Berechnungsfenster schneiden,
  inklusive Belegungen, die bereits vor dem Fenster beginnen.
- Gleisblöcke deterministisch sortieren und konfliktfrei zuteilen.
- Bei getrennter Richtungszuweisung Vorwärts-/Rückwärts-Durchfahrten
  unterschiedlich gruppieren; Wenden und Endpunkte gemäß Referenzlogik
  zuordnen.
- Optional gemeinsame Richtungsgleise unterstützen.

**Tests und Abnahme**

- Keine überlappenden Sperrintervalle auf demselben zugewiesenen Gleis.
- Stabile, konkrete Gleiszuordnung für die A1-Matrix-Testfälle.
- Einwegroute und Einweg-Endpunkte abdecken.
- Wendezeiten mit Periodenüberlauf, zu kurzer Mindestwendezeit und gültigem
  kurzem Turnaround prüfen.
- Offene Fenstergrenzen, ausgerollte Wiederholungen und beide
  Richtungsoptionen testen.
- Die bestehenden Knotengleis-Estimator-Tests des Referenzbranches bestehen;
  ihre konkreten Gleis- und Zeit-Assertions bleiben erhalten.

**Branch-Dateien als Orientierung**

- `src/app/services/infrastructure/infrastructure-estimator.service.ts`
- `src/app/services/infrastructure/infrastructure-estimator.node-track.spec.ts`
- `src/integration-testing/test-data/testNetzugrafikTrackEstimator.json`

### Sub-Issue 3 — Estimator-Ausgaben in Streckengrafik integrieren

**Abhängigkeiten:** Sub-Issues 1 und 2.

#### SDD-Spezifikation

- **Umfang und Ziel:** Die zustandslosen Strecken- und Knotenschätzungen in
  Streckengrafik-Korridore, `TrackData` und Knotenreservierungen überführen.
- **Datenvertrag:** Eingaben sind Estimator-Ergebnisse, sichtbare Domain-
  Trainruns/Abschnitte, Pfad-/Korridorbezug und relevante Zeitgrenzen.
  Ausgaben sind zugeordnete Track-Segmente sowie
  `SgTrainrunNodeTrackReservation`s mit Fahrt, Occurrence, Gleis, Zeiten,
  Offset und optionalen Abschnittsbezügen.
- **Regeln und Randfälle:** Korridororientierung, Filter, periodische
  Mehrfachvorkommen, Offsets, Einweg-Endpunktzeiten und Matching von Fahrt
  plus Occurrence müssen der Referenz entsprechen; Schätzergebnisse werden
  nicht durch eine zweite fachliche Berechnung überschrieben.
- **Referenz und Beleg:** `Sg6TrackService`, `SgTrainrunNode`,
  `SgTrainrunSection`, `streckengrafik.services.spec.ts` und Testfälle in
  Abschnitt 10; #1375-Reproduktion ist im Fehlerkatalog dokumentiert.
- **Nicht-Ziele und Abhängigkeiten:** Noch keine Neugestaltung der SVG-
  Transit-Geometrie (Sub-Issue 4) oder Knotenauslastungs-View (Sub-Issue 5).
  Abhängig von Sub-Issues 1 und 2.
- **Abnahme:** Segment- und Knotenresultate werden deterministisch und
  vollständig in die Modelle übertragen; Filter und One-way-Richtung sind
  abgedeckt; zugeordnete Integrations- und Regressionstests bestehen.

#### TDD-Testplan — Streckengrafik-Integration

- **Muss:** Integrationstests prüfen, dass Estimator-Segmentprofile und
  Knotengleiszuweisungen ohne abweichende Neuberechnung im Modell landen.
- **Muss:** Sichtbarkeitsfilter, One-way-Kanten und die beiden
  Richtungsbeispiele aus #1375 prüfen.
- **Muss:** Mehrfach vorkommende Trainruns über `occurrenceIndex` und `offset`
  eindeutig und mit korrektem Gleis/Abschnittsbezug zuordnen.
- **Soll:** Wiederholte Emission derselben Trainrun-Liste und bestehende
  Streckengrafik-Interaktionen als Characterization-/Regressionstests laufen
  lassen.
- **Testreferenz:** `streckengrafik.services.spec.ts`; relevante bestehende
  Fälle sind im Abschnitt 10 aufgelistet.

#### Testdaten — Streckengrafik-Integration

Quelle: `streckengrafik.services.spec.ts` und
`testNetzugrafikTrackEstimator.json`.

| Testfall | Eingabe | Exaktes Soll |
|---|---|---|
| #1375 One-way-Richtung | Trainrun 104 (ICX) über Nodes 190→189→188 rückwärts; Trainrun 105 (SX) über 189→190 vorwärts; Abschnitte 724/726. | ICX: Abfahrt C3=43, Ankunft A1=59, C3-Track 2. SX: Abfahrt B2=1, Ankunft C3=25, C3-Track 1. |
| Sichtbare Track-Zuweisung | Trainruns 99/100 am A1=182. | Track-Reservations stimmen mit Estimator-Matrix überein: `(99,-60,0,4)`, `(99,0,60,3)`, `(100,-31,1,1)`, `(100,-1,31,2)`. |
| Periodisches Vorkommen | SX Trainrun 101, B2=183; Node-Zeit `-1/16`; Reservation `119/136`, Offset 120. | occurrence 4 wird Track 1 zugeordnet; Lookup berücksichtigt Trainrun und Offset/Occurrence, nicht nur die Trainrun-ID. |
| Daten-Emission | Dieselbe Trainrun-Array-Referenz wird erneut emittiert. | Die Streckengrafik-Items/Reservations werden erneut aufgebaut und zeigen aktualisierte Daten. |

**Referenzbereich:** `Sg6TrackService`, `SgTrainrunNode`,
`SgTrainrunSection` und `streckengrafik.services.spec.ts`.

**Ziel:** Schätzungen für sichtbare Streckengrafik-Daten berechnen und in
bestehende Pfad-/Knoten-/Abschnittsmodelle übertragen.

**Zu implementieren**

- Streckenabschnitte nach gemeinsamem Korridor gruppieren und die zugehörigen
  Domain-Abschnitte deduplizieren.
- Korridororientierung konsistent mit ausgewähltem Pfad bestimmen und
  `estimateSectionTracks()` verwenden.
- Abschnittsschätzungen in `TrackData`/`TrackSegments` abbilden; die
  modellseitige Gleisanzahl und Knotenbreite konsistent halten.
- Für Knotenschätzungen sichtbare Trainruns und Abschnitte ermitteln.
- Estimatorfenster mindestens über den Tag und bei Zeiten außerhalb des Tages
  bis zu den relevanten Knoten-Zeiten erweitern.
- Reservierungen mit Zug-ID, occurrence index, Gleis, Zeiten, Offset und
  Abschnitts-IDs dem jeweiligen Streckengrafik-Knoten zuweisen.
- Einweg-Endpunkt-/Staging-Haltezeit aus Kategorie und Richtung berücksichtigen.
- Reservierungen auch dann richtig abbilden, wenn dieselbe Fahrt periodisch
  mehrfach in die Ansicht ausgerollt wird.

**Modellvertrag**

Jede `SgTrainrunNodeTrackReservation` enthält mindestens `offset`, `track`,
`arrivalTime`, `departureTime`, `headwayUntilTime`, `trainrunId` und
`occurrenceIndex`; Arrival-/Departure-Section-IDs sind optional.
Reservierungssuche muss Fahrt und Offset berücksichtigen und bei mehreren
Treffern passende Abschnittsbezüge bevorzugen.

**Tests und Abnahme**

- Gleiszuordnungen aus dem Estimator kommen unverändert und deterministisch
  im Modell an.
- Sichtbarkeitsfilter beeinflussen die Schätzung wie in der Referenz.
- Der Reproduktionsfall aus
  [#1375](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1375)
  ist abgedeckt: ICX C3-one-way → A1-one-way und SX B2-one-way → C3-one-way
  werden in ihrer tatsächlichen Fahrtrichtung dargestellt.
- Korridororientierung, Abschnittssegmente, Knotengleisanzahl und
  track reservations testen.
- Fälle mit mehrfachen periodischen Vorkommen und Offset prüfen.
- Endpunktzeiten und vorhandene Streckengrafik-Interaktionen bleiben gemäß
  Referenz funktionsfähig.

### Sub-Issue 4 — Knotenreservierungen in der Streckengrafik rendern

**Abhängigkeiten:** Sub-Issue 3.

#### SDD-Spezifikation

- **Umfang und Ziel:** Bereits integrierte Knotenreservierungen als
  Occupancy-, Headway- und Transit-Geometrie darstellen.
- **Datenvertrag:** Eingabe sind Knotenreservierungen samt Track, Ankunft,
  Abfahrt, Headway-Ende, Abschnittsnachbarn, Render-Offset und Zoom;
  Ausgabe sind die zugehörigen SVG-Elemente/Pfade und Transit-Verbindungen.
- **Regeln und Randfälle:** Vorwärts-/Rückwärtsrichtung, gleiche oder
  fehlende Abschnittsnachbarn, projizierte Pfadenden, One-way-Start/Ende,
  ausgerollte Reservierungen ohne Basisbelegung und kollisionsfreie IDs sind
  abzudecken; bestehende Auswahl-/Klick-/Hover-Interaktionen bleiben erhalten.
- **Referenz und Beleg:** `TrainRunNodeComponent` HTML/TypeScript/SCSS und
  `trainrun-node.component.spec.ts`; Rendering-Testkatalog in Abschnitt 10;
  Issues #1376 und #795 samt Reproduktionen in Abschnitt 2.
- **Nicht-Ziele und Abhängigkeiten:** Keine erneute Gleisberechnung oder
  Änderung am Estimator-Datenvertrag; benötigt die Reservierungen aus
  Sub-Issue 3.
- **Abnahme:** SVG-Assertions belegen Occupancy, Headway und Transit-
  Verbindungen; One-way- und Teilpfad-Reproduktionen sind als Regressionen
  automatisiert abgesichert; bestehende Interaktionen funktionieren.

#### TDD-Testplan — Node-Rendering

- **Muss:** Komponententests prüfen konkrete SVG-Pfade/-Koordinaten für
  Occupancy, Headway und Transit-Verbindungen, einschliesslich Zoom und
  Render-Offset.
- **Muss:** Vorwärts- und Rückwärts-Durchfahrt, gleiche Positionen,
  fehlende Abschnittsnachbarn, One-way-Start/-Ende und ausgerollte
  Reservierung ohne Basisbelegung testen.
- **Muss:** #1376 mit dem C3-one-way-Transitfall als Regression prüfen.
- **Muss:** #795 mit der verlinkten Teilpfad-/Endknoten-Reproduktion als
  gezielten Regressionstest ergänzen; ein verwandter Test ist kein Ersatz
  für die konkrete Reproduktion.
- **Soll:** Track-occupier toggle sowie bestehende Klick-/Auswahl-/Hover-
  Interaktionen mit Component-/Service-Tests absichern.
- **Testreferenz:** `trainrun-node.component.spec.ts` und Testfallkatalog
  Abschnitt 10.

#### Testdaten — Node-Rendering

Quelle: `trainrun-node.component.spec.ts`.

| Testfall | Eingabe | Exaktes Soll |
|---|---|---|
| Occupancy und Headway | Track-X 40; Reservation 10→20; Headway bis 25. | Occupancy `M 40 10 L 40 20`; Headway `M 40 20 L 40 25`. |
| Transitverbindungen | Transitpositionen 0/34/46/60, Ankunfts-/Abfahrtszeit 10/20. | `M 0 10 L 34 10` und `M 46 20 L 60 20`. |
| One-way-Start/-Ende | Jeweils nur Departure- bzw. Arrival-Path-Section vorhanden. | Genau eine Linie: Start `M 46 20 L 60 20`; Ende `M 0 10 L 34 10`. |
| #1376 Transitseite | Trainrun 103 an B2-ONE-WAY=189, beide Fahrtrichtungen. | Rückwärts Start rechts/Ende links; vorwärts Start links/Ende rechts. |
| Ausgerollte Reservation | Keine Basisbelegung; Offset 120, occurrence 4, Zeiten 119→136, Headway-Ende 138, Track 1. | Die ausgerollte Reservation wird mit lokalem Offset gerendert. |
| #795 Teilpfad | Reproduktionsnetz `netzgrafik.8.json`; mehrere interne Knoten ausgewählt, Endknoten-Occupier geöffnet. | Keine Artefakt-/Phantomlinie am projizierten Endknoten. Der konkrete Fehlerfall muss automatisiert nachgebildet werden. |

**Referenzbereich:** `TrainRunNodeComponent` HTML/TypeScript/SCSS sowie deren
Komponententests.

**Ziel:** Gleisbelegung und Transit-Verbindungen ausschließlich auf Basis
konkreter `trackReservation`s rendern.

**Darstellung**

- Gleisreservierung vom Ankunfts- bis Abfahrtszeitpunkt am zugewiesenen Gleis
  zeichnen.
- Headway-Sperrzeit von Abfahrt bis `headwayUntilTime` darstellen.
- Bei eingeklappter Belegung den Knoten-Zeitbereich als reduzierte Linie
  rendern.
- Transit-Verbindungen vom Streckenrand zur Gleisposition für Ankunft und
  Abfahrt zeichnen.
- Seite (links/rechts) aus tatsächlichen Abschnittsnachbarn und
  Streckenposition bestimmen; Rückwärtsabschnitte, projizierte Pfadenden und
  fehlende Nachbarseiten korrekt behandeln.
- Start-/Endknoten und Einweg-Endpunkte mit nur einer Verbindung darstellen.
- Zeiten relativ zum Render-Offset und mit Zoomfaktor abbilden.
- IDs müssen bei unterschiedlichen Reservierungen/Vorkommen kollisionsfrei
  bleiben; bestehende Auswahl-/Klick- und Hover-Verhalten erhalten.

**Tests und Abnahme**

- Exakte SVG-Pfade für Belegung, Headway und Transit-Verbindungen testen.
- Vorwärts- und Rückwärtskanten sowie Nachbarn mit gleichen Positionen
  abdecken.
- Einweg-Start, Einweg-Ende, projizierte Pfadenden und fehlende Reservierung
  testen.
- Die Fälle aus
  [#1376](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1376)
  (fehlerhafte Transitlinien, u. a. C3-one-way) und
  [#795](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/795)
  (Artefakte bei partiellen Trainrun-Pfaden und geöffnetem Endknoten-Occupier)
  reproduzieren und als Regression absichern.
- Periodisch ausgerollte Reservierung ohne Basisbelegung testen.
- Track-occupier ein/aus sowie Klick-/Auswahlverhalten prüfen.

### Sub-Issue 5 — Knotenauslastung auf gemeinsame Knotenschätzung umstellen

**Abhängigkeiten:** Sub-Issue 2; parallel zu Sub-Issues 3 und 4 möglich.

#### SDD-Spezifikation

- **Umfang und Ziel:** Die Knotenauslastungsdaten und -ansicht aus denselben
  zustandslosen Knotenschätzungen wie die Streckengrafik ableiten.
- **Datenvertrag:** Eingaben sind Knoten, sichtbare Trainruns/Abschnitte,
  Ressourcen-/Kapazitätsdaten und Filter; Ausgabe sind zwei
  60-Minuten-Projektionen aus einer 120-Minuten-Schätzung samt Occupancy-,
  Headway-, Kapazitäts- und UI-Daten.
- **Regeln und Randfälle:** Filter bestimmen die geschätzte Fahrtmenge;
  Occupancy und Headway werden separat geclippt; Fenstergrenzen, Toggle-
  Sichtbarkeit, Kapazitätsüberschreitung und Änderungen der Datenquellen
  müssen korrekt behandelt werden. Der zweistündige Turnaround-Fall bei
  Knoten C gehört zum Soll.
- **Referenz und Beleg:** `KnotenAuslastungDataPreparation`,
  `KnotenAuslastungViewComponent`, Templates/Styles und Übersetzungen;
  Knotenauslastung-Testkatalog in Abschnitt 11; Issue #63 und Turnaround-
  Reproduktion in Abschnitt 2. Im Zielbranch wurde kein dedizierter
  View-`*.spec.ts` gefunden; erforderliche Lücken sind als Tests zu ergänzen.
- **Nicht-Ziele und Abhängigkeiten:** Keine zweite fachliche
  Knotengleisberechnung und keine Änderung des Estimator-Verhaltens. Benötigt
  Sub-Issue 2; kann technisch parallel zu Sub-Issues 3 und 4 umgesetzt werden.
- **Abnahme:** Clock- und Streckengrafik-Daten basieren auf derselben
  Schätzung; Filter, Clipping, zwei Stunden, Kapazität und Turnaround sind
  durch gezielte Regressionstests belegt; relevante View-/Estimator-Tests
  bestehen.

#### TDD-Testplan — Knotenauslastung / Frequency Clock

- **Muss:** Neue Tests für Datenaufbereitung und View ergänzen, da im
  Referenzbranch kein dedizierter View-`*.spec.ts` identifiziert wurde.
- **Muss:** Eine 120-Minuten-Schätzung in die Fenster `[0,60)` und `[60,120)`
  projizieren; Occupancy und Headway an beiden Grenzen separat prüfen,
  einschliesslich Belegung, die vor dem Fenster beginnt oder darüber
  hinausreicht.
- **Muss:** Filteränderung verändert nur sichtbare Trainruns und deren
  projizierte Belegung; Kapazität, Mindestgleiszahl und
  Kapazitätsüberschreitung mit konkreten Erwartungen prüfen.
- **Muss:** Stunden-Toggle bei gleichen und unterschiedlichen Projektionen
  sowie Daten-/Ressourcenupdates prüfen.
- **Muss:** #63 und den zweistündigen Turnaround am Knoten C mit
  `networkGraphic (4).json` als explizite Regressionen testen.
- **Testreferenz:** Datenaufbereitung
  `knoten.auslastung.data.preparation.ts`, View-Komponente/Template und
  Anforderungen im Abschnitt 11; neue Spec-Dateien sind Teil der
  Neuimplementierung, falls erforderlich.

#### Testdaten — Knotenauslastung / Frequency Clock

Im Zielbranch wurde für die View keine dedizierte Spec mit Clock-Fixture und
numerischen Sollwerten gefunden. Die folgenden Werte sind daher bekannte
Estimator-Referenzen zur Kreuzprüfung, keine Behauptung, dass es dafür
bereits Clock-Tests gibt. Fehlende View-Testdaten müssen aus der reproduzierten
Issue-/PR-Eingabe und dem Zielverhalten gewonnen werden.

| Prüfpunkt | Verfügbare Eingabe/Referenz | Zu prüfender Soll |
|---|---|---|
| Gemeinsame Knotenschätzung | C3=184, Abschnitt 717; Turnaround-Fälle `(30,30,30)`, `(15,15,45)`, `(15,45,15)`, `(20,40,20)` als `(Frequenz,Ankunft,Abfahrt)`. | Clock und Streckengrafik zeigen für gleiche Eingaben dieselben Gleis-/Occupancy-/Headway-Ergebnisse: Dauer/Headway 30/32, 15/17, 15/17 und 20/22 Minuten. |
| Stundenprojektionen und Clipping | Aus derselben 120-Minuten-Schätzung Fenster `[0,60)` und `[60,120)` erzeugen. | Occupancy und Headway getrennt an den jeweiligen Fenstergrenzen clippen; Fälle mit Start vor sowie Ende nach der Fenstergrenze einschliessen. Exakte Clock-Sollwerte fehlen im Zielbranch und sind aus der Implementierung/Reproduktion abzuleiten. |
| Filter, Kapazität, Toggle und Updates | Issue #63 Beschreibung/Reproduktion; keine dedizierte View-Fixture im Zielbranch. | Nur sichtbare Trainruns projizieren; geschätzte Gleiszahl und Ressourcen-Kapazität getrennt prüfen; Toggle nur bei unterschiedlichen Stundenprojektionen; Datenänderungen aktualisieren die Ansicht. |
| Zweistündiger Turnaround Knoten C | PR-Anhang `networkGraphic (4).json` (nicht im geprüften Worktree vorhanden). | Originaldatei beschaffen und konkrete Ankunft, Abfahrt, Frequenz, Gleiszahl und Clock-Projektion als Assertion extrahieren; keine Werte schätzen oder erfinden. |

**Referenzbereich:** `KnotenAuslastungDataPreparation`,
`KnotenAuslastungViewComponent` samt HTML/SCSS und View-Tests.

**Ziel:** Auslastungsdiagramm aus `NodeTrackEstimate`/`NodeTrackOccupancy`
aufbauen und doppelte Knotenschätzlogik entfernen.

**Zu implementieren**

- Sichtbare Trainruns und Abschnitte bestimmen und einmal pro Update
  `estimateNodeTracks()` für zwei Stunden berechnen lassen.
- Je eine 60-Minuten-Projektion für Stunde 0 und Stunde 1 aus der
  120-Minuten-Schätzung bilden.
- Belegung und Headway separat an Projektionsgrenzen clippen.
- Resultate den relevanten `TrainrunSection`s zuordnen und Name/Tooltip/
  Gegenknoten für die Anzeige ableiten.
- Gleisanzahl aus belegten Gleisen, Ressourcen-Kapazität und Minimum 1
  bestimmen; Kapazitätsüberschreitung darstellen.
- Stundenumschalter nur anzeigen, wenn sich beide Projektionen unterscheiden.
- Aktualisierung bei Änderungen an Knoten, Fahrten, Abschnitten, Filtern und
  Ressourcen anstoßen; Subscriptions beim Destroy beenden.

**Tests und Abnahme**

- Belegungen und Headways am Beginn/Ende eines Stundenfensters korrekt
  abschneiden.
- Über Fenstergrenzen laufende Belegungen in beiden Stunden konsistent
  darstellen.
- Den Fall aus
  [#63](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/63)
  absichern: Filter wirken auf die Auslastung und
  Nachbelegungs-/Headway-Zeit wird bei Gleisbedarf und Anzeige berücksichtigt.
- Den im
  [PR-Kommentar vom 16.10.2026](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/pull/1379#issuecomment-6211729320)
  gemeldeten zweistündigen Turnaround-Fall am Knoten C mit dem dort
  verlinkten `networkGraphic (4).json` abdecken.
- Gleisanzahl, Kapazitätsgrenze und Kapazitätsüberschreitung prüfen.
- Gleiche/abweichende Stundenprojektionen und Toggle-Sichtbarkeit prüfen.
- Filter- und Datenupdates sowie Ressourcenkapazitätsänderungen abdecken.

### Sub-Issue 6 — Streckengrafik-Services und Modell nach Integration vereinfachen

**Abhängigkeiten:** Sub-Issues 3, 4 und 5.

#### SDD-Spezifikation

- **Umfang und Ziel:** Überholte Services, Modellfelder und doppelte
  Berechnungen entfernen, nachdem alle betroffenen Konsumenten auf den neuen
  Datenfluss umgestellt sind.
- **Datenvertrag:** Vorher-/Nachher-Vertrag sind die extern beobachtbaren
  Streckengrafik-, Filter-, Auswahl-, Slider-, Rendering- und
  Knotenauslastungsdaten; intern entfallende Modellfelder/Methoden dürfen
  keine noch verwendeten Konsumenten oder Verhalten brechen.
- **Regeln und Randfälle:** Bestehendes Nutzerverhalten, Übersetzungen und
  Testabdeckung müssen erhalten bleiben; entfernte APIs/Felder dürfen
  projektweit nicht mehr referenziert sein. Weitere Vereinfachungen ausserhalb
  des Refactoring-Deltas werden separat vorgeschlagen.
- **Referenz und Beleg:** Commits `8f6fd718` und `b0311411`; Services `sg-1`
  bis `sg-8`, Modell-/Service-Tests, Estimator- und View-Tests in den
  Abschnitten 8–11; geänderte Referenzdateien in Abschnitt 13.
- **Nicht-Ziele und Abhängigkeiten:** Keine funktionalen Erweiterungen oder
  unabhängigen Aufräumarbeiten; nur nach Sub-Issues 3, 4 und 5.
- **Abnahme:** Entfernte Symbole haben keine projektweiten Verwendungen;
  relevante Modell-, Service-, View- und Übersetzungstests bestehen; Verhalten
  der integrierten Gesamtstrecke bleibt unverändert zur Zielreferenz.

#### TDD-Testplan — Cleanup

- **Muss:** Vor dem Entfernen projektweit Verwendungen der betroffenen
  Felder/Methoden prüfen; danach muss der Build/Typecheck bestätigen, dass
  keine Referenzen übrig sind.
- **Muss:** Betroffene bestehende Modell-, Service-, Estimator- und
  Komponenten-Tests vor und nach Cleanup ausführen; relevante Abdeckung darf
  nicht ersatzlos gelöscht werden.
- **Muss:** Regressionstests für Laden, Pfadaufbau, Filter, Auswahl, Slider,
  Node-Reservierungen, Rendering und Knotenauslastung bestehen.
- **Muss:** Übersetzungs-/Templateprüfungen für Deutsch, Englisch und
  Französisch mitlaufen lassen.
- **Testreferenz:** Geänderte Modell-/Service-Tests und Referenzpfade aus
  Abschnitt 13; für die konkrete Testauswahl die Teilkataloge 8–11.

#### Testdaten — Cleanup/Regression

| Regression | Testdaten/Assertion, die nach Entfernung alter Logik erhalten bleiben muss |
|---|---|
| Abschnitts-Estimator | Gerichtete Profile A→B/B→A, One-way und 62/60-Minuten-Fall gemäss Sub-Issue 1. |
| Knoten-Estimator | A1-Matrix, konfliktfreie Occupancy+Headway und Turnaround-/Periodenfälle gemäss Sub-Issue 2. |
| Service-/Modellintegration | One-way Trainruns 104/105, SX occurrence 4 und Track-Reservations gemäss Sub-Issue 3. |
| Rendering | Exakte Occupancy-/Headway-/Transit-SVGs, #1376 und #795 gemäss Sub-Issue 4. |
| Knotenauslastung | Filter, Clipping, Kapazität und Turnaround; wo keine Zielbranch-Assertion besteht, nur die exakt reproduzierte Sollausgabe aus Sub-Issue 5 als Regression ergänzen. |

**Referenzbereich:** Services `sg-1` bis `sg-8`, Streckengrafik-Modell und
Service-/Modelltests.

**Ziel:** Erst nach erfolgreicher Integration unnötige Zwischenmodelle,
duplizierte Berechnungen und überholte Servicepfade entfernen. Das Ergebnis
soll dem vereinfachten Datenfluss des Referenzbranches entsprechen.

**Zu implementieren**

- Nur Felder und Hilfsfunktionen entfernen, deren Aufgaben durch
  Estimator-Ergebnisse/Reservierungen abgedeckt sind.
- Laden, Pfadaufbau, Trainrun-Modellierung, Filter, Track-Occupier,
  Zeit-/Pfadslider und Rendering entlang der neuen Datenverantwortlichkeiten
  vereinfachen.
- Typen und Datenfluss eng halten: keine Casts oder stillen Ersatzwerte, die
  ungültige fachliche Daten verdecken.
- UI-Labels für Stundenumschaltung in allen vorhandenen Übersetzungen
  ergänzen.
- Keine unabhängige, nicht zum Streckengrafik-Refactoring gehörende
  Aufräumaktion einmischen.

**Tests und Abnahme**

- Bestehende Modell- und Service-Regressionsprüfungen aktualisieren statt
  relevante Abdeckung ersatzlos zu löschen.
- Laden, Pfadbildung, Filter, Auswahl, Slider und Render-Integration
  ausführen.
- Entfernte Felder/Methoden werden projektweit nicht mehr verwendet.
- Übersetzungen und Templates sind für Deutsch, Englisch und Französisch
  vollständig.

### Review-Gate — Gesamtintegration, finale Regression und Merge nach `main`

**Abhängigkeiten:** Implementierungs-Sub-Issues 1–6.

#### SDD-Spezifikation

- **Umfang und Ziel:** Alle separat gereviewten Stack-Änderungen zusammenführen
  und das vollständige Zielverhalten gegen
  Referenzbranch und Parent-Issue-Vertrag prüfen.
- **Datenvertrag:** Eingabe ist der vollständig integrierte Feature-Branch
  samt Subtask-Reviews und Testresultaten; Ergebnis ist ein freigegebener
  Gesamtstand mit dokumentierten Checks, Findings und bekannten Abweichungen,
  der nach Abschluss der Reviews in Abhängigkeitsreihenfolge nach `main`
  integriert werden kann.
- **Regeln und Randfälle:** Die Branch-Gesamtfunktion muss beide Estimator-
  Berechnungen, Integration, Rendering, Knotenauslastung und alle aufgeführten
  Regressionen gemeinsam bestehen; keine Teilergebnisse dürfen nur isoliert
  korrekt sein.
- **Referenz und Beleg:** Parent-Issue-Spezifikation, Abschnitte 8–16,
  Referenzcommit `b0311411c329da055a5560090629d45f749e833f` sowie die
  Repository-Commands für relevante Tests, Lint und Builds.
- **Nicht-Ziele und Abhängigkeiten:** Kein neues fachliches Feature und keine
  nachträgliche Scope-Erweiterung; setzt abgeschlossene Sub-Issues 1–6 und
  deren Reviews voraus.
- **Abnahme:** Alle Stack-Reviews sind abgeschlossen; relevante finale
  Tests, Lint und Builds bestehen; bekannte Review-Findings sind gelöst oder
  explizit dokumentiert; PR-Beschreibungen nennen Scope, Belege und
  Abweichungen.

#### TDD-Testplan — Gesamtintegration

- **Muss:** Alle zugeordneten Sub-Issue-Tests im integrierten Feature-Branch
  ausführen; keine erfolgreiche Teil-Suite ersetzt den Gesamtregressionstest.
- **Muss:** Alle Regressionen #1375, #1376, #795, #63 und den
  zweistündigen Turnaround-Fall gemeinsam auf dem finalen Stand ausführen.
- **Muss:** Relevante vollständige Testsuite, Lint und Build-Commands des
  Repositories laufen lassen und genaue Befehle/Resultate im finalen Review
  dokumentieren.
- **Muss:** Abweichungen, nicht ausführbare Tests oder nur manuell geprüfte
  Fälle ausdrücklich mit Grund und Ergebnis festhalten; nicht als grün
  deklarieren.
- **Abnahme:** Der vollständige Stack verhält sich gemäss Parent-Issue-
  Spezifikation und ist erst nach Abschluss aller Reviews bereit, in
  Abhängigkeitsreihenfolge nach `main` integriert zu werden.

#### Gesamttestdaten — finale Abnahme

| Bereich | Finaler Testdatensatz | Abnahmewert |
|---|---|---|
| Abschnittsschätzung | A/B/C Profile, 62-Minuten-Fahrt bei Frequenz 60, asymmetrische und One-way-Fahrten. | Exakte gerichtete Segmentprofile aus Sub-Issue 1. |
| Knotengleise | A1-Matrix mit Trainruns 99/100, C3-One-way und periodische Turnarounds. | Exakte Zeiten/Tracks und keine Kollision unter Berücksichtigung von Headway. |
| Integration/Rendering | Trainruns 104/105, SX occurrence 4, Track-X=40 Rendering-Fixture. | Richtige Direction/Track-Zuordnung und SVG-Pfadassertions aus Sub-Issues 3/4. |
| Bekannte Fehler | #1375, #1376, #795, #63 sowie C-Turnaround über zwei Stunden. | Jede Regression wird mit ihrer konkreten Issue-/PR-Reproduktion ausgeführt; fehlende Anhänge/Testdaten als Blocker dokumentieren, nicht durch angenommene Werte ersetzen. |

**Ziel:** Neu implementierte Änderung als Ganzes gegen die fachliche
Referenz, automatisierte Tests und UI-Verhalten prüfen.

**Abnahme**

- Die automatisierten Tests aus dem gut getesteten Zielbranch sind den
  Migrationsschritten zugeordnet und auf dem finalen Stand erfolgreich.
- Geänderte Estimator-, Integrations-, Modell- und Renderingtests bestehen.
- Vollständige relevante Test-Suite, Lint und Builds sind grün.
- Keine unaufgelösten Review-Kommentare oder Regressionen in Filter,
  Auswahl, Zeitfenster, Ressourcenkapazität, Richtungs- oder
  Turnaround-Verhalten.
- Alle Stack-Reviews und deren Findings sind abgeschlossen; die PRs werden
  erst danach in der vorgesehenen Abhängigkeitsreihenfolge integriert.
- Die PR-Beschreibungen und der Parent-Issue-Verlauf nennen klar:
  abgedeckte Sub-Issues, wesentliche Verhaltensentscheidungen, Tests und
  bekannte Abweichungen zur Ground Truth.

## 7. SDD/TDD-Slices zum weiteren Schneiden der Implementierung

Die Parent-Sub-Issues 1–6 sind fachliche Bereiche. Die Tabelle unten ist eine
optionale Vorlage, falls ein Stack-PR für ein Review weiter geteilt werden
muss; sie ersetzt nicht die vorgeschlagene Acht-PR-Reihenfolge aus Abschnitt
12 und verlangt keine zusätzlichen Sub-Issues.
Jeder Slice folgt der Reihenfolge **Spec → Red-Test → Implementierung →
Refactor → Review** aus Abschnitt 4. Die Grössen in der letzten Spalte sind
Planungsschätzungen, keine gemessenen Diff-Zahlen; beim Aufteilen anhand des
tatsächlichen Diffs nachjustieren. Die einzelnen Slices können als
gestapelte PRs reviewed und nach Freigabe in Abhängigkeitsreihenfolge nach
`main` integriert werden.
Eng verwandte Slices können zu einem PR zusammengefasst und zu grosse Slices
weiter geteilt werden. Bei einer solchen Änderung die Stack-PR-Nummerierung
und Base-Branches in Abschnitt 12 aktualisieren.

| Slice | Inhalt und Spec-Grenze | TDD-Einstieg / Review-Gate | Grobe Diff-Grösse |
|---|---|---|---:|
| 0.1 Zielbranch-Testinventar | Tests und Fixtures im Referenzbranch den fachlichen Bereichen und Bug-Issues zuordnen. Noch keine Produktivcodeänderung. | Baseline-Suite ausführen; bekannte Testergebnisse notieren. | `+0` / `-0` Code |
| 1.1 Abschnittsinput und Richtung | Korridor-Matching, Deduplizierung, Hin-/Rückrichtung und Einweg-Regel spezifizieren. | Red: Tests zu unpassendem Abschnitt, Korridororientierung und One-way actual direction. | `+150–300` / `-50–150` |
| 1.2 Frequenz, Fahrzeit und Headway | Periodisches Ausrollen inkl. Frequenzoffset, asymmetrischer Fahrzeit und Headway festlegen. | Red: konkrete Erwartung für 62-Minuten-Fahrt bei 60-Minuten-Frequenz und vorhandene A-B/B-C Fälle. | `+250–450` / `-100–250` |
| 1.3 Distanzmatrix zu Segmenten | Zellbelegung in deterministische, normalisierte 0–1-Segmente umwandeln. | Red: exakte Segmentgrenzen und Track-Zahlen der A1-B2-C3-Fixture. | `+250–450` / `-100–250` |
| 2.1 Knotenvorkommen erkennen | Durchfahrt, Halt, Round-trip-Wende und One-way-Endpunkt aus Abschnitten/Übergängen aufbauen. | Red: reale Fixture-Routen inkl. C3-one-way und fehlender Arrival-/Departure-Seite. | `+250–450` / `-50–200` |
| 2.2 Zeiten und periodische Fenster | Ankunft/Abfahrt, Haltezeit, Headway, minimale Wendezeit und Fensterüberlauf berechnen. | Red: wrapped time, kurzer Turnaround, zu kurze Mindestwendezeit, 05→55 und Belegung vor Fensterstart. | `+300–500` / `-100–250` |
| 2.3 Gleisgruppen und Zuteilung | Deterministische Reihenfolge, first-fit-Konfliktprüfung sowie getrennte/geteilte Richtungen spezifizieren. | Red: A1-Matrix exakt, keine überlappenden Headway-Intervalle auf einem Gleis. | `+300–500` / `-100–250` |
| 3.1 Abschnittsergebnis anbinden | Korridorgruppen der Ansicht und `TrackSegmentEstimate` in `TrackData` abbilden. | Red: gleiche Segmentresultate im Sg6-Modell, keine zweite Schätzung. | `+250–450` / `-100–250` |
| 3.2 Node-Reservierungen anbinden | Sichtbare Abschnitte, Estimatorfenster, Offsets und Reservationsdaten in Nodes übertragen. | Red: A1-Matrix und B2 SX occurrence 4; IDs und offsets müssen korrekt matchen. | `+350–600` / `-150–350` |
| 3.3 One-way Integrationsfix (#1375) | Domain-Fahrtrichtung bis in dargestellte Sg-Knoten konsistent erhalten. | Red: beide One-way-Beispiele aus #1375; nur tatsächliche Richtung beiträgt. | `+150–300` / `-100–250` |
| 4.1 Occupancy und Headway zeichnen | Reservierungsintervalle, Offset und Zoom als getrennte SVG-Pfade darstellen. | Red: exakte Pfade für occupancy/headway, eingeklappte Reservierung und fehlende Reservierung. | `+200–400` / `-100–250` |
| 4.2 Transit-Verbindungen ableiten | Linke/rechte Kante aus Abschnittsnachbarn, Richtung und projiziertem Pfad bestimmen. | Red: Vorwärts, rückwärts, gleiche Position, Endknoten und #1376. | `+250–450` / `-150–350` |
| 4.3 Teilpfade und One-way-Rendering (#795) | Projektion mit fehlenden Nachbarn und One-way Start/Ende robust zeichnen. | Red: #795-Reproduktionsnetz plus ein Transit-Pfad an jedem One-way-Ende. | `+150–300` / `-100–250` |
| 5.1 Zwei-Stunden-Estimation und Clipping | Eine Estimation in zwei 60-Minuten-Fenster projizieren, occupancy und headway separat clippen. | Red: Grenzen [0,60), [60,120), überlaufende Belegung und Turnaround-Datei aus PR. | `+250–450` / `-100–300` |
| 5.2 Filter, Kapazität und Clock-UI (#63) | Sichtbare Fahrtmenge, Ressourcenlimit, Toggle und Datenupdates spezifizieren. | Red: Filter ändert Projektion; Kapazitätsgrenze; Toggle nur bei unterschiedlichen Stunden. | `+200–400` / `-100–250` |
| 6.1 Modell-/Service-Cleanup | Veraltete Felder/Services erst entfernen, wenn Verbraucher umgestellt sind. | Vor Entfernen usages prüfen; nach Entfernen Modell-, Service- und View-Suites ausführen. | mehrere PRs, je `+/-200–500` |
| 7.1 End-to-end Review | Gesamten Zielbranch-Vertrag, Bugregressionen, Lint und Builds prüfen. | Alle Tabellenfälle grün; finale CI und Reviewer-Checkliste. | kein zusätzlicher Code-Soll |

**Warum so klein schneiden?** Abschnittsberechnung, Knotenzeiten,
Gleiszuweisung und Rendering haben unterschiedliche fachliche Fehlerquellen.
Wenn sie gleichzeitig geändert werden, ist ein roter Integrationstest schwer
zu diagnostizieren. Kleine vertikale Slices sagen präzise, welcher Vertrag
gerade umgesetzt wird und geben dem Reviewer eine begrenzte Menge an
Verhalten, das gegen den Zielbranch geprüft werden muss.

## 8. Testfallkatalog: Abschnitts-Estimator

Diese Fälle sind im Zielbranch in
`infrastructure-estimator.service.spec.ts` enthalten. Sie prüfen nicht nur,
dass „ein Ergebnis“ zurückkommt, sondern die exakten Segmentgrenzen und
Gleiszahlen.

| Testfall im Zielbranch | Was wird getestet? | Weshalb komplex und wichtig? | Status |
|---|---|---|---|
| A-B und B-C Standardberechnung | Für zwei Korridore werden die erwarteten normalisierten Abschnitte und Gleiszahlen exakt verglichen. | Belegt den Grundvertrag Matrix → Streckensegmente. Ein Fehler in Grenzwerten verändert visuell, wo zusätzlicher Gleisbedarf beginnt/endet. | Vorhanden: `matches the A-B and B-C section track calculation` |
| 62 Minuten Fahrzeit bei 60 Minuten Frequenz | Der Ausrollzeitraum wird über einen vollständigen Frequenzzyklus hinaus erweitert; exakte Überlappungssegmente werden geprüft. | Eine zu kurze Simulation übersieht periodische Überlappung am Zyklusübergang und unterschätzt den Gleisbedarf. | Vorhanden: `handles a 62-minute travel time with a 60-minute frequency` |
| A1-B2 und B2-C3 | Mehrere Abschnitte und Richtungen ergeben konkrete stückweise Gleisprofile; B2→C3 wird auch umgekehrt ausgewertet. | Der Bedarf ist richtungsabhängig. Dieselben Daten dürfen nicht einfach gespiegelt oder in beliebiger Reihenfolge aggregiert werden. | Vorhanden: `matches the A1-B2 and B2-C3 section track calculation` |
| Vollständige A1-B2-C3-One-way-Route | Mehrere reale Korridore samt getrennten One-way-Knoten werden mit exakten Segmentprofilen geschätzt. | Prüft das Zusammenspiel aus realem Netz, Abschnittsauswahl und Fahrtrichtung statt nur eines künstlichen Einzelfalls. | Vorhanden: `estimates all tracks along the A1-B2-C3-one-way-B2-one-way-A1-one-way route` |
| A-B/B-C als Einwegfahrt | Die Einwegfahrt erzeugt nur entlang ihrer tatsächlichen Route Belegung. | Verhindert, dass eine Einwegfahrt fälschlich als bidirektional den Bedarf verdoppelt oder auf der Gegenrichtung auftaucht. | Vorhanden: `matches the A-B and B-C section track calculation - one-way` |
| Zweite Einwegfahrt nur in tatsächlicher Richtung | Eine weitere One-way-Fahrt zählt nur dort, wo sie fährt. | Deckt den in #1375 sichtbaren Grundfehler bereits auf Berechnungsebene ab; Richtung und Abschnittsorientierung müssen gemeinsam stimmen. | Vorhanden: `counts the second one-way trainrun only in its actual direction` |
| Asymmetrische A-B/B-C-Fahrzeiten | Unterschiedliche Fahrzeiten der Teilstücke beeinflussen die Gleisprofile korrekt. | Symmetrische Testdaten können vertauschte Quell-/Zielzeiten kaschieren; reale Strecken sind nicht zwingend symmetrisch. | Vorhanden: `handles asymmetric travel times for the A-B and B-C sections` |
| Ausrollfenster bei Fahrzeit > Frequenz | Das Fenster wird dynamisch erweitert; Profile bleiben vollständig. | Absichert allgemeine Zyklen statt nur den einen 62/60-Minuten-Beispielfall. | Vorhanden: `expands the unrolling window when the section travel time exceeds the frequency` |

### Aus den Tests extrahierte Eingabedaten und Sollwerte

Die folgende Tabelle hält die zentralen Arrange-Daten und konkrete Assertions
aus `infrastructure-estimator.service.spec.ts` fest. Vollständige Fixture-
Objekte und sämtliche Segmenttripel bleiben in der verlinkten Spec bzw. der
JSON-Fixture die maschinenlesbare Referenz.

| Test | Eingabedaten aus dem Test | Erwartete Daten / Assertion |
|---|---|---|
| A-B und B-C | Fixture-Knoten 179→180 mit Abschnitt 713; 180→181 mit Abschnitt 714. | 179→180: `[(0, 1/6, 2), (1/6, 1, 1)]`; 180→181: `[(0, 1, 1)]`, Tupel `(start, end, tracks)`. |
| 62/60-Minuten | Fixture-Abschnitt 713; Fahrzeit sowie Zielankunft und consecutive arrival auf 62 gesetzt; Frequenz im Fixture 60 Minuten. | Vier Segmente: `[(0, .0290322581, 2), (.0290322581, .8537634409, 1), (.8537634409, .9118279570, 2), (.9118279570, 1, 1)]`. |
| A1-B2 / B2-C3 und Gegenrichtung | Fixture A1=182, B2=183, C3=184; A1→B2 Abschnitte 715/718; B2→C3 Abschnitte 716/717/719; derselbe B2-C3-Satz in Gegenrichtung. | A1→B2: `[(0, 3/40, 3), (3/40, 59/120, 2), (59/120, 1, 1)]`. B2→C3 und C3→B2 haben jeweils 10 Segmente mit expliziten Grenzen und Gleiszahlen in der Spec; sie sind absichtlich nicht einfach gespiegelt. |
| Vollständige One-way-Route | Fixture-Knoten A1=182, B2=183, C3=184, A1-ONE-WAY=188, B2-ONE-WAY=189, C3-ONE-WAY=190; genutzte Abschnitte 715–719 und 722–727. | Fünf gerichtete Schätzungen: A1→B2 (3 Segmente), B2→C3 (10), A1-ONE-WAY→B2-ONE-WAY (1), B2-ONE-WAY→C3-ONE-WAY (7), C3→C3-ONE-WAY (3). Sämtliche Segmentgrenzen und Tracks sind in der Testassertion ausgeschrieben. |
| A-B/B-C als Einwegfahrt | Frequenz 60, Offset 0, Richtung `ONE_WAY`; Abschnitte A→B mit Zeiten `6/54 → 0/60`, B→C mit `13/47 → 7/53`. | Jeweils genau ein Gleis über das ganze Segment: `[(0, 1, 1)]`. |
| Zweite Einwegfahrt in tatsächlicher Richtung | Round-trip-Fahrt Frequenz 60 plus One-way-Fahrt Frequenz 30; Hinabschnitt Zeiten 5/25→35/55, One-way-Rückabschnitt 51/59→1/9. | Für A→B: `[(0, 59/75, 1), (59/75, 139/150, 2), (139/150, 1, 1)]`. |
| Asymmetrische A-B/B-C-Fahrzeiten | A-B: Round-trip 60 Min. plus rückwärts One-way 30 Min.; B-C: Round-trip 60 Min., rückwärts One-way 30 Min. und vorwärts One-way 15 Min.; die Abschnittszeiten sind je Richtung verschieden. | A-B drei Segmente; B-C sieben Segmente; genaue Grenzwerte und Tracks stehen als Tupel im Spec-Test. |
| Ausrollfenster wird erweitert | Frequenz 60, Offset 0; künstlicher Abschnitt mit Zeiten `source 2/187`, `target 233/418` (Fahrzeit über Frequenz). | 13 Segmente mit alternierender 1-/2-Gleisbelegung; exakte normalisierte Grenzen sind im Spec-Test festgehalten. |

## 9. Testfallkatalog: Knotengleis-Estimator

Diese Fälle stammen aus `infrastructure-estimator.node-track.spec.ts`.
Zusammen prüfen sie sowohl die lokale Zeitrechnung als auch die globale
Zuweisung zu Gleisen.

| Testfall im Zielbranch | Was wird getestet? | Weshalb komplex und wichtig? | Status |
|---|---|---|---|
| Keine überlappenden Belegungen auf einem Gleis | Für jeden Fixture-Knoten werden alle zugewiesenen Occupancies samt Headway auf Konflikte geprüft. | Zwei Züge kollidieren auch dann, wenn die reine Standzeit nicht überlappt, aber die Sperrzeit noch läuft. | Vorhanden: `does not overlap track occupancy for any fixture node` |
| A1-Matrix-Zuweisung | Konkrete Zug-/Zeit-/Gleis-Zeilen von vor/nach Fenstergrenzen müssen exakt zugeordnet werden. | Ein Algorithmus kann kollisionsfrei sein und trotzdem falsche Gleisnummern liefern; die Matrix prüft die fachlich erwartete deterministische Zuteilung. | Vorhanden: `keeps the A1 matrix track assignments` |
| Reale C3-One-way-Route | Der Estimator erkennt die One-way-Fahrt in der JSON-Fixture und liefert eine Occupancy in korrekter Richtung. | Verbindet die Richtungsregel mit realen Domainobjekten und nicht nur einem handgebauten Mock. | Vorhanden: `uses the real C3 one-way route from the JSON fixture` |
| Wrapped Turnaround-Zeiten normalisieren | Mehrere Frequenzen und Ankunft/Abfahrt-Kombinationen über Zyklusgrenzen ergeben Dauer, Headway und Track-Anzahl. | Zeitwerte in periodischen Fahrplänen können um den Zyklus gewrappt sein; naive Subtraktion erzeugt negative oder zu lange Standzeiten. | Vorhanden: `normalizes wrapped turnaround times before calculating track strands` |
| Zu kurze Wende auf Folgezyklus verschieben | Eine Mindestwendezeit, die im aktuellen Zyklus nicht passt, verschiebt die Abfahrt in den nächsten Frequenzzyklus. | Ein falsches Ergebnis kann eine unmögliche Verbindung oder fälschlich freie Gleise anzeigen. | Vorhanden: `moves a still-too-short turnaround to the following frequency cycle` |
| Gültige 5-Minuten-Wende im selben Zyklus lassen | Eine zulässige kurze Wende wird nicht unnötig in die nächste Periode verschoben. | Gegenprobe zur Mindestwende: zu aggressive Normalisierung erzeugt künstliche Verspätung und zusätzliche Konflikte. | Vorhanden: `keeps a valid five-minute turnaround in the same cycle` |
| 05→55 periodische Wende | Die periodische Abfahrt wird auf die nächste passende 15-Minuten-Abfahrt abgebildet. | Ein scheinbar grosser Unterschied zwischen Uhrzeitwerten kann durch Periodizität tatsächlich eine kurze Wende bedeuten. | Vorhanden: `chooses the next 15-minute departure for a 05-to-55 periodic turnaround` |

### Aus den Knotengleis-Tests extrahierte Eingabedaten und Sollwerte

Quelle: `infrastructure-estimator.node-track.spec.ts` und
`testNetzugrafikTrackEstimator.json`.

| Test | Eingabedaten aus dem Test | Erwartete Daten / Assertion |
|---|---|---|
| Konfliktfreiheit auf Fixture | Alle Fixture-Knoten; Fensterende 180 Minuten; gemeinsame Richtungs-Gleise (`separateForwardBackwardTracks: false`). | Für jedes Gleis ist jede nächste Occupancy frühestens bei `headwayUntilMinute` der vorherigen Occupancy erlaubt. |
| A1-Matrix | Knoten A1=182; Fenster `[-60, 271]`; getrennte Richtungs-Gleise. Testfahrten 99 und 100 mit 12 periodischen Vorkommen. | Exakte Matrix `(trainrun, arrival, departure, track)`: `(99,-60,0,4)`, `(100,-31,1,1)`, `(100,-1,31,2)`, `(99,0,60,3)`, `(100,29,61,1)`, `(100,59,91,2)`, `(99,60,120,4)`, `(100,89,121,1)`, `(100,119,151,2)`, `(99,120,180,3)`, `(100,149,181,1)`, `(100,179,211,2)`. |
| C3-One-way aus Fixture | Knoten C3=184 und C3-ONE-WAY=190; Fixture-Abschnitte; Fensterende 120; getrennte Richtungs-Gleise. | Es entstehen Tracks und mindestens eine Occupancy mit `direction === "one_way"`. |
| Wrapped Turnarounds | C3=184, Abschnitt 717, Fenster `[0,120]`, gemeinsame Richtungs-Gleise; Testfälle `(frequency, arrival, departure)`: `(30,30,30)`, `(15,15,45)`, `(15,45,15)`, `(20,40,20)`. | Jeweils 2 Tracks; Occupancy ab Minute 0 mit erwarteter Dauer/Headway: `(30,32)`, `(15,17)`, `(15,17)`, `(20,22)`. |
| Mindestwende verschiebt Zyklus | Frequenz 30, Mindestwende 35; Abschnitt 717; source arrival/departure 30/30; Fenster `[0,120]`. | Occurrence mit Ankunft 0 fährt erst bei Minute 60 ab. |
| Gültige 5-Minuten-Wende | Frequenz 15; Abschnitt 717; source arrival/departure 5/10; Fenster `[0,60]`. | Ein Gleis; Occupancy 5→10 bleibt im selben Zyklus. |
| 05→55 | Frequenz 15; Abschnitt 717; source arrival/departure 5/55; Fenster `[0,60]`. | Periodische Abfahrt wird auf Minute 10 normalisiert; Occupancy 5→10. |

## 10. Testfallkatalog: Streckengrafik-Integration und Rendering

Die Integrationstests prüfen, ob Estimator-Resultate verlustfrei ins
Streckengrafik-Modell gelangen. Die Komponententests prüfen anschliessend die
konkreten SVG-Pfade.

| Testfall / Regression | Was wird getestet? | Weshalb komplex und wichtig? | Status im Zielbranch |
|---|---|---|---|
| Gleiche Trainrun-Liste erneut emittiert | Streckengrafik-Items werden bei wiederholtem Emit derselben Array-Referenz neu aufgebaut. | RxJS-/Referenzidentität kann sonst dazu führen, dass der Bildschirm alte Reservierungen zeigt, obwohl Services aktualisiert wurden. | Vorhanden: `rebuilds trainrun items when the same trainrun array is emitted again` |
| One-way-Abschnitte behalten tatsächliche Node-Richtung | Die Sg-Abschnitte erhalten die Richtung der Domainfahrt. | Verhindert Richtungsinversion zwischen Domainmodell, Pfadmodell und Estimator (#1375). | Vorhanden: `keeps one-way trainrun sections in their actual node direction` |
| REX-Transitlinien auf korrekter B2-One-way-Seite | Transit-Pfade starten und enden je nach Richtung an der richtigen Node-Kante. | Seite wird aus Pfadnachbarn und Richtung abgeleitet; eine falsche Seite lässt den Pfad visuell kreuzen oder abbrechen (#1376). | Vorhanden: `renders REX TransitLines on the correct sides at B2-ONE_WAY` |
| A1-Node-Tracks aus Estimator-Matrix | Die konkreten Track-Nummern der integrierten Knotenknoten entsprechen direkt der Estimator-Matrix. | Isoliert einen Datenmapping-Fehler zwischen korrektem Estimator und falscher Streckengrafik-Reservierung. | Vorhanden: `renders A1 node tracks directly from the estimator table` |
| B2 SX occurrence 4 → Matrix Track 1 | Ein periodisch ausgerolltes Vorkommen wird über occurrence/offset auf die richtige Matrix-Gleisnummer abgebildet. | Der Trainrun kann mehrmals im sichtbaren Fenster vorkommen; nur die Trainrun-ID reicht zum eindeutigen Mapping nicht. | Vorhanden: `maps B2 SX occurrence 4 to matrix track 1` |
| Occupancy und Headway-Pfade | SVG-Geometrie für Belegung, Headway und Pfadverbindungen wird exakt verglichen. | Zeit-Offset und Zoom beeinflussen Geometrie; getrennte Segmente müssen korrekt übereinanderliegen und anklickbar bleiben. | Vorhanden: `renders matrix occupancy and path-order connections` |
| Turnaround ohne unterschiedliche Positionen | Wenn Ankunft und Abfahrt dieselbe Streckenposition haben, werden Abschnittsenden als Fallback verwendet. | Degenerierte Positionen lassen die übliche Links-/Rechts-Nachbarschaftslogik mehrdeutig werden. | Vorhanden: `uses section endpoints when turnaround positions are not distinct` |
| Vorwärts-Durchfahrt mit konkreten Nachbarn | Links/rechts werden aus den tatsächlichen Abschnittsnachbarn bestimmt. | Pfadposition allein genügt nicht in allen Projektionen; falsche Nachbarn drehen Transitlinien um. | Vorhanden: `uses concrete section neighbors for forward through nodes` |
| Rückwärtsabfahrt | Incoming und outgoing neighbors werden mit umgekehrter Richtung korrekt verbunden. | Rückwärtsfahrten kehren die Bedeutung von Arrival/Departure relativ zur Ansicht um. | Vorhanden: `uses incoming and outgoing neighbors for reverse departures` |
| One-way-Start und -Ende | Genau eine Transitlinie wird für den existierenden Anschluss gezeichnet. | Endpunkte haben absichtlich nur einen realen Abschnitt; ein allgemeiner Durchfahrtsrenderer würde eine Phantomverbindung erzeugen. | Vorhanden: `renders one TransitLine at a one-way start node` und `... at a one-way end node` |
| Ausgerollte Reservierung ohne Basisbelegung | Ein periodisches Vorkommen ausserhalb der Grundbelegung wird mit lokalem Offset korrekt gerendert. | Sichtfenster und Grundperiode sind nicht deckungsgleich; das verhindert fehlende Linien bei Zeitverschiebung. | Vorhanden: `renders a rolled-out reservation without a base occupancy` |
| Teilpfad am geöffneten Endknoten (#795) | Projektion mit mehreren ausgewählten internen Knoten erzeugt keine Artefakte am Endknoten-Occupier. | Am projizierten Rand fehlen reale Nachbarn; die Komponente muss zwischen echter Kante und künstlicher Pfadgrenze unterscheiden. | Im PR adressiert; genaue Issue-Reproduktion als eigener Red-Test im Migrations-PR verifizieren/ergänzen. |

### Aus Integration-/Renderingtests extrahierte Eingabedaten und Sollwerte

Quelle: `streckengrafik.services.spec.ts`,
`trainrun-node.component.spec.ts` und
`testNetzugrafikTrackEstimator.json`.

| Test | Eingabedaten aus dem Test | Erwartete Daten / Assertion |
|---|---|---|
| One-way-Richtung (#1375) | Fixture-Fahrten 104 (ICX) und 105 (SX); Knoten 190→189→188 bzw. 189→190; Abschnitte 724/726. | ICX Nodes `[190,189,188]`, rückwärts markiert, Abfahrt C3=43 und Ankunft A1=59; SX Nodes `[189,190]`, vorwärts, Abfahrt B2=1 und Ankunft C3=25. C3-Track: ICX 2, SX 1. |
| REX Transitseite (#1376) | Trainrun 103, beide Vorkommen am B2-ONE-WAY-Knoten 189. | Rückwärts: Pfad startet an der rechten Node-Kante und endet links; vorwärts: startet links und endet rechts. |
| A1 Track-Zuweisung | Fixture-Trainruns 99/100 am Node 182. | `(trainrun, arrival, departure, track)`: `(99,-60,0,4)`, `(99,0,60,3)`, `(100,-31,1,1)`, `(100,-1,31,2)`. |
| B2 SX occurrence 4 | SX Trainrun 101, Node 183; Node-Ankunft/Abfahrt `-1/16`; Reservierung `119/136`, Offset 120. | Reservierung ist Gleis 1 zugeordnet. |
| Occupancy-/Headway-SVG | Component-Setup mit Reservation 10→20, Headway-Ende 25, Track-Position 40 und Transitpositionen 0/34/46/60. | Exakte Pfade: Occupancy `M 40 10 L 40 20`; Headway `M 40 20 L 40 25`; Transit `M 0 10 L 34 10` und `M 46 20 L 60 20`. Bei Offset 120 verschiebt sich Track-X auf 20; ohne Reservation sind beide Belegungspfade leer. |
| Vorwärts-/Rückwärtsnachbarn und Degeneration | Component-Fixture mit konkreten Path-Section-Nachbarn; Rückwärtsabschnitt hat `backward=true`. | Vorwärts- und Rückwärtspfade verbinden die jeweiligen tatsächlichen Nachbarseiten; bei gleichen turnaround-Positionen dienen Abschnittsenden als Fallback. Exakte SVG-Pfade stehen im Component-Spec. |
| One-way-Endpunkte | Jeweils eine Arrival- oder Departure-Path-Section wird entfernt. | Genau eine Transitlinie: One-way-Start `M 46 20 L 60 20`; One-way-Ende `M 0 10 L 34 10`. |
| Ausgerollte Reservation ohne Basisbelegung | Basisnode -1→16; Reservation Offset 120, occurrence 4, Zeiten 119→136, Headway-Ende 138, Track 1. | Reservation wird für das ausgerollte Vorkommen gerendert, obwohl es keine Basisbelegung desselben Zeitbereichs gibt. |
| #795 Teilpfad-Reproduktion | Im gefundenen Component-Spec kein eigener Test mit dem verlinkten Issue-Netz `netzgrafik.8.json` identifiziert. | Die im PR adressierte konkrete Issue-Reproduktion bleibt als Testlücke ausgewiesen; sie darf nicht als bereits vorhandene Fixture-Assertion gezählt werden. |

## 11. Testfallkatalog: Knotenauslastung / Frequency Clock

Die Knotenauslastungsaufbereitung verwendet dieselben Knotenschätzungen wie
die Streckengrafik. Dadurch ist sie fachlich besonders wichtig: Zwei Ansichten
desselben Knotens dürfen nicht unterschiedliche Gleisbedarfe suggerieren.
Im Zielbranch ist die Datenaufbereitung in
`knoten.auslastung.data.preparation.ts` umgesetzt. In der View-Ordnerprüfung
wurde kein dediziertes `*.spec.ts` für diese Datenaufbereitung gefunden. Wo
kein direkter Unit-Test vorhanden ist, ist die folgende Zeile daher ein
konkreter Migrations-/Review-Testfall, der im SDD/TDD-Slice neu automatisiert
werden sollte.

| Testfall / Herkunft | Was wird getestet? | Weshalb komplex und wichtig? | Status im Zielbranch |
|---|---|---|---|
| Gemeinsame Estimator-Ausgabe (#63) | Frequency Clock und Streckengrafik beziehen Gleiszuweisung und Occupancy aus derselben Regelbasis. | Getrennte Berechnungen driften über Zeit auseinander und zeigen unterschiedliche Gleisanzahl. | Implementiert; Clock-Datenaufbereitung direkt gezielt testen. |
| Filter auf sichtbare Trainruns (#63) | Filteränderung verändert nur die in der Clock projizierten Fahrten und deren Belegung. | Ein Estimator kann korrekt sein, aber mit ungefilterten Abschnitten falsche Kapazität anzeigen. | Zielverhalten implementiert; kein dedizierter View-Spec gefunden, als Clock-Regressionstest ergänzen. |
| Occupancy-/Headway-Clipping auf 60-Minuten-Fenster | Eine Belegung und ihre Nachbelegungszeit werden separat an Fenstergrenzen abgeschnitten. | Die Standzeit kann im Fenster enden, während Headway darüber hinaus blockiert; beides muss sichtbar und rechnerisch korrekt sein. | Implementiert; kein dedizierter View-Spec gefunden, gezielte Grenzwerttests ergänzen. |
| Projektionen Stunde 0 und Stunde 1 | Zwei aufeinanderfolgende 60-Minuten-Ansichten werden aus dem 120-Minuten-Zeitraum erzeugt. | Periodische Wiederholungen und über Projektionsgrenzen reichende Belegungen können sonst fehlen oder doppelt erscheinen. | Implementiert; beide Projektionen und Toggle als Reviewfälle prüfen. |
| Zweistündiger Turnaround am Knoten C (PR-Kommentar) | `networkGraphic (4).json` reproduziert den gemeldeten Wende-Fehler und wird gegen den Zielbranch-Erwartungsfall geprüft. | Turnaround-Regel, Periodenausrichtung und Projektion wirken zusammen; ein Ein-Stunden-Test findet den Fehler nicht zwingend. | PR-Reproduktionsfall; als expliziten Red-/Regressionstest übernehmen. |
| Kapazität und Gleisanzahl | Anzeige verwendet mindestens ein Gleis und berücksichtigt Ressourcen-Kapazität sowie Überschreitung. | Infrastrukturkapazität und tatsächlich geschätzte Belegung sind unterschiedliche Werte und müssen getrennt dargestellt werden. | Implementiert; Darstellung und Grenzwerte gezielt reviewen. |
| Stunden-Toggle | Toggle erscheint nur, wenn beide Projektionen verschieden sind; Wechsel zeigt die korrekte Projektion. | Verhindert unnötige UI und stellt zugleich sicher, dass ein realer Unterschied nicht verborgen bleibt. | Implementiert; eigener Komponenten-/View-Test empfohlen. |
| Daten-/Ressourcenupdates und Lifecycle | Änderungen an Trainruns, Abschnitten, Knoten, Filtern und Ressourcen aktualisieren die Ansicht; Destroy beendet Subscriptions. | Mehrere asynchrone Datenquellen erzeugen leicht veraltete Anzeigen oder Lifecycle-Leaks. | Implementiert; Update-/Destroy-Verhalten im View-Test ergänzen oder gezielt manuell prüfen. |

### Datenlage für Knotenauslastungstests

Für `knoten-auslastung-view` und
`knoten.auslastung.data.preparation.ts` wurde im Zielbranch kein dedizierter
`*.spec.ts`-Test gefunden. Daher gibt es aus diesen Dateien keine
View-Test-Fixture und keine exakten Clock-Assertions, die als bereits
vorhanden dokumentiert werden könnten. Die nachfolgenden Daten sind die
konkreten verfügbaren Belege; fehlende Werte müssen beim Anlegen der Tests
aus dem Zielbranch-Verhalten bzw. der Issue-Reproduktion festgelegt werden,
nicht aus der nicht mehr verfügbaren Excel-Datei abgeleitet werden.

| Prüfbereich | Verfügbare Testdaten / Beleg | Was der neue Test konkret prüfen muss |
|---|---|---|
| Gemeinsame Knotenschätzung | Die Estimator-Referenzdaten und Turnaround-Assertions sind in Abschnitt 9 aufgeführt; insbesondere die A1-Matrix sowie die vier Fälle mit Frequenz 30/15/15/20 und Headways 32/17/17/22. | Clock-Projektion verwendet dieselben Tracks, Occupancy-Dauern und Headways wie der Estimator für dieselben Eingaben. |
| Sichtbarer Filter | Keine eigenständige Clock-Fixture oder exakte erwartete Liste in einer View-Spec gefunden. | Für denselben Knoten einmal ungefilterte und einmal gefilterte Trainruns einspeisen; nur die gefilterten Trainruns dürfen in Occupancy/Clock-Projektion erscheinen. |
| 60-Minuten-Projektion und Clipping | Keine eigenständige Clock-Spec mit Fensterdaten gefunden. | Ein Testfall mit Belegung bzw. Headway über Minute 60 anlegen; Occupancy und Headway getrennt am Fensterende prüfen. |
| Projektionen Stunde 0 / Stunde 1 | Keine eigenständige Fixture oder Sollwerte für den Toggle gefunden. | Dasselbe 120-Minuten-Estimator-Ergebnis in die Fenster `[0,60]` und `[60,120]` projizieren; Inhalte und Toggle-Sichtbarkeit bei gleichen/verschiedenen Projektionen prüfen. |
| Zweistündiger Turnaround an Knoten C (#63 / PR-Kommentar) | Der im Dokument erwähnte `networkGraphic (4).json`-Reproduktionsfall liegt nicht im geprüften Repository-Worktree; keine View-Spec enthält dazu konkrete Ankunfts-/Abfahrtswerte oder Soll-Clock. | Bevor ein numerischer Erwartungswert festgeschrieben wird, die Originalreproduktion aus Issue/PR beschaffen bzw. den Fehler reproduzieren und die korrigierte Zielbranch-Ausgabe als Assertion erfassen. Nicht durch einen erfundenen Testfall ersetzen. |
| Kapazität, Updates und Lifecycle | Keine dedizierten View-Testdaten oder Ressourcen-Sollwerte in einer View-Spec gefunden. | Ressourcenlimit getrennt von geschätzter Gleiszahl prüfen; Datenänderungen aktualisieren die Projektion und Destroy beendet Subscriptions. |

## 12. Gemessene Commit-Grössen und Vorschlag für den Review-Stack

Die folgenden Zahlen stammen aus den tatsächlichen Commits des
Referenzbranches (`git show --numstat`). Sie sind damit eine bessere
Aufwandsorientierung als eine abstrakte Schätzung. Die Werte zeigen die
Änderungsmenge **in den damaligen Commit-Diffs**, nicht die Zeilenanzahl des
fertigen Codes.

| Neuimplementierungs-/Review-Schritt | Referenz-Commit(s) | Dateien im Commit-Diff | Änderungen `+` / `-` | Grössenordnung |
|---|---|---:|---:|---|
| 0. Getestete Zielbranch-Baseline erfassen | kein eigener Code-Commit | — | `+0` / `-0` Codezeilen; Testinventar/Review-Doku | klein |
| 1. Abschnitts-Estimator | `e925c43a` | 4 | `+754` / `-123` | mittel |
| 2. Knotengleis-Estimator | `3fe42c21` | 3 | `+1.183` / `-50` | gross |
| 3. Estimator in Streckengrafik integrieren und Fixture ergänzen | `3c99d189` | 5 | `+1.432` / `-160` | gross |
| 3a. Estimator stabilisieren und bekannte Randfälle korrigieren | `3ca7e9b8` | 14 | `+1.961` / `-1.840` | sehr gross; gemischter Folgecommit |
| 4. Knotenreservierungen rendern | `eaf9a35b` | 13 | `+638` / `-302` | mittel |
| 5. Reservierungen bewahren und Knotenauslastung umstellen | `182c07c1` | 17 | `+563` / `-306` | mittel |
| 6. Services und Modell vereinfachen | `8f6fd718` | 19 | `+998` / `-1.995` | sehr gross; überwiegend Umbau/Löschung |
| 7. Abschliessende Estimator-Anpassungen | `b0311411` | 3 | `+779` / `-854` | gross; quer über Estimator und Integration |

### Vorschlag für einen Review-Stack

Da die vorhandene Commit-Reihenfolge die Entwicklung bereits in Schritte
gliedert, ist der einfachste erste Vorschlag **ein Parent-Issue (#1358) und
ein Stack aus den vorhandenen acht Commits**. Die Commits bleiben in ihrer
Reihenfolge; die fachlichen Sub-Issues 1–6 aus Abschnitt 6 dienen zur
Orientierung und müssen nicht eins zu eins mit den PRs übereinstimmen.
Insbesondere braucht es kein eigenes Sub-Issue pro Commit.

| PR | Vorgeschlagener PR-Titel | Referenz-Commit | Branch-Name | Base-Branch | Verknüpfte Issues |
|---:|---|---|---|---|---|
| 1 | `refactor: extract section track estimator` | `e925c43a` | `refactor/1358-01-section-estimator` | `main` | #1358, Sub-Issue 1 |
| 2 | `refactor: introduce node track estimator` | `3fe42c21` | `refactor/1358-02-node-estimator` | `refactor/1358-01-section-estimator` | #1358, Sub-Issue 2 |
| 3 | `refactor: integrate node track estimator` | `3c99d189` | `refactor/1358-03-estimator-integration` | `refactor/1358-02-node-estimator` | #1358, Sub-Issues 2 and 3 |
| 4 | `fix: stabilize infrastructure track estimation` | `3ca7e9b8` | `refactor/1358-04-estimator-stabilization` | `refactor/1358-03-estimator-integration` | #1358, Sub-Issues 1–4 |
| 5 | `refactor: rebuild Streckengrafik node rendering` | `eaf9a35b` | `refactor/1358-05-node-rendering` | `refactor/1358-04-estimator-stabilization` | #1358, Sub-Issues 1–4 |
| 6 | `fix: preserve node reservations and occupancy rendering` | `182c07c1` | `refactor/1358-06-node-occupancy-view` | `refactor/1358-05-node-rendering` | #1358, Sub-Issues 3–5 |
| 7 | `refactor(streckengrafik): simplify services and model` | `8f6fd718` | `refactor/1358-07-service-cleanup` | `refactor/1358-06-node-occupancy-view` | #1358, Sub-Issue 6 |
| 8 | `fix: finalize estimator and math edge cases` | `b0311411` | `refactor/1358-08-final-estimator-fixes` | `refactor/1358-07-service-cleanup` | #1358, Sub-Issues 1–3 |

Die Branch-Namen und Basen in der Tabelle sind ein direkt verwendbarer
Vorschlag. Jeder PR enthält nur den Änderungsschritt gegenüber seinem
Vorgänger; dadurch prüft der Reviewer den inkrementellen Diff statt bei jedem
PR erneut den gesamten Stack. Die acht Referenz-Commits sind der
Ausgangspunkt für die Zuordnung, nicht Commits, die blind auf den heutigen
`main` gecherry-picked werden sollen. Die Änderungen müssen auf aktuellem
`main` neu aufgebaut werden; dabei werden Commit-Grenzen soweit möglich
erhalten und Konflikte gegen spätere `main`-Änderungen gelöst.

**Lokales Vorgehen für den Stack-Aufbau:** Die Commit-Änderungen können
schrittweise auf die neuen Branches übertragen werden. Beispiel für PR 1:

```bash
git switch main
git pull --ff-only
git switch -c refactor/1358-01-section-estimator
git cherry-pick e925c43a
```

Nach dem Lösen allfälliger Konflikte die Tests für Sub-Issue 1 ausführen,
den Branch pushen und einen PR mit Base `main` erstellen. Für PR 2 vom
Branch `refactor/1358-01-section-estimator` einen neuen Branch
`refactor/1358-02-node-estimator` anlegen und dort `git cherry-pick
3fe42c21` ausführen; danach analog für die weiteren Zeilen der Stack-Tabelle.
Jeder Schritt übernimmt nur den zugehörigen Commit-Diff auf dem bereits
rekonstruierten Vorgängerstand. Falls ein Commit nicht sauber übertragbar
ist, nicht erzwingen: den Schritt anhand des tatsächlichen Diffs manuell
rekonstruieren, Tests ausführen und die Abweichung im PR beschreiben.

Falls ein Commit für ein eigenständiges Review zu gross oder fachlich
gemischt ist, kann er vor dem Review geteilt werden. Umgekehrt können
nahe beieinanderliegende Änderungen als ein PR zusammengefasst werden, ohne
dafür zwingend ein neues Issue anzulegen. In beiden Fällen die Branch-/Base-
Kette und die Issue-Zuordnung in dieser Tabelle aktualisieren.

**PR-Beschreibungsvorlage für jeden Stack-Schritt**

```markdown
Part of #1358
Related sub-issue(s): #<Sub-Issue-Nummer(n)>
Stack: <PR-Nummer>/8
Base: <Base-Branch aus der Tabelle>

## Umfang
<Was dieser Schritt gegenüber seinem Base-Branch ändert>

## main → Referenz-Delta
<Welche Änderung aus dem Zielbranch hier umgesetzt wird>

## Tests
- <ausgeführter Test / Ergebnis>

## Nicht-Ziele / offene Punkte
- <falls vorhanden>
```

In allen PRs vor dem letzten Stack-Schritt **nicht** `Closes #1358` oder
`Closes #<Sub-Issue>` angeben: ein früher Merge würde das Issue sonst
vorzeitig schliessen, obwohl weitere Stack-Schritte noch fehlen. Issues erst
nach dem jeweils letzten zugehörigen PR schliessen; das Parent-Issue #1358
erst nach dem letzten Stack-PR und erfolgreicher Gesamtregression
abschliessen.

Alle Stack-Schritte werden zunächst reviewed; sie werden nicht währenddessen
nach `main` gemergt. Nach Freigabe wird der Stack von der Basis nach oben
integriert: PR 1 nach `main`, danach PR 2 und so weiter. Nach jedem Merge
wird der nächste PR auf den aktualisierten Base-Branch ausgerichtet und sein
Diff geprüft, damit bereits integrierte Änderungen nicht nochmals im
Änderungssatz erscheinen. Falls der Repository-Workflow gestapelte PRs nicht
unterstützt, kann der vollständig geprüfte Stack stattdessen über einen
abschliessenden PR gegen `main` integriert werden.

**Grössenordnung und Reviewbarkeit:** Die gemessenen Commit-Diffs zeigen,
dass insbesondere der Knotengleis-Estimator (`+1.183/-50`), die Integration
mit Fixture (`+1.432/-160`), der Stabilisierungs-Mischcommit
(`+1.961/-1.840`), das Cleanup (`+998/-1.995`) und der Abschlusscommit
(`+779/-854`) grosse oder gemischte Diffs sind. Diese Zahlen sind historische
Commit-Grössen, nicht die vorhergesagte Grösse der gestapelten PRs. Vor dem
Anlegen eines PRs ist der tatsächliche Teil-Diff zu prüfen; grosse Pakete
werden nach fachlich testbaren Ergebnissen weitergeteilt. Zeilenzahl ist ein
Risikosignal, kein Qualitätsmass; der Commit-Schnitt bleibt dabei der
Ausgangspunkt und wird nur geändert, wenn das Review davon profitiert.

**Korrekte Grössenbasis:** Der finale Diff vom gemeinsamen Ausgangspunkt
(Merge-Base `54edce2f`) zum Referenzstand umfasst 34 Dateien mit
`+5.311/-2.633` Zeilen. Die Summe der Commit-Diffs ist höher, weil dieselben
Dateien in späteren Commits erneut geändert wurden. Der Vergleich mit
aktuellem `main` muss ausserdem spätere, fachfremde Änderungen erhalten;
der Referenzbranch darf deshalb nicht blind auf `main` zurückgesetzt werden.

## 13. Referenzdateien und Tests im Zielbranch

| Bereich | Referenzpfade im Branch |
|---|---|
| Estimator-Typen und Berechnung | `src/app/services/infrastructure/infrastructure-estimator.service.ts` |
| Abschnitts-Estimator-Tests | `src/app/services/infrastructure/infrastructure-estimator.service.spec.ts` |
| Knotengleis-Estimator-Tests | `src/app/services/infrastructure/infrastructure-estimator.node-track.spec.ts` |
| Streckengrafik-Integration | `src/app/streckengrafik/services/sg-6-track.service.ts` |
| Knotenreservierungsmodell | `src/app/streckengrafik/model/streckengrafik-model/sg-trainrun-node.ts` |
| Knoten-Rendering | `src/app/streckengrafik/components/train-run-node/trainrun-node.component.ts` und `.html` |
| Renderingtests | `src/app/streckengrafik/components/train-run-node/trainrun-node.component.spec.ts` |
| Streckengrafik-Serviceintegrationstests | `src/app/streckengrafik/services/streckengrafik.services.spec.ts` |
| Knotenauslastung-Datenaufbereitung | `src/app/view/knoten-auslastung-view/knoten.auslastung.data.preparation.ts` |
| Knotenauslastung-Ansicht | `src/app/view/knoten-auslastung-view/knoten-auslastung-view.component.ts` und Template/Styles |
| Größere Integrations-Testdaten | `src/integration-testing/test-data/testNetzugrafikTrackEstimator.json` |
| Integrationstest-Einstieg | `src/integration-testing/netzgrafik.unit.testing.track.estimator.ts` |
| Mathematische Guards/Hilfen | `src/app/utils/math.ts` |

Die Dateien zeigen die tatsächlich geänderten Verantwortlichkeiten und das
bereits getestete Verhalten im Zielbranch. Für eine Neuimplementierung dienen
sie zusammen mit den unten aufgeführten Commits als Vergleichsreferenz; der
Reviewer kann damit jede rekonstruierte Änderung und Assertion am gebauten
Ergebnis überprüfen.

## 14. Tatsächliche PR- und Commit-Historie

Der bestehende Branch hat acht Commits, die zusammen in PR #1379 liegen.
Die Tabelle beschreibt, was in den Commits tatsächlich geändert wurde. Die
Diff-Zahlen sind pro Commit gemessen; später überarbeitete Zeilen werden in
mehreren Commits gezählt.

| Commit | Tatsächlicher Inhalt des Commits | Geänderte Dateien | Diff `+` / `-` |
|---|---|---:|---:|
| `e925c43a` — `refactor: extract section track estimator` | Fügt Abschnitts-Estimator samt 410-zeiliger Spec hinzu und ersetzt entsprechende Berechnung in `sg-6-track.service`. | 4 | `+754` / `-123` |
| `3fe42c21` — `refactor: introduce node track estimator` | Ergänzt Knotengleis-Estimator und 469 Zeilen Knotengleis-Tests; baut `sg-6-track.service` darauf um. | 3 | `+1.183` / `-50` |
| `3c99d189` — `refactor: integrate node track estimator` | Integriert Knotenschätzung weiter, ergänzt Integrationstest-Einstieg und eine 1.198-zeilige Netzfixture. | 5 | `+1.432` / `-160` |
| `3ca7e9b8` — `fix: stabilize infrastructure track estimation` | Überarbeitet Estimator und Knotengleis-Tests umfangreich; ändert Track-Service, Node-/Item-Rendering, Modell und Integrationstests zur Stabilisierung realer Fälle. | 14 | `+1.961` / `-1.840` |
| `eaf9a35b` — `refactor: rebuild Streckengrafik node rendering` | Baut Node-Rendering auf Reservierungen um; ergänzt Komponenten-Tests und passt Estimator, Track-Service, Item- und Zeitslider-Verhalten an. | 13 | `+638` / `-302` |
| `182c07c1` — `fix: preserve node reservations and occupancy rendering` | Bewahrt Reservierungen/Occupancy beim Modell- und Item-Aufbau; ergänzt Knotenauslastungs-View, Datenaufbereitung und DE/EN/FR-Texte. | 17 | `+563` / `-306` |
| `8f6fd718` — `refactor(streckengrafik): simplify services and model` | Vereinfacht mehrere Streckengrafik-Services und Modelltypen; entfernt überholte Knotengleis-Tests und Modellfelder nach der neuen Aufteilung. | 19 | `+998` / `-1.995` |
| `b0311411` — `fix: update` | Nimmt abschliessende Änderungen am Estimator vor, ergänzt mathematische Guards/Hilfen und passt `sg-6-track.service` an. | 3 | `+779` / `-854` |

Die acht historischen Commits können in dieser Reihenfolge als Grundlage für
einen Review-Stack verwendet werden. Die Sub-Issues 1–6 in Abschnitt 6
beschreiben die fachlichen Verantwortungsbereiche und dienen als Zuordnung
für Tests, Findings und Abnahmekriterien; sie sind keine Vorgabe, die
Commit-Reihenfolge umzuschreiben oder acht zusätzliche Issues zu erstellen.
Insbesondere `3ca7e9b8` und `b0311411` haben grosse beziehungsweise gemischte
Diffs. Der Reviewer kann entscheiden, ob sie als jeweilige Stack-Schritte
reviewt, vor dem Review geteilt oder mit einem benachbarten Schritt
zusammengefasst werden. Baseline und Gesamtregression sind Review-Gates; sie
benötigen keinen separaten Code-PR, sofern kein eigenständiges Tracking
verlangt wird.

Der Stack bleibt bis zur abgeschlossenen Review-Runde unverändert und wird
danach in Abhängigkeitsreihenfolge integriert. Bei separaten gestapelten PRs
geschieht das üblicherweise von der Basis nach oben; falls der Repository-
Workflow gestapelte PRs nicht direkt unterstützt, kann der geprüfte
Gesamtstand über einen finalen PR nach `main` gelangen.

## 15. Fehlerkorrekturen als Teil der Migration

Der PR umfasst laut GitHub 34 Dateien, 5.311 Ergänzungen und 2.633
Löschungen. Die Fixes #1375, #1376, #795 und #63 sowie der Turnaround-Fall
aus dem PR-Kommentar sind **kein optionaler Zusatz zum Zielbild**: Sie sind
Teil des vom PR beschriebenen Referenzstands und den Sub-Issues 2–5 oben
zugeordnet. Die Reproduktionsfälle sollen bei der schrittweisen Migration
übernommen und gegen die bereits vorhandenen Zielbranch-Tests geprüft werden.

Die PR-Diskussion ist zugleich der Grund für den vorgeschlagenen Stack:
Ein Reviewer merkte an, dass der damalige Draft zu gross und schwer reviewbar
sei und ein grosser Refactor zusätzliche Fehler einführen könne. Der Stack
macht die Änderung schrittweise prüfbar, ohne die bestehende Commit-Reihe
vorab verwerfen zu müssen.

Zum abgefragten PR-Stand war #1379 offen und Draft. Im damaligen CI-Lauf waren
Tests und Builds erfolgreich, der Lint-Job aber fehlgeschlagen. Das ist eine
historische Momentaufnahme; für eine Neuimplementierung müssen alle Checks
auf dem neuen finalen Stand erneut laufen.

## 16. Reviewer-Checkliste

- [ ] Der Parent Issue benennt explizit den Referenzbranch als Ground Truth
      und `main` als Ausgangspunkt.
- [ ] Relevante Zielbranch-Verhalten sind den jeweiligen Subtasks zugeordnet
      und durch passende Tests abgedeckt.
- [ ] Sub-Issue-Abhängigkeiten wurden eingehalten; Estimatoren sind vor
      Konsumenten integriert und getestet.
- [ ] Estimator ist zustandslos; Modellzuordnung und Darstellung liegen in
      Integrationsschichten.
- [ ] Periodische Fahrten, Richtung, Headway, Zeitfenster und Turnaround sind
      durch konkrete Tests abgesichert.
- [ ] Streckengrafik-Reservierungen werden konsistent zwischen Estimator,
      Modell und SVG geroutet.
- [ ] Knotenauslastung zeigt korrekte Belegungen, Headways, Kapazität und
      Stundenprojektionen.
- [ ] Die in #1375, #1376, #795, #63 und im Turnaround-Kommentar dokumentierten
      `main`-Fehler sind im Zielverhalten gezielt korrigiert und getestet.
- [ ] Tests, Lint und relevante Builds sind auf dem finalen Stand grün.
- [ ] Die Stack-Schritte wurden einzeln reviewed; ihre Reihenfolge und
      Abhängigkeiten sind nachvollziehbar. Kein PR wurde vor Abschluss der
      vorgesehenen Reviews nach `main` integriert.
- [ ] Reviewer kann nach Lesen von Issue, Tests und Diff erklären, wie die
      Neuimplementierung den Referenzbranch reproduziert.

## Anhang A — Einschätzung der tatsächlichen Commits als Review-Schritte

Die folgende Einschätzung bewertet die acht Commits des Referenzbranches
danach, wie gut sich Inhalt und Diff als eigenständige Review-Schritte
verstehen lassen. Die Commit-Reihe ist ein brauchbarer, bereits vorhandener
Ausgangspunkt für einen Review-Stack. Die Bewertung unterscheidet zwischen
ihrer Rolle als historische Meilensteine und dem Aufwand, einzelne Diffs
isoliert zu prüfen; ein grosser oder gemischter Diff ist nicht automatisch
ein schlechter Commit.
Die Diff-Zahlen sind die gemessenen Commit-Diffs; sie zählen keine Tests
einzeln erneut aus.

| Commit | Inhalt / Diff | Eignung als Review-Schritt |
|---|---|---|
| `e925c43a` — `refactor: extract section track estimator` | Abschnitts-Estimator samt Tests; 4 Dateien, `+754 / -123`. | **Gut.** Klarer fachlicher Fokus und passende Tests. Der Umfang ist merklich, aber noch gut zuzuordnen. |
| `3fe42c21` — `refactor: introduce node track estimator` | Knotengleis-Estimator, Tests und Track-Service-Anbindung; 3 Dateien, `+1.183 / -50`. | **Bedingt.** Inhaltlich fokussiert, aber über 1.200 Zeilen in nur drei Dateien; der zentrale Estimator ist als Reviewblock gross. |
| `3c99d189` — `refactor: integrate node track estimator` | Integration und grosse JSON-Fixture; 5 Dateien, `+1.432 / -160`. | **Bedingt.** Als Integrations-Meilenstein verständlich. Die Fixture macht den Commit gross; ihre Rolle und die wichtigsten erwarteten Ergebnisse sollten im Commit- oder PR-Text erklärt werden. |
| `3ca7e9b8` — `fix: stabilize infrastructure track estimation` | Estimator, Rendering, Modell und Services zugleich; 14 Dateien, `+1.961 / -1.840`. | **Grosser Misch-Diff.** Als Stack-Schritt prüfen; falls der inkrementelle Diff den Review erschwert, kann der Reviewer eine Aufteilung nach Verantwortungsbereichen vorschlagen. |
| `eaf9a35b` — `refactor: rebuild Streckengrafik node rendering` | Node-Rendering und Tests, zusätzlich Änderungen an Estimator, Track-Service und Zeitslider; 13 Dateien, `+638 / -302`. | **Bedingt bis gut.** Die Hauptabsicht ist erkennbar und der Diff moderat. Änderungen ausserhalb des Renderings erschweren das isolierte Review etwas. |
| `182c07c1` — `fix: preserve node reservations and occupancy rendering` | Reservierungserhalt sowie Knotenauslastungs-View, Datenaufbereitung und Übersetzungen; 17 Dateien, `+563 / -306`. | **Bedingt.** Die Grösse ist überschaubar, aber Streckengrafik-Erhalt und Knotenauslastung sind zwei Reviewthemen. Die Knotenauslastungs-View ist ein funktionaler Teil des Refactorings: Sie konsumiert dieselbe Estimator-Berechnungsbasis und sollte als eigener Integrationsbereich gegen Filter, Stundenprojektionen, Headway und Kapazität geprüft werden. |
| `8f6fd718` — `refactor(streckengrafik): simplify services and model` | Cleanup in mehreren Services und Modellen samt Testanpassungen; 19 Dateien, `+998 / -1.995`. | **Grosser Cleanup-Diff.** Der Commit ist als eigener Stack-Schritt nachvollziehbar; insbesondere die umfangreichen Löschungen auf vollständige Usages und Regressionen prüfen. Bei Bedarf teilen. |
| `b0311411` — `fix: update` | Abschliessende Änderungen an Estimator, Track-Service und Math-Hilfen; 3 Dateien, `+779 / -854`. | **Inhaltlich als Abschluss erkennbar, als Commit schwach dokumentiert.** Der Titel `fix: update` sagt nicht, welches Verhalten korrigiert wurde. `git show --check` meldet zudem zwei Whitespace-Stellen in diesem Commit. |

**Fazit:** Die vorhandene Commit-Reihe kann in ihrer Reihenfolge als
Review-Stack dienen. Die Bewertung markiert vor allem, bei welchen Schritten
der Reviewer wegen Umfang oder gemischter Zuständigkeiten genauer hinsehen
sollte. Eine Aufteilung oder Umbenennung – insbesondere bei `3ca7e9b8`,
`8f6fd718` oder `b0311411` – ist eine Option für bessere Reviewbarkeit, keine
Voraussetzung für den Review und kein Urteil, dass die bestehende Commit-Reihe
verworfen werden muss.

## Anhang B — Excel-Auszug und Abgleich mit den aktuellen Tests

Der Nutzer hat die folgenden zwei Tabellen aus der nicht mehr verfügbaren
Excel-Datei bereitgestellt. Tabelle B.1 enthält Ergebnisse samt Excel-Status;
Tabelle B.2 enthält Testeingaben einschliesslich One-way- und Halt-Angaben.
Die Werte sind unverändert übernommen. Abweichungen zwischen den beiden
Excel-Tabellen werden in B.3 sichtbar gemacht und nicht stillschweigend
bereinigt.

### B.1 Ergebnisübersicht aus Excel

| Trainrun | Node | Ankunft | Abfahrt | Blockiert bis | Gleis | Stand |
|---|---|---:|---:|---:|---:|---|
| REX | A | 07:00 | 08:00 | 08:02 | 2 | JA |
| REX | A | 08:00 | 09:00 | 09:02 | 1 | JA |
| REX | B | 07:06 | 07:07 | 07:09 | 2 | JA |
| REX | B | 07:53 | 07:54 | 07:56 | 1 | JA |
| REX | C | 07:13 | 07:47 | 07:49 | 1 | JA |
| REX | C | 08:13 | 08:47 | 08:49 | 1 | JA |
| REX | C-ONE_WAY | 07:46 | 07:47 | 07:49 | 1 | JA |
| REX | B-ONE_WAY | 07:53 | 07:54 | 07:56 | 1 | JA |
| REX | A-ONE_WAY | 08:00 | 08:01 | 08:03 | 1 | korrigiert |
| ICX (A1 - C3) | A1 | 07:59 | 07:31 | 07:33 | 1 | JA |
| REX (A1 - C3) | A1 | 06:00 | 07:00 | 07:02 | 2 | korrigiert |
| REX (A1 - C3) | A1 | 07:00 | 08:00 | 08:02 | 3 | JA |
| ICX (A1 - C3) | A1 | 07:29 | 08:01 | 08:03 | 4 | JA |
| ICX (A1 - C3) | B2 | 08:09 | 08:11 | 08:13 | 2 | JA |
| REX (A1 - C3) | B2 | 08:06 | 08:07 | 08:09 | 2 | JA |
| REX (A1 - C3) | B2 | 08:53 | 08:54 | 08:56 | 1 | JA |
| ICX (A1 - C3) | B2 | 08:19 | 08:21 | 08:23 | 1 | JA |
| SX (B2 - C3) | B2 | 07:59 | 08:16 | 08:18 | 1 | JA |
| SX (B2 - C3) | B2 | 08:14 | 08:31 | 08:33 | 2 | JA |
| ICX (A1 - C3) | B2 | 08:39 | 08:41 | 08:43 | 2 | JA |
| ICX (A1 - C3) | B2 | 08:49 | 08:51 | 08:53 | 1 | JA |
| ICX (A1 - C3) | C3 | 08:17 | 08:43 | 08:45 | 3 | JA |
| ICX (A1 - C3) | C3 | 07:47 | 08:13 | 08:15 | 3 | JA |
| REX (A1 - C3) | C3 | 08:13 | 08:47 | 08:49 | 2 | JA |
| SX (B2 - C3) | C3 | 08:10 | 08:20 | 08:22 | 1 | JA |
| SX (B2 - C3) | C3 | 08:25 | 08:45 | 08:47 | 1 | JA |
| SX (B2 - C3) | C3 | 08:40 | 08:50 | 08:52 | 1 | NEU |
| SX (B2 - C3) | C3 | 08:55 | 09:05 | 09:07 | 1 | NEU |
| GEXX (C3 - C3-ONE_WAY) | C3 | 07:57 | 08:03 | 08:06 | 2 | korrigiert |
| ICX (C3-ONE_WAY) | C3-ONE_WAY | 08:17 | 08:19 | 08:21 | 3 | korrigiert |
| ICX (C3-ONE_WAY) | C3-ONE_WAY | 08:47 | 08:49 | 08:51 | 3 | NEU |
| GEXX (C3-ONE_WAY) | C3-ONE_WAY | 07:55 | 08:05 | 08:08 | 2 | NEU |
| SX (C3-ONE_WAY) | C3-ONE_WAY | 08:04 | 08:05 | 08:07 | 1 | NEU |
| SX (C3-ONE_WAY) | C3-ONE_WAY | 08:19 | 08:20 | 08:22 | 1 | korrigiert |
| SX (C3-ONE_WAY) | C3-ONE_WAY | 08:34 | 08:35 | 08:37 | 1 | NEU |
| SX (C3-ONE_WAY) | C3-ONE_WAY | 08:49 | 08:50 | 08:52 | 1 | NEU |

### B.2 Eingabedaten aus Excel

| Zug | Node | Ankunft | Abfahrt | Belegt bis ab Ankunftszeit | erwartetes Gleis | one-way | Halt |
|---|---|---:|---:|---:|---:|---|---:|
| REX (A - B) | A | 07:00 | 08:00 | 08:02 | 2 | no | - |
| REX (A - B) | A | 08:00 | 09:00 | 09:02 | 1 | no | - |
| REX (A - B) | B | 07:06 | 07:07 | 07:09 | 2 | no | 1 |
| REX (A - B) | B | 07:53 | 07:54 | 07:56 | 1 | no | 1 |
| REX (A - B) | C | 07:13 | 07:47 | 07:49 | 1 | no | - |
| REX (A - B) | C | 08:13 | 08:47 | 08:49 | 1 | no | - |
| REX(C-ONE_WAY -> A-ONE_WAY) | C-ONE_WAY | 07:46 | 07:47 | 07:49 | 1 | yes | - |
| REX(C-ONE_WAY -> A-ONE_WAY) | B-ONE_WAY | 07:53 | 07:54 | 07:56 | 1 | yes | 1 |
| REX(C-ONE_WAY -> A-ONE_WAY) | A-ONE_WAY | 08:00 | 08:00 | 08:02 | 1 | yes | - |
| ICX(A1 - C3) | A1 | 07:59 | 07:31 | 07:33 | 1 | no | - |
| REX(A1 - C3) | A1 | 06:00 | 07:00 | 07:03 | 2 | no | - |
| REX(A1 - C3) | A1 | 07:00 | 08:00 | 08:02 | 3 | no | - |
| ICX(A1 - C3) | A1 | 07:29 | 08:01 | 08:03 | 4 | no | - |
| ICX(A1 - C3) | B2 | 08:09 | 08:11 | 08:13 | 2 | no | - |
| REX(A1 - C3) | B2 | 08:06 | 08:07 | 08:09 | 2 | no | - |
| REX(A1 - C3) | B2 | 08:53 | 08:54 | 08:56 | 1 | no | - |
| ICX(A1 - C3) | B2 | 08:19 | 08:21 | 08:22 | 1 | no | - |
| SX(B2-C3) | B2 | 07:59 | 08:16 | 08:18 | 1 | no | - |
| SX(B2-C3) | B2 | 08:14 | 08:31 | 08:33 | 2 | no | - |
| ICX(A1 - C3) | B2 | 08:39 | 08:41 | 08:43 | 2 | no | - |
| ICX(A1 - C3) | B2 | 08:49 | 08:51 | 08:53 | 1 | no | - |
| ICX(A1 - C3) | C3 | 08:17 | 08:43 | 08:45 | 3 | - | - |
| ICX(A1 - C3) | C3 | 07:47 | 08:13 | 08:15 | 3 | - | - |
| REX(A1 - C3) | C3 | 08:13 | 08:47 | 08:49 | 2 | - | - |
| SX(B2-C3) | C3 | 08:10 | 08:20 | 08:22 | 1 | - | - |
| SX(B2-C3) | C3 | 08:40 | 08:50 | 08:52 | 1 | - | - |
| GEXX(C3-C3-ONE-Way) | C3 | 07:57 | 08:03 | 08:05 | 2 | - | - |
| REX(A1-one-way - C3-one-way) | C3-ONE_WAY | 07:32 | 08:28 | 08:30 | 2 | - | - |
| ICX(A1-one-way-C3-one-way) | C3-ONE_WAY | 08:17 | 08:19 | 08:21 | 3 | - | - |
| SX(A1-one-way-B2-one-way) | C3-ONE_WAY | 08:19 | 08:20 | 08:22 | 1 | - | - |

In Tabelle B.2 wurden `-`-Felder dort eingesetzt, wo die Excel-Zeile leer war.
Die Schreibweisen und die Werte selbst wurden nicht normalisiert.

### B.3 Abgleich mit Tests und aktuellem Branch-Code

| Excel-Ausschnitt / mögliche Abweichung | Aktueller Test-/Codebeleg | Abgleich und Umgang |
|---|---|---|
| REX A/B/C mit Zeiten 07:00–09:00, Halten an B und Gleisen 1/2. | `infrastructure-estimator.service.spec.ts` prüft für Abschnitte 713/714 die Segmentprofile `A→B [(0,1/6,2),(1/6,1,1)]`, `B→C [(0,1,1)]`. Der Knotengleis-Test prüft Fixture-Kollisionsfreiheit, aber keine exakte REX-A/B/C-Occupancy-Matrix. | Gleisprofile bestätigen keine einzelnen Excel-Ankunfts-/Abfahrtszeiten. Excel-Einträge bleiben als ergänzende Szenariodaten; sie sind nicht als bereits durch diese Assertions getestet auszugeben. |
| Excel-A1-Matrix (REX/ICX, Zeiten 06:00–08:01, Gleise 1–4). | `infrastructure-estimator.node-track.spec.ts`, Test `keeps the A1 matrix track assignments`, prüft exakt 12 Belegungen für Trainruns 99/100 mit relativen Minuten `-60..211`; Gleisverteilung u. a. `99: -60→0 track 4`, `99: 0→60 track 3`, `100: -31→1 track 1`, `100: -1→31 track 2`. | Beide Datensätze nennen A1, aber die Excel-Tageszeiten/Trainrunlabels entsprechen nicht nachweislich dieser Testmatrix. Die Excel-Gleise werden daher nicht an die Testmatrix angepasst; vollständiger Vergleich erfordert dieselbe Netzgrafik und Zeitreferenz. |
| Excel-One-way REX C-ONE_WAY→B-ONE_WAY→A-ONE_WAY. | `streckengrafik.services.spec.ts` prüft im aktuellen Fixture One-way-Züge 104/105: 104 fährt `190→189→188` rückwärts, 105 `189→190` vorwärts; am Node 190 sind die Gleise 2 bzw. 1. | Direction/Track-Verhalten ist im Code getestet, aber Zug 104/105 und die Excel-REX-Zeitwerte sind keine identische Testeingabe. Nicht als exakte Bestätigung der Excel-Zeilen werten. |
| Excel-C3-ONE_WAY-Zeilen für ICX/SX/GEXX. | Knotengleis-Spec prüft C3-One-way aus dem JSON-Fixture auf vorhandene Occupancy und `direction === "one_way"`; Integrations-Spec prüft konkret Gleis 2 für ICX 104 und Gleis 1 für SX 105 am Node 190. | Richtung und diese beiden Gleiszuweisungen sind belegt. Die weiteren Excel-Zeitpunkte/Trainruns (einschliesslich GEXX) sind nicht einzeln mit diesen Assertions abgedeckt. |
| Unterschied bei REX A1: Tabelle B.1 hat `Blockiert bis 07:02`, Tabelle B.2 `07:03` für Ankunft 06:00/Abfahrt 07:00. | Kein aktueller Test verwendet dieselbe REX-A1-Eingabe mit diesen Tageszeiten und Headway. | Widerspruch bleibt explizit offen; nicht anhand eines anderen Fixtures entscheiden. |
| Unterschied bei ICX B2: Tabelle B.1 hat `08:23`, Tabelle B.2 `08:22` bei Ankunft 08:19/Abfahrt 08:21. | Kein aktueller Test enthält dieselbe ICX-B2-Eingabe. | Widerspruch bleibt offen; der passende Datensatz muss im Code als ausführbarer Regressionstest reproduziert werden, bevor ein Wert als Soll bestätigt wird. |
| Unterschied bei GEXX C3: Tabelle B.1 hat `08:06`, Tabelle B.2 `08:05` bei Ankunft 07:57/Abfahrt 08:03. | Kein aktueller Test enthält dieselbe GEXX-C3-Eingabe. | Widerspruch bleibt offen; nicht automatisch den Excel-Status `korrigiert` als Codebeleg behandeln. |
| Unterschied bei A-ONE_WAY: B.1 REX-Abfahrt `08:01`, Block `08:03`; B.2 Abfahrt `08:00`, Block `08:02`. | Der aktuelle One-way-Integrationstest verwendet ein anderes Netz und andere Zeiten. | Widerspruch bleibt offen. Der aktuelle Branch bestätigt allgemeine Richtungskorrektheit, nicht diese konkreten REX-Zeitwerte. |
| Unterschiedlicher Tabellenumfang: B.1 enthält unter anderem SX C3 `08:25–08:45`, zusätzliche SX-Vorkommen `08:40–08:50`/`08:55–09:05` sowie weitere C3-ONE_WAY-Vorkommen. Diese fehlen in B.2; B.2 enthält seinerseits zusätzliche One-way-Routen-Zeilen. | Aktuelle Tests verwenden die JSON-Fixture mit eigenen Trainrun-IDs und Zeitwerten; keine Assertion ordnet die zusätzlichen Excel-Zeilen eindeutig zu. | Als unterschiedliche Tabellenstände/-umfänge erhalten. Fehlende Zeilen nicht als implizit verworfen oder durch aktuelle Tests bestätigt behandeln. |
| Wrapped Turnaround / Headway | `infrastructure-estimator.node-track.spec.ts` prüft `(Frequenz, Ankunft, Abfahrt)`-Fälle `(30,30,30)`, `(15,15,45)`, `(15,45,15)`, `(20,40,20)` mit Dauer/Headway `30/32`, `15/17`, `15/17`, `20/22`. | Diese Assertions bestätigen aktuelle Perioden-/Headwaylogik für ihre Testeingaben. Sie lösen die abweichenden Excel-Zeilen nicht auf, da deren Eingaben nicht identisch sind. |

**Ground-Truth-Regel:** Excel-Werte und Statusmarkierungen (`JA`,
`korrigiert`, `NEU`) sind als übernommene Quelldaten erhalten. Eine Abweichung
wird nur dann in eine Solltabelle korrigiert, wenn derselbe Fall mit
übereinstimmenden Eingaben durch den aktuellen Branch-Code oder einen
automatisierten Test belegt ist. Für die in B.3 als offen markierten Fälle
ist der nächste Schritt, die zugrunde liegende Netzgrafik-/Trainrun-Eingabe
wiederherzustellen und daraus einen gezielten Test mit konkreter
Headway-/Gleis-Assertion anzulegen.
