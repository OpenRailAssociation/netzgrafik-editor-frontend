import {PerlenketteItem} from "./perlenketteItem";
import {Direction, TrainrunTimeCategory} from "../../data-structures/business.data.structures";

export class PerlenketteTrainrun {
  constructor(
    readonly trainrunId: number,
    readonly frequency: number,
    readonly frequencyOffset: number,
    readonly trainrunTimeCategory: TrainrunTimeCategory,
    readonly title: string,
    readonly categoryShortName: string,
    readonly colorRef: string,
    readonly pathItems: PerlenketteItem[] = [],
    readonly direction: Direction,
  ) {}
}
