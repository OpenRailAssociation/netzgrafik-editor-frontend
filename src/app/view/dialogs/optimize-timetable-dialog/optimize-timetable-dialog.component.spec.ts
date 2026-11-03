import {OptimizeTimetableDialogComponent} from "./optimize-timetable-dialog.component";
import {createDefaultOptimizationPolicy} from "../../../services/optimization/optimization-policy.model";

function createFormatter(
  profile: "stability" | "flexibilityFrequencyFirst" | "flexibilityCategoryFirst",
): OptimizeTimetableDialogComponent {
  const component = Object.create(
    OptimizeTimetableDialogComponent.prototype,
  ) as OptimizeTimetableDialogComponent;
  component.policy = {...createDefaultOptimizationPolicy(), directorProfile: profile};
  return component;
}

describe("OptimizeTimetableDialogComponent number formatting", () => {
  it("rounds signed values to one decimal in the flexibility profile only", () => {
    expect(createFormatter("flexibilityFrequencyFirst").formatSigned(5342.70000000298)).toBe(
      "+5342.7",
    );
    expect(createFormatter("flexibilityCategoryFirst").formatSigned(0)).toBe("0.0");
    expect(createFormatter("stability").formatSigned(1.26)).toBe("+1.26");
  });
});

describe("OptimizeTimetableDialogComponent search time budget", () => {
  it("doubles the default and maximum per-attempt search budgets", () => {
    const component = Object.create(
      OptimizeTimetableDialogComponent.prototype,
    ) as OptimizeTimetableDialogComponent;

    component.searchEffortLevel = 2;
    expect(component.searchTimeBudgetMs).toBe(2000);

    component.searchEffortLevel = 4;
    expect(component.searchTimeBudgetMs).toBe(8000);
  });
});
