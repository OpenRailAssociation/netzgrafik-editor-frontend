# GTFS Import: End-to-End Algorithm and Data Mapping

## 1. Purpose and Scope

This document describes the GTFS import workflow in Netzgrafik Editor, including:

- parsing and conversion from GTFS to Netzgrafik,
- mapping of categories, frequencies, and trainrun metadata,
- post-creation topology consolidation,
- non-stop vs. stop transition semantics,
- and iterative convergence behavior.

The chapters are ordered exactly by execution flow.

## 2. External GTFS References

The implementation assumes a standard GTFS feed structure and terminology.

Recommended references:

- https://opentransportdata.swiss/de/cookbook/timetable-cookbook/gtfs/
- https://gtfs.org/documentation/schedule/reference/

## 3. Input and Import Preconditions

Expected GTFS input files:

- `stops.txt`
- `routes.txt`
- `trips.txt`
- `stop_times.txt`
- optional calendar files (`calendar.txt`, `calendar_dates.txt`)

Import options include (among others):

- topology consolidation enabled/disabled,
- allowed detour by percentage (`xx%`),
- allowed detour by absolute minutes (`yy`),
- minimum edge travel time `A` (default `1`),
- maximum consolidation iterations `n` (default `10`),
- optional round-trip merge.

## 4. Phase A: GTFS Parsing and Pattern Preparation

### 4.1 Parse Feed Data

GTFS CSV tables are parsed and normalized into in-memory structures.

### 4.2 Build Trip Patterns

Trips are grouped by route and stop sequence into pattern candidates.

### 4.3 Normalize Stop-to-Station Mapping

Platform stops are mapped to parent station IDs (if available).
If a required parent station does not exist as an explicit stop row, a virtual station node may be synthesized.

## 5. Phase B: Node, Metadata, and Trainrun Creation

### 5.1 Node Creation

All stations used by selected patterns are converted into Netzgrafik nodes.
Coordinates are transformed and centered.

### 5.2 Category Mapping

Route descriptors are mapped to `TrainrunCategory` entries.

Rules:

- try matching existing category by short name,
- then by full name,
- otherwise create a new category.

### 5.3 Frequency Mapping

GTFS frequencies are mapped to Netzgrafik frequency objects.

Important behavior:

- supported intervals are normalized to known values,
- for 120-minute operation, offset variants are mapped via key format like `120_0` and `120_60`,
- existing metadata frequencies are reused whenever possible.

### 5.4 Trainrun Creation

For each selected pattern:

- one trainrun is created,
- route/category/frequency/time-category IDs are assigned,
- naming is derived from route/headsign/trip short name,
- direction starts as `ONE_WAY`.

### 5.5 TrainrunSection Creation

For each adjacent station group pair, one trainrun section is generated.
Sections include:

- source/target node,
- symmetric minute-level times,
- travel time and backward travel time,
- stop/pass-through indicator (`numberOfStops`),
- section ownership (`trainrunId`).

## 6. Phase C: Round-Trip Detection and Merge

If enabled, opposite-direction candidates are checked and merged into `ROUND_TRIP` where valid.
After merge:

- removed trainruns and their sections are deleted,
- surviving trainrun direction is set to `ROUND_TRIP`.

Topology consolidation is executed only after this stage, i.e. on final trainruns/trainrun sections.

## 7. Phase D: Topology Consolidation (Post-Creation)

### 7.1 Activation Condition

Topology consolidation runs only if explicitly enabled.

### 7.2 Detour Criteria

An edge replacement is allowed only if the alternative path travel time satisfies at least one criterion:

$$
T_{alt} \le (1 + xx\%) \cdot T_{section}
$$

or

$$
T_{alt} \le T_{section} + yy
$$

And the alternative path must contain more than one edge.

### 7.3 Build Basis Graph $G(V,E)$

The basis graph is built from already-created trainrun sections:

- vertices $V$: all section endpoint nodes,
- edges $E$: undirected node pairs,
- edge payload: list of all attached trainrun sections (`1:m` possible),
- edge weight: minimum travel time over attached sections, constrained by $A$:

