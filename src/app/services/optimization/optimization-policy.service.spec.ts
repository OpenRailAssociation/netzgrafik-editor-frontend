import {OptimizationPolicyService} from "./optimization-policy.service";
import {createDefaultOptimizationPolicy} from "./optimization-policy.model";

describe("OptimizationPolicyService legacy connection preference", () => {
  it("migrates the former hard rule to the soft connection-stability objective", () => {
    const legacyPolicy = createDefaultOptimizationPolicy();
    legacyPolicy.mode = "userDefined";
    delete legacyPolicy.directorSettings;
    delete legacyPolicy.userDefinedSettings;
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
    const storedPolicies = ["flexibility", "frequencyFirst"].map((directorProfile) => {
      const policy = createDefaultOptimizationPolicy();
      delete policy.directorSettings;
      delete policy.userDefinedSettings;
      return JSON.stringify({...policy, directorProfile});
    });
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

  it("persists both mode configurations across reloads", () => {
    const getItem = spyOn(localStorage, "getItem").and.returnValue(null);
    const setItem = spyOn(localStorage, "setItem");
    const service = new OptimizationPolicyService();
    const policy = createDefaultOptimizationPolicy();
    policy.directorProfile = "flexibilityFrequencyFirst";
    policy.hardConstraints.find((constraint) => constraint.id === "timeLocks").enabled = false;
    policy.directorSettings = {
      directorProfile: policy.directorProfile,
      hardConstraints: policy.hardConstraints.map((constraint) => ({...constraint})),
      objectives: policy.objectives.map((objective) => ({...objective})),
    };
    policy.userDefinedSettings!.hardConstraints.find(
      (constraint) => constraint.id === "trackLimit",
    ).value = 4;
    policy.userDefinedSettings!.hardConstraints.find(
      (constraint) => constraint.id === "timeLocks",
    ).enabled = true;
    policy.userDefinedSettings!.objectives.find(
      (objective) => objective.id === "moreConnections",
    ).enabled = false;

    service.storePolicy(policy);
    getItem.and.returnValue(setItem.calls.mostRecent().args[1]);

    const loadedPolicy = new OptimizationPolicyService().policy;
    expect(loadedPolicy.directorSettings?.directorProfile).toBe("flexibilityFrequencyFirst");
    expect(
      loadedPolicy.directorSettings?.hardConstraints.find(
        (constraint) => constraint.id === "timeLocks",
      )?.enabled,
    ).toBeFalse();
    expect(
      loadedPolicy.userDefinedSettings?.hardConstraints.find(
        (constraint) => constraint.id === "trackLimit",
      )?.value,
    ).toBe(4);
    expect(
      loadedPolicy.userDefinedSettings?.hardConstraints.find(
        (constraint) => constraint.id === "timeLocks",
      )?.enabled,
    ).toBeTrue();
    expect(
      loadedPolicy.userDefinedSettings?.objectives.find(
        (objective) => objective.id === "moreConnections",
      )?.enabled,
    ).toBeFalse();
  });

  it("resets both mode configurations to their defaults", () => {
    const getItem = spyOn(localStorage, "getItem").and.returnValue(null);
    const setItem = spyOn(localStorage, "setItem");
    const service = new OptimizationPolicyService();
    const storedPolicy = service.resetPolicy();
    getItem.and.returnValue(setItem.calls.mostRecent().args[1]);

    const loadedPolicy = new OptimizationPolicyService().policy;
    expect(loadedPolicy).toEqual(storedPolicy);
    expect(loadedPolicy.mode).toBe("director");
    expect(loadedPolicy.userDefinedSettings).toEqual(
      createDefaultOptimizationPolicy().userDefinedSettings,
    );
  });
});
