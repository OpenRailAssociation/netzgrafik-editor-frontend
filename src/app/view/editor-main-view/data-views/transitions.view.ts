import * as d3 from "d3";
import {Node} from "../../../models/node.model";
import {EditorView} from "./editor.view";
import {StaticDomTags} from "./static.dom.tags";
import {Transition} from "../../../models/transition.model";
import {Trainrun} from "../../../models/trainrun.model";
import {D3Utils} from "./d3.utils";
import {DragTransitionInfo, PreviewLineMode} from "./trainrunsection.previewline.view";
import {Vec2D} from "../../../utils/vec2D";
import {TransitionViewObject} from "./transitionViewObject";
import {LinePatternRefs} from "../../../data-structures/business.data.structures";

export class TransitionsView {
  transitionsGroup;
  selectedTransitionsGroup;
  editorView: EditorView;

  constructor(editorView: EditorView) {
    this.editorView = editorView;
  }

  static isMuted(
    trainrun: Trainrun,
    selectedTrainrun: Trainrun,
    connectedTrainrunIds: any,
  ): boolean {
    if (
      connectedTrainrunIds !== undefined &&
      connectedTrainrunIds.indexOf(trainrun.getId()) !== -1
    ) {
      return false;
    }

    if (selectedTrainrun !== null) {
      if (trainrun.getId() !== selectedTrainrun.getId()) {
        return true;
      }
    }
    return false;
  }

  static createTrainrunClassAttribute(
    trainrun: Trainrun,
    selectedTrainrun: Trainrun,
    connectedTrainrunIds: any,
  ): string {
    let classAttribute =
      StaticDomTags.TRANSITION_LINE_CLASS +
      StaticDomTags.makeClassTag(
        StaticDomTags.FREQ_LINE_PATTERN,
        trainrun.getFrequencyLinePatternRef(),
      ) +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_COLOR_REF, trainrun.getCategoryColorRef()) +
      StaticDomTags.makeClassTag(
        StaticDomTags.TAG_LINEPATTERN_REF,
        trainrun.getTimeCategoryLinePatternRef(),
      );

