import {PerlenketteItem} from "./perlenketteItem";
import {PerlenketteSection} from "./perlenketteSection";
import {PerlenketteConnection} from "./perlenketteConnection";
import {Transition} from "../../models/transition.model";
import {PerlenketteTrainrun} from "./perlenketteTrainrun";

export class PerlenketteNode implements PerlenketteItem {
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

  isPerlenketteNode(): boolean {
    return true;
  }

  getPerlenketteNode(): PerlenketteNode {
    return this;
  }

  isPerlenketteSection(): boolean {
    return false;
  }

  getPerlenketteSection(): PerlenketteSection {
    return undefined;
  }

  getConnectionOrderGroup(perlenketteTrainrun: PerlenketteTrainrun): number[] {
    const nodeTopStartNode = perlenketteTrainrun.pathItems.at(0).getPerlenketteNode();
    return [
      null,
      this.connections.filter((a) => {
        return a.beginningStationId === nodeTopStartNode.nodeId;
      }).length,
    ];
  }

  getConnectionsTopNodes(perlenketteTrainrun: PerlenketteTrainrun): PerlenketteConnection[] {
    return this.connections.filter((a: PerlenketteConnection) => {
      const nodeTopStartNode = perlenketteTrainrun.pathItems.at(0).getPerlenketteNode();
      return a.beginningStationId === nodeTopStartNode.nodeId;
    });
  }

  isTopNode(perlenketteTrainrun: PerlenketteTrainrun) {
    const nodeTopStartNode = perlenketteTrainrun.pathItems.at(0).getPerlenketteNode();
    return this.nodeId === nodeTopStartNode.nodeId;
  }

  isBottomNode(perlenketteTrainrun: PerlenketteTrainrun) {
    const nodeTopStartNode = perlenketteTrainrun.pathItems.at(-1).getPerlenketteNode();
    return this.nodeId === nodeTopStartNode.nodeId;
  }

  getConnectionsBottomNodes(perlenketteTrainrun: PerlenketteTrainrun): PerlenketteConnection[] {
    return this.connections.filter((a: PerlenketteConnection) => {
      const nodeTopStartNode = perlenketteTrainrun.pathItems.at(0).getPerlenketteNode();
      return a.beginningStationId !== nodeTopStartNode.nodeId;
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
    const nodeTopStartNode = perlenketteTrainrun.pathItems.at(0).getPerlenketteNode();
    const check1 = a.beginningStationId === nodeTopStartNode.nodeId;
    const check2 = b.beginningStationId === nodeTopStartNode.nodeId;
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
