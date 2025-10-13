import {Injectable, OnDestroy} from "@angular/core";
import {NodeService} from "../data/node.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {TrainrunService} from "../data/trainrun.service";
import {ShortestTravelTimeSearch} from "./algorithms/shortest-travel-time-search";
import {BehaviorSubject, Subject} from "rxjs";
import {ShortestDistanceNode} from "./algorithms/shortest-distance-node";
import {FilterService} from "../ui/filter.service";

@Injectable({
  providedIn: "root",
})
export class AnalyticsService implements OnDestroy {
  findAllShortestDistanceNodesSubject = new BehaviorSubject<ShortestDistanceNode[]>([]);
  readonly shortestDistanceNode = this.findAllShortestDistanceNodesSubject.asObservable();
  private destroyed = new Subject<void>();

  constructor(
    private nodeService: NodeService,
    private trainrunSectionService: TrainrunSectionService,
    private trainrunService: TrainrunService,
    private filterService: FilterService,
  ) {}

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  calculateShortestDistanceNodesFromStartingNode(departureNodeId: number) {
    const shortestTravelTimeSearch = new ShortestTravelTimeSearch(
      this.trainrunService,
      this.trainrunSectionService,
      this.nodeService,
      this.filterService,
    );
    this.allShortestDistanceNodesUpdated(
      shortestTravelTimeSearch.calculateShortestDistanceNodesFromStartingNode(departureNodeId),
    );
  }

  calculateShortestDistanceNodesFromStartingTrainrunSection(
    trainrunSectionId: number,
    departureNodeId: number,
  ) {
    const shortestTravelTimeSearch = new ShortestTravelTimeSearch(
      this.trainrunService,
      this.trainrunSectionService,
      this.nodeService,
      this.filterService,
    );
    this.allShortestDistanceNodesUpdated(
      shortestTravelTimeSearch.calculateShortestDistanceNodesFromStartingTrainrunSection(
        trainrunSectionId,
        departureNodeId,
      ),
    );
  }

  private allShortestDistanceNodesUpdated(shortestDistanceNodes: ShortestDistanceNode[]) {
    this.findAllShortestDistanceNodesSubject.next(Object.assign([], shortestDistanceNodes));
  }
}
