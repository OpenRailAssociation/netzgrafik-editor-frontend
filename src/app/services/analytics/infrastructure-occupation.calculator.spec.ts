import {Node} from "../../models/node.model";
import {Resource} from "../../models/resource.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {calculateInfrastructureOccupation} from "./infrastructure-occupation.calculator";

describe("calculateInfrastructureOccupation", () => {
  it("allocates overlapping node occupations to the minimum number of conflict-free tracks", () => {
    const firstTransition = {getId: () => 1, getIsNonStopTransit: () => false};
    const secondTransition = {getId: () => 2, getIsNonStopTransit: () => false};
    const node = {
      getId: () => 10,
      getResourceId: () => 20,
      getTransitions: () => [firstTransition, secondTransition],
      getTrainrunSections: (transitionId: number) =>
        transitionId === 1
          ? {trainrunSection1: section(1, 5, 40), trainrunSection2: section(2, 20, 10)}
          : {trainrunSection1: section(3, 8, 45), trainrunSection2: section(4, 20, 12)},
      getArrivalConsecutiveTime: (trainrunSection: TrainrunSection) =>
        (trainrunSection as unknown as {arrivalMinute: number}).arrivalMinute,
      getDepartureConsecutiveTime: (trainrunSection: TrainrunSection) =>
        (trainrunSection as unknown as {departureMinute: number}).departureMinute,
      getNextTrainrunSection: () => ({}) as TrainrunSection,
      getTrainrunCategoryHaltezeit: () => ({}),
    } as unknown as Node;

    const occupation = calculateInfrastructureOccupation(
      [node],
      [],
      [new Resource({id: 20, capacity: 1})],
    );
    const nodeOccupation = occupation.nodeOccupations.get(10)!;

    expect(nodeOccupation.maximumRequiredTrackCount).toBe(2);
    expect(nodeOccupation.capacityExceeded).toBeTrue();
    expect(nodeOccupation.reservations.map((reservation) => reservation.trackNumber)).toEqual([1, 2]);
    expect(nodeOccupation.reservations.map((reservation) => reservation.exceedsCapacity)).toEqual([
      false,
      true,
    ]);
  });
});

function section(id: number, arrivalMinute: number, departureMinute: number): TrainrunSection {
  const trainrun = {
    isRoundTrip: () => false,
    getTrainrunCategory: () => ({nodeHeadwayStop: 2, nodeHeadwayNonStop: 1}),
  };
  return {
    arrivalMinute,
    departureMinute,
    getId: () => id,
    getFrequency: () => 60,
    getTrainrun: () => trainrun,
  } as unknown as TrainrunSection;
}