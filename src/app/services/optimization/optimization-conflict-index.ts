import {OptimizationProblem} from "./optimize-timetable.chains";
import {TimetableEvaluator} from "./optimize-timetable.evaluator";

export type OptimizationConflictType =
  | "TRACK_OVERLOAD"
  | "USER_CONNECTION"
  | "MINIMUM_STOP_TIME"
  | "MAX_TRAVEL_TIME_EXTENSION";

export interface OptimizationConflict {
  id: string;
  type: OptimizationConflictType;
  severity: number;
  affectedVariables: number[];
  affectedChains: number[];
  affectedNodes: number[];
  affectedEdges: string[];
  componentIndex: number;
}

function edgeKey(fromNodeId: number, toNodeId: number): string {
  return fromNodeId < toNodeId ? `${fromNodeId}-${toNodeId}` : `${toNodeId}-${fromNodeId}`;
}

export class ConflictIndex {
  readonly conflicts: OptimizationConflict[] = [];
  readonly byChain = new Map<number, OptimizationConflict[]>();
  readonly byEdge = new Map<string, OptimizationConflict[]>();
  readonly byNode = new Map<number, OptimizationConflict[]>();

  private readonly byVariable: number[][];
  private readonly trackConflicts: OptimizationConflict[] = [];
  private readonly heap: number[] = [];
  private readonly heapPosition: Int32Array;
  private readonly edgeVariables = new Map<string, number[]>();
  private readonly nodeVariables = new Map<number, number[]>();
  private readonly clusterMarks: Uint32Array;
  private readonly enabledConstraints: Set<string>;
  private readonly cluster: number[] = [];
  private clusterEpoch = 0;

  constructor(
    private readonly problem: OptimizationProblem,
    private readonly evaluator: TimetableEvaluator,
  ) {
    this.enabledConstraints = new Set(
      problem.policy.hardConstraints
        .filter((constraint) => constraint.enabled)
        .map((constraint) => constraint.id),
    );
    this.byVariable = Array.from({length: problem.variables.length}, () => [] as number[]);
    this.heapPosition = new Int32Array(0);
    this.clusterMarks = new Uint32Array(problem.variables.length);

    problem.edges.forEach((edge, edgeIndex) => {
      const key = edgeKey(edge.fromNode.getId(), edge.toNode.getId());
      this.edgeVariables.set(key, problem.edgeVars[edgeIndex]);
      this.addConflict(
        "TRACK_OVERLOAD",
        edgeIndex,
        problem.edgeVars[edgeIndex],
        [edge.fromNode.getId(), edge.toNode.getId()],
        [key],
      );
    });

    const connectionVariables = this.invert(problem.connections.length, problem.varConnections);
    problem.connections.forEach((connection, index) => {
      const edgeIds = [connection.arrSection, connection.depSection]
        .map((sectionIndex) => problem.sectionEdge[sectionIndex])
        .filter((edgeIndex) => edgeIndex >= 0)
        .map((edgeIndex) => {
          const edge = problem.edges[edgeIndex];
          return edgeKey(edge.fromNode.getId(), edge.toNode.getId());
        });
      this.addConflict(
        "USER_CONNECTION",
        index,
        connectionVariables[index],
        [connection.node.getId()],
        edgeIds,
      );
    });

    const stopVariables = this.invert(problem.stops.length, problem.varStops);
    problem.stops.forEach((stop, index) => {
      const edgeIds = [stop.arrSection, stop.depSection]
        .map((sectionIndex) => problem.sectionEdge[sectionIndex])
        .filter((edgeIndex) => edgeIndex >= 0)
        .map((edgeIndex) => {
          const edge = problem.edges[edgeIndex];
          return edgeKey(edge.fromNode.getId(), edge.toNode.getId());
        });
      this.addConflict(
        "MINIMUM_STOP_TIME",
        index,
        stopVariables[index],
        [stop.node.getId()],
        edgeIds,
      );
    });

    if (this.isEnabled("maxTravelTimeExtension")) {
      const variablesByTrainrun = Array.from(
        {length: problem.trainrunIds.length},
        () => [] as number[],
      );
      const nodesByTrainrun = Array.from(
        {length: problem.trainrunIds.length},
        () => new Set<number>(),
      );
      const trainrunIndexById = new Map(problem.trainrunIds.map((id, index) => [id, index]));
      problem.variables.forEach((variable, variableIndex) => {
        if (variable.fixed || variable.domain === 0) {
          return;
        }
        variable.chains.forEach((chainIndex) => {
          const chain = problem.chains[chainIndex];
          const trainrunIndex = trainrunIndexById.get(chain.trainrun.getId());
          if (trainrunIndex === undefined) {
            return;
          }
          variablesByTrainrun[trainrunIndex].push(variableIndex);
          chain.steps.forEach((step) => {
            nodesByTrainrun[trainrunIndex].add(step.fromNode.getId());
            nodesByTrainrun[trainrunIndex].add(step.toNode.getId());
          });
        });
      });
      problem.trainrunIds.forEach((_, trainrunIndex) =>
        this.addConflict(
          "MAX_TRAVEL_TIME_EXTENSION",
          trainrunIndex,
          variablesByTrainrun[trainrunIndex],
          [...nodesByTrainrun[trainrunIndex]],
          [],
        ),
      );
    }

    problem.varNodeEvents.forEach((eventIndices, variableIndex) => {
      eventIndices.forEach((eventIndex) => {
        const nodeId = problem.nodeEvents[eventIndex].node.getId();
        const variables = this.nodeVariables.get(nodeId) ?? [];
        variables.push(variableIndex);
        this.nodeVariables.set(nodeId, variables);
      });
    });

    this.heapPosition = new Int32Array(this.conflicts.length).fill(-1);
    this.refreshAll();
  }

