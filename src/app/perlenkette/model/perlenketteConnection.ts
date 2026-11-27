import {Trainrun} from "../../models/trainrun.model";
import {Port} from "../../models/port.model";
import {Connection} from "../../models/connection.model";
import {Node} from "../../models/node.model";

export class PerlenketteConnection {
  constructor(
    readonly title: string,
    readonly categoryShortName: string,
    readonly beginningStation: string,
    readonly beginningStationId: number,
    readonly terminalStation: string,
    readonly terminalStationBackward: string,
    readonly frequency: number,
    readonly connectionWarning: boolean,
    readonly remainingTime: number,
    readonly connectedTrainrun: Trainrun,
    readonly port: Port,
    readonly id: number,
    readonly nodeId: number,
    readonly connection: Connection,
    readonly node: Node,
  ) {}
}
