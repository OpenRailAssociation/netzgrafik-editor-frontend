import {Injectable} from "@angular/core";
import {BehaviorSubject} from "rxjs";
import {Resource} from "../../models/resource.model";
import {ResourceDto} from "../../data-structures/business.data.structures";

@Injectable({
  providedIn: "root",
})
export class ResourceService {
  // Description of observable data service: https://coryrylan.com/blog/angular-observable-data-services
  resourceSubject = new BehaviorSubject<Resource[]>([]);
  readonly resourceObservable = this.resourceSubject.asObservable();
  resourceStore: {resources: Resource[]} = {resources: []}; // store the data in memory

  setResourceData(resourceDto: ResourceDto[]) {
    this.resourceStore.resources = resourceDto.map((trainrunDto) => new Resource(trainrunDto));
  }

  getResource(resourceId: number): Resource {
    return this.resourceStore.resources.find((res: Resource) => res.getId() === resourceId);
  }

  clearUnlinkedResources(validResourceIds: number[]) {
    // Filters the resources in the resource store to retain only those resources
    // that are linked by their IDs to the provided array of linked resource IDs.
    // Any resource whose ID is not included in the `linkedResourceIds` array will
    // be removed from the resource store.
    // linkedResourceIds - An array of linked resource IDs.
    //                     Only resources with IDs present in this array
    //                     will be retained in the resource store.
    this.resourceStore.resources = this.resourceStore.resources.filter((res) =>
      validResourceIds.includes(res.getId()),
    );
  }

  changeCapacity(resourceId: number, capacity: number, enforceUpdate: boolean = true) {
    this.resourceStore.resources
      .find((res: Resource) => res.getId() === resourceId)
      .setCapacity(capacity);
    if (enforceUpdate) {
      this.resourceUpdated();
    }
  }

  deleteResource(resourceId: number, enforceUpdate: boolean = true) {
    this.resourceStore.resources = this.resourceStore.resources.filter(
      (res: Resource) => res.getId() !== resourceId,
    );
    if (enforceUpdate) {
      this.resourceUpdated();
    }
  }

  createAndGetResource(enforceUpdate: boolean = true): Resource {
    const resource = new Resource();
    this.resourceStore.resources.push(resource);
    if (enforceUpdate) {
      this.resourceUpdated();
    }
    return resource;
  }

  resourceUpdated() {
    this.resourceSubject.next(Object.assign({}, this.resourceStore).resources);
  }

  getDtos() {
    return this.resourceStore.resources.map((resource) => resource.getDto());
  }
}
