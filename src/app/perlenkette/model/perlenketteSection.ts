import {Node} from "../../models/node.model";

export class PerlenketteSection {
  constructor(
    /** Trainrun section IDs, ordered starting at fromNode and ending at toNode */
    readonly trainrunSectionIds: number[],
    readonly travelTime: number,
    readonly fromNode: Node,
    readonly toNode: Node,
    readonly numberOfStops: number,
    public isBeingEdited: boolean = false,
    public firstTrainrunPartSection: boolean = false,
    public lastTrainrunPartSection: boolean = false,
  ) {}

  isFirstTrainrunPartSection(): boolean {
    return this.firstTrainrunPartSection;
  }

  isLastTrainrunPartSection(): boolean {
    return this.lastTrainrunPartSection;
  }

  setLastTrainrunPartSection(flag: boolean) {
    this.lastTrainrunPartSection = flag;
  }
}
