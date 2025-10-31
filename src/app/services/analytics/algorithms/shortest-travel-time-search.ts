import {TrainrunSection} from "../../../models/trainrunsection.model";
import {Node} from "../../../models/node.model";
import {Port} from "../../../models/port.model";
import {TrainrunSectionService} from "../../data/trainrunsection.service";
import {NodeService} from "../../data/node.service";
import {TrainrunService} from "../../data/trainrun.service";
import {ShortestDistanceNode} from "./shortest-distance-node";
import {ShortestDistanceEdge} from "./shortest-distance-edge";
import {FilterService} from "../../ui/filter.service";
import {Direction} from "src/app/data-structures/business.data.structures";

//
// The shortest travel time search method is based on the Dijkstra Algorithm.
// https://de.wikipedia.org/wiki/Dijkstra-Algorithmus
//
export class ShortestTravelTimeSearch {
  private simulationChangeTrainPenalty: number;
  private simulationDepartureMinute: number;

  constructor(
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private nodeService: NodeService,
    private filterService: FilterService,
  ) {
    this.simulationDepartureMinute = 0;
    this.simulationChangeTrainPenalty = 0;
  }

  private static getInitialShortestDistanceEdges(
    node: Node,
    initDepartureTime: number,
  ): ShortestDistanceEdge[] {
    const initialEdges: ShortestDistanceEdge[] = [];
    initialEdges.push(
      new ShortestDistanceEdge(node, node, initDepartureTime, initDepartureTime, []),
    );
    return initialEdges;
  }

  private static correctHourOverflowFromToTime(fromTime: number, toTime: number) {
    let correctToTime = toTime;
    if (fromTime > toTime) {
      correctToTime += 60;
    }
    return correctToTime;
  }

  private static getTransitionCost(
    incomingEdge: ShortestDistanceEdge,
    outgoingEdge: ShortestDistanceEdge,
    currentFrequency: number,
    changeTrainPenalty: number,
  ) {
    let arrivalTime = incomingEdge.getArrivalTime();
    let arrivalTrainrunId = -1;
    if (incomingEdge.getToNodeArrivingTrainrunSection() !== undefined) {
      arrivalTime = incomingEdge
        .getToNode()
        .getArrivalTime(incomingEdge.getToNodeArrivingTrainrunSection());
      arrivalTrainrunId = incomingEdge.getToNodeArrivingTrainrunSection().getTrainrunId();
    }

    const departureTimeOrg = outgoingEdge
      .getFromNode()
      .getDepartureTime(outgoingEdge.getFromNodeDepartingTrainrunSection());
    const departureTime = ShortestTravelTimeSearch.correctHourOverflowFromToTime(
      arrivalTime,
      (departureTimeOrg + currentFrequency) % 60,
    );

    let transitionCost = departureTime - arrivalTime;
    if (
      arrivalTrainrunId !== -1 &&
      arrivalTrainrunId !== outgoingEdge.getFromNodeDepartingTrainrunSection().getTrainrunId()
    ) {
      if (transitionCost < outgoingEdge.getFromNode().getConnectionTime()) {
        return undefined;
      }
      transitionCost += changeTrainPenalty;
    }

    return transitionCost;
  }

  private static updateFinalAndStackData(
    outgoingEdge: ShortestDistanceEdge,
    finalShortestDistanceNodes: ShortestDistanceNode[],
    shortestDistanceEdgeStack: ShortestDistanceEdge[],
  ) {
    const shortestDistanceNode = new ShortestDistanceNode(
      outgoingEdge.getToNode(),
      outgoingEdge.getFullDistance(),
    );
    shortestDistanceNode.setPath(outgoingEdge.getFullPath());

    const existingShortestDistanceNode = finalShortestDistanceNodes.find(
      (sdn: ShortestDistanceNode) => sdn.node === shortestDistanceNode.node,
    );
    if (existingShortestDistanceNode === undefined) {
      finalShortestDistanceNodes.push(shortestDistanceNode);
      shortestDistanceEdgeStack.push(outgoingEdge);
    } else {
      if (existingShortestDistanceNode.distance > shortestDistanceNode.distance) {
        finalShortestDistanceNodes = finalShortestDistanceNodes.filter(
          (sdn: ShortestDistanceNode) => sdn.node !== shortestDistanceNode.node,
        );
        finalShortestDistanceNodes.push(shortestDistanceNode);
        shortestDistanceEdgeStack.push(outgoingEdge);
      }
    }
    finalShortestDistanceNodes.sort(
      (a: ShortestDistanceNode, b: ShortestDistanceNode) => a.distance - b.distance,
    );
    return finalShortestDistanceNodes;
  }

