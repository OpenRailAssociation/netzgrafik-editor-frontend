export enum InfrastructureDataSource {
  Manual = "manual",
  OpenRailwayMap = "openRailwayMap",
}

export interface InfrastructureDataProvenance {
  openRailwayMapId?: string;
  source: InfrastructureDataSource;
  lastUpdatedAt: string;
}

export interface NodeInfrastructureResource extends InfrastructureDataProvenance {
  platformTrackCount: number;
  throughTrackCount: number;
  sidingTrackCount: number;
}

export function createDefaultNodeInfrastructure(): NodeInfrastructureResource {
  return {
    platformTrackCount: 2,
    throughTrackCount: 0,
    sidingTrackCount: 0,
    source: InfrastructureDataSource.Manual,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export enum SectionTrackClass {
  SingleTrack = "singleTrack",
  DoubleTrack = "doubleTrack",
  MultiTrack = "multiTrack",
}

export interface SectionInfrastructureResource extends InfrastructureDataProvenance {
  trackCount: number;
  trackClass: SectionTrackClass;
  maximumSpeedKph: number;
  electrified: boolean;
}

export function createDefaultSectionInfrastructure(): SectionInfrastructureResource {
  return {
    trackCount: 2,
    trackClass: SectionTrackClass.DoubleTrack,
    maximumSpeedKph: 160,
    electrified: true,
    source: InfrastructureDataSource.Manual,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export interface SectionResourceReference {
  sourceNodeId: number;
  targetNodeId: number;
  resourceId: number;
}

export function findSharedSectionResourceId(
  sections: SectionResourceReference[],
  sourceNodeId: number,
  targetNodeId: number,
): number | undefined {
  return sections.find(
    (section) =>
      section.resourceId !== 0 &&
      ((section.sourceNodeId === sourceNodeId && section.targetNodeId === targetNodeId) ||
        (section.sourceNodeId === targetNodeId && section.targetNodeId === sourceNodeId)),
  )?.resourceId;
}