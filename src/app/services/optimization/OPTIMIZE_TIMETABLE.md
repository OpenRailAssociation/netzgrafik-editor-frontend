**Abbrechen** – stellt die Ausgangslage exakt wieder her.

- Der Dialog ist zweispaltig: links Regeln und sortierbare Soft-KPIs, rechts Vorschläge und Preview.
  Das Umordnen von KPIs sortiert vorhandene Vorschläge ohne neuen Suchlauf; geänderte harte Regeln
  markieren Kandidaten nach Revalidierung als gültig/ungültig.
- Die Policy wird lokal im Browser gespeichert. Locks und Scope-Grenzen bleiben immer aktiv;
  Knotengleis-Auslastung ist nur eine Ergebnisansicht und kein Optimierungs-Constraint.

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
  - **Optimization Director** mit aktivierbaren harten Regeln und sortierbaren weichen Zielen.
  - Button **Optimieren**. Die Fahrzeit eines Abschnitts kann mit der optionalen harten Regel
    jeweils um höchstens `n` Minuten verlängert werden (siehe §4).

### 2.2 Optimierungsbereich (Multi-Selektion)

- Ist ein **Zuglauf ausgewählt**, werden alle Quell- und Zielknoten seiner Abschnitte als
  Optimierungsbereich verwendet. Dieser Zuglaufscope hat Vorrang vor einer Knotenauswahl.
- Knoten können mit der **rechten Maustaste** (Rechteck aufziehen) mehrfach markiert werden
  (`NodeService.getSelectedNodes()`).
- Die aktiven Editorfilter gelten für Knoten und Zugabschnitte; ausgeblendete Elemente werden
  nicht an den Optimierer übergeben.
- **Kein Zuglauf und keine Knoten markiert** → der gesamte sichtbare Bereich wird optimiert.
- **Kein Zuglauf, aber Knoten markiert** → nur das Teilnetz wird optimiert:
  - **Innere Knoten**: markierte Knoten – dort dürfen Zeiten/Halte geändert werden.
  - **Innere Kanten**: beide Endknoten markiert – dürfen verschoben werden.
  - **Randkanten**: nur ein Endknoten markiert – Zeiten sind **fix** (wie Locks).
  - Alles ausserhalb bleibt unverändert.
- Der Scope bleibt knotengestützt: Zugläufe, deren Ketten vollständig innerhalb des Bereichs liegen,
  können ebenfalls angepasst werden.
- Die Auswahl wird beim Öffnen des Dialogs gelesen und als Liste von Knoten-IDs an den Service
  übergeben.

### 2.3 Resultat-Dialog

- Liste von **Lösungsvorschlägen** mit KPIs (siehe §6), inkl. **Ausgangslage** als Referenz.
- Die **Ausgangslage (Baseline)** ist der Fahrplan vor der Suche. Alle Änderungen und Deltas der
  Vorschläge beziehen sich auf diesen Zustand; er bleibt im Dialog als Vergleich und Vorschau
  auswählbar.
- User kann zwischen den Lösungen **umschalten**; die gewählte Lösung wird als **Vorschau**
  in der Netzgrafik angezeigt (Ausgangslage jederzeit wieder wählbar).
- Detailansicht der gewählten Lösung: **was** wurde **wo** geändert (siehe §6.2).
- Buttons:
  - **Übernehmen** – lädt die gewählte Lösung definitiv (erst nachdem der User die
    Änderungen gesehen/verstanden hat).
  - **Weiterrechnen** – startet mit einem neuen Seed einen weiteren Lauf (1 s). Eine ausgewählte
    Lösung dient als Startpunkt; die Vorschläge des neuen Laufs ersetzen die bisherigen.
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
| H7  | **Abschnittsfahrzeiten**: bleiben fix, ausser die optionale harte Regel erlaubt eine Verlängerung je Abschnitt um höchstens `n` Minuten. Verkürzungen sind nicht erlaubt.                                                                                                                                          |
| H8  | **Mindesthaltezeit**: Haltezeit an Halten ≥ Mindesthaltezeit (Knoten × Zugkategorie).                                                                                                                                                                                                                             |
| H9  | **Durchfahrt (non-stop)**: Haltezeit immer 0 min, d.h. **Ankunft = Abfahrt** (beide Richtungen).                                                                                                                                                                                                                  |
| H10 | **Locks**: gelockte Zeiten (`TimeLockDto.lock`) bleiben unverändert.                                                                                                                                                                                                                                              |
| H11 | **Optimierungsbereich**: Zeiten an Randkanten und ausserhalb der Selektion bleiben unverändert.                                                                                                                                                                                                                   |
| H12 | **Konsistenz**: Ankunft = Abfahrt + Fahrzeit; Consecutive Times sind konsistent entlang des Zuglaufs.                                                                                                                                                                                                             |
| H13 | **User-Connections**: alle im Netzgrafik-Editor erfassten Anschlüsse (`Connection` am `Node`) müssen eingehalten werden: Umsteigezeit ≥ Mindestumsteigezeit des Knotens (`Node.getConnectionTime()`), bei Round-Trips in beiden Richtungen. Alle übrigen (impliziten) Anschlüsse sind optional (weiches Ziel f2). |
| H14 | **Native Objekte**: der Optimierer arbeitet ausschliesslich mit den nativen Modellobjekten der Netzgrafik (`Trainrun`, `TrainrunSection`, `Node`, `Port`, `Transition`, `Connection`) – keine eigenen Parallel-Datenmodelle.                                                                                      |

