# Optimize Timetable – Anforderungen

Status: **implementiert** (Details und getroffene Annahmen: [UMSETZUNGSVORSCHLAG.md – Abschnitt 10](./UMSETZUNGSVORSCHLAG.md#10-implementierungsstand))

## 1. Ziel

Ausgehend von der aktuell geladenen Netzgrafik (Integraler Taktfahrplan, ITF, mit Vollknoten)
soll ein Optimierer durch **Verschieben von Abfahrts-/Ankunftszeiten** eine neue Lage der Züge
finden, sodass auf **keiner Kante** (Abschnitt Knoten–Knoten) die vom User vorgegebene
**maximale Anzahl Gleise** überschritten wird.

Es handelt sich um eine **Multi-Objective-Optimierung unter harten Nebenbedingungen**:
harte Regeln dürfen nie verletzt werden; innerhalb der gültigen Lösungen werden mehrere
weiche Ziele optimiert und dem User als Lösungsvorschläge präsentiert.

## 2. Bedienung

### 2.1 Start

- Tastenkürzel **Ctrl+Q**, **q** oder **Q** im Editor (`editor.keyEvents.ts`, `case "KeyQ"`).
- Öffnet einen Dialog mit:
  - **Maximale Gleise pro Kante** (globaler Wert, Eingabe durch User).
  - Button **Optimieren**.
  - (Später: Option „Fahrzeiten dürfen angepasst werden“ – aktuell nicht aktiv, siehe §9.)

### 2.2 Optimierungsbereich (Multi-Selektion)

- Knoten können mit der **rechten Maustaste** (Rechteck aufziehen) mehrfach markiert werden
  (`NodeService.getSelectedNodes()`).
- **Keine Knoten markiert** → das ganze Netz wird optimiert.
- **Knoten markiert** → nur das Teilnetz wird optimiert:
  - **Innere Knoten**: markierte Knoten – dort dürfen Zeiten/Halte geändert werden.
  - **Innere Kanten**: beide Endknoten markiert – dürfen verschoben werden.
  - **Randkanten**: nur ein Endknoten markiert – Zeiten sind **fix** (wie Locks).
  - Alles ausserhalb bleibt unverändert.
- Die Selektion wird beim Start gelesen und als Liste von Knoten-IDs an den Service übergeben.

### 2.3 Resultat-Dialog

- Liste von **Lösungsvorschlägen** mit KPIs (siehe §6), inkl. **Ausgangslage** als Referenz.
- User kann zwischen den Lösungen **umschalten**; die gewählte Lösung wird als **Vorschau**
  in der Netzgrafik angezeigt (Ausgangslage jederzeit wieder wählbar).
- Detailansicht der gewählten Lösung: **was** wurde **wo** geändert (siehe §6.2).
- Buttons:
  - **Übernehmen** – lädt die gewählte Lösung definitiv (erst nachdem der User die
    Änderungen gesehen/verstanden hat).
  - **Weiterrechnen** – startet einen weiteren Lauf (0.25 s) und ergänzt die Vorschläge.
  - **Abbrechen** – stellt die Ausgangslage exakt wieder her.
- Wird keine gültige Lösung gefunden, wird dies angezeigt (inkl. Kanten mit Überschreitung);
  **Übernehmen** ist dann deaktiviert.

## 3. Harte Regeln (dürfen nie verletzt werden)

| #   | Regel                                                                                                                                                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | **Gleise pro Kante**: für jede Kante (AB, BC, CD, …) gilt `max(tracks) ≤ maxTracks` (User-Wert). Berechnung mit `InfrastructureEstimatorService.estimateSectionTracks`; Hin- und Rückrichtung zusammen, eine Kante pro Knotenpaar.                                                                                |
| H2  | **Ganze Minuten**: alle Zeiten sind ganzzahlig. Optimierte Zeiten werden **gerundet**, Fahrzeiten immer auf die nächste volle Minute **aufgerundet**.                                                                                                                                                             |
| H3  | **Mengengerüst / Frequenz fix**: Frequenz (Takt) und Frequenz-Offset werden nicht verändert; keine Zugläufe hinzufügen/entfernen.                                                                                                                                                                                 |
| H4  | **Route fix**: gleiche Knoten, Abschnitte, Reihenfolge, Ports, Transitions; Halte bleiben Halte, Durchfahrten bleiben Durchfahrten.                                                                                                                                                                               |
| H5  | **Richtung**: alle Züge fahren hin und zurück (`ROUND_TRIP`), ausser `ONE_WAY`.                                                                                                                                                                                                                                   |
| H6  | **Symmetrie um Minute 00**: Abfahrt von Zug A am Knoten X = :00 + x ⇒ Ankunft von Zug A (Gegenrichtung) am Knoten X = :00 − x (mod 60). Ausnahme: explizit asymmetrisch gesetzte Abschnitte. Symmetrie wird nach dem Runden berechnet.                                                                            |
| H7  | **Abschnittsfahrzeiten fix**: Fahrzeit jedes Abschnitts wird nicht verändert (Ausnahme: Aufrunden gem. H2).                                                                                                                                                                                                       |
| H8  | **Mindesthaltezeit**: Haltezeit an Halten ≥ Mindesthaltezeit (Knoten × Zugkategorie).                                                                                                                                                                                                                             |
| H9  | **Durchfahrt (non-stop)**: Haltezeit immer 0 min, d.h. **Ankunft = Abfahrt** (beide Richtungen).                                                                                                                                                                                                                  |
| H10 | **Locks**: gelockte Zeiten (`TimeLockDto.lock`) bleiben unverändert.                                                                                                                                                                                                                                              |
| H11 | **Optimierungsbereich**: Zeiten an Randkanten und ausserhalb der Selektion bleiben unverändert.                                                                                                                                                                                                                   |
| H12 | **Konsistenz**: Ankunft = Abfahrt + Fahrzeit; Consecutive Times sind konsistent entlang des Zuglaufs.                                                                                                                                                                                                             |
| H13 | **User-Connections**: alle im Netzgrafik-Editor erfassten Anschlüsse (`Connection` am `Node`) müssen eingehalten werden: Umsteigezeit ≥ Mindestumsteigezeit des Knotens (`Node.getConnectionTime()`), bei Round-Trips in beiden Richtungen. Alle übrigen (impliziten) Anschlüsse sind optional (weiches Ziel f2). |
| H14 | **Native Objekte**: der Optimierer arbeitet ausschliesslich mit den nativen Modellobjekten der Netzgrafik (`Trainrun`, `TrainrunSection`, `Node`, `Port`, `Transition`, `Connection`) – keine eigenen Parallel-Datenmodelle.                                                                                      |

## 4. Weiche Ziele (Multi-Objective)

Nur unter gültigen Lösungen (alle harten Regeln erfüllt):

- **f1 – Gesamtfahrzeit pro Zuglauf** möglichst kurz:
  `T(A→D) = t(AB) + Halt(B) + t(BC) + Halt(C) + t(CD)`.
  Sie darf frei gewählt werden, soll aber **nicht wesentlich länger** werden
  (Obergrenze der Verlängerung konfigurierbar, Vorschlag +5 min).
- **f2 – Optionale Anschlüsse**: möglichst viele zusätzliche (nicht als `Connection` erfasste)
  Umsteigemöglichkeiten im Knoten halten/gewinnen (Umsteigezeit ≥ `connectionTime` des Knotens).
  User-Connections sind hart (H13) und zählen hier nicht.
- **f3 – Minimale Änderung**: kleine Verschiebungen bevorzugt gegenüber grossen (Σ|Δ|).

Der Zielkonflikt **schnell ↔ Anschlüsse** wird über die Lösungsvorschläge (Pareto-Front)
sichtbar gemacht.

## 5. Zeitbudget

- Ein Lauf rechnet maximal **0.25 s** und liefert die besten bis dahin gefundenen Lösungen.
- Mit **Weiterrechnen** kann der User erneut 0.25 s starten (ausgehend von den bisherigen Lösungen).

## 6. Resultat / KPIs

### 6.1 Lösungsvorschläge (Beispiel)

| Lösung                | Gültig | Max. Gleise/Kante | Σ Fahrzeit Δ | Anschlüsse (±) | Geänderte Zeiten | Σ\|Δ\| min |
| --------------------- | ------ | ----------------- | ------------ | -------------- | ---------------- | ---------- |
| 0 – Ausgangslage      | ❌     | 3                 | 0            | 42 (0)         | 0                | 0          |
| 1 – Minimale Änderung | ✅     | 2                 | +2 min       | 40 (−2)        | 6                | 8          |
| 2 – Meiste Anschlüsse | ✅     | 2                 | +6 min       | 45 (+3)        | 14               | 31         |
| 3 – Schnellste        | ✅     | 2                 | −3 min       | 38 (−4)        | 9                | 17         |
| 4 – Ausgewogen        | ✅     | 2                 | +1 min       | 43 (+1)        | 10               | 15         |

### 6.2 Details pro Lösung

- **Kanten**: Gleise vorher → nachher (z.B. „B–C: 3 → 2 ✅“).
- **Zugläufe**: Gesamtfahrzeit vorher → nachher.
- **Zeitänderungen**: pro Zuglauf / Knoten / Richtung, alt → neu (inkl. Symmetriezeit, Rundungen markiert).
- **Anschlüsse**: verloren / gewonnen pro Knoten.
- **Info**: Knotengleise vorher → nachher (`estimateNodeTracks`, keine harte Regel).

## 7. Architektur

### 7.1 Service

- Neuer **stateless** Service `OptimizeTimetableService`
  (`src/app/services/optimization/optimize-timetable.service.ts`).
- **Reines TypeScript** im Service: keine externen Solver, keine neuen Abhängigkeiten, kein Backend.
  Algorithmus-Diskussion: [UMSETZUNGSVORSCHLAG.md – Anhang A](./UMSETZUNGSVORSCHLAG.md#anhang-a--algorithmus-diskussion).
- Arbeitet auf den **nativen Modellobjekten** (H14). Zur Bewertung werden Zeiten temporär gesetzt
  und vor der Rückgabe garantiert zurückgesetzt (`try/finally`); nach aussen ist der Service
  stateless. Resultat ist ein **Zeit-Patch** pro Lösung, der erst bei **Übernehmen** angewendet
  wird (Details: [UMSETZUNGSVORSCHLAG.md](./UMSETZUNGSVORSCHLAG.md)).
- Signatur (Entwurf):

```ts
optimize(
  nodes: Node[],
  trainrunSections: TrainrunSection[],
  options: OptimizeTimetableOptions,
): OptimizeTimetableResult;

interface OptimizeTimetableOptions {
  maxTracksPerSection: number;
  selectedNodeIds?: number[]; // leer = ganzes Netz
  timeBudgetMs?: number; // default 250
  previousSolutions?: OptimizeTimetableSolution[]; // für "Weiterrechnen"
  // später: allowTravelTimeChanges
}

interface OptimizeTimetableResult {
  baseline: {kpis: OptimizeTimetableKpis};
  solutions: OptimizeTimetableSolution[]; // nur gültige Lösungen
  feasibleFound: boolean;
  elapsedMs: number;
}
```

### 7.2 Wiederverwendung bestehender Berechnungen

| Zweck                                   | Bestehender Code                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| Gleise pro Kante (H1)                   | `InfrastructureEstimatorService.estimateSectionTracks`                                   |
| Knotengleise (Info)                     | `InfrastructureEstimatorService.estimateNodeTracks`                                      |
| User-Connections (H13), Anschlüsse (f2) | `Node.getConnections()`, `Connection`, `ConnectionValidator`, `Node.getConnectionTime()` |
| Symmetrie (H6)                          | `TrainrunsectionHelper.getSymmetricTime`, `TrainrunSectionValidator`                     |
| Durchfahrten (H9)                       | `Node.isNonStop`, `TransitionValidator`                                                  |
| Zuglauf-Traversierung                   | `trainrun.iterator.ts`                                                                   |
| Consecutive Times (H12)                 | Logik analog `TrainrunService.propagateConsecutiveTimes`                                 |
| Haltezeit (H8)                          | Knoten-/Kategorie-Haltezeiten                                                            |
| Reisezeiten (KPI, Info)                 | `OriginDestinationService`                                                               |

## 8. Algorithmus

### 8.1 Modell

- Verschiebung **Δ (ganze Minuten) pro Abschnitt**; die Fahrzeit des Abschnitts bleibt fix.
- Abschnitte, die über eine **Durchfahrt** verbunden sind, bilden eine **Kette** (Halt → Halt)
  mit gemeinsamem Δ (H9).
- **Symmetrisch**: Hinrichtung +Δ ⇒ Rückrichtung −Δ (eine Variable pro Kette).
  **Asymmetrisch**: eine Variable pro Richtung.
- Ketten mit Locks oder an Randkanten/ausserhalb der Selektion: Δ = 0.
- Verschiebung einer Kette um +Δ: Halt davor +Δ, Halt danach −Δ (beide ≥ Mindesthaltezeit,
  ≤ Takt − 1). Ganzer Zuglauf um Δ ⇒ Gesamtfahrzeit unverändert.
- Der Gleis-Schätzer liest ausschliesslich Consecutive Times; diese werden nach jeder Verschiebung
  auf der Kopie lokal für die betroffene Kette neu berechnet.

Das Problem ist eine Variante des **Periodic Event Scheduling Problem (PESP)**
(NP-schwer) mit zusätzlicher, nicht-linearer Kapazitätsbedingung (Gleis-Schätzer).

### 8.2 Bewertete Verfahren

| Verfahren                                                               | Qualität                          | Tempo (0.25 s)                       | Eignung                  |
| ----------------------------------------------------------------------- | --------------------------------- | ------------------------------------ | ------------------------ |
| **Min-Conflicts + Tabu Search**                                         | gut für Gültigkeit (H1)           | sehr schnell, inkrementell           | ✅ Phase 1               |
| **Simulated Annealing**                                                 | gut, einfach                      | schnell                              | ✅ Phase 2 (Alternative) |
| **Large Neighborhood Search (LNS)** mit Destroy/Repair pro Kante/Knoten | sehr gut für ITF (Knoten-Cluster) | schnell                              | ✅ Phase 2 (Empfehlung)  |
| **Pareto Local Search / Archiv**                                        | liefert mehrere Vorschläge        | gering Zusatzaufwand                 | ✅ Lösungsvorschläge     |
| Modulo-Network-Simplex (PESP-Heuristik)                                 | sehr gut für reine PESP           | mittel; Gleis-Bedingung nicht linear | ⚠️ später prüfen         |
| Genetischer Algorithmus / NSGA-II                                       | gut für Multi-Objective           | zu wenige Generationen in 0.25 s     | ❌                       |
| Exakt: CP-SAT / MILP / PESP-SAT                                         | optimal                           | Solver im Browser nötig, > 0.25 s    | ❌                       |

### 8.3 Gewählter Ansatz (hybrid)

1. **Vorberechnung**: Ketten bilden, freie Variablen und erlaubte Δ-Domänen bestimmen
   (Mindesthaltezeit, Locks, Selektion); Ausgangslage bewerten, Kanten-Schätzungen cachen.
2. **Phase 1 – Gültigkeit (Min-Conflicts + Tabu)**: überschrittene Kante (H1) oder verletzte
   User-Connection (H13) wählen, beteiligte Kette
   wählen, Kandidaten-Δ testen (zuerst kleine Δ, dann Takt/2), nur betroffene Kanten neu
   schätzen; bestes Δ übernehmen, Kette tabu setzen.
3. **Phase 2 – Ziele (LNS / Simulated Annealing)**: nur gültige Nachbarschaften (Schritte, die
   eine harte Regel verletzen, werden verworfen); Destroy/Repair rund um einen Knoten; Seed für
   Reproduzierbarkeit, neuer Seed bei **Weiterrechnen**.
4. **Pareto-Archiv** nicht dominierter gültiger Lösungen (f1, f2, f3) → Vorschläge
   (minimale Änderung, meiste Anschlüsse, schnellste, ausgewogen).
5. **Abbruch** nach 0.25 s (`performance.now()`); Endvalidierung der Vorschläge mit den
   bestehenden Validatoren.

### 8.4 Performance

- Cache pro Kante (Key: Startzeiten der Züge auf der Kante), inkrementelle Neubewertung.
- Vollständige Validatoren nur auf den Endlösungen.
- Früh messen: Anzahl Kanten-Bewertungen pro 0.25 s; falls nötig schneller Vorfilter
  (Überlappungszählung auf Minutenbasis), Bestätigung durch den Infrastruktur-Schätzer.

## 9. Später / offen

- **Fahrzeitänderungen** (Verlängern/Verkürzen von Abschnittsfahrzeiten): aktuell **fix**,
  Anforderung folgt später. Erweiterungspunkt in den Options vorgesehen.
- Gewichtung der weichen Ziele (z.B. 1 Anschluss ≙ x min Fahrzeit) – Vorschlag 3 min.
- Obergrenze sinnvoller Wartezeit für Anschlüsse – Vorschlag `connectionTime` + 10 min.
- Obergrenze Verlängerung Gesamtfahrzeit – Vorschlag +5 min.
