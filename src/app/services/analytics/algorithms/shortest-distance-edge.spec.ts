import {Node} from "../../../models/node.model";
import {ShortestDistanceEdge} from "./shortest-distance-edge";

describe("ShortestDistanceEdge", () => {
  it("getFromNode", () => {
    const node1 = new Node();
    const node2 = new Node();
    const edge: ShortestDistanceEdge = new ShortestDistanceEdge(node1, node2, 19, 78, []);
    expect(edge.getFromNode().getId()).toBe(node1.getId());
  });

  it("getToNode", () => {
    const node1 = new Node();
    const node2 = new Node();
    const edge: ShortestDistanceEdge = new ShortestDistanceEdge(node1, node2, 19, 78, []);
    expect(edge.getToNode().getId()).toBe(node2.getId());
  });

  it("getArrivalTime", () => {
    const node1 = new Node();
    const node2 = new Node();
    const edge: ShortestDistanceEdge = new ShortestDistanceEdge(node1, node2, 19, 78, []);
    expect(edge.getArrivalTime()).toBe(78);
  });

  it("getFullDistance", () => {
    const node1 = new Node();
    const node2 = new Node();
    const edge: ShortestDistanceEdge = new ShortestDistanceEdge(node1, node2, 19, 78, []);
    expect(edge.getFullDistance()).toBe(59);
  });

  it("getFromNodeDepartingTrainrunSection - case 1", () => {
    const node1 = new Node();
    const node2 = new Node();
    const edge: ShortestDistanceEdge = new ShortestDistanceEdge(node1, node2, 19, 78, []);
    expect(edge.getFromNodeDepartingTrainrunSection()).toBe(undefined);
  });

  it("getFromNodeDepartingTrainrunSection - case 2", () => {
    const node1 = new Node();
    const node2 = new Node();
    const edge: ShortestDistanceEdge = new ShortestDistanceEdge(node1, node2, 19, 78, []);
    expect(edge.getFromNodeDepartingTrainrunSection()).toBe(undefined);
  });
});
