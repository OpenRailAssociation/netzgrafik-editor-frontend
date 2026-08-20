import {Vec2D} from "../../../utils/vec2D";
import {MathUtils} from "../../../utils/math";
import {PortAlignment} from "../../../data-structures/technical.data.structures";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {Node} from "../../../models/node.model";
import {Port} from "../../../models/port.model";
import {
  TRAINRUN_SECTION_PORT_SPAN_HORIZONTAL,
  TRAINRUN_SECTION_PORT_SPAN_VERTICAL,
} from "../../../view/rastering/definitions";

const isHorizontal = (port: Port): boolean =>
  port.getPositionAlignment() === PortAlignment.Left ||
  port.getPositionAlignment() === PortAlignment.Right;

interface CornerContext {
  horizontal: boolean;
  srcNode: Node;
  srcPort: Port;
  trgNode: Node;
  trgPort: Port;
  srcAlignment: PortAlignment;
  outwardAlignment: PortAlignment;
  sM: number;
  sC: number;
  tM: number;
  tC: number;
  vec: (m: number, c: number) => Vec2D;
}

/**
 * Returns the ports on the same side of `node` as `port`, from sections
 * between `node` and `sibling`, ordered by position.
 */
function getSiblingPorts(node: Node, port: Port, sibling: Node): Port[] {
  return node
    .getPorts()
    .filter(
      (p) =>
        p.getPositionAlignment() === port.getPositionAlignment() &&
        (p.getTrainrunSection().getSourceNodeId() === sibling.getId() ||
          p.getTrainrunSection().getTargetNodeId() === sibling.getId()),
    )
    .sort((a, b) => a.getPositionIndex() - b.getPositionIndex());
}

/**
 * Returns this section's offset among its siblings, centered around 0, so
 * their middle segments do not overlap.
 */
function getCenteredSiblingOffset(node: Node, port: Port, sibling: Node, span: number): number {
  const siblings = getSiblingPorts(node, port, sibling);
  const index = siblings.indexOf(port);

  return (index - (siblings.length - 1) / 2) * span;
}

/**
 * Returns this section's offset among its siblings, counted from the first
 * one, so each is pushed further out than the previous.
 */
function getSiblingOffsetFromStart(node: Node, port: Port, sibling: Node, span: number): number {
  return getSiblingPorts(node, port, sibling).indexOf(port) * span;
}

/**
 * Computes the two corners for facing ports (Z-shape), with a shifted middle
 * segment.
 */
function getFacingCorners(ctx: CornerContext): Vec2D[] {
  const {
    horizontal,
    srcNode,
    srcPort,
    trgNode,
    trgPort,
    srcAlignment,
    outwardAlignment,
    sM,
    sC,
    tM,
    tC,
    vec,
  } = ctx;
  const refIsSource = srcAlignment === outwardAlignment;
  const span = horizontal
    ? TRAINRUN_SECTION_PORT_SPAN_VERTICAL
    : TRAINRUN_SECTION_PORT_SPAN_HORIZONTAL;
  const offset = refIsSource
    ? getCenteredSiblingOffset(srcNode, srcPort, trgNode, span)
    : getCenteredSiblingOffset(trgNode, trgPort, srcNode, span);

  // shift in the direction the sections spread, so their segments never cross
  const nodeSC = horizontal ? srcNode.getPositionY() : srcNode.getPositionX();
  const nodeTC = horizontal ? trgNode.getPositionY() : trgNode.getPositionX();
  const sign = (refIsSource ? nodeTC - nodeSC : nodeSC - nodeTC) < 0 ? 1 : -1;

  // keep the segment between the nodes, even when they are very close
  const segmentM = MathUtils.clamp((sM + tM) / 2 + sign * offset, sM, tM);

  return [vec(segmentM, sC), vec(segmentM, tC)];
}

/**
 * Computes the two corners for same-side ports (U-shape), pushing each section
 * further out so they do not overlap. Only happens when port sides come from
 * imported data and were never recomputed.
 */
function getSameSideCorners(ctx: CornerContext, s1: Vec2D, t1: Vec2D): Vec2D[] {
  const {horizontal, srcNode, srcPort, trgNode, srcAlignment, outwardAlignment, sC, tC, vec} = ctx;
  const exitM = (p: Vec2D) => (horizontal ? p.getX() : p.getY());
  const span = horizontal
    ? TRAINRUN_SECTION_PORT_SPAN_VERTICAL
    : TRAINRUN_SECTION_PORT_SPAN_HORIZONTAL;
  const dir = srcAlignment === outwardAlignment ? 1 : -1;
  const offset = getSiblingOffsetFromStart(srcNode, srcPort, trgNode, span);
  const segmentM =
    (srcAlignment === outwardAlignment
      ? Math.max(exitM(s1), exitM(t1))
      : Math.min(exitM(s1), exitM(t1))) +
    dir * offset;

  return [vec(segmentM, sC), vec(segmentM, tC)];
}

/**
 * Returns the corners of the orthogonal path, or undefined when ports are
 * missing.
 */
export function getOrthogonalCorners(ts: TrainrunSection, modelPath: Vec2D[]): Vec2D[] | undefined {
  const srcNode = ts.getSourceNode();
  const trgNode = ts.getTargetNode();
  const srcPort = srcNode.getPortOfTrainrunSection(ts.getId());
  const trgPort = trgNode.getPortOfTrainrunSection(ts.getId());

  if (!srcPort || !trgPort || modelPath.length < 4) return undefined;

  const [s, s1, t1, t] = modelPath;
  const srcAlignment = srcPort.getPositionAlignment();
  const trgAlignment = trgPort.getPositionAlignment();
  const horizontal = isHorizontal(srcPort);

  if (horizontal !== isHorizontal(trgPort)) {
    // perpendicular ports: one corner (L-shape)
    return [horizontal ? new Vec2D(t.getX(), s.getY()) : new Vec2D(s.getX(), t.getY())];
  }

  // m: coordinate along the ports axis, c: the other coordinate
  const vec = (m: number, c: number) => (horizontal ? new Vec2D(m, c) : new Vec2D(c, m));
  const [sM, sC] = horizontal ? [s.getX(), s.getY()] : [s.getY(), s.getX()];
  const [tM, tC] = horizontal ? [t.getX(), t.getY()] : [t.getY(), t.getX()];

  if (sC === tC) return [];

  const ctx: CornerContext = {
    horizontal,
    srcNode,
    srcPort,
    trgNode,
    trgPort,
    srcAlignment,
    outwardAlignment: horizontal ? PortAlignment.Right : PortAlignment.Bottom,
    sM,
    sC,
    tM,
    tC,
    vec,
  };

  return srcAlignment !== trgAlignment ? getFacingCorners(ctx) : getSameSideCorners(ctx, s1, t1);
}
