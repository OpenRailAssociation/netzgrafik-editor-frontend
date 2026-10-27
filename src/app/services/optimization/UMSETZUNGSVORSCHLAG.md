Implementiert: konfliktpriorisierte Netzgrafik-Reparatur mit Δ-Ketten, lokaler Policy und
lexikografischem KPI-Ranking. Die optionale Fahrzeitverlängerung gilt pro Zuglauf, Default +5 min.

# Optimize Timetable – Umsetzungsvorschlag

Bezug: [OPTIMIZE_TIMETABLE.md](./OPTIMIZE_TIMETABLE.md) (Anforderungen H1–H14, f1–f3).

## 1. Grundprinzipien

1. **Native Objekte (H14)**: Der Optimierer liest und bewertet ausschliesslich die bestehenden
   Modellobjekte `Trainrun`, `TrainrunSection`, `Node`, `Port`, `Transition`, `Connection`.
   Es gibt **kein** paralleles Datenmodell und keine eigene Graph-Struktur der Netzgrafik.
   Erlaubt sind nur kleine Hilfs-Indizes (z.B. `Map<sectionId, Δ>`), die auf native Objekte zeigen.
2. **Stateless**: Der Service hält keinen Zustand zwischen Aufrufen. Zur Bewertung werden Zeiten
   auf den nativen `TrainrunSection`s **temporär** gesetzt und **immer** wieder zurückgesetzt
   (`try/finally`). Dabei werden **keine** `*Updated()`-Events ausgelöst → die UI merkt nichts.
3. **Resultat = Zeit-Patch**: Jede Lösung ist eine Liste von Zeitänderungen pro `TrainrunSection`
   (alt → neu). Angewendet wird der Patch erst bei **Vorschau** bzw. **Übernehmen**.
4. **Harte Regeln by construction**: Das Variablenmodell (Ketten-Verschiebung Δ) erfüllt
   H2–H12 automatisch; aktiv geprüft werden nur H1 (Gleise), H8 (Mindesthaltezeit) und
   H13 (User-Connections).
