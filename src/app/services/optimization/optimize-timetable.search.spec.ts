import {getLocalStepCandidates, orderConflictVariables} from "./optimize-timetable.search";

describe("orderConflictVariables", () => {
  it("keeps every affected chain and rotates the starting candidate", () => {
    expect(orderConflictVariables([4, 2, 7, 2], 1)).toEqual([2, 7, 4]);
  });
});

describe("getLocalStepCandidates", () => {
  it("orders both departure-shift directions by increasing minute distance", () => {
    expect(getLocalStepCandidates(0, 3)).toEqual([[-1, 1], [-2, 2], [-3, 3]]);
  });

  it("keeps moves inside the variable domain when stepping back toward baseline", () => {
    expect(getLocalStepCandidates(2, 2)).toEqual([[1], [0], [-1], [-2]]);
  });
});