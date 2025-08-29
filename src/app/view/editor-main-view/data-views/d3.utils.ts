import {TrainrunSection} from "../../../models/trainrunsection.model";
import {StaticDomTags} from "./static.dom.tags";
import {Node} from "../../../models/node.model";
import * as d3 from "d3";
import {Vec2D} from "../../../utils/vec2D";
import {TrainrunSectionViewObject} from "./trainrunSectionViewObject";
import {NodeViewObject} from "./nodeViewObject";
import {Transition} from "../../../models/transition.model";
import {TransitionViewObject} from "./transitionViewObject";
import {MathUtils} from "../../../utils/math";
import {ShortestDistanceNode} from "../../../services/analytics/algorithms/shortest-distance-node";

export class D3Utils {
  static isSpecialEditingEnabled = false;
  static isShortestDistanceRendererEnabled = false;

  private static doFastRenderingUpdate = false;
  private static isOnFront: any;

  static enableFastRenderingUpdate() {
    D3Utils.doFastRenderingUpdate = true;
  }

  static disableFastRenderingUpdate() {
    D3Utils.doFastRenderingUpdate = false;
  }

  static isFastRenderingUpdateOn(): boolean {
    return D3Utils.doFastRenderingUpdate;
  }

  static bringTrainrunSectionToFront() {
    if (D3Utils.doFastRenderingUpdate) {
      return;
    }
    //d3.selectAll(
    //  StaticDomTags.EDGE_ROOT_CONTAINER_DOM_REF + "." + StaticDomTags.TAG_HOVER,
    //).raise();
    d3.selectAll(
      StaticDomTags.EDGE_ROOT_CONTAINER_DOM_REF + "." + StaticDomTags.TAG_SELECTED,
    ).raise();
  }

  static hoverTrainrunSection(trainrunSection: TrainrunSection, bringToFront = true, domObj: any) {
    d3.selectAll(StaticDomTags.EDGE_LINE_ARROW_DOM_REF)
      .filter(
        (d: TrainrunSectionViewObject) =>
          d !== undefined && d.trainrunSection.getTrainrunId() === trainrunSection.getTrainrunId(),
      )
      .classed(StaticDomTags.TAG_HOVER, true);

    d3.selectAll(StaticDomTags.EDGE_LINE_DOM_REF)
      .filter(
        (d: TrainrunSectionViewObject) =>
          d !== undefined && d.trainrunSection.getTrainrunId() === trainrunSection.getTrainrunId(),
      )
      .classed(StaticDomTags.TAG_HOVER, true);

    d3.selectAll(StaticDomTags.EDGE_ROOT_CONTAINER_DOM_REF)
      .filter(
        (d: TrainrunSectionViewObject) =>
          d !== undefined && d.trainrunSection.getTrainrunId() === trainrunSection.getTrainrunId(),
      )
      .classed(StaticDomTags.TAG_HOVER, true);

    d3.selectAll(StaticDomTags.TRANSITION_LINE_DOM_REF)
      .filter(
        (d: TransitionViewObject) =>
          d !== undefined && d.transition.getTrainrun().getId() === trainrunSection.getTrainrunId(),
      )
      .classed(StaticDomTags.TAG_HOVER, true);

    if (bringToFront) {
      if (D3Utils.isOnFront !== domObj) {
        D3Utils.bringTrainrunSectionToFront();
      }
    } else {
      if (domObj !== undefined) {
        const attrId = d3.select(domObj).attr("id");
        const objs = d3.selectAll(
          StaticDomTags.EDGE_ROOT_CONTAINER_DOM_REF + "[id='" + attrId + "']",
        );
        objs.raise();
      }
    }
    D3Utils.isOnFront = domObj;
  }

  static unhoverTrainrunSection(trainrunSection: TrainrunSection) {
    d3.selectAll(StaticDomTags.EDGE_LINE_ARROW_DOM_REF)
      .filter(
        (d: TrainrunSectionViewObject) =>
          d !== undefined && d.trainrunSection.getTrainrunId() === trainrunSection.getTrainrunId(),
      )
      .classed(StaticDomTags.TAG_HOVER, false);
    d3.selectAll(StaticDomTags.EDGE_LINE_DOM_REF)
      .filter(
        (d: TrainrunSectionViewObject) =>
          d !== undefined && d.trainrunSection.getTrainrunId() === trainrunSection.getTrainrunId(),
      )
      .classed(StaticDomTags.TAG_HOVER, false);

    d3.selectAll(StaticDomTags.EDGE_ROOT_CONTAINER_DOM_REF)
      .filter(
        (d: TrainrunSectionViewObject) =>
          d !== undefined && d.trainrunSection.getTrainrunId() === trainrunSection.getTrainrunId(),
      )
      .classed(StaticDomTags.TAG_HOVER, false);

    d3.selectAll(StaticDomTags.TRANSITION_LINE_DOM_REF)
      .filter(
        (d: TransitionViewObject) =>
          d !== undefined && d.transition.getTrainrun().getId() === trainrunSection.getTrainrunId(),
      )
      .classed(StaticDomTags.TAG_HOVER, false);
  }

