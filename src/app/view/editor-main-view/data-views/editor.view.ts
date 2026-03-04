import * as d3 from "d3";
import {NodesView} from "./nodes.view";
import {TrainrunSectionsView} from "./trainrunsections.view";
import {PreviewLineMode, TrainrunSectionPreviewLineView} from "./trainrunsection.previewline.view";
import {StaticDomTags} from "./static.dom.tags";
import {TransitionsView} from "./transitions.view";
import {Vec2D} from "../../../utils/vec2D";
import {EditorMainViewComponent} from "../editor-main-view.component";
import {UiInteractionService, ViewboxProperties} from "../../../services/ui/ui.interaction.service";
import {EditorMode} from "../../editor-menu/editor-mode";
import {ConnectionsView} from "./connections.view";
import {SVGMouseController, SVGMouseControllerObserver} from "../../util/svg.mouse.controller";
import {D3Utils} from "./d3.utils";
import {NotesView} from "./notes.view";
import {NodeService} from "../../../services/data/node.service";
import {FilterService} from "../../../services/ui/filter.service";
import {Connection} from "../../../models/connection.model";
import {Node} from "../../../models/node.model";
import {Note} from "../../../models/note.model";
import {Port} from "../../../models/port.model";
import {Trainrun} from "../../../models/trainrun.model";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {Transition} from "../../../models/transition.model";
import {
  InformSelectedTrainrunClick,
  TrainrunSectionService,
} from "../../../services/data/trainrunsection.service";
import {TrainrunService} from "../../../services/data/trainrun.service";
import {LogService} from "../../../logger/log.service";
import {NoteService} from "../../../services/data/note.service";
import {EditorKeyEvents} from "./editor.keyEvents";
import {MultiSelectRenderer} from "./multiSelectRenderer";
import {UndoService} from "../../../services/data/undo.service";
import {CopyService} from "../../../services/data/copy.service";
import {PositionTransformationService} from "../../../services/util/position.transformation.service";

import {StreckengrafikDrawingContext} from "../../../streckengrafik/model/util/streckengrafik.drawing.context";
import {LevelOfDetail, LevelOfDetailService} from "../../../services/ui/level.of.detail.service";
import {ViewportCullService} from "../../../services/ui/viewport.cull.service";
import {VersionControlService} from "../../../services/data/version-control.service";
import {
  TrafficSide,
  TrainrunCategory,
  TrainrunFrequency,
} from "../../../data-structures/business.data.structures";
import {TrainrunSectionText} from "../../../data-structures/technical.data.structures";
import {AutoLayoutService} from "../../../services/util/auto-layout.service";
import {SimpleTrainrunSectionRouter} from "src/app/services/util/trainrunsection.routing";

export class EditorView implements SVGMouseControllerObserver {
  static svgName = "graphContainer";
  editorMode: EditorMode = EditorMode.NetzgrafikEditing;
  controller: EditorMainViewComponent;
  svgMouseController: SVGMouseController;
  editorKeyEvents: EditorKeyEvents;
  rootContainer: d3.Selection<SVGElement, undefined, Element, undefined>;
  nodesView: NodesView;
  transitionsView: TransitionsView;
  connectionsView: ConnectionsView;
  trainrunSectionsView: TrainrunSectionsView;
  trainrunSectionPreviewLineView: TrainrunSectionPreviewLineView;
  multiSelectRenderer: MultiSelectRenderer;
  notesView: NotesView;
  isMultiSelectOn = false;

