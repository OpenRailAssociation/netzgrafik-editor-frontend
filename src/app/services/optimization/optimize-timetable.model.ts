import {TrainrunSection} from "../../models/trainrunsection.model";
import {SolutionKpis} from "./optimization-policy.model";

export interface OptimizeTimetableOptions {
  /** Hard limit: maximum number of tracks per edge (node - node). */
  maxTracksPerSection: number;
  /** Selected node ids. Empty => whole network is optimized. */
  selectedNodeIds?: number[];
  /** Search time budget in milliseconds (default 250). */
  timeBudgetMs?: number;
  /** Random seed – a different seed lets the user continue with another search path. */
  seed?: number;
  /** Start assignment (e.g. from a previous proposal) to continue the search. */
  startAssignment?: Record<string, number>;
  /** Upper tolerance for user connections in minutes (default 2). */
  connectionTolerance?: number;
  /** Window above the connection time counted as optional connection (default 5). */
  optionalConnectionWindow?: number;
  /** Maximum number of proposals returned (default 4). */
  maxProposals?: number;
  /** Hard constraints and objective preferences selected in the director. */
  policy?: import("./optimization-policy.model").OptimizationPolicy;
}

export type TimeField =
  | "sourceDeparture"
  | "sourceArrival"
  | "targetDeparture"
  | "targetArrival"
  | "travelTime"
  | "backwardTravelTime";

export interface TimeChange {
  trainrunSectionId: number;
  trainrunId: number;
  trainrunName: string;
  sourceNodeId: number;
  targetNodeId: number;
  sourceNodeName: string;
  targetNodeName: string;
  field: TimeField;
  oldValue: number;
  newValue: number;
}

export interface EdgeTrackKpi {
  edgeId: string;
  inScope: boolean;
  fromNodeName: string;
  toNodeName: string;
  tracksBefore: number;
  tracksAfter: number;
}

export interface OptimizeTimetableKpi extends SolutionKpis {
  /** Edges exceeding the track limit (exact estimator) before / after. */
  edgesOverLimitBefore: number;
  edgesOverLimitAfter: number;
  /** Highest track count over all changed edges before / after. */
  maxTracksBefore: number;
  maxTracksAfter: number;
  /** Sum of total travel time changes (minutes, all trainruns and directions). */
  totalTravelTimeDelta: number;
  /** Number of optional connections before / after. */
  optionalConnectionsBefore: number;
  optionalConnectionsAfter: number;
  /** Sum of absolute shifts (minutes). */
  sumAbsShift: number;
  changedTrainruns: number;
  changedTimes: number;
}

export interface OptimizeTimetableSolution {
  id: number;
  label: string;
  valid: boolean;
  kpi: OptimizeTimetableKpi;
  edges: EdgeTrackKpi[];
  changes: TimeChange[];
  assignment: Record<string, number>;
}

export interface OptimizeTimetableResult {
  baselineKpi: OptimizeTimetableKpi;
  baselineEdges: EdgeTrackKpi[];
  solutions: OptimizeTimetableSolution[];
  freeVariables: number;
  fixedChains: number;
  iterations: number;
  runtimeMs: number;
  /** Edges violating the limit before optimization (surrogate). */
  initialEdgesOverLimit: number;
  message?: string;
}

/** Index of the four times of a section in the internal time arrays. */
export const SRC_DEP = 0;
export const SRC_ARR = 1;
export const TGT_DEP = 2;
export const TGT_ARR = 3;

export const TIME_FIELDS: TimeField[] = [
  "sourceDeparture",
  "sourceArrival",
  "targetDeparture",
  "targetArrival",
];

export interface SectionTimes {
  section: TrainrunSection;
  times: number[];
  travelTime: number;
  backwardTravelTime: number;
}
