import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Trainrun} from "../../models/trainrun.model";
import {Direction} from "../../data-structures/business.data.structures";
import {TrainrunsectionHelper} from "../util/trainrunsection.helper";
import {SRC_ARR, SRC_DEP, TGT_ARR, TGT_DEP} from "./optimize-timetable.model";
import {
  createDefaultOptimizationPolicy,
  HardConstraintId,
  OptimizationPolicy,
} from "./optimization-policy.model";

/** One section in travel order of its trainrun path (direction "A"). */
export interface PathStep {
  sectionIdx: number;
  fromNode: Node;
  toNode: Node;
  /** true if section source === fromNode */
  aligned: boolean;
}

/** Sequence of sections between two stops (non-stop passes are inside). */
export interface Chain {
  key: string;
  trainrun: Trainrun;
  steps: PathStep[];
  varA: number;
  varB: number;
  /** B shift = signB * value(varB) */
  signB: number;
  /** B times are the mirror of the A times (symmetric sections). */
  mirrorB: boolean;
  fixed: boolean;
}

export interface Variable {
  key: string;
  domain: number;
  chains: number[];
  fixed: boolean;
}

export interface Edge {
  fromNode: Node;
  toNode: Node;
  sections: number[];
  headways: number[];
  maxFrequency: number;
}

/** Dwell at a stop between two chains of the same trainrun (one direction). */
export interface StopConstraint {
  node: Node;
  trainrunIndex: number;
  arrSection: number;
  arrField: number;
  depSection: number;
  depField: number;
  dwell0: number;
  minDwell: number;
}

/** User connection (Connection object) at a node, one direction. */
export interface ConnectionConstraint {
  node: Node;
  arrSection: number;
  arrField: number;
  depSection: number;
  depField: number;
  wait0: number;
  lo: number;
  hi: number;
}

/** Arrival or departure event at a stop node used for optional connections. */
export interface NodeEvent {
  section: number;
  field: number;
  trainrunId: number;
  frequency: number;
}

export interface NodeEvents {
  node: Node;
  connectionTime: number;
  arrivals: NodeEvent[];
  departures: NodeEvent[];
}

export interface OptimizationProblem {
  sections: TrainrunSection[];
  trainrunIds: number[];
  /** Original consecutive times: 4 per section */
  origC: Float64Array;
  /** Original display times (0..60): 4 per section */
  origT: Float64Array;
  /** Field is a relevant (active) direction of the trainrun */
  active: Uint8Array;
  chains: Chain[];
  variables: Variable[];
  edges: Edge[];
  edgeInScope: Uint8Array;
  stops: StopConstraint[];
  connections: ConnectionConstraint[];
  nodeEvents: NodeEvents[];
  sectionChain: Int32Array;
  sectionEdge: Int32Array;
  /** per variable: affected component indices */
  varEdges: number[][];
  varStops: number[][];
  varTrainruns: number[][];
  varConnections: number[][];
  varNodeEvents: number[][];
  /** per edge: free variables touching it */
  edgeVars: number[][];
  maxTracks: number;
  optionalWindow: number;
  policy: OptimizationPolicy;
}

function constraintEnabled(policy: OptimizationPolicy, id: HardConstraintId): boolean {
  return policy.hardConstraints.find((constraint) => constraint.id === id)?.enabled ?? false;
}

export function mod60(t: number): number {
  return ((t % 60) + 60) % 60;
}

export function norm60(t: number): number {
  return ((((t + 30) % 60) + 60) % 60) - 30;
}

export function arrivalFieldAt(section: TrainrunSection, node: Node): number {
  return section.getTargetNodeId() === node.getId() ? TGT_ARR : SRC_ARR;
}

export function departureFieldAt(section: TrainrunSection, node: Node): number {
  return section.getSourceNodeId() === node.getId() ? SRC_DEP : TGT_DEP;
}