$$
w(e) = \max\left(A, \min(T_{section})\right)
$$

Default: $A = 1$.

### 7.4 Edge Ordering

All edges are sorted ascending by weight.

### 7.5 Alternative Path Search per Edge

For each edge $e = (n_1, n_2)$:

- temporarily exclude edge $e$,
- compute shortest path from $n_1$ to $n_2$ on the remaining undirected graph,
- if no path: skip,
- if one-edge path: log error (indicates duplicate parallel edge condition), skip,
- if path violates detour constraints: skip.

### 7.6 Section Replacement

If eligible:

- all trainrun sections attached to edge $e$ are replaced atomically,
- direct section $(n_1, n_2)$ becomes a chain along the alternative path,
- one new trainrun section is created per replacement path edge,
- durations are interpolated proportionally using cumulative path weights,
- each new segment respects minimum travel time $A$.

### 7.7 Transition and Stop Semantics

Target semantics:

- original GTFS-defined stops must remain stops,
- intermediate nodes inserted by consolidation are pass-through/non-stop.

Runtime enforcement strategy:

- an initial GTFS stop-node map per trainrun is persisted through import,
- after 3rd-party transition materialization, transitions are forced using that map,
- at a GTFS stop node: `isNonStopTransit = false`,
- otherwise: `isNonStopTransit = true`.

## 8. Convergence Loop

After one full edge pass, if any replacement changed the basis graph, run another pass.

Stop conditions:

- no changes in a full pass (fixed point), or
- max iteration count reached.

Default max iterations:

$$
n = 10
$$

## 9. Logical Safety Constraints

### 9.1 Trainrun-Context Node Reuse Guard

A candidate alternative path is rejected for a specific trainrun if newly inserted intermediate nodes already appear elsewhere in the same trainrun.

This prevents loops and backtracking patterns such as:

`A -> B -> C -> B -> D`.

### 9.2 Linearity Constraint

After replacement, the affected trainrun must remain a simple linear path without reusing previously visited intermediate nodes.

### 9.3 Optional Edge-Reuse Constraint

Optional stricter policy: also reject replacements that reuse an edge already used elsewhere in the same trainrun.

## 10. Output and Loading Path

### 10.1 Exported DTO

The converter outputs a Netzgrafik DTO containing:

- nodes,
- trainruns,
- trainrun sections,
- metadata,
- labels and filter data,
- additional import metadata (e.g., trainrun-to-trips and GTFS stop-node map).

### 10.2 3rd-Party Materialization

During 3rd-party loading/import, ports/transitions/connections are materialized.
After this materialization, GTFS stop-node enforcement is applied to transition non-stop flags.

## 11. Practical Validation Checklist

When validating a feed import, verify:

1. no zig-zag regressions introduced by consolidation,
2. GTFS stop nodes are stop transitions,
3. inserted consolidation corridor nodes are non-stop,
4. no trainrun-level node reuse violations,
5. convergence reached within configured max iterations.

## 12. Summary

The GTFS import pipeline first creates full trainruns/trainrun sections, then performs optional post-creation topology consolidation on an undirected basis graph with strict safety guards, iterative convergence, and stop/non-stop behavior enforcement aligned with original GTFS stop semantics.

## 13. Konsolidierung als Prosa (zusammengeführte Spezifikation)

Sobald alle Züge erstellt sind, also die Trainruns mit ihren `n` TrainrunSections, und sobald feststeht, ob ein Zug `ONE_WAY` oder `ROUND_TRIP` ist, wird in einem nachgelagerten Schritt die Topologie konsolidiert. Diese Konsolidierung läuft nur dann, wenn sie explizit aktiviert ist. Wenn sie aktiviert ist, gelten die globalen Grenzwerte für die Abbildung auf einen alternativen Pfad: Die alternative Verbindung darf entweder höchstens `(1 + xx%) * travelTime` des ersetzten Abschnitts haben oder höchstens `travelTime + yy` Minuten. Zusätzlich gilt: Eine Kante wird nur ersetzt, wenn der gefundene alternative Pfad aus mehr als einer Kante besteht.