  addNode: ((positionX: number, positionY: number) => Node) | null = null;
  getNodePathToEnd: ((node: Node, trainrunSection: TrainrunSection) => Node[]) | null = null;
  addTrainrunSectionWithSourceTarget:
    ((sourceNode: Node, targetNode: Node, position: Vec2D) => void) | null = null;
  reconnectTrainrunSection:
    | ((
        sourceNode: Node,
        targetNode: Node,
        existingTrainrunSection: TrainrunSection,
        enforceUpdate?: boolean,
      ) => void)
    | null = null;
  deleteTrainrunSection: ((trainrunSection: TrainrunSection) => void) | null = null;
  undockTransition: ((nodeId: number, transitionId: number) => TrainrunSection | undefined) | null =
    null;
  addConnectionToNode:
    | ((
        node: Node,
        trainrunSectionFrom: TrainrunSection,
        trainrunSectionTo: TrainrunSection,
      ) => void)
    | null = null;
  removeConnectionFromNode: ((connection: Connection, node: Node) => void) | null = null;
  moveSelectedNodes:
    | ((deltaPositionX: number, deltaPositionY: number, round: number, dragEnd: boolean) => void)
    | null = null;
  moveSelectedNotes:
    | ((deltaPositionX: number, deltaPositionY: number, round: number, dragEnd: boolean) => void)
    | null = null;
  showNodeInformation: ((node: Node) => void) | null = null;
  showTrainrunInformation: ((trainrunSection: TrainrunSection, position: Vec2D) => void) | null =
    null;
  showTrainrunSectionInformation:
    | ((
        trainrunSection: TrainrunSection,
        position: Vec2D,
        trainrunSectionText?: TrainrunSectionText,
      ) => void)
    | null = null;
  showTrainrunOneWayInformation:
    ((trainrunSection: TrainrunSection, position: Vec2D) => void) | null = null;
  setTrainrunAsSelected: ((trainrun: Trainrun) => void) | null = null;
  clickSelectedTrainrunSection:
    ((informSelectedTrainrunClick: InformSelectedTrainrunClick) => void) | null = null;
  setTrainrunSectionAsSelected: ((trainrunSection: TrainrunSection) => void) | null = null;
  getSelectedTrainrun: (() => Trainrun) | null = null;
  getCumulativeTravelTime:
    | ((trainrunSection: TrainrunSection, direction: "sourceToTarget" | "targetToSource") => number)
    | null = null;
  getCumulativeTravelTimeAndNodePath:
    | ((
        trainrunSection: TrainrunSection,
        direction: "sourceToTarget" | "targetToSource",
      ) => {
        node: Node;
        sumTravelTime: number;
        trainrunSection: TrainrunSection;
      }[])
    | null = null;
  unselectAllTrainruns: (() => void) | null = null;
  unselectTrainrunSection: ((trainrunSectionId: number) => void) | null = null;
  isAnyTrainSelected: (() => boolean) | null = null;
  getConnectedTrainrunIds: ((trainrun: Trainrun) => number[]) | null = null;
  toggleNonStop: ((node: Node, t: Transition) => void) | null = null;
  getNodeFromTransition: ((t: Transition) => Node) | null = null;
  splitTrainrunIntoTwoParts: ((t: Transition) => void) | null = null;
  combineTwoTrainruns: ((n: Node, port1: Port, port2: Port) => void) | null = null;
  getNodeFromConnection: ((c: Connection) => Node) | null = null;
  isFilterTravelTimeEnabled: (() => boolean) | null = null;
  isFilterBackwardTravelTimeEnabled: (() => boolean) | null = null;
  isFilterTrainrunNameEnabled: (() => boolean) | null = null;
  isFilterDirectionArrowsEnabled: (() => boolean) | null = null;
  isFilterAsymmetryArrowsEnabled: (() => boolean) | null = null;
  isFilterArrivalDepartureTimeEnabled: (() => boolean) | null = null;
  isFilterShowNonStopTimeEnabled: (() => boolean) | null = null;
  isFilterTrainrunCategoryEnabled: ((trainrunCatgory: TrainrunCategory) => boolean) | null = null;
  isFilterConnectionsEnabled: (() => boolean) | null = null;
  isFilterTrainrunFrequencyEnabled: ((trainrunFrequency: TrainrunFrequency) => boolean) | null =
    null;
  isFilterNotesEnabled: (() => boolean) | null = null;
  replaceIntermediateStopWithNode:
    ((trainsectionId: number, stopIndex: number, nodeId: number) => void) | null = null;
  getTimeDisplayPrecision: (() => number) | null = null;
  setTimeDisplayPrecision: ((precision: number) => void) | null = null;
  selectNode: ((nodeId: number, enforceUpdate?: boolean) => void) | null = null;
  unselectNode: ((nodeId: number, enforceUpdate?: boolean) => void) | null = null;
  unselectAllNodes: ((enforceUpdate?: boolean) => void) | null = null;
  isNodeSelected: ((nodeId: number) => boolean) | null = null;
  selectNote: ((noteId: number) => void) | null = null;
  unselectNote: ((noteId: number) => void) | null = null;
  unselectAllNotes: (() => void) | null = null;
  unselectAllTrainrunSections: (() => void) | null = null;
  isNoteSelected: ((noteId: number) => boolean) | null = null;
  addNote: ((position: Vec2D, clickPosition: Vec2D) => void) | null = null;
  editNote: ((inputNoteId: number, clickPosition: Vec2D) => void) | null = null;
  getNoteLayerIndex: ((noteId: number) => number) | null = null;
  filterTrainrun: ((trainrun: Trainrun) => boolean) | null = null;
  checkFilterNode: ((node: Node) => boolean) | null = null;
  checkFilterNonStopNode: ((node: Node) => boolean) | null = null;
  displayNodesFullName: (() => boolean) | null = null;
  isNodeVisible: ((node: Node) => boolean) | null = null;
  isJunctionNode: ((node: Node) => boolean) | null = null;
  filterNode: ((node: Node) => boolean) | null = null;
  filterNote: ((note: Note) => boolean) | null = null;
  filterTrainrunsection: ((trainrunSection: TrainrunSection) => boolean) | null = null;
  isTemporaryDisableFilteringOfItemsInViewEnabled: (() => boolean) | null = null;
  moveNote:
    ((inputNoteId: number, newPosition: Vec2D, round: number, dragEnd: boolean) => void) | null =
    null;
  calculateShortestDistanceNodesFromStartingNode: ((departureNodeId: number) => void) | null = null;
  calculateShortestDistanceNodesFromStartingTrainrunSection:
    ((trainrunSectionId: number, departureNodeId: number) => void) | null = null;
  pauseUndoRecording: (() => void) | null = null;
  startUndoRecording: (() => void) | null = null;

