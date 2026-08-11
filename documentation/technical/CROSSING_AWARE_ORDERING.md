# Crossing-aware port ordering

This document describes the **Crossing aware** port ordering algorithm. For context on ports, their alignment, and the
available ordering modes, see the [Ports sorting](DATA_MODEL.md#ports-sorting) section in DATA_MODEL.md.

## Overview

The algorithm is a greedy iterative optimizer. It first focuses on minimizing the crossings within each node, and then
looks for alternative solutions that reduce the global amount of crossings between the nodes.

It is a lightweight heuristic, not a full layout optimizer. It only reorders ports on fixed nodes with fixed positions,
and runs fast enough to be applied on every layout update. For a more comprehensive approach to transit map layout
(edge routing, station placement, global crossing minimization), see [LOOM](https://loom.cs.uni-freiburg.de/#stuttgart).

The algorithm works in three phases:

### 1. Connected components

The network is split into independent connected components (via DFS). Each component is optimized separately.

### 2. Port reordering

For each component, a BFS traversal visits every node and reorders its ports. For each pair of ports on the same side,
the first distinguishing criterion wins:

1. Opposite transition node alignment within the node (geometric preference)
2. Port position on the opposite side of the transition, if that side has already been ordered (with elbow correction
   for sides that have reversed index ordering)
3. Opposite node position (left-to-right or top-to-bottom)
4. Port position in opposite node (if already ordered by BFS)
5. Trainrun ordering score (tie-breaker, varies between iterations)

Criteria 1 and 2 are designed to eliminate node-internal crossings by sorting ports according to the clockwise rotation
of their transition nodes. This is what minimizes the number of crossings within each node.

Criteria 3 and 4 propagate constraints along the BFS to minimize crossings between nodes. Criterion 5 is a global
tie-breaker injected by the iterative optimizer (see below).

### 3. Iterative optimization

The port reordering step (phase 2) is deterministic for a given trainrun ordering. The optimizer explores different
trainrun orderings to find one that produces fewer crossings between the nodes. It runs multiple iterations (up to
`maxRuns`, default 50):

1. Start with initial trainrun ordering (from node transitions)
2. Reorder all ports using the current trainrun ordering as tie-breaker
3. Count resulting crossings
4. If crossings improved, identify largest crossing groups (contiguous sets of trainruns that cross each other), and
   generate new candidate orderings by permuting those groups
5. Pick the next candidate from the stack and repeat
6. Return the configuration with the fewest crossings

This is a heuristic. It uses DFS (stack-based candidate selection) and caps the number of new candidates per step
(`maxNewCandidates`, default 10). It does not guarantee a global optimum.

## Crossing detection

Three types of crossings are detected:

- **Direct**: Two parallel sections share the same pair of nodes, but their port order is inverted on one side.
- **Indirect**: Two sections share one node but go to different destinations, and their port order is inverted.
- **Node-internal**: Two transitions cross inside a node (detected via clockwise rotation check).

Crossings between trainrun sections that do not share any node are not detected. For instance, a section going from top
to bottom that visually crosses another one going from left to right will not be counted. Solving these crossings would
require changing edge paths or node positions, which is outside the scope of port ordering.

## Strengths and limitations

- Works best on **tree-like topologies** (linear networks, branching lines), where BFS propagation is natural.
- Handles **cycles and dense connectivity** less well: the single global trainrun ordering used as tie-breaker cannot
  express conflicting local preferences.
- **Prioritizes node-internal crossing elimination** (criteria 1-2 always win over the tie-breaker). This is an
  opinionated choice that works well for typical railway diagrams, but may not be ideal on very dense graphs.

## Source files

- [port-ordering.algo.ts](../../src/app/services/util/port-ordering.algo.ts) - Main algorithm (`optimizePorts`,
  `reorderNodePorts`)
- [port-ordering.crossings.ts](../../src/app/services/util/port-ordering.crossings.ts) - Crossing detection and
  counting
- [port-ordering.components.ts](../../src/app/services/util/port-ordering.components.ts) - Connected components
  extraction
- [port-ordering.helpers.ts](../../src/app/services/util/port-ordering.helpers.ts) - Geometry helpers (elbow detection,
  alignment)
