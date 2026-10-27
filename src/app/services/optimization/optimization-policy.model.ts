export type HardConstraintId =
  | "trackLimit"
  | "userConnections"
  | "minimumStopTime"
  | "timeLocks"
  | "travelTimeLocks"
  | "scopeBoundary"
  | "symmetry"
  | "maxTravelTimeExtension"
  | "preserveConnectionTimes";

export type ObjectiveId =
  | "minimalChanges"
  | "moreConnections"
  | "lowerTravelTime"
  | "lowerTrackUsage"
  | "lowerEdgeTrackUsage";

export interface HardConstraintConfig {
  id: HardConstraintId;
  name: string;
  enabled: boolean;
  mandatory?: boolean;
  value?: number;
}

export interface ObjectiveConfig {
  id: ObjectiveId;
  name: string;
  enabled: boolean;
  priority: number;
}

export interface OptimizationPolicy {
  hardConstraints: HardConstraintConfig[];
  objectives: ObjectiveConfig[];
}

export interface SolutionKpis {
  objectiveScores?: Partial<Record<ObjectiveId, number>>;
  changedChains: number;
  totalDeltaMinutes: number;
  travelTimeExtensionMinutes: number;
  optionalConnections: number;
  maxTrackUsage: number;
  averageTrackUsage: number;
  changedNodes: number;
}

export const OPTIMIZATION_POLICY_STORAGE_KEY = "netzgrafik.optimizeTimetable.policy.v1";

export function createDefaultOptimizationPolicy(): OptimizationPolicy {
  return {
    hardConstraints: [
      {
        id: "trackLimit",
        name: "app.view.dialogs.optimize-timetable-dialog.director.constraint.track-limit",
        enabled: true,
        value: 2,
      },
      {
        id: "userConnections",
        name: "app.view.dialogs.optimize-timetable-dialog.director.constraint.user-connections",
        enabled: true,
      },
      {
        id: "minimumStopTime",
        name: "app.view.dialogs.optimize-timetable-dialog.director.constraint.minimum-stop-time",
        enabled: true,
      },
      {
        id: "timeLocks",
        name: "app.view.dialogs.optimize-timetable-dialog.director.constraint.time-locks",
        enabled: true,
      },
      {
        id: "travelTimeLocks",
        name: "app.view.dialogs.optimize-timetable-dialog.director.constraint.travel-time-locks",
        enabled: true,
      },
      {
        id: "scopeBoundary",
        name: "app.view.dialogs.optimize-timetable-dialog.director.constraint.scope-boundary",
        enabled: true,
        mandatory: true,
      },
      {
        id: "symmetry",
        name: "app.view.dialogs.optimize-timetable-dialog.director.constraint.symmetry",
        enabled: true,
      },
      {
        id: "maxTravelTimeExtension",
        name: "app.view.dialogs.optimize-timetable-dialog.director.constraint.max-travel-time-extension",
        enabled: false,
        value: 5,
      },
      {
        id: "preserveConnectionTimes",
        name: "app.view.dialogs.optimize-timetable-dialog.director.constraint.preserve-connection-times",
        enabled: false,
      },
    ],
    objectives: [
      {
        id: "minimalChanges",
        name: "app.view.dialogs.optimize-timetable-dialog.director.objective.minimal-changes",
        enabled: true,
        priority: 0,
      },
      {
        id: "moreConnections",
        name: "app.view.dialogs.optimize-timetable-dialog.director.objective.more-connections",
        enabled: true,
        priority: 1,
      },
      {
        id: "lowerTravelTime",
        name: "app.view.dialogs.optimize-timetable-dialog.director.objective.lower-travel-time",
        enabled: true,
        priority: 2,
      },
      {
        id: "lowerTrackUsage",
        name: "app.view.dialogs.optimize-timetable-dialog.director.objective.lower-track-usage",
        enabled: true,
        priority: 3,
      },
      {
        id: "lowerEdgeTrackUsage",
        name: "app.view.dialogs.optimize-timetable-dialog.director.objective.lower-edge-track-usage",
        enabled: true,
        priority: 4,
      },
    ],
  };
}
