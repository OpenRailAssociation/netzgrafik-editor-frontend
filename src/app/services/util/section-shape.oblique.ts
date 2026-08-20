import {Vec2D} from "../../utils/vec2D";
import {TrainrunSectionText} from "../../data-structures/technical.data.structures";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {SimpleTrainrunSectionRouter} from "./trainrunsection.routing";
import {SectionShape, ShapeLabel} from "./section-shape";
import {buildPathString} from "./svg";

/** The classic route between the two ports: [anchor, exit point, exit point, anchor]. */
function getPath(ts: TrainrunSection): Vec2D[] {
  const sourceNode = ts.getSourceNode();
  const targetNode = ts.getTargetNode();
  const sourcePort = sourceNode.getPort(ts.getSourcePortId());
  const targetPort = targetNode.getPort(ts.getTargetPortId());
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

/**
 * Anchors of all texts and stops on the oblique path: the model's own
 * cached text positions, rotated along the exit-to-exit segment.
 */
function getPoints(ts: TrainrunSection): {
  labels: Record<TrainrunSectionText, ShapeLabel>;
  stopsSegment: [Vec2D, Vec2D];
} {
  const [, s1, t1] = getPath(ts);
  const segment: [Vec2D, Vec2D] = [s1, t1];
  const label = (text: TrainrunSectionText): ShapeLabel => ({
    x: ts.getTextPositionX(text),
    y: ts.getTextPositionY(text),
    segment,
  });
  return {
    labels: {
      [TrainrunSectionText.SourceArrival]: label(TrainrunSectionText.SourceArrival),
      [TrainrunSectionText.SourceDeparture]: label(TrainrunSectionText.SourceDeparture),
      [TrainrunSectionText.TargetArrival]: label(TrainrunSectionText.TargetArrival),
      [TrainrunSectionText.TargetDeparture]: label(TrainrunSectionText.TargetDeparture),
      [TrainrunSectionText.TrainrunSectionName]: label(TrainrunSectionText.TrainrunSectionName),
      [TrainrunSectionText.TrainrunSectionTravelTime]: label(
        TrainrunSectionText.TrainrunSectionTravelTime,
      ),
      [TrainrunSectionText.TrainrunSectionBackwardTravelTime]: label(
        TrainrunSectionText.TrainrunSectionBackwardTravelTime,
      ),
      [TrainrunSectionText.TrainrunSectionNumberOfStops]: label(
        TrainrunSectionText.TrainrunSectionNumberOfStops,
      ),
    },
    stopsSegment: segment,
  };
}

export const ObliqueSectionShape: SectionShape = {
  getPath,
  getPoints,
  getPathAsSVGString: (path: Vec2D[]): string => buildPathString(path, 0),
};
