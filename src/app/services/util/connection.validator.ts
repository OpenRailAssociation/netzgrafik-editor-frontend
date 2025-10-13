import {Connection} from "../../models/connection.model";
import {Node} from "../../models/node.model";
import {Port} from "../../models/port.model";
import {Transition} from "../../models/transition.model";

export class ConnectionValidator {
  static validateConnection(connection: Connection, node: Node): boolean {
    const portId1 = connection.getPortId1();
    const portId2 = connection.getPortId2();

    const port1 = node.getPort(portId1);
    const port2 = node.getPort(portId2);

    const transitions = node
      .getTransitions()
      .filter(
        (t: Transition) =>
          t.getPortId1() === portId1 ||
          t.getPortId1() === portId2 ||
          t.getPortId2() === portId1 ||
          t.getPortId2() === portId2,
      );
    let nonStopConnectionError = false;
    transitions.forEach((t) => {
      if (t.getIsNonStopTransit()) {
        nonStopConnectionError = true;
      }
    });

    if (nonStopConnectionError) {
      connection.setWarning(
        $localize`:@@app.services.util.connection-validator.connection-marked-for-transit.title:Connection marked for transition!`,
        $localize`:@@app.services.util.connection-validator.connection-marked-for-transit.description:Connection marked for transition!`,
      );
    } else {
      connection.resetWarning();
    }
    return nonStopConnectionError;
  }

  private static getDepartureTime(node: Node, port: Port) {
    const trainrunSection = port.getTrainrunSection();
    return node.getDepartureTime(trainrunSection);
  }

  private static getEarliestDeparture(node: Node, port: Port) {
    const connectionTime = node.getConnectionTime();
    const trainrunSection = port.getTrainrunSection();
    const arrivalTime = node.getArrivalTime(trainrunSection);
    return (arrivalTime + connectionTime) % 60;
  }

  public static getShortestConnectionTime(node: Node, port1: Port, port2: Port): number {
    const departureTime = this.getDepartureTime(node, port2);
    const earliestDeparture = this.getEarliestDeparture(node, port1);

    return -(earliestDeparture - departureTime);
  }
}