  getHighestPriority(): OptimizationConflict | undefined {
    return this.heap.length === 0 ? undefined : this.conflicts[this.heap[0]];
  }

  getTrackConflict(edgeIndex: number): OptimizationConflict | undefined {
    return this.trackConflicts[edgeIndex];
  }

  updateVariable(variableIndex: number): void {
    this.byVariable[variableIndex].forEach((conflictIndex) => this.refresh(conflictIndex));
  }

  buildCluster(conflict: OptimizationConflict, maximumSize: number): number[] {
    this.cluster.length = 0;
    this.clusterEpoch++;
    if (this.clusterEpoch === 0xffffffff) {
      this.clusterMarks.fill(0);
      this.clusterEpoch = 1;
    }

    const add = (variableIndex: number) => {
      if (
        this.cluster.length < maximumSize &&
        this.clusterMarks[variableIndex] !== this.clusterEpoch &&
        !this.problem.variables[variableIndex].fixed
      ) {
        this.clusterMarks[variableIndex] = this.clusterEpoch;
        this.cluster.push(variableIndex);
      }
    };

    conflict.affectedVariables.forEach(add);
    conflict.affectedEdges.forEach((key) => this.edgeVariables.get(key)?.forEach(add));
    conflict.affectedNodes.forEach((nodeId) => this.nodeVariables.get(nodeId)?.forEach(add));
    return this.cluster;
  }

  private addConflict(
    type: OptimizationConflictType,
    componentIndex: number,
    affectedVariables: number[],
    affectedNodes: number[],
    affectedEdges: string[],
  ): void {
    const variables = [...new Set(affectedVariables)];
    const chains = new Set<number>();
    variables.forEach((variableIndex) =>
      this.problem.variables[variableIndex].chains.forEach((chainIndex) => chains.add(chainIndex)),
    );
    const conflictIndex = this.conflicts.length;
    const conflict: OptimizationConflict = {
      id: `${type}:${componentIndex}`,
      type,
      severity: 0,
      affectedVariables: variables,
      affectedChains: [...chains],
      affectedNodes: [...new Set(affectedNodes)],
      affectedEdges: [...new Set(affectedEdges)],
      componentIndex,
    };
    this.conflicts.push(conflict);
    if (type === "TRACK_OVERLOAD") {
      this.trackConflicts[componentIndex] = conflict;
    }
    variables.forEach((variableIndex) => this.byVariable[variableIndex].push(conflictIndex));
    conflict.affectedChains.forEach((chainIndex) =>
      this.addLookup(this.byChain, chainIndex, conflict),
    );
    conflict.affectedNodes.forEach((nodeId) => this.addLookup(this.byNode, nodeId, conflict));
    conflict.affectedEdges.forEach((key) => this.addLookup(this.byEdge, key, conflict));
  }

