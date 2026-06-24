import {Injectable} from "@angular/core";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {PortAlignment} from "../../data-structures/technical.data.structures";

const FONT = "16px Arial";
const MARGIN_CONSTANT = 100;
const MULTIPLICATION_FACTOR_DUE_TO_ALIGNMENT = 1.9;

@Injectable({
  providedIn: "root",
})
export class TrainrunDistanceService {
  private canvas: OffscreenCanvas;

  constructor() {
    this.canvas = new OffscreenCanvas(1, 1);
    this.canvas.getContext("2d").font = FONT;
  }

  public getMinSectionLengthInPx(trainrunSection: TrainrunSection) {
    const isVertical = this.calculateIfPortIsVertical(trainrunSection);
    const textWidth = this.trainrunSectionNameLength(trainrunSection, isVertical);
    return textWidth * MULTIPLICATION_FACTOR_DUE_TO_ALIGNMENT + MARGIN_CONSTANT;
  }

  private calculateIfPortIsVertical(trainrunSection: TrainrunSection) {
    // both ports have the same position alignment, so we can just check the source port
    const sourcePort = trainrunSection
      .getSourceNode()
      .getPorts()
      .find((port) => port.getTrainrunSectionId() === trainrunSection.getId());

    return (
      sourcePort.getPositionAlignment() === PortAlignment.Bottom ||
      sourcePort.getPositionAlignment() === PortAlignment.Top
    );
  }

  private trainrunSectionNameLength(trainrunSection: TrainrunSection, isVertical: boolean) {
    let value =
      trainrunSection.getTrainrun().getCategoryShortName() +
      trainrunSection.getTrainrun().getTitle();
    let length = 0;

    const isSourceNonStop = trainrunSection.getSourceNode().isNonStop(trainrunSection);
    const isTargetNonStop = trainrunSection.getTargetNode().isNonStop(trainrunSection);

    value += "'" + trainrunSection.getTravelTime().toString();
    if (isVertical) {
      const height = this.measureTextHeight("09");
      length += height + (isTargetNonStop ? 0 : height);
    } else {
      value +=
        trainrunSection.getSourceDeparture().toString() +
        (isTargetNonStop ? "" : trainrunSection.getTargetArrival().toString());
    }

    if (isSourceNonStop || isTargetNonStop) {
      value += "()";
    }

    if (isSourceNonStop && !isTargetNonStop) {
      value += "(" + this.calculateTravelTime(trainrunSection).toString() + ")";
    }

    return this.measureTextWidth(value) + length;
  }

  private calculateTravelTime(trainrunSection: TrainrunSection): number {
    if (!trainrunSection) {
      return 0;
    }

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

  private measureTextWidth(text: string): number {
    const ctx = this.canvas.getContext("2d");
    return ctx.measureText(text).width;
  }

  private measureTextHeight(text: string): number {
    const ctx = this.canvas.getContext("2d");
    const metrics = ctx.measureText(text);

    const actualHeight =
      (metrics.actualBoundingBoxAscent ?? 0) + (metrics.actualBoundingBoxDescent ?? 0);
    if (actualHeight > 0) {
      return actualHeight;
    }

    const fontHeight = (metrics.fontBoundingBoxAscent ?? 0) + (metrics.fontBoundingBoxDescent ?? 0);
    if (fontHeight > 0) {
      return fontHeight;
    }

    const fontSize = Number.parseFloat(FONT);
    return Number.isFinite(fontSize) ? fontSize : 16;
  }
}
