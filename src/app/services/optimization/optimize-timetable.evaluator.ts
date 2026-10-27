import {
  Chain,
  OptimizationProblem,
  PathStep,
  eventPeriod,
  mod60,
  norm60,
} from "./optimize-timetable.chains";
import {SRC_ARR, SRC_DEP, TGT_ARR, TGT_DEP} from "./optimize-timetable.model";
import {HardConstraintId} from "./optimization-policy.model";

/** Same time resolution as the InfrastructureEstimatorService (cells per minute). */
const TICKS_PER_MINUTE = 15;
/** Sample positions per minute of travel time along an edge for the fast track surrogate. */
const SAMPLES_PER_MINUTE = 2;
const MIN_SAMPLES = 9;
const MAX_SAMPLES = 121;

export const WEIGHT_HARD = 1e6;
export const WEIGHT_TRACK = 1000;
export const WEIGHT_TRAVEL_TIME = 1;
export const WEIGHT_OPTIONAL_CONNECTION = 3;
export const WEIGHT_SHIFT = 10;

export interface ScoreParts {
  hard: number;
  excess: number;
  edgesOverLimit: number;
  connectionViolations: number;
  stopViolations: number;
  travelTimeExtensionViolation: number;
  travelTimeDelta: number;
  optionalConnections: number;
  sumAbsShift: number;
}

const depA = (s: PathStep) => (s.aligned ? SRC_DEP : TGT_DEP);
const arrA = (s: PathStep) => (s.aligned ? TGT_ARR : SRC_ARR);
const depB = (s: PathStep) => (s.aligned ? TGT_DEP : SRC_DEP);
const arrB = (s: PathStep) => (s.aligned ? SRC_ARR : TGT_ARR);
const travelA = (s: PathStep) => (s.aligned ? 0 : 1);
const travelB = (s: PathStep) => (s.aligned ? 1 : 0);

function constraintEnabled(problem: OptimizationProblem, id: HardConstraintId): boolean {
  return (
    problem.policy.hardConstraints.find((constraint) => constraint.id === id)?.enabled ?? false
  );
}

/**
 * Mutable candidate state of the search. It only holds numbers; the native
 * objects are never touched here.
 */
export class TimetableEvaluator {
  readonly candC: Float64Array;
  readonly candT: Float64Array;
  readonly origTravel: Float64Array;
  readonly candTravel: Float64Array;
  readonly delta: Int32Array;

  private readonly edgeTracks: Int32Array;
  private readonly stopDwell: Float64Array;
  private readonly stopViolation: Uint8Array;
  private readonly connectionViolation: Uint8Array;
  private readonly travelTimeDeltaByTrainrun: Float64Array;
  private readonly travelTimeExtensionViolationByTrainrun: Uint8Array;
  private readonly nodeOptional: Int32Array;
  private readonly edgeForward: Uint8Array[];
  private readonly edgeSamples: number[][];
  private readonly edgeBuffers: Int32Array[];

  private hard = 0;
  private excess = 0;
  private edgesOverLimit = 0;
  private travelTimeDelta = 0;
  private optionalConnections = 0;
  private sumAbsShift = 0;
  private travelTimeExtensionViolation = 0;

