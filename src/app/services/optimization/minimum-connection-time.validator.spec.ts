import {isMinimumConnectionTimeSatisfied} from "./minimum-connection-time.validator";

describe("isMinimumConnectionTimeSatisfied", () => {
  it("rejects an already-too-short baseline wait", () => {
    expect(isMinimumConnectionTimeSatisfied(2, 0, 0, 5)).toBeFalse();
  });

  it("accepts a transfer exactly at the configured minimum", () => {
    expect(isMinimumConnectionTimeSatisfied(2, 0, 3, 5)).toBeTrue();
  });

  it("rejects a proposal that shortens a valid transfer below the minimum", () => {
    expect(isMinimumConnectionTimeSatisfied(7, 0, -3, 5)).toBeFalse();
  });

  it("does not impose a hard upper bound on the waiting time", () => {
    expect(isMinimumConnectionTimeSatisfied(10, 0, 20, 5)).toBeTrue();
  });
});