5. **Reines TypeScript im Service**: Der gesamte Algorithmus wird in TypeScript im Frontend-Service
   umgesetzt. Keine externen Solver (kein CP-SAT, MILP, SAT, WASM-Solver), keine neuen
   Abhängigkeiten, kein Backend-Aufruf. Die Algorithmuswahl ist in [Anhang A](#anhang-a--algorithmus-diskussion)
   begründet.

### 1.1 Datenstruktur (native Modelle)

| Rolle im Optimierer                          | Natives Objekt                                      |
| -------------------------------------------- | --------------------------------------------------- |
| Kante (Abschnitt A–B)                        | `TrainrunSection` (Source-/Target-`Node`)           |
| Knoten, Halt, Mindesthaltezeit, Umsteigezeit | `Node`                                              |
| Durchfahrt (Ketten bilden)                   | `Transition` (`getIsNonStopTransit()`)              |
| User-Anschluss (hart, H13)                   | `Connection` am `Node` (`Port` → `TrainrunSection`) |
| Takt, Richtung, Kategorie                    | `Trainrun`                                          |
| Zeiten, Locks                                | `TimeLockDto` der `TrainrunSection`                 |

Zusätzlich nur leichtgewichtige Lookups mit Referenzen auf native Objekte
(z.B. `Map<chainId, Δ>`, `Map<edgeKey, TrainrunSection[]>`), keine Kopien.
Der Infrastruktur-Schätzer liest Consecutive Times direkt aus `TrainrunSection`; dafür werden
Zeiten zur Bewertung temporär gesetzt und zurückgesetzt (siehe §1 Punkt 2). Der schnelle
Vorfilter rechnet rein lesend (Getter + Δ).

## 2. Dateien

| Datei | Inhalt |

| Datei                                                                      | Inhalt                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `services/optimization/optimize-timetable.service.ts`                      | Optimierungsservice, exakte Baseline-/Finalistenprüfung, Patch-Anwendung |
| `services/optimization/optimize-timetable.model.ts`                        | Optionen, Resultate, Lösungen, KPIs und Zeitänderungen                   |
| `services/optimization/optimize-timetable.chains.ts`                       | Ketten, Δ-Domänen und sparse Abhängigkeiten aus nativen Objekten         |
| `services/optimization/optimize-timetable.evaluator.ts`                    | Inkrementelle Zeit-, Streckengleis-, Halte- und Anschlussbewertung       |
| `services/optimization/optimize-timetable.search.ts`                       | Konfliktpriorisierte Reparatur, Tabu, konfliktnahe LNS/SA, Pareto-Archiv |
| `services/optimization/optimization-conflict-index.ts`                     | Konfliktlookups und Severity-Heap für Strecke, Knoten und Ketten         |
| `services/optimization/optimization-policy.model.ts`                       | Regeln, Ziele und KPI-Typen mit Default-Policy                           |
| `services/optimization/optimization-policy.service.ts`                     | Lokales Speichern und Normalisieren der Policy                           |
| `services/optimization/optimization-solution-comparator.ts`                | Gültigkeits-vor-Soft-KPI-Rangfolge                                       |
| `services/optimization/optimization-solution-comparator.spec.ts`           | Comparator-Regressionstests                                              |
| `view/dialogs/optimize-timetable-dialog/*`                                 | Zweispaltiger Dialog mit Director, Vorschlägen und Preview               |
| `view/dialogs/optimize-timetable-dialog/optimization-director.component.*` | Regeln und sortierbare KPI-Karten                                        |
| `view/editor-main-view/data-views/editor.keyEvents.ts`                     | `case "KeyQ"` → Dialog öffnen                                            |
| `services/ui/ui.interaction.service.ts`                                    | Subject zum Öffnen des Dialogs (wie bestehende Dialoge)                  |
| `documentation/OPTIMIZE_TIMETABLE.md`                                      | User-Doku (Bedienung) – nach Implementierung                             |

## 3. Datenfluss

```
KeyQ ──► UiInteractionService.showOptimizeTimetableDialog()
          │
          ▼
OptimizeTimetableDialog
  ├─ liest: NodeService.getNodes(), getSelectedNodes(), TrainrunSectionService.getTrainrunSections()
  ├─ ruft:  OptimizeTimetableService.optimize(nodes, sections, options)   // Suchbudget default: 1000 ms
  ├─ zeigt: Vorschläge + KPIs + Details
  ├─ Vorschau:   Patch anwenden → propagateInitialConsecutiveTimes → triggerViewUpdate
  ├─ Abbrechen:  Patch zurücksetzen (exakter Originalzustand)
  └─ Übernehmen: Patch definitiv → Validierung → UndoService.pushCurrentVersion()
```

## 4. Schritte im Service

### 4.1 Vorbereitung (einmal pro Aufruf)

1. **Scope** bestimmen (H11): `selectedNodeIds` leer → alle Knoten; sonst innere Knoten,
   innere Kanten (beide Knoten selektiert), Randkanten (fix).
2. **Ketten** bilden pro `Trainrun` mit dem bestehenden Trainrun-Iterator
   (`trainrun.iterator.ts`): Abschnitte zusammenfassen, solange der Zwischenknoten eine
   Durchfahrt ist (`Transition.getIsNonStopTransit()` / `Node.isNonStop`).
3. **Domäne Δ pro Kette** (ganze Minuten):
   - Δ = 0, wenn: Lock (`TimeLockDto.lock`) in der Kette (H10), Kette berührt Randkante oder liegt
     ausserhalb des Scopes (H11).
   - sonst Δ ∈ [−a, +b] mit: Halt davor `+Δ` und Halt danach `−Δ` müssen
     ≥ Mindesthaltezeit (H8) und ≤ Takt − 1 bleiben; Zuglauf-Enden ohne Gegen-Halt sind frei
     innerhalb des Takts.
   - Symmetrisch (H6): eine Variable, Rückrichtung = Spiegelung um :00.
     Asymmetrisch: je eine Variable pro Richtung. `ONE_WAY` (H5): nur eine Richtung.
4. **Kanten** (Knotenpaare) und Zuordnung Kette → betroffene Kanten, Knoten → betroffene Connections.
5. **Baseline** bewerten (KPIs, Verletzungen).

### 4.2 Bewertung (Evaluator)

- **Zeiten setzen**: Δ einer Kette wird über die Setter der `TrainrunSection` (Abfahrt/Ankunft,
  inkl. Symmetriezeit) gesetzt; Consecutive Times der Kette lokal nachgeführt
  (analog `TrainrunService.propagateConsecutiveTimes`). Fahrzeiten bleiben unverändert (H7).
- **H1 – Gleise**: `InfrastructureEstimatorService.estimateSectionTracks(from, to, sections)`
  pro Kante, `max(tracks)`. Ergebnis gecacht pro Kante (Key = Startminuten der Züge auf der Kante).
  Nur Kanten der veränderten Kette werden neu bewertet.
- **H13 – User-Connections**: für jede `Connection` am Knoten: Umsteigezeit über
  `ConnectionValidator.getShortestConnectionTime(node, port1, port2)` bzw. Ankunft/Abfahrt der
  Ports; muss ≥ 0 sein (d.h. ≥ `Node.getConnectionTime()`); Round-Trip: beide Richtungen.
- **Reisezeit-Delta-KPI**: Summe der Änderungen der Haltezeiten zwischen den Endpunkten aller
  Zugläufe und Richtungen. Der Soft-Score bewertet pro Zuglauf, ob sich die Start-Ziel-Dauer
  verlängert, und bestraft zusätzlich lange Wende-Wartezeiten quadratisch relativ zum Takt.
- **Optionale Anschlüsse**: Anzahl möglicher Umstiege zwischen verschiedenen Zugläufen im Fenster
  `connectionTime` bis `connectionTime + optionalWindow`.
- **Minimale Änderungen**: Summe der quadrierten Änderungen aller aktiven Ankunfts- und
  Abfahrtszeiten, geteilt durch die Abschnittszahl. `sumAbsShift = Σ|Δ|` bleibt ein separates
  Anzeige-KPI und ist keine Anzahl geänderter Zugläufe oder Zeitfelder.
- **Mehr Anschlüsse**: erreichbare Umsteigepaarungen plus `1/(1+2^d)` für die Abweichung `d` über
  der Mindestumsteigezeit, normiert pro Stop-Stop-Zug am Knoten und über Knoten gemittelt.
- **Knotengleise**: exakte Node-Estimator-Gleiszahlen; das Maximum dominiert den danach
  berücksichtigten Durchschnitt, beide werden über die Knotenzahl normiert.
- Die aktivierte Mindesthaltezeitregel prüft Mindesthaltezeit und gültige Takt-Haltezeit. Die
  optionale maximale Fahrzeitverlängerung prüft die Netto-Verlängerung je Zuglauf gegenüber der
  Baseline, nicht die Dauer eines einzelnen Halts.
- **Rücksetzen**: nach jeder Kandidaten-Bewertung bzw. spätestens im `finally`.

### 4.3 Suche (Standardbudget: 1 s)

1. **Vorbereitung und Konfliktwert**: Ketten/Δ bleiben die Move-Repräsentation. Konflikt-zu-Kette,
   Kette-zu-Strecke/Knoten/Anschluss und Nachbarschaftsindizes werden einmalig aufgebaut. Der exakte
   Track-Estimator liefert Baseline-Segmente; deren Konfliktwert ist
   `maxTracksPerSection * Σ(segment.tracks) / (2 * Segmentanzahl)`. `x` wird für die Diagnose als
   `maxTracksPerSection` gesetzt. Harte Gleiskonflikte bleiben davon getrennt: dafür muss mindestens
   ein Segment das Limit überschreiten. Aktive Gleiskonflikte werden primär nach dem Konfliktwert
   sortiert. Locks und Scope bleiben unveränderliche Regeln.
2. **Konflikt-Reparatur**: den höchstpriorisierten aktiven Konflikt wählen: Streckengleis-Überlast,
   User-Connection, aktivierte Mindesthaltezeit oder optionale maximale Netto-Fahrzeitverlängerung
  pro Zuglauf. Alle betroffenen freien Ketten vergleichen und ihre Δ-Kandidaten in aufsteigenden
  Minutenringen (±1, ±2, …) prüfen; die Deadline zwischen Kandidaten beachten. Den besten
  konfliktverbessernden Zug aus dem ersten
  erfolgreichen Ring übernehmen; wenn keiner den Konflikt verbessert, dient die beste
  nicht-tabuisierte Bewertung als Fallback. Nur abhängige Konflikte aktualisieren; Tabu verhindert
  direkte Zyklen.
3. **Erkundung und Neustart**: Min-Conflicts/Tabu wird mit Simulated-Annealing-Schritten
  kombiniert: meist ±1 Minute, mit erweiterter Schrittweite bei Stagnation; gelegentlich werden
  schlechtere Zwischenlösungen akzeptiert. Nach Stagnation setzt LNS bei der besten Lösung an und
  verändert eine begrenzte, konfliktnahe Kettengruppe. Sobald eine gültige Alternative existiert,
  werden bis zu 40 ms bzw. 20 % des Zeitbudgets reserviert, um Verschiebungen schrittweise um je
  eine Minute Richtung Δ = 0 zu verkleinern; ein Schritt bleibt nur bei erfüllten harten Regeln.
4. **Archiv und Ranking**: nach den aktiven harten Regeln gültige, nicht dominierte Kandidaten im
  Pareto-Archiv halten. Die UI sortiert sie anhand normierter Soft-KPI-Scores; die Rangpositionen
  erhalten Gewichte `1, 1/2, 1/4, 1/8`. Die Reihenfolge ändert nicht den zeitbegrenzten Suchpfad.
  Geänderte Hard Rules revalidieren Kandidaten; eine neue Suche startet nur mit _Optimize_.
5. **Zeitbudget und Gültigkeit**: Deadline via `performance.now()`, deterministischer Seed und
   Weiterrechnen vom ausgewählten Assignment. Die Baseline und geänderte Strecken werden exakt
   mit `InfrastructureEstimatorService` geprüft; nur nach aktiven Regeln gültige Vorschläge werden
   ausgegeben.
6. **Konsolen-Trace**: der Dialog protokolliert sortierte Baseline-Segmente, getestete Minutenringe,
  gewählte Kettenmoves, Gleis-/Haltezeit-/Anschluss- und Zeitänderungen sowie den nächsten aktiven
  Konflikt. Suchschritte verwenden den schnellen Gleis-Surrogatwert; Vorschläge werden exakt
  nachgeprüft. Der Trace ist auf 150 Ereignisse begrenzt.

### 4.4 Baseline und Ranking

- **Baseline** ist der ursprüngliche Fahrplan vor dem Anwenden eines Such-Assignments. Zeit- und
  KPI-Deltas werden relativ dazu berechnet; bei der Baseline sind Änderungen und Verschiebungen 0.
- Der Comparator sortiert zuerst nach Gültigkeit und danach nach der Summe der normierten
  Ziel-Scores, gewichtet mit `1/2^Rang`. **Minimale Änderungen** verwendet quadrierte
  Zeitänderungen pro Abschnitt. **Mehr Anschlüsse** enthält einen Bonus für geringe Abweichung
  von der Mindestumsteigezeit. **Kürzere Fahrzeit** bewertet Start-Ziel-Änderungen und quadratische
  Wende-Wartezeit. **Geringere Knotengleisnutzung** vergleicht zuerst das Maximum und danach den
  Durchschnitt.
- Der Suchlauf verwendet interne feste Bewertungsgewichte. Die Reihenfolge und Aktivierung der
  Soft-KPIs im Director beeinflusst nur das Ranking des vorhandenen Archivs, nicht den Suchpfad.

### 4.5 Performance-Risiko

`estimateSectionTracks` rechnet eine Zeit/Distanz-Matrix (Auflösung 15) – pro Aufruf teuer.

- **Historischer Benchmark**: Die erste Messbasis nutzte 250 ms. Der aktuelle Service verwendet
  standardmässig 1000 ms Suchbudget; Vorbereitungs- und exakte Prüfschritte kommen zur Laufzeit
  des gesamten Aufrufs hinzu.
- Falls zu langsam: schneller **Vorfilter** in der Suche (Überlappung der Belegungsbänder auf
  Minutenbasis inkl. Headway), exakter Schätzer nur bei Kandidaten, die den Vorfilter bestehen,
  und in der Endvalidierung. Harte Regel H1 wird **immer** mit dem echten Schätzer bestätigt.

## 5. Patch, Vorschau, Übernehmen

```ts
interface OptimizeTimetableTimeChange {
  trainrunSectionId: number;
  trainrunId: number;
  nodeId: number;
  kind: "departure" | "arrival";
  oldTime: number;
  newTime: number;
  rounded?: boolean; // H2: Rundung
}
```

- **Vorschau**: Patch auf native `TrainrunSection`s anwenden,
  `TrainrunService.propagateInitialConsecutiveTimes()`, `DataService.triggerViewUpdate()`.
  Umschalten zwischen Lösungen = alten Patch zurück, neuen Patch anwenden.
- **Abbrechen**: Patch zurücksetzen (alte Werte stehen im Patch) → exakter Originalzustand.
- **Übernehmen**: Patch bleibt, `NodeService.validateAllConnections()`,
  `UndoService.pushCurrentVersion()` → Undo mit Ctrl+Z möglich.

## 6. Dialog

- Eingabe: _Max. Gleise pro Kante_, Anzeige Scope („5 Knoten selektiert / ganzes Netz“).
- Tabelle Vorschläge (Ausgangslage + Lösungen, KPIs, sortierbar); Auswahl = Vorschau.
- Beim Öffnen zeigt die kompakte **Streckengleis-Übersicht (IST)** die sichtbaren Abschnitte.
  Nach dem Optimierungslauf klappt sie zu und **Result** mit den Vorschlägen und der Analyse auf.
  Beide Panels sind gegenseitig exklusiv; das jeweils geöffnete Panel nutzt den verfügbaren Platz.
- Details der gewählten Lösung: Abschnitt, maximale Gleise vorher, Topologie vorher, maximale
  Gleise nachher und Topologie nachher. Die Übersicht enthält nur Abschnitte mit
  Fahrplanänderungen; unveränderte Gleiszahlen wie `2 → 2` sind möglich. Bei aktivem Gleislimit
  werden überzählige Gleise und Zahlen rot markiert.
- Weitere Details: Zugläufe (Fahrzeit), Zeitänderungen (Zuglauf / Knoten / alt → neu),
  User-Connections (alle ✅), optionale Anschlüsse ±.
- Buttons: _Übernehmen_ (nur bei gültiger Lösung), _Weiterrechnen_, _Abbrechen_.
- Zweispaltig wie in der Skizze: links Optimization Director, rechts bestehende Vorschläge,
  Streckengleis-KPIs und Preview.
- Harte Regeln können angepasst werden; Locks und Scope bleiben unveränderliche Editorregeln.
  „Max. Fahrzeitverlängerung“ gilt pro Zuglauf und zeigt bei Aktivierung ein Zahlenfeld in Minuten
  (Default +5 min). Knotengleis-Auslastung ist aktuell nur eine View, kein Optimierungs-Constraint.
- Soft-KPIs lassen sich als ganze Karten per Drag-and-drop sortieren. Die Änderung sortiert
  vorhandene gültige Vorschläge neu, ohne den Solver erneut aufzurufen. Geänderte Hard Rules
  revalidieren Kandidaten; _Optimize_ startet die Suche.
- Die Baseline ist der Fahrplan vor der Suche. Reisezeit-Deltas enthalten Änderungen der
  Zwischenhalte; Abschnittsfahrzeiten bleiben fix. Einzelne lange Halte werden nicht separat
  bestraft.
- _Store policy_ speichert die Konfiguration lokal im Browser, kein Backend.
- Umsetzung analog bestehender Dialoge (`SbbDialog`, Öffnen über `UiInteractionService`).

## 7. Tests

| Test             | Prüft                                                          |
| ---------------- | -------------------------------------------------------------- |
| Ketten-Bildung   | Durchfahrten bilden eine Kette; Halte trennen Ketten           |
| Symmetrie        | Δ in Hinrichtung ⇒ −Δ in Rückrichtung; Asymmetrie unabhängig   |
| Locks / Scope    | gelockte Ketten und Randkanten bleiben unverändert             |
| Mindesthaltezeit | keine Lösung unterschreitet Haltezeit; Durchfahrt bleibt 0 min |
| User-Connections | jede erfasste `Connection` bleibt eingehalten                  |
| Gleise           | Beispielnetz mit 3 Gleisen → Lösung mit ≤ 2 Gleisen pro Kante  |
| Frequenz / Route | Takt, Offset, Knotenfolge unverändert                          |
| Ganze Minuten    | alle Zeiten ganzzahlig, Fahrzeiten aufgerundet                 |
| Stateless        | nach `optimize()` sind alle nativen Objekte unverändert        |
| Zeitbudget       | Suchschleife hält das konfigurierte Budget ein (Standard: 1000 ms); Vor- und Nachbereitung kommen hinzu |
| Patch            | Anwenden + Zurücksetzen = Originalzustand                      |

Tests mit den bestehenden Test-Netzgrafiken (`src/integration-testing/…`).

## 8. Etappen

1. **Benchmark** `estimateSectionTracks` (entscheidet über Vorfilter).
2. **Modell**: Typen, Ketten, Domänen, Patch anwenden/zurücksetzen + Tests.
3. **Evaluator**: H1 (Cache), H8, H13, f1–f3 + Tests.
4. **Suche**: Phase 1, Phase 2, Pareto-Archiv, Zeitbudget + Tests.
5. **UI**: KeyQ, Dialog, Vorschau, Übernehmen/Abbrechen, Undo.
6. **Doku**: User-Doku unter `documentation/`.

## 9. Später / offen

- Begrenzung der maximalen Wartezeit für bestehende User-Connections als eigene Policy-Option.
- Abschnittsfahrzeiten verändern (Erweiterungspunkt `allowTravelTimeChanges`).
- Knotengleis-Auslastung als Constraint; derzeit bleibt sie eine Ergebnis-View.

## 10. Implementierungsstand

Implementiert: konfliktpriorisierte Netzgrafik-Reparatur mit Δ-Ketten, lokaler Policy und
lexikografischem KPI-Ranking. Der Solver läuft vollständig in TypeScript im Browser. Comparator-
Regressionstests sind enthalten; die vollständige Frontend-Testsuite besteht.

| Datei                                                           | Inhalt                                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `optimize-timetable.model.ts`                                   | Typen (Options, Solution, Kpi, TimeChange …)                                              |
| `optimize-timetable.chains.ts`                                  | Problem-Aufbau aus nativen Objekten: Pfade, Ketten, Variablen, Kanten, Halte, Connections |
| `optimize-timetable.evaluator.ts`                               | Kandidaten-Zeiten, inkrementelle Kosten, Gleis-Surrogat pro Kante                         |
| `optimize-timetable.search.ts`                                  | Konflikt-Repair, Tabu, konfliktnahe LNS/SA und Pareto-Archiv                              |
| `optimize-timetable.service.ts`                                 | `optimize()`, Vorschläge, exakte Gleis-KPI, `applySolution` / `revertSolution`            |
| `optimization-conflict-index.ts`                                | Konfliktlookups und Prioritätsheap                                                        |
| `optimization-policy.*` / `optimization-solution-comparator.ts` | lokale Policy und KPI-Rangfolge                                                           |
| `optimization-solution-comparator.spec.ts`                      | Comparator-Regressionstests                                                               |
| `view/dialogs/optimize-timetable-dialog/*`                      | Zweispaltiger Dialog, Director, Vorschläge und Preview                                    |
| `optimization-director.component.*`                             | Hard Rules und sortierbare Soft-KPI-Karten                                                |

Die Änderungsliste ist nach Knoten und innerhalb eines Knotens nach neuer Minute sortiert.
Ein Klick auf eine Knotengruppe zeigt „Vorher“ und „Nachher“ mit der bestehenden
`KnotenAuslastungViewComponent` (inklusive Gleisbelegung, Kapazität und Stundenumschaltung).
Der aktuelle Zustand wird vor der Vorschau als Projektion gespeichert; es gibt keine eigene
Auslastungsberechnung im Optimierer. Der ausgewählte Knoten bleibt beim Vorschlagswechsel erhalten,
sofern er auch in der neuen Lösung Änderungen hat; die Auswahl erfolgt über die Knotengruppen.

Bedienung: `q`, `Q` oder `Ctrl+Q` im Editor. Sind Knoten selektiert (rechte Maustaste), werden nur
Ketten innerhalb der Selektion optimiert, Zeiten an den Randkanten bleiben fix. Klick auf einen
Vorschlag = Vorschau in der Netzgrafik; **Übernehmen** schreibt einen Undo-Schritt;
**Abbrechen** stellt den Originalzustand wieder her.

Gleis-Bewertung: während der Suche ein schnelles Surrogat (Sweep über die Periode, adaptive
Stützstellen pro Kante, gleiche Regeln wie `InfrastructureEstimatorService`); für geänderte
Kanten jeder Lösung wird die KPI exakt mit `estimateSectionTracks` berechnet.

Getroffene Annahmen (offene Punkte aus Abschnitt 9):

- User-Connection: neue Umsteigezeit in `[min(ct, alt), max(alt, ct) + 2]` min.
- Haltezeit: `≥ min(Mindesthaltezeit, alt)` und `< 60` min.
- Optionaler Anschluss: Ankunft/Abfahrt verschiedener Züge am Halt mit Wartezeit
  (mod ggT der Takte) in `[ct, ct + 5]` min.
- Verschiebung pro Kette: `±floor(min(Takt, 60) / 2)` min.
- Gewichte: Gleis-Überschreitung 1000, Fahrzeit 1/min, optionaler Anschluss 3, Verschiebung 0.05.
- Gemischt symmetrisch/asymmetrische Ketten: Rückrichtung wird mit −Δ verschoben.

Historischer Messwert für ein Beispielnetz (Suchbudget 250 ms): max = 2 Gleise → Kanten über Limit
3 → 0; max = 3 → 1 → 0. Das ist kein Laufzeitversprechen für das aktuelle Standardbudget.

---

## Anhang A – Algorithmus-Diskussion

### A.1 Problemklasse

Das Problem ist eine Variante des **Periodic Event Scheduling Problem (PESP)**, des
Standardmodells für Taktfahrpläne (Serafini & Ukovich 1989):

- **Variablen**: Δ pro Kette (ganzzahlig, periodisch modulo Takt, Domäne ≤ 60 Werte).
- **Lineare periodische Constraints**: Mindesthaltezeit (H8), User-Connections (H13) – klassische
  PESP-Intervallbedingungen `l ≤ (π_j − π_i) mod T ≤ u`.
- **Nicht-lineare Constraint**: Gleise pro Kante (H1) über den Infrastruktur-Schätzer
  (Belegungsmatrix) – nicht als PESP-Intervall formulierbar.
- **Mehrere Ziele**: minimale Änderungen, optionale Anschlüsse, Reisezeit und Streckengleisnutzung.
  Das Sucharchiv bewahrt nicht dominierte Kandidaten; die UI ordnet sie nach der aktivierten
  lexikografischen Zielreihenfolge.

PESP ist **NP-schwer** (bereits die Frage, ob überhaupt eine gültige Lösung existiert).
Konsequenz: Eine exakte Lösung mit Optimalitätsbeweis ist im damaligen Budget von 0.25 s für
reale Netze nicht garantierbar. Ziel ist daher eine **Heuristik**, die schnell gute gültige Lösungen liefert und
mit _Weiterrechnen_ verbessert werden kann.

### A.2 Randbedingungen für die Wahl

Die folgenden Tabellen halten die ursprüngliche Architekturabwägung fest. Das historische
Suchbudget von 0.25 s entspricht nicht dem heutigen Standardbudget von 1.000 ms.

| Randbedingung                            | Folge                                                |
| ---------------------------------------- | ---------------------------------------------------- |
| Reines TypeScript, keine externen Solver | exakte Verfahren müssten selbst implementiert werden |
| Historisches Suchbudget: ≤ 0.25 s        | nur inkrementelle, „anytime“-fähige Verfahren        |
| H1 nicht linear (Schätzer = Blackbox)    | Verfahren muss mit Blackbox-Bewertung umgehen        |
| Harte Regeln dürfen nie verletzt werden  | Endvalidierung + nur gültige Lösungen ausgeben       |
| Mehrere Ziele, User wählt                | Pareto-Archiv statt einer einzigen Lösung            |
| Reproduzierbar / testbar                 | deterministischer Zufall (Seed)                      |

### A.3 Kandidaten

| Verfahren                             | Idee                                                                                        | Qualität                     | Tempo                            | In TS umsetzbar    | Blackbox H1                          | Bewertung                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------- | ------------------ | ------------------------------------ | ------------------------------------------------ |
| **Min-Conflicts + Tabu Search**       | verletzte Regel wählen, beteiligte Variable auf besten Wert setzen, Tabu-Liste gegen Zyklen | gut für Gültigkeit           | sehr schnell, inkrementell       | ✅ einfach         | ✅                                   | **✅ Konfliktreparatur**                         |
| **Large Neighborhood Search (LNS)**   | konfliktnahe Kettengruppe von der besten Lösung aus verändern                               | sehr gut für Knoten-Cluster  | schnell                          | ✅ mittel          | ✅                                   | **✅ Neustart bei Stagnation**                   |
| **Simulated Annealing (SA)**          | zufällige Nachbarschritte, schlechtere mit sinkender Wahrscheinlichkeit akzeptieren         | gut, entkommt lokalen Minima | sehr schnell                     | ✅ einfach         | ✅                                   | **✅ ergänzende Suchschritte**                   |
| **Pareto-Archiv**                     | nicht dominierte Lösungen sammeln                                                           | liefert Vorschläge           | vernachlässigbar                 | ✅ einfach         | ✅                                   | **✅ Kandidatenarchiv**                          |
| Modulo-Network-Simplex (MNS)          | Spannbaum-basierte lokale Verbesserung für PESP (Nachkebel/Goerigk)                         | sehr gut für reines PESP     | mittel                           | ⚠️ aufwändig       | ❌ H1 passt nicht ins Netzwerkmodell | später als zusätzlicher Nachbarschafts-Operator  |
| Constraint Propagation + Backtracking | Domänen einschränken, systematisch suchen                                                   | exakt bei kleinen Teilnetzen | exponentiell im Worst Case       | ✅ mittel          | ⚠️ nur als Prüfung an Blättern       | optional für kleine Selektion (z.B. ≤ 10 Ketten) |
| Genetischer Algorithmus / NSGA-II     | Population, Kreuzung, Mutation                                                              | gut für Multi-Objective      | zu wenige Generationen in 0.25 s | ✅                 | ✅                                   | ❌                                               |
| CP-SAT / MILP / PESP-SAT              | exakte Solver                                                                               | optimal / beweisbar          | Sekunden–Minuten                 | ❌ externer Solver | ❌                                   | ❌ (ausgeschlossen durch „nur TypeScript“)       |

### A.4 Netzgrafik Conflict-Repair-Algorithmus

```text
optimize(nativeNetzgrafik, policy, budget = 1000 ms):
  problem := buildChainsAndSparseDependencyIndexes(nativeNetzgrafik, policy)
  trackPriorities := exactBaselineSegmentScores(problem)
  x := baseline or selected previous assignment
  evaluator := incrementalSurrogate(problem, x)
  conflicts := indexedConflicts(problem, evaluator, trackPriorities)
  archive.addIfFeasibleAndNonDominated(x)
  best := x
  tabu := empty

  while beforeDeadline():
    conflict := conflicts.highestPriority()
    if conflict exists and random() < 0.85:
      variables := allMovableChainsTouching(conflict)
      for distance := 1 to largestReachableDistance(variables):
        move := bestTabuAllowedDelta(variables, ±distance, evaluator)
        if move improves hard violations or conflict severity:
          break
      if no improving move:
        move := bestTabuAllowedFallback(variables, evaluator)
      if move exists:
        evaluator.apply(move)
        conflicts.refreshOnlyAffected(move)
        tabu.remember(move)
        trace.record(move, neighboringTimesAndConstraints, conflicts.highestPriority())
    else:
      candidate := proposeMostlyOneMinuteMove(expandRangeOnStagnation(x))
      if acceptBySimulatedAnnealing(candidate, x):
        x := candidate
        conflicts.refreshOnlyAffected(candidate)

    archive.addIfFeasibleAndNonDominated(x)
    if iterationsSinceBest > 300:
      x := perturbConflictNeighborhood(best)
      conflicts.refreshAffectedBy(x)
    if score(x) < score(best):
      best := x

  archive.addIfFeasibleAndNonDominated(best)
  if archive has a feasible alternative and time remains:
    x := archive.alternativeWithSmallestSumAbsShift()
    repeat while improved and beforeDeadline():
      for each variable v with x[v] != 0:
        candidate := x[v] - sign(x[v])
        if all hard rules remain valid:
          x[v] := candidate
          archive.addIfFeasibleAndNonDominated(x)

  finalists := archive.selectByCurrentPolicy()
  exactValidateBaselineOnceAndChangedEdges(finalists, nativeNetzgrafik)
  return onlyExactValid(finalists)
```

Konfliktpriorisierung konzentriert den Repair-Aufwand auf betroffene Netzgrafik-Komponenten.
LNS verändert begrenzte, benachbarte und transferbezogene Zugketten statt beliebiger globaler
Variablen. Flatland dient als Architektur-Inspiration für Replanning und LNS, nicht als Rail-
Rastermodell oder als Codebasis.

Begründung:

- **Conflict Repair** priorisiert konkrete Streckengleis-, Anschluss- und Haltezeitkonflikte.
- **LNS** repariert strukturell zusammenhängende Kettencluster statt zufälliger Einzelvariablen.
- **SA-Akzeptanz** gilt nur für weiche KPI-Verbesserungen und ersetzt keine harte Gültigkeit.
- **Pareto-Archiv** liefert mehrere gültige Lösungsvorschläge für den Dialog.
- Die Suche ist **anytime** und beendet sich an der Deadline; Baseline wird einmal exakt geprüft,
  Kandidaten nur auf geänderten Strecken.

### A.5 Grenzen

- Keine Optimalitätsgarantie; „keine gültige Lösung gefunden“ ≠ „es gibt keine“.
  → _Weiterrechnen_ (neuer Seed, Start aus bisherigen Lösungen) oder Grenzwert / Selektion anpassen.
- Qualität hängt von der Geschwindigkeit der H1-Bewertung ab → Benchmark als erste Etappe,
  ggf. Vorfilter (A.6).

### A.6 Beschleunigung der H1-Bewertung (Vorfilter)

- Schätzer `estimateSectionTracks` baut eine Matrix (Auflösung 15 × Fahrzeit × 15 × 2 × Fenster).
- Vorfilter: Belegungsintervalle pro Zug auf der Kante auf Minutenbasis
  (`[Abfahrt, Abfahrt + Headway]` an beiden Enden, periodisch über den Takt) → maximale
  Überlappung per Sweep-Line in `O(n log n)`.
- Suche nutzt den Vorfilter; der echte Schätzer bestätigt Kandidaten und **immer** die Endlösungen.

### A.7 Erweiterungen

- **MNS-Operator** als zusätzliche Nachbarschaft in Phase 2 (nur PESP-Teil, H1 als Prüfung).
- **Backtracking** mit Constraint Propagation für kleine Selektionen (exakte Lösung im Teilnetz).
- **Fahrzeitänderungen** (später): zusätzliche Variablen pro Abschnitt, gleiches Suchgerüst.

### A.8 Referenzen

#### Flatland als Architektur-Inspiration

Die Flatland-Arbeit behandelt dynamische Multi-Agenten-Routenplanung auf einem zeitabhängigen
Gleisnetz. Der Netzgrafik-Editor optimiert dagegen periodische Fahrpläne auf festen Zugläufen.
Übernommen werden deshalb nur allgemeine Ideen wie konfliktpriorisierte Reparatur, strukturierte
LNS-Neighborhoods, adaptive Priorisierung und zeitbegrenzte Replanung. Flatland-spezifische
Rasterzustände, Zeitschritt-Aktionen, Agentenpfade und Solver-Code werden nicht übernommen.

- Jiaoyang Li, Zhe Chen, Yi Zheng, Shao-Hung Chan, Daniel Harabor, Peter J. Stuckey, Hang Ma,
  Sven Koenig. _Scalable Rail Planning and Replanning: Winning the 2020 Flatland Challenge_.
  ICAPS 2021, pp. 477–485. [Proceedings](https://ojs.aaai.org/index.php/ICAPS/article/view/15957).
- [Jiaoyang-Li/Flatland](https://github.com/Jiaoyang-Li/Flatland), Branch
  `Flatland2020_solution` (README und Gewinnerlösung).

Die Quellen dienen der konzeptionellen Einordnung; es wird kein Code aus dem Repository
übernommen. Dessen README nennt eine eingeschränkte Academic/non-profit-Lizenz.

- Serafini, Ukovich (1989): _A mathematical model for periodic scheduling problems_.
- Nachtigall, Opitz: _Solving periodic timetable optimisation problems by modulo simplex calculations_.
- Goerigk, Schöbel: _Improving the modulo simplex algorithm for large-scale periodic timetabling_.
- Minton et al. (1992): _Minimizing conflicts: a heuristic repair method_.
- Shaw (1998): _Using constraint programming and local search methods (LNS)_.

```

```