## 4. Weiche Ziele und Rangfolge

Weiche Ziele ordnen die gültigen Vorschläge. Sie lassen sich im Optimization Director aktivieren,
deaktivieren und per Drag-and-drop priorisieren. Die Standardreihenfolge ist:

1. **Minimale Änderungen**: zuerst gewinnt der Vorschlag mit weniger geänderten Δ-Ketten. Bei
   Gleichstand gewinnt die kleinere Summe der absoluten Verschiebungen `Σ|Δ|` in Minuten. Beides
   wird gegenüber der Baseline berechnet. Das ist nicht dasselbe wie die Anzahl geänderter Züge
   oder einzelner Zeiten; diese Werte stehen separat in der Vorschlagstabelle.
2. **Mehr Anschlüsse**: zählt zusätzliche, nicht explizit als User-`Connection` erfasste
   Umsteigemöglichkeiten zwischen verschiedenen Zugläufen. Die Umsteigezeit liegt zwischen der
   Mindestumsteigezeit des Knotens und dieser Mindestzeit plus 5 Minuten. User-Connections sind
   separate harte Regeln und zählen nicht als optionale Anschlüsse.
3. **Kürzere Fahrzeit**: vergleicht die Änderung der gesamten Reisezeit aller Zugläufe mit der
   Baseline, einschliesslich der Haltezeiten zwischen den Endpunkten. Ein negatives Δ bedeutet
   kürzer, ein positives Δ länger; Abschnittsfahrzeiten selbst bleiben fix.
4. **Geringere Knotengleisnutzung**: vergleicht zuerst die höchste, danach die durchschnittliche
  Knotengleiszahl.
5. **Geringere Streckengleisnutzung**: vergleicht zuerst die höchste, danach die durchschnittliche
  Gleiszahl auf den Abschnitten im Optimierungsbereich. Das bleibt als weiches Ziel unabhängig
  davon verfügbar, ob das Streckengleislimit als harte Regel aktiviert ist.

Alle fünf Zielwerte werden normiert. Die Rangposition gewichtet sie geometrisch mit `1, 1/2, 1/4,
1/8, 1/16`; Drag-and-drop ändert damit den Einfluss jedes Ziels. Gültigkeit nach den aktivierten harten
Regeln hat immer Vorrang. Ändern der weichen Ziele sortiert die bereits gefundenen Vorschläge neu;
der Suchlauf selbst verwendet weiterhin seinen internen Suchscore.

Die optionale harte Regel **Fahrzeitverlängerung pro Abschnitt** erlaubt für jeden Abschnitt
unabhängig eine Verlängerung von 0 bis `n` Minuten gegenüber der Baseline; der Standardwert ist
`n = 5`. Es gibt dafür kein zusätzliches Gesamtlimit pro Zuglauf. Die Regel verändert keine
Haltezeiten. Ist sie deaktiviert, bleiben Abschnittsfahrzeiten unverändert.

## 5. Zeitbudget

- Ein Lauf rechnet standardmässig maximal **1 s** und liefert die besten bis dahin gefundenen
  Lösungen.
- Mit **Weiterrechnen** kann der User einen weiteren Lauf mit neuem Seed und erneut bis zu **1 s**
  starten.

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

### 6.3 Baseline und KPIs lesen

