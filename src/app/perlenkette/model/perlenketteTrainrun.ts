import {PerlenketteItem} from "./perlenketteItem";
import {PerlenketteNode} from "./perlenketteNode";
import {Direction, TrainrunTimeCategory} from "../../data-structures/business.data.structures";

function assertIsNode(item: PerlenketteItem): PerlenketteNode {
  if (!(item instanceof PerlenketteNode)) {
    throw TypeError(`expected PerlenketteNode, got ${item}`);
  }
  return item;
}

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

  /**
   * Get the first/start/top node of this perlenkette trainrun, if any.
   *
   * Equivalent to getting the first item of `pathItems` with the correct type.
   */
  getTopNode(): PerlenketteNode | undefined {
    const pathItem = this.pathItems.at(0);
    if (pathItem === undefined) {
      return undefined;
    }
    return assertIsNode(pathItem);
  }

  /**
   * Get the last/end/bottom node of this perlenkette trainrun, if any.
   *
   * Equivalent to getting the last item of `pathItems` with the correct type.
   */
  getBottomNode(): PerlenketteNode | undefined {
    const pathItem = this.pathItems.at(-1);
    if (pathItem === undefined) {
      return undefined;
    }
    return assertIsNode(pathItem);
  }
}
