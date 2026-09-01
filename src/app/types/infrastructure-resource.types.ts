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