  private static isEdgeChangeAllowed(
    incomingEdge: ShortestDistanceEdge,
    departureTrainrunSection: TrainrunSection,
  ): boolean {
    const trans = incomingEdge.getToNode().getTransition(departureTrainrunSection.getId());
    if (trans === undefined) {
      return true;
    }
    return !trans.getIsNonStopTransit();
  }

  private static isDirectionCompatible(
    currentNode: Node,
    departureTrainrunSection: TrainrunSection,
  ): boolean {
    // ROUND_TRIP: always compatible
    // ONE_WAY: only allow if currentNode is the source node
    return (
      departureTrainrunSection.getTrainrun().isRoundTrip() ||
      departureTrainrunSection.getSourceNodeId() === currentNode.getId()
    );
  }

  calculateShortestDistanceNodesFromStartingNode(departureNodeId: number): ShortestDistanceNode[] {
    const departureNode = this.nodeService.getNodeFromId(departureNodeId);
    const initialShortestDistanceNode = new ShortestDistanceNode(departureNode, 0);
    const shortestDistanceEdgeStack: ShortestDistanceEdge[] =
      ShortestTravelTimeSearch.getInitialShortestDistanceEdges(
        departureNode,
        this.getSimulationDepartureMinute(),
      );
    const initialFinalShortestDistanceNodes: ShortestDistanceNode[] = [initialShortestDistanceNode];
    return Object.assign(
      [],
      this.findAllShortestDistanceNodes(
        initialFinalShortestDistanceNodes,
        shortestDistanceEdgeStack,
      ),
    );
  }

  calculateShortestDistanceNodesFromStartingTrainrunSection(
    trainrunSectionId: number,
    departureNodeId: number,
  ): ShortestDistanceNode[] {
    const departureNode = this.nodeService.getNodeFromId(departureNodeId);
    const departureTrainrunSection =
      this.trainrunSectionService.getTrainrunSectionFromId(trainrunSectionId);
    const initialShortestDistanceNodeFrom = new ShortestDistanceNode(departureNode, 0);
    const initialShortestDistanceNodeTo = new ShortestDistanceNode(
      departureNode.getOppositeNode(departureTrainrunSection),
      departureTrainrunSection.getTravelTime(),
    );
    initialShortestDistanceNodeTo.setPath([departureTrainrunSection]);
    const outgoingEdge = this.getOutgoingEdge(departureTrainrunSection, departureNode);
    const shortestDistanceEdgeStack: ShortestDistanceEdge[] = [outgoingEdge];
    let initialFinalShortestDistanceNodes: ShortestDistanceNode[] = [
      initialShortestDistanceNodeFrom,
      initialShortestDistanceNodeTo,
    ];
    initialFinalShortestDistanceNodes = ShortestTravelTimeSearch.updateFinalAndStackData(
      outgoingEdge,
      initialFinalShortestDistanceNodes,
      shortestDistanceEdgeStack,
    );
    return Object.assign(
      [],
      this.findAllShortestDistanceNodes(
        initialFinalShortestDistanceNodes,
        shortestDistanceEdgeStack,
      ),
    );
  }

  // For debugging purposes only
  private printFinalInfo(finalShortestDistanceNodes: ShortestDistanceNode[]) {
    finalShortestDistanceNodes.forEach((snd: ShortestDistanceNode) => {
      console.log(
        snd.node.getBetriebspunktName(),
        "Distanz/Kosten:",
        snd.distance,
        "Anzahl Umsteigen:",
        snd.path
          .map((ts: TrainrunSection) => ts.getTrainrunId())
          .filter((v, i, a) => a.indexOf(v) === i).length - 1,
        "Fahrplan:",
        this.printFinalInfoTimetable(snd),
      );
    });
  }

  // For debugging purposes only
  private printFinalInfoTimetable(snd: ShortestDistanceNode): string {
    const pathArray: string[] = [];
    const revTrainrunSections = Object.assign([], snd.path).reverse();
    let nodeID: number = snd.node.getId();
    let trainID: number;
    pathArray.push("]");
    revTrainrunSections.forEach((ts: TrainrunSection) => {
      if (trainID !== ts.getTrainrunId()) {
        if (trainID !== undefined) {
          pathArray.push("][");
        }
        pathArray.push(
          "(" + ts.getTrainrun().getCategoryShortName() + ts.getTrainrun().getTitle() + ")",
        );
        trainID = ts.getTrainrunId();
      }
      if (ts.getSourceNodeId() !== nodeID) {
        pathArray.push(
          ts.getSourceNode().getBetriebspunktName() +
            "-" +
            ts.getTargetNode().getBetriebspunktName(),
        );
        nodeID = ts.getSourceNodeId();
      } else {
        pathArray.push(
          ts.getTargetNode().getBetriebspunktName() +
            "-" +
            ts.getSourceNode().getBetriebspunktName(),
        );
        nodeID = ts.getTargetNodeId();
      }
    });
    pathArray.push("[");

    pathArray.reverse();
    let retString = "";
    pathArray.forEach((str) => (retString += str + " "));
    return retString;
  }