  static updateTrainrunSectionPreviewLine(startPos: Vec2D) {
    const mousePos = d3.mouse(d3.select(StaticDomTags.PREVIEW_LINE_DOM_REF).node());
    const mousePosVec: Vec2D = new Vec2D(mousePos[0], mousePos[1]);
    const fromPos: Vec2D = Vec2D.add(
      startPos,
      Vec2D.scale(Vec2D.normalize(Vec2D.sub(mousePosVec, startPos)), 8.0),
    );
    d3.selectAll(StaticDomTags.PREVIEW_LINE_DOM_REF).attr(
      "d",
      "M" +
        fromPos.getX() +
        "," +
        fromPos.getY() +
        "L" +
        mousePosVec.getX() +
        "," +
        mousePosVec.getY(),
    );
  }

  static updateIntermediateStopOrTransitionPreviewLine(startPos: Vec2D, endPos: Vec2D) {
    const mousePos = d3.mouse(d3.select(StaticDomTags.PREVIEW_LINE_DOM_REF).node());
    const mousePosVec: Vec2D = new Vec2D(mousePos[0], mousePos[1]);
    const fromPos: Vec2D = Vec2D.add(
      startPos,
      Vec2D.scale(Vec2D.normalize(Vec2D.sub(mousePosVec, startPos)), 8.0),
    );
    const toPos: Vec2D = Vec2D.add(
      endPos,
      Vec2D.scale(Vec2D.normalize(Vec2D.sub(mousePosVec, endPos)), 8.0),
    );
    d3.selectAll(StaticDomTags.PREVIEW_LINE_DOM_REF).attr(
      "d",
      "M" +
        fromPos.getX() +
        "," +
        fromPos.getY() +
        "L" +
        mousePosVec.getX() +
        "," +
        mousePosVec.getY() +
        "L" +
        toPos.getX() +
        "," +
        toPos.getY(),
    );
  }

  static updateConnectionPreviewLine(startPos: Vec2D) {
    const mousePos = d3.mouse(d3.select(StaticDomTags.PREVIEW_CONNECTION_LINE_DOM_REF).node());
    const mousePosVec: Vec2D = new Vec2D(mousePos[0], mousePos[1]);
    const fromPos: Vec2D = Vec2D.add(
      startPos,
      Vec2D.scale(Vec2D.normalize(Vec2D.sub(mousePosVec, startPos)), 8.0),
    );
    const toPos: Vec2D = Vec2D.add(
      mousePosVec,
      Vec2D.scale(Vec2D.normalize(Vec2D.sub(startPos, mousePosVec)), 8.0),
    );
    d3.selectAll(StaticDomTags.PREVIEW_CONNECTION_LINE_DOM_REF).attr(
      "d",
      "M" + fromPos.getX() + "," + fromPos.getY() + "L" + toPos.getX() + "," + toPos.getY(),
    );
  }

  static disableTrainrunSectionForEventHandling() {
    d3.selectAll(StaticDomTags.EDGE_LINE_TEXT_DOM_REF).classed(
      StaticDomTags.EDGE_DISABLE_EVENTS,
      true,
    );
    d3.selectAll(StaticDomTags.EDGE_LINE_TEXT_BACKGROUND_DOM_REF).classed(
      StaticDomTags.EDGE_DISABLE_EVENTS,
      true,
    );
    d3.selectAll(StaticDomTags.EDGE_LINE_DOM_REF).classed(StaticDomTags.EDGE_DISABLE_EVENTS, true);
    d3.selectAll(StaticDomTags.EDGE_LINE_PIN_DOM_REF).classed(
      StaticDomTags.EDGE_DISABLE_EVENTS,
      true,
    );
    d3.selectAll(StaticDomTags.EDGE_LINE_ARROW_DOM_REF).classed(
      StaticDomTags.EDGE_DISABLE_EVENTS,
      true,
    );
  }

