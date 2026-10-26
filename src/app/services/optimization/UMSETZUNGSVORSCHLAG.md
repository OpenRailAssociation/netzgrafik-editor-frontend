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

| Datei                                                   | Inhalt                                                  |
| ------------------------------------------------------- | ------------------------------------------------------- |
| `services/optimization/optimize-timetable.service.ts`   | Stateless Service, öffentliche API `optimize(...)`      |
| `services/optimization/optimize-timetable.model.ts`     | Typen: Options, Result, Solution, Patch, KPIs           |
| `services/optimization/optimize-timetable.chains.ts`    | Ketten bilden (Halt → Halt) aus nativen Objekten        |
| `services/optimization/optimize-timetable.evaluator.ts` | Bewertung: H1 (Gleise), H8, H13, f1–f3; Cache pro Kante |
| `services/optimization/optimize-timetable.search.ts`    | Min-Conflicts + Tabu, LNS/SA, Pareto-Archiv, Zeitbudget |
| `services/optimization/optimize-timetable.patch.ts`     | Patch anwenden / zurücksetzen auf nativen Objekten      |
| `services/optimization/*.spec.ts`                       | Unit-Tests                                              |
| `view/dialogs/optimize-timetable-dialog/*`              | Dialog (Eingabe, Vorschläge, Details, Übernehmen)       |
| `view/editor-main-view/data-views/editor.keyEvents.ts`  | `case "KeyQ"` → Dialog öffnen                           |
| `services/ui/ui.interaction.service.ts`                 | Subject zum Öffnen des Dialogs (wie bestehende Dialoge) |
| `documentation/OPTIMIZE_TIMETABLE.md`                   | User-Doku (Bedienung) – nach Implementierung            |

## 3. Datenfluss

