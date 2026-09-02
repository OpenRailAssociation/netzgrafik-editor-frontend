import {ResourceDto} from "../data-structures/business.data.structures";

export class Resource {
  private static currentId = 0;

  private id: number;
  private capacity: number;

  constructor(
    {id, capacity}: ResourceDto = {
      id: Resource.incrementId(),
      capacity: 2,
    },
  ) {
    this.id = id;
    this.capacity = capacity;

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

  getDto(): ResourceDto {
    return {
      id: this.id,
      capacity: this.capacity,
    };
  }
}
