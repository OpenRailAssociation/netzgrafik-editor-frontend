import * as d3 from "d3";
import {Vec2D} from "../../utils/vec2D";
import {RASTERING_BASIC_GRID_SIZE} from "../rastering/definitions";
import {Node} from "../../models/node.model";
import {VisAVisPortPlacement} from "../../services/util/node.port.placement";

export class GeneralViewFunctions {
  static calcDialogTopLeftScreenCoordinate(windowsPosition: Vec2D, dialogDimension: Vec2D): Vec2D {
    /*
      The SVG (netzgrafik) rendering area has its own local coordinate system and can be different
      to the real screen visible coordinates.
     */
    const element = d3.select("html").node();
    const rectHtml = element.getBoundingClientRect();

    return GeneralViewFunctions.calcDialogTopLeftScreenCoordinateClientRectInfo(
      windowsPosition,
      dialogDimension,
      rectHtml.top,
      rectHtml.left,
      rectHtml.height,
      rectHtml.width,
    );
  }

  static calcDialogTopLeftScreenCoordinateClientRectInfo(
    windowsPosition: Vec2D,
    dialogDimension: Vec2D,
    clientTop: number,
    clientLeft: number,
    clientHeight: number,
    clientWidth: number,
  ): Vec2D {
    let top: number = windowsPosition.getY() - dialogDimension.getY() - RASTERING_BASIC_GRID_SIZE;
    if (top > clientHeight - dialogDimension.getY() - RASTERING_BASIC_GRID_SIZE) {
      top = clientHeight - dialogDimension.getY() - RASTERING_BASIC_GRID_SIZE;
    }
    if (top < clientTop + RASTERING_BASIC_GRID_SIZE / 2) {
      top = clientTop + RASTERING_BASIC_GRID_SIZE / 2;
    }

    let left: number =
      windowsPosition.getX() - dialogDimension.getX() / 2 - RASTERING_BASIC_GRID_SIZE / 2;
    if (left > clientWidth - dialogDimension.getX() - RASTERING_BASIC_GRID_SIZE) {
      left = clientWidth - dialogDimension.getX() - RASTERING_BASIC_GRID_SIZE;
    }
    if (left < clientLeft + RASTERING_BASIC_GRID_SIZE / 2) {
      left = clientLeft + RASTERING_BASIC_GRID_SIZE / 2;
    }

    return new Vec2D(left, top);
  }

  static getLeftOrTopNode(node1: Node, node2: Node): Node {
    const posNode1: Vec2D = new Vec2D(node1.getPositionX(), node1.getPositionY());
    const posNode2: Vec2D = new Vec2D(node2.getPositionX(), node2.getPositionY());
    if (VisAVisPortPlacement.drawVerticalLine(posNode1, posNode2)) {
      return posNode1.getY() < posNode2.getY() ? node1 : node2;
    } else {
      return posNode1.getX() < posNode2.getX() ? node1 : node2;
    }
  }

  static getStartForwardAndBackwardNode(
    endNode1: Node,
    endNode2: Node,
  ): {
    startForwardNode: Node;
    startBackwardNode: Node;
  } {
    const startForwardNode = GeneralViewFunctions.getLeftOrTopNode(endNode1, endNode2);

    const startBackwardNode = endNode1.getId() === startForwardNode.getId() ? endNode2 : endNode1;

    return {
      startForwardNode: startForwardNode,
      startBackwardNode: startBackwardNode,
    };
  }

  static getRightOrBottomNode(node1: Node, node2: Node): Node {
    const posNode1: Vec2D = new Vec2D(node1.getPositionX(), node1.getPositionY());
    const posNode2: Vec2D = new Vec2D(node2.getPositionX(), node2.getPositionY());
    if (VisAVisPortPlacement.drawVerticalLine(posNode1, posNode2)) {
      return posNode1.getY() < posNode2.getY() ? node2 : node1;
    } else {
      return posNode1.getX() < posNode2.getX() ? node2 : node1;
    }
  }

  static getLeftNodeAccordingToOrder(nodesOrdered: Node[], node1: Node, node2: Node): Node {
    for (const node of nodesOrdered) {
      if (node.getId() === node1.getId()) {
        return node1;
      } else if (node.getId() === node2.getId()) {
        return node2;
      }
    }
    return undefined;
  }

  static getRightNodeAccordingToOrder(nodesOrdered: Node[], node1: Node, node2: Node): Node {
    const copyNodesOrdered = Object.assign([], nodesOrdered);
    for (const node of copyNodesOrdered.reverse()) {
      if (node.getId() === node1.getId()) {
        return node1;
      } else if (node.getId() === node2.getId()) {
        return node2;
      }
    }
    return undefined;
  }
}
