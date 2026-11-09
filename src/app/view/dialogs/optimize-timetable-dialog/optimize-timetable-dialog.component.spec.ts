import {
  NodeChangeGroup,
  OptimizeTimetableDialogComponent,
} from "./optimize-timetable-dialog.component";
import {createDefaultOptimizationPolicy} from "../../../services/optimization/optimization-policy.model";
import {SbbTableDataSource} from "@sbb-esta/angular/table";
import {
  EdgeTrackKpi,
  ImmutableTrackConflict,
  OptimizeTimetableKpi,
  OptimizeTimetableOptions,
  OptimizeTimetableResult,
  OptimizeTimetableSolution,
  TimeChange,
} from "../../../services/optimization/optimize-timetable.model";
import {NgZone} from "@angular/core";
import {of, Subject} from "rxjs";

describe("OptimizeTimetableDialogComponent search execution", () => {
  it("does not present immutable conflicts from an outdated rule selection", () => {
    const component = createFormatter("stability");
    const edge: ImmutableTrackConflict = {
      edgeId: "1-2",
      inScope: true,
      fromNodeName: "A",
      toNodeName: "B",
      tracksBefore: 3,
      tracksAfter: 3,
      blockingSections: [],
    };
    Object.assign(component, {
      result: {immutableTrackConflicts: [edge]},
      resultPolicySnapshot: JSON.stringify(component.policy),
    });

    expect(component.immutableTrackConflicts).toEqual([edge]);
    component.policy.hardConstraints.find((constraint) => constraint.id === "timeLocks").enabled =
      false;
    expect(component.immutableTrackConflicts).toEqual([]);
  });

  it("refreshes continuing results immediately and hides the no-feasible message once repaired", () => {
    const component = createFormatter("stability");
    const invalid = jasmine.createSpyObj<OptimizeTimetableSolution>("invalid", [], {
      id: 0,
      assignment: {shift: 1},
      valid: false,
    });
    const feasible = jasmine.createSpyObj<OptimizeTimetableSolution>("feasible", [], {
      id: 1,
      assignment: {shift: 2},
      valid: true,
    });
    const detectChanges = jasmine.createSpy("detectChanges");
    Object.assign(component, {
      result: {solutions: [invalid], message: "No feasible candidate"},
      changeDetectorRef: {detectChanges},
    });
    component["updateProgress"]({
      fraction: 0.5,
      elapsedMs: 100,
      iterations: 3,
      solutions: [invalid],
    });
    expect(component.result.message).toBeDefined();
    expect(component.optimizationProgressPercent).toBe(50);
    expect(detectChanges).toHaveBeenCalled();
    expect(component.infeasibleSolutionsExpanded).toBeFalse();
    expect(component.rankedSolutions.length).toBe(0);
    expect(component.infeasibleSolutions.length).toBe(1);
    expect(component.feasibleSolutionCount).toBe(0);
    component.setInfeasibleSolutionsExpanded(true);
    expect(component.rankedSolutions.length).toBe(1);
    component["updateProgress"]({
      fraction: 0.6,
      elapsedMs: 120,
      iterations: 4,
      solutions: [feasible],
    });
    expect(component.result.message).toBeUndefined();
    expect(component.result.solutions.length).toBe(1);
    expect(component.infeasibleSolutions.length).toBe(1);
    expect(component.infeasibleSolutionsExpanded).toBeFalse();
    expect(component.rankedSolutions[0].valid).toBeTrue();
    expect(component.rankedSolutions[0].assignment).toEqual({shift: 2});
  });

  it("filters invalid rows after policy revalidation without losing the underlying candidates", () => {
    const component = createFormatter("stability");
    const invalid = jasmine.createSpyObj<OptimizeTimetableSolution>("invalid", [], {
      valid: false,
      assignment: {shift: 1},
    });
    const feasible = jasmine.createSpyObj<OptimizeTimetableSolution>("feasible", [], {
      valid: true,
      assignment: {shift: 2},
    });
    Object.assign(component, {result: {solutions: [invalid, feasible]}});
    expect(component.rankedSolutions).toEqual([feasible]);
    expect(component.feasibleSolutionCount).toBe(1);
    expect(component.result.solutions.length).toBe(2);
    component.setInfeasibleSolutionsExpanded(true);
    expect(component.rankedSolutions).toEqual([feasible, invalid]);
  });

  it("keeps infeasible alternatives hidden by default and restores baseline when collapsed", () => {
    const component = createFormatter("stability");
    const invalid = jasmine.createSpyObj<OptimizeTimetableSolution>("invalid", [], {
      valid: false,
      assignment: {shift: 1},
      changes: [],
    });
    Object.assign(component, {
      result: {solutions: [invalid], infeasibleSolutions: [invalid]},
      baselineOccupancy: new Map(),
      refreshTrackOverview: jasmine.createSpy("refreshTrackOverview"),
      selectSolution: jasmine.createSpy("selectSolution"),
      selectBaseline: jasmine.createSpy("selectBaseline"),
    });
    component["updateResultView"]();
    expect(component["selectSolution"]).not.toHaveBeenCalled();
    expect(component.infeasibleSolutionsExpanded).toBeFalse();
    expect(component.rankedSolutions).toEqual([]);
    component.setInfeasibleSolutionsExpanded(true);
    expect(component.rankedSolutions).toEqual([invalid]);
    component.selectedSolution = invalid;
    component.setInfeasibleSolutionsExpanded(false);
    expect(component.rankedSolutions).toEqual([]);
    expect(component.selectBaseline).toHaveBeenCalled();
  });

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
  component.infeasibleSolutionsExpanded = false;
  return component;
}

function createResult(overrides: Partial<OptimizeTimetableResult> = {}): OptimizeTimetableResult {
  const kpi = createKpi();
  return {
    baselineKpi: {...kpi, edgesOverLimitBefore: 0, edgesOverLimitAfter: 0},
    baselineEdges: [],
    solutions: [],
    freeVariables: 0,
    freeShiftVariables: 0,
    freeTravelTimeVariables: 0,
    fixedTravelTimeVariables: 0,
    travelTimeLockBlockedVariables: 0,
    departureTimeLockBlockedVariables: 0,
    arrivalTimeLockBlockedVariables: 0,
    scopeBlockedTravelTimeVariables: 0,
    noRangeTravelTimeVariables: 0,
    fixedChains: 0,
    iterations: 1,
    evaluatedCandidates: 1,
    runtimeMs: 10,
    initialEdgesOverLimit: 0,
    ...overrides,
  };
}

function createKpi(): OptimizeTimetableKpi {
  return {
    changedChains: 0,
    totalDeltaMinutes: 0,
    travelTimeExtensionMinutes: 0,
    optionalConnections: 0,
    maxTrackUsage: 0,
    averageTrackUsage: 0,
    changedNodes: 0,
    edgesOverLimitBefore: 0,
    edgesOverLimitAfter: 0,
    maxTracksBefore: 0,
    maxTracksAfter: 0,
    maxNodeTracksBefore: 0,
    maxNodeTracksAfter: 0,
    minimumStopViolationsBefore: 0,
    minimumStopViolationsAfter: 0,
    totalTravelTimeDelta: 0,
    optionalConnectionsBefore: 0,
    optionalConnectionsAfter: 0,
    sumAbsShift: 0,
    changedTrainruns: 0,
    changedTimes: 0,
  };
}

function createSolution(
  overrides: Partial<OptimizeTimetableSolution> = {},
): OptimizeTimetableSolution {
  return {
    id: 0,
    label: "Candidate 1",
    valid: false,
    kpi: createKpi(),
    edges: [],
    changes: [],
    assignment: {},
    ...overrides,
  };
}

function createTimeChange(): TimeChange {
  return {
    trainrunSectionId: 1,
    trainrunId: 1,
    trainrunName: "T1",
    sourceNodeId: 1,
    targetNodeId: 2,
    sourceNodeName: "A",
    targetNodeName: "B",
    field: "sourceDeparture",
    oldValue: 0,
    newValue: 1,
  };
}

describe("OptimizeTimetableDialogComponent diagnostic search", () => {
  it("retries immutable conflicts with relaxed locks and full-network scope", async () => {
    const component = Object.create(
      OptimizeTimetableDialogComponent.prototype,
    ) as OptimizeTimetableDialogComponent;
    const policy = createDefaultOptimizationPolicy();
    const conflict: ImmutableTrackConflict = {
      edgeId: "1-2",
      inScope: true,
      fromNodeName: "A",
      toNodeName: "B",
      tracksBefore: 3,
      tracksAfter: 3,
      blockingSections: [],
    };
    const diagnosticSolution = createSolution({
      valid: true,
      changes: [createTimeChange()],
      assignment: {departure: 1},
    });
    const baseResult = createResult({
      immutableTrackConflicts: [conflict],
      searchBestAssignment: {departure: 0},
    });
    const diagnosticResult = createResult({solutions: [diagnosticSolution]});
    const optimize = jasmine.createSpy("optimize").and.returnValues(baseResult, diagnosticResult);
    Object.assign(component, {
      policy,
      result: undefined,
      resultPolicySnapshot: undefined,
      scopeNodeIds: [1, 2],
      scopeCorridorEdgeIds: ["1-2"],
      scopeUsesSelectedTrainrun: true,
      seed: 1,
      revertPreview: jasmine.createSpy("revertPreview"),
      getVisibleNodes: (): never[] => [],
      getVisibleTrainrunSections: (): never[] => [],
      optimizeTimetableService: {optimize},
      updateResultView: jasmine.createSpy("updateResultView"),
      changeDetectorRef: {detectChanges: jasmine.createSpy("detectChanges")},
    });

    await component["runOptimization"](undefined, 1000);

    const diagnosticOptions = optimize.calls.argsFor(1)[2] as OptimizeTimetableOptions;
    expect(diagnosticOptions.selectedNodeIds).toEqual([]);
    expect(diagnosticOptions.selectedCorridorEdgeIds).toBeUndefined();
    expect(diagnosticOptions.timeBudgetMs).toBe(500);
    expect(diagnosticOptions.startAssignment).toEqual({departure: 0});
    expect(diagnosticOptions.seed).toBe(2);
    expect(
      diagnosticOptions.policy?.hardConstraints.find((constraint) => constraint.id === "timeLocks")
        ?.enabled,
    ).toBeFalse();
    expect(
      diagnosticOptions.policy?.hardConstraints.find(
        (constraint) => constraint.id === "travelTimeLocks",
      )?.enabled,
    ).toBeFalse();
    expect(
      diagnosticOptions.policy?.hardConstraints.find((constraint) => constraint.id === "trackLimit")
        ?.enabled,
    ).toBeTrue();
    expect(
      diagnosticOptions.policy?.hardConstraints.find(
        (constraint) => constraint.id === "scopeBoundary",
      )?.enabled,
    ).toBeTrue();
    expect(
      policy.hardConstraints.find((constraint) => constraint.id === "timeLocks").enabled,
    ).toBeTrue();
    expect(component.result.diagnosticSolutions).toEqual([
      jasmine.objectContaining({valid: false, diagnosticOnly: true}),
    ]);
    expect(component.result.iterations).toBe(2);
    expect(component.result.evaluatedCandidates).toBe(2);
  });

  it("keeps diagnostic candidates invalid during policy revalidation", () => {
    const component = Object.create(
      OptimizeTimetableDialogComponent.prototype,
    ) as OptimizeTimetableDialogComponent;
    const policy = createDefaultOptimizationPolicy();
    const diagnostic = createSolution({diagnosticOnly: true});
    const isSolutionValid = jasmine.createSpy("isSolutionValid").and.returnValue(true);
    Object.assign(component, {
      policy,
      result: createResult({diagnosticSolutions: [diagnostic]}),
      resultPolicySnapshot: JSON.stringify(policy),
      selectedSolution: undefined,
      scopeNodeIds: [],
      scopeCorridorEdgeIds: [],
      scopeUsesSelectedTrainrun: false,
      revertPreview: jasmine.createSpy("revertPreview"),
      getVisibleNodes: (): never[] => [],
      getVisibleTrainrunSections: (): never[] => [],
      optimizeTimetableService: {isSolutionValid},
    });

    component["revalidateSolutions"]();

    expect(isSolutionValid).not.toHaveBeenCalled();
    expect(diagnostic.valid).toBeFalse();
  });

  it("prioritizes diagnostic candidates in the five visible invalid alternatives", () => {
    const component = createFormatter("stability");
    const ordinaryCandidates = Array.from({length: 5}, (_, id) =>
      createSolution({id, assignment: {shift: id}}),
    );
    const diagnostic = createSolution({
      id: 5,
      diagnosticOnly: true,
      assignment: {shift: 5},
    });
    component.result = createResult({
      solutions: ordinaryCandidates,
      diagnosticSolutions: [diagnostic],
    });

    expect(component.infeasibleSolutions).toHaveSize(5);
    expect(component.infeasibleSolutions[0]).toBe(diagnostic);
  });
});

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
  it("uses the configured default and maximum search budgets", () => {
    const component = Object.create(
      OptimizeTimetableDialogComponent.prototype,
    ) as OptimizeTimetableDialogComponent;

    component.searchEffortLevel = 2;
    expect(component.searchTimeBudgetMs).toBe(16000);

    component.searchEffortLevel = 4;
    expect(component.searchTimeBudgetMs).toBe(64000);
  });
});

