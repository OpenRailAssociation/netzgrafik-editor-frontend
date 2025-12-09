import {
  ANGLE_UPSIDE_DOWN_THRESHOLD,
  DEFAULT_ANGLE_HORIZONTAL,
  DEFAULT_ANGLE_VERTICAL,
  DEFAULT_PIN_RADIUS,
  DEFAULT_STOP_ICON,
  EDGE_CASE_THRESHOLD,
  NODE_EDGE_WIDTH,
  NODE_TEXT_AREA_HEIGHT,
  RASTERING_BASIC_GRID_SIZE,
  SHOW_MAX_SINGLE_TRAINRUN_SECTIONS_STOPS,
  TRAINRUN_SECTION_TEXT_AREA_HEIGHT,
  TRAINRUN_SECTION_TEXT_AREA_WIDTH,
} from "../../rastering/definitions";
import * as d3 from "d3";
import {Vec2D} from "../../../utils/vec2D";
import {
  ColorRefType,
  PortAlignment,
  TrainrunSectionText,
} from "../../../data-structures/technical.data.structures";
import {StaticDomTags} from "./static.dom.tags";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {EditorView} from "./editor.view";

import {D3Utils} from "./d3.utils";
import {DragIntermediateStopInfo, PreviewLineMode} from "./trainrunsection.previewline.view";
import {MathUtils} from "../../../utils/math";
import {Trainrun} from "../../../models/trainrun.model";
import {TrainrunSectionViewObject} from "./trainrunSectionViewObject";
import {Node} from "../../../models/node.model";
import {Port} from "../../../models/port.model";
import {EditorMode} from "../../editor-menu/editor-mode";
import {Transition} from "../../../models/transition.model";
import {InformSelectedTrainrunClick} from "../../../services/data/trainrunsection.service";
import {LevelOfDetail} from "../../../services/ui/level.of.detail.service";
import {TrainrunSectionService} from "../../../services/data/trainrunsection.service";
import {LinePatternRefs} from "../../../data-structures/business.data.structures";
import {Direction} from "src/app/data-structures/business.data.structures";
import {GeneralViewFunctions} from "../../util/generalViewFunctions";
import {TrainrunsectionHelper} from "src/app/services/util/trainrunsection.helper";

export class TrainrunSectionsView {
  trainrunSectionGroup;

  constructor(
    private editorView: EditorView,
    private trainrunSectionService: TrainrunSectionService,
  ) {}

  static translateAndRotateText(
    viewObject: TrainrunSectionViewObject,
    trainrunSectionText: TrainrunSectionText,
  ) {
    const {x, y} = viewObject.textPositions[trainrunSectionText];
    const pathVec2D = viewObject.path;

    // Check if path has enough points
    if (pathVec2D.length < 4) {
      return "translate(" + x + "," + y + ") rotate(0, 0,0) ";
    }

    const s1: Vec2D = pathVec2D[1];
    const t1: Vec2D = pathVec2D[2];
    const diff: Vec2D = Vec2D.sub(t1, s1);
    let a: number = (Math.atan2(diff.getY(), diff.getX()) / Math.PI) * 180.0;
    if (Math.abs(a) > ANGLE_UPSIDE_DOWN_THRESHOLD) {
      a = a + 180;
    }
    // Math.atan2 -> edge cases -> correct manually
    if (Math.abs(diff.getX()) < EDGE_CASE_THRESHOLD) {
      a = DEFAULT_ANGLE_VERTICAL;
    }
    if (Math.abs(diff.getY()) < EDGE_CASE_THRESHOLD) {
      a = DEFAULT_ANGLE_HORIZONTAL;
    }
    return "translate(" + x + "," + y + ") rotate(" + a + ", 0,0) ";
  }

  static isMuted(
    trainrunSection: TrainrunSection,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
  ): boolean {
    if (
      connectedTrainIds !== undefined &&
      connectedTrainIds.indexOf(trainrunSection.getTrainrunId()) !== -1
    ) {
      return false;
    }
    if (selectedTrainrun !== null) {
      if (trainrunSection.getTrainrunId() !== selectedTrainrun.getId()) {
        return true;
      }
    }
    return false;
  }

  static createTrainrunSectionFrequencyClassAttribute(
    trainrunSection: TrainrunSection,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
  ): string {
    let classAttribute =
      StaticDomTags.makeClassTag(
        StaticDomTags.FREQ_LINE_PATTERN,
        trainrunSection.getFrequencyLinePatternRef(),
      ) +
      StaticDomTags.makeClassTag(
        StaticDomTags.TAG_COLOR_REF,
        trainrunSection.getTrainrun().getCategoryColorRef(),
      ) +
      StaticDomTags.makeClassTag(
        StaticDomTags.TAG_LINEPATTERN_REF,
        trainrunSection.getTrainrun().getTimeCategoryLinePatternRef(),
      );

    if (
      TrainrunSectionsView.isMuted(trainrunSection, selectedTrainrun, connectedTrainIds) === true
    ) {
      classAttribute = classAttribute + " " + StaticDomTags.TAG_MUTED;
    }
    return classAttribute;
  }

  static createSemicircle(viewObject: TrainrunSectionViewObject, position: Vec2D): string {
    const path = viewObject.path;
    let delta: Vec2D = Vec2D.sub(path[1], path[0]);
    if (Vec2D.equal(path[3], position)) {
      delta = Vec2D.sub(path[2], path[3]);
    }
    let rotate = 0;
    if (delta.getX() !== 0.0) {
      if (delta.getX() < 0.0) {
        rotate = -Math.PI / 2;
      } else {
        rotate = Math.PI / 2;
      }
    } else {
      if (delta.getY() < 0.0) {
        rotate = 0;
      } else {
        rotate = Math.PI;
      }
    }
    const arcGenerator = d3
      .arc()
      .outerRadius(DEFAULT_STOP_ICON)
      .innerRadius(0)
      .startAngle(-Math.PI / 2 + rotate)
      .endAngle(Math.PI / 2 + rotate);
    return arcGenerator();
  }

  static getPosition(viewObject: TrainrunSectionViewObject, atSource: boolean): Vec2D {
    return atSource ? viewObject.getPositionAtSourceNode() : viewObject.getPositionAtTargetNode();
  }

  static getNode(trainrunSection: TrainrunSection, atSource: boolean): Node {
    return atSource ? trainrunSection.getSourceNode() : trainrunSection.getTargetNode();
  }

  static getNodeFromViewObject(viewObject: TrainrunSectionViewObject, atSource: boolean): Node {
    const trainrunSection = viewObject.trainrunSections.at(atSource ? 0 : -1)!;
    return TrainrunSectionsView.getNode(trainrunSection, atSource);
  }