  constructor(private readonly problem: OptimizationProblem) {
    const n = problem.sections.length;
    this.candC = new Float64Array(problem.origC);
    this.candT = new Float64Array(problem.origT);
    this.origTravel = new Float64Array(n * 2);
    problem.sections.forEach((s, i) => {
      this.origTravel[i * 2] = s.getTravelTime();
      this.origTravel[i * 2 + 1] = s.getBackwardTravelTime();
    });
    this.candTravel = new Float64Array(this.origTravel);
    this.delta = new Int32Array(problem.variables.length);
    this.edgeTracks = new Int32Array(problem.edges.length);
    this.stopDwell = new Float64Array(problem.stops.length);
    this.stopViolation = new Uint8Array(problem.stops.length);
    this.connectionViolation = new Uint8Array(problem.connections.length);
    this.travelTimeDeltaByTrainrun = new Float64Array(problem.trainrunIds.length);
    this.travelTimeExtensionViolationByTrainrun = new Uint8Array(problem.trainrunIds.length);
    this.nodeOptional = new Int32Array(problem.nodeEvents.length);
    this.edgeForward = problem.edges.map(
      (edge) =>
        new Uint8Array(
          edge.sections.map((i) =>
            problem.sections[i].getSourceNodeId() === edge.fromNode.getId() ? 1 : 0,
          ),
        ),
    );
    this.edgeSamples = problem.edges.map((edge) => {
      const maxTravel = edge.sections.reduce(
        (m, i) => Math.max(m, this.origTravel[i * 2], this.origTravel[i * 2 + 1]),
        0,
      );
      const count = Math.min(
        MAX_SAMPLES,
        Math.max(MIN_SAMPLES, Math.ceil(maxTravel * SAMPLES_PER_MINUTE) + 1),
      );
      return Array.from({length: count}, (_, k) => k / (count - 1));
    });
    this.edgeBuffers = problem.edges.map((edge) => {
      const capacity = edge.sections.reduce((sum, i) => {
        const frequency = Math.max(1, problem.sections[i].getTrainrun().getFrequency() || 60);
        return sum + 2 * 4 * Math.ceil(edge.maxFrequency / frequency);
      }, 0);
      return new Int32Array(capacity);
    });
  }

  // ---------------------------------------------------------------------
  // full evaluation
  // ---------------------------------------------------------------------

  evaluateAll(): number {
    this.problem.chains.forEach((chain) => this.applyChain(chain));
    this.hard = 0;
    this.excess = 0;
    this.edgesOverLimit = 0;
    this.travelTimeDelta = 0;
    this.optionalConnections = 0;
    this.sumAbsShift = 0;
    this.travelTimeDeltaByTrainrun.fill(0);
    this.travelTimeExtensionViolationByTrainrun.fill(0);
    this.travelTimeExtensionViolation = 0;
    for (let e = 0; e < this.problem.edges.length; e++) {
      this.edgeTracks[e] = this.computeEdgeTracks(e);
      this.addEdge(e, 1);
    }
    for (let k = 0; k < this.problem.stops.length; k++) {
      this.computeStop(k);
      this.addStop(k, 1);
    }
    for (let k = 0; k < this.problem.connections.length; k++) {
      this.connectionViolation[k] = this.computeConnectionViolation(k);
      if (
        constraintEnabled(this.problem, "userConnections") ||
        constraintEnabled(this.problem, "preserveConnectionTimes")
      ) {
        this.hard += this.connectionViolation[k];
      }
    }
    for (let k = 0; k < this.problem.nodeEvents.length; k++) {
      this.nodeOptional[k] = this.computeNodeOptional(k);
      this.optionalConnections += this.nodeOptional[k];
    }
    this.problem.variables.forEach((variable, v) => {
      if (!variable.fixed) {
        this.sumAbsShift += Math.abs(this.delta[v]);
      }
    });
    this.travelTimeExtensionViolation = 0;
    for (let trainrunIndex = 0; trainrunIndex < this.problem.trainrunIds.length; trainrunIndex++) {
      const violation = this.getTravelTimeExtensionViolation(trainrunIndex);
      this.travelTimeExtensionViolationByTrainrun[trainrunIndex] = violation;
      this.travelTimeExtensionViolation += violation;
      if (constraintEnabled(this.problem, "maxTravelTimeExtension")) {
        this.hard += violation;
      }
    }
    return this.score();
  }

  score(): number {
    return (
      WEIGHT_HARD * this.hard +
      WEIGHT_TRACK * this.excess +
      WEIGHT_TRAVEL_TIME * this.travelTimeDelta -
      WEIGHT_OPTIONAL_CONNECTION * this.optionalConnections +
      WEIGHT_SHIFT * this.sumAbsShift
    );
  }

