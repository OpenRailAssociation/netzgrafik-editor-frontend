import {Component, Input} from "@angular/core";
import {TrainDataService} from "../../services/train-data-service";
import {SHOW_MAX_SINGLE_TRAINRUN_SECTIONS_STOPS} from "../../../view/rastering/definitions";
import {Vec2D} from "../../../utils/vec2D";
import {SgTrainrun} from "../../model/streckengrafik-model/sg-trainrun";
import {SgTrainrunItem} from "../../model/streckengrafik-model/sg-trainrun-item";
import {ScaledPath} from "../train-run-section/train-run-section.component";

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: "[sbb-train-run-section-stops-component]",
  templateUrl: "./train-run-section-stops-component.component.html",
  styleUrls: ["./train-run-section-stops-component.component.scss"],
})
export class TrainRunSectionStopsComponentComponent {
  @Input()
  scaledPath: ScaledPath;

  @Input()
  trainrun: SgTrainrun;

  @Input()
  trainrunItem: SgTrainrunItem;

  @Input()
  freqOffset: number;

  constructor(private readonly trainDataService: TrainDataService) {}

  checkIsCollapsedStops(): boolean {
    if (this.trainrunItem.isSection()) {
      const ps = this.trainrunItem.getTrainrunSection();
      return !(ps.numberOfStops <= SHOW_MAX_SINGLE_TRAINRUN_SECTIONS_STOPS);
    }
    return false;
  }

  getNumberOfStops(): string {
    if (this.trainrunItem.isSection()) {
      const ps = this.trainrunItem.getTrainrunSection();
      return "" + ps.numberOfStops;
    }
    return "";
  }

  getClassTag(tag: string): string {
    let retTag = tag;
    retTag += " ColorRef_" + this.trainrun.colorRef;
    retTag += " " + this.trainDataService.createColoringClassTags(this.trainrun.trainrunId);

    if (!this.trainrunItem.isSection()) {
      return retTag;
    }
    const ps = this.trainrunItem.getTrainrunSection();
    if (ps.numberOfStops <= SHOW_MAX_SINGLE_TRAINRUN_SECTIONS_STOPS) {
      retTag += " fill ";
    }
    return retTag;
  }

  hasStopElements(): boolean {
    if (!this.trainrunItem.isSection()) {
      return false;
    }
    const ps = this.trainrunItem.getTrainrunSection();
    return ps.numberOfStops > 0;
  }

  getStopElements(): Vec2D[] {
    if (!this.trainrunItem.isSection()) {
      return [];
    }
    const ps = this.trainrunItem.getTrainrunSection();
    const numberOfStops = ps.numberOfStops;
    if (numberOfStops === 0) {
      return [];
    }
    const scaledPathTo = this.scaledPath.scaledPathTo;
    let startPosition = this.scaledPath.scaledPathFrom;

    let lineOrientationVector = Vec2D.sub(scaledPathTo, startPosition);
    const maxNumberOfStops = Math.min(
      SHOW_MAX_SINGLE_TRAINRUN_SECTIONS_STOPS,
      Vec2D.norm(lineOrientationVector) / 20,
    );
    const maxWidth = 16 * SHOW_MAX_SINGLE_TRAINRUN_SECTIONS_STOPS;

    if (Vec2D.norm(lineOrientationVector) > maxWidth) {
      const step = (Vec2D.norm(lineOrientationVector) - maxWidth) / 2.0;
      lineOrientationVector = Vec2D.scale(Vec2D.normalize(lineOrientationVector), maxWidth);
      startPosition = Vec2D.add(
        startPosition,
        Vec2D.scale(Vec2D.normalize(lineOrientationVector), step),
      );
    }

    const retValue: Vec2D[] = [];
    if (numberOfStops <= maxNumberOfStops) {
      for (let stopIndex = 0; stopIndex < numberOfStops; stopIndex++) {
        const position = Vec2D.add(
          startPosition,
          Vec2D.scale(lineOrientationVector, (stopIndex + 1.0) / (numberOfStops + 1.0)),
        );
        retValue.push(position);
      }
    } else {
      retValue.push(
        Vec2D.scale(Vec2D.add(this.scaledPath.scaledPathTo, this.scaledPath.scaledPathFrom), 0.5),
      );
    }

    return retValue;
  }
}
