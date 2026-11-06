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

  it("applies the flexible profile and restores standard time rules on profile switch", () => {
    const component = new OptimizationDirectorComponent();
    component.policy = createDefaultOptimizationPolicy();
    const policyChange = spyOn(component.policyChange, "emit");

    component.selectProfile("flexibilityFrequencyFirst");
    const flexiblePolicy = policyChange.calls.mostRecent().args[0];
    expect(
      flexiblePolicy.hardConstraints.find((constraint) => constraint.id === "timeLocks")?.enabled,
    ).toBeFalse();
    expect(
      flexiblePolicy.hardConstraints.find((constraint) => constraint.id === "travelTimeLocks")
        ?.enabled,
    ).toBeFalse();
    expect(
      flexiblePolicy.hardConstraints.find(
        (constraint) => constraint.id === "maxTravelTimeExtension",
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
      standardPolicy.hardConstraints.find((constraint) => constraint.id === "timeLocks")?.enabled,
    ).toBeTrue();
    expect(
      standardPolicy.hardConstraints.find((constraint) => constraint.id === "travelTimeLocks")
        ?.enabled,
    ).toBeTrue();
    expect(
      standardPolicy.hardConstraints.find(
        (constraint) => constraint.id === "maxTravelTimeExtension",
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
      policy.hardConstraints.find((constraint) => constraint.id === "timeLocks")?.enabled,
    ).toBeFalse();
    expect(
      policy.hardConstraints.find((constraint) => constraint.id === "travelTimeLocks")?.enabled,
    ).toBeFalse();
    expect(
      policy.hardConstraints.find((constraint) => constraint.id === "maxTravelTimeExtension"),
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
      userDefinedPolicy.hardConstraints.find((constraint) => constraint.id === "timeLocks")
        ?.enabled,
    ).toBeTrue();
    expect(
      userDefinedPolicy.hardConstraints.find(
        (constraint) => constraint.id === "maxTravelTimeExtension",
      )?.enabled,
    ).toBeFalse();

    component.policy = userDefinedPolicy;
    component.setConstraintEnabled("timeLocks", false);
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
      directorPolicy.hardConstraints.find((constraint) => constraint.id === "timeLocks")?.enabled,
    ).toBeFalse();
    expect(
      directorPolicy.hardConstraints.find(
        (constraint) => constraint.id === "maxTravelTimeExtension",
      ),
    ).toEqual(jasmine.objectContaining({enabled: true, value: 5}));
    expect(
      directorPolicy.hardConstraints.find((constraint) => constraint.id === "trackLimit")?.value,
    ).toBe(2);

    component.policy = directorPolicy;
    component.setMode(true);
    userDefinedPolicy = policyChange.calls.mostRecent().args[0];
    expect(
      userDefinedPolicy.hardConstraints.find((constraint) => constraint.id === "timeLocks")
        ?.enabled,
    ).toBeFalse();
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
      policy.hardConstraints.find((constraint) => constraint.id === "timeLocks")?.enabled,
    ).toBeFalse();
    expect(
      policy.hardConstraints.find((constraint) => constraint.id === "travelTimeLocks")?.enabled,
    ).toBeFalse();
    expect(
      policy.hardConstraints.find((constraint) => constraint.id === "maxTravelTimeExtension"),
    ).toEqual(jasmine.objectContaining({enabled: true, value: 5}));
  });

  it("allows hard-rule toggles in Director mode", () => {
    const component = new OptimizationDirectorComponent();
    component.policy = createDefaultOptimizationPolicy();
    const policyChange = spyOn(component.policyChange, "emit");

    component.setConstraintEnabled("timeLocks", false);

    expect(
      policyChange.calls
        .mostRecent()
        .args[0].hardConstraints.find((constraint) => constraint.id === "timeLocks")?.enabled,
    ).toBeFalse();
    component.setConstraintEnabled("scopeBoundary", false);
    expect(
      policyChange.calls
        .mostRecent()
        .args[0].hardConstraints.find((constraint) => constraint.id === "scopeBoundary")?.enabled,
    ).toBeTrue();
  });

  it("allows adjusting hard-rule values in Director mode", () => {
    const component = new OptimizationDirectorComponent();
    component.policy = createDefaultOptimizationPolicy();
    const policyChange = spyOn(component.policyChange, "emit");
    const extension = component.policy.hardConstraints.find(
      (constraint) => constraint.id === "maxTravelTimeExtension",
    );

    component.setConstraintValue(extension, 7);

    expect(
      policyChange.calls
        .mostRecent()
        .args[0].hardConstraints.find((constraint) => constraint.id === "maxTravelTimeExtension")
        ?.value,
    ).toBe(7);
  });
});