  parts(): ScoreParts {
    return {
      hard: this.hard,
      excess: this.excess,
      edgesOverLimit: this.edgesOverLimit,
      connectionViolations: this.connectionViolation.reduce((sum, violation) => sum + violation, 0),
      stopViolations: this.stopViolation.reduce((sum, violation) => sum + violation, 0),
      travelTimeExtensionViolation: this.travelTimeExtensionViolation,
      travelTimeDelta: Math.round(this.travelTimeDelta * 100) / 100,
      optionalConnections: this.optionalConnections,
      sumAbsShift: this.sumAbsShift,
    };
  }

  getEdgeTracks(e: number): number {
    return this.edgeTracks[e];
  }

  isConnectionViolated(index: number): boolean {
    return this.connectionViolation[index] === 1;
  }

  isStopViolated(index: number): boolean {
    return this.stopViolation[index] === 1;
  }

  getStopDwell(index: number): number {
    return this.stopDwell[index];
  }

  getConnectionWait(index: number): number {
    const connection = this.problem.connections[index];
    return (
      connection.wait0 +
      norm60(
        this.shiftOf(connection.depSection, connection.depField) -
          this.shiftOf(connection.arrSection, connection.arrField),
      )
    );
  }

  getOptionalConnectionScore(): number {
    let nodeScore = 0;
    let scoredNodes = 0;
    for (const nodeEvents of this.problem.nodeEvents) {
      const departureTrainrunIds = new Set(
        nodeEvents.departures.map((event) => event.trainrunId),
      );
      const trainrunIds = new Set([
        ...nodeEvents.arrivals
          .filter((event) => departureTrainrunIds.has(event.trainrunId))
          .map((event) => event.trainrunId),
      ]);
      if (trainrunIds.size === 0) {
        continue;
      }

      let connectionScore = 0;
      for (const arrival of nodeEvents.arrivals) {
        const arrivalTime = this.candT[arrival.section * 4 + arrival.field];
        for (const departure of nodeEvents.departures) {
          if (arrival.trainrunId === departure.trainrunId) {
            continue;
          }
          const period = eventPeriod(arrival.frequency, departure.frequency);
          const wait =
            (((this.candT[departure.section * 4 + departure.field] - arrivalTime) % period) +
              period) %
            period;
          const minimumWait = nodeEvents.connectionTime;
          if (wait >= minimumWait && wait <= minimumWait + this.problem.optionalWindow) {
            connectionScore += 1 + 1 / (1 + Math.pow(2, wait - minimumWait));
          }
        }
      }
      nodeScore += connectionScore / trainrunIds.size;
      scoredNodes++;
    }
    if (scoredNodes === 0) {
      return 0;
    }
    const normalizedScore = nodeScore / scoredNodes;
    return normalizedScore / (1 + normalizedScore);
  }

  getTravelTimeChangeByTrainrun(trainrunIndex: number): number {
    return this.travelTimeDeltaByTrainrun[trainrunIndex] ?? 0;
  }

  getStopViolationSeverity(index: number): number {
    const stop = this.problem.stops[index];
    const dwell = this.stopDwell[index];
    return Math.max(
      dwell < stop.minDwell - 1e-6 ? stop.minDwell - dwell - 1e-6 : 0,
      dwell < 0 ? -dwell : 0,
      dwell >= 60 ? dwell - 59 : 0,
    );
  }

  getConnectionViolationSeverity(index: number): number {
    const connection = this.problem.connections[index];
    const wait = this.getConnectionWait(index);
    return Math.max(0, connection.lo - wait - 1e-6, wait - connection.hi - 1e-6);
  }

  getTrackOverload(edgeIndex: number): number {
    return Math.max(0, this.edgeTracks[edgeIndex] - this.problem.maxTracks);
  }

  isTravelTimeExtensionViolated(trainrunIndex: number): boolean {
    return this.travelTimeExtensionViolationByTrainrun[trainrunIndex] === 1;
  }

