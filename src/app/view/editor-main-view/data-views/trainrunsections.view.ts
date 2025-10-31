import {
  ANGLE_UPSIDE_DOWN_THRESHOLD,
  DEFAULT_ANGLE_HORIZONTAL,
  DEFAULT_ANGLE_VERTICAL,
  DEFAULT_PIN_RADIUS,
  DEFAULT_STOP_ICON,
  EDGE_CASE_THRESHOLD,
  MIN_PATH_LENGTH_FOR_ANGLE,
  NODE_EDGE_WIDTH,
  NODE_TEXT_AREA_HEIGHT,
  PATH_COMPARISON_TOLERANCE,
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
import {SimpleTrainrunSectionRouter} from "../../../services/util/trainrunsection.routing";

export class TrainrunSectionsView {
  trainrunSectionGroup;

  constructor(
    private editorView: EditorView,
    private trainrunSectionService: TrainrunSectionService,
  ) {}

  static translateAndRotateText(
    trainrunSection: TrainrunSection,
    trainrunSectionText: TrainrunSectionText,
  ) {
    const x = trainrunSection.getTextPositionX(trainrunSectionText);
    const y = trainrunSection.getTextPositionY(trainrunSectionText);

    const pathVec2D: Vec2D[] = trainrunSection.getPath();
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

  /**
   * Version that works with TrainrunSectionViewObject to handle custom paths for collapsed chains
   * This method needs access to the view instance to get the collapsed path
   */
  static translateAndRotateTextForViewObject(
    viewObject: TrainrunSectionViewObject,
    trainrunSectionText: TrainrunSectionText,
  ) {
    const trainrunSection = viewObject.trainrunSections[0];

    const x = trainrunSection.getTextPositionX(trainrunSectionText);
    const y = trainrunSection.getTextPositionY(trainrunSectionText);
    const originalPath = trainrunSection.getPath();

    if (originalPath.length >= 4) {
      const s1: Vec2D = originalPath[1];
      const t1: Vec2D = originalPath[2];
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

    return "translate(" + x + "," + y + ") rotate(0, 0,0) ";
  }

  private getTextPositionsForCollapsedChain(
    collapsedChainPath: Vec2D[],
    trainrunSection: TrainrunSection,
  ): any {
    const sourceNode = trainrunSection.getSourceNode();
    const sourcePort =
      sourceNode.getPortOfTrainrunSection(trainrunSection.getId()) || sourceNode.getPorts()[0];

    if (!sourcePort) {
      return null;
    }

    return SimpleTrainrunSectionRouter.placeTextOnTrainrunSection(collapsedChainPath, sourcePort);
  }

  getAdditionPositioningValueForViewObjectWithCollapsedSupport(
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
        return this.translateAndRotateTextForViewObjectWithCollapsedSupport(
          viewObject,
          textElement,
        );
      default:
        return 0;
    }
  }

  translateAndRotateTextForViewObjectWithCollapsedSupport(
    viewObject: TrainrunSectionViewObject,
    trainrunSectionText: TrainrunSectionText,
  ) {
    const trainrunSection = viewObject.trainrunSections[0];
    const collapsedChainPath = this.getCollapsedChainPath(trainrunSection);

    if (collapsedChainPath && collapsedChainPath.length >= MIN_PATH_LENGTH_FOR_ANGLE) {
      const textPositions = this.getTextPositionsForCollapsedChain(
        collapsedChainPath,
        trainrunSection,
      );
      const x =
        textPositions?.[trainrunSectionText]?.x ??
        trainrunSection.getTextPositionX(trainrunSectionText);
      const y =
        textPositions?.[trainrunSectionText]?.y ??
        trainrunSection.getTextPositionY(trainrunSectionText);

      // Use existing calculation logic with collapsed path
      if (collapsedChainPath.length < MIN_PATH_LENGTH_FOR_ANGLE) {
        return `translate(${x},${y}) rotate(0, 0,0) `;
      }

      const [s1, t1] = [collapsedChainPath[1], collapsedChainPath[2]];
      const diff = Vec2D.sub(t1, s1);
      let angle = (Math.atan2(diff.getY(), diff.getX()) / Math.PI) * 180.0;

      if (Math.abs(angle) > ANGLE_UPSIDE_DOWN_THRESHOLD) {
        angle += 180;
      }

      if (Math.abs(diff.getX()) < EDGE_CASE_THRESHOLD) {
        angle = DEFAULT_ANGLE_VERTICAL;
      }
      if (Math.abs(diff.getY()) < EDGE_CASE_THRESHOLD) {
        angle = DEFAULT_ANGLE_HORIZONTAL;
      }

      return `translate(${x},${y}) rotate(${angle}, 0,0) `;
    }

    return TrainrunSectionsView.translateAndRotateTextForViewObject(
      viewObject,
      trainrunSectionText,
    );
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

  static createSemicircle(trainrunSection: TrainrunSection, position: Vec2D): string {
    const path = trainrunSection.getPath();
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

  static getPosition(trainrunSection: TrainrunSection, atSource: boolean): Vec2D {
    return atSource
      ? trainrunSection.getPositionAtSourceNode()
      : trainrunSection.getPositionAtTargetNode();
  }

  static getNode(trainrunSection: TrainrunSection, atSource: boolean): Node {
    return atSource ? trainrunSection.getSourceNode() : trainrunSection.getTargetNode();
  }

  /**
   * Calculate a direct path between start and end nodes for collapsed chain visualization
   */
  static calculateDirectPath(
    startNode: Node,
    endNode: Node,
    allSections: TrainrunSection[],
    primarySection: TrainrunSection,
  ): Vec2D[] {
    const [firstSection, lastSection] = [allSections[0], allSections[allSections.length - 1]];

    const sourcePort =
      startNode.getPortOfTrainrunSection(firstSection.getId()) ?? startNode.getPorts()[0];
    const targetPort =
      endNode.getPortOfTrainrunSection(lastSection.getId()) ?? endNode.getPorts()[0];

    if (!sourcePort || !targetPort) {
      return [];
    }

    return SimpleTrainrunSectionRouter.routeTrainrunSection(
      startNode,
      sourcePort,
      endNode,
      targetPort,
    );
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

  static enforceStartTextAnchor(trainrunSection: TrainrunSection, atSource: boolean): boolean {
    const path = trainrunSection.getPath();
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
    trainrunSection: TrainrunSection,
    atSource: boolean,
  ): string {
    const path = trainrunSection.getPath();
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

  static getPositionX(trainrunSection: TrainrunSection, textElement: TrainrunSectionText): number {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
      case TrainrunSectionText.SourceArrival:
      case TrainrunSectionText.TargetDeparture:
      case TrainrunSectionText.TargetArrival:
        return trainrunSection.getTextPositionX(textElement);
      case TrainrunSectionText.TrainrunSectionTravelTime:
        return RASTERING_BASIC_GRID_SIZE / 4;
      case TrainrunSectionText.TrainrunSectionName:
        return -RASTERING_BASIC_GRID_SIZE / 4;
      default:
        return 0;
    }
  }

  static getPositionY(trainrunSection: TrainrunSection, textElement: TrainrunSectionText): number {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
      case TrainrunSectionText.SourceArrival:
      case TrainrunSectionText.TargetDeparture:
      case TrainrunSectionText.TargetArrival:
        return trainrunSection.getTextPositionY(textElement);
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
    trainrunSection: TrainrunSection,
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
        return TrainrunSectionsView.translateAndRotateText(trainrunSection, textElement);
      default:
        return 0;
    }
  }

  /**
   * Version that works with TrainrunSectionViewObject for collapsed chains
   */
  static getAdditionPositioningValueForViewObject(
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
        return TrainrunSectionsView.translateAndRotateTextForViewObject(viewObject, textElement);
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
    trainrunSection: TrainrunSection,
    textElement: TrainrunSectionText,
    editorView: EditorView,
  ) {
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
      case TrainrunSectionText.SourceArrival:
      case TrainrunSectionText.TargetDeparture:
      case TrainrunSectionText.TargetArrival: {
        const data = TrainrunSectionsView.getFormattedDisplayText(trainrunSection, textElement);
        if (data !== undefined) {
          return data;
        }
        return TrainrunSectionsView.formatTime(
          TrainrunSectionsView.getTime(trainrunSection, textElement),
          editorView.getTimeDisplayPrecision(),
        );
      }
      case TrainrunSectionText.TrainrunSectionTravelTime: {
        const data = TrainrunSectionsView.getFormattedDisplayText(trainrunSection, textElement);
        if (data !== undefined) {
          return data;
        }
        return TrainrunSectionsView.extractTravelTime(trainrunSection, editorView);
      }
      case TrainrunSectionText.TrainrunSectionName:
        return TrainrunSectionsView.extractTrainrunName(trainrunSection);
    }
    return undefined;
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
    trainrunSection: TrainrunSection,
    editorView: EditorView,
    atSource: boolean,
  ): string {
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
          this.filterTrainrunsectionAtNode(d.trainrunSections[0], atSource) &&
          this.filterTimeTrainrunsectionNonStop(d.trainrunSections[0], atSource, isArrival) &&
          displayTextBackground
        );
      })
      .append(StaticDomTags.EDGE_LINE_TEXT_BACKGROUND_SVG)
      .attr(
        "class",
        (d: TrainrunSectionViewObject) =>
          StaticDomTags.EDGE_LINE_TEXT_BACKGROUND_CLASS +
          TrainrunSectionsView.createTrainrunSectionFrequencyClassAttribute(
            d.trainrunSections[0],
            selectedTrainrun,
            connectedTrainIds,
          ),
      )
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.trainrunSections[0].getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().getId(),
      )
      .attr(StaticDomTags.EDGE_LINE_TEXT_INDEX, lineTextElement)
      .attr(
        "x",
        (d: TrainrunSectionViewObject) =>
          d.trainrunSections[0].getTextPositionX(lineTextElement) -
          TrainrunSectionsView.getTrainrunSectionValueTextWidth(
            d.trainrunSections[0],
            lineTextElement,
          ) /
            2,
      )
      .attr(
        "y",
        (d: TrainrunSectionViewObject) =>
          d.trainrunSections[0].getTextPositionY(lineTextElement) -
          TRAINRUN_SECTION_TEXT_AREA_HEIGHT / 2,
      )
      .attr("width", (d: TrainrunSectionViewObject) => {
        return TrainrunSectionsView.getTrainrunSectionValueTextWidth(
          d.trainrunSections[0],
          lineTextElement,
        );
      })
      .attr("height", TRAINRUN_SECTION_TEXT_AREA_HEIGHT)
      .classed(TrainrunSectionText[lineTextElement], true)
      .classed(StaticDomTags.TAG_HIDDEN, (d: TrainrunSectionViewObject) =>
        this.getHiddenTagForTime(d.trainrunSections[0], lineTextElement),
      );
  }

  translateAndRotateArrow(
    trainrunSection: TrainrunSection,
    arrowType: "BEGINNING_ARROW" | "ENDING_ARROW",
  ) {
    const positions = trainrunSection.getPath();
    const isTargetRightOrBottom = TrainrunsectionHelper.isTargetRightOrBottom(trainrunSection);

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
        .attr("transform", (d: TrainrunSectionViewObject) =>
          this.translateAndRotateArrow(d.trainrunSections[0], arrowType),
        )
        .attr(
          "class",
          (d: TrainrunSectionViewObject) =>
            StaticDomTags.EDGE_LINE_ARROW_CLASS +
            TrainrunSectionsView.createTrainrunSectionFrequencyClassAttribute(
              d.trainrunSections[0],
              selectedTrainrun,
              connectedTrainIds,
            ),
        )
        .classed(
          StaticDomTags.TAG_HIDDEN,
          (d: TrainrunSectionViewObject) =>
            !this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() &&
            (!this.editorView.isFilterDirectionArrowsEnabled() ||
              !this.filterTrainrunsectionAtNode(
                d.trainrunSections[0],
                arrowType === "BEGINNING_ARROW",
              )),
        )
        .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.trainrunSections[0].getId())
        .attr(StaticDomTags.EDGE_LINE_LINE_ID, (d: TrainrunSectionViewObject) =>
          d.getTrainrun().getId(),
        )
        .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
          d.getTrainrun().selected(),
        )
        .classed(StaticDomTags.TAG_LINE_ARROW_EDITOR, true)
        .classed(StaticDomTags.TAG_MUTED, (d: TrainrunSectionViewObject) =>
          TrainrunSectionsView.isMuted(d.trainrunSections[0], selectedTrainrun, connectedTrainIds),
        )
        .classed(StaticDomTags.TAG_EVENT_DISABLED, !enableEvents)
        .on("mouseup", (d: TrainrunSectionViewObject, i, a) => {
          this.onTrainrunDirectionArrowMouseUp(d.trainrunSections[0], a[i]);
        })
        .on("mouseover", (d: TrainrunSectionViewObject, i, a) => {
          this.onTrainrunSectionMouseoverPath(d.trainrunSections[0], a[i]);
        })
        .on("mouseout", (d: TrainrunSectionViewObject, i, a) => {
          this.onTrainrunSectionMouseoutPath(d.trainrunSections[0], a[i]);
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
        return !levelFreqFilter.includes(d.trainrunSections[0].getFrequencyLinePatternRef());
      })
      .append(StaticDomTags.EDGE_LINE_SVG)
      .attr(
        "class",
        (d: TrainrunSectionViewObject) =>
          StaticDomTags.EDGE_LINE_CLASS +
          TrainrunSectionsView.createTrainrunSectionFrequencyClassAttribute(
            d.trainrunSections[0],
            selectedTrainrun,
            connectedTrainIds,
          ),
      )
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.trainrunSections[0].getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().getId(),
      )
      .attr("d", (d: TrainrunSectionViewObject) =>
        D3Utils.getPathAsSVGString(this.transformPath(d.trainrunSections[0])),
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
            this.onTrainrunSectionMouseUp(d.trainrunSections[0], a[i]);
          }
        })
        .on("mouseover", (d: TrainrunSectionViewObject, i, a) => {
          if (enableEvents) {
            this.onTrainrunSectionMouseoverPath(d.trainrunSections[0], a[i]);
          }
        })
        .on("mouseout", (d: TrainrunSectionViewObject, i, a) => {
          if (enableEvents) {
            this.onTrainrunSectionMouseoutPath(d.trainrunSections[0], a[i]);
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
      .filter((d: TrainrunSectionViewObject) =>
        this.filterTrainrunsectionAtNode(d.trainrunSections[0], atSource),
      )
      .filter((d: TrainrunSectionViewObject) => {
        const trans = TrainrunSectionsView.getNode(d.trainrunSections[0], atSource).getTransition(
          d.trainrunSections[0].getId(),
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
            d.trainrunSections[0],
            selectedTrainrun,
            connectedTrainIds,
          ),
      )
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.trainrunSections[0].getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().getId(),
      )
      .attr("d", (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.createSemicircle(
          d.trainrunSections[0],
          TrainrunSectionsView.getPosition(d.trainrunSections[0], atSource),
        ),
      )
      .attr(
        "transform",
        (d: TrainrunSectionViewObject) =>
          "translate(" +
          TrainrunSectionsView.getPosition(d.trainrunSections[0], atSource).getX() +
          "," +
          TrainrunSectionsView.getPosition(d.trainrunSections[0], atSource).getY() +
          ")",
      )
      .attr(StaticDomTags.EDGE_NODE_ID, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getNode(d.trainrunSections[0], atSource).getId(),
      )
      .classed(StaticDomTags.EDGE_IS_TARGET, !atSource)
      .classed(StaticDomTags.TAG_HIDDEN, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getNode(d.trainrunSections[0], atSource).isNonStop(d.trainrunSections[0]),
      )
      .classed(StaticDomTags.TAG_MUTED, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.isMuted(d.trainrunSections[0], selectedTrainrun, connectedTrainIds),
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
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.trainrunSections[0].getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().getId(),
      )
      .attr("cx", (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getPosition(d.trainrunSections[0], atSource).getX(),
      )
      .attr("cy", (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getPosition(d.trainrunSections[0], atSource).getY(),
      )
      .attr("r", DEFAULT_PIN_RADIUS)
      .attr(StaticDomTags.EDGE_NODE_ID, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getNode(d.trainrunSections[0], atSource).getId(),
      )
      .classed(
        StaticDomTags.TAG_HIDDEN,
        (d: TrainrunSectionViewObject) =>
          !this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() &&
          !this.editorView.checkFilterNonStopNode(
            TrainrunSectionsView.getNode(d.trainrunSections[0], atSource),
          ),
      )
      .classed(
        StaticDomTags.TAG_EVENT_DISABLED,
        (d: TrainrunSectionViewObject) =>
          !this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() &&
          !this.editorView.checkFilterNonStopNode(
            TrainrunSectionsView.getNode(d.trainrunSections[0], atSource),
          ),
      )
      .classed(atSource ? StaticDomTags.EDGE_IS_SOURCE : StaticDomTags.EDGE_IS_TARGET, true)
      .classed(StaticDomTags.EDGE_IS_END_NODE, (d: TrainrunSectionViewObject) => {
        let node = d.trainrunSections[0].getTargetNode();
        if (atSource) {
          node = d.trainrunSections[0].getSourceNode();
        }
        const port = node.getPortOfTrainrunSection(d.trainrunSections[0].getId());
        const trans = node.getTransitionFromPortId(port.getId());
        return trans === undefined;
      })
      .classed(StaticDomTags.EDGE_IS_NOT_END_NODE, (d: TrainrunSectionViewObject) => {
        let node = d.trainrunSections[0].getTargetNode();
        if (atSource) {
          node = d.trainrunSections[0].getSourceNode();
        }
        const port = node.getPortOfTrainrunSection(d.trainrunSections[0].getId());
        const trans = node.getTransitionFromPortId(port.getId());
        return trans !== undefined;
      })

      .classed(StaticDomTags.TAG_MUTED, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.isMuted(d.trainrunSections[0], selectedTrainrun, connectedTrainIds),
      )
      .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().selected(),
      )
      .on("mouseover", (d: TrainrunSectionViewObject, i, a) =>
        this.onTrainrunSectionMouseoverPin(
          TrainrunSectionsView.getNode(d.trainrunSections[0], atSource),
          a[i],
        ),
      )
      .on("mouseout", (d: TrainrunSectionViewObject, i, a) =>
        this.onTrainrunSectionMouseoutPin(d.trainrunSections[0], a[i], atSource),
      )
      .on("mousedown", () => this.onTrainrunSectionMousedownPin())
      .on("mousemove", () => this.onTrainrunSectionMousemovePin())
      .on("mouseup", (d: TrainrunSectionViewObject) =>
        this.onTrainrunSectionMouseupPin(d.trainrunSections[0], atSource),
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
    const isArrival =
      textElement === TrainrunSectionText.SourceArrival ||
      textElement === TrainrunSectionText.TargetArrival;

    const isOneWayText =
      textElement === TrainrunSectionText.SourceDeparture ||
      textElement === TrainrunSectionText.TargetArrival;

    const renderingObjects = groupEnter
      .filter((d: TrainrunSectionViewObject) => {
        const displayTextElement =
          d.getTrainrun().isRoundTrip() || isDefaultText || isOneWayText;

        return (
          this.filterTrainrunsectionAtNode(d.trainrunSections[0], atSource) &&
          this.filterTimeTrainrunsectionNonStop(d.trainrunSections[0], atSource, isArrival) &&
          TrainrunSectionsView.hasWarning(d.trainrunSections[0], textElement) === hasWarning &&
          displayTextElement
        );
      })
      .append(StaticDomTags.EDGE_LINE_TEXT_SVG)
      .attr("class", (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getTrainrunSectionTimeElementClass(
          d.trainrunSections[0],
          textElement,
          selectedTrainrun,
          connectedTrainIds,
        ),
      )
      .attr("data-testid", StaticDomTags.EDGE_LINE_TEXT_CLASS)
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.trainrunSections[0].getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().getId(),
      )
      .attr(StaticDomTags.EDGE_LINE_TEXT_INDEX, textElement)
      .attr("x", (d: TrainrunSectionViewObject) => {
        const section =
          textElement === TrainrunSectionText.TargetDeparture ||
          textElement === TrainrunSectionText.TargetArrival
            ? d.trainrunSections.at(-1)
            : d.trainrunSections[0];
        return TrainrunSectionsView.getPositionX(section, textElement);
      })
      .attr("y", (d: TrainrunSectionViewObject) => {
        const section =
          textElement === TrainrunSectionText.TargetDeparture ||
          textElement === TrainrunSectionText.TargetArrival
            ? d.trainrunSections.at(-1)
            : d.trainrunSections[0];
        return TrainrunSectionsView.getPositionY(section, textElement);
      })
      .attr(
        TrainrunSectionsView.getAdditionPositioningAttr(textElement),
        (d: TrainrunSectionViewObject) =>
          this.getAdditionPositioningValueForViewObjectWithCollapsedSupport(d, textElement),
      )
      .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().selected(),
      )
      .classed(StaticDomTags.TAG_MUTED, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.isMuted(d.trainrunSections[0], selectedTrainrun, connectedTrainIds),
      )
      .classed(StaticDomTags.TAG_WARNING, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.hasWarning(d.trainrunSections[0], textElement),
      )
      .classed(StaticDomTags.TAG_HIDDEN, (d: TrainrunSectionViewObject) =>
        this.getHiddenTagForTime(d.trainrunSections[0], textElement),
      )
      .classed(StaticDomTags.TAG_EVENT_DISABLED, !enableEvents)
      .text((d: TrainrunSectionViewObject) =>
        this.getTrainrunSectionValueToShowWithCollapsedSupport(d, textElement, this.editorView),
      )
      .attr("style", (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getTrainrunSectionValueHtmlStyle(d.trainrunSections[0], textElement),
      )
      .on("mouseover", (d: TrainrunSectionViewObject, i, a) => {
        if (enableEvents) {
          this.onTrainrunSectionTextMouseover(d.trainrunSections[0], a[i]);
        }
      })
      .on("mouseout", (d: TrainrunSectionViewObject, i, a) => {
        if (enableEvents) {
          this.onTrainrunSectionTextMouseout(d.trainrunSections[0], a[i]);
        }
      })
      .on("mouseup", (d: TrainrunSectionViewObject, i, a) => {
        if (enableEvents) {
          this.onTrainrunSectionElementClicked(d.trainrunSections[0], a[i], textElement);
        }
      });

    if (hasWarning) {
      renderingObjects.append("svg:title").text((d: TrainrunSectionViewObject) => {
        return TrainrunSectionsView.getWarning(d.trainrunSections[0], textElement);
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
      .filter((d: TrainrunSectionViewObject) =>
        this.filterTrainrunsectionAtNode(d.trainrunSections[0], atSource),
      )
      .append(StaticDomTags.EDGE_LINE_TEXT_SVG)
      .attr("class", (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getTrainrunSectionTimeElementClass(
          d.trainrunSections[0],
          textElement,
          selectedTrainrun,
          connectedTrainIds,
        ),
      )
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.trainrunSections[0].getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().getId(),
      )
      .attr(StaticDomTags.EDGE_LINE_TEXT_INDEX, textElement)
      .attr("x", 0)
      .attr("y", 0)
      .attr("transform", (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getAdditionTextCloseToNodePositioningValue(
          d.trainrunSections[0],
          atSource,
        ),
      )
      .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().selected(),
      )
      .classed(StaticDomTags.TAG_MUTED, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.isMuted(d.trainrunSections[0], selectedTrainrun, connectedTrainIds),
      )
      .classed(StaticDomTags.TAG_WARNING, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.hasWarning(d.trainrunSections[0], textElement),
      )
      .classed(StaticDomTags.TAG_EVENT_DISABLED, true)
      .classed(StaticDomTags.TAG_START_TEXT_ANCHOR, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.enforceStartTextAnchor(d.trainrunSections[0], atSource),
      )
      .text((d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.getTrainrunSectionNextAndDestinationNodeToShow(
          d.trainrunSections[0],
          this.editorView,
          atSource,
        ),
      );
  }

  createNumberOfStopsTextElement(
    groupEnter: d3.Selector,
    trainrunSection: TrainrunSection,
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
            trainrunSection,
            selectedTrainrun,
            connectedTrainIds,
          ) +
          " " +
          TrainrunSectionText[TrainrunSectionText.TrainrunSectionNumberOfStops],
      )
      .attr(StaticDomTags.EDGE_ID, () => trainrunSection.getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, () => trainrunSection.getTrainrunId())
      .attr(StaticDomTags.EDGE_LINE_TEXT_INDEX, TrainrunSectionText.TrainrunSectionNumberOfStops)
      .attr("numberOfStops", numberOfStops)
      .attr("x", 0.0)
      .attr("y", 0.0)
      .attr("transform", () =>
        TrainrunSectionsView.translateAndRotateText(
          trainrunSection,
          TrainrunSectionText.TrainrunSectionNumberOfStops,
        ),
      )
      .text(numberOfStops)
      .classed(StaticDomTags.TAG_MUTED, () =>
        TrainrunSectionsView.isMuted(trainrunSection, selectedTrainrun, connectedTrainIds),
      )
      .classed(StaticDomTags.TAG_SELECTED, () => trainrunSection.getTrainrun().selected())
      .on("mouseup", (t: TrainrunSectionViewObject, i, a) =>
        this.onIntermediateStopMouseUp(t.trainrunSections[0], a[i]),
      );
  }

  createIntermediateStops(
    groupEnter: d3.Selector,
    trainrunSection: TrainrunSection,
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
  ) {
    const numberOfStops = trainrunSection.getNumberOfStops();
    const path = trainrunSection.getPath();
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
        trainrunSection,
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
      this.createIntermediateStops(grp, t.trainrunSections[0], selectedTrainrun, connectedTrainIds);
    });
  }

  filterTrainrunSectionToDisplay(trainrunSection: TrainrunSection) {
    return this.editorView.filterTrainrunsection(trainrunSection);
  }

  createViewTrainrunSectionDataObjects(
    editorView: EditorView,
    inputTrainrunSections: TrainrunSection[],
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
  ): TrainrunSectionViewObject[] {
    const viewTrainrunSectionDataObjects: TrainrunSectionViewObject[] = [];

    const sectionGroups =
      this.trainrunSectionService.groupTrainrunSectionsIntoChains(inputTrainrunSections);

    sectionGroups.forEach((sections) => {
      const d = sections[0];
      this.updateTrainrunSectionPathForCollapsedChain(d);
      viewTrainrunSectionDataObjects.push(
        new TrainrunSectionViewObject(
          editorView,
          sections,
          TrainrunSectionsView.getNode(d, true).isNonStop(d),
          TrainrunSectionsView.getNode(d, false).isNonStop(d),
          TrainrunSectionsView.isMuted(d, selectedTrainrun, connectedTrainIds),
          this.getHiddenTagForTime(d, TrainrunSectionText.SourceDeparture),
          this.getHiddenTagForTime(d, TrainrunSectionText.TargetDeparture),
          this.getHiddenTagForTime(d, TrainrunSectionText.TrainrunSectionTravelTime),
          this.getHiddenTagForTime(d, TrainrunSectionText.TrainrunSectionName),
          !this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() &&
            !this.editorView.isFilterDirectionArrowsEnabled(),
        ),
      );
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
        this.editorView.doCullCheckPositionsInViewport(trainrunSection.getPath()) &&
        this.filterTrainrunSectionToDisplay(trainrunSection),
    );

    const group = this.trainrunSectionGroup
      .selectAll(StaticDomTags.EDGE_ROOT_CONTAINER_DOM_REF)
      .data(
        this.createViewTrainrunSectionDataObjects(
          this.editorView,
          filteredTrainrunSections,
          selectedTrainrun,
          connectedTrainIds,
        ),
        (d: TrainrunSectionViewObject) => d.key,
      );

    const edgeRootContainerEnter = group
      .enter()
      .append(StaticDomTags.EDGE_SVG)
      .attr("class", StaticDomTags.EDGE_ROOT_CONTAINER)
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.trainrunSections[0].getId())
      .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().selected(),
      )
      .classed(StaticDomTags.TAG_MUTED, (d: TrainrunSectionViewObject) =>
        TrainrunSectionsView.isMuted(d.trainrunSections[0], selectedTrainrun, connectedTrainIds),
      );

    const groupLines = edgeRootContainerEnter
      .append(StaticDomTags.EDGE_SVG)
      .attr("class", StaticDomTags.EDGE_CLASS + " Lines")
      .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().selected(),
      )
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.trainrunSections[0].getId())
      .attr("data-testid", `${StaticDomTags.EDGE_CLASS}-lines`);

    const groupLabels = edgeRootContainerEnter
      .append(StaticDomTags.EDGE_SVG)
      .attr("class", StaticDomTags.EDGE_CLASS + " Labels")
      .classed(StaticDomTags.TAG_SELECTED, (d: TrainrunSectionViewObject) =>
        d.getTrainrun().selected(),
      )
      .attr(StaticDomTags.EDGE_ID, (d: TrainrunSectionViewObject) => d.trainrunSections[0].getId())
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
    trainrunSection: TrainrunSection,
    stopIndex: number,
    position: Vec2D,
    domObj: any,
  ) {
    if (!d3.select(domObj).classed(StaticDomTags.TAG_SELECTED)) {
      d3.select(domObj).classed(StaticDomTags.TAG_HOVER, false);
      return;
    }
    this.editorView.trainrunSectionPreviewLineView.startDragIntermediateStop(
      new DragIntermediateStopInfo(trainrunSection, stopIndex, domObj),
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
      .filter(
        (d: TrainrunSectionViewObject) => d.trainrunSections[0].getId() === trainrunSection.getId(),
      );
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
    trainrunSection: TrainrunSection,
    atSource: boolean,
    isArrival: boolean,
  ): boolean {
    if (!isArrival) {
      return true;
    }
    if (atSource) {
      return !trainrunSection.getSourceNode().isNonStop(trainrunSection);
    }
    return !trainrunSection.getTargetNode().isNonStop(trainrunSection);
  }

  private filterTrainrunsectionAtNode(
    trainrunSection: TrainrunSection,
    atSource: boolean,
  ): boolean {
    if (this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }
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
    ts: TrainrunSection,
    transformedPath: Vec2D[],
  ): Vec2D[] {
    const srcNode = ts.getSourceNode();
    const path: Vec2D[] = Object.assign([], ts.getPath());

    if (!this.editorView.checkFilterNonStopNode(srcNode)) {
      const element = path[0].copy();
      transformedPath = transformedPath.reverse();
      transformedPath = this.transformPathAddExtraElementForPortAlignmentBottom(
        srcNode,
        ts,
        element,
        transformedPath,
      );
      transformedPath = transformedPath.reverse();

      const transitionObject: Transition = srcNode.getTransition(ts.getId());
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
    ts: TrainrunSection,
    transformedPath: Vec2D[],
  ): Vec2D[] {
    const trgNode = ts.getTargetNode();
    const path: Vec2D[] = Object.assign([], ts.getPath());

    if (!this.editorView.checkFilterNonStopNode(trgNode)) {
      const element = path[3].copy();
      transformedPath = this.transformPathAddExtraElementForPortAlignmentBottom(
        trgNode,
        ts,
        element,
        transformedPath,
      );

      const transitionObject: Transition = trgNode.getTransition(ts.getId());
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

  private transformPath(ts: TrainrunSection): Vec2D[] {
    const collapsedChainPath = this.getCollapsedChainPath(ts);
    if (collapsedChainPath) {
      return this.applyBasicFiltering(collapsedChainPath, ts);
    }

    const srcNode = ts.getSourceNode();
    const trgNode = ts.getTargetNode();
    let notFilteringSourceNode = this.editorView.checkFilterNode(srcNode);
    let notFilteringTargetNode = this.editorView.checkFilterNode(trgNode);
    if (this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      notFilteringSourceNode = true;
      notFilteringTargetNode = true;
    }

    const path = ts.getPath();
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
      if (ts.getSourceNode().isNonStopNode()) {
        const node = ts.getSourceNode().getOppositeNode(ts);
        retPath = this.transformPathIfSourceNodeFilteredDueNonStopNodesFiltering(ts, retPath);
      }
      if (ts.getTargetNode().isNonStopNode()) {
        retPath = this.transformPathIfTargetNodeFilteredDueNonStopNodesFiltering(ts, retPath);
      }
    }

    return retPath;
  }

  /**
   * Detect collapsed node chains and calculate direct visualization path
   *
   * A collapsed chain occurs when intermediate nodes are hidden from view.
   * Example: A-B*-C*-D where B* and C* are collapsed -> create direct path A→D
   *
   * Algorithm:
   * 1. Walk backward from current section to find chain start (non-collapsed node)
   * 2. Walk forward from current section to find chain end (non-collapsed node)
   * 3. If start != end, calculate direct path using legacy routing system
   *
   * @param currentSection The section that might be part of a collapsed chain
   * @returns Direct path Vec2D[] if chain detected, null otherwise
   */
  private getCollapsedChainPath(currentSection: TrainrunSection): Vec2D[] | null {
    const trainrunId = currentSection.getTrainrunId();

    const startSection = this.findChainBoundary(currentSection, trainrunId, "backward");
    const endSection = this.findChainBoundary(currentSection, trainrunId, "forward");

    if (startSection.getId() !== endSection.getId()) {
      const startNode = startSection.getSourceNode();
      const endNode = endSection.getTargetNode();

      return TrainrunSectionsView.calculateDirectPath(
        startNode,
        endNode,
        [startSection, endSection],
        currentSection,
      );
    }

    return null;
  }

  /**
   * Updates the TrainrunSection's path if it's part of a collapsed chain.
   * This ensures the visual rendering uses the correct collapsed path instead of the direct path.
   */
  private updateTrainrunSectionPathForCollapsedChain(section: TrainrunSection): void {
    const collapsedPath = this.getCollapsedChainPath(section);
    if (collapsedPath) {
      (section as any).pathVec2D = collapsedPath;

      const sourcePort = section.getSourceNode().getPort(section.getSourcePortId());
      if (sourcePort) {
        (section as any).path.textPositions =
          SimpleTrainrunSectionRouter.placeTextOnTrainrunSection(collapsedPath, sourcePort);
      }
    }
  }

  /**
   * Find the boundary of a collapsed chain by walking in the specified direction
   */
  private findChainBoundary(
    startSection: TrainrunSection,
    trainrunId: number,
    direction: "forward" | "backward",
  ): TrainrunSection {
    let currentSection = startSection;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const node =
        direction === "backward" ? currentSection.getSourceNode() : currentSection.getTargetNode();

      if (!node.getIsCollapsed()) {
        break;
      }

      const connectedSections = this.getConnectedTrainrunSections(node, trainrunId).filter(
        (ts) => ts.getId() !== currentSection.getId(),
      );

      if (connectedSections.length === 1) {
        currentSection = connectedSections[0];
      } else {
        break;
      }
    }

    return currentSection;
  }

  /**
   * Get all trainrun sections connected to a node for a specific trainrun
   */
  private getConnectedTrainrunSections(node: Node, trainrunId: number): TrainrunSection[] {
    const sections: TrainrunSection[] = [];
    const ports = node.getPorts();

    for (const port of ports) {
      const section = port.getTrainrunSection();
      if (section && section.getTrainrunId() === trainrunId) {
        sections.push(section);
      }
    }

    return sections;
  }

  /**
   * Apply basic filtering to a path
   */
  private applyBasicFiltering(path: Vec2D[], ts: TrainrunSection): Vec2D[] {
    const srcNode = ts.getSourceNode();
    const trgNode = ts.getTargetNode();
    let notFilteringSourceNode = this.editorView.checkFilterNode(srcNode);
    let notFilteringTargetNode = this.editorView.checkFilterNode(trgNode);

    if (this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      notFilteringSourceNode = true;
      notFilteringTargetNode = true;
    }

    if (notFilteringSourceNode && notFilteringTargetNode) {
      return path.map((p) => p.copy());
    } else if (notFilteringSourceNode) {
      return path.slice(0, 2).map((p) => p.copy());
    } else if (notFilteringTargetNode) {
      return path.slice(2).map((p) => p.copy());
    } else {
      return [];
    }
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
        !this.filterOutAllTrainrunSectionWithHiddenNodeConnection(d.trainrunSections[0]),
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
          !this.filterOutAllTrainrunSectionWithHiddenNodeConnection(d.trainrunSections[0]),
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
      this.filterOutAllTrainrunSectionWithHiddenNodeConnection(d.trainrunSections[0]),
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
        this.filterOutAllTrainrunSectionWithHiddenNodeConnection(d.trainrunSections[0]),
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
            t.trainrunSections[0],
            selectedTrainrun,
            connectedTrainIds,
          ),
      )
      .attr(StaticDomTags.EDGE_ID, (t: TrainrunSectionViewObject) => t.trainrunSections[0].getId())
      .attr(StaticDomTags.EDGE_LINE_LINE_ID, (t: TrainrunSectionViewObject) =>
        t.getTrainrun().getId(),
      )
      .attr("cx", position.getX())
      .attr("cy", position.getY())
      .attr("r", 1.0)
      .attr(StaticDomTags.EDGE_LINE_STOPS_INDEX, stopIndex)
      .attr("numberOfStops", numberOfStops)
      .classed(StaticDomTags.TAG_MUTED, (t: TrainrunSectionViewObject) =>
        TrainrunSectionsView.isMuted(t.trainrunSections[0], selectedTrainrun, connectedTrainIds),
      )
      .classed(StaticDomTags.TAG_SELECTED, (t: TrainrunSectionViewObject) =>
        t.getTrainrun().selected(),
      )
      .classed(StaticDomTags.EDGE_LINE_STOPS_FILL, () => !collapsedStops)
      .on("mouseover", (t: TrainrunSectionViewObject, i, a) =>
        this.onIntermediateStopMouseOver(t.trainrunSections[0], stopIndex, position, a[i]),
      )
      .on("mouseout", (t: TrainrunSectionViewObject, i, a) =>
        this.onIntermediateStopMouseOut(t.trainrunSections[0], stopIndex, position, a[i]),
      )
      .on("mousedown", (t: TrainrunSectionViewObject, i, a) =>
        this.onIntermediateStopMouseDown(t.trainrunSections[0], stopIndex, position, a[i]),
      )
      .on("mouseup", (t: TrainrunSectionViewObject, i, a) =>
        this.onIntermediateStopMouseUp(t.trainrunSections[0], a[i]),
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

  /**
   * Get the value to show for collapsed chains (with corrected times)
   */
  getTrainrunSectionValueToShowWithCollapsedSupport(
    viewObject: TrainrunSectionViewObject,
    textElement: TrainrunSectionText,
    editorView: EditorView,
  ) {
    const trainrunSection = viewObject.trainrunSections[0];

    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
      case TrainrunSectionText.SourceArrival:
        // For source times, use the original section times (should be from non-collapsed node)
        return TrainrunSectionsView.getTrainrunSectionValueToShow(
          trainrunSection,
          textElement,
          editorView,
        );

      case TrainrunSectionText.TargetDeparture:
      case TrainrunSectionText.TargetArrival: {
        // For collapsed chains, use the actual time from the last section in the chain
        const chainSections = this.getAllSectionsInCollapsedChain(trainrunSection);
        const lastSection = chainSections[chainSections.length - 1];

        // Use the actual time from the last section (which already includes all stops and travel times)
        return TrainrunSectionsView.getTrainrunSectionValueToShow(
          lastSection,
          textElement,
          editorView,
        );
      }

      case TrainrunSectionText.TrainrunSectionTravelTime: {
        // For collapsed chains, calculate total time including stops at collapsed nodes
        const chainSections = this.getAllSectionsInCollapsedChain(trainrunSection);
        const lastSection = chainSections[chainSections.length - 1];

        // Calculate total time: arrival time at end - departure time at start
        const startTime = TrainrunSectionsView.getTime(
          trainrunSection,
          TrainrunSectionText.SourceDeparture,
        );
        const endTime = TrainrunSectionsView.getTime(
          lastSection,
          TrainrunSectionText.TargetArrival,
        );
        const totalTime = endTime - startTime;

        return (
          TrainrunSectionsView.formatTime(totalTime, editorView.getTimeDisplayPrecision()) + "'"
        );
      }

      case TrainrunSectionText.TrainrunSectionName:
        // For name, use the original trainrun name
        return TrainrunSectionsView.extractTrainrunName(trainrunSection);
    }

    return undefined;
  }

  /**
   * Get all sections that are part of the same collapsed chain
   */
  getAllSectionsInCollapsedChain(currentSection: TrainrunSection): TrainrunSection[] {
    const sections: TrainrunSection[] = [];
    let startSection = currentSection;

    // Walk backwards to find start of chain
    while (startSection.getSourceNode().getIsCollapsed()) {
      const prevSections = this.getConnectedTrainrunSections(
        startSection.getSourceNode(),
        currentSection.getTrainrunId(),
      ).filter((ts) => ts.getId() !== startSection.getId());

      if (prevSections.length === 1) {
        startSection = prevSections[0];
      } else {
        break;
      }
    }

    // Walk forwards to find end of chain and collect all sections
    let currentSectionInChain = startSection;
    sections.push(currentSectionInChain);

    while (currentSectionInChain.getTargetNode().getIsCollapsed()) {
      const nextSections = this.getConnectedTrainrunSections(
        currentSectionInChain.getTargetNode(),
        currentSection.getTrainrunId(),
      ).filter((ts) => ts.getId() !== currentSectionInChain.getId());

      if (nextSections.length === 1) {
        currentSectionInChain = nextSections[0];
        sections.push(currentSectionInChain);
      } else {
        break;
      }
    }

    return sections;
  }
}
