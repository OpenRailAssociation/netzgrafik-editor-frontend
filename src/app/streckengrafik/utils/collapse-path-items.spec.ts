import {PathItem} from "../model/pathItem";
import {PathNode} from "../model/pathNode";
import {PathSection} from "../model/pathSection";
import {TrackData} from "../model/trackData";
import {collapsePathItems} from "./collapse-path-items";

function node(
  name: string,
  opts: {filter?: boolean; collapsed?: boolean; backward?: boolean} = {},
): PathNode {
  return new PathNode(
    0,
    0,
    0,
    name,
    0,
    new TrackData(1),
    opts.backward ?? false,
    4,
    opts.filter ?? false,
    opts.collapsed ?? false,
  );
}

function section(
  dep: number,
  arr: number,
  opts: {stops?: number; backward?: boolean} = {},
): PathSection {
  return new PathSection(0, dep, arr, opts.stops ?? 0, new TrackData(1), opts.backward ?? false);
}

function serialize(item: PathItem) {
  if (item.isNode()) {
    const n = item.getPathNode();
    return {node: n.nodeShortName, filter: n.filter, collapsed: n.collapsed};
  }
  const s = item.getPathSection();
  return {section: true, dep: s.departureTime, arr: s.arrivalTime, stops: s.numberOfStops};
}

