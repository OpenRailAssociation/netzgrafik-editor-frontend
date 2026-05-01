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

All GTFS stops that appear in at least one accepted trip pattern are collected into a working set. Only station-level nodes are created — platform rows (`location_type != 1`, with a `parent_station` reference) are collapsed to their parent station. If a `parent_station` ID is referenced by one or more platform rows but has no own row in `stops.txt`, a virtual station record is synthesised from the first child platform: the station name is taken from the child's `stop_name` with any platform suffix (`Gleis`, `Track`, `Platform`, `Quai`) stripped off, and coordinates are copied directly.

Coordinates are converted from WGS 84 latitude/longitude to a flat 2-D canvas using a fixed Swiss centre reference point (46.8° N / 8.2° E) and a scale factor, so that the resulting values approximate a geographically plausible map layout. After conversion, all node positions are translated so that their centroid lies at the canvas origin (0, 0).

Every node is assigned a stable integer ID based on its index in the ordered station list. The resulting ID-to-station map is used by all subsequent steps to translate GTFS stop IDs — including platform IDs — into Netzgrafik node IDs.

### 5.2 Category Mapping

All unique route descriptions present in the selected patterns are resolved against `TrainrunCategory` entries. The resolution follows a strict priority order:

1. Match by **short name** (first 10 characters of the route description, case-insensitive). If an existing category with that short name exists, it is reused.
2. Match by **full name** (the complete route description string, case-insensitive). If an existing category with that name exists, it is reused.
3. If neither lookup succeeds, a **new category** is created with a generated ID in the format `2026_000i` (where `i` is an incrementing counter starting after the highest existing category ID). The new entry receives the full description as its name, the first 10 characters as its short name, a colour reference derived from known keyword patterns (e.g., `IC` → `EC`, `IR` → `IR`, `S`/`S-Bahn` → `S`), and standard default values for headway and turnaround times.

The resulting category is recorded in a lookup map keyed by route description; the same map is used when creating trainruns in step 5.4.

### 5.3 Frequency Mapping

The cycle time (headway) of each route pattern is mapped to a Netzgrafik `TrainrunFrequency` entry. If no custom metadata frequencies are provided, the default frequencies from `NetzgrafikDefault` are used as the starting pool.

Supported cycle times are `15`, `20`, `30`, `60`, and `120` minutes. Any value outside this set is normalised to `60` minutes with a warning. For the 120-minute interval, two variants exist to distinguish even-hour departures from odd-hour departures. They are keyed by strings `120_0` (offset 0 min, i.e., departures at :00 and :02 etc.) and `120_60` (offset 60 min, i.e., departures at :01, :03 etc.). All other intervals use a plain numeric key (e.g., `60`, `30`).

For each unique frequency key encountered across routes, the code looks up a matching entry in the frequency pool. If a match exists, the existing entry's ID is recorded and reused — no duplicate frequency object is created. If no match is found (which should not occur with a complete default set), the first available frequency is used as a fallback and a warning is logged.

The resulting frequency key-to-ID map is consumed by trainrun creation in step 5.4.

### 5.4 Trainrun Creation

For each accepted trip pattern, exactly one `TrainrunDto` is created. The trainrun receives:

- **category ID** resolved from the route description via the category map from step 5.2,
- **frequency ID** resolved via the frequency map from step 5.3,
- **time-category ID** taken from the first entry of the time-category pool (default or provided),
- **direction** initially set to `ONE_WAY`; this may be changed to `ROUND_TRIP` in phase C,
- **name** built from: (a) the `route_short_name` with its category prefix removed to avoid duplication (e.g., `IR15` used under category `IR` becomes `15`), followed by (b) ` → <headsign>` if a headsign is present, or a direction arrow suffix otherwise, and optionally (c) `(<trip_short_name>)` if a trip short name is present,
- **debug label** (if a `labelCreator` callback is provided) formatted as `<routeName> → <firstStopName> → <lastStopName>` to allow later filtering and tracing.

