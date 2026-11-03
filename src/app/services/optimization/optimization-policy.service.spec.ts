import {OptimizationPolicyService} from "./optimization-policy.service";
import {createDefaultOptimizationPolicy} from "./optimization-policy.model";

describe("OptimizationPolicyService legacy connection preference", () => {
  it("migrates the former hard rule to the soft connection-stability objective", () => {
    const legacyPolicy = createDefaultOptimizationPolicy();
    legacyPolicy.objectives = legacyPolicy.objectives.filter(
      (objective) => objective.id !== "connectionStability",
    );
    legacyPolicy.hardConstraints.push({
      id: "preserveConnectionTimes",
      name: "legacy",
      enabled: true,
    });
    spyOn(localStorage, "getItem").and.returnValue(JSON.stringify(legacyPolicy));

    const policy = new OptimizationPolicyService().policy;

    expect(
      policy.objectives.find((objective) => objective.id === "connectionStability")?.enabled,
    ).toBeTrue();
    expect(
      policy.hardConstraints.some((constraint) => constraint.id === "preserveConnectionTimes"),
    ).toBeFalse();
  });

  it("migrates former flexibility profile ids to the frequency-first profile", () => {
    const storedPolicies = ["flexibility", "frequencyFirst"].map((directorProfile) =>
      JSON.stringify({...createDefaultOptimizationPolicy(), directorProfile}),
    );
    spyOn(localStorage, "getItem").and.returnValues(...storedPolicies);

    expect(new OptimizationPolicyService().policy.directorProfile).toBe(
      "flexibilityFrequencyFirst",
    );
    expect(new OptimizationPolicyService().policy.directorProfile).toBe(
      "flexibilityFrequencyFirst",
    );
  });

  it("persists hard-rule changes made in Director mode", () => {
    const policy = createDefaultOptimizationPolicy();
    policy.hardConstraints.find((constraint) => constraint.id === "timeLocks").enabled = false;
    const setItem = spyOn(localStorage, "setItem");
    const getItem = spyOn(localStorage, "getItem").and.returnValue(null);
    const service = new OptimizationPolicyService();

    service.storePolicy(policy);
    const savedPolicy = setItem.calls.mostRecent().args[1];
    getItem.and.returnValue(savedPolicy);

    expect(
      new OptimizationPolicyService().policy.hardConstraints.find(
        (constraint) => constraint.id === "timeLocks",
      )?.enabled,
    ).toBeFalse();
  });
});
