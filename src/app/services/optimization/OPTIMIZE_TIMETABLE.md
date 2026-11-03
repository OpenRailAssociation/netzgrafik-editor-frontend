# Optimize Timetable – Anforderungen

Status: **implementiert** (Details und getroffene Annahmen: [UMSETZUNGSVORSCHLAG.md – Abschnitt 10](./UMSETZUNGSVORSCHLAG.md#10-implementierungsstand))

## Kurzüberblick

- Der Dialog ist zweispaltig: links werden Director-Profile oder die benutzerdefinierte Policy eingestellt, rechts stehen Resultate und Vorschläge. Im Director-Modus sortiert die Wichtigkeit der weichen Ziele die Vorschläge; gleiche Wichtigkeit ergibt gleiches Gewicht. In der benutzerdefinierten Policy sortiert die manuelle Rangfolge die Vorschläge neu, ohne einen Suchlauf zu starten. Eine ausgewählte Lösung wird in der Netzgrafik als Vorschau angezeigt; Änderungen an harten Regeln prüfen vorhandene Vorschläge erneut auf Gültigkeit.
- Scope-Grenzen sind immer aktiv. Zeit- und Fahrzeit-Locks sind standardmässig aktiv, lassen sich aber in der Policy ausschalten. Änderungen an der Policy werden erst über **Policy speichern** dauerhaft im Browser abgelegt.
- Knotengleis-Auslastung ist keine harte Regel. Das standardmässig aktive weiche Ziel dafür beeinflusst die Bewertung der Suche.

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
  - **Optimization Director** mit drei Fokusprofilen sowie einer optionalen benutzerdefinierten Steuerung für harte Regeln und weiche Ziele.
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

- Beim Öffnen des Dialogs ist die kompakte, scrollbar begrenzte **Streckengleis-Übersicht (IST)**
  ausgeklappt. Sie zeigt die geschätzte Gleiszahl und Topologie der sichtbaren Abschnitte.
- Liste von **Lösungsvorschlägen** mit KPIs (siehe §6), inkl. **Ausgangslage** als Referenz.
- Die **Ausgangslage (Baseline)** ist der Fahrplan vor der Suche. Alle Änderungen und Deltas der
  Vorschläge beziehen sich auf diesen Zustand; er bleibt im Dialog als Vergleich und Vorschau
  auswählbar.
- User kann zwischen den Lösungen **umschalten**; die gewählte Lösung wird als **Vorschau**
  in der Netzgrafik angezeigt (Ausgangslage jederzeit wieder wählbar).
- Detailansicht der gewählten Lösung: **was** wurde **wo** geändert (siehe §6.2).
- Nach dem Optimierungslauf wird **Result** ausgeklappt und die Streckengleis-Übersicht eingeklappt.
  Die Panels sind gegenseitig exklusiv; beide bleiben über ihren Header erreichbar.
- Buttons:
  - **Übernehmen** – lädt die gewählte Lösung definitiv (erst nachdem der User die
    Änderungen gesehen/verstanden hat).
  - **Weiterrechnen** – investiert ein weiteres Zeitbudget in dieselbe Suchsession (standardmässig
    2 s). Suchzustand und Archiv bleiben erhalten; die Vorschläge werden neu aus dem Archiv gewählt.
  - **Abbrechen** – stellt die Ausgangslage exakt wieder her.
- Wird keine gültige Lösung gefunden, wird dies angezeigt (inkl. Kanten mit Überschreitung);
  **Übernehmen** ist dann deaktiviert.

## 3. Harte Regeln (dürfen nie verletzt werden)

| #   | Regel                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | **Gleise pro Kante**: für jede Kante (AB, BC, CD, …) gilt `max(tracks) ≤ maxTracks` (User-Wert). Berechnung mit `InfrastructureEstimatorService.estimateSectionTracks`; Hin- und Rückrichtung zusammen, eine Kante pro Knotenpaar.                                                                                                                                                                                               |
| H2  | **Ganze Minuten**: alle Zeiten sind ganzzahlig. Optimierte Zeiten werden **gerundet**, Fahrzeiten immer auf die nächste volle Minute **aufgerundet**.                                                                                                                                                                                                                                                                            |
| H3  | **Mengengerüst / Frequenz fix**: Frequenz (Takt) und Frequenz-Offset werden nicht verändert; keine Zugläufe hinzufügen/entfernen.                                                                                                                                                                                                                                                                                                |
| H4  | **Route fix**: gleiche Knoten, Abschnitte, Reihenfolge, Ports, Transitions; Halte bleiben Halte, Durchfahrten bleiben Durchfahrten.                                                                                                                                                                                                                                                                                              |
| H5  | **Richtung**: alle Züge fahren hin und zurück (`ROUND_TRIP`), ausser `ONE_WAY`.                                                                                                                                                                                                                                                                                                                                                  |
| H6  | **Symmetrie um Minute 00**: Abfahrt von Zug A am Knoten X = :00 + x ⇒ Ankunft von Zug A (Gegenrichtung) am Knoten X = :00 − x (mod 60). Ausnahme: explizit asymmetrisch gesetzte Abschnitte. Symmetrie wird nach dem Runden berechnet.                                                                                                                                                                                           |
| H7  | **Abschnittsfahrzeiten**: bleiben fix, ausser die optionale harte Regel erlaubt eine Verlängerung je Abschnitt um höchstens `n` Minuten. Verkürzungen sind nicht erlaubt.                                                                                                                                                                                                                                                        |
| H8  | **Mindesthaltezeit**: Haltezeit an Halten ≥ Mindesthaltezeit (Knoten × Zugkategorie).                                                                                                                                                                                                                                                                                                                                            |
| H9  | **Durchfahrt (non-stop)**: Haltezeit immer 0 min, d.h. **Ankunft = Abfahrt** (beide Richtungen).                                                                                                                                                                                                                                                                                                                                 |
| H10 | **Locks**: gelockte Zeiten (`TimeLockDto.lock`) bleiben unverändert.                                                                                                                                                                                                                                                                                                                                                             |
| H11 | **Optimierungsbereich**: Zeiten an Randkanten und ausserhalb der Selektion bleiben unverändert.                                                                                                                                                                                                                                                                                                                                  |
| H12 | **Konsistenz**: Ankunft = Abfahrt + Fahrzeit; Consecutive Times sind konsistent entlang des Zuglaufs.                                                                                                                                                                                                                                                                                                                            |
| H13 | **User-Connections**: wenn die harte Regel aktiv ist, muss jeder im Netzgrafik-Editor erfasste Anschluss (`Connection` am `Node`) in beiden Richtungen mindestens die konfigurierte Mindestumsteigezeit des Knotens (`Node.getConnectionTime()`) einhalten. Die bisherige Wartezeit ist keine harte Obergrenze; ihr Erhalt ist ein separates weiches Ziel. Alle übrigen (impliziten) Anschlüsse sind optional (weiches Ziel f2). |
| H14 | **Native Objekte**: der Optimierer arbeitet ausschliesslich mit den nativen Modellobjekten der Netzgrafik (`Trainrun`, `TrainrunSection`, `Node`, `Port`, `Transition`, `Connection`) – keine eigenen Parallel-Datenmodelle.                                                                                                                                                                                                     |

## 4. Weiche Ziele und Rangfolge

Weiche Ziele ordnen gültige Vorschläge. Im Director-Modus wählt der User eines der Profile
**Fahrplan stabilisieren**, **Anschlüsse verbessern** oder **Gleisbedarf reduzieren** und stellt
pro Ziel die Wichtigkeit von 1 bis 10 ein. Die Vorschlagsliste rechts ist nach Wichtigkeit
absteigend sortiert. Bei gleicher Wichtigkeit erhalten Ziele dasselbe Gewicht; die nächste
Rangposition wird übersprungen. Das Gewicht einer Rangposition ist `1 / 2^Rangposition`, beginnend
bei Rangposition 0. Beispiele:

- Ratings `5, 5, 3` ergeben Gewichte `1, 1, 1/4`.
- Ratings `10, 5, 3` ergeben Gewichte `1, 1/2, 1/4`.

Die Reihenfolge der fünf Ziele bei Gleichstand ist fest:

1. **Minimale Änderungen**: zuerst gewinnt der Vorschlag mit weniger geänderten Δ-Ketten. Bei
   Gleichstand gewinnt die kleinere Summe der absoluten Verschiebungen `Σ|Δ|` in Minuten. Beides
   wird gegenüber der Baseline berechnet. Das ist nicht dasselbe wie die Anzahl geänderter Züge
   oder einzelner Zeiten; diese Werte stehen separat in der Vorschlagstabelle.
2. **Anschlusszeiten stabilisieren**: bevorzugt die bisherige Wartezeit für explizite
   User-`Connection`s. Das ist nur ein weiches Ziel und kann die harte Mindestumsteigezeit
   weder ersetzen noch abschwächen.
3. **Mehr Anschlüsse**: zählt zusätzliche, nicht explizit als User-`Connection` erfasste
   Umsteigemöglichkeiten zwischen verschiedenen Zugläufen. Die Umsteigezeit liegt zwischen der
   Mindestumsteigezeit des Knotens und dieser Mindestzeit plus 5 Minuten. User-Connections sind
   separate harte Regeln und zählen nicht als optionale Anschlüsse.
4. **Kürzere Fahrzeit**: vergleicht die Änderung der gesamten Reisezeit aller Zugläufe mit der
   Baseline, einschliesslich der Haltezeiten zwischen den Endpunkten. Ein negatives Δ bedeutet
   kürzer, ein positives Δ länger; Abschnittsfahrzeiten selbst bleiben fix.
5. **Geringere Knotengleisnutzung**: vergleicht zuerst die höchste, danach die durchschnittliche
   Knotengleiszahl.
6. **Geringere Streckengleisnutzung**: vergleicht zuerst die höchste, danach die durchschnittliche
   Gleiszahl auf den Abschnitten im Optimierungsbereich. Das bleibt als weiches Ziel unabhängig
   davon verfügbar, ob das Streckengleislimit als harte Regel aktiviert ist.

Die sechs Ziele sind **Minimale Änderungen**, **Anschlusszeiten stabilisieren**, **Mehr Anschlüsse**, **Kürzere Fahrzeit**,
**Geringere Knotengleisnutzung** und **Geringere Streckengleisnutzung**. Im benutzerdefinierten
Modus lassen sich Ziele aktivieren, deaktivieren und per Drag-and-drop priorisieren; ihr Gewicht
ist `1 / 2^Rangposition` in der manuellen Reihenfolge. Da diese Rangfolge eindeutig ist, gibt es
dort keine Gleichstände. Gültigkeit nach den aktivierten harten Regeln hat immer Vorrang.
Änderungen an weichen Zielen sortieren vorhandene Vorschläge neu; **Optimieren** startet einen
neuen Suchlauf.

Die optionale harte Regel **Fahrzeitverlängerung pro Abschnitt** erlaubt für jeden Abschnitt
unabhängig eine Verlängerung von 0 bis `n` Minuten gegenüber der Baseline; der Standardwert ist
`n = 5`. Es gibt dafür kein zusätzliches Gesamtlimit pro Zuglauf. Die Regel verändert keine
Haltezeiten. Ist sie deaktiviert, bleiben Abschnittsfahrzeiten unverändert.

## 5. Zeitbudget

- Die Suchstufen verwenden pro Versuch **0.5, 1, 2, 4 oder 8 s**. Damit dauert jede Stufe
  doppelt so lange wie zuvor; der Standard liegt bei **2 s pro Versuch**.
- Bis zu drei automatische Versuche können mit je einem neuen Seed und Warmstart laufen.
- Mit **Weiterrechnen** kann der User der bestehenden Suchsession erneut bis zu **8 s**
  Suchzeit hinzufügen.

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

- **Abschnitte mit Fahrplanänderung**: fünf Spalten – Abschnitt, maximale Gleise vorher,
  Topologie vorher, maximale Gleise nachher und Topologie nachher. Die Topologien beruhen auf den
  geschätzten Teilsegmenten der jeweiligen Ausgangslage bzw. ausgewählten Lösung. Angezeigt werden
  nur Abschnitte mit Fahrplanänderungen; deshalb kann die Gleiszahl gleich bleiben (z.B. `2 → 2`).
  Bei aktivem Gleislimit sind überzählige Gleise und Zahlen rot markiert.
- **Zugläufe**: Gesamtfahrzeit vorher → nachher.
- **Zeitänderungen**: pro Zuglauf / Knoten / Richtung, alt → neu (inkl. Symmetriezeit, Rundungen markiert).
- **Anschlüsse**: verloren / gewonnen pro Knoten.
- **Knotenanalyse**: Änderungen je Knoten; der Auslastungsanzeiger vergleicht **Vorher** und
  **Nachher** (`estimateNodeTracks`, keine harte Regel).

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

Die Director-Profile **Mehr Spielraum – Häufige zuerst** und **Mehr Spielraum –
Wichtige zuerst** schalten Variablen progressiv nach Suchbudget frei. Beim
Kategorieprofil stammt der Rang aus `TrainrunCategory.order`; kleinere Werte
kommen zuerst, gleiche Werte gemeinsam. Die Metadaten bestimmen die Reihenfolge,
keine fest codierte Zugkategorienliste. Alle Zugläufe und Konflikte bleiben von
Anfang an in der Bewertung; spätere Gruppen werden nicht aus dem Fahrplan
entfernt. Innerhalb eines Suchversuchs sind alle Gruppen spätestens nach der
ersten Hälfte des Budgets freigeschaltet. Wenn bis zu drei automatische Versuche
keinen gültigen Vorschlag finden, startet jeder Folgeversuch mit dem besten
internen Suchzustand des vorherigen Versuchs und einem neuen Seed statt erneut
mit dem Ausgangsfahrplan. Dieser Warmstart kann weiterhin ungültig sein.

Im Profil **Wichtige zuerst** bleibt die erste Gruppe bei höchstens fünf Minuten
Abstand pro Konfliktschritt. Für spätere Gruppen prüft der Solver Kandidaten über
die ganze zulässige `Δ`-Domäne. Bei Zeitverschiebungen entspricht diese höchstens
einem halben Takt, abgerundet auf ganze Minuten und begrenzt auf 30 Minuten.
Kleinere Distanzen zur aktuellen Lage werden zuerst getestet. Das Ziel
**Minimale Änderungen** bleibt aktiv; die grössere Suchweite erweitert nicht die
zulässige Domäne und garantiert keine kleinere Gesamtänderung. Sie kann mehr
Kandidatenbewertungen und damit weniger Iterationen innerhalb desselben
Zeitbudgets verursachen.

Bei Konfliktschritten testet der Solver zunächst eine Verschiebung um eine
Minute, danach gezielt die `sectionHeadway`-Zeit der betroffenen Zugkategorie
(zum Beispiel ±3 Minuten), bevor er die übrigen nahen Schritte prüft. Dieser
Zugfolgezeit-Schritt wird auch dann einbezogen, wenn er grösser als fünf Minuten
ist; die zulässige Verschiebungsdomäne bleibt unverändert.
Wenn kein direkt konfliktverbessernder Zuglauf-Schritt verfügbar ist, kann die
Suche eine koordinierte Verschiebung als Erkundung annehmen, solange die Zahl
harter Konflikte nicht steigt. Ein höherer Score wird dabei temperaturabhängig
wie beim Simulated Annealing akzeptiert.

Die Suche verwendet die Policy-Gewichte, um Kandidaten während des Suchlaufs zu erkunden. Im
Director-Modus werden diese aus den Ratings und Rangpositionen abgeleitet; gleiche Ratings erhalten
das Gewicht ihrer gemeinsamen Rangposition. In der benutzerdefinierten Steuerung folgen die
Gewichte der manuellen Reihenfolge. Harte Regeländerungen bewerten die vorhandenen Vorschläge neu;
**Optimieren** startet einen neuen Suchlauf.
**Weiterrechnen** verlängert die bestehende Suchsession um das gewählte Zeitbudget; der
Suchzustand und das Kandidatenarchiv bleiben dabei erhalten.

## 7. Architektur

### 7.1 Service

- Service `OptimizeTimetableService` verwaltet zusätzlich zur Optimierungslogik die kurzlebige
  Suchsession für **Weiterrechnen**.
  (`src/app/services/optimization/optimize-timetable.service.ts`).
- **Reines TypeScript** im Service: keine externen Solver, keine neuen Abhängigkeiten, kein Backend.
  Das Zielbild, die aktuelle Heuristik und die geprüften Alternativen sind in
  [OPTIMIERER_ZIELBILD.md](./OPTIMIERER_ZIELBILD.md) dokumentiert.
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

- Die Eingabe besteht aus den nativen **`Trainrun`**-, **`TrainrunSection`**- und **`Node`**-Objekten.
  Für jeden Zuglauf ordnet der Algorithmus dessen Abschnitte entlang des modellierten Pfads.
- Eine **Kette** ist eine Folge aufeinanderfolgender `TrainrunSection`s zwischen zwei Haltepunkten.
  Abschnitte, die an einem als Durchfahrt modellierten Knoten weiterführen, gehören zur selben
  Kette. An einem Halt wird die Folge geteilt. Auch das Ende eines Zuglaufpfads beendet eine
  Kette. Der Algorithmus erkennt einen Halt anhand des Knotens und der jeweiligen Sektion; ein
  Knoten kann deshalb für einen Zuglauf Durchfahrt und für einen anderen Halt sein.
- Für jede verschiebbare Kette gibt es eine ganzzahlige **Kettenverschiebung Δ**. Δ ist nicht eine
  unabhängig wählbare Verschiebung pro Abschnitt: Der Start der Kette wird verschoben und die
  Zeiten werden anschliessend Abschnitt für Abschnitt mit deren Fahrzeiten fortgeschrieben. Sind
  die Fahrzeiten unverändert, verschieben sich alle aktiven Ankunfts- und Abfahrtszeiten dieser
  Kette um dasselbe Δ. Der Code begrenzt Δ auf ganze Werte von
  `-floor(min(Frequenz, 60) / 2)` bis `+floor(min(Frequenz, 60) / 2)` Minuten. Bei einer Frequenz
  von 60 Minuten ist der Variablenbereich also −30 bis +30 Minuten. Halte, Anschlüsse und weitere
  aktive Regeln entscheiden zusätzlich, welche dieser Werte in einer gültigen Lösung zulässig sind.
- Ist die harte Regel **Zeit-Locks** aktiv und trägt irgendeine Sektion der Kette einen gelockten
  Ankunfts- oder Abfahrtszeitpunkt, wird die ganze Kette für Δ fixiert. Ist diese Regel
  ausgeschaltet, werden diese Zeit-Locks bei der Verschiebbarkeit ignoriert. Ohne gesetzten
  Zeit-Lock kann die Kette bei erfüllten übrigen Regeln verschoben werden. Das bedeutet nicht,
  dass nur Abfahrtszeiten geändert werden: Die Verschiebung kann je nach Fahrtrichtung auch
  Ankunftszeiten und weitere Abfahrten in der Kette anpassen.
- Ketten ausserhalb des gewählten Scopes oder mit einem Endpunkt ausserhalb des Scopes bleiben
  immer fix. Diese Scope-Grenze ist verpflichtend und nicht durch Ausschalten einer anderen
  Lock-Regel übersteuerbar.
- Zuglaufteile, die der Code nicht als linearen Pfad ordnen kann, insbesondere erkannte Zyklen,
  werden nicht in verschiebbare Ketten aufgenommen und bleiben fix.
- Bei Round-Trips können Hin- und Rückrichtung durch aktive Symmetrie gekoppelt sein. Dann kann
  eine Verschiebung in der Gegenrichtung mit umgekehrtem Vorzeichen abgebildet werden. Sind die
  Richtungen nicht gekoppelt, können sie eigene Kettenvariablen haben. One-way-Zugläufe haben
  keine aktive Gegenrichtung.

#### Beispiel: Kettenverschiebung an einem Durchfahrtsknoten

Angenommen, die Netzgrafik enthält folgende Modellobjekte:

| Objekt               | Modellinhalt                                                          |
| -------------------- | --------------------------------------------------------------------- |
| `Node A`             | Startknoten des Zuglaufs                                              |
| `Node B`             | Durchfahrt für diesen Zuglauf; keine Wartezeit zwischen den Sektionen |
| `Node C`             | Halt beziehungsweise Ende dieses Pfads                                |
| `Trainrun R7`        | One-way, Takt/Frequenz 60 Minuten                                     |
| `TrainrunSection S1` | `A → B`, Abfahrt A 08:00, Ankunft B 08:20, Fahrzeit 20 Minuten        |
| `TrainrunSection S2` | `B → C`, Abfahrt B 08:20, Ankunft C 08:45, Fahrzeit 25 Minuten        |

Weil `B` für `R7` eine Durchfahrt ist, bilden `S1` und `S2` gemeinsam die Kette
`R7: A → B → C`. Die Fahrzeiten bleiben in diesem Beispiel unverändert. Angenommen, alle
betroffenen Ankunfts- und Abfahrts-Locks sind nicht gesetzt, die Knoten liegen im Scope und die
übrigen harten Regeln erlauben die Verschiebung. Wählt der Suchlauf **Δ = +2 Minuten**, ergibt
sich:

| Sektion | Vorher                                             | Nachher                                            |
| ------- | -------------------------------------------------- | -------------------------------------------------- |
| `S1`    | A Abfahrt 08:00 → B Ankunft 08:20; Fahrzeit 20 min | A Abfahrt 08:02 → B Ankunft 08:22; Fahrzeit 20 min |
| `S2`    | B Abfahrt 08:20 → C Ankunft 08:45; Fahrzeit 25 min | B Abfahrt 08:22 → C Ankunft 08:47; Fahrzeit 25 min |

Der Algorithmus wählt also nicht zwei unabhängige Änderungen „08:00 wird 08:02“ und
„08:20 wird 08:22“. Er wählt einen Kettenwert Δ; daraus werden die Ereigniszeiten der Sektionen
der Reihe nach berechnet. An der Durchfahrt B bleiben Ankunft und Abfahrt konsistent. Die
Fahrzeit von `R7` wird durch eine reine Kettenverschiebung nicht länger.

Wäre `B` stattdessen ein Halt, endete die erste Kette bei `B` und die zweite begänne dort. Dann
hätten die beiden Ketten eigene Δ-Variablen. Sie dürften nicht beliebig unabhängig verschoben
werden: Die resultierende Haltezeit zwischen Ankunft und Abfahrt muss die aktive
Mindesthaltezeitregel sowie weitere aktive Anschlussregeln erfüllen.

#### TravelTime ist eine separate Anpassung

Eine TravelTime-Änderung ist **nicht** dasselbe wie Δ. Sie verändert die Fahrzeit einer
`TrainrunSection` und wirkt sich auf die danach berechneten Zeiten in derselben Kette aus. Sie
steht nur zur Verfügung, wenn die optionale harte Regel **maximale Fahrzeitverlängerung pro
Abschnitt** aktiviert ist. Dann darf jede betroffene Fahrzeit einzeln um 0 bis zum eingestellten
Wert `n` Minuten verlängert werden. In einer ausgegebenen gültigen Lösung kann eine Fahrzeit
nicht verkürzt sein. Die heuristische Suche kann intern auch unzulässige Zwischenwerte prüfen;
die aktive harte Regel bewertet eine Verkürzung als Verletzung und solche Kandidaten werden nicht
als gültige Lösung ausgegeben.

Zusätzlich müssen die passenden Locks und der Scope die Änderung erlauben:

- Ist **TravelTime-Locks** aktiv, darf die Fahrzeit in der betreffenden Richtung nicht gelockt
  sein. Ist die Regel ausgeschaltet, wird dieser TravelTime-Lock ignoriert.
- Ist **Zeit-Locks** aktiv, dürfen die Ankunfts- und Abfahrtsfelder, deren Zeiten durch diese
  Verlängerung fortgeschrieben würden, nicht gelockt sein. Die Verlängerung von `S1` verändert
  nicht dessen Startabfahrt, aber dessen Ankunft und die nachfolgenden Zeiten der Kette.
- Die betroffene Sektion und alle dadurch beeinflussten Knoten müssen im Scope liegen.

Im Beispiel oben seien die Fahrzeitverlängerungsregel aktiv und `S1` in Fahrtrichtung nicht
gelockt; auch die betroffenen Ankunfts- und Abfahrtszeiten seien nicht gelockt. Eine Erhöhung der
Fahrzeit von `S1` um **3 Minuten** ergibt bei Δ = 0:

| Sektion | Vorher                                             | Nachher                                            |
| ------- | -------------------------------------------------- | -------------------------------------------------- |
| `S1`    | A Abfahrt 08:00 → B Ankunft 08:20; Fahrzeit 20 min | A Abfahrt 08:00 → B Ankunft 08:23; Fahrzeit 23 min |
| `S2`    | B Abfahrt 08:20 → C Ankunft 08:45; Fahrzeit 25 min | B Abfahrt 08:23 → C Ankunft 08:48; Fahrzeit 25 min |

Die zusätzliche Fahrzeit von `S1` verschiebt also B und die nachfolgenden Ereignisse um drei
Minuten. Falls gleichzeitig Δ = +2 gewählt wird, fährt `R7` in A um 08:02 ab; B liegt dann bei
08:25 und C bei 08:50. Das sind zwei getrennte Entscheidungen: **Δ verschiebt den Start der
Kette**, die **TravelTime-Erhöhung verlängert eine Sektion** und propagiert die Änderung ab dort.

Die TravelTime-Locks sind je nach Modellrichtung getrennt (`travelTime` vorwärts und
`backwardTravelTime` rückwärts). Bei aktiver Symmetrie können beide Richtungen gekoppelt sein;
dann muss die Änderung für beide Richtungen zulässig sein. Ohne aktivierte
Fahrzeitverlängerungsregel gibt es keine TravelTime-Änderungsvariable, auch wenn eine Sektion
unlocked ist.

Die Suche bewertet Kandidaten mit ihren berechneten Zeiten und Fahrzeiten. Sie speichert einen
Vorschlag zunächst als Änderungen; beim Auswählen wird er als Vorschau angezeigt. Erst **Übernehmen**
behält ihn im Fahrplan, **Abbrechen** stellt die Ausgangslage wieder her.

Im Code ordnet [`buildPaths()`](./optimize-timetable.chains.ts) die Sektionen eines Zuglaufs und
teilt sie an Halten in Ketten. Die gleiche Datei legt Zeit-Locks, TravelTime-Locks und Scope als
Gründe für fixierte Variablen fest. [`applyChain()`](./optimize-timetable.evaluator.ts) berechnet
aus Δ und optionalen Fahrzeitänderungen die Kandidatenzeiten; [`isSolutionValid()`](./optimize-timetable.service.ts)
prüft anschliessend, ob eine ausgegebene Lösung die aktiven harten Regeln einhält.

Das Problem ist eine **periodische Fahrplanoptimierung auf einer bestehenden Netzgrafik**:
Kettenverschiebungen (Δ) verändern Ereigniszeiten, während Streckenabschnitte gemeinsam genutzte
Ressourcen mit einer nicht-linearen Gleis-Kapazitätsprüfung sind. Es hat PESP-artige periodische
Zeitbedingungen, ist aber weder ein reines PESP-Benchmarkproblem noch MAPF auf einem Raster.

### 8.2 Verfahrensstatus

| Verfahren                        | Status im Repository                      | Einordnung                                                                                                                                                                              |
| -------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Min-Conflicts + Tabu             | Implementiert                             | Konfliktorientierte Kandidatenwahl; normalerweise höchstens fünf Minuten Abstand, im Kategorieprofil für spätere Gruppen bis zur erlaubten Δ-Domäne.                                    |
| Simulated Annealing              | Implementiert                             | Zufällige variable/Schritt-Auswahl und temperaturabhängige Annahme schlechterer Zwischenstände.                                                                                         |
| LNS-inspirierte Perturbation     | Implementiert                             | Nach Stagnation kleine Variablengruppe konfliktbezogen verändern; kein adaptives ALNS und kein separater Repair-Lauf.                                                                   |
| Mehr Spielraum – Häufige zuerst  | Implementiert als Director-Profil         | Deaktiviert Zeit-Locks, erlaubt +5 Minuten Fahrzeit und schaltet Variablen nach aufsteigendem Taktabstand frei.                                                                         |
| Mehr Spielraum – Wichtige zuerst | Implementiert als Director-Profil         | Gleiche Flexibilitätsregeln; schaltet Kategorien nach aufsteigendem `TrainrunCategory.order` frei und erweitert für spätere Gruppen die getestete Suchweite bis zur erlaubten Δ-Domäne. |
| Begrenztes Pareto-Archiv         | Implementiert                             | Nur Kandidaten ohne Evaluator-Hartverletzungen; Service validiert Endvorschläge erneut.                                                                                                 |
| VNS                              | Nicht implementiert                       | Kandidat für einen isolierten Benchmark gegen die bestehende Suche.                                                                                                                     |
| ALNS                             | Nicht implementiert                       | Erst nach Einzelbewertung einfacher Destroy-/Repair-Operatoren untersuchen.                                                                                                             |
| CBS                              | Nicht implementiert                       | Nicht mit dem vorhandenen ConflictIndex verwechseln; allenfalls begrenzte lokale CBS-ähnliche Reparatur benchmarken.                                                                    |
| CP-SAT / MILP / PESP-SAT         | Nicht als Browser-Produktivsolver geplant | Offline-Referenz für kleine Testfälle wäre getrennt zu prüfen; keine Laufzeit- oder Qualitätsannahme ohne Messung.                                                                      |

### 8.3 Gewählter Ansatz (Netzgrafik Conflict Repair + LNS)

1. **Vorbereitung**: Ketten, Δ-Domänen und Abhängigkeiten zu Strecken, Halten und Anschlüssen
   einmalig aus nativen Netzgrafik-Objekten indizieren. Locks und Scope-Grenzen bleiben zwingend.
2. **Konfliktindex**: Streckengleis-Überlastungen, User-Connection-Verletzungen, aktivierte
   Mindesthaltezeitregeln und optionale Fahrzeitgrenzen pro Zuglauf als Konflikte führen. Konflikte
   verweisen auf betroffene Ketten, Knoten und Strecken; es entsteht kein zweiter Netzgrafik-Graph.
3. **Konflikt-Reparatur**: den höchstpriorisierten aktiven Konflikt wählen, nahe Werte der
   betroffenen Δ-Ketten testen und nur abhängige Konflikte aktualisieren. Tabu verhindert direkte
   Zyklen; grössere Verschiebungen können über mehrere Suchschritte entstehen.
4. **Erkundung und Neustart**: Min-Conflicts/Tabu wird mit Simulated-Annealing-Schritten
   kombiniert. Nach mehr als 50 Iterationen ohne neue beste Lösung setzt die LNS-inspirierte
   Perturbation bei der besten Lösung an und verändert zufällig drei bis sieben Variablen ohne
   Wiederholung aus einer begrenzten, konfliktbezogenen Gruppe. Neustarts liegen mindestens
   50 Iterationen auseinander. Sie ist kein ALNS und führt keinen eigenen Repair-Lauf aus.
5. **Archiv und Anzeige**: nur nach den aktiven harten Regeln gültige, nicht dominierte Lösungen
   kommen ins Archiv. Weiche Ziele beeinflussen die gewichtete Kandidatenbewertung und die
   Pareto-Dominanz; eine streng lexikografische Optimierung ist das nicht. Die Endvorschläge
   werden erneut validiert.
6. **Zeitbudget**: deterministischer Seed und Deadline via `performance.now()`. Konflikt- und
   Nachbarschaftsindizes werden wiederverwendet; der exakte Infrastruktur-Schätzer bestätigt die
   Baseline einmal pro Lauf und geänderte Strecken bei Kandidaten.

Flatland ist hier **Architektur-Inspiration**, kein Problem- oder Datenmodell: Die Suche bleibt
eine periodische Netzgrafik-Fahrplanoptimierung auf bestehenden nativen Objekten mit Δ-Moves.

### 8.4 Performance

- Kantenbelegungen werden inkrementell mit einem minutenbasierten Surrogat neu bewertet;
  die Infrastruktur-Schätzung bestätigt ausgegebene Vorschläge exakt.
- Knotengleis-Schätzungen verwenden nur die am Knoten angrenzenden Abschnitte. Sie werden
  während der Suche erst berechnet, wenn alle harten Regeln erfüllt sind; davor tragen
  weiche Knotengleis-Ziele nichts zur Bewertung infeasibler Zustände bei. Bei gültigen
  Zuständen werden nur betroffene Knoten neu geschätzt. Ein begrenzter LRU-Cache pro
  Knoten speichert exakte Ergebnisse anhand der Kandidatenzeiten.
- Pro Konfliktschritt testet Min-Conflicts zunächst Verschiebungen bis maximal fünf Minuten.
  Grössere Verschiebungen bleiben über aufeinanderfolgende Suchschritte erreichbar.
- Die Suche bleibt heuristisch. Nur Kandidaten ohne harte Verletzungen werden archiviert;
  die Endvalidierung prüft die aktiven harten Regeln unabhängig, bevor ein Vorschlag
  ausgegeben wird.
- Benchmarkbasis: Standalone-Demo mit 51 Knoten, 23 Zugläufen und 204 Abschnitten.
  Bei aktivem hartem Gleislimit (2 Gleise) gab es im 3.5-s-Lauf keinen gültigen Vorschlag,
  obwohl 675 Iterationen und 19'713 Kandidatenbewertungen ausgeführt wurden. Ohne die
  harte Gleisregel entstanden vier Vorschläge, aber der beste hatte weiterhin 22
  überlastete Kanten. Das belegt einen aktuellen Feasibilitätsengpass auf diesem
  Beispieldatensatz, nicht die Unlösbarkeit oder das Verhalten auf Grossnetzen.

## 9. Später / offen

- Knotengleis-/Knotenauslastungs-Constraints: nicht Teil des aktuellen Scopes; die bestehende
  Knotenauslastungs-View bleibt eine Ergebnisvisualisierung.

- **Fahrzeitänderungen** (Verlängern/Verkürzen von Abschnittsfahrzeiten): aktuell **fix**,
  Anforderung folgt später. Erweiterungspunkt in den Options vorgesehen.
- Benutzerdefinierte Obergrenze für optionale Anschluss-Wartezeiten; aktuell gilt
  `connectionTime` bis `connectionTime + 5 min`.
