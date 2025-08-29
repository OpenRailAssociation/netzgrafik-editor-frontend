import {Node} from "../../models/node.model";
import {GeneralViewFunctions} from "./generalViewFunctions";
import {Vec2D} from "../../utils/vec2D";

describe("general view functions", () => {
  it("calcDialogTopLeftScreenCoordinate", () => {
    // not testable
  });

  it("calcDialogTopLeftScreenCoordinate - case 1", () => {
    const retVal = GeneralViewFunctions.calcDialogTopLeftScreenCoordinateClientRectInfo(
      new Vec2D(100, 200),
      new Vec2D(300, 600),
      0,
      0,
      937,
      1920,
    );
    expect(retVal.getX()).toBe(16);
    expect(retVal.getY()).toBe(16);
  });

  it("calcDialogTopLeftScreenCoordinate - case 2", () => {
    const retVal = GeneralViewFunctions.calcDialogTopLeftScreenCoordinateClientRectInfo(
      new Vec2D(-100, -200),
      new Vec2D(300, 600),
      0,
      0,
      937,
      1920,
    );
    expect(retVal.getX()).toBe(16);
    expect(retVal.getY()).toBe(16);
  });

  it("calcDialogTopLeftScreenCoordinate - case 3", () => {
    const retVal = GeneralViewFunctions.calcDialogTopLeftScreenCoordinateClientRectInfo(
      new Vec2D(1000, 2000),
      new Vec2D(300, 600),
      0,
      0,
      937,
      1920,
    );

    expect(retVal.getX()).toBe(834);
    expect(retVal.getY()).toBe(305);
  });

  it("calcDialogTopLeftScreenCoordinate - case 4", () => {
    const retVal = GeneralViewFunctions.calcDialogTopLeftScreenCoordinateClientRectInfo(
      new Vec2D(100, 200),
      new Vec2D(300, 2000),
      0,
      0,
      937,
      1920,
    );
    expect(retVal.getX()).toBe(16);
    expect(retVal.getY()).toBe(16);
  });

  it("calcDialogTopLeftScreenCoordinate - case 5", () => {
    const retVal = GeneralViewFunctions.calcDialogTopLeftScreenCoordinateClientRectInfo(
      new Vec2D(100, 200),
      new Vec2D(3000, 100),
      0,
      0,
      937,
      1920,
    );
    expect(retVal.getX()).toBe(16);
    expect(retVal.getY()).toBe(68);
  });

  it("getLeftOrTopNode - case 1", () => {
    const node1 = new Node();
    node1.setPosition(0, 10);
    const node2 = new Node();
    node2.setPosition(0, 10);
    const retNode = GeneralViewFunctions.getLeftOrTopNode(node1, node2);
    expect(retNode.getId() === node1.getId()).toBe(false);
  });

  it("getLeftOrTopNode - case 2", () => {
    const node1 = new Node();
    node1.setPosition(10, 10);
    const node2 = new Node();
    node2.setPosition(0, 10);
    const retNode = GeneralViewFunctions.getLeftOrTopNode(node1, node2);
    expect(retNode.getId() === node1.getId()).toBe(false);
  });

  it("getLeftOrTopNode - case 3", () => {
    const node1 = new Node();
    node1.setPosition(0, 10);
    const node2 = new Node();
    node2.setPosition(10, 10);
    const retNode = GeneralViewFunctions.getLeftOrTopNode(node1, node2);
    expect(retNode.getId() === node1.getId()).toBe(true);
  });

  it("getLeftOrTopNode - case 4", () => {
    const node1 = new Node();
    node1.setPosition(0, 0);
    const node2 = new Node();
    node2.setPosition(0, 10);
    const retNode = GeneralViewFunctions.getLeftOrTopNode(node1, node2);
    expect(retNode.getId() === node1.getId()).toBe(true);
  });

  it("getLeftOrTopNode - case 5", () => {
    const node1 = new Node();
    node1.setPosition(0, 0);
    const node2 = new Node();
    node2.setPosition(0, 10);
    const retNode = GeneralViewFunctions.getLeftOrTopNode(node1, node2);
    expect(retNode.getId() === node1.getId()).toBe(true);
  });

  it("getLeftOrTopNode - case 6", () => {
    const node1 = new Node();
    node1.setPosition(0, 10);
    const node2 = new Node();
    node2.setPosition(0, 10);
    const retNode = GeneralViewFunctions.getLeftOrTopNode(node1, node2);
    expect(retNode.getId() === node1.getId()).toBe(false);
  });

  it("getRightOrBottomNode - case 1", () => {
    const node1 = new Node();
    node1.setPosition(0, 10);
    const node2 = new Node();
    node2.setPosition(0, 10);
    const retNode = GeneralViewFunctions.getRightOrBottomNode(node1, node2);
    expect(retNode.getId() === node1.getId()).toBe(true);
  });

  it("getRightOrBottomNode - case 2", () => {
    const node1 = new Node();
    node1.setPosition(10, 10);
    const node2 = new Node();
    node2.setPosition(0, 10);
    const retNode = GeneralViewFunctions.getRightOrBottomNode(node1, node2);
    expect(retNode.getId() === node1.getId()).toBe(true);
  });

  it("getRightOrBottomNode - case 3", () => {
    const node1 = new Node();
    node1.setPosition(0, 10);
    const node2 = new Node();
    node2.setPosition(10, 10);
    const retNode = GeneralViewFunctions.getRightOrBottomNode(node1, node2);
    expect(retNode.getId() === node1.getId()).toBe(false);
  });

  it("getRightOrBottomNode - case 4", () => {
    const node1 = new Node();
    node1.setPosition(0, 0);
    const node2 = new Node();
    node2.setPosition(0, 10);
    const retNode = GeneralViewFunctions.getRightOrBottomNode(node1, node2);
    expect(retNode.getId() === node1.getId()).toBe(false);
  });

  it("getRightOrBottomNode - case 5", () => {
    const node1 = new Node();
    node1.setPosition(0, 0);
    const node2 = new Node();
    node2.setPosition(0, 10);
    const retNode = GeneralViewFunctions.getRightOrBottomNode(node1, node2);
    expect(retNode.getId() === node1.getId()).toBe(false);
  });

  it("getRightOrBottomNode - case 6", () => {
    const node1 = new Node();
    node1.setPosition(0, 10);
    const node2 = new Node();
    node2.setPosition(0, 10);
    const retNode = GeneralViewFunctions.getRightOrBottomNode(node1, node2);
    expect(retNode.getId() === node1.getId()).toBe(true);
  });

  it("getLeftNodeAccordingToOrder - case 1", () => {
    const node1 = new Node();
    node1.setPosition(0, 10);
    const node2 = new Node();
    node2.setPosition(0, 10);

    const node3 = new Node();
    node3.setPosition(-1, 10);
    const node4 = new Node();
    node4.setPosition(0, 11);
    const node5 = new Node();
    node5.setPosition(5, 5);
    const node6 = new Node();
    node6.setPosition(0, 5);
    const node7 = new Node();
    node7.setPosition(0, 10);

    const nodesOrdered: Node[] = [node3, node1, node2, node4, node5, node6, node7];
    const retNode = GeneralViewFunctions.getLeftNodeAccordingToOrder(nodesOrdered, node1, node2);
    expect(retNode.getId() === node1.getId()).toBe(true);
  });

  it("getLeftNodeAccordingToOrder - case 2", () => {
    const node1 = new Node();
    node1.setPosition(0, 10);
    const node2 = new Node();
    node2.setPosition(0, 10);

    const node3 = new Node();
    node3.setPosition(-1, 10);
    const node4 = new Node();
    node4.setPosition(0, 11);
    const node5 = new Node();
    node5.setPosition(5, 5);
    const node6 = new Node();
    node6.setPosition(0, 5);
    const node7 = new Node();
    node7.setPosition(0, 10);

    const nodesOrdered: Node[] = [node3, node2, node4, node5, node6, node7];
    const retNode = GeneralViewFunctions.getLeftNodeAccordingToOrder(nodesOrdered, node1, node2);
    expect(retNode.getId() === node2.getId()).toBe(true);
  });

  it("getLeftNodeAccordingToOrder - case 3", () => {
    const node1 = new Node();
    node1.setPosition(0, 10);
    const node2 = new Node();
    node2.setPosition(0, 10);

    const node3 = new Node();
    node3.setPosition(-1, 10);
    const node4 = new Node();
    node4.setPosition(0, 11);
    const node5 = new Node();
    node5.setPosition(5, 5);
    const node6 = new Node();
    node6.setPosition(0, 5);
    const node7 = new Node();
    node7.setPosition(0, 10);

    const nodesOrdered: Node[] = [node3, node4, node5, node6, node7];
    const retNode = GeneralViewFunctions.getLeftNodeAccordingToOrder(nodesOrdered, node1, node2);
    expect(retNode).toBe(undefined);
  });

  it("getLeftNodeAccordingToOrder - case 4", () => {
    const node1 = new Node();
    node1.setPosition(0, 10);
    const node2 = new Node();
    node2.setPosition(0, 10);

    const node3 = new Node();
    node3.setPosition(-1, 10);
    const node4 = new Node();
    node4.setPosition(0, 11);
    const node5 = new Node();
    node5.setPosition(5, 5);
    const node6 = new Node();
    node6.setPosition(0, 5);
    const node7 = new Node();
    node7.setPosition(0, 10);

    const nodesOrdered: Node[] = [node3, node2, node4, node5, node6, node1, node7];
    const retNode = GeneralViewFunctions.getLeftNodeAccordingToOrder(nodesOrdered, node1, node2);
    expect(retNode.getId() === node2.getId()).toBe(true);
  });

  it("getRightNodeAccordingToOrder - case 1", () => {
    const node1 = new Node();
    node1.setPosition(0, 10);
    const node2 = new Node();
    node2.setPosition(0, 10);

    const node3 = new Node();
    node3.setPosition(-1, 10);
    const node4 = new Node();
    node4.setPosition(0, 11);
    const node5 = new Node();
    node5.setPosition(5, 5);
    const node6 = new Node();
    node6.setPosition(0, 5);
    const node7 = new Node();
    node7.setPosition(0, 10);

    const nodesOrdered: Node[] = [node3, node1, node2, node4, node5, node6, node7];
    const retNode = GeneralViewFunctions.getRightNodeAccordingToOrder(nodesOrdered, node1, node2);
    expect(retNode.getId() === node2.getId()).toBe(true);
  });

  it("getRightNodeAccordingToOrder - case 2", () => {
    const node1 = new Node();
    node1.setPosition(0, 10);
    const node2 = new Node();
    node2.setPosition(0, 10);

    const node3 = new Node();
    node3.setPosition(-1, 10);
    const node4 = new Node();
    node4.setPosition(0, 11);
    const node5 = new Node();
    node5.setPosition(5, 5);
    const node6 = new Node();
    node6.setPosition(0, 5);
    const node7 = new Node();
    node7.setPosition(0, 10);

    const nodesOrdered: Node[] = [node3, node2, node4, node5, node6, node7];
    const retNode = GeneralViewFunctions.getRightNodeAccordingToOrder(nodesOrdered, node1, node2);
    expect(retNode.getId() === node2.getId()).toBe(true);
  });

  it("getRightNodeAccordingToOrder - case 3", () => {
    const node1 = new Node();
    node1.setPosition(0, 10);
    const node2 = new Node();
    node2.setPosition(0, 10);

    const node3 = new Node();
    node3.setPosition(-1, 10);
    const node4 = new Node();
    node4.setPosition(0, 11);
    const node5 = new Node();
    node5.setPosition(5, 5);
    const node6 = new Node();
    node6.setPosition(0, 5);
    const node7 = new Node();
    node7.setPosition(0, 10);

    const nodesOrdered: Node[] = [node3, node4, node5, node6, node7];
    const retNode = GeneralViewFunctions.getRightNodeAccordingToOrder(nodesOrdered, node1, node2);
    expect(retNode).toBe(undefined);
  });

  it("getRightNodeAccordingToOrder - case 4", () => {
    const node1 = new Node();
    node1.setPosition(0, 10);
    const node2 = new Node();
    node2.setPosition(0, 10);

    const node3 = new Node();
    node3.setPosition(-1, 10);
    const node4 = new Node();
    node4.setPosition(0, 11);
    const node5 = new Node();
    node5.setPosition(5, 5);
    const node6 = new Node();
    node6.setPosition(0, 5);
    const node7 = new Node();
    node7.setPosition(0, 10);

    const nodesOrdered: Node[] = [node3, node2, node4, node5, node6, node1, node7];
    const retNode = GeneralViewFunctions.getRightNodeAccordingToOrder(nodesOrdered, node1, node2);
    expect(retNode.getId() === node1.getId()).toBe(true);
  });
});
