import {PathItem} from "./pathItem";
import {PathNode} from "./pathNode";
import {TrainrunBranchType} from "./enum/trainrun-branch-type-type";
import {TrackData} from "./trackData";
import {TrainrunTemplatePathAlignmentType} from "./enum/trainrun-template-path-alignment-type";

export class PathSection implements PathItem {
  branchWith = 70;

  constructor(
    public trainrunSectionId: number,
    public departureTime: number,
    public arrivalTime: number,
    public numberOfStops: number,
    public trackData: TrackData,
    public backward: boolean = false,
    public active = true,
    public departureBranchEndNode: PathNode = undefined,
    public arrivalBranchEndNode: PathNode = undefined,
    public trainrunBranchType: TrainrunBranchType = TrainrunBranchType.Trainrun,
    public departurePathNode: PathNode = undefined,
    public arrivalPathNode: PathNode = undefined,
    public isFilteredDepartureNode: boolean = false,
    public isFilteredArrivalNode: boolean = false,
    public isPartOfTemplatePath: TrainrunTemplatePathAlignmentType = TrainrunTemplatePathAlignmentType.SectionSameDirection,
    public oppDirectionTemplatePath: boolean = false,
  ) {}

  xPath(): number {
    if (this.xPathFix()) {
      return this.branchWith;
    }
    return this.travelTime();
  }

  xPathFix(): boolean {
    return this.isFilteredDepartureNode || this.isFilteredArrivalNode;
  }

  zommedXPath(xZoom): number {
    if (this.xPathFix()) {
      return this.xPath();
    }
    return xZoom * this.xPath();
  }

  key(): string {
    if (this.backward) {
      return this.arrivalPathNode.key() + ":" + this.departurePathNode.key();
    }
    return this.departurePathNode.key() + ":" + this.arrivalPathNode.key();
  }

  shortKey(): string {
    if (this.departurePathNode === undefined || this.arrivalPathNode === undefined) {
      return undefined;
    }
    if (this.backward) {
      return this.arrivalPathNode.shortKey() + ":" + this.departurePathNode.shortKey();
    }
    return this.departurePathNode.shortKey() + ":" + this.arrivalPathNode.shortKey();
  }

  isNode(): boolean {
    return false;
  }

  getPathNode(): PathNode {
    return undefined;
  }

  isSection(): boolean {
    return true;
  }

  getPathSection(): PathSection {
    return this;
  }

  isFilterOnOneNode(): boolean {
    return this.isFilteredDepartureNode || this.isFilteredArrivalNode;
  }

  isFilter(): boolean {
    return this.isFilteredDepartureNode && this.isFilteredArrivalNode;
  }

  travelTime() {
    return Math.max(1 / 60, this.departureTime - this.arrivalTime);
  }

  equal(pathSection: PathSection): boolean {
    if (this === pathSection) {
      return true;
    }
    return (
      this.trainrunSectionId === pathSection.trainrunSectionId &&
      this.departureTime === pathSection.departureTime &&
      this.arrivalTime === pathSection.arrivalTime &&
      this.numberOfStops === pathSection.numberOfStops &&
      this.backward === pathSection.backward &&
      this.active === pathSection.active &&
      this.trainrunBranchType === pathSection.trainrunBranchType &&
      this.departurePathNode === pathSection.departurePathNode &&
      this.arrivalPathNode === pathSection.arrivalPathNode &&
      this.arrivalBranchEndNode === pathSection.arrivalBranchEndNode &&
      this.departureBranchEndNode === pathSection.departureBranchEndNode &&
      this.isFilteredDepartureNode === pathSection.isFilteredDepartureNode &&
      this.isFilteredArrivalNode === pathSection.isFilteredArrivalNode
    );
  }

  clone(): PathItem {
    return new PathSection(
      this.trainrunSectionId,
      this.departureTime,
      this.arrivalTime,
      this.numberOfStops,
      this.trackData,
      this.backward,
      this.active,
      this.departureBranchEndNode,
      this.arrivalBranchEndNode,
      this.trainrunBranchType,
      this.departurePathNode,
      this.arrivalPathNode,
      this.isFilteredDepartureNode,
      this.isFilteredArrivalNode,
      this.isPartOfTemplatePath,
      this.oppDirectionTemplatePath,
    );
  }
}
