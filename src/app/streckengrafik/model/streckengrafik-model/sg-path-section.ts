import {SgPathNode} from "./sg-path-node";
import {SgPath} from "./sg-path";
import {SgSelectedTrainrun} from "./sg-selected-trainrun";
import {SgTrainrunSection} from "./sg-trainrun-section";
import {TrackData} from "../trackData";

export class SgPathSection implements SgPath {
  branchWidth = 70;

  constructor(
    public index: number,
    public trainrunSectionId: number,
    public departureTime: number,
    public arrivalTime: number,
    public departureNodeId: number,
    public arrivalNodeId: number,
    public departureNodeShortName: string,
    public arrivalNodeShortName: string,
    public trackData: TrackData,
    public filter: boolean,
    public trackOccupier = false,
    public xZoom: number = 0,
    public startPosition: number = 0,
    public departurePathNode: SgPathNode = undefined,
    public arrivalPathNode: SgPathNode = undefined,
    public trainrun: SgSelectedTrainrun = undefined,
    public trainrunSections: SgTrainrunSection[] = [],
  ) {}

  getPathNode(): SgPathNode {
    return undefined;
  }

  getPathSection(): SgPathSection {
    return this;
  }

  isNode(): boolean {
    return false;
  }

  isSection(): boolean {
    return true;
  }

  xPath(): number {
    if (this.xPathFix()) {
      return this.branchWidth;
    }
    return this.travelTime();
  }

  xPathFix(): boolean {
    return this.filter;
  }

  zoomedXPath(): number {
    if (this.xPathFix()) {
      return this.xPath();
    }
    return this.calcZoomedXPath();
  }

  calcZoomedXPath(): number {
    return this.xZoom * this.xPath();
  }

  travelTime(): number {
    return Math.max(1 / 60, this.departureTime - this.arrivalTime);
  }
}