  private elementDragging = false;

  constructor(
    controller: EditorMainViewComponent,
    private nodeService: NodeService,
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private noteService: NoteService,
    private filterService: FilterService,
    private uiInteractionService: UiInteractionService,
    private undoService: UndoService,
    private copyService: CopyService,
    private logService: LogService,
    private viewportCullService: ViewportCullService,
    private levelOfDetailService: LevelOfDetailService,
    private versionControlService: VersionControlService,
    private positionTransformationService: PositionTransformationService,
    private autoLayoutService: AutoLayoutService,
  ) {
    this.controller = controller;
    this.svgMouseController = new SVGMouseController(EditorView.svgName, this, undoService);
    this.nodesView = new NodesView(this, nodeService);
    this.transitionsView = new TransitionsView(this, trainrunSectionService);
    this.connectionsView = new ConnectionsView(this);
    this.trainrunSectionsView = new TrainrunSectionsView(this, trainrunSectionService);
    this.trainrunSectionPreviewLineView = new TrainrunSectionPreviewLineView(
      nodeService,
      filterService,
      versionControlService,
    );
    this.multiSelectRenderer = new MultiSelectRenderer();
    this.notesView = new NotesView(this);
    this.autoLayoutService = new AutoLayoutService(
      this.nodeService,
      this.uiInteractionService,
      trainrunService,
      trainrunSectionService,
      this.viewportCullService,
    );
    this.editorKeyEvents = new EditorKeyEvents(
      nodeService,
      trainrunService,
      trainrunSectionService,
      noteService,
      filterService,
      uiInteractionService,
      logService,
      undoService,
      copyService,
      this.svgMouseController,
      this.trainrunSectionPreviewLineView,
      this.positionTransformationService,
      this.autoLayoutService,
      this,
    );
  }

  destroyView() {
    this.svgMouseController.destroy();
  }

  bindAddNode(callback: (positionX: number, positionY: number) => Node) {
    this.addNode = callback;
  }

  bindGetNodePathToEnd(callback: (node: Node, trainrunSection: TrainrunSection) => Node[]) {
    this.getNodePathToEnd = callback;
  }

  bindAddTrainrunSectionWithSourceTarget(
    callback: (sourceNode: Node, targetNode: Node, position: Vec2D) => void,
  ) {
    this.addTrainrunSectionWithSourceTarget = callback;
  }

  bindReconnectTrainrunSection(
    callback: (
      sourceNode: Node,
      targetNode: Node,
      existingTrainrunSection: TrainrunSection,
      enforceUpdate?: boolean,
    ) => void,
  ) {
    this.reconnectTrainrunSection = callback;
  }

  bindDeleteTrainrunSection(callback: (trainrunSection: TrainrunSection) => void) {
    this.deleteTrainrunSection = callback;
  }

