import {NodeService} from "../data/node.service";
import {ResourceService} from "../data/resource.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {InfrastructureGraphService} from "./infrastructure-graph.service";

describe("InfrastructureGraphService", () => {
  it("builds an infrastructure graph from the current data-service stores", () => {
    const nodeService = {getNodes: () => []} as NodeService;
    const trainrunSectionService = {getTrainrunSections: () => []} as TrainrunSectionService;
    const resourceService = {getResources: () => []} as ResourceService;
    const service = new InfrastructureGraphService(
      nodeService,
      trainrunSectionService,
      resourceService,
    );

    expect(service.getGraph().getNodes()).toEqual([]);
    expect(service.getGraph().getSections()).toEqual([]);
  });
});
