import {Node} from "../../models/node.model";

export class TransitionValidator {
  static validateTransition(node: Node, transitionId: number) {
    const trainrunSections = node.getTrainrunSections(transitionId);
    const sourceSection = trainrunSections.trainrunSection1;
    const targetSection = trainrunSections.trainrunSection2;

    if (!node.getIsNonStop(transitionId)) {
      const arrivalTime1 = node.getArrivalTime(sourceSection);
      const departureTime1 = node.getDepartureTime(sourceSection);

      const arrivalTime2 = node.getArrivalTime(targetSection);
      const departureTime2 = node.getDepartureTime(targetSection);

      const nodeHaltezeiten = node.getTrainrunCategoryHaltezeit();
      const trainrunHaltezeit =
        nodeHaltezeiten[sourceSection.getTrainrun().getTrainrunCategory().fachCategory].haltezeit;

      const calculatedDepartureTime2 = (arrivalTime1 + trainrunHaltezeit) % 60;
      const calculatedDepartureTime1 = (arrivalTime2 + trainrunHaltezeit) % 60;

      // Source -> Target check
      if (
        calculatedDepartureTime2 !== departureTime2 &&
        sourceSection.getTargetSymmetry() &&
        targetSection.getSourceSymmetry()
      ) {
        sourceSection.setTargetArrivalWarning(
          $localize`:@@app.services.util.transition-validator.target-arrival-not-reacheable.title:Target Arrival Warning`,
          $localize`:@@app.services.util.transition-validator.target-arrival-not-reacheable.description:Target arrival time cannot be reached`,
        );
        targetSection.setSourceDepartureWarning(
          $localize`:@@app.services.util.transition-validator.source-departure-not-reacheable.title:Source Departure Warning`,
          $localize`:@@app.services.util.transition-validator.source-departure-not-reacheable.description:Source departure time cannot be reached`,
        );
      } else {
        sourceSection.resetTargetArrivalWarning();
        targetSection.resetSourceDepartureWarning();
      }

      // Source <- Target check
      if (
        calculatedDepartureTime1 !== departureTime1 &&
        sourceSection.getTargetSymmetry() &&
        targetSection.getSourceSymmetry()
      ) {
        sourceSection.setTargetDepartureWarning(
          $localize`:@@app.services.util.transition-validator.target-departure-not-reacheable.title:Target Departure Warning`,
          $localize`:@@app.services.util.transition-validator.target-departure-not-reacheable.description:Target departure time cannot be reached`,
        );
        targetSection.setSourceArrivalWarning(
          $localize`:@@app.services.util.transition-validator.source-arrival-not-reacheable.title:Source Arrival Warning`,
          $localize`:@@app.services.util.transition-validator.source-arrival-not-reacheable.description:Source arrival time cannot be reached`,
        );
      } else {
        sourceSection.resetTargetDepartureWarning();
        targetSection.resetSourceArrivalWarning();
      }
    } else {
      // Source -> Target check
      const expectedSourceDeparture2 =
        (sourceSection.getSourceDeparture() + sourceSection.getTravelTime()) % 60;
      if (
        !targetSection.getSourceSymmetry() &&
        expectedSourceDeparture2 !== targetSection.getSourceDeparture()
      ) {
        targetSection.setSourceDepartureWarning(
          $localize`:@@app.services.util.transition-validator.source-departure-not-reacheable-asymmetry.title:Source Departure Warning`,
          $localize`:@@app.services.util.transition-validator.source-departure-not-reacheable-asymmetry.description:Source departure time cannot be reached due to asymmetrical travel times`,
        );
      }

      // Source <- Target check
      const expectedTargetDeparture1 =
        (targetSection.getTargetDeparture() + targetSection.getBackwardTravelTime()) % 60;
      if (
        !sourceSection.getTargetSymmetry() &&
        expectedTargetDeparture1 !== sourceSection.getTargetDeparture()
      ) {
        sourceSection.setTargetDepartureWarning(
          $localize`:@@app.services.util.transition-validator.target-departure-not-reacheable-asymmetry.title:Target Departure Warning`,
          $localize`:@@app.services.util.transition-validator.target-departure-not-reacheable-asymmetry.description:Target departure time cannot be reached due to asymmetrical travel times`,
        );
      }
    }
  }
}