  bindUndockTransition(
    callback: (nodeId: number, transitionId: number) => TrainrunSection | undefined,
  ) {
    this.undockTransition = callback;
  }

  bindAddConnectionToNode(
    callback: (
      node: Node,
      trainrunSectionFrom: TrainrunSection,
      trainrunSectionTo: TrainrunSection,
    ) => void,
  ) {
    this.addConnectionToNode = callback;
  }

  bindRemoveConnectionFromNode(callback: (connection: Connection, node: Node) => void) {
    this.removeConnectionFromNode = callback;
  }

  bindMoveSelectedNodes(
    callback: (
      deltaPositionX: number,
      deltaPositionY: number,
      round: number,
      dragEnd: boolean,
    ) => void,
  ) {
    this.moveSelectedNodes = callback;
  }

  bindMoveSelectedNotes(
    callback: (
      deltaPositionX: number,
      deltaPositionY: number,
      round: number,
      dragEnd: boolean,
    ) => void,
  ) {
    this.moveSelectedNotes = callback;
  }

  bindShowNodeInformation(callback: (node: Node) => void) {
    this.showNodeInformation = callback;
  }

  bindShowTrainrunInformation(
    callback: (trainrunSection: TrainrunSection, position: Vec2D) => void,
  ) {
    this.showTrainrunInformation = callback;
  }

  bindShowTrainrunSectionInformation(
    callback: (
      trainrunSection: TrainrunSection,
      position: Vec2D,
      trainrunSectionText?: TrainrunSectionText,
    ) => void,
  ) {
    this.showTrainrunSectionInformation = callback;
  }

  getActiveTrafficSideType(): TrafficSide {
    return this.uiInteractionService.getActiveTrafficSideType();
  }

  bindShowTrainrunOneWayInformation(
    callback: (trainrunSection: TrainrunSection, position: Vec2D) => void,
  ) {
    this.showTrainrunOneWayInformation = callback;
  }

  bindSetTrainrunAsSelected(callback: (trainrun: Trainrun) => void) {
    this.setTrainrunAsSelected = callback;
  }

  bindClickSelectedTrainrunSection(
    callback: (informSelectedTrainrunClick: InformSelectedTrainrunClick) => void,
  ) {
    this.clickSelectedTrainrunSection = callback;
  }

  bindSetTrainrunSectionAsSelected(callback: (trainrunSection: TrainrunSection) => void) {
    this.setTrainrunSectionAsSelected = callback;
  }

  bindGetSelectedTrainrun(callback: () => Trainrun) {
    this.getSelectedTrainrun = callback;
  }

  bindGetCumulativeTravelTime(
    callback: (
      trainrunSection: TrainrunSection,
      direction: "sourceToTarget" | "targetToSource",
    ) => number,
  ) {
    this.getCumulativeTravelTime = callback;
  }

  bindGetCumulativeTravelTimeAndNodePath(
    callback: (
      trainrunSection: TrainrunSection,
      direction: "sourceToTarget" | "targetToSource",
    ) => {
      node: Node;
      sumTravelTime: number;
      trainrunSection: TrainrunSection;
    }[],
  ) {
    this.getCumulativeTravelTimeAndNodePath = callback;
  }

  bindUnselectAllTrainruns(callback: () => void) {
    this.unselectAllTrainruns = callback;
  }

  bindUnselectTrainrunSection(callback: (trainrunSectionId: number) => void) {
    this.unselectTrainrunSection = callback;
  }

  bindIsAnyTrainSelected(callback: () => boolean) {
    this.isAnyTrainSelected = callback;
  }

  bindGetConnectedTrainrunIds(callback: (trainrun: Trainrun) => number[]) {
    this.getConnectedTrainrunIds = callback;
  }

  bindToggleNonStop(callback: (node: Node, t: Transition) => void) {
    this.toggleNonStop = callback;
  }

  bindGetNodeFromTransition(callback: (t: Transition) => Node) {
    this.getNodeFromTransition = callback;
  }

  bindSplitTrainrunIntoTwoParts(callback: (t: Transition) => void) {
    this.splitTrainrunIntoTwoParts = callback;
  }

  bindCombineTwoTrainruns(callback: (n: Node, port1: Port, port2: Port) => void) {
    this.combineTwoTrainruns = callback;
  }