  static resetTrainrunSectionForEventHandling() {
    d3.selectAll(StaticDomTags.EDGE_LINE_TEXT_DOM_REF).classed(
      StaticDomTags.EDGE_DISABLE_EVENTS,
      false,
    );
    d3.selectAll(StaticDomTags.EDGE_LINE_TEXT_BACKGROUND_DOM_REF).classed(
      StaticDomTags.EDGE_DISABLE_EVENTS,
      false,
    );
    d3.selectAll(StaticDomTags.EDGE_LINE_DOM_REF).classed(StaticDomTags.EDGE_DISABLE_EVENTS, false);
    d3.selectAll(StaticDomTags.EDGE_LINE_PIN_DOM_REF).classed(
      StaticDomTags.EDGE_DISABLE_EVENTS,
      false,
    );
    d3.selectAll(StaticDomTags.EDGE_LINE_ARROW_DOM_REF).classed(
      StaticDomTags.EDGE_DISABLE_EVENTS,
      false,
    );
  }

  static highlightNode(node: Node) {
    d3.selectAll(StaticDomTags.NODE_ROOT_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.NODE_HIGHLIGHT, true);
  }

  static unhighlightNode(node: Node) {
    d3.selectAll(StaticDomTags.NODE_ROOT_DOM_REF)
      .filter((n: NodeViewObject) => n.node.getId() === node.getId())
      .classed(StaticDomTags.NODE_HIGHLIGHT, false);
  }

  static getPathAsSVGString(pathVec2D: Vec2D[]) {
    let sep = "M";
    let svgPathString = "";
    pathVec2D.forEach((p) => {
      svgPathString += sep + p.getX() + "," + p.getY();
      sep = "L";
    });
    return svgPathString;
  }

  static getBezierCurveAsSVGString(pathVec2D: Vec2D[]) {
    const start: Vec2D = pathVec2D[0];
    const controlPointStart: Vec2D = pathVec2D[1];
    const controlPointEnd: Vec2D = pathVec2D[2];
    const end: Vec2D = pathVec2D[3];

    let v = "M " + start.getX() + " " + start.getY();
    v += "C " + controlPointStart.getX() + " " + controlPointStart.getY();
    v += ", " + controlPointEnd.getX() + " " + controlPointEnd.getY();
    v += ", " + end.getX() + "," + end.getY();

    return v;
  }

  static doGrayoutTrainrunSectionPin(trainrunSection: TrainrunSection, node: Node) {
    // Performance ISSUE : TODO - this special effect hast to be overworked. It's really slow!
    /*
    d3.selectAll(StaticDomTags.EDGE_LINE_PIN_DOM_REF)
      .filter((ts: TrainrunSectionViewObject, idx) => {
          let nodeFound = false;
          d3.selectAll(StaticDomTags.EDGE_LINE_PIN_DOM_REF).each(
            (d, i, a) => {
              if (d3.select(a[i]).attr('node_id') === ('' + node.getId()) && i === idx) {
                nodeFound = true;
              }
            });
          return ts.trainrunSection.getId() === trainrunSection.getId() && nodeFound;
        }
      )
      .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, true);
     */
  }

  static removeGrayoutTrainrunSectionPin() {
    d3.selectAll(StaticDomTags.EDGE_LINE_PIN_DOM_REF).classed(
      StaticDomTags.EDGE_LINE_GRAYEDOUT,
      false,
    );
  }

  static doGrayoutTransition(transition: Transition) {
    d3.selectAll(StaticDomTags.TRANSITION_LINE_DOM_REF)
      .filter((d: TransitionViewObject) => {
        if (d === undefined) {
          return false;
        }
        return d.transition.getId() === transition.getId();
      })
      .classed(StaticDomTags.TAG_SELECTED, false)
      .classed(StaticDomTags.TAG_HOVER, false)
      .classed(StaticDomTags.TAG_WARNING, false)
      .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, true);

