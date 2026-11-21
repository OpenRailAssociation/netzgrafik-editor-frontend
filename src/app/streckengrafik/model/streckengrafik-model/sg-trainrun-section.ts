import {SgTrainrunItem} from "./sg-trainrun-item";
import {SgPathSection} from "./sg-path-section";
import {SgTrainrunNode} from "./sg-trainrun-node";
import {TrainrunBranchType} from "../enum/trainrun-branch-type-type";
import {SgPathNode} from "./sg-path-node";
import {TrackData} from "../trackData";

export class SgTrainrunSection implements SgTrainrunItem {
  static currentId = 0;
  private id: number;

  constructor(
    public index: number,
    public trainrunSectionId: number,
    public departureTime: number,
    public arrivalTime: number,
    public departureNodeId: number,
    public arrivalNodeId: number,
    public departureNodeShortName: string,
    public arrivalNodeShortName: string,
    public departureBranchEndNodeShortName: string,
    public arrivalBranchEndNodeShortName: string,
    public backward: boolean,
    public numberOfStops: number,
    public trackData: TrackData,
    public pathSection: SgPathSection,
    public trainrunBranchType: TrainrunBranchType = TrainrunBranchType.Trainrun,
    public arrivalPathNode: SgTrainrunNode = undefined,
    public departurePathNode: SgTrainrunNode = undefined,
    public minimumHeadwayTime = 2,
  ) {
    this.id = SgTrainrunSection.currentId;
    SgTrainrunSection.currentId++;
  }

  getId(): number {
    return this.id;
  }

  getTrainrunNode(): SgTrainrunNode {
    return undefined;
  }

  getTrainrunSection(): SgTrainrunSection {
    return this;
  }

  getPathNode(): SgPathNode {
    return undefined;
  }

  getPathSection(): SgPathSection {
    return this.pathSection;
  }

  isNode(): boolean {
    return false;
  }

  isSection(): boolean {
    return true;
  }

  getStartposition(): number {
    return this.pathSection.startPosition;
  }

  changeOrientation(): void {
    const departureTime = this.departureTime;
    this.departureTime = this.arrivalTime;
    this.arrivalTime = departureTime;
  }
}
