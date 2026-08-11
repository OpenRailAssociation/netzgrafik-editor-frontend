import {buildNetwork} from "./port-ordering.test-helpers";
import {getComponents, SidesComponent} from "./port-ordering.components";

// Maps components to a canonical, order-independent form: each component as a sorted list of node
// names, the whole list sorted, so assertions don't depend on traversal order.
const asNames = (components: SidesComponent[]): string[][] =>
  components
    .map((c) => [...new Set(c.map(({node}) => node.getBetriebspunktName()))].sort())
    .sort((a, b) => a.join().localeCompare(b.join()));

describe("getComponents", () => {
  it("returns nothing for a single trainrun (no ports to order)", () => {
    const {nodesArray} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
      trainruns: [["A", "B", "C"]],
    });

    expect(getComponents(nodesArray)).toEqual([]);
  });

  it("keeps a parallel bundle together", () => {
    const {nodesArray} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}},
      trainruns: [
        ["A", "B", "C"],
        ["A", "B", "C"],
      ],
    });

    expect(asNames(getComponents(nodesArray))).toEqual([["A", "B", "C"]]);
  });

  it("separates disconnected bundles", () => {
    const {nodesArray} = buildNetwork({
      nodes: {
        A1: {x: 0, y: 0},
        B1: {x: 100, y: 0},
        A2: {x: 0, y: 200},
        B2: {x: 100, y: 200},
      },
      trainruns: [
        ["A1", "B1"],
        ["A1", "B1"],
        ["A2", "B2"],
        ["A2", "B2"],
      ],
    });

    expect(asNames(getComponents(nodesArray))).toEqual([
      ["A1", "B1"],
      ["A2", "B2"],
    ]);
  });

  it("separates two components that share only a node", () => {
    const {nodesArray} = buildNetwork({
      nodes: {
        TOP: {x: 0, y: -100},
        BOTTOM: {x: 0, y: 100},
        LEFT: {x: -100, y: 0},
        RIGHT: {x: 100, y: 0},
        CENTER: {x: 0, y: 0},
      },
      trainruns: [
        ["TOP", "CENTER", "BOTTOM"],
        ["TOP", "CENTER", "BOTTOM"],
        ["LEFT", "CENTER", "RIGHT"],
        ["LEFT", "CENTER", "RIGHT"],
      ],
    });

    expect(asNames(getComponents(nodesArray))).toEqual([
      ["BOTTOM", "CENTER", "TOP"],
      ["CENTER", "LEFT", "RIGHT"],
    ]);
  });

  it("separates two bundles meeting at a node without passing through", () => {
    const {nodesArray} = buildNetwork({
      nodes: {A: {x: -100}, B: {x: 0}, C: {x: 100}},
      trainruns: [
        ["A", "B"],
        ["A", "B"],
        ["B", "C"],
        ["B", "C"],
      ],
    });

    expect(asNames(getComponents(nodesArray))).toEqual([
      ["A", "B"],
      ["B", "C"],
    ]);
  });

  it("keeps a through bundle together but separates a terminating bundle", () => {
    const {nodesArray} = buildNetwork({
      nodes: {A: {x: -100, y: 0}, B: {x: 0, y: 0}, C: {x: 100, y: 0}, D: {x: 0, y: 100}},
      trainruns: [
        ["A", "B", "C"],
        ["A", "B", "C"],
        ["B", "D"],
        ["B", "D"],
      ],
    });

    expect(asNames(getComponents(nodesArray))).toEqual([
      ["A", "B", "C"],
      ["B", "D"],
    ]);
  });

  it("separates two components joined by a single section", () => {
    const {nodesArray} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}, D: {x: 300}, E: {x: 400}, F: {x: 500}},
      trainruns: [
        ["A", "B", "C"],
        ["A", "B", "C"],
        ["D", "E", "F"],
        ["D", "E", "F"],
        ["C", "D"], // lone bridging section: dropped, the cores stay split
      ],
    });

    expect(asNames(getComponents(nodesArray))).toEqual([
      ["A", "B", "C"],
      ["D", "E", "F"],
    ]);
  });

  it("separates two components joined by a single trainrun through a shared node", () => {
    const {nodesArray} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: -100}, C: {x: -200}, D: {x: 100}, E: {x: 200}},
      trainruns: [
        ["A", "B", "C"],
        ["A", "B", "C"],
        ["A", "D", "E"],
        ["A", "D", "E"],
        ["C", "B", "A", "D", "E"], // lone trainrun passing through A
      ],
    });

    expect(asNames(getComponents(nodesArray))).toEqual([
      ["A", "B", "C"],
      ["A", "D", "E"],
    ]);
  });

  it("separates two components connected at several single-trainrun points", () => {
    const {nodesArray} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}, D: {x: 300}, E: {x: 400}, F: {x: 500}},
      trainruns: [
        ["A", "B", "C"],
        ["A", "B", "C"],
        ["D", "E", "F"],
        ["D", "E", "F"],
        ["C", "D"], // two lone bridges, neither a graph cut-edge but each a single
        ["A", "F"], // trainrun, so both are dropped
      ],
    });

    expect(asNames(getComponents(nodesArray))).toEqual([
      ["A", "B", "C"],
      ["D", "E", "F"],
    ]);
  });

  it("keeps two components joined by a parallel through bundle together", () => {
    const {nodesArray} = buildNetwork({
      nodes: {A: {x: 0}, B: {x: 100}, C: {x: 200}, D: {x: 300}, E: {x: 400}, F: {x: 500}},
      trainruns: [
        ["A", "B", "C"],
        ["A", "B", "C"],
        ["D", "E", "F"],
        ["D", "E", "F"],
        ["B", "C", "D", "E"], // parallel through bundle binds both sides via C and D
        ["B", "C", "D", "E"],
      ],
    });

    expect(asNames(getComponents(nodesArray))).toEqual([["A", "B", "C", "D", "E", "F"]]);
  });
});