```
KeyQ ──► UiInteractionService.showOptimizeTimetableDialog()
          │
          ▼
OptimizeTimetableDialog
  ├─ liest: NodeService.getNodes(), getSelectedNodes(), TrainrunSectionService.getTrainrunSections()
  ├─ ruft:  OptimizeTimetableService.optimize(nodes, sections, options)   // ≤ 250 ms
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
- **f1** Σ Verlängerung Gesamtfahrzeit pro Zuglauf (Haltezeit-Differenzen),
  **f2** Anzahl optionaler Umsteigemöglichkeiten im Knoten, **f3** Σ|Δ|.
- **Rücksetzen**: nach jeder Kandidaten-Bewertung bzw. spätestens im `finally`.

### 4.3 Suche (≤ 250 ms)

1. **Phase 1 – Gültigkeit** (falls Baseline H1/H13 verletzt):
   Min-Conflicts + Tabu. Verletzte Kante/Connection wählen → beteiligte Ketten →
   Kandidaten-Δ in Reihenfolge `±1, ±2, ±3, …, Takt/2` → bestes Δ übernehmen → Kette tabu.
2. **Phase 2 – Ziele** (nur gültige Zustände):
   LNS: Knoten wählen (bevorzugt ITF-Knoten mit vielen Zügen), Ketten um den Knoten zurücksetzen
   (Destroy), greedy neu setzen (Repair); Annahme per Simulated-Annealing-Kriterium.
   Schritte, die eine harte Regel verletzen, werden verworfen.
3. **Pareto-Archiv** (f1, f2, f3), max. ~10 Einträge → Vorschläge:
   „Minimale Änderung“ (min f3), „Meiste Anschlüsse“ (max f2), „Schnellste“ (min f1),
   „Ausgewogen“ (gewichtete Summe).
4. **Zeitbudget**: `performance.now()`-Check in jeder Iteration; deterministischer Zufall (Seed),
   bei _Weiterrechnen_ neuer Seed und Start aus den bisherigen Lösungen (`previousSolutions`).
5. **Endvalidierung** jeder Lösung: Patch anwenden → `estimateSectionTracks` für **alle** Kanten
   im Scope (exakt, ohne Vorfilter) + `TrainrunSectionValidator` + H13 → zurücksetzen.
   Nur bestandene Lösungen werden zurückgegeben.

### 4.4 Performance-Risiko

`estimateSectionTracks` rechnet eine Zeit/Distanz-Matrix (Auflösung 15) – pro Aufruf teuer.

- **Schritt 0 der Umsetzung**: Benchmark (Aufrufe pro 250 ms auf einer realen Netzgrafik).
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
- Details der gewählten Lösung: Kanten (Gleise vorher → nachher), Zugläufe (Fahrzeit),
  Zeitänderungen (Zuglauf / Knoten / alt → neu), User-Connections (alle ✅), optionale Anschlüsse ±.
- Buttons: _Übernehmen_ (nur bei gültiger Lösung), _Weiterrechnen_, _Abbrechen_.
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
| Zeitbudget       | `elapsedMs ≤ 250 + ε`                                          |
| Patch            | Anwenden + Zurücksetzen = Originalzustand                      |

Tests mit den bestehenden Test-Netzgrafiken (`src/integration-testing/…`).

## 8. Etappen

1. **Benchmark** `estimateSectionTracks` (entscheidet über Vorfilter).
2. **Modell**: Typen, Ketten, Domänen, Patch anwenden/zurücksetzen + Tests.
3. **Evaluator**: H1 (Cache), H8, H13, f1–f3 + Tests.
4. **Suche**: Phase 1, Phase 2, Pareto-Archiv, Zeitbudget + Tests.
5. **UI**: KeyQ, Dialog, Vorschau, Übernehmen/Abbrechen, Undo.
6. **Doku**: User-Doku unter `documentation/`.

## 9. Offene Punkte

- Obergrenze Umsteigezeit für User-Connections (nur Minimum oder auch Maximum, z.B. bisherige
  Umsteigezeit nicht verlängern)?
- Gewichtung weiche Ziele (Vorschlag: 1 optionaler Anschluss ≙ 3 min).
- Obergrenze Verlängerung Gesamtfahrzeit (Vorschlag +5 min).
- Fahrzeitänderungen: später (Erweiterungspunkt `allowTravelTimeChanges`).

## 10. Implementierungsstand

Umgesetzt (ohne Unit-Tests, auf Wunsch weggelassen):

| Datei                                      | Inhalt                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `optimize-timetable.model.ts`              | Typen (Options, Solution, Kpi, TimeChange …)                                               |
| `optimize-timetable.chains.ts`             | Problem-Aufbau aus nativen Objekten: Pfade, Ketten, Variablen, Kanten, Halte, Connections  |
| `optimize-timetable.evaluator.ts`          | Kandidaten-Zeiten, inkrementelle Kosten, Gleis-Surrogat pro Kante                          |
| `optimize-timetable.search.ts`             | Min-Conflicts + Tabu, Simulated Annealing, LNS-Restart, Pareto-Archiv                      |
| `optimize-timetable.service.ts`            | `optimize()`, Vorschläge, exakte Gleis-KPI, `applySolution` / `revertSolution`             |
| `view/dialogs/optimize-timetable-dialog/*` | Dialog: max. Gleise, Vorschläge mit KPIs, Vorschau, Übernehmen / Weiterrechnen / Abbrechen |

Die Änderungsliste ist nach Knoten und innerhalb eines Knotens nach neuer Minute sortiert.
Ein Klick auf einen Knoten zeigt „Aktuell“ und „Neu“ mit der bestehenden
`KnotenAuslastungViewComponent` (inklusive Gleisbelegung, Kapazität und Stundenumschaltung).
Der aktuelle Zustand wird vor der Vorschau als Projektion gespeichert; es gibt keine eigene
Auslastungsberechnung im Optimierer. Die Knoten-Navigation bleibt beim Vorschlagswechsel erhalten.

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

Messung (Beispielnetz, 250 ms): max = 2 Gleise → Kanten über Limit 3 → 0; max = 3 → 1 → 0.

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
- **Mehrere Ziele**: f1 (Fahrzeit), f2 (optionale Anschlüsse), f3 (Änderung).

PESP ist **NP-schwer** (bereits die Frage, ob überhaupt eine gültige Lösung existiert).
Konsequenz: Eine exakte Lösung mit Optimalitätsbeweis ist in 0.25 s für reale Netze nicht
garantierbar. Ziel ist daher eine **Heuristik**, die schnell gute gültige Lösungen liefert und
mit _Weiterrechnen_ verbessert werden kann.

### A.2 Randbedingungen für die Wahl

| Randbedingung                            | Folge                                                |
| ---------------------------------------- | ---------------------------------------------------- |
| Reines TypeScript, keine externen Solver | exakte Verfahren müssten selbst implementiert werden |
| ≤ 0.25 s pro Lauf                        | nur inkrementelle, „anytime“-fähige Verfahren        |
| H1 nicht linear (Schätzer = Blackbox)    | Verfahren muss mit Blackbox-Bewertung umgehen        |
| Harte Regeln dürfen nie verletzt werden  | Endvalidierung + nur gültige Lösungen ausgeben       |
| Mehrere Ziele, User wählt                | Pareto-Archiv statt einer einzigen Lösung            |
| Reproduzierbar / testbar                 | deterministischer Zufall (Seed)                      |

### A.3 Kandidaten

| Verfahren                             | Idee                                                                                        | Qualität                     | Tempo                            | In TS umsetzbar    | Blackbox H1                          | Bewertung                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------- | ------------------ | ------------------------------------ | ------------------------------------------------ |
| **Min-Conflicts + Tabu Search**       | verletzte Regel wählen, beteiligte Variable auf besten Wert setzen, Tabu-Liste gegen Zyklen | gut für Gültigkeit           | sehr schnell, inkrementell       | ✅ einfach         | ✅                                   | **✅ Phase 1**                                   |
| **Large Neighborhood Search (LNS)**   | Teil der Lösung (z.B. ITF-Knoten) zurücksetzen und greedy/lokal neu aufbauen                | sehr gut für Knoten-Cluster  | schnell                          | ✅ mittel          | ✅                                   | **✅ Phase 2**                                   |
| **Simulated Annealing (SA)**          | zufällige Nachbarschritte, schlechtere mit sinkender Wahrscheinlichkeit akzeptieren         | gut, entkommt lokalen Minima | sehr schnell                     | ✅ einfach         | ✅                                   | **✅ Akzeptanzkriterium in Phase 2**             |
| **Pareto Local Search / Archiv**      | nicht dominierte Lösungen sammeln                                                           | liefert Vorschläge           | vernachlässigbar                 | ✅ einfach         | ✅                                   | **✅ Vorschläge**                                |
| Modulo-Network-Simplex (MNS)          | Spannbaum-basierte lokale Verbesserung für PESP (Nachkebel/Goerigk)                         | sehr gut für reines PESP     | mittel                           | ⚠️ aufwändig       | ❌ H1 passt nicht ins Netzwerkmodell | später als zusätzlicher Nachbarschafts-Operator  |
| Constraint Propagation + Backtracking | Domänen einschränken, systematisch suchen                                                   | exakt bei kleinen Teilnetzen | exponentiell im Worst Case       | ✅ mittel          | ⚠️ nur als Prüfung an Blättern       | optional für kleine Selektion (z.B. ≤ 10 Ketten) |
| Genetischer Algorithmus / NSGA-II     | Population, Kreuzung, Mutation                                                              | gut für Multi-Objective      | zu wenige Generationen in 0.25 s | ✅                 | ✅                                   | ❌                                               |
| CP-SAT / MILP / PESP-SAT              | exakte Solver                                                                               | optimal / beweisbar          | Sekunden–Minuten                 | ❌ externer Solver | ❌                                   | ❌ (ausgeschlossen durch „nur TypeScript“)       |

### A.4 Gewählter Algorithmus (Hybrid)

```
optimize(scope, maxTracks, budget = 250 ms):
  vorbereiten: Ketten, Domänen Δ, Kanten-Index, Baseline, Cache
  x := Baseline (bzw. beste bisherige Lösung bei "Weiterrechnen")

  // Phase 1 – Gültigkeit (Min-Conflicts + Tabu)
  while verletzt(x) and Zeit übrig:
      c := zufällige verletzte Regel (H1-Kante oder H13-Connection)
      k := beteiligte Kette, nicht tabu
      Δ* := argmin über Domäne(k) [Verletzungsgrad, dann f3]   // Reihenfolge ±1, ±2, …, T/2
      x[k] := Δ*; tabu(k, Tenure)

  // Phase 2 – Ziele (LNS + SA, nur gültige Zustände)
  while Zeit übrig:
      n := Knoten (gewichtet nach Anzahl Züge / Anschlüsse)
      y := x mit Ketten um n zurückgesetzt (Destroy) und greedy neu gesetzt (Repair)
      if gültig(y) and SA-Akzeptanz(y, x, Temperatur): x := y
      Pareto-Archiv.add(x)

  Endvalidierung aller Archiv-Lösungen mit echtem Schätzer → Vorschläge
```

Begründung:

- **Phase 1** nutzt die Struktur (viele kleine Variablen, jede Regel betrifft wenige Ketten) –
  Min-Conflicts ist hierfür das schnellste bekannte lokale Verfahren (vgl. WalkSAT).
- **Phase 2 / LNS** passt fachlich zum ITF: ein Vollknoten wird als Ganzes neu gelegt, statt
  einzelne Züge isoliert zu verschieben.
- **SA-Akzeptanz** verhindert Steckenbleiben in lokalen Minima.
- **Pareto-Archiv** liefert direkt die Lösungsvorschläge für den Dialog.
- Alles **anytime**: nach jeder Iteration existiert eine beste Lösung → 0.25 s-Abbruch jederzeit möglich.

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

- Serafini, Ukovich (1989): _A mathematical model for periodic scheduling problems_.
- Nachtigall, Opitz: _Solving periodic timetable optimisation problems by modulo simplex calculations_.
- Goerigk, Schöbel: _Improving the modulo simplex algorithm for large-scale periodic timetabling_.
- Minton et al. (1992): _Minimizing conflicts: a heuristic repair method_.
- Shaw (1998): _Using constraint programming and local search methods (LNS)_.
