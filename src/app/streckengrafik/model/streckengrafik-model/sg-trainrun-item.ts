import {SgTrainrunSection} from "./sg-trainrun-section";
import {SgTrainrunNode} from "./sg-trainrun-node";
import {SgPathNode} from "./sg-path-node";
import {SgPathSection} from "./sg-path-section";

export interface SgTrainrunItem {
  index: number;
  departureTime: number;
  arrivalTime: number;
  backward: boolean;
  minimumHeadwayTime: number;

  isNode(): boolean;

  isSection(): boolean;

  getTrainrunNode(): SgTrainrunNode;

  getTrainrunSection(): SgTrainrunSection;

  getPathNode(): SgPathNode;

  getPathSection(): SgPathSection;

  getStartposition(): number;

  getId(): number;

  changeOrientation(): void;
}
