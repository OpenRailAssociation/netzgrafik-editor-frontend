import {Vec2D} from "../../utils/vec2D";
import {
  BEZIER_CONTROL_POINT_FACTOR,
  BEZIER_CONTROL_SAME_ALIGNMENT_DIFFERENCE,
  NODE_EDGE_WIDTH,
  NODE_TEXT_AREA_HEIGHT,
  TRAINRUN_SECTION_LINE_AREA_SPAN,
  TRAINRUN_SECTION_LINE_TEXT_HEIGHT,
  TRAINRUN_SECTION_PORT_SPAN_HORIZONTAL,
  TRAINRUN_SECTION_PORT_SPAN_VERTICAL,
  TRAINRUN_SECTION_TIME_BOTTOM,
  TRAINRUN_SECTION_TIME_CENTER,
  TRAINRUN_SECTION_TIME_CLOSE_NODE,
  TRAINRUN_SECTION_TIME_FAR_NODE,
  TRAINRUN_SECTION_TIME_TOP,
  TRANSITION_LINE_AREA_SPAN,
} from "../../view/rastering/definitions";
import {
  PortAlignment,
  TrainrunSectionText,
  TrainrunSectionTextPositions,
} from "../../data-structures/technical.data.structures";
import {Node} from "../../models/node.model";
import {Port} from "../../models/port.model";
import {TrainrunSection} from "src/app/models/trainrunsection.model";

export class SimpleTrainrunSectionRouter {
  static isLineVertical(sourcePort: Port): boolean {
    return (
      sourcePort.getPositionAlignment() === PortAlignment.Top ||
      sourcePort.getPositionAlignment() === PortAlignment.Bottom
    );
  }

  static getPortPositionForTrainrunSectionRouting(node: Node, port: Port): Vec2D {
    const topLeftPosition = new Vec2D(node.getPositionX(), node.getPositionY());

    let x = 0;
    let y = 0;
    if (port.getPositionAlignment() === PortAlignment.Top) {
      x =
        topLeftPosition.getX() +
        TRAINRUN_SECTION_PORT_SPAN_VERTICAL * (0.5 + port.getPositionIndex());
      y = topLeftPosition.getY() - NODE_EDGE_WIDTH;
    } else if (port.getPositionAlignment() === PortAlignment.Bottom) {
      x =
        topLeftPosition.getX() +
        TRAINRUN_SECTION_PORT_SPAN_VERTICAL * (0.5 + port.getPositionIndex());
      y = topLeftPosition.getY() + node.getNodeHeight() + NODE_EDGE_WIDTH;
    } else if (port.getPositionAlignment() === PortAlignment.Left) {
      x = topLeftPosition.getX() - NODE_EDGE_WIDTH;
      y =
        topLeftPosition.getY() +
        TRAINRUN_SECTION_PORT_SPAN_HORIZONTAL * (0.5 + port.getPositionIndex());
    } else if (port.getPositionAlignment() === PortAlignment.Right) {
      x = topLeftPosition.getX() + node.getNodeWidth() + NODE_EDGE_WIDTH;
      y =
        topLeftPosition.getY() +
        TRAINRUN_SECTION_PORT_SPAN_HORIZONTAL * (0.5 + port.getPositionIndex());
    }

    return new Vec2D(x, y);
  }

  static getPortPositionForTransitionAndConnectionRouting(node: Node, port: Port): Vec2D {
    const topLeftPosition = new Vec2D(node.getPositionX(), node.getPositionY());

    let x = 0;
    let y = 0;
    if (port.getPositionAlignment() === PortAlignment.Top) {
      x =
        topLeftPosition.getX() +
        TRAINRUN_SECTION_PORT_SPAN_VERTICAL * (0.5 + port.getPositionIndex());
      y = topLeftPosition.getY();
    } else if (port.getPositionAlignment() === PortAlignment.Bottom) {
      x =
        topLeftPosition.getX() +
        TRAINRUN_SECTION_PORT_SPAN_VERTICAL * (0.5 + port.getPositionIndex());
      y = topLeftPosition.getY() + node.getNodeHeight() - NODE_TEXT_AREA_HEIGHT;
    } else if (port.getPositionAlignment() === PortAlignment.Left) {
      x = topLeftPosition.getX();
      y =
        topLeftPosition.getY() +
        TRAINRUN_SECTION_PORT_SPAN_HORIZONTAL * (0.5 + port.getPositionIndex());
    } else if (port.getPositionAlignment() === PortAlignment.Right) {
      x = topLeftPosition.getX() + node.getNodeWidth();
      y =
        topLeftPosition.getY() +
        TRAINRUN_SECTION_PORT_SPAN_HORIZONTAL * (0.5 + port.getPositionIndex());
    }

    return new Vec2D(x, y);
  }