    if (TransitionsView.isMuted(trainrun, selectedTrainrun, connectedTrainrunIds) === true) {
      classAttribute = classAttribute + " " + StaticDomTags.TAG_MUTED;
    }
    return classAttribute;
  }

  static createTransitionViewObjects(
    editorView: EditorView,
    inputTransitions: Transition[],
    selectedTrainrun: Trainrun,
    connectedTrainrunIds: any[],
  ): TransitionViewObject[] {
    const viewTransitionViewObjects: TransitionViewObject[] = [];
    inputTransitions.forEach((transition: Transition) => {
      viewTransitionViewObjects.push(
        new TransitionViewObject(
          editorView,
          transition,
          TransitionsView.isMuted(transition.getTrainrun(), selectedTrainrun, connectedTrainrunIds),
        ),
      );
    });
    return viewTransitionViewObjects;
  }

  static createTransitionLineLayer(
    grpEnter: d3.selector,
    classRef: string,
    levelFreqFilter: LinePatternRefs[],
    selectedTrainrun: Trainrun,
    connectedTrainIds: any,
    editorView: EditorView,
  ) {
    grpEnter
      .filter((d: TransitionViewObject) => {
        return !levelFreqFilter.includes(d.transition.getTrainrun().getFrequencyLinePatternRef());
      })
      .append(StaticDomTags.TRANSITION_LINE_SVG)
      .attr(
        "class",
        (t: TransitionViewObject) =>
          StaticDomTags.TRANSITION_LINE_CLASS +
          " " +
          classRef +
          " " +
          TransitionsView.createTrainrunClassAttribute(
            t.transition.getTrainrun(),
            selectedTrainrun,
            connectedTrainIds,
          ),
      )
      .attr(StaticDomTags.TRANSITION_TRAINRUNSECTION_ID1, (t: TransitionViewObject) => {
        const n: Node = editorView.getNodeFromTransition(t.transition);
        return "" + n.getPort(t.transition.getPortId1()).getTrainrunSection().getId();
      })
      .attr(StaticDomTags.TRANSITION_TRAINRUNSECTION_ID2, (t: TransitionViewObject) => {
        const n: Node = editorView.getNodeFromTransition(t.transition);
        return "" + n.getPort(t.transition.getPortId2()).getTrainrunSection().getId();
      })
      .classed(StaticDomTags.TAG_SELECTED, (t: TransitionViewObject) =>
        t.transition.getTrainrun().selected(),
      )
      .attr("d", (t: TransitionViewObject) => D3Utils.getPathAsSVGString(t.transition.getPath()));
  }

  createNonStopToggle(grpEnter: d3.selector, selectedTrainrun: Trainrun, connectedTrainIds: any) {
    if (!this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      return;
    }
    grpEnter
      .append(StaticDomTags.TRANSITION_BUTTON_SVG)
      .attr(
        "class",
        (t: TransitionViewObject) =>
          StaticDomTags.TRANSITION_BUTTON_CLASS +
          " " +
          TransitionsView.createTrainrunClassAttribute(
            t.transition.getTrainrun(),
            selectedTrainrun,
            connectedTrainIds,
          ),
      )
      .classed(StaticDomTags.TAG_SELECTED, (t: TransitionViewObject) =>
        t.transition.getTrainrun().selected(),
      )
      .attr("points", (t: TransitionViewObject) =>
        D3Utils.makeHexagonSVGPoints(
          Vec2D.scale(Vec2D.add(t.transition.getPath()[1], t.transition.getPath()[2]), 0.5),
          StaticDomTags.TRANSITION_BUTTON_SIZE,
        ),
      )
      .classed(StaticDomTags.TRANSITION_IS_NONSTOP, (t: TransitionViewObject) =>
        t.transition.getIsNonStopTransit(),
      )
      .on("mousemove", (t: TransitionViewObject, i, a) => this.onTransitionMousemove(a[i]))
      .on("mouseover", (t: TransitionViewObject, i, a) =>
        this.onTransitionMouseover(t.transition.getTrainrun(), a[i], t.transition),
      )
      .on("mouseup", (t: TransitionViewObject, i, a) =>
        this.onTransitionMouseup(t.transition.getTrainrun(), a[i], t.transition),
      )
      .on("mouseout", (t: TransitionViewObject, i, a) =>
        this.onTransitionButtonOut(t.transition.getTrainrun(), a[i], t.transition),
      );
  }

  setGroup(transitionsGroup) {
    transitionsGroup.attr("class", "TransitionsView");
    this.transitionsGroup = transitionsGroup.append(StaticDomTags.GROUP_SVG);
    this.transitionsGroup.attr("class", "transitions");
    this.selectedTransitionsGroup = transitionsGroup.append(StaticDomTags.GROUP_SVG);
    this.selectedTransitionsGroup.attr("class", "selectedTransitions");
  }

  filtertransitionToDisplay(transition: Transition, trainrun: Trainrun) {
    if (this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      // disable filtering in view (render all objects)
      return true;
    }

    const node = this.editorView.getNodeFromTransition(transition);

    if (node.getIsCollapsed()) {
      return false;
    }

    if (!this.editorView.checkFilterNonStopNode(node)) {
      return false;
    }
    return this.editorView.filterTrainrun(trainrun) && this.editorView.checkFilterNode(node);
  }

  displayTransitions(inputTransitions: Transition[]) {
    const selectedTrainrun: Trainrun = this.editorView.getSelectedTrainrun();
    let connectedTrainIds = [];
    if (selectedTrainrun !== null) {
      connectedTrainIds = this.editorView.getConnectedTrainrunIds(selectedTrainrun);
    }

    const transitions = inputTransitions.filter(
      (t) =>
        this.editorView.doCullCheckPositionsInViewport(t.getPath()) &&
        this.filtertransitionToDisplay(t, t.getTrainrun()),
    );

    this.createTransitions(transitions, selectedTrainrun, connectedTrainIds, true);

    this.createTransitions(transitions, selectedTrainrun, connectedTrainIds, false);
  }

  createTransitions(
    inputTransitions: Transition[],
    selectedTrainrun: Trainrun,
    connectedTrainIds: any[],
    selectedFlagFilter: boolean,
  ) {
    const transitions = inputTransitions.filter(
      (t) => t.getTrainrun().selected() === selectedFlagFilter,
    );
    let rootGroup = this.transitionsGroup;
    if (selectedFlagFilter === true) {
      rootGroup = this.selectedTransitionsGroup;
    }

    const transitionsGroup = rootGroup
      .selectAll(StaticDomTags.TRANSITION_ROOT_CONTAINER_DOM_REF)
      .data(
        TransitionsView.createTransitionViewObjects(
          this.editorView,
          transitions,
          selectedTrainrun,
          connectedTrainIds,
        ),
        (t: TransitionViewObject) => t.key,
      );

    const grpEnter = transitionsGroup
      .enter()
      .append(StaticDomTags.GROUP_SVG)
      .attr("class", StaticDomTags.TRANSITION_ROOT_CONTAINER);

    TransitionsView.createTransitionLineLayer(
      grpEnter,
      StaticDomTags.TRANSITION_LINE_CLASS_0,
      [LinePatternRefs.Freq30], // LinePatternRefs.Freq60], (background is required to "stretch the lower area"
      selectedTrainrun,
      connectedTrainIds,
      this.editorView,
    );
    TransitionsView.createTransitionLineLayer(
      grpEnter,
      StaticDomTags.TRANSITION_LINE_CLASS_1,
      [LinePatternRefs.Freq30],
      selectedTrainrun,
      connectedTrainIds,
      this.editorView,
    );
    TransitionsView.createTransitionLineLayer(
      grpEnter,
      StaticDomTags.TRANSITION_LINE_CLASS_2,
      [LinePatternRefs.Freq60, LinePatternRefs.Freq120],
      selectedTrainrun,
      connectedTrainIds,
      this.editorView,
    );
    TransitionsView.createTransitionLineLayer(
      grpEnter,
      StaticDomTags.TRANSITION_LINE_CLASS_3,
      [LinePatternRefs.Freq60, LinePatternRefs.Freq120],
      selectedTrainrun,
      connectedTrainIds,
      this.editorView,
    );

    if (!this.editorView.isElementDragging()) {
      this.createNonStopToggle(grpEnter, selectedTrainrun, connectedTrainIds);
    }
    transitionsGroup.exit().remove();
  }

  onTransitionMouseup(trainrun: Trainrun, domObj: any, transition: Transition) {
    d3.event.stopPropagation();
    const node: Node = this.editorView.getNodeFromTransition(transition);
    if (this.editorView.trainrunSectionPreviewLineView.getMode() === PreviewLineMode.NotDragging) {
      const port1 = node.getPort(transition.getPortId1());
      const port2 = node.getPort(transition.getPortId2());
      if (
        port1.getTrainrunSection().getTrainrun().selected() ||
        port2.getTrainrunSection().getTrainrun().selected()
      ) {
        if (d3.event.ctrlKey) {
          this.editorView.splitTrainrunIntoTwoParts(transition);
          return;
        }
        this.editorView.toggleNonStop(node, transition);
      }
      return;
    }
    this.editorView.nodesView.handleMouseUpEvent(node);

    D3Utils.removeGrayoutTransition(transition);
    D3Utils.removeGrayoutTrainrunSectionPin();

    this.editorView.trainrunSectionPreviewLineView.stopPreviewLine();
  }

  onTransitionButtonOut(trainrun: Trainrun, domObj: any, transition: Transition) {
    d3.select(domObj).classed(StaticDomTags.TAG_HOVER, false);

    const node: Node = this.editorView.getNodeFromTransition(transition);
    this.editorView.nodesView.unhoverNodeDockable(node, null);

    if (this.editorView.trainrunSectionPreviewLineView.getMode() !== PreviewLineMode.NotDragging) {
      return;
    }
    d3.event.stopPropagation();

    if (d3.event.buttons !== 1) {
      return;
    }
    if (!d3.select(domObj).classed(StaticDomTags.TAG_SELECTED)) {
      d3.select(domObj).classed(StaticDomTags.TAG_HOVER, false);
      return;
    }

    const port1 = node.getPort(transition.getPortId1());
    const port2 = node.getPort(transition.getPortId2());
    const trainrunSection1 = port1.getTrainrunSection();
    const trainrunSection2 = port2.getTrainrunSection();
    const position = Vec2D.scale(Vec2D.add(transition.getPath()[1], transition.getPath()[2]), 0.5);

    this.editorView.trainrunSectionPreviewLineView.startDragTransition(
      new DragTransitionInfo(node, trainrunSection1, trainrunSection2, transition, true, domObj),
      position,
    );
    this.editorView.trainrunSectionPreviewLineView.updatePreviewLine();
  }

  onTransitionMousemove(domObj: any) {
    d3.event.stopPropagation();
  }

  onTransitionMouseover(trainrun: Trainrun, domObj: any, transition: Transition) {
    const node: Node = this.editorView.getNodeFromTransition(transition);
    if (this.editorView.trainrunSectionPreviewLineView.getMode() === PreviewLineMode.NotDragging) {
      const port1 = node.getPort(transition.getPortId1());
      const port2 = node.getPort(transition.getPortId2());
      if (
        port1.getTrainrunSection().getTrainrun().selected() ||
        port2.getTrainrunSection().getTrainrun().selected()
      ) {
        d3.select(domObj).classed(StaticDomTags.TAG_HOVER, true);
      }
    }
    this.editorView.nodesView.hoverNodeDockable(node, null);
  }
}