Additionally, the trainrun's ID is stored in a `trainrunToTrips` map together with all GTFS trip IDs that belong to this pattern. A parallel `initialStopNodeIdsByTrainrun` map records — for each trainrun — the set of node IDs that correspond to genuine GTFS stop events (boarding or alighting allowed), as opposed to pass-through events. Both maps are exported as additional properties on the output DTO and are later used for transition semantics enforcement.

### 5.5 TrainrunSection Creation

Before sections are created, the ordered list of GTFS stop-times for the representative trip is grouped into **station groups**. Multiple consecutive platform rows that resolve to the same parent station ID are merged into one group. Within a group, the earliest arrival time is kept as the group arrival and the latest departure is kept as the group departure. A group is classified as a **stop** (`isStop = true`) if at least one of its constituent rows has `pickup_type != 1` or `drop_off_type != 1` (i.e., passengers may board or alight). If all rows have both types set to `1`, the group is a **pass-through** (`isStop = false`).

For each pair of consecutive station groups in the ordered sequence, one `TrainrunSectionDto` is created. The following values are computed and stored:

- **Travel time**: the difference in minutes between the source group's departure time and the target group's arrival time, with a lower bound of 1 minute.
- **Symmetric minute times**: the forward direction uses the raw GTFS minute-within-the-hour values for source departure and target arrival. The return direction times are derived by the 60-x symmetry rule: `sourceArrival = (60 − sourceDeparture) mod 60` and `targetDeparture = (60 − targetArrival) mod 60`.
- **`numberOfStops`**: set to `0` if both the source and target groups are stops; set to `1` if either group is a pass-through, indicating that the section contains a non-stopping intermediate behaviour.
- **`trainrunId`**: the ID of the owning trainrun.

A section is skipped if the target node has already been visited in the current trainrun (to prevent loops) or if the edge between source and target has already been used in the same trainrun. This ensures that every trainrun represents a simple, non-repeating path.

## 6. Phase C: Round-Trip Detection and Merge

After all one-way trainruns and their sections are created, the algorithm attempts to pair up opposite-direction counterparts and merge them into `ROUND_TRIP` trainruns. This step is optional and can be disabled via the `mergeRoundTrips` option.

### 6.1 Grouping and Candidate Selection

All created trainruns are iterated in order. For each unmatched trainrun `T1`, every subsequent unmatched trainrun `T2` is tested as a candidate pair. A pair is accepted only if all of the following criteria are satisfied simultaneously:

1. **Same line identifier**: `route_short_name` (or `route_long_name` as fallback) must match, case-insensitively.
2. **Same category**: `route_desc` (or `route_short_name`) must match exactly.
3. **Same frequency**: the resolved cycle time of both routes must be equal.
4. **Reversed stop sequence**: the station sequence of `T2` must be the exact reverse of `T1`'s sequence. Any deviation — including a difference in length — disqualifies the pair.
5. **Time symmetry**: for each corresponding section pair (section `i` of `T1` vs. reversed section `i` of `T2`), the minute-within-the-hour departure of `T1`'s source must match the arrival of `T2`'s target under the 60-x rule, within a configurable tolerance (default: 180 seconds = 3 minutes).

If any criterion fails, the pair is rejected and the next candidate is tested. The failure reason is recorded per trainrun for diagnostic purposes.

### 6.2 Data to Discard

When a valid pair `(T1, T2)` is found, one of the two trainruns is removed from the dataset. The algorithm determines the **preferred direction** based on geographic orientation of the first section: the trainrun whose first section points more towards east (positive Δx) and south (positive Δy) scores higher; the higher-scoring trainrun is kept. If both score equally, `T1` is kept.

The **removed trainrun** and **all its associated trainrun sections** are deleted from the working lists. Labels from the removed trainrun are appended to the surviving trainrun's label list so that no routing metadata is lost.

