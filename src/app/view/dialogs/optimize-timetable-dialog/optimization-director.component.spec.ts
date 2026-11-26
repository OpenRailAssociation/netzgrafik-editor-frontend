import {OptimizationDirectorComponent} from "./optimization-director.component";
import {
  createDefaultOptimizationPolicy,
  DIRECTOR_OBJECTIVE_ORDER,
} from "../../../services/optimization/optimization-policy.model";

describe("OptimizationDirectorComponent", () => {
  it("keeps Director objectives in a fixed order regardless of their ratings", () => {
    const component = new OptimizationDirectorComponent();
    component.policy = createDefaultOptimizationPolicy();
    component.policy.objectives.forEach((objective, index) => {
      objective.rating = 10 - index;
    });

    expect(component.orderedObjectives.map((objective) => objective.id)).toEqual(
      DIRECTOR_OBJECTIVE_ORDER,
    );
    expect(component.ratingValues).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("applies and restores the flexible profile parameters", () => {
    const component = new OptimizationDirectorComponent();
    component.policy = createDefaultOptimizationPolicy();
    const policyChange = spyOn(component.policyChange, "emit");

    component.selectProfile("flexibilityFrequencyFirst");
    const flexiblePolicy = policyChange.calls.mostRecent().args[0];
    expect(
      flexiblePolicy.adjustableParameters.find(
        (parameter) => parameter.id === "ignoreDepartureLocks",
      )?.enabled,
    ).toBeTrue();
    expect(
      flexiblePolicy.adjustableParameters.find((parameter) => parameter.id === "ignoreArrivalLocks")
        ?.enabled,
    ).toBeTrue();
    expect(
      flexiblePolicy.adjustableParameters.find(
        (parameter) => parameter.id === "ignoreTravelTimeLocks",
      )?.enabled,
    ).toBeTrue();
    expect(
      flexiblePolicy.adjustableParameters.find(
        (parameter) => parameter.id === "maxTravelTimeExtension",
      ),
    ).toEqual(
      jasmine.objectContaining({
        enabled: true,
        value: 5,
      }),
    );
    expect(
      flexiblePolicy.hardConstraints.find((constraint) => constraint.id === "scopeBoundary")
        ?.enabled,
    ).toBeTrue();

    component.policy = flexiblePolicy;
    component.selectProfile("stability");
    const standardPolicy = policyChange.calls.mostRecent().args[0];
    expect(
      standardPolicy.adjustableParameters.find(
        (parameter) => parameter.id === "ignoreDepartureLocks",
      )?.enabled,
    ).toBeFalse();
    expect(
      standardPolicy.adjustableParameters.find((parameter) => parameter.id === "ignoreArrivalLocks")
        ?.enabled,
    ).toBeFalse();
    expect(
      standardPolicy.adjustableParameters.find(
        (parameter) => parameter.id === "ignoreTravelTimeLocks",
      )?.enabled,
    ).toBeFalse();
    expect(
      standardPolicy.adjustableParameters.find(
        (parameter) => parameter.id === "maxTravelTimeExtension",
      ),
    ).toEqual(
      jasmine.objectContaining({
        enabled: false,
        value: 5,
      }),
    );
  });

  it("selects frequency-first with its flexibility rules enabled", () => {
    const component = new OptimizationDirectorComponent();
    component.policy = createDefaultOptimizationPolicy();
    const policyChange = spyOn(component.policyChange, "emit");

    component.selectProfile("flexibilityFrequencyFirst");

    const policy = policyChange.calls.mostRecent().args[0];
    expect(policy.directorProfile).toBe("flexibilityFrequencyFirst");
    expect(
      policy.adjustableParameters.find((parameter) => parameter.id === "ignoreDepartureLocks")
        ?.enabled,
    ).toBeTrue();
    expect(
      policy.adjustableParameters.find((parameter) => parameter.id === "ignoreArrivalLocks")
        ?.enabled,
    ).toBeTrue();
    expect(
      policy.adjustableParameters.find((parameter) => parameter.id === "ignoreTravelTimeLocks")
        ?.enabled,
    ).toBeTrue();
    expect(
      policy.adjustableParameters.find((parameter) => parameter.id === "maxTravelTimeExtension"),
    ).toEqual(jasmine.objectContaining({enabled: true, value: 5}));
  });

  it("keeps Director and User-defined settings independent when switching modes", () => {
    const component = new OptimizationDirectorComponent();
    component.policy = createDefaultOptimizationPolicy();
    const policyChange = spyOn(component.policyChange, "emit");

    component.selectProfile("flexibilityFrequencyFirst");
    component.policy = policyChange.calls.mostRecent().args[0];
    component.setMode(true);
    let userDefinedPolicy = policyChange.calls.mostRecent().args[0];
    expect(
      userDefinedPolicy.adjustableParameters.find(
        (parameter) => parameter.id === "ignoreDepartureLocks",
      )?.enabled,
    ).toBeFalse();
    expect(
      userDefinedPolicy.adjustableParameters.find(
        (parameter) => parameter.id === "maxTravelTimeExtension",
      )?.enabled,
    ).toBeFalse();

    component.policy = userDefinedPolicy;
    component.setAdjustmentEnabled("ignoreDepartureLocks", true);
    component.policy = policyChange.calls.mostRecent().args[0];
    const trackLimit = component.policy.hardConstraints.find(
      (constraint) => constraint.id === "trackLimit",
    );
    component.setConstraintValue(trackLimit, 4);
    component.policy = policyChange.calls.mostRecent().args[0];
    component.setMode(false);

    const directorPolicy = policyChange.calls.mostRecent().args[0];
    expect(directorPolicy.directorProfile).toBe("flexibilityFrequencyFirst");
    expect(
      directorPolicy.adjustableParameters.find(
        (parameter) => parameter.id === "ignoreDepartureLocks",
      )?.enabled,
    ).toBeTrue();
    expect(
      directorPolicy.adjustableParameters.find(
        (parameter) => parameter.id === "maxTravelTimeExtension",
      ),
    ).toEqual(jasmine.objectContaining({enabled: true, value: 5}));
    expect(
      directorPolicy.hardConstraints.find((constraint) => constraint.id === "trackLimit")?.value,
    ).toBe(2);

    component.policy = directorPolicy;
    component.setMode(true);
    userDefinedPolicy = policyChange.calls.mostRecent().args[0];
    expect(
      userDefinedPolicy.adjustableParameters.find(
        (parameter) => parameter.id === "ignoreDepartureLocks",
      )?.enabled,
    ).toBeTrue();
    expect(
      userDefinedPolicy.hardConstraints.find((constraint) => constraint.id === "trackLimit")?.value,
    ).toBe(4);
  });

  it("selects category-order priority with the same flexibility rules", () => {
    const component = new OptimizationDirectorComponent();
    component.policy = createDefaultOptimizationPolicy();
    const policyChange = spyOn(component.policyChange, "emit");

    component.selectProfile("flexibilityCategoryFirst");

    const policy = policyChange.calls.mostRecent().args[0];
    expect(policy.directorProfile).toBe("flexibilityCategoryFirst");
    expect(
      policy.adjustableParameters.find((parameter) => parameter.id === "ignoreDepartureLocks")
        ?.enabled,
    ).toBeTrue();
    expect(
      policy.adjustableParameters.find((parameter) => parameter.id === "ignoreArrivalLocks")
        ?.enabled,
    ).toBeTrue();
    expect(
      policy.adjustableParameters.find((parameter) => parameter.id === "ignoreTravelTimeLocks")
        ?.enabled,
    ).toBeTrue();
    expect(
      policy.adjustableParameters.find((parameter) => parameter.id === "maxTravelTimeExtension"),
    ).toEqual(jasmine.objectContaining({enabled: true, value: 5}));
  });

  it("allows adjustable-parameter toggles in Director mode", () => {
    const component = new OptimizationDirectorComponent();
    component.policy = createDefaultOptimizationPolicy();
    const policyChange = spyOn(component.policyChange, "emit");

    component.setAdjustmentEnabled("ignoreDepartureLocks", true);

    expect(
      policyChange.calls
        .mostRecent()
        .args[0].adjustableParameters.find((parameter) => parameter.id === "ignoreDepartureLocks")
        ?.enabled,
    ).toBeTrue();
    component.setConstraintEnabled("scopeBoundary", false);
    expect(
      policyChange.calls
        .mostRecent()
        .args[0].hardConstraints.find((constraint) => constraint.id === "scopeBoundary")?.enabled,
    ).toBeTrue();
  });

  it("allows adjusting adjustable-parameter values in Director mode", () => {
    const component = new OptimizationDirectorComponent();
    component.policy = createDefaultOptimizationPolicy();
    const policyChange = spyOn(component.policyChange, "emit");
    const extension = component.policy.adjustableParameters.find(
      (parameter) => parameter.id === "maxTravelTimeExtension",
    );

    component.setAdjustmentValue(extension, 7);

    expect(
      policyChange.calls
        .mostRecent()
        .args[0].adjustableParameters.find((parameter) => parameter.id === "maxTravelTimeExtension")
        ?.value,
    ).toBe(7);
  });
});
