import {
  PortAlignment,
  PortDto,
} from "../data-structures/technical.data.structures";
import {TrainrunSection} from "./trainrunsection.model";
import {Vec2D} from "../utils/vec2D";

export class Port {
  private static currentId = 0;

  private id: number;
  private trainrunSectionId: number;
  private positionIndex: number;
  private positionAlignment: number;

  private trainrunSection: TrainrunSection = null;

  constructor(
    {id, trainrunSectionId, positionIndex, positionAlignment}: PortDto = {
      id: Port.incrementId(),
      positionIndex: 0,
      positionAlignment: PortAlignment.Top,
      trainrunSectionId: 0,
    },
  ) {
    this.id = id;
    this.trainrunSectionId = trainrunSectionId;
    this.positionIndex = positionIndex;
    this.positionAlignment = positionAlignment;

    if (Port.currentId < this.id) {
      Port.currentId = this.id;
    }
  }

  private static incrementId(): number {
    return ++Port.currentId;
  }

  getId(): number {
    return this.id;
  }

  getPositionAlignment(): PortAlignment {
    return this.positionAlignment;
  }

  setPositionAlignment(positionAlignment: PortAlignment) {
    this.positionAlignment = positionAlignment;
  }

  getPositionIndex(): number {
    return this.positionIndex;
  }

  setPositionIndex(positionIndex: number) {
    this.positionIndex = positionIndex;
  }

  getTrainrunSectionId(): number {
    return this.trainrunSectionId;
  }

  setTrainrunSection(trainrunSection: TrainrunSection) {
    this.trainrunSectionId = trainrunSection.getId();
    this.trainrunSection = trainrunSection;
  }

  getTrainrunSection(): TrainrunSection {
    return this.trainrunSection;
  }

  getOppositeNodePosition(fromNodeId: number): Vec2D {
    if (this.getTrainrunSection().getSourceNodeId() === fromNodeId) {
      return new Vec2D(
        this.getTrainrunSection().getTargetNode().getPositionX(),
        this.getTrainrunSection().getTargetNode().getPositionY(),
      );
    } else {
      return new Vec2D(
        this.getTrainrunSection().getSourceNode().getPositionX(),
        this.getTrainrunSection().getSourceNode().getPositionY(),
      );
    }
  }

  getDto(): PortDto {
    return {
      id: this.id,
      trainrunSectionId: this.trainrunSectionId,
      positionIndex: this.positionIndex,
      positionAlignment: this.positionAlignment,
    };
  }
}
