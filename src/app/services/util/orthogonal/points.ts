import {Vec2D} from "../../../utils/vec2D";
import {MathUtils} from "../../../utils/math";
import {
  TrainrunSectionText,
  TrainrunSectionTextPositions,
} from "../../../data-structures/technical.data.structures";
import {SimpleTrainrunSectionRouter} from "../trainrunsection.routing";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {TRANSITION_LINE_AREA_SPAN} from "../../../view/rastering/definitions";
import {ShapeLabel} from "../section-shape";
import {getOrthogonalCorners} from "./corners";

// minimum distance from a label to the nodes
const LABEL_NODE_CLEARANCE = 96;
// minimum distance from a label to the corners
const LABEL_CORNER_CLEARANCE = TRANSITION_LINE_AREA_SPAN;
// segments shorter than this cannot fit a label
const LABEL_MIN_SEGMENT_LENGTH = 96;

interface Segment {
  a: Vec2D;
  b: Vec2D;
  length: number;
  unit: Vec2D;
  anchor?: Vec2D;
}

const anchorOf = (segment: Segment): Vec2D =>
  segment.anchor !== undefined ? segment.anchor : Vec2D.scale(Vec2D.add(segment.a, segment.b), 0.5);

/**
 * Collapses the path corners into segments: removes consecutive duplicate
 * points, then drops points where the path doesn't actually turn. Returns
 * undefined when fewer than two points remain.
 */
function buildSegments(s: Vec2D, corners: Vec2D[], t: Vec2D): Segment[] | undefined {
  const deduped = Vec2D.dedupe([s, ...corners, t]);
  const points = deduped.filter(
    (p, i) =>
      i === 0 ||
      i === deduped.length - 1 ||
      !Vec2D.areOnSameAxis(deduped[i - 1], p, deduped[i + 1]),
  );
  if (points.length < 2) return undefined;

  return points.slice(1).map((b, i) => {
    const a = points[i];
    return {a, b, length: Vec2D.norm(Vec2D.sub(b, a)), unit: Vec2D.normalize(Vec2D.sub(b, a))};
  });
}

/**
 * Finds a spot on the segment close to the section center but away from the
 * nodes and corners. Returns undefined when the segment is too short, or has
 * no free spot at all.
 */
function findSegmentAnchor(
  segment: Segment,
  isFirst: boolean,
  isLast: boolean,
  nodes: Vec2D[],
  center: Vec2D,
): Vec2D | undefined {
  if (segment.length < LABEL_MIN_SEGMENT_LENGTH) return undefined;

  let lo = isFirst ? 0 : LABEL_CORNER_CLEARANCE;
  let hi = segment.length - (isLast ? 0 : LABEL_CORNER_CLEARANCE);

  nodes.forEach((node) => {
    const rel = Vec2D.sub(node, segment.a);
    const along = Vec2D.dot(segment.unit, rel);
    const clearanceSq =
      LABEL_NODE_CLEARANCE * LABEL_NODE_CLEARANCE -
      (Vec2D.norm(rel) * Vec2D.norm(rel) - along * along);
    if (clearanceSq <= 0) {
      return;
    }
    const clearance = Math.sqrt(clearanceSq);
    if (along <= segment.length / 2) {
      lo = Math.max(lo, along + clearance);
    } else {
      hi = Math.min(hi, along - clearance);
    }
  });
  if (lo > hi) return undefined;

  const toCenter = Vec2D.sub(center, segment.a);
  const centerM = Vec2D.dot(segment.unit, toCenter);
  return Vec2D.add(segment.a, Vec2D.scale(segment.unit, MathUtils.clamp(centerM, lo, hi)));
}

/**
 * Picks which segments carry the name, the time(s), and the stop count.
 * Prefers segments with a free anchor, closest to the center first.
 * Falls back to the two longest segments when none are free.
 * The name shows left of its anchor and the time(s) right of it.
 */
