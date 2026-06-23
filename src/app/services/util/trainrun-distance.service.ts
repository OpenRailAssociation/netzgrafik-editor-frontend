import {Injectable} from "@angular/core";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Node} from "../../models/node.model";
import {Vec2D} from "../../utils/vec2D";
import {PortAlignment} from "../../data-structures/technical.data.structures";

export interface GraphEdge {
  trainrunSection: TrainrunSection;
  source: Node;
  target: Node;
}

const ADDITION_DUE_TO_APOSTROPHE = 1;
const ADDITION_DUE_TO_PARENS = 2;
const VERTICAL_ADDITION = 2;

const TEXT_WIDTH_CONSTANT = 16;
const MARGIN_CONSTANT = 100;

@Injectable({
  providedIn: "root",
})
export class TrainrunDistanceService {
  constructor() {}

  public isEdgeTooShort(edge: GraphEdge) {
    const sourcePosition = edge.trainrunSection.getPath().at(0);
    const targetPosition = edge.trainrunSection.getPath().at(-1);

    const isVertical = this.calculateIfPortIsVertical(edge);

    const textWidth = this.trainrunSectionNameLength(edge.trainrunSection, isVertical);
    const distance = Vec2D.norm(Vec2D.sub(targetPosition, sourcePosition));
    const calculatedMinimumDistance = textWidth * TEXT_WIDTH_CONSTANT + MARGIN_CONSTANT;
    return calculatedMinimumDistance > distance;
  }

  private calculateIfPortIsVertical(edge: GraphEdge) {
    // both ports have the same position alignment, so we can just check the source port
    const sourcePort = edge.source
      .getPorts()
      .find((port) => port.getTrainrunSectionId() === edge.trainrunSection.getId());

    return (
      sourcePort.getPositionAlignment() === PortAlignment.Bottom ||
      sourcePort.getPositionAlignment() === PortAlignment.Top
    );
  }

  private trainrunSectionNameLength(trainrunSection: TrainrunSection, isVertical: boolean) {
    let length =
      trainrunSection.getTrainrun().getCategoryShortName().length +
      trainrunSection.getTrainrun().getTitle().length;

    const isSourceNonStop = trainrunSection.getSourceNode().isNonStop(trainrunSection);
    const isTargetNonStop = trainrunSection.getTargetNode().isNonStop(trainrunSection);

    length += trainrunSection.getTravelTime().toString().length + ADDITION_DUE_TO_APOSTROPHE;
    length += isVertical
      ? VERTICAL_ADDITION
      : trainrunSection.getSourceDeparture().toString().length;
    if (!isTargetNonStop) {
      length += isVertical
        ? VERTICAL_ADDITION
        : trainrunSection.getTargetArrival().toString().length;
    }

    if (isSourceNonStop || isTargetNonStop) {
      length += ADDITION_DUE_TO_PARENS;
    }

    if (isSourceNonStop && !isTargetNonStop) {
      length +=
        this.calculateTravelTime(trainrunSection).toString().length + ADDITION_DUE_TO_PARENS;
    }

    return length;
  }

  private calculateTravelTime(trainrunSection: TrainrunSection): number {
    const travelTime = trainrunSection.getTravelTime();
    if (!trainrunSection.getTargetNode().isNonStop(trainrunSection)) {
      return travelTime;
    }

    return (
      travelTime +
      this.calculateTravelTime(
        trainrunSection
          .getTargetNode()
          .getPorts()
          .filter(
            (port) =>
              port.getTrainrunSection().getTrainrunId() === trainrunSection.getTrainrunId() &&
              port.getId() !== trainrunSection.getTargetPortId(),
          )
          .map((port) => port.getTrainrunSection())
          .at(0),
      )
    );
  }
}
