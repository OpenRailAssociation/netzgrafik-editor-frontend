import {SgTrainrunItem} from "./sg-trainrun-item";
import {SgPathNode} from "./sg-path-node";
import {SgTrainrunSection} from "./sg-trainrun-section";
import {SgPathSection} from "./sg-path-section";
import {TrackData} from "../trackData";

export interface SgTrainrunNodeTrackReservation {
  offset: number;
  track: number;
  arrivalTime: number;
  departureTime: number;
  headwayUntilTime: number;
  trainrunId: number;
  occurrenceIndex: number;
  arrivalSectionId?: number;
  departureSectionId?: number;
}

export class SgTrainrunNode implements SgTrainrunItem {
  static currentId = 0;
  private id: number;

  constructor(
    public index: number,
    public nodeId: number,
    public nodeShortName: string,
    public trainrunId: number,
    public departureTime: number,
    public arrivalTime: number,
    public backward: boolean,
    public trackData: TrackData,
    public sgPathNode: SgPathNode,
    public endNode: boolean,
    public departurePathSection: SgTrainrunSection = undefined,
    public arrivalPathSection: SgTrainrunSection = undefined,
    public unusedForTurnaround: boolean = false,
    public isTurnaround: boolean = false,
    public unrollOnlyEvenFrequencyOffsets = 0,
    public maxUnrollOnlyEvenFrequencyOffsets = 0,
    public extraTrains = false,
    public minimumHeadwayTime = 2,
  ) {
    this.id = SgTrainrunNode.currentId;
    SgTrainrunNode.currentId++;
  }

  public trackReservations: SgTrainrunNodeTrackReservation[] = [];

  getTrackReservation(offset: number): SgTrainrunNodeTrackReservation {
    return this.trackReservations.find((reservation) => reservation.offset === offset);
  }

  static copy(item: SgTrainrunNode): SgTrainrunNode {
    const copy = new SgTrainrunNode(
      item.index,
      item.nodeId,
      item.nodeShortName,
      item.trainrunId,
      item.departureTime,
      item.arrivalTime,
      item.backward,
      new TrackData(
        item.trackData.track,
        item.trackData.nodeId1,
        item.trackData.nodeId2,
        item.trackData.sectionTrackSegments,
      ),
      item.sgPathNode,
      item.endNode,
      item.departurePathSection,
      item.arrivalPathSection,
      item.unusedForTurnaround,
      item.isTurnaround,
      item.unrollOnlyEvenFrequencyOffsets,
      item.maxUnrollOnlyEvenFrequencyOffsets,
      item.extraTrains,
      item.minimumHeadwayTime,
    );
    copy.trackReservations = item.trackReservations.map((reservation) => ({...reservation}));
    return copy;
  }

  getId(): number {
    return this.id;
  }

  getTrainrunNode(): SgTrainrunNode {
    return this;
  }

  getTrainrunSection(): SgTrainrunSection {
    return undefined;
  }

  getPathNode(): SgPathNode {
    return this.sgPathNode;
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

  getStartposition(): number {
    return this.sgPathNode.startPosition;
  }

  isEndNode(): boolean {
    return this.endNode;
  }

  setMinimumHeadwayTime(headway: number) {
    this.minimumHeadwayTime = headway;
  }

  getMinimumHeadwayTime(): number {
    return this.minimumHeadwayTime;
  }

  checkUnrollAllowed(offset: number): boolean {
    if (this.maxUnrollOnlyEvenFrequencyOffsets < 1) {
      return true;
    }
    if (
      (offset + Math.abs(Math.floor(Math.min(0, offset) / 24) * 24)) %
        (this.maxUnrollOnlyEvenFrequencyOffsets + 1) ===
      this.unrollOnlyEvenFrequencyOffsets
    ) {
      return true;
    }
    return false;
  }

  changeOrientation(): void {}
}
