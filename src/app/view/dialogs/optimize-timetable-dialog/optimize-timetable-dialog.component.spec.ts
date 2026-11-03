import {OptimizeTimetableDialogComponent} from "./optimize-timetable-dialog.component";
import {createDefaultOptimizationPolicy} from "../../../services/optimization/optimization-policy.model";
import {SbbTableDataSource} from "@sbb-esta/angular/table";
import {EdgeTrackKpi} from "../../../services/optimization/optimize-timetable.model";
import {NgZone} from "@angular/core";

describe("OptimizeTimetableDialogComponent search execution", () => {
  it("runs search yields outside Angular and refreshes the completed dialog", async () => {
    const component = Object.create(
      OptimizeTimetableDialogComponent.prototype,
    ) as OptimizeTimetableDialogComponent;
    const ngZone = new NgZone({enableLongStackTrace: false});
    const detectChanges = jasmine.createSpy("detectChanges");
    Object.assign(component, {ngZone, changeDetectorRef: {detectChanges}});

    await ngZone.run(() =>
      component["runWithProgress"](async () => {
        expect(component.isOptimizing).toBeTrue();
        expect(NgZone.isInAngularZone()).toBeFalse();
        await new Promise<void>((resolve) =>
          setTimeout(() => {
            expect(NgZone.isInAngularZone()).toBeFalse();
            resolve();
          }, 0),
        );
      }),
    );

    expect(component.isOptimizing).toBeFalse();
    expect(component.optimizationProgressPercent).toBe(100);
    expect(detectChanges).toHaveBeenCalled();
  });

  it("restores the dialog state and propagates search failures", async () => {
    const component = Object.create(
      OptimizeTimetableDialogComponent.prototype,
    ) as OptimizeTimetableDialogComponent;
    const detectChanges = jasmine.createSpy("detectChanges");
    Object.assign(component, {
      ngZone: new NgZone({enableLongStackTrace: false}),
      changeDetectorRef: {detectChanges},
    });
    const error = new Error("Search failed");

    await expectAsync(component["runWithProgress"](() => Promise.reject(error))).toBeRejectedWith(
      error,
    );

    expect(component.isOptimizing).toBeFalse();
    expect(component.optimizationProgressPercent).toBe(0);
    expect(detectChanges).toHaveBeenCalled();
  });
});

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

describe("OptimizeTimetableDialogComponent track overview scope", () => {
  const scenarios = [
    {name: "selected nodes", nodeIds: [1, 2], corridorEdgeIds: undefined},
    {name: "a selected train corridor", nodeIds: [1, 2], corridorEdgeIds: ["1-2"]},
    {name: "the full visible network", nodeIds: [], corridorEdgeIds: undefined},
    {name: "selected nodes without an internal edge", nodeIds: [1], corridorEdgeIds: undefined},
  ];

  scenarios.forEach(({name, nodeIds, corridorEdgeIds}) => {
    it(`shows only optimization-scope edges for ${name}`, () => {
      const edges: EdgeTrackKpi[] = ["1-2", "2-3", "3-4"].map((edgeId, index) => ({
        edgeId,
        inScope: nodeIds.length === 0 || (nodeIds.length > 1 && index === 0),
        fromNodeName: String(index + 1),
        toNodeName: String(index + 2),
        tracksBefore: index + 2,
        tracksAfter: index + 2,
      }));
      const estimateBaselineEdges = jasmine
        .createSpy("estimateBaselineEdges")
        .and.returnValue(edges);
      const component = Object.create(
        OptimizeTimetableDialogComponent.prototype,
      ) as OptimizeTimetableDialogComponent;
      Object.assign(component, {
        policy: createDefaultOptimizationPolicy(),
        scopeNodeIds: nodeIds,
        scopeCorridorEdgeIds: corridorEdgeIds ?? [],
        scopeUsesSelectedTrainrun: corridorEdgeIds !== undefined,
        trackOverviewSort: {active: "tracksBefore", direction: "desc"},
        trackOverviewDataSource: new SbbTableDataSource<EdgeTrackKpi>([]),
        nodeService: {getNodes: (): never[] => []},
        trainrunSectionService: {getTrainrunSections: (): never[] => []},
        optimizeTimetableService: {estimateBaselineEdges},
      });

      component["refreshTrackOverview"]();

      expect(estimateBaselineEdges).toHaveBeenCalledWith(
        [],
        [],
        jasmine.objectContaining({
          selectedNodeIds: nodeIds,
          selectedCorridorEdgeIds: corridorEdgeIds,
        }),
      );
      expect(component.trackOverviewDataSource.data.map((edge) => edge.edgeId)).toEqual(
        edges
          .filter((edge) => edge.inScope)
          .reverse()
          .map((edge) => edge.edgeId),
      );
      expect(edges.map((edge) => edge.edgeId)).toEqual(["1-2", "2-3", "3-4"]);
    });
  });
});
