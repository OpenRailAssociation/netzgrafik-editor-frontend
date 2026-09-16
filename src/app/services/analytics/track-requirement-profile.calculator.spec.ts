import {calculateTrackRequirementProfile} from "./track-requirement-profile.calculator";

describe("calculateTrackRequirementProfile", () => {
  it("creates a time-ordered profile and returns the maximum simultaneous track demand", () => {
    const profile = calculateTrackRequirementProfile([
      {startMinute: 5, endMinute: 15},
      {startMinute: 10, endMinute: 20},
      {startMinute: 10, endMinute: 12},
      {startMinute: 10, endMinute: 11},
    ]);

    expect(profile.maximumRequiredTrackCount).toBe(4);
    expect(profile.segments).toEqual([
      {startMinute: 0, endMinute: 5, requiredTrackCount: 0},
      {startMinute: 5, endMinute: 10, requiredTrackCount: 1},
      {startMinute: 10, endMinute: 12, requiredTrackCount: 4},
      {startMinute: 12, endMinute: 13, requiredTrackCount: 3},
      {startMinute: 13, endMinute: 16, requiredTrackCount: 2},
      {startMinute: 16, endMinute: 21, requiredTrackCount: 1},
      {startMinute: 21, endMinute: 60, requiredTrackCount: 0},
    ]);
  });

  it("calculates capacity utilization only when a positive capacity is available", () => {
    const profile = calculateTrackRequirementProfile(
      [
        {startMinute: 10, endMinute: 20},
        {startMinute: 10, endMinute: 20},
      ],
      1,
    );

    expect(profile.utilizationPercent).toBe(200);
    expect(profile.capacityStatus).toBe("overloaded");
  });

  it("handles intervals that continue over the hour boundary", () => {
    const profile = calculateTrackRequirementProfile([{startMinute: 58, endMinute: 62}]);

    expect(profile.maximumRequiredTrackCount).toBe(1);
    expect(profile.segments).toEqual([
      {startMinute: 0, endMinute: 3, requiredTrackCount: 1},
      {startMinute: 3, endMinute: 58, requiredTrackCount: 0},
      {startMinute: 58, endMinute: 60, requiredTrackCount: 1},
    ]);
  });
});