  getTravelTimeExtensionExcess(trainrunIndex: number): number {
    const constraint = this.problem.policy.hardConstraints.find(
      (item) => item.id === "maxTravelTimeExtension",
    );
    return constraint?.enabled
      ? Math.max(
          0,
          this.travelTimeDeltaByTrainrun[trainrunIndex] - (constraint.value ?? 5),
        )
      : 0;
  }

  // ---------------------------------------------------------------------
  // incremental move
  // ---------------------------------------------------------------------

  /** Sets one variable, updates all affected components and returns the new score. */
  setVariable(v: number, value: number): number {
    const old = this.delta[v];
    if (old === value) {
      return this.score();
    }
    const p = this.problem;
    if (constraintEnabled(p, "maxTravelTimeExtension")) {
      p.varTrainruns[v].forEach(
        (trainrunIndex) =>
          (this.hard -= this.travelTimeExtensionViolationByTrainrun[trainrunIndex]),
      );
    }
    p.varEdges[v].forEach((e) => this.addEdge(e, -1));
    p.varStops[v].forEach((k) => this.addStop(k, -1));
    if (
      constraintEnabled(p, "userConnections") ||
      constraintEnabled(p, "preserveConnectionTimes")
    ) {
      p.varConnections[v].forEach((k) => (this.hard -= this.connectionViolation[k]));
    }
    p.varNodeEvents[v].forEach((k) => (this.optionalConnections -= this.nodeOptional[k]));

    this.delta[v] = value;
    this.sumAbsShift += Math.abs(value) - Math.abs(old);
    p.variables[v].chains.forEach((c) => this.applyChain(p.chains[c]));

    p.varEdges[v].forEach((e) => {
      this.edgeTracks[e] = this.computeEdgeTracks(e);
      this.addEdge(e, 1);
    });
    p.varStops[v].forEach((k) => {
      this.computeStop(k);
      this.addStop(k, 1);
    });
    p.varConnections[v].forEach((k) => {
      this.connectionViolation[k] = this.computeConnectionViolation(k);
      if (
        constraintEnabled(p, "userConnections") ||
        constraintEnabled(p, "preserveConnectionTimes")
      ) {
        this.hard += this.connectionViolation[k];
      }
    });
    p.varNodeEvents[v].forEach((k) => {
      this.nodeOptional[k] = this.computeNodeOptional(k);
      this.optionalConnections += this.nodeOptional[k];
    });
    if (constraintEnabled(p, "maxTravelTimeExtension")) {
      p.varTrainruns[v].forEach((trainrunIndex) => {
        const previous = this.travelTimeExtensionViolationByTrainrun[trainrunIndex];
        const next = this.getTravelTimeExtensionViolation(trainrunIndex);
        this.travelTimeExtensionViolationByTrainrun[trainrunIndex] = next;
        this.travelTimeExtensionViolation += next - previous;
        this.hard += next;
      });
    }
    return this.score();
  }

  private getTravelTimeExtensionViolation(trainrunIndex: number): number {
    const constraint = this.problem.policy.hardConstraints.find(
      (item) => item.id === "maxTravelTimeExtension",
    );
    return constraint?.enabled &&
      this.travelTimeDeltaByTrainrun[trainrunIndex] > (constraint.value ?? 5)
      ? 1
      : 0;
  }

  isEdgeOverLimit(e: number): boolean {
    return this.edgeTracks[e] > this.problem.maxTracks;
  }

  // ---------------------------------------------------------------------
  // chain times
  // ---------------------------------------------------------------------

  private setTime(i: number, field: number, consecutive: number) {
    const k = i * 4 + field;
    const shift = consecutive - this.problem.origC[k];
    this.candC[k] = consecutive;
    this.candT[k] = mod60(this.problem.origT[k] + shift);
  }

  private setDisplayTime(i: number, field: number, time: number) {
    const k = i * 4 + field;
    const shift = norm60(time - this.problem.origT[k]);
    this.candC[k] = this.problem.origC[k] + shift;
    this.candT[k] = mod60(time);
  }

