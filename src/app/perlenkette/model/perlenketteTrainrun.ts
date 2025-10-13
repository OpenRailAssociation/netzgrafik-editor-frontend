import {PerlenketteItem} from "./perlenketteItem";
import {Direction, TrainrunTimeCategory} from "../../data-structures/business.data.structures";

export class PerlenketteTrainrun {
  constructor(
    public trainrunId: number,
    public frequency: number,
    public frequencyOffset: number,
    public trainrunTimeCategory: TrainrunTimeCategory,
    public title: string,
    public categoryShortName: string,
    public colorRef: string,
    public pathItems: PerlenketteItem[] = [],
    public direction: Direction,
  ) {}
}
