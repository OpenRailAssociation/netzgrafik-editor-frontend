import {Vec2D} from "../../utils/vec2D";
import {TrainrunSectionText} from "../../data-structures/technical.data.structures";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {ObliqueSectionShape} from "./section-shape.oblique";
import {OrthogonalSectionShape} from "./section-shape.orthogonal";

const SECTION_SHAPES_REGISTRY = {
  oblique: ObliqueSectionShape,
  orthogonal: OrthogonalSectionShape,
} as const;

export type SectionRenderingStyle = keyof typeof SECTION_SHAPES_REGISTRY;
export const SECTION_SHAPES = Object.keys(SECTION_SHAPES_REGISTRY) as SectionRenderingStyle[];
export const DEFAULT_SECTION_SHAPE: SectionRenderingStyle = "oblique";

export interface ShapeLabel {
  x: number;
  y: number;
  segment: [Vec2D, Vec2D];
}

/**
 * How a section connects its two nodes: its path, texts and stops. Everything
 * is computed from the current nodes and ports.
 *
 *   node A
 *     o     <- port anchor, getPath(ts)[0]
 *     │
 *     │     getPath(ts): Returns the full path drawn from port to port.
 *     │     getPathAsSVGString(path): Turns it later into the "d" attribute of
 *     │     the SVG <path> element.
 *     │
 *     x---- TrainrunSectionName        <- one entry of getPoints(ts).labels,
 *     │                                   keyed by TrainrunSectionText,
 *     x---- TrainrunSectionTravelTime     each a { x, y, segment } anchor
 *     │
 *     x---- stopsSegment               <- getPoints(ts).stopsSegment, where
 *     │                                   the intermediate stops sit
 *     │
 *     o     <- port anchor, last point of getPath(ts)
 *   node B
 */
export interface SectionShape {
  getPath(ts: TrainrunSection): Vec2D[];
  getPoints(ts: TrainrunSection): {
    labels: Record<TrainrunSectionText, ShapeLabel>;
    stopsSegment: [Vec2D, Vec2D];
  };
  getPathAsSVGString(path: Vec2D[]): string;
}

export function getSectionShape(style: SectionRenderingStyle): SectionShape {
  return SECTION_SHAPES_REGISTRY[style];
}

/**
 * The path TrainrunSection.routeEdgeAndPlaceText caches on the model:
 * always [anchor, exit point, exit point, anchor], whatever the active shape.
 */
export function getModelSectionPath(ts: TrainrunSection): Vec2D[] {
  return ObliqueSectionShape.getPath(ts);
}

/**
 * The section path to render. With both nodes visible, this is the full path
 * of the given shape. When a node is filtered out, only a short piece is drawn
 * on each visible side: from the port to the exit point of the model path,
 * whatever the shape.
 */
export function getSectionPath(
  ts: TrainrunSection,
  shape: SectionShape,
  sourceVisible: boolean,
  targetVisible: boolean,
): Vec2D[] {
  if (sourceVisible && targetVisible) {
    return shape.getPath(ts);
  }
  const [s, s1, t1, t] = getModelSectionPath(ts);
  const retPath: Vec2D[] = [];
  if (sourceVisible) {
    retPath.push(s, s1);
  }
  if (targetVisible) {
    retPath.push(t1, t);
  }
  return retPath;
}
