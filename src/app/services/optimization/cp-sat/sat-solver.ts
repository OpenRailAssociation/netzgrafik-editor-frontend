export type LiteralValue = -1 | 0 | 1;
export type SatStatus = "satisfiable" | "unsatisfiable" | "time-limit";

export interface SatStatistics {
  decisions: number;
  propagations: number;
  conflicts: number;
  learnedClauses: number;
}

export interface SatSearchControl {
  deadline: number;
  checkpoint: () => Promise<void>;
  theoryConflict?: (valueOf: (literal: number) => LiteralValue) => number[] | undefined;
}

/** Incremental CDCL with two watched literals and first-UIP conflict learning. */
export class SatSolver {
  readonly statistics: SatStatistics = {
    decisions: 0,
    propagations: 0,
    conflicts: 0,
    learnedClauses: 0,
  };

  private readonly clauses: number[][] = [];
  private readonly watches = new Map<number, number[]>();
  private readonly values: LiteralValue[] = [0];
  private readonly levels = [0];
  private readonly reasons = [-1];
  private readonly activities = [0];
  private readonly primary = [false];
  private readonly preferred = [false];
  private readonly trail: number[] = [];
  private readonly boundaries: number[] = [];
  private propagationHead = 0;
  private needsReset = true;
  private unsatisfiable = false;
  private activityIncrement = 1;

  newBoolean(primary = true, preferred = true): number {
    this.values.push(0);
    this.levels.push(0);
    this.reasons.push(-1);
    this.activities.push(0);
    this.primary.push(primary);
    this.preferred.push(preferred);
    this.needsReset = true;
    return this.values.length - 1;
  }

  valueOf(literal: number): LiteralValue {
    const value = this.values[Math.abs(literal)];
    return literal > 0 ? value : value === 0 ? 0 : value === 1 ? -1 : 1;
  }

  addClause(literals: readonly number[]): void {
    const unique = new Set(literals);
    const clause = [...unique];
    for (const literal of clause) {
      if (!Number.isInteger(literal) || literal === 0 || Math.abs(literal) >= this.values.length) {
        throw new RangeError("SAT clauses must reference existing non-zero literals.");
      }
    }
    if (clause.some((literal) => unique.has(-literal))) {
      return;
    }
    this.attach(clause);
    this.needsReset = true;
  }

  async solve(control: SatSearchControl): Promise<SatStatus> {
    if (this.unsatisfiable) {
      return "unsatisfiable";
    }
    if (this.needsReset) {
      this.reset();
    }
    while (!this.unsatisfiable) {
      await control.checkpoint();
      if (performance.now() >= control.deadline) {
        return "time-limit";
      }

      let conflict = this.propagationHead < this.trail.length ? this.propagateNext() : -1;
      if (conflict < 0 && this.propagationHead < this.trail.length) {
        continue;
      }
      if (conflict < 0) {
        const theoryClause = control.theoryConflict?.((literal) => this.valueOf(literal));
        if (theoryClause !== undefined) {
          if (theoryClause.some((literal) => this.valueOf(literal) !== -1)) {
            throw new Error("A theory conflict must be false under the current assignment.");
          }
          conflict = this.attach(
            [...new Set(theoryClause)].sort(
              (first, second) => this.levels[Math.abs(second)] - this.levels[Math.abs(first)],
            ),
          );
          const conflictLevel = this.clauses[conflict].reduce(
            (maximum, literal) => Math.max(maximum, this.levels[Math.abs(literal)]),
            0,
          );
          this.backtrack(conflictLevel);
        }
      }
      if (conflict >= 0) {
        this.statistics.conflicts++;
        if (this.boundaries.length === 0) {
          this.unsatisfiable = true;
          break;
        }
        const {clause, backtrackLevel} = this.analyze(conflict);
        this.backtrack(backtrackLevel);
        const reason = this.attach(clause);
        this.statistics.learnedClauses++;
        this.enqueue(clause[0], reason);
        this.activityIncrement /= 0.95;
        continue;
      }

      const decision = this.chooseVariable();
      if (decision === 0) {
        return "satisfiable";
      }
      this.boundaries.push(this.trail.length);
      this.statistics.decisions++;
      this.enqueue(this.preferred[decision] ? decision : -decision, -1);
    }
    return "unsatisfiable";
  }

  private attach(clause: number[]): number {
    const index = this.clauses.length;
    this.clauses.push(clause);
    clause.slice(0, 2).forEach((literal) => {
      const watched = this.watches.get(literal) ?? [];
      watched.push(index);
      this.watches.set(literal, watched);
    });
    if (clause.length === 0) {
      this.unsatisfiable = true;
    }
    return index;
  }

