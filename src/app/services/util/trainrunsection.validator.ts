import {TrainrunSection} from "../../models/trainrunsection.model";
import {MathUtils} from "../../utils/math";

export class TrainrunSectionValidator {
  static validateOneSection(trainrunSection: TrainrunSection) {
    trainrunSection.resetSourceDepartureWarning();
    trainrunSection.resetTargetDepartureWarning();

    TrainrunSectionValidator.validateTravelTimeOneSection(trainrunSection);
    TrainrunSectionValidator.validateUnsymmetricTimesOneSection(trainrunSection);
  }

  static validateTravelTimeOneSection(trainrunSection: TrainrunSection) {
    const calculatedTargetArrivalTime =
      (trainrunSection.getSourceDeparture() + trainrunSection.getTravelTime()) % 60;
    if (Math.abs(calculatedTargetArrivalTime - trainrunSection.getTargetArrival()) > 1 / 60) {
      trainrunSection.setTargetArrivalWarning(
        $localize`:@@app.services.util.trainrunsection-validator.target-arrival-not-reacheable.title:Target Arrival Warning`,
        $localize`:@@app.services.util.trainrunsection-validator.target-arrival-not-reacheable.description:Target arrival time cannot be reached`,
      );
    } else {
      trainrunSection.resetTargetArrivalWarning();
    }

    const calculatedSourceArrivalTime =
      (trainrunSection.getTargetDeparture() + trainrunSection.getTravelTime()) % 60;
    if (Math.abs(calculatedSourceArrivalTime - trainrunSection.getSourceArrival()) > 1 / 60) {
      trainrunSection.setSourceArrivalWarning(
        $localize`:@@app.services.util.trainrunsection-validator.source-arrival-not-reacheable.title:Source Arrival Warning`,
        $localize`:@@app.services.util.trainrunsection-validator.source-arrival-not-reacheable.description:Source arrival time cannot be reached`,
      );
    } else {
      trainrunSection.resetSourceArrivalWarning();
    }
  }

  static validateUnsymmetricTimesOneSection(trainrunSection: TrainrunSection) {
    // check for broken symmetry (times)
    trainrunSection.resetSourceDepartureWarning();
    trainrunSection.resetTargetDepartureWarning();
    const sourceSum = MathUtils.round(
      trainrunSection.getSourceArrival() + trainrunSection.getSourceDeparture(),
      4,
    );
    const sourceSymmetricCheck = Math.abs(sourceSum % 60) < 1 / 60;
    if (!sourceSymmetricCheck) {
      trainrunSection.setSourceArrivalWarning(
        $localize`:@@app.services.util.trainrunsection-validator.broken-symmetry:Broken symmetry`,
        "" +
          (trainrunSection.getSourceArrival() + " + " + trainrunSection.getSourceDeparture()) +
          " = " +
          sourceSum,
      );
      trainrunSection.setSourceDepartureWarning(
        $localize`:@@app.services.util.trainrunsection-validator.broken-symmetry:Broken symmetry`,
        "" +
          (trainrunSection.getSourceArrival() + " + " + trainrunSection.getSourceDeparture()) +
          " = " +
          sourceSum,
      );
    }
    const targetSum = MathUtils.round(
      trainrunSection.getTargetArrival() + trainrunSection.getTargetDeparture(),
      4,
    );
    const targetSymmetricCheck = Math.abs(targetSum % 60) < 1 / 60;
    if (!targetSymmetricCheck) {
      trainrunSection.setTargetArrivalWarning(
        $localize`:@@app.services.util.trainrunsection-validator.broken-symmetry:Broken symmetry`,
        "" +
          (trainrunSection.getTargetArrival() + " + " + trainrunSection.getTargetDeparture()) +
          " = " +
          targetSum,
      );
      trainrunSection.setTargetDepartureWarning(
        $localize`:@@app.services.util.trainrunsection-validator.broken-symmetry:Broken symmetry`,
        "" +
          (trainrunSection.getTargetArrival() + " + " + trainrunSection.getTargetDeparture()) +
          " =  " +
          targetSum,
      );
    }
  }

  static validateTravelTime(trainrunSection: TrainrunSection, timeDisplayPrecision: number = 1) {
    const minimumTravelTime = 1 / Math.pow(10, timeDisplayPrecision);
    if (trainrunSection.getTravelTime() < minimumTravelTime) {
      trainrunSection.setTravelTimeWarning(
        $localize`:@@app.services.util.trainrunsection-validator.travel-time-less-than-1.title:Travel Time less than ${minimumTravelTime}:minimumTravelTime:`,
        $localize`:@@app.services.util.trainrunsection-validator.travel-time-less-than-1.description:Travel time must be greater than or equal to ${minimumTravelTime}:minimumTravelTime:`,
      );
    } else {
      trainrunSection.resetTravelTimeWarning();
    }
  }
}
