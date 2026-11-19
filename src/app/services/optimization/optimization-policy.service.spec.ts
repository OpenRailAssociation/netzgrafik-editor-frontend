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

  it("persists adjustable-parameter changes made in Director mode", () => {
    const policy = createDefaultOptimizationPolicy();
    policy.adjustableParameters.find(
      (parameter) => parameter.id === "ignoreDepartureLocks",
    ).enabled = true;
    const setItem = spyOn(localStorage, "setItem");
    const getItem = spyOn(localStorage, "getItem").and.returnValue(null);
    const service = new OptimizationPolicyService();

    service.storePolicy(policy);
    const savedPolicy = setItem.calls.mostRecent().args[1];
    getItem.and.returnValue(savedPolicy);

    expect(
      new OptimizationPolicyService().policy.adjustableParameters.find(
        (parameter) => parameter.id === "ignoreDepartureLocks",
      )?.enabled,
    ).toBeTrue();
  });

  it("replaces stale saved translation keys with current policy labels", () => {
    const policy = createDefaultOptimizationPolicy();
    const savedName =
      "app.view.dialogs.optimize-timetable-dialog.director.constraint.max-travel-time-extension";
    const settings = [policy, policy.directorSettings!, policy.userDefinedSettings!];
    settings.forEach((modeSettings) => {
      modeSettings.adjustableParameters.find(
        (parameter) => parameter.id === "maxTravelTimeExtension",
      )!.name = savedName;
    });
    spyOn(localStorage, "getItem").and.returnValue(JSON.stringify(policy));

    const loadedPolicy = new OptimizationPolicyService().policy;
    const expectedName = createDefaultOptimizationPolicy().adjustableParameters.find(
      (parameter) => parameter.id === "maxTravelTimeExtension",
    )!.name;

    expect(
      loadedPolicy.adjustableParameters.find(
        (parameter) => parameter.id === "maxTravelTimeExtension",
      )?.name,
    ).toBe(expectedName);
    expect(
      loadedPolicy.directorSettings?.adjustableParameters.find(
        (parameter) => parameter.id === "maxTravelTimeExtension",
      )?.name,
    ).toBe(expectedName);
    expect(
      loadedPolicy.userDefinedSettings?.adjustableParameters.find(
        (parameter) => parameter.id === "maxTravelTimeExtension",
      )?.name,
    ).toBe(expectedName);
  });

  it("persists both mode configurations across reloads", () => {
    const getItem = spyOn(localStorage, "getItem").and.returnValue(null);
    const setItem = spyOn(localStorage, "setItem");
    const service = new OptimizationPolicyService();
    const policy = createDefaultOptimizationPolicy();
    policy.directorProfile = "flexibilityFrequencyFirst";
    policy.adjustableParameters.find(
      (parameter) => parameter.id === "ignoreDepartureLocks",
    ).enabled = true;
    policy.directorSettings = {
      directorProfile: policy.directorProfile,
      hardConstraints: policy.hardConstraints.map((constraint) => ({...constraint})),
      adjustableParameters: policy.adjustableParameters.map((parameter) => ({...parameter})),
      objectives: policy.objectives.map((objective) => ({...objective})),
    };
    policy.userDefinedSettings!.hardConstraints.find(
      (constraint) => constraint.id === "trackLimit",
    ).value = 4;
    policy.userDefinedSettings!.adjustableParameters.find(
      (parameter) => parameter.id === "ignoreDepartureLocks",
    ).enabled = true;
    policy.userDefinedSettings!.objectives.find(
      (objective) => objective.id === "moreConnections",
    ).enabled = false;

    service.storePolicy(policy);
    getItem.and.returnValue(setItem.calls.mostRecent().args[1]);

    const loadedPolicy = new OptimizationPolicyService().policy;
    expect(loadedPolicy.directorSettings?.directorProfile).toBe("flexibilityFrequencyFirst");
    expect(
      loadedPolicy.directorSettings?.adjustableParameters.find(
        (parameter) => parameter.id === "ignoreDepartureLocks",
      )?.enabled,
    ).toBeTrue();
    expect(
      loadedPolicy.userDefinedSettings?.hardConstraints.find(
        (constraint) => constraint.id === "trackLimit",
      )?.value,
    ).toBe(4);
    expect(
      loadedPolicy.userDefinedSettings?.adjustableParameters.find(
        (parameter) => parameter.id === "ignoreDepartureLocks",
      )?.enabled,
    ).toBeTrue();
    expect(
      loadedPolicy.userDefinedSettings?.objectives.find(
        (objective) => objective.id === "moreConnections",
      )?.enabled,
    ).toBeFalse();
  });

  it("migrates lock and travel-time settings from saved hard constraints", () => {
    const policy = createDefaultOptimizationPolicy();
    const toLegacySettings = (settings: {
      hardConstraints: Array<{id: string; name: string; enabled: boolean; value?: number}>;
      adjustableParameters: Array<{id: string; name: string; enabled: boolean; value?: number}>;
      objectives: typeof policy.objectives;
    }) => {
      const maxExtension = settings.adjustableParameters.find(
        (parameter) => parameter.id === "maxTravelTimeExtension",
      );
      const departureLock = settings.adjustableParameters.find(
        (parameter) => parameter.id === "ignoreDepartureLocks",
      );
      const travelTimeLock = settings.adjustableParameters.find(
        (parameter) => parameter.id === "ignoreTravelTimeLocks",
      );
      return {
        hardConstraints: [
          ...settings.hardConstraints,
          {id: "timeLocks", name: "legacy", enabled: !(departureLock?.enabled ?? false)},
          {id: "travelTimeLocks", name: "legacy", enabled: !(travelTimeLock?.enabled ?? false)},
          ...(maxExtension === undefined ? [] : [{...maxExtension}]),
        ],
        objectives: settings.objectives,
      };
    };
    const legacyUserSettings = {
      ...policy.userDefinedSettings!,
      adjustableParameters: policy.userDefinedSettings!.adjustableParameters.map((parameter) =>
        parameter.id === "maxTravelTimeExtension"
          ? {...parameter, enabled: true, value: 8}
          : parameter.id === "ignoreTravelTimeLocks"
            ? {...parameter, enabled: true}
            : parameter,
      ),
    };
    const legacyPolicy = {
      mode: "userDefined",
      directorProfile: policy.directorProfile,
      ...toLegacySettings(legacyUserSettings),
      directorSettings: {
        directorProfile: policy.directorProfile,
        ...toLegacySettings(policy.directorSettings!),
      },
      userDefinedSettings: toLegacySettings(legacyUserSettings),
    };
    spyOn(localStorage, "getItem").and.returnValue(JSON.stringify(legacyPolicy));

    const migrated = new OptimizationPolicyService().policy;

    expect(
      migrated.adjustableParameters.find((parameter) => parameter.id === "maxTravelTimeExtension"),
    ).toEqual(jasmine.objectContaining({enabled: true, value: 8}));
    expect(
      migrated.adjustableParameters.find((parameter) => parameter.id === "ignoreDepartureLocks"),
    ).toEqual(jasmine.objectContaining({enabled: false}));
    expect(
      migrated.adjustableParameters.find((parameter) => parameter.id === "ignoreTravelTimeLocks"),
    ).toEqual(jasmine.objectContaining({enabled: true}));
    expect(
      migrated.hardConstraints.some(
        (constraint) => constraint.id === ("maxTravelTimeExtension" as string),
      ),
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
