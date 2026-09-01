import {ResourceDto} from "../data-structures/business.data.structures";
import {
  NodeInfrastructureResource,
  SectionInfrastructureResource,
} from "../types/infrastructure-resource.types";

export class Resource {
  private static currentId = 0;

  private id: number;
  private capacity: number;
  private nodeInfrastructure?: NodeInfrastructureResource;
  private sectionInfrastructure?: SectionInfrastructureResource;

  constructor(
    {id, capacity, nodeInfrastructure, sectionInfrastructure}: ResourceDto = {
      id: Resource.incrementId(),
      capacity: 2,
    },
  ) {
    this.id = id;
    this.capacity = capacity;
    this.nodeInfrastructure = nodeInfrastructure;
    this.sectionInfrastructure = sectionInfrastructure;

    if (Resource.currentId < this.id) {
      Resource.currentId = this.id;
    }
  }

  private static incrementId(): number {
    return ++Resource.currentId;
  }

  getId(): number {
    return this.id;
  }

  getCapacity(): number {
    return this.capacity;
  }

  setCapacity(capacity: number) {
    this.capacity = capacity;
  }

  getNodeInfrastructure(): NodeInfrastructureResource | undefined {
    return this.nodeInfrastructure;
  }

  setNodeInfrastructure(nodeInfrastructure: NodeInfrastructureResource | undefined) {
    this.nodeInfrastructure = nodeInfrastructure;
  }

  getSectionInfrastructure(): SectionInfrastructureResource | undefined {
    return this.sectionInfrastructure;
  }

  setSectionInfrastructure(sectionInfrastructure: SectionInfrastructureResource | undefined) {
    this.sectionInfrastructure = sectionInfrastructure;
  }

  getDto(): ResourceDto {
    return {
      id: this.id,
      capacity: this.capacity,
      ...(this.nodeInfrastructure === undefined
        ? {}
        : {nodeInfrastructure: this.nodeInfrastructure}),
      ...(this.sectionInfrastructure === undefined
        ? {}
        : {sectionInfrastructure: this.sectionInfrastructure}),
    };
  }
}