  static hasWarning(trainrunSection: TrainrunSection, textElement: TrainrunSectionText): boolean {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
        return trainrunSection.hasSourceDepartureWarning();
      case TrainrunSectionText.SourceArrival:
        return trainrunSection.hasSourceArrivalWarning();
      case TrainrunSectionText.TargetDeparture:
        return trainrunSection.hasTargetDepartureWarning();
      case TrainrunSectionText.TargetArrival:
        return trainrunSection.hasTargetArrivalWarning();
      case TrainrunSectionText.TrainrunSectionTravelTime:
        return trainrunSection.hasTravelTimeWarning();
      case TrainrunSectionText.TrainrunSectionName:
      default:
        return false;
    }
  }

  static getWarning(trainrunSection: TrainrunSection, textElement: TrainrunSectionText): string {
    if (!TrainrunSectionsView.hasWarning(trainrunSection, textElement)) {
      return "";
    }
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
        return (
          trainrunSection.getSourceDepartureWarning().title +
          ": " +
          trainrunSection.getSourceDepartureWarning().description
        );
      case TrainrunSectionText.SourceArrival:
        return (
          trainrunSection.getSourceArrivalWarning().title +
          ": " +
          trainrunSection.getSourceArrivalWarning().description
        );
      case TrainrunSectionText.TargetDeparture:
        return (
          trainrunSection.getTargetDepartureWarning().title +
          ": " +
          trainrunSection.getTargetDepartureWarning().description
        );
      case TrainrunSectionText.TargetArrival:
        return (
          trainrunSection.getTargetArrivalWarning().title +
          ": " +
          trainrunSection.getTargetArrivalWarning().description
        );
      case TrainrunSectionText.TrainrunSectionTravelTime:
        return (
          trainrunSection.getTravelTimeWarning().title +
          ": " +
          trainrunSection.getTravelTimeWarning().description
        );
      case TrainrunSectionText.TrainrunSectionName:
      default:
        return "";
    }
    return "";
  }

  static getTime(trainrunSection: TrainrunSection, textElement: TrainrunSectionText): number {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
        return trainrunSection.getSourceDeparture();
      case TrainrunSectionText.SourceArrival:
        return trainrunSection.getSourceArrival();
      case TrainrunSectionText.TargetDeparture:
        return trainrunSection.getTargetDeparture();
      case TrainrunSectionText.TargetArrival:
        return trainrunSection.getTargetArrival();
      case TrainrunSectionText.TrainrunSectionTravelTime:
        return trainrunSection.getTravelTime();
      default:
        return 0;
    }
  }

  static getFormattedDisplayText(
    trainrunSection: TrainrunSection,
    textElement: TrainrunSectionText,
  ): string {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
        return trainrunSection.getSourceDepartureFormattedDisplayText();
      case TrainrunSectionText.SourceArrival:
        return trainrunSection.getSourceArrivalFormattedDisplayText();
      case TrainrunSectionText.TargetDeparture:
        return trainrunSection.getTargetDepartureFormattedDisplayText();
      case TrainrunSectionText.TargetArrival:
        return trainrunSection.getTargetArrivalFormattedDisplayText();
      case TrainrunSectionText.TrainrunSectionTravelTime:
        return trainrunSection.getTravelTimeFormattedDisplayText();
      default:
        return undefined;
    }
  }

  static getFormattedDisplayTextWidth(
    trainrunSection: TrainrunSection,
    textElement: TrainrunSectionText,
  ): number {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
        return trainrunSection.getSourceDepartureFormattedDisplayTextWidth();
      case TrainrunSectionText.SourceArrival:
        return trainrunSection.getSourceArrivalFormattedDisplayTextWidth();
      case TrainrunSectionText.TargetDeparture:
        return trainrunSection.getTargetDepartureFormattedDisplayTextWidth();
      case TrainrunSectionText.TargetArrival:
        return trainrunSection.getTargetArrivalFormattedDisplayTextWidth();
      case TrainrunSectionText.TrainrunSectionTravelTime:
        return trainrunSection.getTravelTimeFormattedDisplayTextWidth();
      default:
        return undefined;
    }
  }

  static enforceStartTextAnchor(viewObject: TrainrunSectionViewObject, atSource: boolean): boolean {
    const path = viewObject.path;
    if (atSource) {
      if (Math.floor(path[1].getX() - path[0].getX()) > 0) {
        return true;
      }
      if (Math.floor(path[1].getY() - path[0].getY()) < 0) {
        return true;
      }
      return false;
    }
    if (Math.floor(path[2].getX() - path[3].getX()) > 0) {
      return true;
    }
    if (Math.floor(path[2].getY() - path[3].getY()) < 0) {
      return true;
    }
    return false;
  }

  static getAdditionTextCloseToNodePositioningValue(
    viewObject: TrainrunSectionViewObject,
    atSource: boolean,
  ): string {
    const path = viewObject.path;
    let pos: Vec2D;
    if (atSource) {
      pos = Vec2D.add(path[1], Vec2D.scale(Vec2D.normalize(Vec2D.sub(path[1], path[0])), 16));
    } else {
      pos = Vec2D.add(path[2], Vec2D.scale(Vec2D.normalize(Vec2D.sub(path[2], path[3])), 16));
    }

    const retPos = "translate(" + pos.getX() + "," + pos.getY() + ") ";
    if (atSource) {
      if (Math.abs(path[0].getX() - path[1].getX()) > EDGE_CASE_THRESHOLD) {
        return retPos + `rotate(${DEFAULT_ANGLE_HORIZONTAL})`;
      }
      return retPos + `rotate(${DEFAULT_ANGLE_VERTICAL})`;
    }
    if (Math.abs(path[3].getX() - path[2].getX()) > EDGE_CASE_THRESHOLD) {
      return retPos + `rotate(${DEFAULT_ANGLE_HORIZONTAL})`;
    }
    return retPos + `rotate(${DEFAULT_ANGLE_VERTICAL})`;
  }

  static getPositionX(
    viewObject: TrainrunSectionViewObject,
    textElement: TrainrunSectionText,
  ): number {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
      case TrainrunSectionText.SourceArrival:
      case TrainrunSectionText.TargetDeparture:
      case TrainrunSectionText.TargetArrival:
        return viewObject.getTextPositionX(textElement);
      case TrainrunSectionText.TrainrunSectionTravelTime:
        return RASTERING_BASIC_GRID_SIZE / 4;
      case TrainrunSectionText.TrainrunSectionName:
        return -RASTERING_BASIC_GRID_SIZE / 4;
      default:
        return 0;
    }
  }

  static getPositionY(
    viewObject: TrainrunSectionViewObject,
    textElement: TrainrunSectionText,
  ): number {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
      case TrainrunSectionText.SourceArrival:
      case TrainrunSectionText.TargetDeparture:
      case TrainrunSectionText.TargetArrival:
        return viewObject.getTextPositionY(textElement);
      case TrainrunSectionText.TrainrunSectionTravelTime:
      case TrainrunSectionText.TrainrunSectionName:
        return 0.0;
      default:
        return 0;
    }
  }

  static getAdditionPositioningAttr(textElement: TrainrunSectionText): string {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
      case TrainrunSectionText.SourceArrival:
      case TrainrunSectionText.TargetDeparture:
      case TrainrunSectionText.TargetArrival:
        return "dy";
      case TrainrunSectionText.TrainrunSectionTravelTime:
      case TrainrunSectionText.TrainrunSectionName:
        return "transform";
      default:
        return "";
    }
  }

  static getAdditionPositioningValue(
    viewObject: TrainrunSectionViewObject,
    textElement: TrainrunSectionText,
  ) {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
      case TrainrunSectionText.SourceArrival:
      case TrainrunSectionText.TargetDeparture:
      case TrainrunSectionText.TargetArrival:
        return 1.5;
      case TrainrunSectionText.TrainrunSectionTravelTime:
      case TrainrunSectionText.TrainrunSectionName:
        return TrainrunSectionsView.translateAndRotateText(viewObject, textElement);
      default:
        return 0;
    }
  }

  static getTrainrunSectionTimeElementOddOffsetTag(time, trainrun): string {
    if (trainrun.getFrequency() > 60) {
      if (Math.floor(time / 60) % 2 === 1) {
        return " " + StaticDomTags.EDGE_LINE_TEXT_ODD_FREQUENCY;
      }
    }
    return "";
  }

  static getTrainrunSectionTimeElementClass(
    trainrunSection: TrainrunSection,
    textElement: TrainrunSectionText,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
  ): string | undefined {
    const colorRef = TrainrunSectionsView.mapFormatterColorRefToColorRefClassTag(
      TrainrunSectionsView.getFormattedDisplayTextColorRef(trainrunSection, textElement),
    );

    const timeTag =
      StaticDomTags.EDGE_LINE_TEXT_CLASS +
      " " +
      TrainrunSectionText[textElement] +
      " " +
      (colorRef === undefined
        ? StaticDomTags.makeClassTag(
            StaticDomTags.TAG_COLOR_REF,
            trainrunSection.getTrainrun().getCategoryColorRef(),
          )
        : colorRef);
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
        return (
          timeTag +
          TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
            trainrunSection.getSourceDepartureConsecutiveTime(),
            trainrunSection.getTrainrun(),
          )
        );
      case TrainrunSectionText.SourceArrival:
        return (
          timeTag +
          TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
            trainrunSection.getSourceArrivalConsecutiveTime(),
            trainrunSection.getTrainrun(),
          )
        );
      case TrainrunSectionText.TargetDeparture:
        return (
          timeTag +
          TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
            trainrunSection.getTargetDepartureConsecutiveTime(),
            trainrunSection.getTrainrun(),
          )
        );
      case TrainrunSectionText.TargetArrival:
        return (
          timeTag +
          TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
            trainrunSection.getTargetArrivalConsecutiveTime(),
            trainrunSection.getTrainrun(),
          )
        );
      case TrainrunSectionText.TrainrunSectionTravelTime:
        return timeTag;
      case TrainrunSectionText.TrainrunSectionName:
        return (
          StaticDomTags.EDGE_LINE_TEXT_CLASS +
          TrainrunSectionsView.createTrainrunSectionFrequencyClassAttribute(
            trainrunSection,
            selectedTrainrun,
            connectedTrainIds,
          ) +
          " " +
          TrainrunSectionText[TrainrunSectionText.TrainrunSectionName] +
          StaticDomTags.makeClassTag(
            StaticDomTags.TAG_COLOR_REF,
            trainrunSection.getTrainrun().getCategoryColorRef(),
          )
        );
    }
    return undefined;
  }

  static formatTime(value: number, precision: number): number {
    return MathUtils.round(value, precision);
  }

  static isBothSideNonStop(trainrunSection: TrainrunSection): boolean {
    return (
      TrainrunSectionsView.getNode(trainrunSection, true).isNonStop(trainrunSection) &&
      TrainrunSectionsView.getNode(trainrunSection, false).isNonStop(trainrunSection)
    );
  }

  static extractTrainrunName(trainrunSection: TrainrunSection): string {
    return (
      trainrunSection.getTrainrun().getCategoryShortName() +
      trainrunSection.getTrainrun().getTitle()
    );
  }

  static extractTravelTime(trainrunSection: TrainrunSection, editorView: EditorView): string {
    const cumTravelTimeData = editorView.getCumulativeTravelTimeAndNodePath(trainrunSection);
    const cumulativeTravelTime = cumTravelTimeData[cumTravelTimeData.length - 1].sumTravelTime;
    if (
      trainrunSection.getTrainrun().selected() === true ||
      editorView.isFilterShowNonStopTimeEnabled() ||
      editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()
    ) {
      if (cumulativeTravelTime === trainrunSection.getTravelTime()) {
        // default case
        return (
          TrainrunSectionsView.formatTime(
            trainrunSection.getTravelTime(),
            editorView.getTimeDisplayPrecision(),
          ) + "'"
        );
      } else {
        // special case - with non stops
        if (!editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
          // might is filtering active
          const srcNonStopNode = editorView.checkFilterNonStopNode(trainrunSection.getSourceNode());
          const trgNonStopNode = editorView.checkFilterNonStopNode(trainrunSection.getTargetNode());
          const srcJunction = editorView.isJunctionNode(trainrunSection.getSourceNode());
          const trgJunction = editorView.isJunctionNode(trainrunSection.getTargetNode());
          const srcNode = TrainrunSectionsView.getNode(trainrunSection, true);
          const trgNode = TrainrunSectionsView.getNode(trainrunSection, false);

          if (TrainrunSectionsView.isBothSideNonStop(trainrunSection)) {
            // trainrun section has on both side a non stop (transition)
            if (!srcNonStopNode && !srcJunction && !trgNonStopNode && !trgJunction) {
              return "";
            }
            if (!srcNonStopNode && !srcJunction) {
              const info = TrainrunSectionsView.calcVirtualSectionTimeForHiddenJunctions(
                cumTravelTimeData,
                trgNode,
                srcNode,
                editorView,
              );
              if (info.isBreak) {
                if (
                  TrainrunSectionsView.filterVirtualTravelTime(trgNode, info).virtualTravelTime ===
                  undefined
                ) {
                  return "";
                }
                return (
                  "" +
                  TrainrunSectionsView.formatTime(
                    cumulativeTravelTime,
                    editorView.getTimeDisplayPrecision(),
                  ) +
                  "' (" +
                  TrainrunSectionsView.formatTime(info.virtualTravelTime, 1) +
                  "')"
                );
              }
            }
            if (!trgNonStopNode && !trgJunction) {
              const info = TrainrunSectionsView.calcVirtualSectionTimeForHiddenJunctions(
                cumTravelTimeData,
                srcNode,
                trgNode,
                editorView,
              );
              if (info.isBreak) {
                if (
                  TrainrunSectionsView.filterVirtualTravelTime(srcNode, info).virtualTravelTime ===
                  undefined
                ) {
                  return "";
                }
                return (
                  "" +
                  TrainrunSectionsView.formatTime(
                    cumulativeTravelTime,
                    editorView.getTimeDisplayPrecision(),
                  ) +
                  "' (" +
                  TrainrunSectionsView.formatTime(info.virtualTravelTime, 1) +
                  "')"
                );
              }
            }
            if ((!srcNonStopNode && !srcJunction) || (!trgNonStopNode && !trgJunction)) {
              return "";
            }
          } else {
            // trainrun section has on non stop (transition) only on one side
            // is non-stop at source ?
            if (srcNode.isNonStop(trainrunSection)) {
              if (!srcNonStopNode && !srcJunction) {
                const info = TrainrunSectionsView.calcVirtualSectionTimeForHiddenJunctions(
                  cumTravelTimeData,
                  trgNode,
                  srcNode,
                  editorView,
                );
                if (info.virtualTravelTime === undefined) {
                  return "";
                }
                if (cumulativeTravelTime === info.virtualTravelTime) {
                  return (
                    TrainrunSectionsView.formatTime(
                      cumulativeTravelTime,
                      editorView.getTimeDisplayPrecision(),
                    ) + "'"
                  );
                }
                return (
                  TrainrunSectionsView.formatTime(
                    cumulativeTravelTime,
                    editorView.getTimeDisplayPrecision(),
                  ) +
                  "' (" +
                  TrainrunSectionsView.formatTime(info.virtualTravelTime, 1) +
                  "')"
                );
              }
            }
            // is non-stop at target ?
            if (trgNode.isNonStop(trainrunSection)) {
              if (!trgNonStopNode && !trgJunction) {
                const info = TrainrunSectionsView.calcVirtualSectionTimeForHiddenJunctions(
                  cumTravelTimeData,
                  srcNode,
                  trgNode,
                  editorView,
                );
                if (info.virtualTravelTime === undefined) {
                  return "";
                }
                if (cumulativeTravelTime === info.virtualTravelTime) {
                  return (
                    TrainrunSectionsView.formatTime(
                      cumulativeTravelTime,
                      editorView.getTimeDisplayPrecision(),
                    ) + "'"
                  );
                }
                return (
                  TrainrunSectionsView.formatTime(
                    cumulativeTravelTime,
                    editorView.getTimeDisplayPrecision(),
                  ) +
                  "' (" +
                  TrainrunSectionsView.formatTime(info.virtualTravelTime, 1) +
                  "')"
                );
              }
            }
          }
        }

        if (TrainrunSectionsView.isBothSideNonStop(trainrunSection)) {
          return "(" + TrainrunSectionsView.formatTime(trainrunSection.getTravelTime(), 1) + "')";
        }
        // default case for non stops
        return (
          TrainrunSectionsView.formatTime(
            cumulativeTravelTime,
            editorView.getTimeDisplayPrecision(),
          ) +
          "' (" +
          TrainrunSectionsView.formatTime(trainrunSection.getTravelTime(), 1) +
          "')"
        );
      }
    }

    return (
      TrainrunSectionsView.formatTime(cumulativeTravelTime, editorView.getTimeDisplayPrecision()) +
      "'"
    );
  }

  static calcInternalVirtualSectionTimeForHiddenJunctions(
    cumulativeTravelTimeData,
    startNode: Node,
    nextNode: Node,
    editorView: EditorView,
  ) {
    let idx = cumulativeTravelTimeData.findIndex((d) => d.node.getId() === startNode.getId());
    const nextIdx = cumulativeTravelTimeData.findIndex((d) => d.node.getId() === nextNode.getId());
    if (idx > nextIdx) {
      return {
        virtualTravelTime: 0,
        endNode: startNode,
        isBreak: false,
      };
    }
    const time0 = cumulativeTravelTimeData[idx].sumTravelTime;
    let time1 = time0;
    let breakAtNode = startNode;
    while (idx < cumulativeTravelTimeData.length - 1) {
      idx++;
      time1 = cumulativeTravelTimeData[idx].sumTravelTime;
      breakAtNode = cumulativeTravelTimeData[idx].node;
      if (editorView.checkFilterNode(breakAtNode)) {
        if (
          editorView.checkFilterNonStopNode(breakAtNode) ||
          editorView.isJunctionNode(breakAtNode)
        ) {
          break;
        }
      }
    }
    return {
      virtualTravelTime: Math.abs(time1 - time0),
      endNode: breakAtNode,
      isBreak: idx < cumulativeTravelTimeData.length - 1,
    };
  }

  static calcVirtualSectionTimeForHiddenJunctions(
    cumulativeTravelTimeData: [],
    startNode: Node,
    nextNode: Node,
    editorView: EditorView,
  ) {
    let info = TrainrunSectionsView.calcInternalVirtualSectionTimeForHiddenJunctions(
      cumulativeTravelTimeData,
      startNode,
      nextNode,
      editorView,
    );
    let virtualTravelTime: number = info.virtualTravelTime;
    if (virtualTravelTime === 0) {
      info = TrainrunSectionsView.calcInternalVirtualSectionTimeForHiddenJunctions(
        cumulativeTravelTimeData.reverse(),
        startNode,
        nextNode,
        editorView,
      );
      virtualTravelTime = info.virtualTravelTime;
    }
    if (!info.isBreak) {
      return TrainrunSectionsView.filterVirtualTravelTime(startNode, info);
    }
    return info;
  }

  static filterVirtualTravelTime(startNode: Node, info) {
    if (startNode.getPositionX() > info.endNode.getPositionX()) {
      info.virtualTravelTime = undefined;
      return info;
    }
    if (startNode.getPositionX() === info.endNode.getPositionX()) {
      if (startNode.getPositionY() < info.endNode.getPositionY()) {
        info.virtualTravelTime = undefined;
        return info;
      }
    }
    return info;
  }

  static getTrainrunSectionValueToShow(
    viewObject: TrainrunSectionViewObject,
    textElement: TrainrunSectionText,
    editorView: EditorView,
  ) {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
      case TrainrunSectionText.SourceArrival:
      case TrainrunSectionText.TargetDeparture:
      case TrainrunSectionText.TargetArrival: {
        const isTarget =
          textElement === TrainrunSectionText.TargetDeparture ||
          textElement === TrainrunSectionText.TargetArrival;
        const trainrunSection = isTarget ? viewObject.lastSection : viewObject.firstSection;

        return (
          TrainrunSectionsView.getFormattedDisplayText(trainrunSection, textElement) ??
          TrainrunSectionsView.formatTime(
            TrainrunSectionsView.getTime(trainrunSection, textElement),
            editorView.getTimeDisplayPrecision(),
          )
        );
      }
      case TrainrunSectionText.TrainrunSectionTravelTime: {
        const trainrunSection = viewObject.firstSection;
        const formattedData = TrainrunSectionsView.getFormattedDisplayText(
          trainrunSection,
          textElement,
        );
        if (formattedData !== undefined) {
          return formattedData;
        }
        // Special case for multiple sections: calculate total time including stop times at intermediate nodes
        if (viewObject.trainrunSections.length > 1) {
          return (
            TrainrunSectionsView.formatTime(
              viewObject.getTravelTime(),
              editorView.getTimeDisplayPrecision(),
            ) + "'"
          );
        }
        return TrainrunSectionsView.extractTravelTime(trainrunSection, editorView);
      }
      case TrainrunSectionText.TrainrunSectionName:
        return TrainrunSectionsView.extractTrainrunName(viewObject.firstSection);
      default:
        return undefined;
    }
  }

  static getTrainrunSectionValueTextWidth(
    trainrunSection: TrainrunSection,
    textElement: TrainrunSectionText,
  ): number {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
      case TrainrunSectionText.SourceArrival:
      case TrainrunSectionText.TargetDeparture:
      case TrainrunSectionText.TargetArrival:
      case TrainrunSectionText.TrainrunSectionTravelTime: {
        const data = TrainrunSectionsView.getFormattedDisplayTextWidth(
          trainrunSection,
          textElement,
        );
        if (data !== undefined) {
          return data;
        }
        return TRAINRUN_SECTION_TEXT_AREA_WIDTH;
      }
    }
    return TRAINRUN_SECTION_TEXT_AREA_WIDTH;
  }

  static getTrainrunSectionValueHtmlStyle(
    trainrunSection: TrainrunSection,
    textElement: TrainrunSectionText,
  ): string {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
        return trainrunSection.getSourceDepartureFormattedDisplayHtmlStyle();
      case TrainrunSectionText.SourceArrival:
        return trainrunSection.getSourceArrivalFormattedDisplayHtmlStyle();
      case TrainrunSectionText.TargetDeparture:
        return trainrunSection.getTargetDepartureFormattedDisplayHtmlStyle();
      case TrainrunSectionText.TargetArrival:
        return trainrunSection.getTargetArrivalFormattedDisplayHtmlStyle();
      case TrainrunSectionText.TrainrunSectionTravelTime:
        return trainrunSection.getTravelTimeFormattedDisplayHtmlStyle();
      default:
        return undefined;
    }
    return undefined;
  }

  static getTrainrunSectionNextAndDestinationNodeToShow(
    viewObject: TrainrunSectionViewObject,
    editorView: EditorView,
    atSource: boolean,
  ): string {
    const trainrunSection = viewObject.trainrunSections.at(atSource ? 0 : -1);
    let startNode: Node;
    if (atSource) {
      startNode = trainrunSection.getSourceNode();
    } else {
      startNode = trainrunSection.getTargetNode();
    }
    const nodePath = editorView.getNodePathToEnd(startNode, trainrunSection);
    return nodePath.slice(-1)[0].getBetriebspunktName();
  }

  private static mapFormatterColorRefToColorRefClassTag(colorRef: ColorRefType) {
    if (colorRef === undefined) {
      return undefined;
    }
    return StaticDomTags.makeClassTag(StaticDomTags.TAG_COLOR_REF, colorRef);
  }

  private static getFormattedDisplayTextColorRef(
    trainrunSection: TrainrunSection,
    textElement: TrainrunSectionText,
  ): string {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
        return trainrunSection.getSourceDepartureFormatterColorRef();
      case TrainrunSectionText.SourceArrival:
        return trainrunSection.getSourceArrivalFormatterColorRef();
      case TrainrunSectionText.TargetDeparture:
        return trainrunSection.getTargetDepartureFormatterColorRef();
      case TrainrunSectionText.TargetArrival:
        return trainrunSection.getTargetArrivalFormatterColorRef();
      case TrainrunSectionText.TrainrunSectionTravelTime:
        return trainrunSection.getTravelTimeFormatterColorRef();
      default:
        return undefined;
    }
  }

  getHiddenTagForTime(trainrunSection: TrainrunSection, textElement: TrainrunSectionText): boolean {
    if (this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      // disable filtering in view (render all objects)
      return false;
    }
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
      case TrainrunSectionText.SourceArrival:
        if (!this.editorView.isFilterArrivalDepartureTimeEnabled()) {
          return true;
        }
        if (
          !this.editorView.checkFilterNonStopNode(
            TrainrunSectionsView.getNode(trainrunSection, true),
          )
        ) {
          return true;
        }
        if (this.editorView.isFilterShowNonStopTimeEnabled()) {
          return false;
        }
        return TrainrunSectionsView.getNode(trainrunSection, true).isNonStop(trainrunSection);
      case TrainrunSectionText.TargetDeparture:
      case TrainrunSectionText.TargetArrival:
        if (!this.editorView.isFilterArrivalDepartureTimeEnabled()) {
          return true;
        }
        if (
          !this.editorView.checkFilterNonStopNode(
            TrainrunSectionsView.getNode(trainrunSection, false),
          )
        ) {
          return true;
        }
        if (this.editorView.isFilterShowNonStopTimeEnabled()) {
          return false;
        }
        return TrainrunSectionsView.getNode(trainrunSection, false).isNonStop(trainrunSection);
      case TrainrunSectionText.TrainrunSectionTravelTime:
        if (!this.editorView.isFilterTravelTimeEnabled()) {
          return true;
        }
        if (this.editorView.isFilterShowNonStopTimeEnabled()) {
          return false;
        }
        return (
          !trainrunSection.getTrainrun().selected() &&
          TrainrunSectionsView.isBothSideNonStop(trainrunSection)
        );
      case TrainrunSectionText.TrainrunSectionName:
        {
          if (!this.editorView.isFilterTrainrunNameEnabled()) {
            return true;
          }
          const srcNode = TrainrunSectionsView.getNode(trainrunSection, true);
          const trgNode = TrainrunSectionsView.getNode(trainrunSection, false);
          if (
            !this.editorView.checkFilterNonStopNode(srcNode) ||
            !this.editorView.checkFilterNonStopNode(trgNode)
          ) {
            const transSrc = srcNode.getTransition(trainrunSection.getId());
            const transTrg = trgNode.getTransition(trainrunSection.getId());
            if (transSrc !== undefined && transTrg !== undefined) {
              if (transSrc.getIsNonStopTransit() && transTrg.getIsNonStopTransit()) {
                return true;
              }
            }
          }
        }
        return false;
      default:
        return false;
    }
  }

  setGroup(trainrunSectionGroup: d3.Selector) {
    trainrunSectionGroup.attr("class", "TrainrunSectionsView");
    this.trainrunSectionGroup = trainrunSectionGroup
      .append(StaticDomTags.GROUP_SVG)
      .attr("class", "TrainrunSectionsEdgeGroup");
  }

  createTrainrunSectionTextBackgrounds(
    groupEnter: d3.Selector,
    lineTextElement: TrainrunSectionText,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
  ) {
    const atSource =
      lineTextElement === TrainrunSectionText.SourceArrival ||
      lineTextElement === TrainrunSectionText.SourceDeparture;
    const isArrival =
      lineTextElement === TrainrunSectionText.SourceArrival ||
      lineTextElement === TrainrunSectionText.TargetArrival;

    const isOneWayText =
      lineTextElement === TrainrunSectionText.SourceDeparture ||
      lineTextElement === TrainrunSectionText.TargetArrival;

    groupEnter
      .filter((d: TrainrunSectionViewObject) => {
        const displayTextBackground = d.getTrainrun().isRoundTrip() || isOneWayText;
        return (
          this.filterTrainrunsectionAtNode(d, atSource) &&
          this.filterTimeTrainrunsectionNonStop(d, atSource, isArrival) &&
          displayTextBackground
        );
      })
      .append(StaticDomTags.EDGE_LINE_TEXT_BACKGROUND_SVG)
      .attr(
        "class",
        (d: TrainrunSectionViewObject) =>
          StaticDomTags.EDGE_LINE_TEXT_BACKGROUND_CLASS +
          TrainrunSectionsView.createTrainrunSectionFrequencyClassAttribute(
            d.firstSection,
            selectedTrainrun,
            connectedTrainIds,
          ),
      )
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.firstSection.getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().getId(),
      )
      .attr(StaticDomTags.EDGE_LINE_TEXT_INDEX, lineTextElement)
      .attr("x", (d: TrainrunSectionViewObject) => {
        const trainrunSection = d.trainrunSections.at(atSource ? 0 : -1)!;
        return (
          d.getTextPositionX(lineTextElement) -
          TrainrunSectionsView.getTrainrunSectionValueTextWidth(trainrunSection, lineTextElement) /
            2
        );
      })
      .attr("y", (d: TrainrunSectionViewObject) => {
        return d.getTextPositionY(lineTextElement) - TRAINRUN_SECTION_TEXT_AREA_HEIGHT / 2;
      })
      .attr("width", (d: TrainrunSectionViewObject) => {
        const trainrunSection = d.trainrunSections.at(atSource ? 0 : -1)!;
        return TrainrunSectionsView.getTrainrunSectionValueTextWidth(
          trainrunSection,
          lineTextElement,
        );
      })
      .attr("height", TRAINRUN_SECTION_TEXT_AREA_HEIGHT)
      .classed(TrainrunSectionText[lineTextElement], true)
      .classed(StaticDomTags.TAG_HIDDEN, (d: TrainrunSectionViewObject) => {
        const trainrunSection = d.trainrunSections.at(atSource ? 0 : -1)!;
        return this.getHiddenTagForTime(trainrunSection, lineTextElement);
      });
  }

  translateAndRotateArrow(
    viewObject: TrainrunSectionViewObject,
    arrowType: "BEGINNING_ARROW" | "ENDING_ARROW",
  ) {
    const positions = viewObject.path;
    const isTargetRightOrBottom = TrainrunsectionHelper.isTargetRightOrBottom(
      viewObject.firstSection,
    );

    // Use the first segment of the section to determine the direction
    const xDiff = positions[1].getX() - positions[0].getX();
    const yDiff = positions[1].getY() - positions[0].getY();

    // Compute angle
    let angle: number;
    if (xDiff === 0) {
      angle =
        yDiff > 0 && isTargetRightOrBottom ? ANGLE_UPSIDE_DOWN_THRESHOLD : DEFAULT_ANGLE_VERTICAL;
    } else {
      angle = xDiff > 0 && isTargetRightOrBottom ? DEFAULT_ANGLE_HORIZONTAL : 180;
    }

    // Set arrow offset values : positions[1] and positions[2] are
    // the 2 intermediate points where the sections change direction
    const arrowOffset = isTargetRightOrBottom ? [-44, 20] : [44, -20];
    let x, y: number;
    if (arrowType === "BEGINNING_ARROW") {
      x = positions[1].getX() + (xDiff === 0 ? 0 : arrowOffset[0]);
      y = positions[1].getY() + (xDiff === 0 ? arrowOffset[0] : 0);
    } else {
      x = positions[2].getX() + (xDiff === 0 ? 0 : arrowOffset[1]);
      y = positions[2].getY() + (xDiff === 0 ? arrowOffset[1] : 0);
    }

    return `translate(${x},${y}) rotate(${angle})`;
  }

  /**
   * Creates direction arrow SVG elements for train run sections within the provided D3 selection.
   * Appends arrows for both the beginning and ending of each train run section, applying appropriate
   * attributes, classes, and event handlers based on the train run's state and configuration.
   *
   * @param groupLinesEnter - The D3 selection to which the arrow SVG elements will be appended.
   * @param selectedTrainrun - The currently selected train run, used for styling and event logic.
   * @param connectedTrainIds - An object or collection representing train runs connected to the current section.
   * @param enableEvents - Optional flag to enable or disable mouse event handlers on the arrows. Defaults to true.
   */
  createDirectionArrows(
    groupLinesEnter: d3.Selection,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
    enableEvents = true,
  ) {
    (["BEGINNING_ARROW", "ENDING_ARROW"] as const).forEach((arrowType) => {
      groupLinesEnter
        .append(StaticDomTags.EDGE_LINE_ARROW_SVG)
        .attr("d", (d: TrainrunSectionViewObject) => {
          return d.getTrainrun().isRoundTrip() ? "" : "M-4,-5L2,0L-4,5Z";
        })
        .attr("transform", (d: TrainrunSectionViewObject) => {
          return this.translateAndRotateArrow(d, arrowType);
        })
        .attr(
          "class",
          (d: TrainrunSectionViewObject) =>
            StaticDomTags.EDGE_LINE_ARROW_CLASS +
            TrainrunSectionsView.createTrainrunSectionFrequencyClassAttribute(
              d.firstSection,
              selectedTrainrun,
              connectedTrainIds,
            ),
        )
        .classed(StaticDomTags.TAG_HIDDEN, (d: TrainrunSectionViewObject) => {
          const trainrunSection = d.trainrunSections.at(arrowType === "BEGINNING_ARROW" ? 0 : -1)!;
          return (
            !this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() &&
            (!this.editorView.isFilterDirectionArrowsEnabled() ||
              !this.filterTrainrunsectionAtNode(d, arrowType === "BEGINNING_ARROW"))
          );
        })
        .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.firstSection.getId())
        .attr(StaticDomTags.EDGE_LINE_LINE_ID, (d: TrainrunSectionViewObject) =>
          d.getTrainrun().getId(),
        )
        .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
          d.getTrainrun().selected(),
        )
        .classed(StaticDomTags.TAG_LINE_ARROW_EDITOR, true)
        .classed(StaticDomTags.TAG_MUTED, (d: TrainrunSectionViewObject) =>
          TrainrunSectionsView.isMuted(d.firstSection, selectedTrainrun, connectedTrainIds),
        )
        .classed(StaticDomTags.TAG_EVENT_DISABLED, !enableEvents)
        .on("mouseup", (d: TrainrunSectionViewObject, i, a) => {
          this.onTrainrunDirectionArrowMouseUp(d.firstSection, a[i]);
        })
        .on("mouseover", (d: TrainrunSectionViewObject, i, a) => {
          this.onTrainrunSectionMouseoverPath(d.firstSection, a[i]);
        })
        .on("mouseout", (d: TrainrunSectionViewObject, i, a) => {
          this.onTrainrunSectionMouseoutPath(d.firstSection, a[i]);
        });
    });
  }

  createTrainrunSection(
    groupEnter: d3.Selector,
    classRef,
    levelFreqFilter: LinePatternRefs[],
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
    enableEvents = true,
  ) {
    const trainrunSectionElements = groupEnter
      .filter((d: TrainrunSectionViewObject) => {
        return !levelFreqFilter.includes(d.firstSection.getFrequencyLinePatternRef());
      })
      .append(StaticDomTags.EDGE_LINE_SVG)
      .attr(
        "class",
        (d: TrainrunSectionViewObject) =>
          StaticDomTags.EDGE_LINE_CLASS +
          TrainrunSectionsView.createTrainrunSectionFrequencyClassAttribute(
            d.firstSection,
            selectedTrainrun,
            connectedTrainIds,
          ),
      )
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.firstSection.getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().getId(),
      )
      .attr("d", (d: TrainrunSectionViewObject) =>
        D3Utils.getPathAsSVGString(this.transformPath(d)),
      )
      .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().selected(),
      )
      .classed(StaticDomTags.TAG_EVENT_DISABLED, !enableEvents)
      .classed(classRef, true);

    if (!this.editorView.isElementDragging()) {
      trainrunSectionElements
        .on("mouseup", (d: TrainrunSectionViewObject, i, a) => {
          if (enableEvents) {
            this.onTrainrunSectionMouseUp(d.firstSection, a[i]);
          }
        })
        .on("mouseover", (d: TrainrunSectionViewObject, i, a) => {
          if (enableEvents) {
            this.onTrainrunSectionMouseoverPath(d.firstSection, a[i]);
          }
        })
        .on("mouseout", (d: TrainrunSectionViewObject, i, a) => {
          if (enableEvents) {
            this.onTrainrunSectionMouseoutPath(d.firstSection, a[i]);
          }
        });
    }
  }

  createTrainrunsectionSemicircleAtNode(
    groupEnter: d3.Selector,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
    atSource: boolean,
  ) {
    groupEnter
      .filter((d: TrainrunSectionViewObject) => this.filterTrainrunsectionAtNode(d, atSource))
      .filter((d: TrainrunSectionViewObject) => {
        const trainrunSection = d.trainrunSections.at(atSource ? 0 : -1)!;
        const trans = TrainrunSectionsView.getNode(trainrunSection, atSource).getTransition(
          trainrunSection.getId(),
        );
        if (trans === undefined) {
          return true;
        }
        return !trans.getIsNonStopTransit();
      })
      .append(StaticDomTags.EDGE_LINE_STOP_ICON_SVG)
      .attr(
        "class",
        (d: TrainrunSectionViewObject) =>
          StaticDomTags.EDGE_LINE_STOP_ICON_CLASS +
          " " +
          StaticDomTags.TAG_FILL +
          TrainrunSectionsView.createTrainrunSectionFrequencyClassAttribute(
            d.firstSection,
            selectedTrainrun,
            connectedTrainIds,
          ),
      )
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.firstSection.getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().getId(),
      )
      .attr("d", (d: TrainrunSectionViewObject) => {
        return TrainrunSectionsView.createSemicircle(
          d,
          TrainrunSectionsView.getPosition(d, atSource),
        );
      })
      .attr(
        "transform",
        (d: TrainrunSectionViewObject) =>
          "translate(" +
          TrainrunSectionsView.getPosition(d, atSource).getX() +
          "," +
          TrainrunSectionsView.getPosition(d, atSource).getY() +
          ")",
      )
      .attr(StaticDomTags.EDGE_NODE_ID, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getNodeFromViewObject(d, atSource).getId(),
      )
      .classed(StaticDomTags.EDGE_IS_TARGET, !atSource)
      .classed(StaticDomTags.TAG_HIDDEN, (d: TrainrunSectionViewObject) => {
        const trainrunSection = d.trainrunSections.at(atSource ? 0 : -1)!;
        return TrainrunSectionsView.getNode(trainrunSection, atSource).isNonStop(trainrunSection);
      })
      .classed(StaticDomTags.TAG_MUTED, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.isMuted(d.firstSection, selectedTrainrun, connectedTrainIds),
      )
      .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().selected(),
      );
  }

  createTrainrunsectionSemicircles(
    groupEnter: d3.Selector,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
  ) {
    if (this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return;
    }
    if (this.editorView.isFilterArrivalDepartureTimeEnabled()) {
      return;
    }
    this.createTrainrunsectionSemicircleAtNode(
      groupEnter,
      selectedTrainrun,
      connectedTrainIds,
      false,
    );
    this.createTrainrunsectionSemicircleAtNode(
      groupEnter,
      selectedTrainrun,
      connectedTrainIds,
      true,
    );
  }

  createPinOnTrainrunsection(
    groupEnter: d3.Selector,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
    atSource: boolean,
  ) {
    if (!this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      return;
    }

    groupEnter
      .append(StaticDomTags.EDGE_LINE_PIN_SVG)
      .attr("class", StaticDomTags.EDGE_LINE_PIN_CLASS)
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.firstSection.getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().getId(),
      )
      .attr("cx", (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getPosition(d, atSource).getX(),
      )
      .attr("cy", (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getPosition(d, atSource).getY(),
      )
      .attr("r", DEFAULT_PIN_RADIUS)
      .attr(StaticDomTags.EDGE_NODE_ID, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getNodeFromViewObject(d, atSource).getId(),
      )
      .classed(
        StaticDomTags.TAG_HIDDEN,
        (d: TrainrunSectionViewObject) =>
          !this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() &&
          !this.editorView.checkFilterNonStopNode(
            TrainrunSectionsView.getNodeFromViewObject(d, atSource),
          ),
      )
      .classed(
        StaticDomTags.TAG_EVENT_DISABLED,
        (d: TrainrunSectionViewObject) =>
          !this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() &&
          !this.editorView.checkFilterNonStopNode(
            TrainrunSectionsView.getNodeFromViewObject(d, atSource),
          ),
      )
      .classed(atSource ? StaticDomTags.EDGE_IS_SOURCE : StaticDomTags.EDGE_IS_TARGET, true)
      .classed(StaticDomTags.EDGE_IS_END_NODE, (d: TrainrunSectionViewObject) => {
        let trainrunSection = d.lastSection;
        let node = trainrunSection.getTargetNode();
        if (atSource) {
          trainrunSection = d.firstSection;
          node = trainrunSection.getSourceNode();
        }
        const port = node.getPortOfTrainrunSection(trainrunSection.getId());
        const trans = node.getTransitionFromPortId(port.getId());
        return trans === undefined;
      })
      .classed(StaticDomTags.EDGE_IS_NOT_END_NODE, (d: TrainrunSectionViewObject) => {
        let trainrunSection = d.lastSection;
        let node = trainrunSection.getTargetNode();
        if (atSource) {
          trainrunSection = d.firstSection;
          node = trainrunSection.getSourceNode();
        }
        const port = node.getPortOfTrainrunSection(trainrunSection.getId());
        const trans = node.getTransitionFromPortId(port.getId());
        return trans !== undefined;
      })

      .classed(StaticDomTags.TAG_MUTED, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.isMuted(d.firstSection, selectedTrainrun, connectedTrainIds),
      )
      .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().selected(),
      )
      .on("mouseover", (d: TrainrunSectionViewObject, i, a) =>
        this.onTrainrunSectionMouseoverPin(
          TrainrunSectionsView.getNode(d.firstSection, atSource),
          a[i],
        ),
      )
      .on("mouseout", (d: TrainrunSectionViewObject, i, a) =>
        this.onTrainrunSectionMouseoutPin(d.firstSection, a[i], atSource),
      )
      .on("mousedown", () => this.onTrainrunSectionMousedownPin())
      .on("mousemove", () => this.onTrainrunSectionMousemovePin())
      .on("mouseup", (d: TrainrunSectionViewObject) =>
        this.onTrainrunSectionMouseupPin(d.firstSection, atSource),
      );
  }

  private createInternTrainrunSectionElementFilteringWarningElements(
    groupEnter: d3.Selector,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
    textElement: TrainrunSectionText,
    enableEvents = true,
    hasWarning = true,
  ) {
    const isDefaultText =
      textElement === TrainrunSectionText.TrainrunSectionName ||
      textElement === TrainrunSectionText.TrainrunSectionTravelTime;
    const atSource =
      textElement === TrainrunSectionText.SourceArrival ||
      textElement === TrainrunSectionText.SourceDeparture;
    const atTarget =
      textElement === TrainrunSectionText.TargetArrival ||
      textElement === TrainrunSectionText.TargetDeparture;
    const isArrival =
      textElement === TrainrunSectionText.SourceArrival ||
      textElement === TrainrunSectionText.TargetArrival;

    const isOneWayText =
      textElement === TrainrunSectionText.SourceDeparture ||
      textElement === TrainrunSectionText.TargetArrival;

    const renderingObjects = groupEnter
      .filter((d: TrainrunSectionViewObject) => {
        const trainrunSection = d.trainrunSections.at(atTarget ? -1 : 0)!;
        const displayTextElement = d.getTrainrun().isRoundTrip() || isDefaultText || isOneWayText;

        return (
          this.filterTrainrunsectionAtNode(d, atSource) &&
          this.filterTimeTrainrunsectionNonStop(d, atSource, isArrival) &&
          TrainrunSectionsView.hasWarning(trainrunSection, textElement) === hasWarning &&
          displayTextElement
        );
      })
      .append(StaticDomTags.EDGE_LINE_TEXT_SVG)
      .attr("class", (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getTrainrunSectionTimeElementClass(
          d.firstSection,
          textElement,
          selectedTrainrun,
          connectedTrainIds,
        ),
      )
      .attr("data-testid", StaticDomTags.EDGE_LINE_TEXT_CLASS)
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.firstSection.getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().getId(),
      )
      .attr(StaticDomTags.EDGE_LINE_TEXT_INDEX, textElement)
      .attr("x", (d: TrainrunSectionViewObject) => {
        return TrainrunSectionsView.getPositionX(d, textElement);
      })
      .attr("y", (d: TrainrunSectionViewObject) => {
        return TrainrunSectionsView.getPositionY(d, textElement);
      })
      .attr(
        TrainrunSectionsView.getAdditionPositioningAttr(textElement),
        (d: TrainrunSectionViewObject) =>
          TrainrunSectionsView.getAdditionPositioningValue(d, textElement),
      )
      .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().selected(),
      )
      .classed(StaticDomTags.TAG_MUTED, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.isMuted(d.firstSection, selectedTrainrun, connectedTrainIds),
      )
      .classed(StaticDomTags.TAG_WARNING, (d: TrainrunSectionViewObject) => {
        const trainrunSection = d.trainrunSections.at(atTarget ? -1 : 0)!;
        return TrainrunSectionsView.hasWarning(trainrunSection, textElement);
      })
      .classed(StaticDomTags.TAG_HIDDEN, (d: TrainrunSectionViewObject) =>
        this.getHiddenTagForTime(d.firstSection, textElement),
      )
      .classed(StaticDomTags.TAG_EVENT_DISABLED, !enableEvents)
      .text((d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getTrainrunSectionValueToShow(d, textElement, this.editorView),
      )
      .attr("style", (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getTrainrunSectionValueHtmlStyle(d.firstSection, textElement),
      )
      .on("mouseover", (d: TrainrunSectionViewObject, i, a) => {
        if (enableEvents) {
          this.onTrainrunSectionTextMouseover(d.firstSection, a[i]);
        }
      })
      .on("mouseout", (d: TrainrunSectionViewObject, i, a) => {
        if (enableEvents) {
          this.onTrainrunSectionTextMouseout(d.firstSection, a[i]);
        }
      })
      .on("mouseup", (d: TrainrunSectionViewObject, i, a) => {
        if (enableEvents) {
          this.onTrainrunSectionElementClicked(d.firstSection, a[i], textElement);
        }
      });

    if (hasWarning) {
      renderingObjects.append("svg:title").text((d: TrainrunSectionViewObject) => {
        const trainrunSection = d.trainrunSections.at(atTarget ? -1 : 0)!;
        return TrainrunSectionsView.getWarning(trainrunSection, textElement);
      });
    }
  }

  createTrainrunSectionElement(
    groupEnter: d3.Selector,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
    textElement: TrainrunSectionText,
    enableEvents = true,
  ) {
    // pass(1) : render all elements without warnings
    this.createInternTrainrunSectionElementFilteringWarningElements(
      groupEnter,
      selectedTrainrun,
      connectedTrainIds,
      textElement,
      enableEvents,
      false,
    );
    // pass(2) : render all elements with warnings
    //           especially <svg:title>warning_msg</svg:title>
    this.createInternTrainrunSectionElementFilteringWarningElements(
      groupEnter,
      selectedTrainrun,
      connectedTrainIds,
      textElement,
      enableEvents,
      true,
    );
  }

  createTrainrunSectionGotoInfoElement(
    groupEnter: d3.Selector,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
    atSource: boolean,
  ) {
    const textElement = TrainrunSectionText.TrainrunSectionName;
    groupEnter
      .filter((d: TrainrunSectionViewObject) => this.filterTrainrunsectionAtNode(d, atSource))
      .append(StaticDomTags.EDGE_LINE_TEXT_SVG)
      .attr("class", (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getTrainrunSectionTimeElementClass(
          d.firstSection,
          textElement,
          selectedTrainrun,
          connectedTrainIds,
        ),
      )
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.firstSection.getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().getId(),
      )
      .attr(StaticDomTags.EDGE_LINE_TEXT_INDEX, textElement)
      .attr("x", 0)
      .attr("y", 0)
      .attr("transform", (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getAdditionTextCloseToNodePositioningValue(d, atSource),
      )
      .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().selected(),
      )
      .classed(StaticDomTags.TAG_MUTED, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.isMuted(d.firstSection, selectedTrainrun, connectedTrainIds),
      )
      .classed(StaticDomTags.TAG_WARNING, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.hasWarning(d.firstSection, textElement),
      )
      .classed(StaticDomTags.TAG_EVENT_DISABLED, true)
      .classed(StaticDomTags.TAG_START_TEXT_ANCHOR, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.enforceStartTextAnchor(d, atSource),
      )
      .text((d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getTrainrunSectionNextAndDestinationNodeToShow(
          d,
          this.editorView,
          atSource,
        ),
      );
  }

  createNumberOfStopsTextElement(
    groupEnter: d3.Selector,
    viewObject: TrainrunSectionViewObject,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
    numberOfStops: number,
  ) {
    groupEnter
      .append(StaticDomTags.EDGE_LINE_TEXT_SVG)
      .attr(
        "class",
        StaticDomTags.EDGE_LINE_TEXT_CLASS +
          " " +
          TrainrunSectionsView.createTrainrunSectionFrequencyClassAttribute(
            viewObject.firstSection,
            selectedTrainrun,
            connectedTrainIds,
          ) +
          " " +
          TrainrunSectionText[TrainrunSectionText.TrainrunSectionNumberOfStops],
      )
      .attr(StaticDomTags.EDGE_ID, () => viewObject.firstSection.getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, () => viewObject.getTrainrun().getId())
      .attr(StaticDomTags.EDGE_LINE_TEXT_INDEX, TrainrunSectionText.TrainrunSectionNumberOfStops)
      .attr("numberOfStops", numberOfStops)
      .attr("x", 0.0)
      .attr("y", 0.0)
      .attr("transform", () =>
        TrainrunSectionsView.translateAndRotateText(
          viewObject,
          TrainrunSectionText.TrainrunSectionNumberOfStops,
        ),
      )
      .text(numberOfStops)
      .classed(StaticDomTags.TAG_MUTED, () =>
        TrainrunSectionsView.isMuted(viewObject.firstSection, selectedTrainrun, connectedTrainIds),
      )
      .classed(StaticDomTags.TAG_SELECTED, () => viewObject.getTrainrun().selected())
      .on("mouseup", (t: TrainrunSectionViewObject, i, a) =>
        this.onIntermediateStopMouseUp(t.firstSection, a[i]),
      );
  }

  createIntermediateStops(
    groupEnter: d3.Selector,
    viewObject: TrainrunSectionViewObject,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
  ) {
    const numberOfStops = viewObject.getNumberOfStops();
    const path = viewObject.path;
    let startPosition = path[1];
    let lineOrientationVector = Vec2D.sub(path[2], startPosition);
    const maxNumberOfStops = Math.min(
      SHOW_MAX_SINGLE_TRAINRUN_SECTIONS_STOPS,
      Vec2D.norm(lineOrientationVector) / 20,
    );
    const maxWidth = 16 * (2.5 * SHOW_MAX_SINGLE_TRAINRUN_SECTIONS_STOPS);

    if (Vec2D.norm(lineOrientationVector) > maxWidth) {
      const step = (Vec2D.norm(lineOrientationVector) - maxWidth) / 2.0;
      lineOrientationVector = Vec2D.scale(Vec2D.normalize(lineOrientationVector), maxWidth);
      startPosition = Vec2D.add(
        startPosition,
        Vec2D.scale(Vec2D.normalize(lineOrientationVector), step),
      );
    }

    if (numberOfStops <= maxNumberOfStops) {
      for (let stopIndex = 0; stopIndex < numberOfStops; stopIndex++) {
        this.createSingleStopElement(
          startPosition,
          lineOrientationVector,
          stopIndex,
          numberOfStops,
          groupEnter,
          selectedTrainrun,
          connectedTrainIds,
          numberOfStops,
          false,
        );
      }
    } else {
      // collapsed view
      this.createSingleStopElement(
        startPosition,
        lineOrientationVector,
        0,
        1,
        groupEnter,
        selectedTrainrun,
        connectedTrainIds,
        numberOfStops,
        true,
      );
      this.createNumberOfStopsTextElement(
        groupEnter,
        viewObject,
        selectedTrainrun,
        connectedTrainIds,
        numberOfStops,
      );
    }
  }

  createAllIntermediateStops(
    groupEnter: d3.Selector,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
  ) {
    groupEnter.each((t: TrainrunSectionViewObject, i, a) => {
      const grp = d3
        .select(a[i])
        .append(StaticDomTags.EDGE_LINE_STOPS_GROUP_SVG)
        .attr("class", StaticDomTags.EDGE_LINE_STOPS_GROUP_CLASS);
      this.createIntermediateStops(grp, t, selectedTrainrun, connectedTrainIds);
    });
  }

  filterTrainrunSectionToDisplay(trainrunSection: TrainrunSection) {
    return this.editorView.filterTrainrunsection(trainrunSection);
  }

  createViewTrainrunSectionDataObjects(
    editorView: EditorView,
    inputTrainrunSections: TrainrunSection[],
  ): TrainrunSectionViewObject[] {
    const viewTrainrunSectionDataObjects: TrainrunSectionViewObject[] = [];

    const sectionGroups =
      this.trainrunSectionService.groupTrainrunSectionsIntoChains(inputTrainrunSections);

    sectionGroups.forEach((sections) => {
      const viewObject = new TrainrunSectionViewObject(editorView, sections);
      viewTrainrunSectionDataObjects.push(viewObject);
    });

    return viewTrainrunSectionDataObjects;
  }

  displayTrainrunSection(trainrunSections: TrainrunSection[]) {
    const selectedTrainrun: Trainrun = this.editorView.getSelectedTrainrun();
    let connectedTrainIds = [];
    if (selectedTrainrun !== null) {
      connectedTrainIds = this.editorView.getConnectedTrainrunIds(selectedTrainrun);
    }

    const filteredTrainrunSections = trainrunSections.filter(
      (trainrunSection: TrainrunSection) =>
        this.editorView.doCullCheckPositionsInViewport(
          new TrainrunSectionViewObject(this.editorView, [trainrunSection]).path,
        ) && this.filterTrainrunSectionToDisplay(trainrunSection),
    );

    const group = this.trainrunSectionGroup
      .selectAll(StaticDomTags.EDGE_ROOT_CONTAINER_DOM_REF)
      .data(
        this.createViewTrainrunSectionDataObjects(this.editorView, filteredTrainrunSections),
        (d: TrainrunSectionViewObject) => d.key,
      );

    const edgeRootContainerEnter = group
      .enter()
      .append(StaticDomTags.EDGE_SVG)
      .attr("class", StaticDomTags.EDGE_ROOT_CONTAINER)
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.firstSection.getId())
      .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().selected(),
      )
      .classed(StaticDomTags.TAG_MUTED, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.isMuted(d.firstSection, selectedTrainrun, connectedTrainIds),
      );

    const groupLines = edgeRootContainerEnter
      .append(StaticDomTags.EDGE_SVG)
      .attr("class", StaticDomTags.EDGE_CLASS + " Lines")
      .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().selected(),
      )
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.firstSection.getId())
      .attr("data-testid", `${StaticDomTags.EDGE_CLASS}-lines`);

    const groupLabels = edgeRootContainerEnter
      .append(StaticDomTags.EDGE_SVG)
      .attr("class", StaticDomTags.EDGE_CLASS + " Labels")
      .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().selected(),
      )
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.firstSection.getId())
      .attr("data-testid", `${StaticDomTags.EDGE_CLASS}-labels`);

    // Default case: Render default trainrunSection
    this.defaultTrainrunSectionsRendering(
      groupLines,
      selectedTrainrun,
      connectedTrainIds,
      groupLabels,
    );

    // Special case : render all trainrunsection which have one node filtered (hidden)
    this.oneNodeHiddenTrainrunSectionsRendering(
      groupLines,
      selectedTrainrun,
      connectedTrainIds,
      groupLabels,
    );

    group.exit().remove();

    D3Utils.bringTrainrunSectionToFront();
  }

  onTrainrunSectionTextMouseover(trainrunSection: TrainrunSection, domObj: any) {
    if (this.editorView.trainrunSectionPreviewLineView.getMode() === PreviewLineMode.NotDragging) {
      d3.select(domObj).classed(StaticDomTags.TAG_HOVER, true);
    }
  }

  onIntermediateStopMouseOut(
    trainrunSection: TrainrunSection,
    stopIndex: number,
    position: Vec2D,
    domObj: any,
  ) {
    d3.event.stopPropagation();
    if (d3.event.buttons === 0) {
      d3.select(domObj).classed(StaticDomTags.TAG_HOVER, false);
    }
  }

  onIntermediateStopMouseOver(
    trainrunSection: TrainrunSection,
    stopIndex: number,
    position: Vec2D,
    domObj: any,
  ) {
    d3.event.stopPropagation();
    d3.select(domObj).classed(StaticDomTags.TAG_HOVER, true);
  }

  onIntermediateStopMouseDown(
    viewObject: TrainrunSectionViewObject,
    stopIndex: number,
    position: Vec2D,
    domObj: any,
  ) {
    if (!d3.select(domObj).classed(StaticDomTags.TAG_SELECTED)) {
      d3.select(domObj).classed(StaticDomTags.TAG_HOVER, false);
      return;
    }
    this.editorView.trainrunSectionPreviewLineView.startDragIntermediateStop(
      new DragIntermediateStopInfo(viewObject, stopIndex, domObj),
      position,
    );

    this.editorView.trainrunSectionPreviewLineView.updatePreviewLine();
  }

  onIntermediateStopMouseUp(trainrunSection: TrainrunSection, domObj: any) {
    d3.event.stopPropagation();
    D3Utils.removeGrayout(trainrunSection);
    this.editorView.trainrunSectionPreviewLineView.stopPreviewLine();
    this.editorView.setTrainrunAsSelected(trainrunSection.getTrainrun());
  }

  onTrainrunSectionTextMouseout(trainrunSection: TrainrunSection, domObj: any) {
    d3.select(domObj).classed(StaticDomTags.TAG_HOVER, false);
  }

  onTrainrunSectionElementClicked(
    trainrunSection: TrainrunSection,
    domObj: any,
    textElement: TrainrunSectionText,
  ) {
    d3.event.stopPropagation();
    const rect: DOMRect = d3.select(domObj).node().getBoundingClientRect();
    const clickPosition = new Vec2D(rect.x + rect.width / 2, rect.y + rect.height / 2);

    if (this.editorView.editorMode === EditorMode.Analytics) {
      this.onTrainrunSectionElementClickedAnalytics(trainrunSection, textElement, clickPosition);
      return;
    }
    this.onTrainrunSectionElementClickedNetzgrafikEditing(
      trainrunSection,
      textElement,
      clickPosition,
    );
  }

  onTrainrunDirectionArrowMouseUp(trainrunSection: TrainrunSection, domObj: any) {
    d3.event.stopPropagation();
    const rect: DOMRect = d3.select(domObj).node().getBoundingClientRect();
    const clickPosition = new Vec2D(rect.x + rect.width / 2, rect.y + rect.height / 2);

    if (this.editorView.editorMode === EditorMode.Analytics) {
      return;
    }
    this.editorView.showTrainrunOneWayInformation(trainrunSection, clickPosition);
  }

  onTrainrunSectionMouseUp(trainrunSection: TrainrunSection, domObj: any) {
    d3.event.stopPropagation();
    const ts = this.editorView.getSelectedTrainrun();
    if (ts === null) {
      D3Utils.enableFastRenderingUpdate();
      this.editorView.setTrainrunAsSelected(trainrunSection.getTrainrun());
      D3Utils.disableFastRenderingUpdate();
      return;
    }
    if (ts.getId() !== trainrunSection.getTrainrunId()) {
      D3Utils.enableFastRenderingUpdate();
      this.editorView.setTrainrunAsSelected(trainrunSection.getTrainrun());
      D3Utils.disableFastRenderingUpdate();
      const param: InformSelectedTrainrunClick = {
        trainrunSectionId: trainrunSection.getId(),
        open: false,
      };
      this.editorView.clickSelectedTrainrunSection(param);
      return;
    }
    const param: InformSelectedTrainrunClick = {
      trainrunSectionId: trainrunSection.getId(),
      open: true,
    };
    this.editorView.clickSelectedTrainrunSection(param);
  }

  onTrainrunSectionMouseoverPath(trainrunSection: TrainrunSection, domObj: any) {
    if (this.editorView.trainrunSectionPreviewLineView.getMode() === PreviewLineMode.NotDragging) {
      D3Utils.hoverTrainrunSection(
        trainrunSection,
        this.editorView.getSelectedTrainrun() !== null,
        domObj,
      );
    }
  }

  onTrainrunSectionMouseoutPath(trainrunSection: TrainrunSection, domObj: any) {
    D3Utils.unhoverTrainrunSection(trainrunSection);
  }

  onTrainrunSectionMouseoverPin(node: Node, domObj: any) {
    if (this.editorView.trainrunSectionPreviewLineView.getMode() === PreviewLineMode.NotDragging) {
      this.editorView.nodesView.unhoverNode(node, null);
    } else {
      this.editorView.nodesView.hoverNode(node, null);
    }
    d3.select(domObj).classed(StaticDomTags.TAG_HOVER, true);
  }

  onTrainrunSectionMouseoutPin(trainrunSection: TrainrunSection, domObj: any, atSource: boolean) {
    d3.select(domObj).classed(StaticDomTags.TAG_HOVER, false);
    if (this.editorView.trainrunSectionPreviewLineView.getMode() !== PreviewLineMode.NotDragging) {
      return;
    }
    if (d3.event.buttons === 0) {
      return;
    }
    const obj = d3
      .selectAll(
        StaticDomTags.EDGE_LINE_PIN_DOM_REF +
          "." +
          (atSource ? StaticDomTags.EDGE_IS_TARGET : StaticDomTags.EDGE_IS_SOURCE),
      )
      .filter((d: TrainrunSectionViewObject) => d.firstSection.getId() === trainrunSection.getId());
    const startAT: Vec2D = new Vec2D(+obj.attr("cx"), +obj.attr("cy"));
    this.editorView.trainrunSectionPreviewLineView.setExistingTrainrunSection(trainrunSection);
    D3Utils.doGrayout(trainrunSection);
    this.editorView.trainrunSectionPreviewLineView.startPreviewLineAtPosition(
      TrainrunSectionsView.getNode(trainrunSection, !atSource),
      startAT,
    );

    const hasTrans =
      TrainrunSectionsView.getNode(trainrunSection, atSource).getTransition(
        trainrunSection.getId(),
      ) !== undefined;

    this.editorView.trainrunSectionPreviewLineView.updatePreviewLineCombineTrainruns(hasTrans);

    d3.selectAll(StaticDomTags.CONNECTION_LINE_PIN_DOM_REF).classed(
      StaticDomTags.CONNECTION_TAG_ONGOING_DRAGGING,
      true,
    );
  }

  onTrainrunSectionMousedownPin() {
    d3.event.stopPropagation();
  }

  onTrainrunSectionMousemovePin() {
    d3.event.stopPropagation();
  }

  onTrainrunSectionMouseupPin(trainrunSection: TrainrunSection, atSource: boolean) {
    d3.selectAll(StaticDomTags.CONNECTION_LINE_PIN_DOM_REF).classed(
      StaticDomTags.CONNECTION_TAG_ONGOING_DRAGGING,
      false,
    );
    this.createNewTrainrunSectionAfterPinDropped(
      TrainrunSectionsView.getNode(trainrunSection, atSource),
      trainrunSection,
    );
    this.editorView.trainrunSectionPreviewLineView.stopPreviewLine();
  }

  private onTrainrunSectionElementClickedAnalytics(
    trainrunSection: TrainrunSection,
    textElement: TrainrunSectionText,
    clickPos: Vec2D,
  ) {
    let node: Node;
    let minute: number;
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
        node = trainrunSection.getSourceNode();
        minute = trainrunSection.getSourceDeparture();
        break;
      case TrainrunSectionText.TargetDeparture:
        node = trainrunSection.getTargetNode();
        minute = trainrunSection.getTargetDeparture();
        break;
    }
    this.editorView.unselectAllNodes();
    this.editorView.calculateShortestDistanceNodesFromStartingTrainrunSection(
      trainrunSection.getId(),
      node.getId(),
    );
  }

  private onTrainrunSectionElementClickedNetzgrafikEditing(
    trainrunSection: TrainrunSection,
    textElement: TrainrunSectionText,
    clickPos: Vec2D,
  ) {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
      case TrainrunSectionText.SourceArrival:
      case TrainrunSectionText.TargetDeparture:
      case TrainrunSectionText.TargetArrival:
      case TrainrunSectionText.TrainrunSectionTravelTime:
      case TrainrunSectionText.TrainrunSectionNumberOfStops:
        this.editorView.showTrainrunSectionInformation(trainrunSection, clickPos, textElement);
        break;
      case TrainrunSectionText.TrainrunSectionName:
        this.editorView.showTrainrunInformation(trainrunSection, clickPos);
    }
  }

  private filterTimeTrainrunsectionNonStop(
    viewObject: TrainrunSectionViewObject,
    atSource: boolean,
    isArrival: boolean,
  ): boolean {
    if (!isArrival) {
      return true;
    }
    const trainrunSection = viewObject.trainrunSections.at(atSource ? 0 : -1);
    if (atSource) {
      return !trainrunSection.getSourceNode().isNonStop(trainrunSection);
    }
    return !trainrunSection.getTargetNode().isNonStop(trainrunSection);
  }

  private filterTrainrunsectionAtNode(
    viewObject: TrainrunSectionViewObject,
    atSource: boolean,
  ): boolean {
    if (this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }
    const trainrunSection = viewObject.trainrunSections.at(atSource ? 0 : -1);
    return this.editorView.checkFilterNode(TrainrunSectionsView.getNode(trainrunSection, atSource));
  }

  private transformPathAddExtraElementForPortAlignmentBottom(
    node: Node,
    ts: TrainrunSection,
    element,
    transformedPath: Vec2D[],
  ): Vec2D[] {
    const port = node.getPortOfTrainrunSection(ts.getId());
    if (port === undefined) {
      return transformedPath;
    }
    if (port.getPositionAlignment() === PortAlignment.Bottom) {
      const v = element.copy();
      v.setY(v.getY() - NODE_TEXT_AREA_HEIGHT - NODE_EDGE_WIDTH);
      transformedPath.push(v);
    }
    return transformedPath;
  }

  private transformPathIfSourceNodeFilteredDueNonStopNodesFiltering(
    viewObject: TrainrunSectionViewObject,
    transformedPath: Vec2D[],
  ): Vec2D[] {
    const sourceSection = viewObject.firstSection;
    const srcNode = sourceSection.getSourceNode();
    const path: Vec2D[] = Object.assign([], viewObject.path);

    if (!this.editorView.checkFilterNonStopNode(srcNode)) {
      const element = path[0].copy();
      transformedPath = transformedPath.reverse();
      transformedPath = this.transformPathAddExtraElementForPortAlignmentBottom(
        srcNode,
        sourceSection,
        element,
        transformedPath,
      );
      transformedPath = transformedPath.reverse();

      const transitionObject: Transition = srcNode.getTransition(sourceSection.getId());
      if (transitionObject !== undefined) {
        const tPath = Object.assign([], transitionObject.getPath());
        const n0 = Vec2D.norm(Vec2D.sub(element, tPath[0]));
        const n1 = Vec2D.norm(Vec2D.sub(element, tPath[3]));
        if (n0 <= n1) {
          transformedPath = transformedPath.reverse();
          // tPath.forEach(v => transformedPath.push(v));
          transformedPath.push(tPath[0]);
          transformedPath.push(tPath[1]);
          transformedPath.push(Vec2D.scale(Vec2D.add(tPath[1], tPath[2]), 0.5));
          transformedPath = transformedPath.reverse();
        } else {
          transformedPath = transformedPath.reverse();
          //tPath.reverse().forEach(v => transformedPath.push(v));
          transformedPath.push(tPath[3]);
          transformedPath.push(tPath[2]);
          transformedPath.push(Vec2D.scale(Vec2D.add(tPath[2], tPath[1]), 0.5));
          transformedPath = transformedPath.reverse();
        }
      }
    }
    return transformedPath;
  }

  private transformPathIfTargetNodeFilteredDueNonStopNodesFiltering(
    viewObject: TrainrunSectionViewObject,
    transformedPath: Vec2D[],
  ): Vec2D[] {
    const targetSection = viewObject.lastSection;
    const trgNode = targetSection.getTargetNode();
    const path: Vec2D[] = Object.assign([], viewObject.path);

    if (!this.editorView.checkFilterNonStopNode(trgNode)) {
      const element = path[3].copy();
      transformedPath = this.transformPathAddExtraElementForPortAlignmentBottom(
        trgNode,
        targetSection,
        element,
        transformedPath,
      );

      const transitionObject: Transition = trgNode.getTransition(targetSection.getId());
      if (transitionObject !== undefined) {
        const tPath = Object.assign([], transitionObject.getPath());
        const n0 = Vec2D.norm(Vec2D.sub(element, tPath[0]));
        const n1 = Vec2D.norm(Vec2D.sub(element, tPath[3]));
        if (n0 <= n1) {
          // tPath.forEach(v => transformedPath.push(v));
          transformedPath.push(tPath[0]);
          transformedPath.push(tPath[1]);
          transformedPath.push(Vec2D.scale(Vec2D.add(tPath[1], tPath[2]), 0.5));
        } else {
          // tPath.reverse().forEach(v => transformedPath.push(v));
          transformedPath.push(tPath[3]);
          transformedPath.push(tPath[2]);
          transformedPath.push(Vec2D.scale(Vec2D.add(tPath[2], tPath[1]), 0.5));
        }
      }
    }
    return transformedPath;
  }

  private transformPath(viewObject: TrainrunSectionViewObject): Vec2D[] {
    const firstSection = viewObject.firstSection;
    const lastSection = viewObject.lastSection;

    const srcNode = firstSection.getSourceNode();
    const trgNode = lastSection.getTargetNode();
    const path = viewObject.path;

    let notFilteringSourceNode = this.editorView.checkFilterNode(srcNode);
    let notFilteringTargetNode = this.editorView.checkFilterNode(trgNode);

    if (this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      notFilteringSourceNode = true;
      notFilteringTargetNode = true;
    }

    let retPath: Vec2D[] = [];

    if (notFilteringSourceNode) {
      retPath.push(path[0].copy());
      retPath.push(path[1].copy());
    }
    if (notFilteringTargetNode) {
      retPath.push(path[2].copy());
      retPath.push(path[3].copy());
    }

    if (!this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      if (firstSection.getSourceNode().isNonStopNode()) {
        retPath = this.transformPathIfSourceNodeFilteredDueNonStopNodesFiltering(
          viewObject,
          retPath,
        );
      }
      if (lastSection.getTargetNode().isNonStopNode()) {
        retPath = this.transformPathIfTargetNodeFilteredDueNonStopNodesFiltering(
          viewObject,
          retPath,
        );
      }
    }

    return retPath;
  }

  private filterOutAllTrainrunSectionWithHiddenNodeConnection(
    trainrunSection: TrainrunSection,
  ): boolean {
    if (this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }
    const filterSourceNode = this.editorView.checkFilterNode(trainrunSection.getSourceNode());
    const filterTargetNode = this.editorView.checkFilterNode(trainrunSection.getTargetNode());
    return filterSourceNode && filterTargetNode;
  }

  private oneNodeHiddenTrainrunSectionsRendering(
    inGroupLines,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any[],
    inGroupLabels,
  ) {
    const groupLines = inGroupLines.filter(
      (d: TrainrunSectionViewObject) =>
        !this.filterOutAllTrainrunSectionWithHiddenNodeConnection(d.firstSection),
    );

    this.make4LayerTrainrunSectionLines(
      groupLines,
      selectedTrainrun,
      connectedTrainIds,
      inGroupLabels,
      false,
    );

    if (!this.editorView.isElementDragging()) {
      const groupLabels = inGroupLabels.filter(
        (d: TrainrunSectionViewObject) =>
          !this.filterOutAllTrainrunSectionWithHiddenNodeConnection(d.firstSection),
      );

      if (this.editorView.getLevelOfDetail() === LevelOfDetail.FULL) {
        this.createTrainrunSectionTextBackgrounds(
          // LevelOfDetail.FULL
          groupLabels,
          TrainrunSectionText.SourceArrival,
          selectedTrainrun,
          connectedTrainIds,
        );
        this.createTrainrunSectionTextBackgrounds(
          // LevelOfDetail.FULL
          groupLabels,
          TrainrunSectionText.SourceDeparture,
          selectedTrainrun,
          connectedTrainIds,
        );
        this.createTrainrunSectionTextBackgrounds(
          // LevelOfDetail.FULL
          groupLabels,
          TrainrunSectionText.TargetArrival,
          selectedTrainrun,
          connectedTrainIds,
        );
        this.createTrainrunSectionTextBackgrounds(
          // LevelOfDetail.FULL
          groupLabels,
          TrainrunSectionText.TargetDeparture,
          selectedTrainrun,
          connectedTrainIds,
        );
      }

      if (
        this.editorView.getLevelOfDetail() === LevelOfDetail.FULL ||
        this.editorView.getLevelOfDetail() === LevelOfDetail.LEVEL3
      ) {
        this.createTrainrunSectionElement(
          // LevelOfDetail.LEVEL3
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
          TrainrunSectionText.SourceArrival,
          false,
        );
        this.createTrainrunSectionElement(
          // LevelOfDetail.LEVEL3
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
          TrainrunSectionText.SourceDeparture,
          false,
        );
        this.createTrainrunSectionElement(
          // LevelOfDetail.LEVEL3
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
          TrainrunSectionText.TargetArrival,
          false,
        );
        this.createTrainrunSectionElement(
          // LevelOfDetail.LEVEL3
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
          TrainrunSectionText.TargetDeparture,
          false,
        );
      }

      this.createTrainrunSectionGotoInfoElement(
        groupLabels,
        selectedTrainrun,
        connectedTrainIds,
        true,
      );
      this.createTrainrunSectionGotoInfoElement(
        groupLabels,
        selectedTrainrun,
        connectedTrainIds,
        false,
      );

      if (
        this.editorView.getLevelOfDetail() === LevelOfDetail.FULL ||
        this.editorView.getLevelOfDetail() === LevelOfDetail.LEVEL3 ||
        this.editorView.getLevelOfDetail() === LevelOfDetail.LEVEL2
      ) {
        this.createTrainrunsectionSemicircles(
          // LevelOfDetail.LEVEL2
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
        );
      }
    }
  }

  private defaultTrainrunSectionsRendering(
    inGroupLines,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any[],
    inGroupLabels,
  ) {
    const groupLines = inGroupLines.filter((d: TrainrunSectionViewObject) =>
      this.filterOutAllTrainrunSectionWithHiddenNodeConnection(d.firstSection),
    );

    this.make4LayerTrainrunSectionLines(
      groupLines,
      selectedTrainrun,
      connectedTrainIds,
      inGroupLabels,
      true,
    );

    if (!this.editorView.isElementDragging()) {
      const groupLabels = inGroupLabels.filter((d: TrainrunSectionViewObject) =>
        this.filterOutAllTrainrunSectionWithHiddenNodeConnection(d.firstSection),
      );

      if (
        this.editorView.getLevelOfDetail() === LevelOfDetail.FULL ||
        this.editorView.getLevelOfDetail() === LevelOfDetail.LEVEL3 ||
        this.editorView.getLevelOfDetail() === LevelOfDetail.LEVEL2
      ) {
        this.createPinOnTrainrunsection(
          // LevelOfDetail.LEVEL2
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
          true,
        );
        this.createPinOnTrainrunsection(
          // LevelOfDetail.LEVEL2
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
          false,
        );
      }

      if (this.editorView.getLevelOfDetail() === LevelOfDetail.FULL) {
        this.createTrainrunSectionTextBackgrounds(
          // LevelOfDetail.FULL
          groupLabels,
          TrainrunSectionText.SourceArrival,
          selectedTrainrun,
          connectedTrainIds,
        );
        this.createTrainrunSectionTextBackgrounds(
          // LevelOfDetail.FULL
          groupLabels,
          TrainrunSectionText.SourceDeparture,
          selectedTrainrun,
          connectedTrainIds,
        );
        this.createTrainrunSectionTextBackgrounds(
          // LevelOfDetail.FULL
          groupLabels,
          TrainrunSectionText.TargetArrival,
          selectedTrainrun,
          connectedTrainIds,
        );
        this.createTrainrunSectionTextBackgrounds(
          // LevelOfDetail.FULL
          groupLabels,
          TrainrunSectionText.TargetDeparture,
          selectedTrainrun,
          connectedTrainIds,
        );
      }

      if (
        this.editorView.getLevelOfDetail() === LevelOfDetail.FULL ||
        this.editorView.getLevelOfDetail() === LevelOfDetail.LEVEL3
      ) {
        this.createTrainrunSectionElement(
          // LevelOfDetail.LEVEL3
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
          TrainrunSectionText.SourceArrival,
        );
        this.createTrainrunSectionElement(
          // LevelOfDetail.LEVEL3
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
          TrainrunSectionText.SourceDeparture,
        );
        this.createTrainrunSectionElement(
          // LevelOfDetail.LEVEL3
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
          TrainrunSectionText.TargetArrival,
        );
        this.createTrainrunSectionElement(
          // LevelOfDetail.LEVEL3
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
          TrainrunSectionText.TargetDeparture,
        );
        this.createTrainrunSectionElement(
          // LevelOfDetail.LEVEL3
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
          TrainrunSectionText.TrainrunSectionTravelTime,
        );
      }

      if (
        this.editorView.getLevelOfDetail() === LevelOfDetail.FULL ||
        this.editorView.getLevelOfDetail() === LevelOfDetail.LEVEL3 ||
        this.editorView.getLevelOfDetail() === LevelOfDetail.LEVEL2
      ) {
        this.createTrainrunSectionElement(
          // LevelOfDetail.LEVEL2
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
          TrainrunSectionText.TrainrunSectionName,
          true,
        );

        this.createTrainrunsectionSemicircles(
          // LevelOfDetail.LEVEL2
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
        );
      }

      if (
        this.editorView.getLevelOfDetail() === LevelOfDetail.FULL ||
        this.editorView.getLevelOfDetail() === LevelOfDetail.LEVEL3
      ) {
        this.createAllIntermediateStops(
          // LevelOfDetail.LEVEL3
          groupLabels,
          selectedTrainrun,
          connectedTrainIds,
        );
      }
    }
  }

  make4LayerTrainrunSectionLines(
    groupLines: any,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any[],
    inGroupLabels,
    enableEvents: boolean,
  ) {
    this.createTrainrunSection(
      groupLines,
      StaticDomTags.EDGE_LINE_LAYER_0,
      [LinePatternRefs.Freq30], // LinePatternRefs.Freq60], (background is required to "stretch the lower area"
      selectedTrainrun,
      connectedTrainIds,
      enableEvents,
    );
    this.createTrainrunSection(
      groupLines,
      StaticDomTags.EDGE_LINE_LAYER_1,
      [LinePatternRefs.Freq30],
      selectedTrainrun,
      connectedTrainIds,
      enableEvents,
    );
    this.createTrainrunSection(
      groupLines,
      StaticDomTags.EDGE_LINE_LAYER_2,
      [LinePatternRefs.Freq60, LinePatternRefs.Freq120],
      selectedTrainrun,
      connectedTrainIds,
      enableEvents,
    );
    this.createTrainrunSection(
      groupLines,
      StaticDomTags.EDGE_LINE_LAYER_3,
      [LinePatternRefs.Freq60, LinePatternRefs.Freq120],
      selectedTrainrun,
      connectedTrainIds,
      enableEvents,
    );

    this.createDirectionArrows(groupLines, selectedTrainrun, connectedTrainIds, enableEvents);
  }

  private createSingleStopElement(
    startPosition: Vec2D,
    lineOrientationVector: Vec2D,
    stopIndex: number,
    drawNumberOfStops,
    groupEnter: d3.Selector,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
    numberOfStops: number,
    collapsedStops: boolean,
  ) {
    const position = Vec2D.add(
      startPosition,
      Vec2D.scale(lineOrientationVector, (stopIndex + 1.0) / (drawNumberOfStops + 1.0)),
    );
    groupEnter
      .append(StaticDomTags.EDGE_LINE_STOPS_SVG)
      .attr(
        "class",
        (t: TrainrunSectionViewObject) =>
          StaticDomTags.EDGE_LINE_STOPS_CLASS +
          TrainrunSectionsView.createTrainrunSectionFrequencyClassAttribute(
            t.firstSection,
            selectedTrainrun,
            connectedTrainIds,
          ),
      )
      .attr(StaticDomTags.EDGE_ID, (t: TrainrunSectionViewObject) => t.firstSection.getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, (t: TrainrunSectionViewObject) =>
        t.getTrainrun().getId(),
      )
      .attr("cx", position.getX())
      .attr("cy", position.getY())
      .attr("r", 1.0)
      .attr(StaticDomTags.EDGE_LINE_STOPS_INDEX, stopIndex)
      .attr("numberOfStops", numberOfStops)
      .classed(StaticDomTags.TAG_MUTED, (t: TrainrunSectionViewObject) =>
        TrainrunSectionsView.isMuted(t.firstSection, selectedTrainrun, connectedTrainIds),
      )
      .classed(StaticDomTags.TAG_SELECTED, (t: TrainrunSectionViewObject) =>
        t.getTrainrun().selected(),
      )
      .classed(StaticDomTags.EDGE_LINE_STOPS_FILL, () => !collapsedStops)
      .on("mouseover", (t: TrainrunSectionViewObject, i, a) =>
        this.onIntermediateStopMouseOver(t.firstSection, stopIndex, position, a[i]),
      )
      .on("mouseout", (t: TrainrunSectionViewObject, i, a) =>
        this.onIntermediateStopMouseOut(t.firstSection, stopIndex, position, a[i]),
      )
      .on("mousedown", (t: TrainrunSectionViewObject, i, a) =>
        this.onIntermediateStopMouseDown(t, stopIndex, position, a[i]),
      )
      .on("mouseup", (t: TrainrunSectionViewObject, i, a) =>
        this.onIntermediateStopMouseUp(t.firstSection, a[i]),
      );
  }

  private createNewTrainrunSectionAfterPinDropped(endNode: any, trainrunSection: TrainrunSection) {
    if (this.editorView.trainrunSectionPreviewLineView.getMode() === PreviewLineMode.NotDragging) {
      return;
    }

    if (endNode === null) {
      this.editorView.deleteTrainrunSection(trainrunSection);
      this.editorView.trainrunSectionPreviewLineView.stopPreviewLine();
      return;
    }

    const startNode: any = this.editorView.trainrunSectionPreviewLineView.getStartNode();
    if (startNode === endNode) {
      this.editorView.trainrunSectionPreviewLineView.stopPreviewLine();
      return;
    }

    d3.event.stopPropagation();
    const trainrunSectionFrom =
      this.editorView.trainrunSectionPreviewLineView.getExistingTrainrunSection();
    if (trainrunSectionFrom !== null) {
      if (trainrunSectionFrom.getTrainrunId() !== trainrunSection.getTrainrunId()) {
        const canCombine = this.editorView.trainrunSectionPreviewLineView.canCombineTwoTrainruns();
        this.editorView.trainrunSectionPreviewLineView.stopPreviewLine();
        if (d3.event.ctrlKey && canCombine) {
          const n: Node = endNode;
          this.editorView.combineTwoTrainruns(
            endNode,
            n.getPortOfTrainrunSection(trainrunSectionFrom.getId()),
            n.getPortOfTrainrunSection(trainrunSection.getId()),
          );
          return;
        }
        this.editorView.addConnectionToNode(endNode, trainrunSectionFrom, trainrunSection);
        this.editorView.setTrainrunSectionAsSelected(trainrunSectionFrom);
        return;
      }
    }
    this.editorView.nodesView.createNewTrainrunSection(startNode, endNode);
    this.editorView.setTrainrunSectionAsSelected(trainrunSectionFrom);
  }
}