  static getSimpleTrainrunSectionFirstPoint(portPosition: Vec2D, port: Port): Vec2D | undefined {
    if (port.getPositionAlignment() === PortAlignment.Top) {
      return Vec2D.add(
        portPosition,
        Vec2D.scale(Vec2D.getNorthVec2D(), TRAINRUN_SECTION_LINE_AREA_SPAN),
      );
    } else if (port.getPositionAlignment() === PortAlignment.Bottom) {
      return Vec2D.add(
        portPosition,
        Vec2D.scale(Vec2D.getSouthVec2D(), TRAINRUN_SECTION_LINE_AREA_SPAN),
      );
    } else if (port.getPositionAlignment() === PortAlignment.Left) {
      return Vec2D.add(
        portPosition,
        Vec2D.scale(Vec2D.getWestVec2D(), TRAINRUN_SECTION_LINE_AREA_SPAN),
      );
    } else if (port.getPositionAlignment() === PortAlignment.Right) {
      return Vec2D.add(
        portPosition,
        Vec2D.scale(Vec2D.getEastVec2D(), TRAINRUN_SECTION_LINE_AREA_SPAN),
      );
    }
    return undefined;
  }

  static getSimpleTransitionFirstPoint(
    portPosition: Vec2D,
    port: Port,
    scaleFactor: number,
  ): Vec2D | undefined {
    if (port.getPositionAlignment() === PortAlignment.Top) {
      return Vec2D.add(portPosition, Vec2D.scale(Vec2D.getSouthVec2D(), scaleFactor));
    } else if (port.getPositionAlignment() === PortAlignment.Bottom) {
      return Vec2D.add(portPosition, Vec2D.scale(Vec2D.getNorthVec2D(), scaleFactor));
    } else if (port.getPositionAlignment() === PortAlignment.Left) {
      return Vec2D.add(portPosition, Vec2D.scale(Vec2D.getEastVec2D(), scaleFactor));
    } else if (port.getPositionAlignment() === PortAlignment.Right) {
      return Vec2D.add(portPosition, Vec2D.scale(Vec2D.getWestVec2D(), scaleFactor));
    }
    return undefined;
  }

  static getBezierCurveControlPoint(
    portPosition: Vec2D,
    port: Port,
    oppositePortPosition: Vec2D,
  ): Vec2D | undefined {
    if (port.getPositionAlignment() === PortAlignment.Top) {
      const diff = SimpleTrainrunSectionRouter.getAbsoluteYDifference(
        portPosition,
        oppositePortPosition,
      );
      return Vec2D.add(
        portPosition,
        Vec2D.scale(Vec2D.getSouthVec2D(), diff * BEZIER_CONTROL_POINT_FACTOR),
      );
    } else if (port.getPositionAlignment() === PortAlignment.Bottom) {
      const diff = SimpleTrainrunSectionRouter.getAbsoluteYDifference(
        portPosition,
        oppositePortPosition,
      );
      return Vec2D.add(
        portPosition,
        Vec2D.scale(Vec2D.getNorthVec2D(), diff * BEZIER_CONTROL_POINT_FACTOR),
      );
    } else if (port.getPositionAlignment() === PortAlignment.Left) {
      const diff = SimpleTrainrunSectionRouter.getAbsoluteXDifference(
        portPosition,
        oppositePortPosition,
      );
      return Vec2D.add(
        portPosition,
        Vec2D.scale(Vec2D.getEastVec2D(), diff * BEZIER_CONTROL_POINT_FACTOR),
      );
    } else if (port.getPositionAlignment() === PortAlignment.Right) {
      const diff = SimpleTrainrunSectionRouter.getAbsoluteXDifference(
        portPosition,
        oppositePortPosition,
      );
      return Vec2D.add(
        portPosition,
        Vec2D.scale(Vec2D.getWestVec2D(), diff * BEZIER_CONTROL_POINT_FACTOR),
      );
    }
    return undefined;
  }

