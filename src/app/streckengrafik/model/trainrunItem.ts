import {Direction} from "src/app/data-structures/business.data.structures";
import {PathItem} from "./pathItem";

export class TrainrunItem {
  constructor(
    public trainrunId: number,
    public frequency: number,
    public frequencyOffset: number,
    public startTime: number,
    public endTime: number,
    public title: string,
    public categoryShortName: string,
    public colorRef: string,
    public pathItems: PathItem[],
    public direction: Direction,
  ) {}

  equal(trainrunItem: TrainrunItem) {
    if (this === trainrunItem) {
      return true;
    }
    return (
      this.trainrunId === trainrunItem.trainrunId &&
      this.frequency === trainrunItem.frequency &&
      this.frequencyOffset === trainrunItem.frequencyOffset &&
      this.startTime === trainrunItem.startTime &&
      this.endTime === trainrunItem.endTime &&
      this.title === trainrunItem.title &&
      this.categoryShortName === trainrunItem.categoryShortName &&
      this.colorRef === trainrunItem.colorRef &&
      this.equalPathItem(this.pathItems, trainrunItem.pathItems) &&
      this.direction === trainrunItem.direction
    );
  }

  private equalPathItem(pathItems: PathItem[], pathItems2: PathItem[]) {
    if (pathItems === pathItems2) {
      return true;
    }
    if (pathItems.length !== pathItems2.length) {
      return false;
    }
    let equal = true;
    this.pathItems.forEach((pathItem1) => {
      let equal2 = false;
      pathItems2.forEach((pathItems2) => {
        if (pathItem1.equal(pathItems2)) {
          equal2 = true;
        }
      });
      if (!equal2) {
        equal = false;
      }
    });
    return equal;
  }

  static equalTrainrunItems(trainrunItems1: TrainrunItem[], trainrunItems2: TrainrunItem[]) {
    if (trainrunItems1 === undefined) {
      return true;
    }
    if (trainrunItems2 === undefined) {
      return true;
    }
    if (trainrunItems1 === trainrunItems2) {
      return true;
    }
    if (trainrunItems1.length !== trainrunItems2.length) {
      return false;
    }
    let equal1 = true;
    trainrunItems1.forEach((trainrunItem1) => {
      let equal2 = false;
      trainrunItems2.forEach((trainrunItem2) => {
        if (trainrunItem1.equal(trainrunItem2)) {
          equal2 = true;
        }
      });
      if (!equal2) {
        equal1 = false;
      }
    });
    return equal1;
  }
}