  bindGetNodeFromConnection(callback: (c: Connection) => Node) {
    this.getNodeFromConnection = callback;
  }

  bindIsFilterTravelTimeEnabled(callback: () => boolean) {
    this.isFilterTravelTimeEnabled = callback;
  }

  bindIsFilterBackwardTravelTimeEnabled(callback: () => boolean) {
    this.isFilterBackwardTravelTimeEnabled = callback;
  }

  bindIsfilterTrainrunNameEnabled(callback: () => boolean) {
    this.isFilterTrainrunNameEnabled = callback;
  }

  bindIsFilterDirectionArrowsEnabled(callback: () => boolean) {
    this.isFilterDirectionArrowsEnabled = callback;
  }

  bindIsFilterAsymmetryArrowsEnabled(callback: () => boolean) {
    this.isFilterAsymmetryArrowsEnabled = callback;
  }

  bindIsfilterArrivalDepartureTimeEnabled(callback: () => boolean) {
    this.isFilterArrivalDepartureTimeEnabled = callback;
  }

  bindIsFilterShowNonStopTimeEnabled(callback: () => boolean) {
    this.isFilterShowNonStopTimeEnabled = callback;
  }

  bindIsfilterTrainrunCategoryEnabled(callback: (trainrunCatgory: TrainrunCategory) => boolean) {
    this.isFilterTrainrunCategoryEnabled = callback;
  }

  bindIsTemporaryDisableFilteringOfItemsInViewEnabled(callback: () => boolean) {
    this.isTemporaryDisableFilteringOfItemsInViewEnabled = callback;
  }

  bindCheckFilterNode(callback: (node: Node) => boolean) {
    this.checkFilterNode = callback;
  }

  bindFilterNode(callback: (node: Node) => boolean) {
    this.filterNode = callback;
  }

  bindFilterNote(callback: (note: Note) => boolean) {
    this.filterNote = callback;
  }

  bindCheckFilterNonStopNode(callback: (node: Node) => boolean) {
    this.checkFilterNonStopNode = callback;
  }

  bindDisplayNodesFullName(callback: () => boolean) {
    this.displayNodesFullName = callback;
  }

  bindIsNodeVisible(callback: (node: Node) => boolean) {
    this.isNodeVisible = callback;
  }

  bindIsJunctionNode(callback: (node: Node) => boolean) {
    this.isJunctionNode = callback;
  }

  bindFilterTrainrunsection(callback: (trainrunSection: TrainrunSection) => boolean) {
    this.filterTrainrunsection = callback;
  }

  bindFilterTrainrun(callback: (trainrun: Trainrun) => boolean) {
    this.filterTrainrun = callback;
  }

  bindIsFilterTrainrunFrequencyEnabled(
    callback: (trainrunFrequency: TrainrunFrequency) => boolean,
  ) {
    this.isFilterTrainrunFrequencyEnabled = callback;
  }

  bindIsFilterNotesEnabled(callback: () => boolean) {
    this.isFilterNotesEnabled = callback;
  }

  bindIsfilterConnectionsEnabled(callback: () => boolean) {
    this.isFilterConnectionsEnabled = callback;
  }

  bindReplaceIntermediateStopWithNode(
    callback: (trainsectionId: number, stopIndex: number, nodeId: number) => void,
  ) {
    this.replaceIntermediateStopWithNode = callback;
  }

  bindGetTimeDisplayPrecision(callback: () => number) {
    this.getTimeDisplayPrecision = callback;
  }

  bindSetTimeDisplayPrecision(callback: (precision: number) => void) {
    this.setTimeDisplayPrecision = callback;
  }

  bindSelectNode(callback: (nodeId: number, enforceUpdate?: boolean) => void) {
    this.selectNode = callback;
  }

  bindSelectNote(callback: (noteId: number) => void) {
    this.selectNote = callback;
  }

  bindUnselectNode(callback: (nodeId: number, enforceUpdate?: boolean) => void) {
    this.unselectNode = callback;
  }

  bindUnselectNote(callback: (noteId: number) => void) {
    this.unselectNote = callback;
  }

  bindUnselectAllNodes(callback: (enforceUpdate?: boolean) => void) {
    this.unselectAllNodes = callback;
  }

  bindUnselectAllNotes(callback: () => void) {
    this.unselectAllNotes = callback;
  }

  bindUnselectAllTrainrunSections(callback: () => void) {
    this.unselectAllTrainrunSections = callback;
  }