describe("OptimizeTimetableDialogComponent CP-SAT", () => {
  it("selects the native solver and runs one configured search budget", async () => {
    const component = Object.create(
      OptimizeTimetableDialogComponent.prototype,
    ) as OptimizeTimetableDialogComponent;
    const result = jasmine.createSpyObj<OptimizeTimetableResult>("result", [], {
      solutions: [],
      freeVariables: 1,
      searchExhausted: true,
      runtimeMs: 0,
    });
    const runOptimization = jasmine.createSpy("runOptimization").and.callFake(async () => {
      component.result = result;
    });
    Object.assign(component, {
      isOptimizing: false,
      searchEffortLevel: 2,
      runOptimization,
      runWithProgress: async (operation: () => Promise<void>) => operation(),
    });

    await component.optimizeCpSat();

    expect(runOptimization).toHaveBeenCalledOnceWith(undefined, 16000, "cp-sat");
  });

  it("extends the existing SAT search rather than rebuilding it when continuing", async () => {
    const component = Object.create(
      OptimizeTimetableDialogComponent.prototype,
    ) as OptimizeTimetableDialogComponent;
    const result = jasmine.createSpyObj<OptimizeTimetableResult>("result", [], {engine: "cp-sat"});
    const continueSearch = jasmine.createSpy("continueSearch").and.resolveTo(result);
    const optimize = jasmine.createSpy("optimize");
    const updateResultView = jasmine.createSpy("updateResultView");
    Object.assign(component, {
      result,
      searchEffortLevel: 0,
      isOptimizing: false,
      optimizationIterations: 0,
      policy: createDefaultOptimizationPolicy(),
      optimizeTimetableService: {continueSearch, optimize},
      revertPreview: jasmine.createSpy("revertPreview"),
      updateResultView,
      runWithProgress: async (operation: () => Promise<void>) => operation(),
    });

    await component.continueOptimization();

    expect(continueSearch).toHaveBeenCalledOnceWith(result, 4000, jasmine.any(Function));
    expect(optimize).not.toHaveBeenCalled();
    expect(updateResultView).toHaveBeenCalled();
  });

  it("requires explicit confirmation before committing an infeasible candidate", () => {
    const component = Object.create(
      OptimizeTimetableDialogComponent.prototype,
    ) as OptimizeTimetableDialogComponent;
    const candidate = createSolution({valid: false, assignment: {shift: 1}});
    const showConfirmationDiagramDialog = jasmine
      .createSpy("showConfirmationDiagramDialog")
      .and.returnValue(of(true));
    const startUndoRecording = jasmine.createSpy("startUndoRecording");
    const pushCurrentVersion = jasmine.createSpy("pushCurrentVersion");
    const close = jasmine.createSpy("close");
    const policy = createDefaultOptimizationPolicy();
    Object.assign(component, {
      policy,
      result: createResult({solutions: [candidate]}),
      resultPolicySnapshot: JSON.stringify(policy),
      selectedSolution: candidate,
      infeasibleSolutionsExpanded: true,
      destroyed: new Subject<void>(),
      translateService: {translate: (key: string) => key},
      uiInteractionService: {showConfirmationDiagramDialog},
      undoService: {startUndoRecording, pushCurrentVersion},
      dialogRef: {close},
    });

    component.isConfirmingInvalidApply = false;
    component.apply();
    expect(showConfirmationDiagramDialog).toHaveBeenCalled();
    expect(startUndoRecording).toHaveBeenCalled();
    expect(pushCurrentVersion).toHaveBeenCalledWith(true);
    expect(close).toHaveBeenCalled();
  });

  it("does not continue a completed finite-domain search", async () => {
    const component = Object.create(
      OptimizeTimetableDialogComponent.prototype,
    ) as OptimizeTimetableDialogComponent;
    const continueSearch = jasmine.createSpy("continueSearch");
    Object.assign(component, {
      result: {freeVariables: 1, searchExhausted: true},
      optimizeTimetableService: {continueSearch},
    });

    await component.continueOptimization();

    expect(continueSearch).not.toHaveBeenCalled();
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

  describe("OptimizeTimetableDialogComponent section track details", () => {
    it("limits the all-sections view to edges whose two endpoints are selected", () => {
      const edges: EdgeTrackKpi[] = ["1-2", "2-3", "3-4"].map((edgeId) => ({
        edgeId,
        inScope: true,
        fromNodeName: edgeId.split("-")[0],
        toNodeName: edgeId.split("-")[1],
        tracksBefore: 1,
        tracksAfter: 1,
        trackSegments: [{start: 0, end: 1, tracks: 1}],
      }));
      const component = Object.create(
        OptimizeTimetableDialogComponent.prototype,
      ) as OptimizeTimetableDialogComponent;
      Object.assign(component, {
        result: {baselineEdges: edges} as OptimizeTimetableResult,
        selectedSolution: {edges: []} as OptimizeTimetableSolution,
        showAllSectionTracks: true,
        scopeNodeIds: [2, 3],
        scopeUsesSelectedTrainrun: false,
        scopeCorridorEdgeIds: [],
        sectionTrackSort: {active: "tracksAfter", direction: "desc"},
        sectionTrackDataSource: new SbbTableDataSource<EdgeTrackKpi & {changed: boolean}>([]),
      });

      component["refreshSectionTrackOverview"]();

      expect(component.sectionTrackDataSource.data.map((edge) => edge.edgeId)).toEqual(["2-3"]);
    });

    it("shows changed sections by default and includes unchanged sections with a sortable marker on request", () => {
      const unchanged: EdgeTrackKpi = {
        edgeId: "1-2",
        inScope: true,
        fromNodeName: "A",
        toNodeName: "B",
        tracksBefore: 2,
        tracksAfter: 2,
        trackSegments: [{start: 0, end: 1, tracks: 2}],
      };
      const changed: EdgeTrackKpi = {
        edgeId: "2-3",
        inScope: true,
        fromNodeName: "B",
        toNodeName: "C",
        tracksBefore: 3,
        tracksAfter: 1,
        trackSegmentsBefore: [{start: 0, end: 1, tracks: 3}],
        trackSegmentsAfter: [{start: 0, end: 1, tracks: 1}],
      };
      const timetableOnlyChanged: EdgeTrackKpi = {
        edgeId: "3-4",
        inScope: true,
        fromNodeName: "C",
        toNodeName: "D",
        tracksBefore: 1,
        tracksAfter: 1,
        trackSegmentsBefore: [{start: 0, end: 1, tracks: 1}],
        trackSegmentsAfter: [{start: 0, end: 1, tracks: 1}],
      };
      const topologyChanged: EdgeTrackKpi = {
        edgeId: "4-5",
        inScope: true,
        fromNodeName: "D",
        toNodeName: "E",
        tracksBefore: 2,
        tracksAfter: 2,
        trackSegmentsBefore: [
          {start: 0, end: 0.5, tracks: 2},
          {start: 0.5, end: 1, tracks: 1},
        ],
        trackSegmentsAfter: [{start: 0, end: 1, tracks: 2}],
      };
      const outsideScope: EdgeTrackKpi = {
        edgeId: "5-6",
        inScope: false,
        fromNodeName: "E",
        toNodeName: "F",
        tracksBefore: 4,
        tracksAfter: 1,
        trackSegmentsBefore: [{start: 0, end: 1, tracks: 4}],
        trackSegmentsAfter: [{start: 0, end: 1, tracks: 1}],
      };
      const component = Object.create(
        OptimizeTimetableDialogComponent.prototype,
      ) as OptimizeTimetableDialogComponent;
      Object.assign(component, {
        result: {
          baselineEdges: [unchanged, changed, timetableOnlyChanged, topologyChanged, outsideScope],
        } as OptimizeTimetableResult,
        selectedSolution: {
          edges: [changed, timetableOnlyChanged, topologyChanged, outsideScope],
        } as OptimizeTimetableSolution,
        showAllSectionTracks: false,
        sectionTrackSort: {active: "tracksAfter", direction: "desc"},
        sectionTrackDataSource: new SbbTableDataSource<EdgeTrackKpi & {changed: boolean}>([]),
      });

      component["refreshSectionTrackOverview"]();
      expect(component.sectionTrackDataSource.data.map((edge) => edge.edgeId)).toEqual([
        "4-5",
        "2-3",
      ]);
      expect(component.sectionTrackColumns).not.toContain("changed");

      component.setShowAllSectionTracks(true);

      expect(component.sectionTrackDataSource.data.length).toBe(4);
      expect(
        component.sectionTrackDataSource.data.some((edge) => edge.edgeId === "5-6"),
      ).toBeFalse();
      expect(component.sectionTrackColumns).toContain("changed");
      const unchangedRow = component.sectionTrackDataSource.data.find(
        (edge) => edge.edgeId === "1-2",
      );
      const timetableOnlyRow = component.sectionTrackDataSource.data.find(
        (edge) => edge.edgeId === "3-4",
      );
      const topologyChangedRow = component.sectionTrackDataSource.data.find(
        (edge) => edge.edgeId === "4-5",
      );
      expect(unchangedRow).toEqual(
        jasmine.objectContaining({
          tracksBefore: 2,
          tracksAfter: 2,
          changed: false,
          trackSegmentsBefore: unchanged.trackSegments,
          trackSegmentsAfter: unchanged.trackSegments,
        }),
      );
      expect(timetableOnlyRow?.changed).toBeFalse();
      expect(topologyChangedRow?.changed).toBeTrue();
      expect(
        component.sectionTrackDataSource.data.find((edge) => edge.edgeId === "2-3")?.changed,
      ).toBeTrue();

      component.sortSectionTrackOverview({active: "changed", direction: "asc"});

      expect(component.sectionTrackDataSource.data[0].changed).toBeFalse();
    });
  });
});
