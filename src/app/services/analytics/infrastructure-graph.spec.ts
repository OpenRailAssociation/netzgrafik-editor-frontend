import {Node} from "../../models/node.model";
import {Resource} from "../../models/resource.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {InfrastructureGraph} from "./infrastructure-graph";

describe("InfrastructureGraph", () => {
  it("returns node capacity from its referenced resource", () => {
    const nodeResource = new Resource({
      id: 10,
      capacity: 8,
    });
    const graph = new InfrastructureGraph([node(1, 10), node(2, null)], [], [nodeResource]);

    expect(graph.getNode(1)).toEqual({
      nodeId: 1,
      resourceId: 10,
      capacity: 8,
    });
    expect(graph.getNode(2)).toEqual({nodeId: 2, resourceId: null});
  });

  it("groups opposite-direction trainrun sections by node pair and keeps each resource", () => {
    const sectionResource = new Resource({id: 20, capacity: 2});
    const graph = new InfrastructureGraph(
      [],
      [section(1, 2, 20), section(2, 1, 20)],
      [sectionResource],
    );

    expect(graph.getSection(2, 1)).toEqual({
      sourceNodeId: 1,
      targetNodeId: 2,
      resourceIds: [20],
      resources: [
        {
          resourceId: 20,
          capacity: 2,
        },
      ],
    });
  });
});

function node(id: number, resourceId: number | null): Node {
  return {
    getId: () => id,
    getResourceId: () => resourceId,
  } as Node;
}

function section(sourceNodeId: number, targetNodeId: number, resourceId: number): TrainrunSection {
  return {
    getSourceNodeId: () => sourceNodeId,
    getTargetNodeId: () => targetNodeId,
    getResourceId: () => resourceId,
  } as TrainrunSection;
}
