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
    // Source -> Target
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

    // Source <- Target
    const travelTime = trainrunSection.isSymmetric()
      ? trainrunSection.getTravelTime()
      : trainrunSection.getBackwardTravelTime();
    const calculatedSourceArrivalTime = (trainrunSection.getTargetDeparture() + travelTime) % 60;
    if (Math.abs(calculatedSourceArrivalTime - trainrunSection.getSourceArrival()) > 1 / 60) {
      trainrunSection.setSourceArrivalWarning(
        $localize`:@@app.services.util.trainrunsection-validator.source-arrival-not-reacheable.title:Source Arrival Warning`,
        $localize`:@@app.services.util.trainrunsection-validator.source-arrival-not-reacheable.description:Source arrival time cannot be reached`,
      );
    } else {
      trainrunSection.resetSourceArrivalWarning();
    }

    // Non-stop time propagation with asymmetric times in the non-stop sections chain (Source <- Target context)
    if (
      trainrunSection.isSymmetric() &&
      trainrunSection.getTravelTime() !== trainrunSection.getBackwardTravelTime()
    ) {
      trainrunSection.setTravelTimeWarning(
        $localize`:@@app.services.util.trainrunsection-validator.travel-times-not-equal.title:Travel Times not equal`,
        $localize`:@@app.services.util.trainrunsection-validator.travel-times-not-equal.description:Travel times are not compatible with return trip time schedules` +
          " (" +
          trainrunSection.getTargetDeparture() +
          " + " +
          trainrunSection.getTravelTime() +
          " != " +
          trainrunSection.getSourceArrival() +
          ")",
      );
    } else {
      trainrunSection.resetTravelTimeWarning();
    }
  }

  static validateUnsymmetricTimesOneSection(trainrunSection: TrainrunSection) {
    if (!trainrunSection.isSymmetric()) {
      return;
    }
    // check for broken symmetry (times)
    trainrunSection.resetSourceDepartureWarning();
    trainrunSection.resetTargetDepartureWarning();
    const sourceSum = MathUtils.round(
      trainrunSection.getSourceArrival() + trainrunSection.getSourceDeparture(),
      4,
    );
    const sourceSymmetricCheck = Math.abs(sourceSum % 60) < 1 / 60;
    if (
      !sourceSymmetricCheck &&
      trainrunSection.getSourceNode() &&
      !trainrunSection.getSourceNode().isNonStop(trainrunSection)
    ) {
      // display warning only if the target node is a stopping node
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
    if (
      !targetSymmetricCheck &&
      trainrunSection.getTargetNode() &&
      !trainrunSection.getTargetNode().isNonStop(trainrunSection)
    ) {
      // display warning only if the target node is a stopping node
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

  static validateTravelTime(trainrunSection: TrainrunSection) {
    if (trainrunSection.getTravelTime() < 1) {
      trainrunSection.setTravelTimeWarning(
        $localize`:@@app.services.util.trainrunsection-validator.travel-time-less-than-1.title:Travel Time less than 1`,
        $localize`:@@app.services.util.trainrunsection-validator.travel-time-less-than-1.description:Travel time must be greater than or equal to 1`,
      );
    } else {
      trainrunSection.resetTravelTimeWarning();
    }
  }

  static validateBackwardTravelTime(trainrunSection: TrainrunSection) {
    if (trainrunSection.getBackwardTravelTime() < 1) {
      trainrunSection.setBackwardTravelTimeWarning(
        $localize`:@@app.services.util.trainrunsection-validator.travel-time-less-than-1.title:Travel Time less than 1`,
        $localize`:@@app.services.util.trainrunsection-validator.travel-time-less-than-1.description:Travel time must be greater than or equal to 1`,
      );
    } else {
      trainrunSection.resetBackwardTravelTimeWarning();
    }
  }
}
