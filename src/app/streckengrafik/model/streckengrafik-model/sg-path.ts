import {SgPathNode} from "./sg-path-node";
import {SgPathSection} from "./sg-path-section";
import {SgSelectedTrainrun} from "./sg-selected-trainrun";

export interface SgPath {
  index: number;
  xZoom: number;
  startPosition: number;
  departureTime: number;
  arrivalTime: number;
  filter: boolean;
  trackOccupier: boolean;
  trainrun: SgSelectedTrainrun;

  isNode(): boolean;

  isSection(): boolean;

  getPathNode(): SgPathNode;

  getPathSection(): SgPathSection;

  xPath(): number;

  xPathFix(): boolean;

  zoomedXPath(): number;

  travelTime(): number;
}
