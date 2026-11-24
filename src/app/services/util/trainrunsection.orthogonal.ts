import {Vec2D} from "../../utils/vec2D";
import {MathUtils} from "../../utils/math";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {TrainrunSectionTextPositions} from "src/app/data-structures/technical.data.structures";
import {SimpleTrainrunSectionRouter} from "./trainrunsection.routing";

/**
 * Return type of the getAxes function:
 *
 * isLegHorizontal: boolean representing the aligment of the first leg of a trainrun section.
 * portAxis returns the X axis value of the point when the leg is horizontal, Y else.
 * otherAxis returns the other value.
 * toVec2D helps create a new Vec2D alongside portAxis.
 */
type AxisHelpers = {
  isLegHorizontal: boolean;
  portAxis: (p: Vec2D) => number;
  otherAxis: (p: Vec2D) => number;
  toVec2D: (onPortAxis: number, onOtherAxis: number) => Vec2D;
};

/**
 * Orthogonal routing of a trainrun section.
 *
 * The path of the section is still [s, s1, t1, t] (see SimpleTrainrunSectionRouter):
 * s -> s1 and t1 -> t are the legs next to the ports and are never changed,
 * in order to keep enough space to display the arrival and departure times.
 * Only the part between s1 and t1 is replaced, by two "corners" (c1, c2).
 *
 * Z-shape (Right -> Left ports):        Staircase (nodes too close):
 *
 *   s---s1                                 s---s1
 *        |                                      |
 *        c1                                     |
 *        |                                 c1---c2
 *        c2                                |
 *        |                                 |
 *        t1---t                            t1---t
 */
export class OrthogonalTrainrunSectionRouter {
  static getCorners(ts: TrainrunSection): Vec2D[] {
    const [s, s1, t1] = ts.getPath();
    const {portAxis, otherAxis, toVec2D} = OrthogonalTrainrunSectionRouter.getAxes(ts);

    // The nodes alignment along the axis of the ports tells us if the path should
    // be a Z-Shape or a Staircase, see above.
    const isT1AheadOfS1 = (portAxis(s1) - portAxis(s)) * (portAxis(t1) - portAxis(s1)) > 0;

    if (isT1AheadOfS1) {
      const mid = OrthogonalTrainrunSectionRouter.getZMiddleSegmentPosition(ts);
      return [toVec2D(mid, otherAxis(s1)), toVec2D(mid, otherAxis(t1))];
    }
    const mid = (otherAxis(s1) + otherAxis(t1)) / 2;
    return [toVec2D(portAxis(s1), mid), toVec2D(portAxis(t1), mid)];
  }

  /**
   * Position of the middle segment of a Z-shape.
   * Parallel sections between the same nodes leave from neighbouring ports, so
   * their s1 are spread around the node center and they don't seem stacked.
   */
  private static getZMiddleSegmentPosition(ts: TrainrunSection): number {
    const [s, s1, t1] = ts.getPath();
    const {isLegHorizontal, portAxis, otherAxis} = OrthogonalTrainrunSectionRouter.getAxes(ts);
    const node = ts.getSourceNode();
    const nodeCenter = isLegHorizontal
      ? node.getPositionY() + node.getNodeHeight() / 2
      : node.getPositionX() + node.getNodeWidth() / 2;

    const portDistanceFromCenter = otherAxis(s1) - nodeCenter;
    // the shift goes the other way when the section heads to the other side,
    // otherwise parallel sections would cross each other
    const isHeadingBackwards = (otherAxis(t1) - otherAxis(s1)) * (portAxis(s1) - portAxis(s)) < 0;
    const shift = (isHeadingBackwards ? 1 : -1) * portDistanceFromCenter;

    // keep the middle segment between s1 and t1, with close enough nodes, the shift
    // could push it into a leg or a node
    const nodeSize = isLegHorizontal ? node.getNodeHeight() : node.getNodeWidth();
    const scale = Math.min(1, Math.abs(portAxis(t1) - portAxis(s1)) / 2 / nodeSize);
    return MathUtils.clamp(
      (portAxis(s1) + portAxis(t1)) / 2 + shift * scale,
      portAxis(s1),
      portAxis(t1),
    );
  }

  /**
   * The legs are horizontal for Left/Right ports, vertical for Top/Bottom ports.
   */
  private static getAxes(ts: TrainrunSection): AxisHelpers {
    const [s, s1] = ts.getPath();
    const isLegHorizontal = s.getY() === s1.getY();
    return {
      isLegHorizontal,
      portAxis: (p: Vec2D) => (isLegHorizontal ? p.getX() : p.getY()),
      otherAxis: (p: Vec2D) => (isLegHorizontal ? p.getY() : p.getX()),
      toVec2D: (onPortAxis: number, onOtherAxis: number) =>
        isLegHorizontal ? new Vec2D(onPortAxis, onOtherAxis) : new Vec2D(onOtherAxis, onPortAxis),
    };
  }

  /**
   * The main segment carries the texts and the intermediate stops (always s1 -> t1
   * in oblique). In orthogonal, c1 -> c2 segment carries it.
   * There's a special case when both corners are the same point and
   * the section is a straight line (nodes are very close), then it's still s1 -> t1.
   */
  static getMainSegment(ts: TrainrunSection): [Vec2D, Vec2D] {
    const [, s1, t1] = ts.getPath();
    const [c1, c2] = OrthogonalTrainrunSectionRouter.getCorners(ts);
    return Vec2D.equal(c1, c2) ? [s1, t1] : [c1, c2];
  }

  /**
   * Text positions are computed like in oblique, but on the main segment.
   * placeTextOnTrainrunSection takes the direction s -> s1 as the direction of the
   * line, so we give it fake legs going along the main segment.
   */
  static getTextPositions(ts: TrainrunSection): TrainrunSectionTextPositions {
    const [a, b] = OrthogonalTrainrunSectionRouter.getMainSegment(ts);
    const direction = Vec2D.normalize(Vec2D.sub(b, a));
    const lineWayPoints = [Vec2D.sub(a, direction), a, b, Vec2D.add(b, direction)];
    // Since the port alignment of the leg does not tell the verticality of the
    // main segment, the value is overriden.
    return SimpleTrainrunSectionRouter.placeTextOnTrainrunSection(
      lineWayPoints,
      ts.getSourceNode().getPortOfTrainrunSection(ts.getId()),
      a.getX() === b.getX(),
    );
  }
}
