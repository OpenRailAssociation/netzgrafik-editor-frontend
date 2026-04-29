/**
 * GTFS Import Models and Interfaces
 */

export interface GTFSRouteTypeFilter {
  tram: boolean;
  metro: boolean;
  rail: boolean;
  bus: boolean;
  ferry: boolean;
}

export interface GTFSNodeFilter {
  start: boolean;
  end: boolean;
  junction: boolean;
  major_stop: boolean;
  minor_stop: boolean;
}

export interface GTFSImportPhase {
  id: string;
  labelKey: string;
  status: "pending" | "running" | "completed" | "error";
  subPhases: GTFSSubPhase[];
}

export interface GTFSSubPhase {
  label: string;
  status: "pending" | "running" | "completed" | "error";
  progress?: number;
}

export interface TripDetail {
  tripId: string;
  routeShortName: string;
  routeLongName: string;
  tripHeadsign: string;
  category: string;
  frequency: string;
  trainrunId: number | null;
  direction: string;
  startStation: string;
  endStation: string;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  stopCount: number;
  isSystemPath: boolean;
  pathVariant: string; // "System" | "Shortened-Start" | "Shortened-End" | "Other"
  stopSequence: string[];
}

export interface GTFSImportSummary {
  nodes: number;
  trainruns: number;
  sections: number;
  roundTripCount: number;
  oneWayCount: number;
  byCategory: Record<string, number>;
  byFrequency: Record<string, number>;
  byLabel: Record<string, number>;
  tripDetails: TripDetail[];
}

export interface GTFSImportState {
  // File and data
  file: File | null;
  lightData: any | null;

  // Available options
  availableAgencies: string[];
  availableCategories: string[];
  availableRoutes: string[];

  // Selected filters
  selectedAgencies: string[];
  selectedCategories: string[];
  selectedLines: string[];
  selectedDate: string | null; // Operating day in YYYY-MM-DD format

  // Service date range from GTFS calendar
  serviceDateRange: {startDate: string; endDate: string} | null;

  // Filtered lists (for autocomplete)
  filteredAgencies: string[];
  filteredCategories: string[];
  filteredLines: string[];

  // Warnings
  noCategoriesWarning: boolean;
  noLinesWarning: boolean;

  // UI state
  filterDialogVisible: boolean;
  importOverlayVisible: boolean;
  importComplete: boolean;

  // Import progress
  importPhases: GTFSImportPhase[];
  importSummary: GTFSImportSummary | null;

  // Filters
  routeTypeFilter: GTFSRouteTypeFilter;
  nodeFilter: GTFSNodeFilter;
  timeSyncTolerance: number;

  // Topology consolidation (Q6)
  enableTopologyConsolidation: boolean;
}

export const DEFAULT_GTFS_IMPORT_PHASES: GTFSImportPhase[] = [
  {
    id: "parse",
    labelKey: "app.view.editor-side-view.gtfs-import-dialogs.phase-parsing",
    status: "pending",
    subPhases: [],
  },
  {
    id: "filter",
    labelKey: "app.view.editor-side-view.gtfs-import-dialogs.phase-filter",
    status: "pending",
    subPhases: [],
  },
  {
    id: "convert",
    labelKey: "app.view.editor-side-view.gtfs-import-dialogs.phase-convert",
    status: "pending",
    subPhases: [],
  },
  {
    id: "import",
    labelKey: "app.view.editor-side-view.gtfs-import-dialogs.phase-import",
    status: "pending",
    subPhases: [],
  },
];

export const DEFAULT_ROUTE_TYPE_FILTER: GTFSRouteTypeFilter = {
  tram: false,
  metro: false,
  rail: true,
  bus: false,
  ferry: false,
};

export const DEFAULT_NODE_FILTER: GTFSNodeFilter = {
  start: true,
  end: true,
  junction: true,
  major_stop: true,
  minor_stop: true,
};

export const DEFAULT_TIME_SYNC_TOLERANCE = 180; // ±180 seconds (3 minutes)

/**
 * Topology Consolidation Models (T1–T6 phases)
 */

export interface TopologyNode {
  id: string; // stop_id
  name: string;
  isAnchor: boolean; // Start/End or high-degree junction
}

export interface TopologyEdgeSegment {
  fromNodeId: string;
  toNodeId: string;
  intermediateStopremarks: string[]; // Intermediate nodes in the backbone chain
  travelTimeMinutes: number; // Average travel time for this segment
  usageCount: number; // How many patterns use this edge
  patternIds: string[]; // IDs of patterns using this edge
}

export interface PatternNodeOccurrence {
  nodeId: string;
  isStop: boolean; // true = halt, false = durchfahrt (pass-through)
  arrivalMinute?: number; // Only if isStop
  departureMinute?: number; // Only if isStop
  interpolatedMinute?: number; // Only if !isStop
}

export interface PatternMapping {
  patternId: string;
  occurrences: PatternNodeOccurrence[]; // Mapped to backbone
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdgeSegment[];
  patternMappings: PatternMapping[];
}
