import {TrainrunCategoryHaltezeit} from "../data-structures/business.data.structures";
import {Vec2D} from "../utils/vec2D";

export class BaseData {
  private stationCode: string;
  private haltezeiten: TrainrunCategoryHaltezeit;
  private bufferTime: number;
  private connectionTime: number; // aka Umsteigezeit
  private regions: string[];
  private labels: string[];
  private categories: string[];
  private position: Vec2D;
  private stationName: string;
  private create: number;

  constructor(
    stationCode: string,
    haltezeiten: TrainrunCategoryHaltezeit,
    bufferTime: number,
    connectionTime: number,
    regions: string[],
    labels: string[],
    categories: string[],
    stationName: string,
    position: Vec2D,
    create: number,
  ) {
    this.stationCode = stationCode;
    this.haltezeiten = haltezeiten;
    this.bufferTime = bufferTime;
    this.connectionTime = connectionTime;
    this.regions = regions;
    this.labels = labels;
    this.categories = categories;
    this.position = position;
    this.stationName = stationName;
    this.create = create;
  }

  getStationName(): string {
    return this.stationName;
  }

  getCreate(): number {
    return this.create;
  }

  getPosition(): Vec2D {
    return this.position;
  }

  getCategories(): string[] {
    return this.categories;
  }

  getLabels(): string[] {
    return this.labels;
  }

  getRegions(): string[] {
    return this.regions;
  }

  getStationCode(): string {
    return this.stationCode;
  }

  getHaltezeiten(): TrainrunCategoryHaltezeit {
    return this.haltezeiten;
  }

  getBufferTime(): number {
    return this.bufferTime;
  }

  getConnectionTime(): number {
    return this.connectionTime;
  }
}