  static getAbsoluteYDifference(position1: Vec2D, position2: Vec2D) {
    const diff = Math.abs(position1.getY() - position2.getY());
    return diff !== 0 ? diff : BEZIER_CONTROL_SAME_ALIGNMENT_DIFFERENCE;
  }

  static getAbsoluteXDifference(position1: Vec2D, position2: Vec2D) {
    const diff = Math.abs(position1.getX() - position2.getX());
    return diff !== 0 ? diff : BEZIER_CONTROL_SAME_ALIGNMENT_DIFFERENCE;
  }

  static computePath(
    firstSection: TrainrunSection,
    lastSection: TrainrunSection = firstSection,
  ): Vec2D[] {
    const sourceNode = firstSection.getSourceNode();
    const sourcePort = sourceNode.getPort(firstSection.getSourcePortId());
    const targetNode = lastSection.getTargetNode();
    const targetPort = targetNode.getPort(lastSection.getTargetPortId());

    const s = SimpleTrainrunSectionRouter.getPortPositionForTrainrunSectionRouting(
      sourceNode,
      sourcePort,
    );
    const t = SimpleTrainrunSectionRouter.getPortPositionForTrainrunSectionRouting(
      targetNode,
      targetPort,
    );
    const s1 = SimpleTrainrunSectionRouter.getSimpleTrainrunSectionFirstPoint(s, sourcePort);
    const t1 = SimpleTrainrunSectionRouter.getSimpleTrainrunSectionFirstPoint(t, targetPort);

    return [s, s1, t1, t];
  }

  static routeTransition(node: Node, port1: Port, port2: Port): Vec2D[] {
    const s = SimpleTrainrunSectionRouter.getPortPositionForTransitionAndConnectionRouting(
      node,
      port1,
    );
    const t = SimpleTrainrunSectionRouter.getPortPositionForTransitionAndConnectionRouting(
      node,
      port2,
    );
    const isPort1TopBottom =
      port1.getPositionAlignment() === PortAlignment.Top ||
      port1.getPositionAlignment() === PortAlignment.Bottom;
    const isPort2TopBottom =
      port2.getPositionAlignment() === PortAlignment.Top ||
      port2.getPositionAlignment() === PortAlignment.Bottom;
    if (isPort1TopBottom === isPort2TopBottom) {
      const diag1 = SimpleTrainrunSectionRouter.getSimpleTransitionFirstPoint(
        s,
        port1,
        0.5 * TRANSITION_LINE_AREA_SPAN,
      );
      const diag2 = SimpleTrainrunSectionRouter.getSimpleTransitionFirstPoint(
        t,
        port2,
        0.5 * TRANSITION_LINE_AREA_SPAN,
      );
      return [s, diag1, diag2, t];
    }
    const s1 = SimpleTrainrunSectionRouter.getSimpleTransitionFirstPoint(
      s,
      port1,
      TRANSITION_LINE_AREA_SPAN,
    );
    const t1 = SimpleTrainrunSectionRouter.getSimpleTransitionFirstPoint(
      t,
      port2,
      TRANSITION_LINE_AREA_SPAN,
    );
    if (port1.getPositionAlignment() === PortAlignment.Left) {
      const c = new Vec2D(t1.getX(), s1.getY());
      const dS = Vec2D.scale(Vec2D.normalize(Vec2D.sub(s, c)), TRANSITION_LINE_AREA_SPAN);
      const dT = Vec2D.scale(Vec2D.normalize(Vec2D.sub(t, c)), TRANSITION_LINE_AREA_SPAN);
      return [s, Vec2D.add(c, dS), Vec2D.add(c, dT), t];
    }
    if (port1.getPositionAlignment() === PortAlignment.Right) {
      const c = new Vec2D(t1.getX(), s1.getY());
      const dS = Vec2D.scale(Vec2D.normalize(Vec2D.sub(s, c)), TRANSITION_LINE_AREA_SPAN);
      const dT = Vec2D.scale(Vec2D.normalize(Vec2D.sub(t, c)), TRANSITION_LINE_AREA_SPAN);
      return [s, Vec2D.add(c, dS), Vec2D.add(c, dT), t];
    }
    if (port1.getPositionAlignment() === PortAlignment.Top) {
      const c = new Vec2D(s1.getX(), t1.getY());
      const dS = Vec2D.scale(Vec2D.normalize(Vec2D.sub(s, c)), TRANSITION_LINE_AREA_SPAN);
      const dT = Vec2D.scale(Vec2D.normalize(Vec2D.sub(t, c)), TRANSITION_LINE_AREA_SPAN);
      return [s, Vec2D.add(c, dS), Vec2D.add(c, dT), t];
    }
    if (port1.getPositionAlignment() === PortAlignment.Bottom) {
      const c = new Vec2D(s1.getX(), t1.getY());
      const dS = Vec2D.scale(Vec2D.normalize(Vec2D.sub(s, c)), TRANSITION_LINE_AREA_SPAN);
      const dT = Vec2D.scale(Vec2D.normalize(Vec2D.sub(t, c)), TRANSITION_LINE_AREA_SPAN);
      return [s, Vec2D.add(c, dS), Vec2D.add(c, dT), t];
    }
    return [s, s1, t1, t];
  }