  private restore(i: number, field: number) {
    const k = i * 4 + field;
    this.candC[k] = this.problem.origC[k];
    this.candT[k] = this.problem.origT[k];
  }

  /** Recomputes all candidate times of a chain from its variable values. */
  private applyChain(chain: Chain) {
    const shiftA = chain.fixed ? 0 : this.delta[chain.varA];
    const shiftB = chain.fixed ? 0 : chain.signB * this.delta[chain.varB];
    const oC = this.problem.origC;

    if (shiftA === 0) {
      chain.steps.forEach((s) => {
        this.restore(s.sectionIdx, depA(s));
        this.restore(s.sectionIdx, arrA(s));
        this.candTravel[s.sectionIdx * 2 + travelA(s)] =
          this.origTravel[s.sectionIdx * 2 + travelA(s)];
      });
    } else {
      const first = chain.steps[0];
      let t = Math.round(oC[first.sectionIdx * 4 + depA(first)] + shiftA);
      chain.steps.forEach((s) => {
        const tt = Math.ceil(this.origTravel[s.sectionIdx * 2 + travelA(s)] - 1e-9);
        this.candTravel[s.sectionIdx * 2 + travelA(s)] = tt;
        this.setTime(s.sectionIdx, depA(s), t);
        t += tt;
        this.setTime(s.sectionIdx, arrA(s), t);
      });
    }

    if (chain.mirrorB && shiftA !== 0) {
      chain.steps.forEach((s) => {
        const i = s.sectionIdx;
        this.setDisplayTime(i, depB(s), mod60(-this.candT[i * 4 + arrA(s)]));
        this.setDisplayTime(i, arrB(s), mod60(-this.candT[i * 4 + depA(s)]));
        this.candTravel[i * 2 + travelB(s)] = this.candTravel[i * 2 + travelA(s)];
      });
    } else if (shiftB === 0) {
      chain.steps.forEach((s) => {
        this.restore(s.sectionIdx, depB(s));
        this.restore(s.sectionIdx, arrB(s));
        this.candTravel[s.sectionIdx * 2 + travelB(s)] =
          this.origTravel[s.sectionIdx * 2 + travelB(s)];
      });
    } else {
      const last = chain.steps[chain.steps.length - 1];
      let t = Math.round(oC[last.sectionIdx * 4 + depB(last)] + shiftB);
      for (let k = chain.steps.length - 1; k >= 0; k--) {
        const s = chain.steps[k];
        const tt = Math.ceil(this.origTravel[s.sectionIdx * 2 + travelB(s)] - 1e-9);
        this.candTravel[s.sectionIdx * 2 + travelB(s)] = tt;
        this.setTime(s.sectionIdx, depB(s), t);
        t += tt;
        this.setTime(s.sectionIdx, arrB(s), t);
      }
    }
  }

  // ---------------------------------------------------------------------
  // components
  // ---------------------------------------------------------------------

  private addEdge(e: number, sign: number) {
    const over = this.edgeTracks[e] - this.problem.maxTracks;
    if (over > 0) {
      this.excess += sign * over;
      this.edgesOverLimit += sign;
      if (constraintEnabled(this.problem, "trackLimit") && this.problem.edgeInScope[e] === 1) {
        this.hard += sign;
      }
    }
  }

  private shiftOf(i: number, field: number): number {
    const k = i * 4 + field;
    return this.candC[k] - this.problem.origC[k];
  }

  private computeStop(k: number) {
    const st = this.problem.stops[k];
    const dwell =
      st.dwell0 +
      norm60(this.shiftOf(st.depSection, st.depField) - this.shiftOf(st.arrSection, st.arrField));
    this.stopDwell[k] = dwell;
    this.stopViolation[k] = dwell < st.minDwell - 1e-6 || dwell < 0 || dwell >= 60 ? 1 : 0;
  }

