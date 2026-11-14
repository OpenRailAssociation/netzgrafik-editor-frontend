import {
  Direction,
  HaltezeitFachCategories,
  LinePatternRefs,
} from "../../../data-structures/business.data.structures";
import {buildNetwork} from "../../util/port-ordering.test-helpers";
import {
  InfrastructureEstimatorService,
  TrackSegmentEstimate,
} from "../../infrastructure/infrastructure-estimator.service";
import {createDefaultOptimizationPolicy} from "../optimization-policy.model";
import {OptimizeTimetableService} from "../optimize-timetable.service";
import {buildProblem} from "../optimize-timetable.chains";
import {TimetableEvaluator} from "../optimize-timetable.evaluator";
import {runCpSatSearch} from "./optimize-timetable.cp-sat";
import {compareSolutions, solutionSoftCost} from "../optimization-solution-comparator";
import {SearchProgress} from "../optimize-timetable.search";

function createNetwork(
  definition: Parameters<typeof buildNetwork>[0] = {
    nodes: {A: {x: 0}, B: {x: 100}},
    trainruns: [
      ["A", "B"],
      ["A", "B"],
    ],
  },
) {
  const {nodesArray: nodes} = buildNetwork(definition);
  const sections = [
    ...new Set(nodes.flatMap((node) => node.getPorts().map((port) => port.getTrainrunSection()))),
  ];
  sections.forEach((section) => {
    section.setSourceSymmetry(false);
    section.setTargetSymmetry(false);
    const trainrun = section.getTrainrun();
    trainrun.setDirection(Direction.ONE_WAY);
    trainrun.setTrainrunFrequency({
      id: 1,
      order: 0,
      frequency: 4,
      offset: 0,
      name: "test",
      shortName: "test",
      linePatternRef: LinePatternRefs.Freq60,
    });
    trainrun.setTrainrunCategory({
      id: 1,
      order: 0,
      name: "test",
      shortName: "T",
      fachCategory: HaltezeitFachCategories.D,
      colorRef: "test",
      minimalTurnaroundTime: 0,
      nodeHeadwayStop: 0,
      nodeHeadwayNonStop: 0,
      sectionHeadway: 1,
    });
    trainrun.setTrainrunTimeCategory({
      id: 1,
      order: 0,
      name: "test",
      shortName: "test",
      dayTimeInterval: [],
      weekday: [],
      linePatternRef: LinePatternRefs.TimeCat7_24,
    });
  });
  sections[0].setSourceDepartureLock(true);
  const policy = createDefaultOptimizationPolicy();
  policy.mode = "userDefined";
  policy.objectives.forEach((objective) => (objective.enabled = objective.id === "minimalChanges"));
  const optimizer = new OptimizeTimetableService(new InfrastructureEstimatorService());
  return {nodes, sections, policy, optimizer};
}