- **Ausgangslage** zeigt den Fahrplan vor der Optimierung: vorher und nachher sind identisch,
  Deltas und Verschiebungen sind 0. Die Zeile ist eine Referenz, kein erzeugter Vorschlag.
- **Abschnitte über Limit** und **maximale Gleise** zeigen den Zustand vorher → nachher. Gezählt
  werden nur Kanten im Optimierungsbereich.
- **Δ Reisezeit** ist die aufsummierte Änderung der Reisezeit über alle Zugläufe in Minuten. Sie
  enthält die Änderungen der Haltezeiten zwischen Start und Ziel; Abschnittsfahrzeiten sind fix.
  Ein negatives Δ bedeutet eine kürzere, ein positives Δ eine längere Reisezeit.
- **Anschlüsse** zeigt die Anzahl optionaler Anschlussmöglichkeiten vorher → nachher.
- **Σ |Verschiebung|** summiert die Beträge der Δ-Verschiebungen in Minuten. Gegenläufige
  Verschiebungen heben sich dabei nicht auf.
- **Züge / Zeiten** zählt separat die betroffenen Zugläufe und geänderten Zeitfelder. Diese Zahl
  bestimmt nicht allein das Ziel **Minimale Änderungen**.

Eine längere Haltezeit an einem einzelnen Knoten wird nicht separat bestraft, solange sie die
aktive Mindesthaltezeitregel einhält. **Kürzere Fahrzeit** bewertet die Änderung der gesamten
Reisezeit eines Zuglaufs, einschliesslich geänderter Abschnittsfahrzeiten und Zwischenhalte.
Die optionale Grenze von `+n` gilt unabhängig für jeden Abschnitt, nicht als Summengrenze pro
Zuglauf; eine Verkürzung der Abschnittsfahrzeit ist nicht zulässig. Eine eigene maximale
Haltezeit pro Knoten ist derzeit nicht konfigurierbar.

### 6.4 Wie entstehen Vorschläge?

Der Optimierer verschiebt ganzzahlige Minuten-Δs auf Ketten aus Abschnitten, die durch
Durchfahrten verbunden sind. Dadurch ändern sich Zeiten an Halten, während Abschnittsfahrzeiten,
Route, Takt, Locks und Scope-Grenzen erhalten bleiben.

Innerhalb des Zeitbudgets sucht er zuerst gezielt an Konflikten wie Gleisüberlastungen,
Anschlussverletzungen oder zu kurzen Halten. Tabu Search verhindert unmittelbare Rücksprünge;
Simulated Annealing erlaubt gelegentlich einen zunächst schlechter bewerteten Zwischenschritt,
damit die Suche lokale Sackgassen verlassen kann. Bei Stillstand lockert eine konfliktnahe
Large-Neighborhood-Suche einen kleinen Bereich und startet von der besten bisherigen Lösung neu.
Ein inkrementeller Schätzer bewertet Kandidaten schnell; die Infrastruktur-Berechnung prüft die
ausgegebenen Gleis-KPIs exakt nach.

Die Suche verwendet interne Bewertungsgewichte, um Kandidaten während des Suchlaufs zu erkunden.
Der Director sortiert gefundene Vorschläge zusätzlich mit normierten Zielwerten und geometrischen
Gewichten `1, 1/2, 1/4, 1/8` in der aktivierten Drag-and-drop-Reihenfolge. Harte Regeländerungen
bewerten die vorhandenen Vorschläge neu; **Optimieren** startet einen neuen Suchlauf.
**Weiterrechnen** startet einen weiteren Lauf ausgehend vom ausgewählten Vorschlag.

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
  timeBudgetMs?: number; // default 1000
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

Das Problem ist eine **periodische Fahrplanoptimierung auf einer bestehenden Netzgrafik**:
Kettenverschiebungen (Δ) verändern Ereigniszeiten, während Streckenabschnitte gemeinsam genutzte
Ressourcen mit einer nicht-linearen Gleis-Kapazitätsprüfung sind. Es hat PESP-artige periodische
Zeitbedingungen, ist aber weder ein reines PESP-Benchmarkproblem noch MAPF auf einem Raster.

### 8.2 Bewertete Verfahren

Die Tempoangaben der folgenden Verfahrensbewertung beziehen sich auf die ursprüngliche
Benchmarkbasis von 0.25 s und nicht auf das aktuelle Standardbudget.

