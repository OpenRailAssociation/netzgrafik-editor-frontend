import {CpSatSolver, CpSatConstraint, CpSatCandidate} from "./cp-sat-solver";

describe("CpSatSolver", () => {
  it("finds a coordinated solution across a local-search barrier and proves its model optimum", async () => {
    const constraints: CpSatConstraint[] = [
      {variables: [0, 1], accepts: (values) => values[0] === values[1]},
      {variables: [0], accepts: (values) => values[0] >= 1},
    ];
    const solver = new CpSatSolver(
      [
        {key: "x", lower: -2, upper: 2},
        {key: "y", lower: -2, upper: 2},
      ],
      constraints,
      (values) => Math.abs(values[0]) + Math.abs(values[1]),
    );
    const candidates: CpSatCandidate[] = [];
    const result = await solver.solveFor(2000, (candidate) => candidates.push(candidate));
    expect(result.status).toBe("optimal");
    expect(result.best?.values).toEqual(new Int32Array([1, 1]));
    expect(result.best?.objective).toBe(2);
    expect(candidates.map((candidate) => Array.from(candidate.values))).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(result.statistics.learnedClauses).toBeGreaterThan(0);
  });

  it("encodes exactly one value and enumerates every finite-domain tuple once", async () => {
    const solver = new CpSatSolver(
      [
        {key: "x", lower: -1, upper: 1, hint: 1},
        {key: "fixed", lower: 4, upper: 4},
        {key: "extension", lower: 0, upper: 2},
      ],
      [],
      (values) => values[0] + values[2],
    );
    const tuples: string[] = [];
    const result = await solver.solveFor(2000, ({values}) =>
      tuples.push(Array.from(values).join(",")),
    );
    expect(result.status).toBe("optimal");
    expect(tuples.length).toBe(9);
    expect(new Set(tuples).size).toBe(9);
    expect(tuples[0]).toBe("1,4,0");
    expect(result.best?.values).toEqual(new Int32Array([-1, 4, 0]));
  });

  it("learns partial-scope conflicts without excluding unrelated assignments", async () => {
    const solver = new CpSatSolver(
      [
        {key: "unrelated", lower: 0, upper: 2},
        {key: "constrained", lower: 0, upper: 2},
      ],
      [{variables: [1], accepts: (values) => values[1] === 2}],
      (values) => values[0],
    );
    const tuples: string[] = [];
    const result = await solver.solveFor(2000, ({values}) =>
      tuples.push(Array.from(values).join(",")),
    );
    expect(result.status).toBe("optimal");
    expect(new Set(tuples)).toEqual(new Set(["0,2", "1,2", "2,2"]));
  });

  it("reports constant infeasibility and retains exhaustion across continuation", async () => {
    const solver = new CpSatSolver(
      [{key: "fixed", lower: 0, upper: 0}],
      [{variables: [], accepts: () => false}],
      () => 0,
    );
    expect((await solver.solveFor(1000)).status).toBe("infeasible");
    expect((await solver.solveFor(1000)).status).toBe("infeasible");
  });

  it("retains learned clauses, candidates and search state when continuing after a time limit", async () => {
    const solver = new CpSatSolver([{key: "x", lower: 0, upper: 4}], [], (values) => -values[0]);
    let now = 0;
    spyOn(performance, "now").and.callFake(() => now);
    const first = await solver.solveFor(10, () => (now = 11));
    expect(first.status).toBe("time-limit");
    expect(first.evaluatedCandidates).toBe(1);
    const second = await solver.solveFor(100);
    expect(second.status).toBe("optimal");
    expect(second.evaluatedCandidates).toBe(5);
    expect(second.best?.values[0]).toBe(4);
  });

  it("rejects malformed domains and invalid budgets", async () => {
    expect(() => new CpSatSolver([{key: "x", lower: 2, upper: 1}], [], () => 0)).toThrowError(
      RangeError,
    );
    const solver = new CpSatSolver([], [], () => 0);
    await expectAsync(solver.solveFor(Number.NaN)).toBeRejectedWithError(RangeError);
    await expectAsync(solver.solveFor(-1)).toBeRejectedWithError(RangeError);
  });

  it("matches exhaustive optima for finite-domain relation models", async () => {
    for (let trial = 0; trial < 30; trial++) {
      const constraints: CpSatConstraint[] = [
        {variables: [0, 1], accepts: (values) => (values[0] + values[1] + trial) % 3 !== 0},
        {variables: [1, 2], accepts: (values) => values[1] - values[2] >= (trial % 4) - 1},
        {variables: [0, 2], accepts: (values) => values[0] + values[2] <= trial % 5},
      ];
      const objective = (values: Int32Array) => values[0] * 2 - values[1] + values[2] * 3;
      const feasible: number[] = [];
      for (let x = -1; x <= 2; x++) {
        for (let y = -1; y <= 2; y++) {
          for (let z = -1; z <= 2; z++) {
            const values = new Int32Array([x, y, z]);
            if (constraints.every((constraint) => constraint.accepts(values))) {
              feasible.push(objective(values));
            }
          }
        }
      }
      const solver = new CpSatSolver(
        ["x", "y", "z"].map((key) => ({key, lower: -1, upper: 2})),
        constraints,
        objective,
      );
      const result = await solver.solveFor(2000);
      expect(result.status)
        .withContext(`model ${trial}`)
        .toBe(feasible.length ? "optimal" : "infeasible");
      expect(result.evaluatedCandidates).withContext(`model ${trial}`).toBe(feasible.length);
      if (feasible.length) {
        expect(result.best?.objective)
          .withContext(`model ${trial}`)
          .toBe(Math.min(...feasible));
      }
    }
  });
});
