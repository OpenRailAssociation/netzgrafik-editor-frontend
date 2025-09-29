import {Vec2D} from "../../utils/vec2D";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {Node} from "../../models/node.model";
import {NODE_MIN_HEIGHT, NODE_MIN_WIDTH} from "../../view/rastering/definitions";

export interface NodePortPlacement {
  sourcePortPlacement: PortAlignment;
  targetPortPlacement: PortAlignment;
}

export class VisAVisPortPlacement {
  static drawVerticalLine(posStart: Vec2D, posEnd: Vec2D) {
    const delta: Vec2D = Vec2D.sub(posStart, posEnd);
    return Math.abs(delta.getX()) < Math.abs(delta.getY());
  }

  static placePortsOnSourceAndTargetNode(sourceNode: Node, targetNode: Node): NodePortPlacement {
    const posStart: Vec2D = Vec2D.add(
      new Vec2D(sourceNode.getPositionX(), sourceNode.getPositionY()),
      new Vec2D(NODE_MIN_WIDTH / 2, NODE_MIN_HEIGHT / 2),
    );
    const posEnd: Vec2D = Vec2D.add(
      new Vec2D(targetNode.getPositionX(), targetNode.getPositionY()),
      new Vec2D(NODE_MIN_WIDTH / 2, NODE_MIN_HEIGHT / 2),
    );

    if (VisAVisPortPlacement.drawVerticalLine(posStart, posEnd)) {
      if (posStart.getY() < posEnd.getY()) {
        return {
          sourcePortPlacement: PortAlignment.Bottom,
          targetPortPlacement: PortAlignment.Top,
        };
      } else {
        return {
          sourcePortPlacement: PortAlignment.Top,
          targetPortPlacement: PortAlignment.Bottom,
        };
      }
    } else {
      if (posStart.getX() < posEnd.getX()) {
        return {
          sourcePortPlacement: PortAlignment.Right,
          targetPortPlacement: PortAlignment.Left,
        };
      } else {
        return {
          sourcePortPlacement: PortAlignment.Left,
          targetPortPlacement: PortAlignment.Right,
        };
      }
    }
  }
}
