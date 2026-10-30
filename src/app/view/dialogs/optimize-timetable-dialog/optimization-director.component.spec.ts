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
});