function gcd(a: number, b: number): number {
  a = Math.round(Math.abs(a));
  b = Math.round(Math.abs(b));
  while (b > 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export function eventPeriod(f1: number, f2: number): number {
  const g = gcd(Math.min(f1 || 60, 60), Math.min(f2 || 60, 60));
  return g > 0 ? g : 60;
}

function otherNode(section: TrainrunSection, node: Node): Node {
  return section.getSourceNodeId() === node.getId()
    ? section.getTargetNode()
    : section.getSourceNode();
}

function isStopAt(node: Node, section: TrainrunSection): boolean {
  return node.isEndNode(section) || !node.isNonStop(section);
}

function minDwellAt(node: Node, trainrun: Trainrun): number {
  const fach = trainrun.getTrainrunCategory()?.fachCategory;
  const haltezeiten = node.getTrainrunCategoryHaltezeit() as unknown as Record<
    string,
    {haltezeit: number} | undefined
  >;
  const value = fach !== undefined ? haltezeiten?.[fach]?.haltezeit : undefined;
  return typeof value === "number" && value > 0 ? value : 0;
}

/** Builds ordered paths (one per trainrun part). Cyclic parts are returned in `cyclic`. */
function buildPaths(
  sections: TrainrunSection[],
  indexOf: Map<number, number>,
): {paths: PathStep[][]; cyclic: number[]} {
  const visited = new Set<number>();
  const paths: PathStep[][] = [];
  const cyclic: number[] = [];

  for (const start of sections) {
    if (visited.has(start.getId())) {
      continue;
    }
    let current = start;
    let node = start.getSourceNode();
    const seen = new Set<number>([current.getId()]);
    let isCyclic = false;
    while (!node.isEndNode(current)) {
      const previous = node.getNextTrainrunSection(current);
      if (previous === undefined || !indexOf.has(previous.getId())) {
        break;
      }
      if (seen.has(previous.getId())) {
        isCyclic = true;
        break;
      }
      seen.add(previous.getId());
      node = otherNode(previous, node);
      current = previous;
    }
    if (isCyclic) {
      seen.forEach((id) => {
        visited.add(id);
        cyclic.push(indexOf.get(id));
      });
      continue;
    }

    const path: PathStep[] = [];
    let from = node;
    let section = current;
    while (section !== undefined && !visited.has(section.getId())) {
      visited.add(section.getId());
      const to = otherNode(section, from);
      path.push({
        sectionIdx: indexOf.get(section.getId()),
        fromNode: from,
        toNode: to,
        aligned: section.getSourceNodeId() === from.getId(),
      });
      if (to.isEndNode(section)) {
        break;
      }
      const next = to.getNextTrainrunSection(section);
      if (next === undefined || !indexOf.has(next.getId())) {
        break;
      }
      from = to;
      section = next;
    }
    paths.push(path);
  }
  return {paths, cyclic};
}

function isChainMirror(
  steps: PathStep[],
  sections: TrainrunSection[],
  origT: Float64Array,
): boolean {
  const sym = TrainrunsectionHelper.getSymmetricTime;
  const close = (a: number, b: number) => Math.abs(norm60(a - b)) < 0.001;
  return steps.every((step) => {
    const s = sections[step.sectionIdx];
    const i = step.sectionIdx * 4;
    return (
      s.isSymmetric() &&
      close(origT[i + SRC_ARR], sym(origT[i + SRC_DEP])) &&
      close(origT[i + TGT_ARR], sym(origT[i + TGT_DEP]))
    );
  });
}

function isChainLinked(steps: PathStep[], sections: TrainrunSection[]): boolean {
  return steps.some((step) => {
    const s = sections[step.sectionIdx];
    return s.getSourceSymmetry() || s.getTargetSymmetry();
  });
}

function hasLock(section: TrainrunSection): boolean {
  return (
    section.getSourceDepartureLock() ||
    section.getSourceArrivalLock() ||
    section.getTargetDepartureLock() ||
    section.getTargetArrivalLock()
  );
}

export function buildProblem(
  nodes: Node[],
  trainrunSections: TrainrunSection[],
  maxTracks: number,
  selectedNodeIds: number[],
  connectionTolerance: number,
  optionalWindow: number,
  policy: OptimizationPolicy = createDefaultOptimizationPolicy(),
): OptimizationProblem {
  const sections = trainrunSections.filter(
    (s) => s.getSourceNode() !== undefined && s.getTargetNode() !== undefined,
  );
  const n = sections.length;
  const indexOf = new Map<number, number>();
  sections.forEach((s, i) => indexOf.set(s.getId(), i));

  const origC = new Float64Array(n * 4);
  const origT = new Float64Array(n * 4);
  const active = new Uint8Array(n * 4);
  sections.forEach((s, i) => {
    origC[i * 4 + SRC_DEP] = s.getSourceDepartureConsecutiveTime();
    origC[i * 4 + SRC_ARR] = s.getSourceArrivalConsecutiveTime();
    origC[i * 4 + TGT_DEP] = s.getTargetDepartureConsecutiveTime();
    origC[i * 4 + TGT_ARR] = s.getTargetArrivalConsecutiveTime();
    origT[i * 4 + SRC_DEP] = s.getSourceDeparture();
    origT[i * 4 + SRC_ARR] = s.getSourceArrival();
    origT[i * 4 + TGT_DEP] = s.getTargetDeparture();
    origT[i * 4 + TGT_ARR] = s.getTargetArrival();
    const oneWay = s.getTrainrun().getDirection() === Direction.ONE_WAY;
    active[i * 4 + SRC_DEP] = 1;
    active[i * 4 + TGT_ARR] = 1;
    active[i * 4 + SRC_ARR] = oneWay ? 0 : 1;
    active[i * 4 + TGT_DEP] = oneWay ? 0 : 1;
  });

  const selection = new Set<number>(selectedNodeIds ?? []);
  const inScope = (node: Node) => selection.size === 0 || selection.has(node.getId());

  // --- chains & variables ------------------------------------------------
  const byTrainrun = new Map<number, TrainrunSection[]>();
  sections.forEach((s) => {
    const list = byTrainrun.get(s.getTrainrunId()) ?? [];
    list.push(s);
    byTrainrun.set(s.getTrainrunId(), list);
  });
  const trainrunIds = [...byTrainrun.keys()];
  const trainrunIndexById = new Map(trainrunIds.map((id, index) => [id, index]));

  const chains: Chain[] = [];
  const variables: Variable[] = [];
  const sectionChain = new Int32Array(n).fill(-1);
  const stops: StopConstraint[] = [];

  const newVariable = (key: string, domain: number, fixed: boolean): number => {
    variables.push({key, domain: fixed ? 0 : domain, chains: [], fixed});
    return variables.length - 1;
  };

  byTrainrun.forEach((trainrunSectionList) => {
    const {paths} = buildPaths(trainrunSectionList, indexOf);
    const trainrun = trainrunSectionList[0].getTrainrun();
    const frequency = trainrun.getFrequency() > 0 ? trainrun.getFrequency() : 60;
    const domain = Math.floor(Math.min(frequency, 60) / 2);

    paths.forEach((path) => {
      // split path into chains at stop nodes
      const pathChains: number[] = [];
      let current: PathStep[] = [];
      path.forEach((step, k) => {
        current.push(step);
        const isLast = k === path.length - 1;
        if (isLast || isStopAt(step.toNode, sections[step.sectionIdx])) {
          const steps = current;
          current = [];
          const key = `${trainrun.getId()}:${sections[steps[0].sectionIdx].getId()}`;
          const fixed = steps.some(
            (st) =>
              hasLock(sections[st.sectionIdx]) || !inScope(st.fromNode) || !inScope(st.toNode),
          );
          const varA = newVariable(key + ":A", domain, fixed);
          const linked = constraintEnabled(policy, "symmetry") && isChainLinked(steps, sections);
          const varB = linked ? varA : newVariable(key + ":B", domain, fixed);
          const chain: Chain = {
            key,
            trainrun,
            steps,
            varA,
            varB,
            signB: linked ? -1 : 1,
            mirrorB: linked && isChainMirror(steps, sections, origT),
            fixed,
          };
          chains.push(chain);
          const chainIdx = chains.length - 1;
          variables[varA].chains.push(chainIdx);
          if (varB !== varA) {
            variables[varB].chains.push(chainIdx);
          }
          steps.forEach((st) => (sectionChain[st.sectionIdx] = chainIdx));
          pathChains.push(chainIdx);
        }
      });

      // dwell constraints between consecutive chains
      for (let c = 0; c + 1 < pathChains.length; c++) {
        const inChain = chains[pathChains[c]];
        const outChain = chains[pathChains[c + 1]];
        const inStep = inChain.steps[inChain.steps.length - 1];
        const outStep = outChain.steps[0];
        const node = inStep.toNode;
        const inSec = sections[inStep.sectionIdx];
        const outSec = sections[outStep.sectionIdx];
        const minDwell = constraintEnabled(policy, "minimumStopTime")
          ? minDwellAt(node, trainrun)
          : 0;
        const addStop = (
          arrSec: number,
          arrSection: TrainrunSection,
          depSec: number,
          depSection: TrainrunSection,
        ) => {
          const arrField = arrivalFieldAt(arrSection, node);
          const depField = departureFieldAt(depSection, node);
          if (!active[arrSec * 4 + arrField] || !active[depSec * 4 + depField]) {
            return;
          }
          const dwell0 = mod60(origT[depSec * 4 + depField] - origT[arrSec * 4 + arrField]);
          stops.push({
            node,
            trainrunIndex: trainrunIndexById.get(trainrun.getId()) ?? 0,
            arrSection: arrSec,
            arrField,
            depSection: depSec,
            depField,
            dwell0,
            minDwell: Math.min(minDwell, dwell0),
          });
        };
        // direction A: arrive with inStep, depart with outStep
        addStop(inStep.sectionIdx, inSec, outStep.sectionIdx, outSec);
        // direction B: arrive with outStep, depart with inStep
        addStop(outStep.sectionIdx, outSec, inStep.sectionIdx, inSec);
      }
    });
  });

  // sections not covered by any chain (cyclic) stay fixed
  sections.forEach((s, i) => {
    if (sectionChain[i] === -1) {
      const varIdx = newVariable(`${s.getTrainrunId()}:${s.getId()}:fixed`, 0, true);
      chains.push({
        key: `${s.getTrainrunId()}:${s.getId()}`,
        trainrun: s.getTrainrun(),
        steps: [
          {sectionIdx: i, fromNode: s.getSourceNode(), toNode: s.getTargetNode(), aligned: true},
        ],
        varA: varIdx,
        varB: varIdx,
        signB: 1,
        mirrorB: false,
        fixed: true,
      });
      sectionChain[i] = chains.length - 1;
      variables[varIdx].chains.push(chains.length - 1);
    }
  });

  // --- edges -------------------------------------------------------------
  const edgeIndex = new Map<string, number>();
  const edges: Edge[] = [];
  const sectionEdge = new Int32Array(n).fill(-1);
  sections.forEach((s, i) => {
    const a = s.getSourceNodeId();
    const b = s.getTargetNodeId();
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    let e = edgeIndex.get(key);
    if (e === undefined) {
      const fromNode = a < b ? s.getSourceNode() : s.getTargetNode();
      const toNode = a < b ? s.getTargetNode() : s.getSourceNode();
      edges.push({fromNode, toNode, sections: [], headways: [], maxFrequency: 0});
      e = edges.length - 1;
      edgeIndex.set(key, e);
    }
    const trainrun = s.getTrainrun();
    const headway = Math.max(1, trainrun.getTrainrunCategory()?.sectionHeadway || 0);
    edges[e].sections.push(i);
    edges[e].headways.push(headway);
    edges[e].maxFrequency = Math.max(edges[e].maxFrequency, trainrun.getFrequency() || 60);
    sectionEdge[i] = e;
  });

  const edgeInScope = new Uint8Array(edges.length);
  edges.forEach((edge, index) => {
    edgeInScope[index] =
      selection.size === 0 ||
      (selection.has(edge.fromNode.getId()) && selection.has(edge.toNode.getId()))
        ? 1
        : 0;
  });

  // --- user connections (H13) ---------------------------------------------
  const connections: ConnectionConstraint[] = [];
  const enforceUserConnections = constraintEnabled(policy, "userConnections");
  const preserveConnectionTimes = constraintEnabled(policy, "preserveConnectionTimes");
  nodes.forEach((node) => {
    if (!enforceUserConnections && !preserveConnectionTimes) {
      return;
    }
    const ct = node.getConnectionTime() ?? 0;
    node.getConnections().forEach((connection) => {
      const s1 = node.getPort(connection.getPortId1())?.getTrainrunSection();
      const s2 = node.getPort(connection.getPortId2())?.getTrainrunSection();
      if (s1 === undefined || s2 === undefined) {
        return;
      }
      const i1 = indexOf.get(s1.getId());
      const i2 = indexOf.get(s2.getId());
      if (i1 === undefined || i2 === undefined) {
        return;
      }
      const add = (
        arrIdx: number,
        arrSec: TrainrunSection,
        depIdx: number,
        depSec: TrainrunSection,
      ) => {
        const arrField = arrivalFieldAt(arrSec, node);
        const depField = departureFieldAt(depSec, node);
        if (!active[arrIdx * 4 + arrField] || !active[depIdx * 4 + depField]) {
          return;
        }
        const wait0 = mod60(origT[depIdx * 4 + depField] - origT[arrIdx * 4 + arrField]);
        connections.push({
          node,
          arrSection: arrIdx,
          arrField,
          depSection: depIdx,
          depField,
          wait0,
          lo: preserveConnectionTimes ? wait0 : Math.min(ct, wait0),
          hi: preserveConnectionTimes ? wait0 : Math.max(wait0, ct) + connectionTolerance,
        });
      };
      add(i1, s1, i2, s2);
      add(i2, s2, i1, s1);
    });
  });

  // --- events for optional connections (f2) --------------------------------
  const nodeEvents: NodeEvents[] = [];
  const nodeEventIndex = new Map<number, number>();
  sections.forEach((s, i) => {
    [s.getSourceNode(), s.getTargetNode()].forEach((node) => {
      if (!isStopAt(node, s)) {
        return;
      }
      let ne = nodeEventIndex.get(node.getId());
      if (ne === undefined) {
        nodeEvents.push({
          node,
          connectionTime: node.getConnectionTime() ?? 0,
          arrivals: [],
          departures: [],
        });
        ne = nodeEvents.length - 1;
        nodeEventIndex.set(node.getId(), ne);
      }
      const arrField = arrivalFieldAt(s, node);
      const depField = departureFieldAt(s, node);
      const frequency = s.getTrainrun().getFrequency() || 60;
      if (active[i * 4 + arrField]) {
        nodeEvents[ne].arrivals.push({
          section: i,
          field: arrField,
          trainrunId: s.getTrainrunId(),
          frequency,
        });
      }
      if (active[i * 4 + depField]) {
        nodeEvents[ne].departures.push({
          section: i,
          field: depField,
          trainrunId: s.getTrainrunId(),
          frequency,
        });
      }
    });
  });

  // --- variable -> affected components -----------------------------------
  const sectionStops: number[][] = Array.from({length: n}, (): number[] => []);
  stops.forEach((st, k) => {
    sectionStops[st.arrSection].push(k);
    sectionStops[st.depSection].push(k);
  });
  const sectionConnections: number[][] = Array.from({length: n}, (): number[] => []);
  connections.forEach((c, k) => {
    sectionConnections[c.arrSection].push(k);
    sectionConnections[c.depSection].push(k);
  });
  const sectionNodeEvents: number[][] = Array.from({length: n}, (): number[] => []);
  sections.forEach((s, i) => {
    [s.getSourceNodeId(), s.getTargetNodeId()].forEach((id) => {
      const ne = nodeEventIndex.get(id);
      if (ne !== undefined) {
        sectionNodeEvents[i].push(ne);
      }
    });
  });

  const collect = (varIdx: number, perSection: (i: number) => number[]): number[] => {
    const set = new Set<number>();
    variables[varIdx].chains.forEach((c) =>
      chains[c].steps.forEach((st) => perSection(st.sectionIdx).forEach((x) => set.add(x))),
    );
    return [...set];
  };
  const varEdges = variables.map((_, v) => collect(v, (i) => [sectionEdge[i]]));
  const varStops = variables.map((_, v) => collect(v, (i) => sectionStops[i]));
  const varTrainruns = variables.map((_, v) => [
    ...new Set(varStops[v].map((stopIndex) => stops[stopIndex].trainrunIndex)),
  ]);
  const varConnections = variables.map((_, v) => collect(v, (i) => sectionConnections[i]));
  const varNodeEvents = variables.map((_, v) => collect(v, (i) => sectionNodeEvents[i]));

  const edgeVars: number[][] = edges.map((): number[] => []);
  variables.forEach((variable, v) => {
    if (!variable.fixed && variable.domain > 0) {
      varEdges[v].forEach((e) => edgeVars[e].push(v));
    }
  });

  return {
    sections,
    trainrunIds,
    origC,
    origT,
    active,
    chains,
    variables,
    edges,
    edgeInScope,
    stops,
    connections,
    nodeEvents,
    sectionChain,
    sectionEdge,
    varEdges,
    varStops,
    varTrainruns,
    varConnections,
    varNodeEvents,
    edgeVars,
    maxTracks,
    optionalWindow,
    policy,
  };
}