describe("collapsePathItems", () => {
  it("returns empty array unchanged", () => {
    expect(collapsePathItems([])).toEqual([]);
  });

  it("passes through when no nodes are collapsed", () => {
    const items: PathItem[] = [node("A"), section(0, 10), node("B"), section(10, 20), node("C")];
    expect(collapsePathItems(items).map(serialize)).toEqual([
      {node: "A", filter: false, collapsed: false},
      {section: true, dep: 0, arr: 10, stops: 0},
      {node: "B", filter: false, collapsed: false},
      {section: true, dep: 10, arr: 20, stops: 0},
      {node: "C", filter: false, collapsed: false},
    ]);
  });

  it("merges sections across a single collapsed intermediate node", () => {
    const items: PathItem[] = [
      node("A"),
      section(0, 10),
      node("B", {collapsed: true}),
      section(10, 20),
      node("C"),
    ];
    expect(collapsePathItems(items).map(serialize)).toEqual([
      {node: "A", filter: false, collapsed: false},
      {section: true, dep: 0, arr: 20, stops: 1},
      {node: "C", filter: false, collapsed: false},
    ]);
  });

  it("merges sections across multiple consecutive collapsed nodes", () => {
    const items: PathItem[] = [
      node("A"),
      section(0, 5),
      node("B", {collapsed: true}),
      section(5, 10),
      node("C", {collapsed: true}),
      section(10, 20),
      node("D"),
    ];
    expect(collapsePathItems(items).map(serialize)).toEqual([
      {node: "A", filter: false, collapsed: false},
      {section: true, dep: 0, arr: 20, stops: 2},
      {node: "D", filter: false, collapsed: false},
    ]);
  });

  it("accumulates numberOfStops from original sections and collapsed nodes", () => {
    const items: PathItem[] = [
      node("A"),
      section(0, 10, {stops: 2}),
      node("B", {collapsed: true}),
      section(10, 20, {stops: 3}),
      node("C"),
    ];
    // 2 + 3 (original) + 1 (collapsed node B)
    expect(collapsePathItems(items).map(serialize)).toEqual([
      {node: "A", filter: false, collapsed: false},
      {section: true, dep: 0, arr: 20, stops: 6},
      {node: "C", filter: false, collapsed: false},
    ]);
  });

  it("treats edge collapsed nodes as filtered (not merged)", () => {
    const items: PathItem[] = [
      node("A", {collapsed: true}),
      section(0, 10),
      node("B"),
      section(10, 20),
      node("C", {collapsed: true}),
    ];
    expect(collapsePathItems(items).map(serialize)).toEqual([
      {node: "A", filter: true, collapsed: false},
      {section: true, dep: 0, arr: 10, stops: 0},
      {node: "B", filter: false, collapsed: false},
      {section: true, dep: 10, arr: 20, stops: 0},
      {node: "C", filter: true, collapsed: false},
    ]);
  });

  it("handles mix of edge and intermediate collapsed nodes", () => {
    // A(edge) - B(visible) - C(intermediate) - D(visible) - E(edge)
    const items: PathItem[] = [
      node("A", {collapsed: true}),
      section(0, 5),
      node("B"),
      section(5, 10),
      node("C", {collapsed: true}),
      section(10, 20),
      node("D"),
      section(20, 30),
      node("E", {collapsed: true}),
    ];
    expect(collapsePathItems(items).map(serialize)).toEqual([
      {node: "A", filter: true, collapsed: false},
      {section: true, dep: 0, arr: 5, stops: 0},
      {node: "B", filter: false, collapsed: false},
      {section: true, dep: 5, arr: 20, stops: 1},
      {node: "D", filter: false, collapsed: false},
      {section: true, dep: 20, arr: 30, stops: 0},
      {node: "E", filter: true, collapsed: false},
    ]);
  });

  it("uncollapses first and last when all nodes are collapsed", () => {
    const items: PathItem[] = [
      node("A", {collapsed: true}),
      section(0, 10),
      node("B", {collapsed: true}),
      section(10, 20),
      node("C", {collapsed: true}),
    ];
    expect(collapsePathItems(items).map(serialize)).toEqual([
      {node: "A", filter: false, collapsed: false},
      {section: true, dep: 0, arr: 20, stops: 1},
      {node: "C", filter: false, collapsed: false},
    ]);
  });

  it("uncollapses both when only two collapsed nodes exist", () => {
    const items: PathItem[] = [
      node("A", {collapsed: true}),
      section(0, 10),
      node("B", {collapsed: true}),
    ];
    expect(collapsePathItems(items).map(serialize)).toEqual([
      {node: "A", filter: false, collapsed: false},
      {section: true, dep: 0, arr: 10, stops: 0},
      {node: "B", filter: false, collapsed: false},
    ]);
  });

  it("uncollapses single collapsed node", () => {
    expect(collapsePathItems([node("A", {collapsed: true})]).map(serialize)).toEqual([
      {node: "A", filter: false, collapsed: false},
    ]);
  });

  it("treats trailing collapsed nodes after last visible as filtered", () => {
    const items: PathItem[] = [
      node("A"),
      section(0, 10),
      node("B"),
      section(10, 20),
      node("C", {collapsed: true}),
      section(20, 30),
      node("D", {collapsed: true}),
    ];
    expect(collapsePathItems(items).map(serialize)).toEqual([
      {node: "A", filter: false, collapsed: false},
      {section: true, dep: 0, arr: 10, stops: 0},
      {node: "B", filter: false, collapsed: false},
      {section: true, dep: 10, arr: 20, stops: 0},
      {node: "C", filter: true, collapsed: false},
      {section: true, dep: 20, arr: 30, stops: 0},
      {node: "D", filter: true, collapsed: false},
    ]);
  });

  it("does not modify nodes that are only filtered", () => {
    const items: PathItem[] = [
      node("A", {filter: true}),
      section(0, 10),
      node("B"),
      section(10, 20),
      node("C", {filter: true}),
    ];
    expect(collapsePathItems(items).map(serialize)).toEqual([
      {node: "A", filter: true, collapsed: false},
      {section: true, dep: 0, arr: 10, stops: 0},
      {node: "B", filter: false, collapsed: false},
      {section: true, dep: 10, arr: 20, stops: 0},
      {node: "C", filter: true, collapsed: false},
    ]);
  });

  it("processes forward and backward items independently", () => {
    const items: PathItem[] = [
      node("A"),
      section(0, 10),
      node("B", {collapsed: true}),
      section(10, 20),
      node("C"),
      node("C", {backward: true}),
      section(20, 10, {backward: true}),
      node("B", {collapsed: true, backward: true}),
      section(10, 0, {backward: true}),
      node("A", {backward: true}),
    ];
    const result = collapsePathItems(items);
    expect(result.filter((i) => !i.backward).map(serialize)).toEqual([
      {node: "A", filter: false, collapsed: false},
      {section: true, dep: 0, arr: 20, stops: 1},
      {node: "C", filter: false, collapsed: false},
    ]);
    expect(result.filter((i) => i.backward).map(serialize)).toEqual([
      {node: "C", filter: false, collapsed: false},
      {section: true, dep: 20, arr: 0, stops: 1},
      {node: "A", filter: false, collapsed: false},
    ]);
  });
});