  bindIsNodeSelected(callback: (nodeId: number) => boolean) {
    this.isNodeSelected = callback;
  }

  bindIsNoteSelected(callback: (noteId: number) => boolean) {
    this.isNoteSelected = callback;
  }

  bindAddNote(callback: (position: Vec2D, clickPosition: Vec2D) => void) {
    this.addNote = callback;
  }

  bindEditNote(callback: (inputNoteId: number, clickPosition: Vec2D) => void) {
    this.editNote = callback;
  }

  bindMoveNote(
    callback: (inputNoteId: number, newPosition: Vec2D, round: number, dragEnd: boolean) => void,
  ) {
    this.moveNote = callback;
  }

  bindGetNoteLayerIndex(callback: (noteId: number) => number) {
    this.getNoteLayerIndex = callback;
  }

  bindCalculateShortestDistanceNodesFromStartingNode(callback: (departureNodeId: number) => void) {
    this.calculateShortestDistanceNodesFromStartingNode = callback;
  }

  bindCalculateShortestDistanceNodesFromStartingTrainrunSection(
    callback: (trainrunSectionId: number, departureNodeId: number) => void,
  ) {
    this.calculateShortestDistanceNodesFromStartingTrainrunSection = callback;
  }

  bindPauseUndoRecording(callback: () => void) {
    this.pauseUndoRecording = callback;
  }

  bindStartUndoRecording(callback: () => void) {
    this.startUndoRecording = callback;
  }

  initView() {
    this.rootContainer = this.svgMouseController.init(
      this.uiInteractionService.getViewboxProperties(EditorView.svgName),
    );
    this.notesView.setGroup(this.rootContainer.append(StaticDomTags.GROUP_SVG));
    this.nodesView.setGroup(this.rootContainer.append(StaticDomTags.GROUP_SVG));
    this.transitionsView.setGroup(this.rootContainer.append(StaticDomTags.GROUP_SVG));
    this.trainrunSectionsView.setGroup(this.rootContainer.append(StaticDomTags.GROUP_SVG));
    this.connectionsView.setGroup(this.rootContainer.append(StaticDomTags.GROUP_SVG));
    TrainrunSectionPreviewLineView.setGroup(this.rootContainer);
    TrainrunSectionPreviewLineView.setConnectionGroup(this.rootContainer);
    MultiSelectRenderer.setGroup(this.rootContainer);
  }

  onEarlyReturnFromMousemove(event: MouseEvent): boolean {
    return this.trainrunSectionPreviewLineView.updatePreviewLine(event);
  }

  onStartMultiSelect() {
    if (this.trainrunSectionPreviewLineView.isDragging()) {
      return;
    }
    this.isMultiSelectOn = true;
    this.uiInteractionService.setEditorMode(EditorMode.MultiNodeMoving);
    this.multiSelectRenderer.displayBox();
  }

