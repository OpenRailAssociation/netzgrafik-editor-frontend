import {LiteralValue, SatSolver, SatStatistics} from "./sat-solver";

export interface CpSatVariable {
  key: string;
  lower: number;
  upper: number;
  hint?: number;
}

export interface CpSatConstraint {
  variables: readonly number[];
  /** Must depend only on the declared variable scope; all other values may be unassigned. */
  accepts: (values: Int32Array) => boolean;
}

export interface CpSatCandidate {
  values: Int32Array;
  objective: number;
}

export interface CpSatResult {
  status: "optimal" | "infeasible" | "time-limit";
  best?: CpSatCandidate;
  evaluatedCandidates: number;
  statistics: SatStatistics;
}

interface EncodedVariable {
  values: number[];
  literals: number[];
}

/** Finite-domain CP with lazy relation clauses, backed by an incremental CDCL solver. */
export class CpSatSolver {
  private readonly sat = new SatSolver();
  private readonly encoded: EncodedVariable[];
  private readonly lastAccepted = new Map<CpSatConstraint, string>();
  private best: CpSatCandidate | undefined;
  private evaluatedCandidates = 0;
  private exhausted = false;
  private nextYieldAt = 0;

  constructor(
    variables: readonly CpSatVariable[],
    private readonly constraints: readonly CpSatConstraint[],
    private readonly objective: (values: Int32Array) => number,
  ) {
    this.encoded = variables.map((variable) => this.encodeVariable(variable));
    constraints.forEach((constraint) => {
      if (
        constraint.variables.some(
          (index) => !Number.isInteger(index) || index < 0 || index >= variables.length,
        )
      ) {
        throw new RangeError("CP-SAT constraints must reference existing integer variables.");
      }
    });
  }

  async solveFor(
    timeBudgetMs: number,
    onCandidate?: (candidate: CpSatCandidate) => void,
    onProgress?: (statistics: SatStatistics) => void,
  ): Promise<CpSatResult> {
    if (!Number.isFinite(timeBudgetMs) || timeBudgetMs < 0) {
      throw new RangeError("The CP-SAT time budget must be finite and non-negative.");
    }
    const deadline = performance.now() + timeBudgetMs;
    this.nextYieldAt = performance.now() + 16;
    while (!this.exhausted && performance.now() < deadline) {
      const status = await this.sat.solve({
        deadline,
        checkpoint: async () => {
          if (performance.now() >= this.nextYieldAt) {
            onProgress?.({...this.sat.statistics});
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
            this.nextYieldAt = performance.now() + 16;
          }
        },
        theoryConflict: (valueOf) => this.findTheoryConflict(valueOf),
      });
      if (status === "time-limit") {
        break;
      }
      if (status === "unsatisfiable") {
        this.exhausted = true;
        break;
      }
      const {values, literals} = this.decode((literal) => this.sat.valueOf(literal));
      const objective = this.objective(values);
      if (!Number.isFinite(objective)) {
        throw new Error("The CP-SAT objective must return a finite number.");
      }
      const candidate = {values, objective};
      this.evaluatedCandidates++;
      if (this.best === undefined || objective < this.best.objective) {
        this.best = {values: new Int32Array(values), objective};
      }
      // Blocking the complete tuple enumerates alternatives without unsafe bounds on the KPI oracle.
      this.sat.addClause(literals.map((literal) => -literal));
      onCandidate?.(candidate);
    }
    return {
      status: this.exhausted ? (this.best === undefined ? "infeasible" : "optimal") : "time-limit",
      best: this.best,
      evaluatedCandidates: this.evaluatedCandidates,
      statistics: {...this.sat.statistics},
    };
  }

  private encodeVariable(variable: CpSatVariable): EncodedVariable {
    if (
      !Number.isInteger(variable.lower) ||
      !Number.isInteger(variable.upper) ||
      variable.lower < -2147483648 ||
      variable.upper > 2147483647 ||
      variable.lower > variable.upper
    ) {
      throw new RangeError("CP-SAT variables require non-empty signed 32-bit integer domains.");
    }
    const hint = variable.hint ?? 0;
    if (!Number.isFinite(hint)) {
      throw new RangeError("CP-SAT hints must be finite.");
    }
    const values = Array.from(
      {length: variable.upper - variable.lower + 1},
      (_, index) => variable.lower + index,
    ).sort((first, second) => Math.abs(first - hint) - Math.abs(second - hint) || first - second);
    const literals = values.map(() => this.sat.newBoolean());
    this.sat.addClause(literals);
    // Sequential at-most-one encoding needs linear rather than quadratic clause space.
    const prefixes = literals.slice(1).map(() => this.sat.newBoolean(false, false));
    literals.forEach((literal, index) => {
      if (index < prefixes.length) {
        this.sat.addClause([-literal, prefixes[index]]);
      }
      if (index > 0) {
        this.sat.addClause([-literal, -prefixes[index - 1]]);
        if (index < prefixes.length) {
          this.sat.addClause([-prefixes[index - 1], prefixes[index]]);
        }
      }
    });
    return {values, literals};
  }

  private decode(valueOf: (literal: number) => LiteralValue): {
    values: Int32Array;
    literals: number[];
  } {
    const values = new Int32Array(this.encoded.length);
    const literals = this.encoded.map((variable, index) => {
      const position = variable.literals.findIndex((literal) => valueOf(literal) === 1);
      if (position < 0) {
        return 0;
      }
      values[index] = variable.values[position];
      return variable.literals[position];
    });
    return {values, literals};
  }

  private findTheoryConflict(valueOf: (literal: number) => LiteralValue): number[] | undefined {
    const {values, literals} = this.decode(valueOf);
    for (const constraint of this.constraints) {
      if (constraint.variables.some((index) => literals[index] === 0)) {
        continue;
      }
      const signature = constraint.variables.map((index) => values[index]).join(",");
      if (this.lastAccepted.get(constraint) === signature) {
        continue;
      }
      if (!constraint.accepts(values)) {
        return [...new Set(constraint.variables)].map((index) => -literals[index]);
      }
      this.lastAccepted.set(constraint, signature);
    }
    return undefined;
  }
}
