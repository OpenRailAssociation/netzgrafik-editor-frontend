import {TrainrunSection} from "../../models/trainrunsection.model";
import {calculateSectionTrackRequirements} from "./section-track-requirement.calculator";

describe("calculateSectionTrackRequirements", () => {
  it("requires two tracks over a complete section for simultaneous trains", () => {
    const requirements = calculateSectionTrackRequirements([
      section(1, 2, 8, 0, 10),
      section(1, 2, 8, 0, 10),
    ]);

    expect(requirements).toEqual([
      {sourceNodeId: 1, targetNodeId: 2, resourceId: 8, trackSegments: [[0, 1, 2]]},
    ]);
  });

  it("uses the train frequency to include subsequent instances in the demand", () => {
    const requirements = calculateSectionTrackRequirements([section(2, 1, 9, 10, 20, 5, 30)]);

    expect(requirements[0].trackSegments).toEqual([[0, 1, 1]]);
  });

  it("counts opposing trains with section headway on the same physical track cells", () => {
    const requirements = calculateSectionTrackRequirements([
      section(1, 2, 8, 0, 10, 2),
      section(2, 1, 8, 0, 10, 2),
    ]);

    expect(requirements[0].trackSegments).toEqual([
      [0, 0.4, 1],
      [0.4, 0.6, 2],
      [0.6, 1, 1],
    ]);
  });
});

function section(
  sourceNodeId: number,
  targetNodeId: number,
  resourceId: number,
  departureMinute: number,
  arrivalMinute: number,
  sectionHeadway = 2,
  frequency = 60,
): TrainrunSection {
  const trainrun = {
    isRoundTrip: () => false,
    getTrainrunCategory: () => ({sectionHeadway}),
  };
  return {
    getResourceId: () => resourceId,
    getSourceNodeId: () => sourceNodeId,
    getTargetNodeId: () => targetNodeId,
    getSourceDepartureConsecutiveTime: () => departureMinute,
    getTargetArrivalConsecutiveTime: () => arrivalMinute,
    getTargetDepartureConsecutiveTime: () => arrivalMinute,
    getSourceArrivalConsecutiveTime: () => departureMinute,
    getFrequency: () => frequency,
    getTrainrun: () => trainrun,
  } as unknown as TrainrunSection;
}