  private addLookup<K>(
    lookup: Map<K, OptimizationConflict[]>,
    key: K,
    conflict: OptimizationConflict,
  ) {
    const conflicts = lookup.get(key) ?? [];
    conflicts.push(conflict);
    lookup.set(key, conflicts);
  }

  private invert(size: number, variableComponents: number[][]): number[][] {
    const componentVariables = Array.from({length: size}, () => [] as number[]);
    variableComponents.forEach((components, variableIndex) =>
      components.forEach((componentIndex) =>
        componentVariables[componentIndex].push(variableIndex),
      ),
    );
    return componentVariables;
  }

  private refreshAll(): void {
    this.conflicts.forEach((_, index) => this.refresh(index));
  }

  private refresh(index: number): void {
    const conflict = this.conflicts[index];
    let severity = 0;
    switch (conflict.type) {
      case "TRACK_OVERLOAD": {
        const overload =
          this.isEnabled("trackLimit") && this.problem.edgeInScope[conflict.componentIndex] === 1
            ? this.evaluator.getTrackOverload(conflict.componentIndex)
            : 0;
        severity = overload > 0 ? overload * 1000 + conflict.affectedVariables.length : 0;
        break;
      }
      case "USER_CONNECTION":
        severity =
          (this.isEnabled("userConnections") || this.isEnabled("preserveConnectionTimes")) &&
          this.evaluator.isConnectionViolated(conflict.componentIndex)
            ? 500 + conflict.affectedVariables.length
            : 0;
        break;
      case "MINIMUM_STOP_TIME":
        severity =
          this.isEnabled("minimumStopTime") &&
          this.evaluator.isStopViolated(conflict.componentIndex)
            ? 250 + conflict.affectedVariables.length
            : 0;
        break;
      case "MAX_TRAVEL_TIME_EXTENSION":
        severity = this.evaluator.isTravelTimeExtensionViolated(conflict.componentIndex)
          ? 750 + conflict.affectedVariables.length
          : 0;
        break;
    }
    conflict.severity = severity;
    this.updateHeap(index, severity > 0);
  }

  private isEnabled(id: string): boolean {
    return this.enabledConstraints.has(id);
  }

  private updateHeap(index: number, active: boolean): void {
    const position = this.heapPosition[index];
    if (!active) {
      if (position >= 0) {
        this.removeAt(position);
      }
      return;
    }
    if (position < 0) {
      this.heapPosition[index] = this.heap.length;
      this.heap.push(index);
      this.siftUp(this.heap.length - 1);
      return;
    }
    this.siftUp(position);
    this.siftDown(this.heapPosition[index]);
  }

  private removeAt(position: number): void {
    const removed = this.heap[position];
    const last = this.heap.pop();
    this.heapPosition[removed] = -1;
    if (position >= this.heap.length || last === undefined) {
      return;
    }
    this.heap[position] = last;
    this.heapPosition[last] = position;
    this.siftUp(position);
    this.siftDown(this.heapPosition[last]);
  }

  private siftUp(position: number): void {
    while (position > 0) {
      const parent = Math.floor((position - 1) / 2);
      if (!this.higherPriority(this.heap[position], this.heap[parent])) {
        return;
      }
      this.swap(position, parent);
      position = parent;
    }
  }

  private siftDown(position: number): void {
    while (true) {
      const left = position * 2 + 1;
      const right = left + 1;
      let highest = position;
      if (left < this.heap.length && this.higherPriority(this.heap[left], this.heap[highest])) {
        highest = left;
      }
      if (right < this.heap.length && this.higherPriority(this.heap[right], this.heap[highest])) {
        highest = right;
      }
      if (highest === position) {
        return;
      }
      this.swap(position, highest);
      position = highest;
    }
  }

  private higherPriority(first: number, second: number): boolean {
    const firstConflict = this.conflicts[first];
    const secondConflict = this.conflicts[second];
    return (
      firstConflict.severity > secondConflict.severity ||
      (firstConflict.severity === secondConflict.severity && first < second)
    );
  }

  private swap(first: number, second: number): void {
    const firstIndex = this.heap[first];
    const secondIndex = this.heap[second];
    this.heap[first] = secondIndex;
    this.heap[second] = firstIndex;
    this.heapPosition[firstIndex] = second;
    this.heapPosition[secondIndex] = first;
  }
}
