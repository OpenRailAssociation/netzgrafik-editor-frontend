import {PathNode} from "./pathNode";
import {PathSection} from "./pathSection";
import {TrainrunBranchType} from "./enum/trainrun-branch-type-type";
import {TrainrunTemplatePathAlignmentType} from "./enum/trainrun-template-path-alignment-type";

export interface PathItem {
  departureTime: number;
  arrivalTime: number;
  backward: boolean;
  active: boolean;
  trainrunBranchType: TrainrunBranchType;
  isPartOfTemplatePath: TrainrunTemplatePathAlignmentType;
  oppDirectionTemplatePath: boolean;

  xPath(): number;

  xPathFix(): boolean;

  zommedXPath(xZoom): number;

  key(): string;

  shortKey(): string;

  isNode(): boolean;

  getPathNode(): PathNode;

  isSection(): boolean;

  getPathSection(): PathSection;

  isFilter(): boolean;

  travelTime(): number;

  equal(pathItem: PathItem): boolean;

  clone(): PathItem;
}