    d3.selectAll(StaticDomTags.TRANSITION_BUTTON_DOM_REF)
      .filter((d: TransitionViewObject) => {
        if (d === undefined) {
          return false;
        }
        return d.transition.getId() === transition.getId();
      })
      .classed(StaticDomTags.TAG_SELECTED, false)
      .classed(StaticDomTags.TAG_HOVER, false)
      .classed(StaticDomTags.TAG_WARNING, false)
      .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, true);
  }

  static removeGrayoutTransition(transition: Transition) {
    d3.selectAll(StaticDomTags.TRANSITION_LINE_DOM_REF)
      .filter((d: TransitionViewObject) => {
        if (d === undefined) {
          return false;
        }
        return d.transition.getId() === transition.getId();
      })
      .classed(StaticDomTags.TAG_SELECTED, true)
      .classed(StaticDomTags.TAG_HOVER, false)
      .classed(StaticDomTags.TAG_WARNING, false)
      .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, false);

    d3.selectAll(StaticDomTags.TRANSITION_BUTTON_DOM_REF)
      .filter((d: TransitionViewObject) => {
        if (d === undefined) {
          return false;
        }
        return d.transition.getId() === transition.getId();
      })
      .classed(StaticDomTags.TAG_SELECTED, true)
      .classed(StaticDomTags.TAG_HOVER, false)
      .classed(StaticDomTags.TAG_WARNING, false)
      .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, false);
  }

  static doGrayout(trainrunSection: TrainrunSection, grayoutEdgeLinePinNode: Node = undefined) {
    d3.selectAll(StaticDomTags.EDGE_LINE_ARROW_DOM_REF)
      .filter((d: TrainrunSectionViewObject) => {
        if (d === undefined) {
          return false;
        }
        return d.trainrunSection.getId() === trainrunSection.getId();
      })
      .classed(StaticDomTags.TAG_SELECTED, false)
      .classed(StaticDomTags.TAG_HOVER, false)
      .classed(StaticDomTags.TAG_WARNING, false)
      .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, true);

    d3.selectAll(StaticDomTags.EDGE_LINE_DOM_REF)
      .filter((d: TrainrunSectionViewObject) => {
        if (d === undefined) {
          return false;
        }
        return d.trainrunSection.getId() === trainrunSection.getId();
      })
      .classed(StaticDomTags.TAG_SELECTED, false)
      .classed(StaticDomTags.TAG_HOVER, false)
      .classed(StaticDomTags.TAG_WARNING, false)
      .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, true);

    d3.selectAll(StaticDomTags.EDGE_LINE_TEXT_DOM_REF)
      .filter((d: TrainrunSectionViewObject) => {
        if (d === undefined) {
          return false;
        }
        return d.trainrunSection.getId() === trainrunSection.getId();
      })
      .classed(StaticDomTags.TAG_SELECTED, false)
      .classed(StaticDomTags.TAG_HOVER, false)
      .classed(StaticDomTags.TAG_WARNING, false)
      .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, true);

    d3.selectAll(StaticDomTags.EDGE_LINE_STOPS_DOM_REF)
      .filter((d: TrainrunSectionViewObject) => {
        if (d === undefined) {
          return false;
        }
        return d.trainrunSection.getId() === trainrunSection.getId();
      })
      .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, true);

    if (grayoutEdgeLinePinNode !== undefined) {
      d3.selectAll(StaticDomTags.EDGE_LINE_PIN_DOM_REF + "." + StaticDomTags.EDGE_IS_SOURCE)
        .filter((d: TrainrunSectionViewObject) => {
          if (d === undefined) {
            return false;
          }
          return (
            d.trainrunSection.getId() === trainrunSection.getId() &&
            d.trainrunSection.getSourceNodeId() === grayoutEdgeLinePinNode.getId()
          );
        })
        .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, true);
      d3.selectAll(StaticDomTags.EDGE_LINE_PIN_DOM_REF + "." + StaticDomTags.EDGE_IS_TARGET)
        .filter((d: TrainrunSectionViewObject) => {
          if (d === undefined) {
            return false;
          }
          return (
            d.trainrunSection.getId() === trainrunSection.getId() &&
            d.trainrunSection.getTargetNodeId() === grayoutEdgeLinePinNode.getId()
          );
        })
        .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, true);
    }
  }

  static removeGrayout(trainrunSection: TrainrunSection, grayoutEdgeLinePinNode: Node = undefined) {
    d3.selectAll(StaticDomTags.EDGE_LINE_ARROW_DOM_REF)
      .filter((d: TrainrunSectionViewObject) => {
        if (d === undefined) {
          return false;
        }
        return d.trainrunSection.getId() === trainrunSection.getId();
      })
      .classed(StaticDomTags.TAG_SELECTED, true)
      .classed(StaticDomTags.TAG_HOVER, false)
      .classed(StaticDomTags.TAG_WARNING, false)
      .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, false);

    d3.selectAll(StaticDomTags.EDGE_LINE_DOM_REF)
      .filter((d: TrainrunSectionViewObject) => {
        if (d === undefined) {
          return false;
        }
        return d.trainrunSection.getId() === trainrunSection.getId();
      })
      .classed(StaticDomTags.TAG_SELECTED, true)
      .classed(StaticDomTags.TAG_HOVER, false)
      .classed(StaticDomTags.TAG_WARNING, false)
      .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, false);

    d3.selectAll(StaticDomTags.EDGE_LINE_TEXT_DOM_REF)
      .filter((d: TrainrunSectionViewObject) => {
        if (d === undefined) {
          return false;
        }
        return d.trainrunSection.getId() === trainrunSection.getId();
      })
      .classed(StaticDomTags.TAG_SELECTED, true)
      .classed(StaticDomTags.TAG_HOVER, false)
      .classed(StaticDomTags.TAG_WARNING, false)
      .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, false);

    d3.selectAll(StaticDomTags.EDGE_LINE_STOPS_DOM_REF)
      .filter((d: TrainrunSectionViewObject) => {
        if (d === undefined) {
          return false;
        }
        return d.trainrunSection.getId() === trainrunSection.getId();
      })
      .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, false);

    if (grayoutEdgeLinePinNode !== undefined) {
      d3.selectAll(StaticDomTags.EDGE_LINE_PIN_DOM_REF + "." + StaticDomTags.EDGE_IS_SOURCE)
        .filter((d: TrainrunSectionViewObject) => {
          if (d === undefined) {
            return false;
          }
          return (
            d.trainrunSection.getId() === trainrunSection.getId() &&
            d.trainrunSection.getSourceNodeId() === grayoutEdgeLinePinNode.getId()
          );
        })
        .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, false);
      d3.selectAll(StaticDomTags.EDGE_LINE_PIN_DOM_REF + "." + StaticDomTags.EDGE_IS_TARGET)
        .filter((d: TrainrunSectionViewObject) => {
          if (d === undefined) {
            return false;
          }
          return (
            d.trainrunSection.getId() === trainrunSection.getId() &&
            d.trainrunSection.getTargetNodeId() === grayoutEdgeLinePinNode.getId()
          );
        })
        .classed(StaticDomTags.EDGE_LINE_GRAYEDOUT, false);
    }
  }

  static makeHexagonSVGPoints(center: Vec2D, scale: number): string {
    const polygonPoints: Vec2D[] = [];
    polygonPoints.push(new Vec2D(-0.5, -1));
    polygonPoints.push(new Vec2D(0.5, -1));
    polygonPoints.push(new Vec2D(1, 0));
    polygonPoints.push(new Vec2D(0.5, 1));
    polygonPoints.push(new Vec2D(-0.5, 1));
    polygonPoints.push(new Vec2D(-1, 0));

    let pointString = "";
    for (const p of polygonPoints) {
      const v = Vec2D.add(Vec2D.scale(p, scale), center);
      pointString = pointString + " " + v.getX() + "," + v.getY();
    }
    return pointString;
  }

  static enableSpecialEditing(isTopologyOrNodeEditing: boolean) {
    const rootElement = d3.select("#graphContainer");

    rootElement
      .selectAll("path")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, true);
    rootElement
      .selectAll("rect")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, true);
    rootElement
      .selectAll("circle")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, true);
    rootElement
      .selectAll("line")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, true);
    rootElement
      .selectAll("text")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, true);

    d3.selectAll(StaticDomTags.NODE_ROOT_DOM_REF).classed(
      StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS,
      false,
    );
    d3.selectAll(StaticDomTags.NODE_BACKGROUND_DOM_REF).classed(
      StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS,
      false,
    );
    d3.selectAll(StaticDomTags.NODE_DOCKABLE_DOM_REF).classed(
      StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS,
      false,
    );
    d3.selectAll(StaticDomTags.NODE_LABELAREA_TEXT_DOM_REF).classed(
      StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS,
      false,
    );

    d3.selectAll(StaticDomTags.NOTE_ROOT_DOM_REF).classed(
      StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS,
      false,
    );
    d3.selectAll(StaticDomTags.NOTE_HOVER_ROOT_SVG).classed(
      StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS,
      false,
    );

    if (isTopologyOrNodeEditing) {
      d3.selectAll(StaticDomTags.NODE_CONNECTIONTIME_TEXT_DOM_REF).classed(
        StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS,
        false,
      );
      d3.selectAll(StaticDomTags.NODE_EDIT_AREA_BACKGROUND_DOM_REF).classed(
        StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS,
        false,
      );
      d3.selectAll(StaticDomTags.NODE_EDIT_AREA_DOM_REF).classed(
        StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS,
        false,
      );
    }

    D3Utils.isSpecialEditingEnabled = true;
  }

  static disableSpecialEditing() {
    if (!D3Utils.isSpecialEditingEnabled) {
      return;
    }
    const rootElement = d3.select("#graphContainer");
    rootElement
      .selectAll("path")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, false);
    rootElement
      .selectAll("rect")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, false);
    rootElement
      .selectAll("circle")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, false);
    rootElement
      .selectAll("line")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, false);
    rootElement
      .selectAll("text")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, false);

    D3Utils.isSpecialEditingEnabled = false;
  }

  static resetShortestDistanceRenderer() {
    if (!D3Utils.isShortestDistanceRendererEnabled) {
      return;
    }
    const rootElement = d3.select("#graphContainer");
    rootElement
      .selectAll(StaticDomTags.NODE_ANALYTICSAREA_DOM_REF)
      .classed(StaticDomTags.TAG_ANALYTICS_LEVEL_0, false);
    rootElement
      .selectAll(StaticDomTags.NODE_ANALYTICSAREA_DOM_REF)
      .classed(StaticDomTags.TAG_ANALYTICS_LEVEL_1, false);
    rootElement
      .selectAll(StaticDomTags.NODE_ANALYTICSAREA_DOM_REF)
      .classed(StaticDomTags.TAG_ANALYTICS_LEVEL_2, false);
    rootElement
      .selectAll(StaticDomTags.NODE_ANALYTICSAREA_DOM_REF)
      .classed(StaticDomTags.TAG_ANALYTICS_LEVEL_3, false);
    rootElement
      .selectAll(StaticDomTags.NODE_ANALYTICSAREA_DOM_REF)
      .classed(StaticDomTags.TAG_ANALYTICS_LEVEL_4, false);
    rootElement
      .selectAll(StaticDomTags.NODE_ANALYTICSAREA_DOM_REF)
      .classed(StaticDomTags.TAG_ANALYTICS_LEVEL_5, false);

    rootElement
      .selectAll("text")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, false);
    rootElement
      .selectAll("rect")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, false);
    rootElement
      .selectAll("path")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, false);
    rootElement
      .selectAll("circle")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, false);

    rootElement.selectAll("text").classed(StaticDomTags.TAG_ANALYTICS_ENFORCE_DISABLE, false);
    rootElement.selectAll("rect").classed(StaticDomTags.TAG_ANALYTICS_ENFORCE_DISABLE, false);
    rootElement.selectAll("path").classed(StaticDomTags.TAG_ANALYTICS_ENFORCE_DISABLE, false);
    rootElement.selectAll("circle").classed(StaticDomTags.TAG_ANALYTICS_ENFORCE_DISABLE, false);

    rootElement.selectAll("text").classed(StaticDomTags.TAG_EVENT_DISABLED, false);
    rootElement.selectAll("rect").classed(StaticDomTags.TAG_EVENT_DISABLED, false);
    rootElement.selectAll("path").classed(StaticDomTags.TAG_EVENT_DISABLED, false);
    rootElement.selectAll("circle").classed(StaticDomTags.TAG_EVENT_DISABLED, false);

    rootElement
      .selectAll("text")
      .classed(StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_CLICKABLE, false);
    rootElement
      .selectAll("text")
      .classed(StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_MUTED, false);
    d3.selectAll("text").classed(StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_FOCUSED, false);

    rootElement.selectAll(StaticDomTags.NODE_ANALYTICSAREA_TEXT_LEFT_DOM_REF).text("");
    rootElement.selectAll(StaticDomTags.NODE_ANALYTICSAREA_TEXT_RIGHT_DOM_REF).text("");

    D3Utils.isShortestDistanceRendererEnabled = false;
  }

  static enableShortestDistanceRenderer() {
    D3Utils.isShortestDistanceRendererEnabled = true;
    D3Utils.initShortestDistanceRenderer();
  }

  static initShortestDistanceRenderer() {
    const rootElement = d3.select("#graphContainer");
    rootElement
      .selectAll(StaticDomTags.NODE_ANALYTICSAREA_DOM_REF)
      .classed(StaticDomTags.TAG_ANALYTICS_LEVEL_0, false);
    rootElement
      .selectAll(StaticDomTags.NODE_ANALYTICSAREA_DOM_REF)
      .classed(StaticDomTags.TAG_ANALYTICS_LEVEL_1, false);
    rootElement
      .selectAll(StaticDomTags.NODE_ANALYTICSAREA_DOM_REF)
      .classed(StaticDomTags.TAG_ANALYTICS_LEVEL_2, false);
    rootElement
      .selectAll(StaticDomTags.NODE_ANALYTICSAREA_DOM_REF)
      .classed(StaticDomTags.TAG_ANALYTICS_LEVEL_3, false);
    rootElement
      .selectAll(StaticDomTags.NODE_ANALYTICSAREA_DOM_REF)
      .classed(StaticDomTags.TAG_ANALYTICS_LEVEL_4, false);
    rootElement
      .selectAll(StaticDomTags.NODE_ANALYTICSAREA_DOM_REF)
      .classed(StaticDomTags.TAG_ANALYTICS_LEVEL_5, false);

    rootElement.selectAll("text").classed(StaticDomTags.TAG_EVENT_DISABLED, true);
    rootElement.selectAll("rect").classed(StaticDomTags.TAG_EVENT_DISABLED, true);
    rootElement.selectAll("path").classed(StaticDomTags.TAG_EVENT_DISABLED, true);
    rootElement
      .selectAll("path")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, true);
    rootElement
      .selectAll("circle")
      .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, true);

    rootElement
      .selectAll("text.edge_text")
      .classed(StaticDomTags.TAG_ANALYTICS_ENFORCE_DISABLE, true);
    rootElement.selectAll("text.edge_text").classed(StaticDomTags.TAG_EVENT_DISABLED, true);

    d3.selectAll("text.edge_text.SourceDeparture").classed(
      StaticDomTags.TAG_ANALYTICS_ENFORCE_DISABLE,
      false,
    );
    d3.selectAll("text.edge_text.TargetDeparture").classed(
      StaticDomTags.TAG_ANALYTICS_ENFORCE_DISABLE,
      false,
    );

    d3.selectAll("text.edge_text.SourceDeparture").classed(StaticDomTags.TAG_EVENT_DISABLED, false);
    d3.selectAll("text.edge_text.TargetDeparture").classed(StaticDomTags.TAG_EVENT_DISABLED, false);

    d3.selectAll("text.edge_text.SourceDeparture").classed(
      StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_CLICKABLE,
      true,
    );
    d3.selectAll("text.edge_text.TargetDeparture").classed(
      StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_CLICKABLE,
      true,
    );

    d3.selectAll("text.edge_text").classed(
      StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_FOCUSED,
      false,
    );

    d3.selectAll(StaticDomTags.NODE_HOVER_ROOT_DOM_REF).classed(
      StaticDomTags.TAG_EVENT_DISABLED,
      false,
    );

    rootElement.selectAll(StaticDomTags.NODE_ANALYTICSAREA_TEXT_LEFT_DOM_REF).text("").raise();
    rootElement.selectAll(StaticDomTags.NODE_ANALYTICSAREA_TEXT_RIGHT_DOM_REF).text("").raise();
    rootElement.selectAll(StaticDomTags.NODE_ANALYTICSAREA_DOM_REF).raise();
  }

  static shortestDistanceRenderer(finalShortestDistanceNodes: ShortestDistanceNode[]) {
    D3Utils.initShortestDistanceRenderer();

    let finalTrainrunSections: TrainrunSection[] = [];
    finalShortestDistanceNodes.forEach((snd: ShortestDistanceNode) => {
      snd.path.forEach((ts: TrainrunSection) => {
        finalTrainrunSections.push(ts);
      });
    });
    finalTrainrunSections = finalTrainrunSections.filter((v, i, a) => a.indexOf(v) === i);

    if (finalShortestDistanceNodes.length > 0) {
      d3.selectAll("text.edge_text.SourceDeparture").classed(
        StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_MUTED,
        true,
      );
      d3.selectAll("text.edge_text.TargetDeparture").classed(
        StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_MUTED,
        true,
      );
    }

    const rootElement = d3.select("#graphContainer");
    finalShortestDistanceNodes.forEach((sdn: ShortestDistanceNode) => {
      let endNodeId = sdn.node.getId();
      sdn.path.reverse().forEach((ts: TrainrunSection) => {
        // trainrun section (edge)
        rootElement
          .selectAll('path.edge_line[id="' + ts.getId() + '"]')
          .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, false);
        rootElement
          .selectAll('text.edge_text[id="' + ts.getId() + '"]')
          .classed(StaticDomTags.TAG_ANALYTICS_ENFORCE_DISABLE, false)
          .classed(StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_MUTED, false);
        rootElement
          .selectAll('circle.edge_line_stops[id="' + ts.getId() + '"]')
          .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, false);
        d3.selectAll('text.edge_text.SourceDeparture[id="' + ts.getId() + '"]')
          .classed(StaticDomTags.TAG_EVENT_DISABLED, false)
          .classed(StaticDomTags.TAG_ANALYTICS_ENFORCE_DISABLE, false)
          .classed(StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_CLICKABLE, false);
        d3.selectAll('text.edge_text.TargetDeparture[id="' + ts.getId() + '"]')
          .classed(StaticDomTags.TAG_EVENT_DISABLED, false)
          .classed(StaticDomTags.TAG_ANALYTICS_ENFORCE_DISABLE, false)
          .classed(StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_CLICKABLE, false);

        // orientation to improve readability
        if (ts.getTargetNodeId() === endNodeId) {
          d3.selectAll('text.edge_text.TargetDeparture[id="' + ts.getId() + '"]').classed(
            StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_MUTED,
            true,
          );
          d3.selectAll('text.edge_text.SourceArrival[id="' + ts.getId() + '"]').classed(
            StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_MUTED,
            true,
          );
          d3.selectAll('text.edge_text.SourceDeparture[id="' + ts.getId() + '"]').classed(
            StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_FOCUSED,
            true,
          );
          d3.selectAll('text.edge_text.TargetArrival[id="' + ts.getId() + '"]').classed(
            StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_FOCUSED,
            true,
          );
          endNodeId = ts.getSourceNodeId();
        } else {
          d3.selectAll('text.edge_text.SourceDeparture[id="' + ts.getId() + '"]').classed(
            StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_MUTED,
            true,
          );
          d3.selectAll('text.edge_text.TargetArrival[id="' + ts.getId() + '"]').classed(
            StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_MUTED,
            true,
          );
          d3.selectAll('text.edge_text.TargetDeparture[id="' + ts.getId() + '"]').classed(
            StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_FOCUSED,
            true,
          );
          d3.selectAll('text.edge_text.SourceArrival[id="' + ts.getId() + '"]').classed(
            StaticDomTags.TAG_ANALYTICS_TRAINRUNSECTION_TEXT_FOCUSED,
            true,
          );
          endNodeId = ts.getTargetNodeId();
        }

        // transition
        const srcNode = ts.getSourceNode();
        const trgNode = ts.getTargetNode();
        const srcTrans = srcNode.getTransition(ts.getId());
        const trgTrans = trgNode.getTransition(ts.getId());
        if (srcTrans !== undefined) {
          const srcId1 = srcNode.getPort(srcTrans.getPortId1()).getTrainrunSection().getId();
          const srcId2 = srcNode.getPort(srcTrans.getPortId2()).getTrainrunSection().getId();
          if (
            finalTrainrunSections.find((checkTs: TrainrunSection) => checkTs.getId() === srcId1) !==
              undefined &&
            finalTrainrunSections.find((checkTs: TrainrunSection) => checkTs.getId() === srcId2) !==
              undefined
          ) {
            rootElement
              .selectAll(
                "path.transition_line[" +
                  StaticDomTags.TRANSITION_TRAINRUNSECTION_ID1 +
                  '="' +
                  srcId1 +
                  '"][' +
                  StaticDomTags.TRANSITION_TRAINRUNSECTION_ID2 +
                  '="' +
                  srcId2 +
                  '"]',
              )
              .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, false);
          }
        }
        if (trgTrans !== undefined) {
          const trgId1 = trgNode.getPort(trgTrans.getPortId1()).getTrainrunSection().getId();
          const trgId2 = trgNode.getPort(trgTrans.getPortId2()).getTrainrunSection().getId();
          if (
            finalTrainrunSections.find((checkTs: TrainrunSection) => checkTs.getId() === trgId1) !==
              undefined &&
            finalTrainrunSections.find((checkTs: TrainrunSection) => checkTs.getId() === trgId2) !==
              undefined
          ) {
            rootElement
              .selectAll(
                "path.transition_line[" +
                  StaticDomTags.TRANSITION_TRAINRUNSECTION_ID1 +
                  '="' +
                  trgId1 +
                  '"][' +
                  StaticDomTags.TRANSITION_TRAINRUNSECTION_ID2 +
                  '="' +
                  trgId2 +
                  '"]',
              )
              .classed(StaticDomTags.TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS, false);
          }
        }
      });
    });

    rootElement
      .selectAll("rect.node_analyticsarea")
      .classed(StaticDomTags.TAG_ANALYTICS_LEVEL_5, true);
    rootElement.selectAll("text.node_title_analyticsarea_left").text("");
    rootElement.selectAll("text.node_title_analyticsarea_right").text("");

    finalShortestDistanceNodes.forEach((sdn: ShortestDistanceNode) => {
      const level = Math.max(
        0,
        sdn.path
          .map((ts: TrainrunSection) => ts.getTrainrunId())
          .filter((v, i, a) => a.indexOf(v) === i).length - 1,
      );

      rootElement
        .selectAll('rect.node_analyticsarea[id="' + sdn.node.getId() + '"]')
        .classed(StaticDomTags.TAG_ANALYTICS_LEVEL_5, false)
        .classed(StaticDomTags.TAG_ANALYTICS_LEVEL + Math.min(5, level), true);

      rootElement
        .selectAll('text.node_title_analyticsarea_left[id="' + sdn.node.getId() + '"]')
        .text("#" + level);

      rootElement
        .selectAll('text.node_title_analyticsarea_right[id="' + sdn.node.getId() + '"]')
        .text(D3Utils.formatTime(sdn.distance, 0));
    });
  }

  static formatTime(time: number, timeDisplayPrecision: number): string {
    const prefix = time < 0 ? "-" : "";
    if (time < 0) {
      time = -time;
    }
    const roundedTime = MathUtils.round(time, timeDisplayPrecision);
    const hours = Math.floor(roundedTime / 60);
    const minutes = roundedTime % 60;
    return (
      prefix + (hours < 10 ? "0" + hours : hours) + ":" + (minutes < 10 ? "0" + minutes : minutes)
    );
  }
}
