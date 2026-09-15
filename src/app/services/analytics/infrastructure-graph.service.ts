import {Injectable} from "@angular/core";
import {NodeService} from "../data/node.service";
import {ResourceService} from "../data/resource.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {InfrastructureGraph} from "./infrastructure-graph";

@Injectable({
  providedIn: "root",
})
export class InfrastructureGraphService {
  constructor(
    private readonly nodeService: NodeService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly resourceService: ResourceService,
  ) {}

  getGraph(): InfrastructureGraph {
    return new InfrastructureGraph(
      this.nodeService.getNodes(),
      this.trainrunSectionService.getTrainrunSections(),
      this.resourceService.getResources(),
    );
  }
}
