import {PathItem} from "./pathItem";
import {PathSection} from "./pathSection";
import {TrainrunBranchType} from "./enum/trainrun-branch-type-type";
import {TrackData} from "./trackData";
import {TrainrunTemplatePathAlignmentType} from "./enum/trainrun-template-path-alignment-type";

export class PathNode implements PathItem {
  private width = 20;

  constructor(
    public departureTime: number,
    public arrivalTime: number,
    public nodeId: number,
    public nodeShortName: string,
    public index: number,
    public trackData: TrackData,
    public backward = false,
    public haltezeit: number = 4,
    public filter = false,
    public trackOccupier = false,
    public arrivalPathSection: PathSection = undefined,
    public departurePathSection: PathSection = undefined,
    public trainrunBranchType: TrainrunBranchType = TrainrunBranchType.Trainrun,
    public isPartOfTemplatePath: TrainrunTemplatePathAlignmentType = TrainrunTemplatePathAlignmentType.NodeFound,
    public oppDirectionTemplatePath: boolean = false,
  ) {}

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

  zommedXPath(xZoom) {
    return this.xPath();
  }

  key(): string {
    return this.nodeId + ";" + this.index;
  }

  shortKey(): string {
    return "" + this.nodeId;
  }

  nodeWidth() {
    return this.width + this.width * this.trackData.track;
  }

  isNode(): boolean {
    return true;
  }

  getPathNode(): PathNode {
    return this;
  }

  isSection(): boolean {
    return false;
  }

  getPathSection(): PathSection {
    return undefined;
  }

  isFilter(): boolean {
    return this.filter;
  }

  travelTime() {
    return Math.max(1 / 60, this.arrivalTime - this.departureTime);
  }

  equal(pathNode: PathNode): boolean {
    return (
      this.departureTime === pathNode.departureTime &&
      this.arrivalTime === pathNode.arrivalTime &&
      this.nodeId === pathNode.nodeId &&
      this.nodeShortName === pathNode.nodeShortName &&
      this.trackData === pathNode.trackData &&
      this.backward === pathNode.backward &&
      this.haltezeit === pathNode.haltezeit &&
      this.filter === pathNode.filter &&
      this.trackOccupier === pathNode.trackOccupier &&
      this.arrivalPathSection === pathNode.arrivalPathSection &&
      this.departurePathSection === pathNode.departurePathSection &&
      this.trainrunBranchType === pathNode.trainrunBranchType &&
      this.isPartOfTemplatePath === pathNode.isPartOfTemplatePath
    );
  }

  clone(): PathItem {
    return new PathNode(
      this.departureTime,
      this.arrivalTime,
      this.nodeId,
      this.nodeShortName,
      this.index,
      this.trackData,
      this.backward,
      this.haltezeit,
      this.filter,
      this.trackOccupier,
      this.arrivalPathSection,
      this.departurePathSection,
      this.trainrunBranchType,
      this.isPartOfTemplatePath,
      this.oppDirectionTemplatePath,
    );
  }
}
