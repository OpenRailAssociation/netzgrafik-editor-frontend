import {createDefaultOptimizationPolicy, getObjectiveWeights} from "./optimization-policy.model";

describe("optimization policy weights", () => {
  it("uses Director rank weights and assigns equal ratings the same weight", () => {
    const policy = createDefaultOptimizationPolicy();
    const directorWeights = getObjectiveWeights(policy);
    expect(directorWeights.minimalChanges).toBe(1);
    expect(directorWeights.moreConnections).toBe(1 / 2);
    expect(directorWeights.lowerTravelTime).toBe(1 / 2);
    expect(directorWeights.lowerTrackUsage).toBe(1 / 8);
    expect(directorWeights.lowerEdgeTrackUsage).toBe(1 / 8);

    policy.objectives[0].rating = 5;
    policy.objectives[1].rating = 5;
    policy.objectives[2].rating = 3;
    policy.objectives[3].rating = 1;
    policy.objectives[4].rating = 1;
    const tiedWeights = getObjectiveWeights(policy);
    expect(tiedWeights.minimalChanges).toBe(1);
    expect(tiedWeights.moreConnections).toBe(1);
    expect(tiedWeights.lowerTravelTime).toBe(1 / 4);
    expect(tiedWeights.lowerTrackUsage).toBe(1 / 8);
    expect(tiedWeights.lowerEdgeTrackUsage).toBe(1 / 8);
  });

  it("uses distinct rank weights in User-defined mode", () => {
    const policy = createDefaultOptimizationPolicy();
    policy.mode = "userDefined";
    const userDefinedWeights = getObjectiveWeights(policy);
    expect(userDefinedWeights.minimalChanges).toBe(1);
    expect(userDefinedWeights.moreConnections).toBe(1 / 2);
  });
});