  private reset(): void {
    this.values.fill(0);
    this.levels.fill(0);
    this.reasons.fill(-1);
    this.trail.length = 0;
    this.boundaries.length = 0;
    this.propagationHead = 0;
    this.needsReset = false;
    this.clauses.forEach((clause, index) => {
      if (clause.length === 1 && !this.enqueue(clause[0], index)) {
        this.unsatisfiable = true;
      }
    });
  }

  private enqueue(literal: number, reason: number): boolean {
    const existing = this.valueOf(literal);
    if (existing !== 0) {
      return existing === 1;
    }
    const variable = Math.abs(literal);
    this.values[variable] = literal > 0 ? 1 : -1;
    this.levels[variable] = this.boundaries.length;
    this.reasons[variable] = reason;
    this.trail.push(literal);
    return true;
  }

  private propagateNext(): number {
    const falseLiteral = -this.trail[this.propagationHead++];
    const watched = this.watches.get(falseLiteral) ?? [];
    for (let index = 0; index < watched.length;) {
      const clauseIndex = watched[index];
      const clause = this.clauses[clauseIndex];
      this.statistics.propagations++;
      if (clause[0] === falseLiteral && clause.length > 1) {
        [clause[0], clause[1]] = [clause[1], clause[0]];
      }
      if (this.valueOf(clause[0]) === 1) {
        index++;
        continue;
      }
      const replacement = clause.findIndex(
        (literal, position) => position >= 2 && this.valueOf(literal) !== -1,
      );
      if (replacement >= 0) {
        [clause[1], clause[replacement]] = [clause[replacement], clause[1]];
        watched[index] = watched[watched.length - 1];
        watched.pop();
        const nextWatch = this.watches.get(clause[1]) ?? [];
        nextWatch.push(clauseIndex);
        this.watches.set(clause[1], nextWatch);
        continue;
      }
      if (this.valueOf(clause[0]) === -1 || !this.enqueue(clause[0], clauseIndex)) {
        return clauseIndex;
      }
      index++;
    }
    return -1;
  }

  private analyze(conflict: number): {clause: number[]; backtrackLevel: number} {
    const learned = [0];
    const seen = new Set<number>();
    let unresolved = 0;
    let trailIndex = this.trail.length - 1;
    let pivot = 0;
    let reason = conflict;
    do {
      for (const literal of this.clauses[reason]) {
        const variable = Math.abs(literal);
        if (variable === Math.abs(pivot) || seen.has(variable) || this.levels[variable] === 0) {
          continue;
        }
        seen.add(variable);
        this.activities[variable] += this.activityIncrement;
        if (this.levels[variable] === this.boundaries.length) {
          unresolved++;
        } else {
          learned.push(literal);
        }
      }
      while (trailIndex >= 0 && !seen.has(Math.abs(this.trail[trailIndex]))) {
        trailIndex--;
      }
      if (trailIndex < 0) {
        throw new Error("SAT conflict analysis could not find an implication point.");
      }
      pivot = this.trail[trailIndex--];
      seen.delete(Math.abs(pivot));
      unresolved--;
      reason = this.reasons[Math.abs(pivot)];
      if (unresolved > 0 && reason < 0) {
        throw new Error("SAT conflict analysis reached a decision before the implication point.");
      }
    } while (unresolved > 0);
    learned[0] = -pivot;
    let backtrackLevel = 0;
    for (let index = 1; index < learned.length; index++) {
      const level = this.levels[Math.abs(learned[index])];
      if (level > backtrackLevel) {
        backtrackLevel = level;
        [learned[1], learned[index]] = [learned[index], learned[1]];
      }
    }
    if (this.activityIncrement > 1e100) {
      this.activities.forEach((activity, index) => (this.activities[index] = activity * 1e-100));
      this.activityIncrement *= 1e-100;
    }
    return {clause: learned, backtrackLevel};
  }

  private backtrack(level: number): void {
    if (this.boundaries.length <= level) {
      return;
    }
    const start = this.boundaries[level];
    for (let index = this.trail.length - 1; index >= start; index--) {
      const variable = Math.abs(this.trail[index]);
      this.values[variable] = 0;
      this.levels[variable] = 0;
      this.reasons[variable] = -1;
    }
    this.trail.length = start;
    this.boundaries.length = level;
    this.propagationHead = Math.min(this.propagationHead, start);
  }

  private chooseVariable(): number {
    let best = 0;
    for (let variable = 1; variable < this.values.length; variable++) {
      if (this.values[variable] !== 0) {
        continue;
      }
      if (
        best === 0 ||
        (this.primary[variable] && !this.primary[best]) ||
        (this.primary[variable] === this.primary[best] &&
          this.activities[variable] > this.activities[best])
      ) {
        best = variable;
      }
    }
    return best;
  }
}