describe("CP-SAT timetable integration", () => {
  for (const engine of ["heuristic", "cp-sat"] as const) {
    it(`${engine} does not require unused reverse times to mirror a one-way train`, async () => {
      const {nodes, sections, policy, optimizer} = createNetwork();
      sections.forEach((section) => {
        section.setSourceSymmetry(true);
        section.setTargetSymmetry(true);
      });
      policy.hardConstraints.find((rule) => rule.id === "trackLimit").enabled = false;
      const options = {engine, policy, maxTracksPerSection: 1, timeBudgetMs: 100};
      const result = await optimizer.optimize(nodes, sections, options);
      expect(result.solutions.length).toBeGreaterThan(0);
      expect(result.solutions.every((solution) => solution.valid)).toBeTrue();
      result.solutions.forEach((solution) =>
        expect(
          optimizer.isSolutionValid(solution, nodes, sections, options, result.baselineEdges),
        ).toBeTrue(),
      );
    });
  }

  it("does not exclude exact-feasible track assignments using the approximate evaluator", async () => {
    const {nodes, sections, policy} = createNetwork();
    const problem = buildProblem(nodes, sections, 1, [], 5, policy);
    const evaluator = new TimetableEvaluator(problem);
    evaluator.evaluateAll();
    expect(evaluator.parts().hard).toBeGreaterThan(0);
    const exactTrackRule = jasmine.createSpy("exactTrackRule").and.returnValue(true);
    const result = await runCpSatSearch(
      problem,
      evaluator,
      undefined,
      1000,
      undefined,
      exactTrackRule,
    );
    expect(exactTrackRule).toHaveBeenCalled();
    expect(result.exhausted).toBeTrue();
    expect(result.archive.length).toBe(4);
    expect(result.archive.every((candidate) => candidate.parts.hard === 0)).toBeTrue();
  });

  it("rejects invalid budgets and proposal limits explicitly for both engines", async () => {
    const {nodes, sections, policy, optimizer} = createNetwork();
    for (const engine of ["heuristic", "cp-sat"] as const) {
      for (const timeBudgetMs of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
        await expectAsync(
          optimizer.optimize(nodes, sections, {
            engine,
            maxTracksPerSection: 1,
            timeBudgetMs,
            policy,
          }),
        ).toBeRejectedWithError(RangeError);
      }
      await expectAsync(
        optimizer.optimize(nodes, sections, {
          engine,
          maxTracksPerSection: 1,
          maxProposals: -1,
          policy,
        }),
      ).toBeRejectedWithError(RangeError);
    }
  });

  it("caches exact edge estimates only while every section's consecutive times match", () => {
    const {nodes, sections, policy} = createNetwork();
    const estimator = new InfrastructureEstimatorService();
    const estimate = spyOn(estimator, "estimateSectionTracks").and.callThrough();
    const optimizer = new OptimizeTimetableService(estimator);
    const problem = buildProblem(nodes, sections, 1, [], 5, policy);
    const cache = new Map<string, TrackSegmentEstimate[]>();
    const baseline = optimizer["estimateEdgeTrackSegments"](problem, 0, cache);
    expect(optimizer["estimateEdgeTrackSegments"](problem, 0, cache)).toBe(baseline);
    expect(estimate).toHaveBeenCalledTimes(1);
    const old = sections[1].getSourceDepartureConsecutiveTime();
    sections[1].setSourceDepartureConsecutiveTime(old + 1);
    const cached = optimizer["estimateEdgeTrackSegments"](problem, 0, cache);
    expect(estimate).toHaveBeenCalledTimes(2);
    expect(cached).toEqual(optimizer["estimateEdgeTrackSegments"](problem, 0));
    sections[1].setSourceDepartureConsecutiveTime(old);
    expect(optimizer["estimateEdgeTrackSegments"](problem, 0, cache)).toBe(baseline);
    expect(estimate).toHaveBeenCalledTimes(3);
  });

  it("reuses unchanged exact node estimates without changing node or turnaround metrics", () => {
    const {nodes, sections} = createNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
      trainruns: [
        ["A", "B"],
        ["B", "C"],
      ],
    });
    const estimator = new InfrastructureEstimatorService();
    const estimate = spyOn(estimator, "estimateNodeTracks").and.callThrough();
    const optimizer = new OptimizeTimetableService(estimator);
    const baseline = optimizer["estimateNodeTrackMetrics"](nodes, sections);
    expect(estimate).toHaveBeenCalledTimes(3);
    sections[1].setSourceDepartureConsecutiveTime(
      sections[1].getSourceDepartureConsecutiveTime() + 1,
    );
    sections[1].setTargetArrivalConsecutiveTime(sections[1].getTargetArrivalConsecutiveTime() + 1);
    const cached = optimizer["estimateNodeTrackMetrics"](nodes, sections, baseline);
    expect(estimate).toHaveBeenCalledTimes(5);
    const uncached = optimizer["estimateNodeTrackMetrics"](nodes, sections);
    expect(estimate).toHaveBeenCalledTimes(8);
    expect(cached).toEqual(uncached);
  });

  it("repairs a real track conflict with the shared output shape and exact validation without mutating input", async () => {
    const {nodes, sections, policy, optimizer} = createNetwork();
    const before = sections.map((section) => structuredClone(section.getDto()));
    const options = {engine: "cp-sat" as const, maxTracksPerSection: 1, timeBudgetMs: 2000, policy};
    const result = await optimizer.optimize(nodes, sections, options);

    expect(result.engine).toBe("cp-sat");
    expect(result.baselineKpi.edgesOverLimitBefore).toBe(1);
    expect(result.solutions.length).toBeGreaterThan(0);
    expect(result.solutions.every((solution) => solution.valid)).toBeTrue();
    expect(result.searchExhausted).toBeTrue();
    expect(sections.map((section) => section.getDto())).toEqual(before);
    for (const solution of result.solutions) {
      expect(solution.valid).toBe(solution.kpi.edgesOverLimitAfter === 0);
      expect(
        solution.changes.some((change) => change.trainrunSectionId === sections[0].getId()),
      ).toBeFalse();
      expect(
        optimizer.isSolutionValid(solution, nodes, sections, options, result.baselineEdges),
      ).toBe(solution.valid);
      optimizer.applySolution(solution, sections);
      solution.changes.forEach((change) => {
        expect(Number.isInteger(change.newValue)).toBeTrue();
      });
      optimizer.revertSolution(solution, sections);
    }
    expect(JSON.stringify(sections.map((section) => section.getDto()))).toBe(
      JSON.stringify(before),
    );
  });

  it("respects scope and locks when the fixed baseline is infeasible", async () => {
    const {nodes, sections, policy, optimizer} = createNetwork();
    const result = await optimizer.optimize(nodes, sections, {
      engine: "cp-sat",
      maxTracksPerSection: 1,
      selectedNodeIds: [nodes[0].getId()],
      timeBudgetMs: 1000,
      policy,
    });
    expect(result.freeVariables).toBe(0);
    expect(result.solutions).toEqual([]);
    expect(result.searchExhausted).toBeTrue();
  });

  it("shares disabled hard-rule behavior and resumes the same native search session", async () => {
    const {nodes, sections, policy, optimizer} = createNetwork();
    policy.hardConstraints.find((constraint) => constraint.id === "trackLimit").enabled = false;
    const result = await optimizer.optimize(nodes, sections, {
      engine: "cp-sat",
      maxTracksPerSection: 1,
      timeBudgetMs: 0,
      policy,
    });
    expect(result.searchExhausted).toBeFalse();
    expect(result.evaluatedCandidates).toBe(0);
    const continued = await optimizer.continueSearch(result, 1000);
    expect(continued).toBe(result);
    expect(continued.searchExhausted).toBeTrue();
    expect(continued.evaluatedCandidates).toBeGreaterThanOrEqual(5);
    expect(continued.solutions.length).toBe(4);
  });

  it("never shortens travel times and honors per-section extension bounds", async () => {
    const {nodes, sections, policy} = createNetwork();
    sections.forEach((section) => section.setTravelTimeLock(false));
    const extension = policy.hardConstraints.find(
      (constraint) => constraint.id === "maxTravelTimeExtension",
    );
    extension.enabled = true;
    extension.value = 2;
    policy.hardConstraints.find((constraint) => constraint.id === "trackLimit").enabled = false;
    const problem = buildProblem(nodes, sections, 1, [], 5, policy);
    const evaluator = new TimetableEvaluator(problem);
    const result = await runCpSatSearch(problem, evaluator, undefined, 2000);
    expect(result.exhausted).toBeTrue();
    expect(result.evaluatedCandidates).toBeGreaterThan(5);
    result.archive.forEach((candidate) =>
      problem.variables.forEach((variable, index) => {
        if (variable.travelTimeTrainrunIndex !== undefined) {
          expect(candidate.delta[index]).toBeGreaterThanOrEqual(0);
          expect(candidate.delta[index]).toBeLessThanOrEqual(variable.domain);
        }
        if (variable.fixed) {
          expect(candidate.delta[index]).toBe(0);
        }
      }),
    );
  });

  for (const rule of ["minimumStopTime", "userConnections"] as const) {
    it(`propagates ${rule} relations and respects the hard-rule toggle`, async () => {
      const {nodes, sections, policy} = createNetwork({
        nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
        trainruns:
          rule === "minimumStopTime"
            ? [["A", "B", "C"]]
            : [
                ["A", "B"],
                ["B", "C"],
              ],
      });
      nodes[1].getTransitions().forEach((transition) => transition.setIsNonStopTransit(false));
      sections[1].setSourceDeparture(1);
      sections[1].setTargetArrival(2);
      sections[1].setSourceDepartureConsecutiveTime(1);
      sections[1].setTargetArrivalConsecutiveTime(2);
      if (rule === "userConnections") {
        nodes[1].setConnectionTime(1);
        const ports = nodes[1].getPorts();
        nodes[1].addConnection(ports[0], ports[1]);
      }
      policy.hardConstraints.find((constraint) => constraint.id === "trackLimit").enabled = false;
      for (const enabled of [true, false]) {
        policy.hardConstraints.find((constraint) => constraint.id === rule).enabled = enabled;
        const problem = buildProblem(nodes, sections, 1, [], 5, policy);
        const evaluator = new TimetableEvaluator(problem);
        const result = await runCpSatSearch(problem, evaluator, undefined, 2000);
        expect(result.exhausted).toBeTrue();
        const variable = problem.variables.findIndex((item) => !item.fixed && item.domain > 0);
        const expectedFeasible: number[] = [];
        for (let value = -2; value <= 2; value++) {
          evaluator.delta[variable] = value;
          evaluator.evaluateAll();
          if (value !== 0 && evaluator.parts().hard === 0) {
            expectedFeasible.push(value);
          }
        }
        expect(result.archive.length).toBe(4);
        expect(
          result.archive
            .filter((candidate) => candidate.parts.hard === 0)
            .map((candidate) => candidate.delta[variable])
            .sort((a, b) => a - b),
        )
          .withContext(`${rule}: enabled=${enabled}`)
          .toEqual(expectedFeasible);
        expect(result.archive.some((candidate) => candidate.parts.hard > 0)).toBe(enabled);
      }
    });
  }

  for (const engine of ["heuristic", "cp-sat"] as const) {
    it(`${engine} explains immutable exact conflicts even when every node is selected`, async () => {
      const {nodes, sections, policy, optimizer} = createNetwork();
      policy.hardConstraints.find(
        (constraint) => constraint.id === "maxTravelTimeExtension",
      ).enabled = true;
      sections.forEach((section) => {
        section.setSourceDepartureLock(true);
        section.setTravelTimeLock(true);
        section.setBackwardTravelTimeLock(true);
      });
      const options = {
        engine,
        maxTracksPerSection: 1,
        selectedNodeIds: nodes.map((node) => node.getId()),
        timeBudgetMs: 0,
        policy,
      };
      const result = await optimizer.optimize(nodes, sections, options);
      expect(result.freeVariables).toBe(0);
      expect(result.immutableTrackConflicts?.length).toBe(1);
      expect(result.immutableTrackConflicts?.[0]?.tracksBefore).toBeGreaterThan(1);
      expect(
        result.immutableTrackConflicts?.[0]?.blockingSections.some(
          (section) => section.times.forwardDeparture.locked,
        ),
      ).toBeTrue();
      expect(
        result.immutableTrackConflicts?.[0]?.blockingSections.some(
          (section) => section.times.forwardTravelTime.locked,
        ),
      ).toBeTrue();
      expect(
        result.immutableTrackConflicts?.[0]?.blockingSections.some(
          (section) => section.times.backwardTravelTime.locked,
        ),
      ).toBeTrue();
      expect(
        result.immutableTrackConflicts?.[0]?.blockingSections.every(
          (section) =>
            section.trainrunName.length > 0 &&
            section.fromNodeName.length > 0 &&
            section.toNodeName.length > 0,
        ),
      ).toBeTrue();
      expect(result.solutions).toEqual([]);
      policy.hardConstraints.find((constraint) => constraint.id === "trackLimit").enabled = false;
      const relaxed = await optimizer.optimize(nodes, sections, options);
      expect(relaxed.immutableTrackConflicts).toEqual([]);
    });

    it(`${engine} repairs a known solvable track conflict while continuing and removes the stale message`, async () => {
      const {nodes, sections, policy, optimizer} = createNetwork();
      const before = sections.map((section) => structuredClone(section.getDto()));
      const options = {engine, maxTracksPerSection: 1, timeBudgetMs: 0, policy};
      const result = await optimizer.optimize(nodes, sections, options);
      expect(result.solutions).toEqual([]);
      expect(result.message).toBeDefined();
      const updates: SearchProgress[] = [];
      await optimizer.continueSearch(result, 100, (progress) => updates.push(progress));
      expect(result.solutions.length).toBeGreaterThan(0);
      expect(result.solutions.every((solution) => solution.valid)).toBeTrue();
      expect(result.message).toBeUndefined();
      expect(
        updates.some(
          (progress) =>
            progress.fraction < 1 && progress.solutions?.some((solution) => solution.valid),
        ),
      ).toBeTrue();
      result.solutions.forEach((solution) =>
        expect(
          optimizer.isSolutionValid(solution, nodes, sections, options, result.baselineEdges),
        ).toBeTrue(),
      );
      const bestCost = solutionSoftCost(result.solutions[0], policy);
      await optimizer.continueSearch(result, 30);
      expect(result.solutions.every((solution) => solution.valid)).toBeTrue();
      expect(solutionSoftCost(result.solutions[0], policy)).toBeLessThanOrEqual(bestCost);
      expect(sections.map((section) => section.getDto())).toEqual(before);
    });

    it(`${engine} displays only feasible variants when any exist and validates them independently`, async () => {
      const {nodes, sections, policy, optimizer} = createNetwork({
        nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
        trainruns: [
          ["A", "B"],
          ["B", "C"],
        ],
      });
      nodes[1].setConnectionTime(1);
      const ports = nodes[1].getPorts();
      nodes[1].addConnection(ports[0], ports[1]);
      sections[1].setSourceDeparture(1);
      sections[1].setTargetArrival(2);
      sections[1].setSourceDepartureConsecutiveTime(1);
      sections[1].setTargetArrivalConsecutiveTime(2);
      policy.hardConstraints.find((constraint) => constraint.id === "trackLimit").enabled = false;
      const options = {engine, maxTracksPerSection: 1, timeBudgetMs: 100, policy};
      const result = await optimizer.optimize(nodes, sections, options);
      expect(result.solutions.some((candidate) => candidate.valid)).toBeTrue();
      expect(result.solutions.every((candidate) => candidate.valid)).toBeTrue();
      expect(result.infeasibleSolutions?.length).toBeGreaterThan(0);
      expect(result.infeasibleSolutions?.every((candidate) => !candidate.valid)).toBeTrue();
      expect(result.solutions[0].valid).toBeTrue();
      result.solutions.forEach((candidate) => {
        expect(
          optimizer.isSolutionValid(candidate, nodes, sections, options, result.baselineEdges),
        ).toBe(candidate.valid);
      });
    });

    it(`${engine} keeps the best infeasible alternatives when a locked conflict cannot be repaired`, async () => {
      const {nodes, sections, policy, optimizer} = createNetwork({
        nodes: {A: {x: 0}, B: {x: 100}},
        trainruns: [
          ["A", "B"],
          ["A", "B"],
          ["A", "B"],
        ],
      });
      sections[1].setSourceDepartureLock(true);
      const before = sections.map((section) => structuredClone(section.getDto()));
      const options = {engine, maxTracksPerSection: 1, timeBudgetMs: 80, policy};
      const result = await optimizer.optimize(nodes, sections, options);
      expect(result.solutions.length).toBeGreaterThan(0);
      expect(result.solutions.length).toBeLessThanOrEqual(5);
      expect(result.solutions.every((candidate) => !candidate.valid)).toBeTrue();
      expect(result.message).toBeDefined();
      result.solutions.forEach((candidate) => {
        expect(
          optimizer.isSolutionValid(candidate, nodes, sections, options, result.baselineEdges),
        ).toBeFalse();
        expect(
          candidate.changes.every((change) => change.trainrunSectionId === sections[2].getId()),
        ).toBeTrue();
      });
      expect(sections.map((section) => section.getDto())).toEqual(before);
    });

    it(`${engine} reports baseline feasibility promptly and retains five weighted alternatives`, async () => {
      const {nodes, sections, policy, optimizer} = createNetwork({
        nodes: {A: {x: 0}, B: {x: 100}},
        trainruns: [
          ["A", "B"],
          ["A", "B"],
          ["A", "B"],
        ],
      });
      policy.hardConstraints.find((constraint) => constraint.id === "trackLimit").enabled = false;
      const progress: SearchProgress[] = [];
      const result = await optimizer.optimize(
        nodes,
        sections,
        {
          engine,
          maxTracksPerSection: 1,
          timeBudgetMs: 80,
          policy,
        },
        (update) => progress.push(update),
      );
      expect(progress.some((update) => update.solution?.valid && update.fraction < 1)).toBeTrue();
      expect(result.solutions.length).toBe(5);
      expect(result.solutions.every((candidate) => candidate.valid)).toBeTrue();
      expect(
        new Set(result.solutions.map((candidate) => JSON.stringify(candidate.assignment))).size,
      ).toBe(5);
      for (let index = 1; index < result.solutions.length; index++) {
        expect(
          compareSolutions(result.solutions[index - 1], result.solutions[index], policy),
        ).toBeLessThanOrEqual(0);
        expect(solutionSoftCost(result.solutions[index - 1], policy)).toBeLessThanOrEqual(
          solutionSoftCost(result.solutions[index], policy),
        );
      }
    });
  }
});
