import {buildNetwork} from "./port-ordering.test-helpers";
import {getConnectedComponents} from "./port-ordering.components";

describe("getConnectedComponents", () => {
  it("should return single component for connected graph", () => {
    const {nodesArray} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
      trainruns: [
        ["A", "B", "C"],
        ["A", "B", "C"],
      ],
    });

    const components = getConnectedComponents(nodesArray);

    expect(components.length).toBe(1);
    expect(components[0].length).toBe(3);
  });

  it("should return multiple components for disconnected graphs", () => {
    const {nodesArray, trainrunIDs} = buildNetwork({
      nodes: {
        A1: {x: 0, y: 0},
        B1: {x: 100, y: 0},
        A2: {x: 0, y: 200},
        B2: {x: 100, y: 200},
      },
      trainruns: [
        ["A1", "B1"],
        ["A2", "B2"],
      ],
    });

    const components = getConnectedComponents(nodesArray);

    expect(components.length).toBe(2);
    expect(components[0].length).toBe(2);
    expect(components[1].length).toBe(2);
  });
});
