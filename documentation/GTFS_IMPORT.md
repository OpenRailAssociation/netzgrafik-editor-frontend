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

## 13. Consolidation as Prose (Merged Specification)

Once all trains have been created, meaning trainruns with their `n` trainrun sections, and once it is known whether a train is `ONE_WAY` or `ROUND_TRIP`, topology consolidation is executed as a follow-up step. This consolidation runs only when explicitly enabled. If enabled, the global detour limits are applied for alternative-path mapping: the alternative connection may be at most `(1 + xx%) * travelTime` of the replaced section, or at most `travelTime + yy` minutes. In addition, an edge is replaced only if the found alternative path contains more than one edge.

The basis is an undirected graph built from already-created trainrun sections. For each trainrun section, `sourceNode` and `targetNode` are read; all appearing nodes form vertex set `V`, and all connections form edge set `E`. Each edge stores the list of attached trainrun sections, since `1:m` sections can belong to one edge. Edge weight is the minimum travel time over attached sections, constrained by lower bound `A`. This defines the basis graph `G(V,E)`.

Consolidation starts by sorting all edges ascending by weight. Then edges are processed one by one. For an edge `e` between `n1` and `n2`, an alternative path from `n1` to `n2` is searched while temporarily excluding `e`. This is the shortest path without `e`. If no path is found, nothing happens. If path travel time exceeds the allowed threshold, nothing happens. If the path has only one edge, an error is logged, because that indicates an invalid parallel duplicate connection between the same node pair.

If all criteria are met, all trainrun sections attached to edge `e` are replaced atomically: the direct connection between `n1` and `n2` is replaced by the alternative edge chain. One new trainrun section is created per path edge. Travel times of these new sections are interpolated proportionally based on cumulative minimum path travel time and the original section travel time. Each segment must be at least `A` minutes, with default `A = 1`, configurable via import options.

After successful replacement, the old edge is removed from the basis graph, new sections are attached to affected edge lists, and minimum edge weights are recomputed. A change flag marks that the graph changed in this round. After one full pass over all edges, the next pass starts. This repeats until no further changes occur or maximum iterations are reached. The default starting value is `n = 10` full passes.

Additional safety rules prevent invalid remappings: an alternative path may be used for a specific trainrun only if its newly inserted intermediate nodes do not already appear elsewhere in the same trainrun. This prevents loops and backtracking such as `A -> B -> C -> B -> D`. After replacement, the affected trainrun must still be a simple linear path without reusing already visited intermediate nodes. Optionally, replacements can also be forbidden when they reuse edges already used elsewhere in the same trainrun.

For transition semantics, the target behavior is: GTFS-defined stops stay stop transitions, while consolidation-inserted intermediate nodes are non-stop passages. Note the boolean semantics: `isNonStopTransit = false` means stop, and `isNonStopTransit = true` means non-stop. Therefore, after 3rd-party transition materialization, GTFS stop nodes are explicitly enforced as stop per trainrun, and all other nodes on the route are marked non-stop.
