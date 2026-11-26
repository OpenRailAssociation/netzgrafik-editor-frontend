import {SatSolver} from "./sat-solver";

async function solve(solver: SatSolver) {
  return solver.solve({
    deadline: performance.now() + 2000,
    checkpoint: async () => {},
  });
}

describe("SatSolver", () => {
  it("propagates units, detects contradictions and handles tautologies", async () => {
    const solver = new SatSolver();
    const x = solver.newBoolean();
    const y = solver.newBoolean();
    solver.addClause([x, -x]);
    solver.addClause([x]);
    solver.addClause([-x, y]);
    expect(await solve(solver)).toBe("satisfiable");
    expect(solver.valueOf(y)).toBe(1);
    solver.addClause([-y]);
    expect(await solve(solver)).toBe("unsatisfiable");
  });

  it("learns an asserting clause and backjumps after a conflicting decision", async () => {
    const solver = new SatSolver();
    const a = solver.newBoolean();
    const b = solver.newBoolean();
    const c = solver.newBoolean();
    solver.addClause([-a, b]);
    solver.addClause([-a, c]);
    solver.addClause([-b, -c]);
    expect(await solve(solver)).toBe("satisfiable");
    expect(solver.valueOf(a)).toBe(-1);
    expect(solver.statistics.learnedClauses).toBeGreaterThan(0);
  });

  it("resumes a timed-out search without losing propagation state", async () => {
    const solver = new SatSolver();
    const x = solver.newBoolean();
    solver.addClause([x]);
    expect(await solver.solve({deadline: performance.now() - 1, checkpoint: async () => {}})).toBe(
      "time-limit",
    );
    expect(await solve(solver)).toBe("satisfiable");
    expect(solver.valueOf(x)).toBe(1);
  });

  it("handles empty formulas and empty clauses", async () => {
    const solver = new SatSolver();
    expect(await solve(solver)).toBe("satisfiable");
    solver.addClause([]);
    expect(await solve(solver)).toBe("unsatisfiable");
  });

  it("matches exhaustive truth tables for seeded random CNF formulas", async () => {
    let seed = 42;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let trial = 0; trial < 150; trial++) {
      const count = 2 + Math.floor(random() * 5);
      const solver = new SatSolver();
      Array.from({length: count}, () => solver.newBoolean());
      const clauses = Array.from({length: 5 + Math.floor(random() * 25)}, () =>
        Array.from({length: 1 + Math.floor(random() * 4)}, () => {
          const variable = 1 + Math.floor(random() * count);
          return random() < 0.5 ? variable : -variable;
        }),
      );
      clauses.forEach((clause) => solver.addClause(clause));
      const expected = Array.from({length: 2 ** count}, (_, bits) => bits).some((bits) =>
        clauses.every((clause) =>
          clause.some((literal) => Boolean(bits & (1 << (Math.abs(literal) - 1))) === literal > 0),
        ),
      );
      const status = await solve(solver);
      expect(status)
        .withContext(`formula ${trial}: ${JSON.stringify(clauses)}`)
        .toBe(expected ? "satisfiable" : "unsatisfiable");
      if (status === "satisfiable") {
        expect(clauses.every((clause) => clause.some((literal) => solver.valueOf(literal) === 1)))
          .withContext(`invalid model for formula ${trial}`)
          .toBeTrue();
      }
    }
  });
});