  static routeConnection(node: Node, port1: Port, port2: Port): Vec2D[] {
    // https://developer.mozilla.org/de/docs/Web/SVG/Tutorial/Pfade
    const start = SimpleTrainrunSectionRouter.getPortPositionForTransitionAndConnectionRouting(
      node,
      port1,
    );
    const end = SimpleTrainrunSectionRouter.getPortPositionForTransitionAndConnectionRouting(
      node,
      port2,
    );
    const controlPointStart = SimpleTrainrunSectionRouter.getBezierCurveControlPoint(
      start,
      port1,
      end,
    );
    const controlPointEnd = SimpleTrainrunSectionRouter.getBezierCurveControlPoint(
      end,
      port2,
      start,
    );
    return [start, controlPointStart, controlPointEnd, end];
  }

  static computeTextPositions(
    lineWayPoints: Vec2D[],
    sourcePort: Port,
  ): TrainrunSectionTextPositions {
    const s = lineWayPoints[0];
    const s1 = lineWayPoints[1];
    const t1 = lineWayPoints[2];
    const t = lineWayPoints[3];

    const deltaS: Vec2D = Vec2D.normalize(Vec2D.sub(s1, s));
    const rDeltaS: Vec2D = Vec2D.rot90(deltaS);

    let deltaSt: Vec2D = Vec2D.normalize(Vec2D.sub(s1, t1));
    let namePosOffsetDirection = Vec2D.scale(
      Vec2D.getSouthVec2D(),
      -TRAINRUN_SECTION_LINE_TEXT_HEIGHT / 2 + TRAINRUN_SECTION_TIME_TOP,
    );

    let nameNumberOfStopsOffsetDirection = Vec2D.scale(
      Vec2D.getSouthVec2D(),
      -TRAINRUN_SECTION_LINE_TEXT_HEIGHT / 2 + TRAINRUN_SECTION_TIME_TOP,
    );

    if (SimpleTrainrunSectionRouter.isLineVertical(sourcePort)) {
      if (t1.getY() < s1.getY()) {
        deltaSt = Vec2D.normalize(Vec2D.sub(t1, s1));
      }
      namePosOffsetDirection = Vec2D.scale(
        Vec2D.getWestVec2D(),
        TRAINRUN_SECTION_LINE_TEXT_HEIGHT / 2 + TRAINRUN_SECTION_TIME_BOTTOM,
      );
      if (deltaSt.getX() < 0.0) {
        namePosOffsetDirection = Vec2D.scale(
          Vec2D.getEastVec2D(),
          TRAINRUN_SECTION_LINE_TEXT_HEIGHT / 2 + TRAINRUN_SECTION_TIME_BOTTOM,
        );
      }
      nameNumberOfStopsOffsetDirection = Vec2D.scale(
        Vec2D.getWestVec2D(),
        TRAINRUN_SECTION_LINE_TEXT_HEIGHT / 2 + TRAINRUN_SECTION_TIME_BOTTOM,
      );
      if (deltaSt.getX() >= 0.0) {
        nameNumberOfStopsOffsetDirection = Vec2D.scale(
          Vec2D.getEastVec2D(),
          TRAINRUN_SECTION_LINE_TEXT_HEIGHT / 2 + TRAINRUN_SECTION_TIME_BOTTOM,
        );
      }
    } else {
      if (t1.getX() < s1.getX()) {
        deltaSt = Vec2D.normalize(Vec2D.sub(t1, s1));
      }
      namePosOffsetDirection = Vec2D.scale(
        Vec2D.getSouthVec2D(),
        TRAINRUN_SECTION_LINE_TEXT_HEIGHT / 2 + TRAINRUN_SECTION_TIME_BOTTOM,
      );
      if (deltaSt.getX() < 0.0) {
        namePosOffsetDirection = Vec2D.scale(
          Vec2D.getNorthVec2D(),
          TRAINRUN_SECTION_LINE_TEXT_HEIGHT / 2 + TRAINRUN_SECTION_TIME_BOTTOM,
        );
      }

      nameNumberOfStopsOffsetDirection = Vec2D.scale(
        Vec2D.getSouthVec2D(),
        TRAINRUN_SECTION_LINE_TEXT_HEIGHT / 2 + TRAINRUN_SECTION_TIME_BOTTOM,
      );
      if (deltaSt.getX() > 0.0) {
        nameNumberOfStopsOffsetDirection = Vec2D.scale(
          Vec2D.getNorthVec2D(),
          TRAINRUN_SECTION_LINE_TEXT_HEIGHT / 2 + TRAINRUN_SECTION_TIME_BOTTOM,
        );
      }
    }

    const sourceArrivalPos = Vec2D.add(
      Vec2D.add(
        s,
        Vec2D.scale(deltaS, TRAINRUN_SECTION_TIME_CENTER - TRAINRUN_SECTION_TIME_FAR_NODE),
      ),
      Vec2D.scale(rDeltaS, TRAINRUN_SECTION_LINE_TEXT_HEIGHT / 2 + TRAINRUN_SECTION_TIME_BOTTOM),
    );
    const sourceDeparturePos = Vec2D.add(
      Vec2D.add(
        s,
        Vec2D.scale(deltaS, TRAINRUN_SECTION_TIME_CENTER - TRAINRUN_SECTION_TIME_CLOSE_NODE),
      ),
      Vec2D.scale(rDeltaS, -TRAINRUN_SECTION_LINE_TEXT_HEIGHT / 2 + TRAINRUN_SECTION_TIME_TOP),
    );
    const targetArrivalPos = Vec2D.add(
      Vec2D.add(
        t,
        Vec2D.scale(deltaS, -(TRAINRUN_SECTION_TIME_CENTER - TRAINRUN_SECTION_TIME_FAR_NODE)),
      ),
      Vec2D.scale(rDeltaS, -(TRAINRUN_SECTION_LINE_TEXT_HEIGHT / 2 + TRAINRUN_SECTION_TIME_BOTTOM)),
    );
    const targetDeparturePos = Vec2D.add(
      Vec2D.add(
        t,
        Vec2D.scale(deltaS, -(TRAINRUN_SECTION_TIME_CENTER - TRAINRUN_SECTION_TIME_CLOSE_NODE)),
      ),
      Vec2D.scale(rDeltaS, -(-TRAINRUN_SECTION_LINE_TEXT_HEIGHT / 2 + TRAINRUN_SECTION_TIME_TOP)),
    );
    const trainrunSectionNamePos = Vec2D.add(
      Vec2D.scale(Vec2D.add(s1, t1), 0.5),
      namePosOffsetDirection,
    );

    const trainrunSectionNumberOfStopsPos = Vec2D.add(
      Vec2D.scale(Vec2D.add(s1, t1), 0.5),
      nameNumberOfStopsOffsetDirection,
    );

    return {
      [TrainrunSectionText.SourceArrival]: sourceArrivalPos.toPointDto(),
      [TrainrunSectionText.SourceDeparture]: sourceDeparturePos.toPointDto(),
      [TrainrunSectionText.TargetArrival]: targetArrivalPos.toPointDto(),
      [TrainrunSectionText.TargetDeparture]: targetDeparturePos.toPointDto(),
      [TrainrunSectionText.TrainrunSectionName]: trainrunSectionNamePos.toPointDto(),
      [TrainrunSectionText.TrainrunSectionTravelTime]: trainrunSectionNamePos.toPointDto(),
      [TrainrunSectionText.TrainrunSectionNumberOfStops]:
        trainrunSectionNumberOfStopsPos.toPointDto(),
    };
  }
}
