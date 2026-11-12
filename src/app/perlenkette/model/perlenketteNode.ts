import {PerlenketteConnection} from "./perlenketteConnection";
import {Transition} from "../../models/transition.model";
import {PerlenketteTrainrun} from "./perlenketteTrainrun";

export class PerlenketteNode {
  constructor(
    public nodeId: number,
    public shortName: string,
    public fullName: string,
    public connectionTime: number,
    public connections: PerlenketteConnection[],
    public transition: Transition,
    public fristTrainrunPartNode: boolean,
    public lastTrainrunPartNode: boolean,
  ) {}

  isFristTrainrunPartNode(): boolean {
    return this.fristTrainrunPartNode;
  }

  isLastTrainrunPartNode(): boolean {
    return this.lastTrainrunPartNode;
  }

  setLastTrainrunPartNode(flag: boolean) {
    this.lastTrainrunPartNode = flag;
  }

  getConnectionOrderGroup(perlenketteTrainrun: PerlenketteTrainrun): number[] {
    const topNode = perlenketteTrainrun.getTopNode();
    return [
      null,
      this.connections.filter((a) => {
        return a.beginningStationId === topNode.nodeId;
      }).length,
    ];
  }

  getConnectionsTopNodes(perlenketteTrainrun: PerlenketteTrainrun): PerlenketteConnection[] {
    return this.connections.filter((a: PerlenketteConnection) => {
      return a.beginningStationId === perlenketteTrainrun.getTopNode().nodeId;
    });
  }

  /** Whether this node is the top node of the given perlenkette trainrun. */
  isTopNode(perlenketteTrainrun: PerlenketteTrainrun) {
    return this.nodeId === perlenketteTrainrun.getTopNode().nodeId;
  }

  /** Whether this node is the bottom node of the given perlenkette trainrun. */
  isBottomNode(perlenketteTrainrun: PerlenketteTrainrun) {
    return this.nodeId === perlenketteTrainrun.getBottomNode().nodeId;
  }

  getConnectionsBottomNodes(perlenketteTrainrun: PerlenketteTrainrun): PerlenketteConnection[] {
    return this.connections.filter((a: PerlenketteConnection) => {
      return a.beginningStationId !== perlenketteTrainrun.getTopNode().nodeId;
    });
  }

  getConnections(
    perlenketteTrainrun: PerlenketteTrainrun,
    filterTopNode: number,
  ): PerlenketteConnection[] {
    return (
      filterTopNode === null
        ? this.getConnectionsTopNodes(perlenketteTrainrun)
        : this.getConnectionsBottomNodes(perlenketteTrainrun)
    ).sort((a: PerlenketteConnection, b: PerlenketteConnection) => {
      return this.sortLevel0BeginningStations(a, b, perlenketteTrainrun);
    });
  }

  private sortLevel0BeginningStations(
    a: PerlenketteConnection,
    b: PerlenketteConnection,
    perlenketteTrainrun: PerlenketteTrainrun,
  ): number {
    const topNode = perlenketteTrainrun.getTopNode();
    const check1 = a.beginningStationId === topNode.nodeId;
    const check2 = b.beginningStationId === topNode.nodeId;
    if (check1 === check2) {
      return this.sortLevel1CategoryOrder(a, b);
    }
    if (check1) {
      return -1;
    }
    if (check2) {
      return 1;
    }
    return -1;
  }

  private sortLevel1CategoryOrder(a: PerlenketteConnection, b: PerlenketteConnection): number {
    if (a.connectedTrainrun.getCategoryOrder() < b.connectedTrainrun.getCategoryOrder()) {
      return -1;
    }
    if (a.connectedTrainrun.getCategoryOrder() > b.connectedTrainrun.getCategoryOrder()) {
      return 1;
    }
    return this.sortLevel2Title(a, b);
  }

  private sortLevel2Title(a: PerlenketteConnection, b: PerlenketteConnection): number {
    if (a.connectedTrainrun.getTitle() < b.connectedTrainrun.getTitle()) {
      return -1;
    }
    if (a.connectedTrainrun.getTitle() > b.connectedTrainrun.getTitle()) {
      return 1;
    }
    return -1;
  }
}