  private getNextShortestDistanceEdge(edges: ShortestDistanceEdge[]): ShortestDistanceEdge {
    edges.sort(
      (a: ShortestDistanceEdge, b: ShortestDistanceEdge) =>
        b.getFullDistance() - a.getFullDistance(),
    );
    return edges.pop();
  }

  private checkNextEdge(outgoingEdge: ShortestDistanceEdge, transitionTime: number): boolean {
    if (transitionTime === undefined) {
      return false;
    }
    return this.filterService.filterTrainrun(
      outgoingEdge.getFromNodeDepartingTrainrunSection().getTrainrun(),
    );
  }

  private findAllShortestDistanceNodes(
    initialFinalShortestDistanceNodes: ShortestDistanceNode[],
    shortestDistanceEdgeStack: ShortestDistanceEdge[],
  ): ShortestDistanceNode[] {
    // Recommended to read : https://de.wikipedia.org/wiki/Dijkstra-Algorithmus#Algorithmus_in_Pseudocode
    let finalShortestDistanceNodes = Object.assign([], initialFinalShortestDistanceNodes);

    // start with the first edge (if there are more than one edge on the stack, pop the first edge with smallest distance)
    let incomingEdge: ShortestDistanceEdge =
      this.getNextShortestDistanceEdge(shortestDistanceEdgeStack);

    // loop as long there are unvisited edge on the stack
    while (incomingEdge !== undefined) {
      // loop over all (allowed) neighbors (edges)
      incomingEdge
        .getToNode()
        .getPorts()
        .filter((p: Port) => {
          // only allow sections that go "away" from the current node
          const isDirectionCompatible = ShortestTravelTimeSearch.isDirectionCompatible(
            incomingEdge.getToNode(),
            p.getTrainrunSection(),
          );
          const isEdgeChangeAllowed = ShortestTravelTimeSearch.isEdgeChangeAllowed(
            incomingEdge,
            p.getTrainrunSection(),
          );

          return isDirectionCompatible && isEdgeChangeAllowed;
        })
        .forEach((p: Port) => {
          const outgoingTrainrunSection: TrainrunSection = p.getTrainrunSection();

          // loop over all frequency (unroll frequency)
          const frequencyObject = p.getTrainrunSection().getTrainrun().getTrainrunFrequency();
          const frequency = frequencyObject.frequency + frequencyObject.offset;
          let currentFrequency = 0;
          while (currentFrequency < 120) {
            // two hour
            // calculate transition cost (from incoming edge to outgoing edge : arrival at node --> transfer/transit -> departure node
            const outgoingEdge = this.getOutgoingEdge(
              outgoingTrainrunSection,
              incomingEdge.getToNode(),
            );
            const transitionCost = ShortestTravelTimeSearch.getTransitionCost(
              incomingEdge,
              outgoingEdge,
              currentFrequency,
              this.getSimulationChangeTrainPenalty(),
            );

            // check if the new calculated edge is allowed to travers (Business rules)
            if (this.checkNextEdge(outgoingEdge, transitionCost)) {
              // update cost / merge visited paths
              outgoingEdge.mergePathAndUpdateCost(
                incomingEdge.getFullPath(),
                incomingEdge.getFullDistance() + transitionCost,
              );

              // if new edge is not yet visited (calculated) -> add it on the stack
              finalShortestDistanceNodes = ShortestTravelTimeSearch.updateFinalAndStackData(
                outgoingEdge,
                finalShortestDistanceNodes,
                shortestDistanceEdgeStack,
              );
            }
            currentFrequency += frequency;
          }
        });

      // get next edge to visit -> visited the closed (smallest distance) next edge before others (pop)
      incomingEdge = this.getNextShortestDistanceEdge(shortestDistanceEdgeStack);
    }

    // this.printFinalInfo(finalShortestDistanceNodes);
    return finalShortestDistanceNodes;
  }

  private getSimulationDepartureMinute(): number {
    return this.simulationDepartureMinute;
  }

  private getSimulationChangeTrainPenalty(): number {
    return this.simulationChangeTrainPenalty;
  }

  private getOutgoingEdge(trainrunSection: TrainrunSection, node: Node): ShortestDistanceEdge {
    const path: TrainrunSection[] = [];
    const iterator = this.trainrunService.getNextExpandedStopIterator(node, trainrunSection);

    while (iterator.hasNext()) {
      iterator.next();
      path.push(iterator.current().trainrunSection);
    }

    return new ShortestDistanceEdge(
      node,
      iterator.current().node,
      node.getDepartureConsecutiveTime(trainrunSection),
      iterator.current().node.getArrivalConsecutiveTime(iterator.current().trainrunSection),
      path,
    );
  }
}