| Verfahren                                                               | Qualität                          | Tempo (0.25 s)                       | Eignung                  |
| ----------------------------------------------------------------------- | --------------------------------- | ------------------------------------ | ------------------------ |
| **Min-Conflicts + Tabu Search**                                         | gut für Gültigkeit (H1)           | sehr schnell, inkrementell           | ✅ Phase 1               |
| **Simulated Annealing**                                                 | gut, einfach                      | schnell                              | ✅ Phase 2 (Alternative) |
| **Large Neighborhood Search (LNS)** mit Destroy/Repair pro Kante/Knoten | sehr gut für ITF (Knoten-Cluster) | schnell                              | ✅ Phase 2 (Empfehlung)  |
| **Pareto Local Search / Archiv**                                        | liefert mehrere Vorschläge        | gering Zusatzaufwand                 | ✅ Lösungsvorschläge     |
| Modulo-Network-Simplex (PESP-Heuristik)                                 | sehr gut für reine PESP           | mittel; Gleis-Bedingung nicht linear | ⚠️ später prüfen         |
| Genetischer Algorithmus / NSGA-II                                       | gut für Multi-Objective           | zu wenige Generationen in 0.25 s     | ❌                       |
| Exakt: CP-SAT / MILP / PESP-SAT                                         | optimal                           | Solver im Browser nötig, > 0.25 s    | ❌                       |

### 8.3 Gewählter Ansatz (Netzgrafik Conflict Repair + LNS)

1. **Vorbereitung**: Ketten, Δ-Domänen und Abhängigkeiten zu Strecken, Halten und Anschlüssen
   einmalig aus nativen Netzgrafik-Objekten indizieren. Locks und Scope-Grenzen bleiben zwingend.
2. **Konfliktindex**: Streckengleis-Überlastungen, User-Connection-Verletzungen, aktivierte
   Mindesthaltezeitregeln und optionale Fahrzeitgrenzen pro Zuglauf als Konflikte führen. Konflikte
   verweisen auf betroffene Ketten, Knoten und Strecken; es entsteht kein zweiter Netzgrafik-Graph.
3. **Konflikt-Reparatur**: den höchstpriorisierten aktiven Konflikt wählen, Werte der betroffenen
   Δ-Ketten testen und nur abhängige Konflikte aktualisieren. Tabu verhindert direkte Zyklen.
4. **Erkundung und Neustart**: Min-Conflicts/Tabu wird mit Simulated-Annealing-Schritten
   kombiniert. Nach längerer Stagnation setzt LNS bei der besten Lösung an und verändert eine
   begrenzte, konfliktnahe Kettengruppe.
5. **Archiv und Anzeige**: nur nach den aktiven harten Regeln gültige, nicht dominierte Lösungen
   kommen ins Archiv. Die UI ordnet sie separat lexikografisch nach den aktivierten Zielen;
   weiche Ziele ändern die Suche nicht, Hard-Rule-Änderungen revalidieren ohne Suchlauf.
6. **Zeitbudget**: deterministischer Seed und Deadline via `performance.now()`. Konflikt- und
   Nachbarschaftsindizes werden wiederverwendet; der exakte Infrastruktur-Schätzer bestätigt die
   Baseline einmal pro Lauf und geänderte Strecken bei Kandidaten.

Flatland ist hier **Architektur-Inspiration**, kein Problem- oder Datenmodell: Die Suche bleibt
eine periodische Netzgrafik-Fahrplanoptimierung auf bestehenden nativen Objekten mit Δ-Moves.

### 8.4 Performance

- Cache pro Kante (Key: Startzeiten der Züge auf der Kante), inkrementelle Neubewertung und
  Prioritätsheap für aktive Konflikte.
- Vollständige Validatoren nur auf den Endlösungen.
- Früh messen: Anzahl Kanten-Bewertungen pro 1 s; falls nötig schneller Vorfilter
  (Überlappungszählung auf Minutenbasis), Bestätigung durch den Infrastruktur-Schätzer.

## 9. Später / offen

- Knotengleis-/Knotenauslastungs-Constraints: nicht Teil des aktuellen Scopes; die bestehende
  Knotenauslastungs-View bleibt eine Ergebnisvisualisierung.

- **Fahrzeitänderungen** (Verlängern/Verkürzen von Abschnittsfahrzeiten): aktuell **fix**,
  Anforderung folgt später. Erweiterungspunkt in den Options vorgesehen.
- Benutzerdefinierte Obergrenze für optionale Anschluss-Wartezeiten; aktuell gilt
  `connectionTime` bis `connectionTime + 5 min`.