  updateMultiSelect(topLeft: Vec2D, bottomRight: Vec2D) {
    if (!this.isMultiSelectOn) {
      return;
    }

    const allNodesOfInterest = this.nodeService.getNodes().filter((n: Node) => {
      this.nodeService.unselectNode(n.getId(), false);
      if (this.filterService.filterNode(n) && !n.getIsCollapsed()) {
        if (
          topLeft.getX() < n.getPositionX() &&
          n.getPositionX() + n.getNodeWidth() < bottomRight.getX()
        ) {
          if (
            topLeft.getY() < n.getPositionY() &&
            n.getPositionY() + n.getNodeHeight() < bottomRight.getY()
          ) {
            return true;
          }
        }
      }
      return false;
    });
    allNodesOfInterest.forEach((n: Node) => {
      this.nodeService.selectNode(n.getId(), false);
    });

    const allNotesOfInterest = this.noteService.getNotes().filter((n: Note) => {
      this.noteService.unselectNote(n.getId(), false);
      if (this.filterService.filterNote(n)) {
        if (
          topLeft.getX() < n.getPositionX() &&
          n.getPositionX() + n.getWidth() < bottomRight.getX()
        ) {
          if (
            topLeft.getY() < n.getPositionY() &&
            n.getPositionY() + n.getHeight() < bottomRight.getY()
          ) {
            return true;
          }
        }
      }
      return false;
    });
    allNotesOfInterest.forEach((n: Note) => {
      this.noteService.selectNote(n.getId(), false);
    });

    if (allNodesOfInterest.length === 0 && allNotesOfInterest.length === 0) {
      // try to use multi select trainrunsections
      this.trainrunSectionService.getTrainrunSections().forEach((ts) => {
        ts.unselect();
        const p = SimpleTrainrunSectionRouter.computePath(ts);
        const minX = Math.min(p[1].getX(), p[2].getX());
        const maxX = Math.max(p[1].getX(), p[2].getX());
        const minY = Math.min(p[1].getY(), p[2].getY());
        const maxY = Math.max(p[1].getY(), p[2].getY());
        const center = Vec2D.scale(Vec2D.add(p[1], p[2]), 0.5);

        if (this.filterService.filterTrainrun(ts.getTrainrun()) && ts.areBothNodesExpanded()) {
          if (
            topLeft.getX() < center.getX() &&
            center.getX() < bottomRight.getX() &&
            topLeft.getY() < center.getY() &&
            center.getY() < bottomRight.getY() &&
            ((minX < topLeft.getX() && maxX > bottomRight.getX()) ||
              (minY < topLeft.getY() && maxY > bottomRight.getY()))
          ) {
            // Select the trainrun section
            ts.select();
          }
        }
      });

      this.trainrunSectionService.trainrunSectionsUpdated();
    } else {
      this.trainrunSectionService.unselectAllTrainrunSections();
    }

    this.nodeService.nodesUpdated();
    this.noteService.notesUpdated();
    this.multiSelectRenderer.updateBox(topLeft, bottomRight);
  }

  onEndMultiSelect() {
    if (!this.isMultiSelectOn) {
      return;
    }
    this.isMultiSelectOn = false;
    this.multiSelectRenderer.hideBox();

    if (
      this.nodeService.getSelectedNode() === null &&
      this.noteService.getSelectedNote() === null &&
      this.trainrunSectionService.getSelectedTrainrunSection() === null
    ) {
      this.uiInteractionService.setEditorMode(EditorMode.NetzgrafikEditing);
      return;
    }
  }

  onGraphContainerMouseup(event: MouseEvent, mousePosition: Vec2D, onPanning: boolean) {
    if (this.isMultiSelectOn) {
      return;
    }
    if (!this.trainrunSectionPreviewLineView.isDragging() && !onPanning) {
      const domObj = event.target;
      if (!(domObj instanceof SVGElement)) {
        throw new Error("Mouse event's target is not an SVG element");
      }
      if (
        event.button === 0 &&
        this.editorMode === EditorMode.TopologyEditing &&
        d3.select(domObj).attr("id") === EditorView.svgName
      ) {
        this.uiInteractionService.setEditorMode(EditorMode.NetzgrafikEditing);
        this.addNode(mousePosition.getX(), mousePosition.getY());
        this.uiInteractionService.showNodeBaseData();
      } else if (this.isAnyTrainSelected()) {
        this.unselectAllTrainruns();
      } else {
        this.nodeService.unselectAllNodes();
        this.uiInteractionService.closeNodeBaseData();
      }
      if (
        event.button === 0 &&
        this.editorMode === EditorMode.MultiNodeMoving &&
        d3.select(domObj).attr("id") === EditorView.svgName
      ) {
        this.unselectAllNodes();
        this.unselectAllNotes();
        this.unselectAllTrainrunSections();
        this.uiInteractionService.setEditorMode(EditorMode.NetzgrafikEditing);
      }
      if (
        event.button === 0 &&
        this.editorMode === EditorMode.NoteEditing &&
        d3.select(domObj).attr("id") === EditorView.svgName
      ) {
        const clickPosition = new Vec2D(
          event.pageX + Note.DEFAULT_NOTE_WIDTH / 2,
          event.pageY + Note.DEFAULT_NOTE_HEIGHT / 2,
        );
        this.addNote(mousePosition, clickPosition);
        this.uiInteractionService.setEditorMode(EditorMode.NetzgrafikEditing);
      }
    }

    if (this.trainrunSectionPreviewLineView.getExistingTrainrunSection() !== null) {
      this.deleteTrainrunSection(this.trainrunSectionPreviewLineView.getExistingTrainrunSection());
    }

    const dragTransitionInfo = this.trainrunSectionPreviewLineView.getDragTransitionInfo();
    if (dragTransitionInfo !== null) {
      D3Utils.removeGrayout(dragTransitionInfo.tsvo1);
      D3Utils.removeGrayout(dragTransitionInfo.tsvo2);
      this.undockTransition(dragTransitionInfo.node.getId(), dragTransitionInfo.transition.getId());
    }

    this.trainrunSectionPreviewLineView.stopPreviewLine();
  }