Als Basis wird ein ungerichteter Graph aus den bereits erzeugten TrainrunSections aufgebaut. Dafür werden aus jeder TrainrunSection `sourceNode` und `targetNode` gelesen, alle vorkommenden Nodes als Knotenmenge `V` übernommen und die Verbindungen als Kantenmenge `E` angelegt. An jeder Kante wird die Liste der zugehörigen TrainrunSections gehalten, da pro Kante `1:m` Abschnitte vorkommen können. Das Kantengewicht ist die minimale Travel Time über alle zugeordneten Sections, wobei die Untergrenze `A` gilt. Damit entsteht der Basisgraph `G(V,E)`.

Die eigentliche Konsolidierung startet mit einer aufsteigenden Sortierung aller Kanten nach Gewicht. Danach wird Kante für Kante iteriert. Für eine Kante `e` zwischen `n1` und `n2` wird ein alternativer Pfad von `n1` nach `n2` gesucht, wobei `e` für diese Suche temporär ausgeschlossen wird. Dieser Pfad ist der Shortest Path ohne `e`. Wenn kein Pfad gefunden wird, passiert nichts. Wenn der Pfad die erlaubte Zeitgrenze überschreitet, passiert nichts. Wenn der Pfad nur eine Kante enthält, wird ein Fehler protokolliert, weil das auf unzulässige parallele Doppelverbindungen zwischen denselben Knoten hindeutet.

Wenn alle Kriterien erfüllt sind, werden alle TrainrunSections der Kante `e` atomar umgelegt: Die direkte Verbindung zwischen `n1` und `n2` wird durch die Kantenfolge des alternativen Pfads ersetzt. Für jede Kante entlang dieses Pfads wird eine neue TrainrunSection erzeugt. Die Fahrzeiten der neu erzeugten Sections werden proportional interpoliert, bezogen auf die kumulierte minimale Travel Time des Ersatzpfads und die ursprüngliche Travel Time der ersetzten Section. Pro Segment gilt mindestens `A` Minuten, initial `A = 1`, konfigurierbar über die Importoptionen.

Nach erfolgreicher Ersetzung wird die alte Kante aus dem Basisgraph entfernt, die neuen Sections werden den betroffenen Kantenlisten zugeordnet und die minimalen Kantengewichte neu berechnet. Ein Änderungsflag markiert, dass sich der Graph in dieser Runde verändert hat. Nach einem vollständigen Durchlauf über alle Kanten startet der nächste Durchlauf. Dieser Ablauf wird wiederholt, bis keine Änderungen mehr auftreten oder die maximale Anzahl Iterationen erreicht ist. Als Startwert gilt `n = 10` vollständige Durchläufe.

Zusätzlich gelten logische Sicherheitsregeln gegen fehlerhafte Umlegungen: Ein alternativer Pfad darf für einen konkreten Trainrun nur verwendet werden, wenn seine neu eingefügten Zwischenknoten im selben Trainrun nicht bereits an anderer Stelle vorkommen. So werden Schleifen und Rücksprünge wie `A -> B -> C -> B -> D` verhindert. Nach der Ersetzung muss der betroffene Trainrun weiterhin ein einfacher, linearer Pfad bleiben, ohne Wiederverwendung bereits besuchter Zwischenknoten. Optional kann zusätzlich verhindert werden, dass ein Ersatzpfad Kanten benutzt, die im selben Trainrun bereits an anderer Stelle verwendet werden.

Für die Transition-Semantik gilt im Zielbild: GTFS-definierte Halte bleiben Stops, konsolidierungsbedingt eingefügte Zwischenknoten sind Non-Stop-Passagen. Dabei ist die technische Bool-Logik zu beachten: `isNonStopTransit = false` bedeutet Stop, `isNonStopTransit = true` bedeutet Non-Stop. Deshalb werden nach Materialisierung der 3rd-party-Transitions die GTFS-Stopknoten pro Trainrun gezielt auf Stop erzwungen und alle übrigen Knoten des Laufwegs als Non-Stop markiert.
