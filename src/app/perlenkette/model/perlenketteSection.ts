import {PerlenketteItem} from "./perlenketteItem";
import {PerlenketteNode} from "./perlenketteNode";
import {Node} from "../../models/node.model";
import {TrainrunSectionService} from "src/app/services/data/trainrunsection.service";
import {TrainrunSection} from "src/app/models/trainrunsection.model";

export class PerlenketteSection implements PerlenketteItem {
  constructor(
    public trainrunSectionId: number,
    public travelTime: number,
    public fromNode: Node,
    public toNode: Node,
    public numberOfStops: number,
    public isBeingEdited: boolean = false,
    public fristTrainrunPartSection: boolean = false,
    public lastTrainrunPartSection: boolean = false,
    private trainrunSectionService: TrainrunSectionService,
  ) {
  }

  isFristTrainrunPartSection(): boolean {
    return this.fristTrainrunPartSection;
  }

  isLastTrainrunPartSection(): boolean {
    return this.lastTrainrunPartSection;
  }

  setLastTrainrunPartSection(flag: boolean) {
    this.lastTrainrunPartSection = flag;
  }

  isPerlenketteNode(): boolean {
    return false;
  }

  getPerlenketteNode(): PerlenketteNode {
    return undefined;
  }

  isPerlenketteSection(): boolean {
    return true;
  }

  getPerlenketteSection(): PerlenketteSection {
    return this;
  }
}
