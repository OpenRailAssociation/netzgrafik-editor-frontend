import {Node} from "../../models/node.model";
import {Resource} from "../../models/resource.model";
import {TrainrunSection} from "../../models/trainrunsection.model";

export interface InfrastructureGraphNode {
  nodeId: number;
  resourceId: number | null;
  capacity?: number;
}

export interface InfrastructureGraphSectionResource {
  resourceId: number;
  capacity: number;
}

export interface InfrastructureGraphSection {
  sourceNodeId: number;
  targetNodeId: number;
  resourceIds: number[];
  resources: InfrastructureGraphSectionResource[];
}

/**
 * Read-only infrastructure view of the operational graph.
 * Sections are keyed as undirected node pairs because a physical route can be
 * represented by trainrun sections in both travel directions.
 */
export class InfrastructureGraph {
  private readonly nodesById = new Map<number, InfrastructureGraphNode>();
  private readonly sectionsByNodePair = new Map<string, InfrastructureGraphSection>();
  private readonly resourcesById = new Map<number, Resource>();

  constructor(nodes: Node[], sections: TrainrunSection[], resources: Resource[]) {
    resources.forEach((resource) => this.resourcesById.set(resource.getId(), resource));
    nodes.forEach((node) => this.nodesById.set(node.getId(), this.createNode(node)));
    sections.forEach((section) => this.addSectionResource(section));
  }

  getNode(nodeId: number): InfrastructureGraphNode | undefined {
    return this.nodesById.get(nodeId);
  }

  getNodes(): InfrastructureGraphNode[] {
    return [...this.nodesById.values()];
  }

  getSection(sourceNodeId: number, targetNodeId: number): InfrastructureGraphSection | undefined {
    return this.sectionsByNodePair.get(this.sectionKey(sourceNodeId, targetNodeId));
  }

  getSections(): InfrastructureGraphSection[] {
    return [...this.sectionsByNodePair.values()];
  }

  private createNode(node: Node): InfrastructureGraphNode {
    const resourceId = node.getResourceId();
    const resource = resourceId === null ? undefined : this.resourcesById.get(resourceId);

    return {
      nodeId: node.getId(),
      resourceId,
      ...(resource === undefined ? {} : {capacity: resource.getCapacity()}),
    };
  }

  private addSectionResource(section: TrainrunSection) {
    const resourceId = section.getResourceId();
    if (resourceId === 0 || !this.resourcesById.has(resourceId)) {
      return;
    }

    const sourceNodeId = section.getSourceNodeId();
    const targetNodeId = section.getTargetNodeId();
    const key = this.sectionKey(sourceNodeId, targetNodeId);
    const graphSection = this.sectionsByNodePair.get(key) ?? {
      sourceNodeId: Math.min(sourceNodeId, targetNodeId),
      targetNodeId: Math.max(sourceNodeId, targetNodeId),
      resourceIds: [],
      resources: [],
    };

    if (!graphSection.resourceIds.includes(resourceId)) {
      const resource = this.resourcesById.get(resourceId);
      graphSection.resourceIds.push(resourceId);
      graphSection.resources.push({
        resourceId,
        capacity: resource.getCapacity(),
      });
    }

    this.sectionsByNodePair.set(key, graphSection);
  }

  private sectionKey(sourceNodeId: number, targetNodeId: number): string {
    return `${Math.min(sourceNodeId, targetNodeId)}:${Math.max(sourceNodeId, targetNodeId)}`;
  }
}
