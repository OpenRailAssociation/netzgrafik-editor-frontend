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
    public minimumHeadwayTime = 2,
  ) {
    this.id = SgTrainrunNode.currentId;
    SgTrainrunNode.currentId++;
  }

  public trackReservations: SgTrainrunNodeTrackReservation[] = [];

  getTrackReservations(
    offset: number,
    trainrunId: number = this.trainrunId,
  ): SgTrainrunNodeTrackReservation[] {
    return this.trackReservations.filter(
      (reservation) =>
        reservation.trainrunId === trainrunId && Math.abs(reservation.offset - offset) < 0.001,
    );
  }

  getTrackReservation(
    offset: number,
    trainrunId: number = this.trainrunId,
  ): SgTrainrunNodeTrackReservation {
    const matchingReservations = this.getTrackReservations(offset, trainrunId);
    if (matchingReservations.length <= 1) {
      return matchingReservations[0];
    }
    const sectionIds = [
      this.arrivalPathSection?.trainrunSectionId,
      this.departurePathSection?.trainrunSectionId,
    ].filter((sectionId): sectionId is number => sectionId !== undefined);
    return (
      matchingReservations.find((reservation) =>
        [reservation.arrivalSectionId, reservation.departureSectionId].some(
          (sectionId) => sectionId !== undefined && sectionIds.includes(sectionId),
        ),
      ) ?? matchingReservations[0]
    );
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

  changeOrientation(): void {}
}
