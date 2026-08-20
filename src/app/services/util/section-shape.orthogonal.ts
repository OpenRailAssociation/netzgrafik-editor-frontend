import {Vec2D} from "../../utils/vec2D";
import {TrainrunSectionText} from "../../data-structures/technical.data.structures";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {TRANSITION_LINE_AREA_SPAN} from "../../view/rastering/definitions";
import {SectionShape, ShapeLabel} from "./section-shape";
import {buildPathString} from "./svg";
import {ObliqueSectionShape} from "./section-shape.oblique";
import {getOrthogonalCorners} from "./orthogonal/corners";
import {getOrthogonalPoints} from "./orthogonal/points";

/**
 * Falls back to the oblique shape wherever the orthogonal geometry can't be
 * computed (e.g. missing ports) or doesn't reposition a given text.
 */
export const OrthogonalSectionShape: SectionShape = {
  getPath(ts: TrainrunSection): Vec2D[] {
    const obliquePath = ObliqueSectionShape.getPath(ts);
    const corners = getOrthogonalCorners(ts, obliquePath);
    if (!corners) {
      return obliquePath;
    }
    return [obliquePath[0], ...corners, obliquePath[3]];
  },

  getPoints(ts: TrainrunSection): {
    labels: Record<TrainrunSectionText, ShapeLabel>;
    stopsSegment: [Vec2D, Vec2D];
  } {
    const oblique = ObliqueSectionShape.getPoints(ts);
    const points = getOrthogonalPoints(ts, ObliqueSectionShape.getPath(ts));
    if (!points) {
      return oblique;
    }
    return {
      labels: {...oblique.labels, ...points.labels},
      stopsSegment: points.stopsSegment,
    };
  },

  getPathAsSVGString(path: Vec2D[]): string {
    return buildPathString(path, TRANSITION_LINE_AREA_SPAN);
  },
};
