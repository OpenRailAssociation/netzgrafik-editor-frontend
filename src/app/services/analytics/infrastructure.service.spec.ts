import {BehaviorSubject} from "rxjs";
import {fakeAsync, tick} from "@angular/core/testing";
import {Resource} from "../../models/resource.model";
import {NodeService} from "../data/node.service";
import {ResourceService} from "../data/resource.service";
import {TrainrunService} from "../data/trainrun.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {InfrastructureService} from "./infrastructure.service";

describe("InfrastructureService", () => {
  it("exposes one normalized track segment for a resource-backed node pair", fakeAsync(() => {
    const nodes = new BehaviorSubject([]);
    const sections = new BehaviorSubject([
      {
        getSourceNodeId: () => 2,
        getTargetNodeId: () => 1,
        getResourceId: () => 8,
        getFrequency: () => 60,
        getSourceDepartureConsecutiveTime: () => 0,
        getTargetArrivalConsecutiveTime: () => 10,
        getTargetDepartureConsecutiveTime: () => 10,
        getSourceArrivalConsecutiveTime: () => 0,
        getTrainrun: () => ({
          isRoundTrip: () => false,
          getTrainrunCategory: () => ({sectionHeadway: 2}),
        }),
      },
    ]);
    const resources = new BehaviorSubject([new Resource({id: 8, capacity: 2})]);
    const trainruns = new BehaviorSubject([]);
    const service = new InfrastructureService(
      {nodes, getNodes: (): never[] => []} as unknown as NodeService,
      {
        trainrunSections: sections,
        getTrainrunSections: () => sections.value,
      } as unknown as TrainrunSectionService,
      {trainruns} as unknown as TrainrunService,
      {resourceObservable: resources, getResources: () => resources.value} as unknown as ResourceService,
    );
    tick();

    expect(service.getSectionInfrastructure(1, 2)).toEqual({
      sourceNodeId: 1,
      targetNodeId: 2,
      resourceIds: [8],
      trackSegments: [[0, 1, 1]],
    });
    trainruns.next([]);
    expect(service.getSectionInfrastructure(2, 1)).toEqual({
      sourceNodeId: 2,
      targetNodeId: 1,
      resourceIds: [8],
      trackSegments: [[0, 1, 1]],
    });
    service.ngOnDestroy();
  }));
});