function selectLabelSegments(
  segments: Segment[],
  center: Vec2D,
): {nameSeg: Segment; timeSeg: Segment; stopsSeg: Segment} {
  const clearSegments = segments
    .filter((segment): segment is Segment & {anchor: Vec2D} => segment.anchor !== undefined)
    .sort(
      (s1, s2) =>
        Vec2D.norm(Vec2D.sub(s1.anchor, center)) - Vec2D.norm(Vec2D.sub(s2.anchor, center)),
    );
  const byLength = [...segments].sort((s1, s2) => s2.length - s1.length);

  const order = (seg1: Segment, seg2: Segment): [Segment, Segment] => {
    const p1 = anchorOf(seg1);
    const p2 = anchorOf(seg2);
    const seg1First = p1.getX() !== p2.getX() ? p1.getX() < p2.getX() : p1.getY() > p2.getY();
    return seg1First ? [seg1, seg2] : [seg2, seg1];
  };

  let nameSeg: Segment;
  let timeSeg: Segment;

  if (clearSegments.length >= 2) {
    [nameSeg, timeSeg] = order(clearSegments[0], clearSegments[1]);
  } else if (clearSegments.length === 1) {
    nameSeg = clearSegments[0];
    timeSeg = nameSeg;
  } else if (byLength.length >= 2) {
    [nameSeg, timeSeg] = order(byLength[0], byLength[1]);
  } else {
    nameSeg = byLength[0];
    timeSeg = nameSeg;
  }

  return {nameSeg, timeSeg, stopsSeg: byLength[0]};
}

/**
 * Computes the positions of the middle labels and stops on the orthogonal
 * path: the name goes on the first free spot, the times on the second one,
 * and the stops on the longest segment. Returns undefined when ports are
 * missing.
 */
export function getOrthogonalPoints(
  ts: TrainrunSection,
  modelPath: Vec2D[],
):
  | {
      labels: Partial<Record<TrainrunSectionText, ShapeLabel>>;
      stopsSegment: [Vec2D, Vec2D];
    }
  | undefined {
  const corners = getOrthogonalCorners(ts, modelPath);
  if (corners === undefined) return undefined;

  const [s, , , t] = modelPath;
  const segments = buildSegments(s, corners, t);
  if (segments === undefined) return undefined;

  const center = Vec2D.scale(Vec2D.add(s, t), 0.5);
  segments.forEach((segment, i) => {
    segment.anchor = findSegmentAnchor(segment, i === 0, i === segments.length - 1, [s, t], center);
  });

  const {nameSeg, timeSeg, stopsSeg} = selectLabelSegments(segments, center);
  const srcPort = ts.getSourceNode().getPortOfTrainrunSection(ts.getId());

  // small fake path around the anchor, so the text placement follows the segment
  const placeAt = (seg: Segment, anchor: Vec2D): TrainrunSectionTextPositions =>
    SimpleTrainrunSectionRouter.placeTextOnTrainrunSection(
      [
        Vec2D.sub(anchor, Vec2D.scale(seg.unit, 2)),
        Vec2D.sub(anchor, seg.unit),
        Vec2D.add(anchor, seg.unit),
        Vec2D.add(anchor, Vec2D.scale(seg.unit, 2)),
      ],
      srcPort,
      seg.a.getX() === seg.b.getX(),
    );
  const positionsName = placeAt(nameSeg, anchorOf(nameSeg));
  const positionsTime = timeSeg === nameSeg ? positionsName : placeAt(timeSeg, anchorOf(timeSeg));
  const positionsStops = placeAt(stopsSeg, Vec2D.scale(Vec2D.add(stopsSeg.a, stopsSeg.b), 0.5));

  const label = (
    positions: TrainrunSectionTextPositions,
    text: TrainrunSectionText,
    seg: Segment,
  ): ShapeLabel => ({
    x: positions[text].x,
    y: positions[text].y,
    segment: [seg.a, seg.b],
  });

  return {
    labels: {
      [TrainrunSectionText.TrainrunSectionName]: label(
        positionsName,
        TrainrunSectionText.TrainrunSectionName,
        nameSeg,
      ),
      [TrainrunSectionText.TrainrunSectionTravelTime]: label(
        positionsTime,
        TrainrunSectionText.TrainrunSectionTravelTime,
        timeSeg,
      ),
      [TrainrunSectionText.TrainrunSectionBackwardTravelTime]: label(
        positionsTime,
        TrainrunSectionText.TrainrunSectionBackwardTravelTime,
        timeSeg,
      ),
      [TrainrunSectionText.TrainrunSectionNumberOfStops]: label(
        positionsStops,
        TrainrunSectionText.TrainrunSectionNumberOfStops,
        stopsSeg,
      ),
    },
    stopsSegment: [stopsSeg.a, stopsSeg.b],
  };
}