The surviving trainrun's `direction` field is set to `ROUND_TRIP`, and its sections remain unchanged — they now represent both directions symmetrically by construction (due to the 60-x rule applied in step 5.5).

### 6.3 Frequency Derivation from Trip Patterns

Frequency assignment takes place during route-level processing in phase A and is inherited through phases B and C without modification. The cycle time for each route is derived from the GTFS feed's `frequencies.txt` or inferred from the regular departure spacing of trips. Supported values (15, 20, 30, 60, 120 min) are mapped to Netzgrafik frequency entries in step 5.3. When a round-trip merge occurs, both paired patterns must share the same frequency — this is enforced as criterion 3 above. The merged `ROUND_TRIP` trainrun therefore retains the exact frequency of the surviving one-way pattern without recomputation.

Topology consolidation is executed only after this phase completes, i.e., on the final set of trainruns and trainrun sections with their definitive `ONE_WAY` or `ROUND_TRIP` direction flags.

## 7. Phase D: Topology Consolidation (Post-Creation) 

Once all trains have been created, meaning trainruns with their `n` trainrun sections, and once it is known whether a train is `ONE_WAY` or `ROUND_TRIP`, topology consolidation is executed as a follow-up step. This consolidation runs only when explicitly enabled. If enabled, the global detour limits are applied for alternative-path mapping: the alternative connection may be at most `(1 + xx%) * travelTime` of the replaced section, or at most `travelTime + yy` minutes. In addition, an edge is replaced only if the found alternative path contains more than one edge.

The basis is an undirected graph built from already-created trainrun sections. For each trainrun section, `sourceNode` and `targetNode` are read; all appearing nodes form vertex set `V`, and all connections form edge set `E`. Each edge stores the list of attached trainrun sections, since `1:m` sections can belong to one edge. Edge weight is the minimum travel time over attached sections, constrained by lower bound `A`. This defines the basis graph `G(V,E)`.

Consolidation starts by sorting all edges ascending by weight. Then edges are processed one by one. For an edge `e` between `n1` and `n2`, an alternative path from `n1` to `n2` is searched while temporarily excluding `e`. This is the shortest path without `e`. If no path is found, nothing happens. If path travel time exceeds the allowed threshold, nothing happens. If the path has only one edge, an error is logged, because that indicates an invalid parallel duplicate connection between the same node pair.

If all criteria are met, all trainrun sections attached to edge `e` are replaced atomically: the direct connection between `n1` and `n2` is replaced by the alternative edge chain. One new trainrun section is created per path edge. Travel times of these new sections are interpolated proportionally based on cumulative minimum path travel time and the original section travel time. Each segment must be at least `A` minutes, with default `A = 1`, configurable via import options.

After successful replacement, the old edge is removed from the basis graph, new sections are attached to affected edge lists, and minimum edge weights are recomputed. A change flag marks that the graph changed in this round. After one full pass over all edges, the next pass starts. This repeats until no further changes occur or maximum iterations are reached. The default starting value is `n = 10` full passes.

Additional safety rules prevent invalid remappings: an alternative path may be used for a specific trainrun only if its newly inserted intermediate nodes do not already appear elsewhere in the same trainrun. This prevents loops and backtracking such as `A -> B -> C -> B -> D`. After replacement, the affected trainrun must still be a simple linear path without reusing already visited intermediate nodes. Optionally, replacements can also be forbidden when they reuse edges already used elsewhere in the same trainrun.

For transition semantics, the target behavior is: GTFS-defined stops stay stop transitions, while consolidation-inserted intermediate nodes are non-stop passages. Note the boolean semantics: `isNonStopTransit = false` means stop, and `isNonStopTransit = true` means non-stop. Therefore, after 3rd-party transition materialization, GTFS stop nodes are explicitly enforced as stop per trainrun, and all other nodes on the route are marked non-stop.

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

