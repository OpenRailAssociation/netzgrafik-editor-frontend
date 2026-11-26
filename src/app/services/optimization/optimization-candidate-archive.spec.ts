import {retainCandidate} from "./optimization-candidate-archive";
import {WEIGHT_HARD} from "./optimize-timetable.evaluator";
import {ArchivedSolution} from "./optimize-timetable.search";

function candidate(delta: number, hard: number, softCost: number): ArchivedSolution {
  return {
    delta: new Int32Array([delta]),
    score: WEIGHT_HARD * hard + softCost,
    parts: {
      hard,
      excess: hard,
      trackConflictCost: 0,
      edgesOverLimit: hard,
      edgeTrackCost: 0,
      nodeTrackCost: 0,
      connectionViolations: 0,
      connectionWaitDeviation: 0,
      stopViolations: 0,
      travelTimeExtensionViolation: 0,
      travelTimeDelta: 0,
      optionalConnections: 0,
      sumAbsShift: Math.abs(delta),
    },
  };
}

describe("optimization candidate archive", () => {
  it("excludes baseline and duplicate assignments but keeps infeasible alternatives", () => {
    const archive: ArchivedSolution[] = [];
    const baseline = new Int32Array([0]);
    retainCandidate(archive, candidate(0, 0, 0), baseline);
    retainCandidate(archive, candidate(1, 2, 1), baseline);
    retainCandidate(archive, candidate(1, 2, 1), baseline);
    expect(archive.length).toBe(1);
    expect(archive[0].parts.hard).toBe(2);
  });

  it("ranks feasible first and then by soft cost, not by hard penalties", () => {
    const archive: ArchivedSolution[] = [];
    const baseline = new Int32Array([0]);
    retainCandidate(archive, candidate(1, 1, 20), baseline);
    retainCandidate(archive, candidate(2, 3, 10), baseline);
    retainCandidate(archive, candidate(3, 0, 30), baseline);
    expect(archive.map((item) => item.delta[0])).toEqual([3, 2, 1]);
  });

  it("bounds storage while reserving space for both feasibility classes", () => {
    const archive: ArchivedSolution[] = [];
    const baseline = new Int32Array([0]);
    for (let index = 1; index <= 100; index++) {
      retainCandidate(archive, candidate(index, index % 2, index), baseline);
    }
    expect(archive.length).toBe(40);
    expect(archive.filter((item) => item.parts.hard === 0).length).toBe(20);
    expect(archive.filter((item) => item.parts.hard > 0).length).toBe(20);
    expect(Math.max(...archive.map((item) => item.delta[0]))).toBe(40);
  });

  it("preserves repair progress under pressure from cheaper but less feasible candidates", () => {
    const archive: ArchivedSolution[] = [];
    const baseline = new Int32Array([0]);
    const repaired = candidate(100, 1, 100);
    retainCandidate(archive, repaired, baseline);
    for (let index = 1; index <= 40; index++) {
      retainCandidate(archive, candidate(index, 3, index), baseline);
    }
    expect(archive.length).toBe(20);
    expect(archive).toContain(repaired);
    expect(archive).toContain(jasmine.objectContaining({delta: new Int32Array([1])}));
  });

  it("upgrades an assignment after exact feasibility becomes known", () => {
    const archive: ArchivedSolution[] = [];
    const baseline = new Int32Array([0]);
    retainCandidate(archive, candidate(1, 1, 5), baseline);
    retainCandidate(archive, candidate(1, 0, 5), baseline);
    retainCandidate(archive, candidate(1, 1, 5), baseline);
    expect(archive.length).toBe(1);
    expect(archive[0].parts.hard).toBe(0);
  });
});
