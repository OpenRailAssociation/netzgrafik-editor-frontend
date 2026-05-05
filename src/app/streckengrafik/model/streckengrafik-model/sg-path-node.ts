import {SgPath} from "./sg-path";
import {SgPathSection} from "./sg-path-section";
import {SgSelectedTrainrun} from "./sg-selected-trainrun";
import {SgTrainrunNode} from "./sg-trainrun-node";
import {TrackData} from "../trackData";

export class SgPathNode implements SgPath {
  width = 20;

  constructor(
    public index: number,
    public nodeId: number,
    public nodeShortName: string,
    public nodeFullName: string,
    public departureTime: number,
    public arrivalTime: number,
    public departureTrainrunSectionId: number,
    public arrivalTrainrunSectionId: number,
    public trackData: TrackData,
    public filter,
    public trackOccupier = false,
    public xZoom: number = 0,
    public startPosition: number = 0,
    public departurePathSection: SgPathSection = undefined,
    public arrivalPathSection: SgPathSection = undefined,
    public trainrun: SgSelectedTrainrun = undefined,
    public trainrunNodes: SgTrainrunNode[] = [],
  ) {}

  getPathNode(): SgPathNode {
    return this;
  }

  getPathSection(): SgPathSection {
    return undefined;
  }

  isNode(): boolean {
    return true;
  }

  isSection(): boolean {
    return false;
  }

  xPath() {
    if (this.trackOccupier) {
      return this.nodeWidth();
    } else {
      return 0;
    }
  }

  xPathFix(): boolean {
    return true;
  }

  zoomedXPath() {
    return this.xPath();
  }

  nodeWidth() {
    return this.width + this.width * this.trackData.track;
  }

  travelTime(): number {
    return Math.max(1 / 60, this.departureTime - this.arrivalTime);
  }
}
