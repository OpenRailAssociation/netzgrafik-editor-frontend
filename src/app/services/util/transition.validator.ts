import {Node} from "../../models/node.model";

export class TransitionValidator {
  static validateTransition(node: Node, transitionId: number) {
    if (!node.getIsNonStop(transitionId)) {
      const trainrunSections = node.getTrainrunSections(transitionId);

      const arrivalTime1 = node.getArrivalTime(trainrunSections.trainrunSection1);
      const departureTime1 = node.getDepartureTime(trainrunSections.trainrunSection1);

      const arrivalTime2 = node.getArrivalTime(trainrunSections.trainrunSection2);
      const departureTime2 = node.getDepartureTime(trainrunSections.trainrunSection2);

      const nodeHaltezeiten = node.getTrainrunCategoryHaltezeit();
      const trainrunHaltezeit =
        nodeHaltezeiten[
          trainrunSections.trainrunSection1.getTrainrun().getTrainrunCategory().fachCategory
        ].haltezeit;

      const calculatedDepartureTime2 = (arrivalTime1 + trainrunHaltezeit) % 60;
      const calculatedDepartureTime1 = (arrivalTime2 + trainrunHaltezeit) % 60;
      if (
        calculatedDepartureTime2 !== departureTime2 ||
        calculatedDepartureTime1 !== departureTime1
      ) {
        if (trainrunSections.trainrunSection1.getSourceNodeId() === node.getId()) {
          trainrunSections.trainrunSection1.setSourceArrivalWarning(
            $localize`:@@app.services.util.transition-validator.source-arrival-not-reacheable.title:Source Arrival Warning`,
            $localize`:@@app.services.util.transition-validator.source-arrival-not-reacheable.description:Source arrival time cannot be reached`,
          );
          trainrunSections.trainrunSection1.setSourceDepartureWarning(
            $localize`:@@app.services.util.transition-validator.source-departure-not-reacheable.title:Source Departure Warning`,
            $localize`:@@app.services.util.transition-validator.source-departure-not-reacheable.description:Source departure time cannot be reached`,
          );
        } else {
          trainrunSections.trainrunSection1.setTargetArrivalWarning(
            $localize`:@@app.services.util.transition-validator.target-arrival-not-reacheable.title:Target Arrival Warning`,
            $localize`:@@app.services.util.transition-validator.target-arrival-not-reacheable.description:Target arrival time cannot be reached`,
          );
          trainrunSections.trainrunSection1.setTargetDepartureWarning(
            $localize`:@@app.services.util.transition-validator.target-departure-not-reacheable.title:Target Departure Warning`,
            $localize`:@@app.services.util.transition-validator.target-departure-not-reacheable.description:Target departure time cannot be reached`,
          );
        }
        if (trainrunSections.trainrunSection2.getSourceNodeId() === node.getId()) {
          trainrunSections.trainrunSection2.setSourceArrivalWarning(
            $localize`:@@app.services.util.transition-validator.source-arrival-not-reacheable.title:Source Arrival Warning`,
            $localize`:@@app.services.util.transition-validator.source-arrival-not-reacheable.description:Source arrival time cannot be reached`,
          );
          trainrunSections.trainrunSection2.setSourceDepartureWarning(
            $localize`:@@app.services.util.transition-validator.source-departure-not-reacheable.title:Source Departure Warning`,
            $localize`:@@app.services.util.transition-validator.source-departure-not-reacheable.description:Source departure time cannot be reached`,
          );
        } else {
          trainrunSections.trainrunSection2.setTargetArrivalWarning(
            $localize`:@@app.services.util.transition-validator.target-arrival-not-reacheable.title:Target Arrival Warning`,
            $localize`:@@app.services.util.transition-validator.target-arrival-not-reacheable.description:Target arrival time cannot be reached`,
          );
          trainrunSections.trainrunSection2.setTargetDepartureWarning(
            $localize`:@@app.services.util.transition-validator.target-departure-not-reacheable.title:Target Departure Warning`,
            $localize`:@@app.services.util.transition-validator.target-departure-not-reacheable.description:Target departure time cannot be reached`,
          );
        }
      } else {
        if (trainrunSections.trainrunSection1.getSourceNodeId() === node.getId()) {
          trainrunSections.trainrunSection1.resetSourceArrivalWarning();
          trainrunSections.trainrunSection1.resetSourceDepartureWarning();
        } else {
          trainrunSections.trainrunSection1.resetTargetArrivalWarning();
          trainrunSections.trainrunSection1.resetTargetDepartureWarning();
        }
        if (trainrunSections.trainrunSection2.getSourceNodeId() === node.getId()) {
          trainrunSections.trainrunSection2.resetSourceArrivalWarning();
          trainrunSections.trainrunSection2.resetSourceDepartureWarning();
        } else {
          trainrunSections.trainrunSection2.resetTargetArrivalWarning();
          trainrunSections.trainrunSection2.resetTargetDepartureWarning();
        }
      }
    }
  }
}