  private addStop(k: number, sign: number) {
    if (constraintEnabled(this.problem, "minimumStopTime")) {
      this.hard += sign * this.stopViolation[k];
    }
    const stop = this.problem.stops[k];
    const delta = sign * (this.stopDwell[k] - stop.dwell0);
    this.travelTimeDelta += delta;
    this.travelTimeDeltaByTrainrun[stop.trainrunIndex] += delta;
  }

  private computeConnectionViolation(k: number): number {
    const c = this.problem.connections[k];
    const wait =
      c.wait0 +
      norm60(this.shiftOf(c.depSection, c.depField) - this.shiftOf(c.arrSection, c.arrField));
    return wait < c.lo - 1e-6 || wait > c.hi + 1e-6 ? 1 : 0;
  }

  private computeNodeOptional(k: number): number {
    const ne = this.problem.nodeEvents[k];
    const lo = ne.connectionTime;
    const hi = ne.connectionTime + this.problem.optionalWindow;
    let count = 0;
    for (const a of ne.arrivals) {
      const ta = this.candT[a.section * 4 + a.field];
      for (const d of ne.departures) {
        if (a.trainrunId === d.trainrunId) {
          continue;
        }
        const period = eventPeriod(a.frequency, d.frequency);
        const wait = (((this.candT[d.section * 4 + d.field] - ta) % period) + period) % period;
        if (wait >= lo && wait <= hi) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Fast surrogate of InfrastructureEstimatorService.estimateSectionTracks:
   * both directions share the edge, each passage blocks its headway band,
   * repeated with its frequency over the largest frequency of the edge.
   */
  computeEdgeTracks(e: number): number {
    const edge = this.problem.edges[e];
    const forward = this.edgeForward[e];
    const period = Math.max(1, Math.round(edge.maxFrequency * TICKS_PER_MINUTE));
    const active = this.problem.active;
    let maxTracks = 0;

    const buffer = this.edgeBuffers[e];
    for (const p of this.edgeSamples[e]) {
      let length = 0;
      for (let j = 0; j < edge.sections.length; j++) {
        const i = edge.sections[j];
        const frequency = Math.max(1, this.problem.sections[i].getTrainrun().getFrequency() || 60);
        const band = Math.round(edge.headways[j] * TICKS_PER_MINUTE);
        const fwdFraction = forward[j] ? p : 1 - p;
        if (active[i * 4 + SRC_DEP]) {
          const dep = this.candC[i * 4 + SRC_DEP];
          const arr = this.candC[i * 4 + TGT_ARR];
          const time = dep + (arr - dep) * fwdFraction;
          length = this.pushOccurrences(buffer, length, time, frequency, band, period);
        }
        if (active[i * 4 + TGT_DEP]) {
          const dep = this.candC[i * 4 + TGT_DEP];
          const arr = this.candC[i * 4 + SRC_ARR];
          const time = dep + (arr - dep) * (1 - fwdFraction);
          length = this.pushOccurrences(buffer, length, time, frequency, band, period);
        }
      }
      const events = buffer.subarray(0, length).sort();
      let current = 0;
      for (let k = 0; k < length; k++) {
        current += (events[k] & 1) === 1 ? 1 : -1;
        if (current > maxTracks) {
          maxTracks = current;
        }
      }
    }
    return maxTracks;
  }

  /** Events are encoded as tick*2 (+1 for start) so ends sort before starts. */
  private pushOccurrences(
    buffer: Int32Array,
    length: number,
    time: number,
    frequency: number,
    band: number,
    period: number,
  ): number {
    const step = Math.round(frequency * TICKS_PER_MINUTE);
    const tick = Math.round(time * TICKS_PER_MINUTE);
    for (let offset = 0; offset < period; offset += step) {
      const start = (((tick + offset) % period) + period) % period;
      const end = start + band;
      buffer[length++] = start * 2 + 1;
      if (end <= period) {
        buffer[length++] = end * 2;
      } else {
        buffer[length++] = period * 2;
        buffer[length++] = 1;
        buffer[length++] = (end - period) * 2;
      }
    }
    return length;
  }
}