  onCtrlKeyChanged(state: boolean) {
    if (
      this.trainrunSectionPreviewLineView.getMode() === PreviewLineMode.DragExistingTrainrunSection
    ) {
      d3.selectAll(StaticDomTags.PREVIEW_CONNECTION_LINE_DOM_REF).classed(
        StaticDomTags.TAG_CTRLKEY,
        state && this.trainrunSectionPreviewLineView.canCombineTwoTrainruns(),
      );
    }
  }

  onScaleNetzgrafik(factor: number, scaleCenter: Vec2D) {
    this.positionTransformationService.scaleNetzgrafikArea(factor, scaleCenter, EditorView.svgName);
  }

  zoomFactorChanged(newZoomFactor: number) {
    this.controller.zoomFactorChanged(newZoomFactor);
    this.viewportCullService.onViewportChangeUpdateRendering(true);
  }

  onViewboxChanged(viewboxProperties: ViewboxProperties) {
    this.uiInteractionService.setViewboxProperties(EditorView.svgName, viewboxProperties);
    this.viewportCullService.onViewportChangeUpdateRendering(true);
  }

  doCullCheckPositionsInViewport(positions: Vec2D[], extraPixelsIn = 32): boolean {
    return this.viewportCullService.cullCheckPositionsInViewport(
      positions,
      EditorView.svgName,
      extraPixelsIn,
    );
  }

  getLevelOfDetail() {
    return this.levelOfDetailService.getLevelOfDetail();
  }

  skipElementLevelOfDetail(lod: LevelOfDetail): boolean {
    return lod < this.getLevelOfDetail();
  }

  setEditorMode(mode: EditorMode) {
    if (
      mode !== EditorMode.StreckengrafikEditing &&
      mode !== EditorMode.NetzgrafikEditing &&
      mode !== EditorMode.OriginDestination
    ) {
      this.unselectAllNodes();
      this.unselectAllNotes();
      this.unselectAllTrainruns();
      this.unselectAllTrainrunSections();
    }
    this.editorMode = mode;

    if (
      this.editorMode === EditorMode.NetzgrafikEditing ||
      this.editorMode === EditorMode.StreckengrafikEditing ||
      this.editorMode === EditorMode.MultiNodeMoving
    ) {
      this.editorKeyEvents.activateMousekeyDownHandler(this.editorMode);
    } else {
      this.editorKeyEvents.deactivateMousekeyDownHandler();
    }
    this.changeCursor();
    this.displayEditorMode();
  }

  postDisplayRendering() {
    StreckengrafikDrawingContext.updateDrawingContainerData();

    if (this.isElementDragging()) {
      return;
    }
    if (this.trainrunSectionPreviewLineView.isDragging()) {
      return;
    }
    this.displayEditorMode();
  }

  enableElementDragging() {
    this.elementDragging = true;
  }

  disableElementDragging() {
    this.elementDragging = false;
  }

  isElementDragging(): boolean {
    return this.elementDragging;
  }

  private displayEditorMode() {
    D3Utils.disableSpecialEditing();
    D3Utils.resetShortestDistanceRenderer();

    if (
      this.editorMode === EditorMode.NetzgrafikEditing ||
      this.editorMode === EditorMode.StreckengrafikEditing
    ) {
      return;
    } else {
      if (this.editorMode === EditorMode.Analytics) {
        D3Utils.enableShortestDistanceRenderer();
        return;
      }
      D3Utils.enableSpecialEditing(
        this.editorMode === EditorMode.TopologyEditing ||
          this.editorMode === EditorMode.NoteEditing,
      );
    }
  }

  private changeCursor() {
    if (
      this.editorMode === EditorMode.TopologyEditing ||
      this.editorMode === EditorMode.NoteEditing
    ) {
      const el = d3.select("#" + EditorView.svgName);
      el.classed("ShowCellCursor", true);
    } else {
      const el = d3.select("#" + EditorView.svgName);
      el.classed("ShowCellCursor", false);
    }
  }
}
