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
import {Node} from "../../../models/node.model";
import {Note} from "../../../models/note.model";
import {TrainrunSectionService} from "../../../services/data/trainrunsection.service";
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

export class EditorView implements SVGMouseControllerObserver {
  static svgName = "graphContainer";
  editorMode: EditorMode = EditorMode.NetzgrafikEditing;
  controller: EditorMainViewComponent;
  svgMouseController: SVGMouseController;
  editorKeyEvents: EditorKeyEvents;
  rootContainer: any;
  nodesView: NodesView;
  transitionsView: TransitionsView;
  connectionsView: ConnectionsView;
  trainrunSectionsView: TrainrunSectionsView;
  trainrunSectionPreviewLineView: TrainrunSectionPreviewLineView;
  multiSelectRenderer: MultiSelectRenderer;
  notesView: NotesView;
  isMultiSelectOn = false;

  addNode = null;
  getNodePathToEnd = null;
  addTrainrunSectionWithSourceTarget = null;
  reconnectTrainrunSection = null;
  deleteTrainrunSection = null;
  undockTransition = null;
  addConnectionToNode = null;
  removeConnectionFromNode = null;
  moveSelectedNodes = null;
  moveSelectedNotes = null;
  showNodeInformation = null;
  showTrainrunInformation = null;
  showTrainrunSectionInformation = null;
  showTrainrunOneWayInformation = null;
  setTrainrunAsSelected = null;
  clickSelectedTrainrunSection = null;
  setTrainrunSectionAsSelected = null;
  getSelectedTrainrun = null;
  getCumulativeTravelTime = null;
  getCumulativeTravelTimeAndNodePath = null;
  unselectAllTrainruns = null;
  isAnyTrainSelected = null;
  getConnectedTrainrunIds = null;
  toggleNonStop = null;
  getNodeFromTransition = null;
  splitTrainrunIntoTwoParts = null;
  combineTwoTrainruns = null;
  getNodeFromConnection = null;
  isFilterTravelTimeEnabled = null;
  isFilterTrainrunNameEnabled = null;
  isFilterDirectionArrowsEnabled = null;
  isFilterArrivalDepartureTimeEnabled = null;
  isFilterShowNonStopTimeEnabled = null;
  isFilterTrainrunCategoryEnabled = null;
  isFilterConnectionsEnabled = null;
  isFilterTrainrunFrequencyEnabled = null;
  isFilterNotesEnabled = null;
  replaceIntermediateStopWithNode = null;
  getTimeDisplayPrecision = null;
  setTimeDisplayPrecision = null;
  selectNode = null;
  unselectNode = null;
  unselectAllNodes = null;
  isNodeSelected = null;
  selectNote = null;
  unselectNote = null;
  unselectAllNotes = null;
  isNoteSelected = null;
  addNote = null;
  editNote = null;
  getNoteLayerIndex = null;
  filterTrainrun = null;
  checkFilterNode = null;
  checkFilterNonStopNode = null;
  isNodeVisible = null;
  isJunctionNode = null;
  filterNode = null;
  filterNote = null;
  filterTrainrunsection = null;
  isTemporaryDisableFilteringOfItemsInViewEnabled = null;
  moveNote = null;
  calculateShortestDistanceNodesFromStartingNode = null;
  calculateShortestDistanceNodesFromStartingTrainrunSection = null;
  pauseUndoRecording = null;
  startUndoRecording = null;

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
  ) {
    this.controller = controller;
    this.svgMouseController = new SVGMouseController(EditorView.svgName, this, undoService);
    this.nodesView = new NodesView(this);
    this.transitionsView = new TransitionsView(this);
    this.connectionsView = new ConnectionsView(this);
    this.trainrunSectionsView = new TrainrunSectionsView(this, trainrunSectionService);
    this.trainrunSectionPreviewLineView = new TrainrunSectionPreviewLineView(
      nodeService,
      filterService,
      versionControlService,
    );
    this.multiSelectRenderer = new MultiSelectRenderer();
    this.notesView = new NotesView(this);
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
    );
  }

  destroyView() {
    this.svgMouseController.destroy();
  }

  bindAddNode(callback) {
    this.addNode = callback;
  }

  bindGetNodePathToEnd(callback) {
    this.getNodePathToEnd = callback;
  }

  bindAddTrainrunSectionWithSourceTarget(callback) {
    this.addTrainrunSectionWithSourceTarget = callback;
  }

  bindReconnectTrainrunSection(callback) {
    this.reconnectTrainrunSection = callback;
  }

  bindDeleteTrainrunSection(callback) {
    this.deleteTrainrunSection = callback;
  }

  bindUndockTransition(callback) {
    this.undockTransition = callback;
  }

  bindAddConnectionToNode(callback) {
    this.addConnectionToNode = callback;
  }

  bindRemoveConnectionFromNode(callback) {
    this.removeConnectionFromNode = callback;
  }

  bindMoveSelectedNodes(callback) {
    this.moveSelectedNodes = callback;
  }

  bindMoveSelectedNotes(callback) {
    this.moveSelectedNotes = callback;
  }

  bindShowNodeInformation(callback) {
    this.showNodeInformation = callback;
  }

  bindShowTrainrunInformation(callback) {
    this.showTrainrunInformation = callback;
  }

  bindShowTrainrunSectionInformation(callback) {
    this.showTrainrunSectionInformation = callback;
  }

  bindShowTrainrunOneWayInformation(callback) {
    this.showTrainrunOneWayInformation = callback;
  }

  bindSetTrainrunAsSelected(callback) {
    this.setTrainrunAsSelected = callback;
  }

  bindClickSelectedTrainrunSection(callback) {
    this.clickSelectedTrainrunSection = callback;
  }

  bindSetTrainrunSectionAsSelected(callback) {
    this.setTrainrunSectionAsSelected = callback;
  }

  bindGetSelectedTrainrun(callback) {
    this.getSelectedTrainrun = callback;
  }

  bindGetCumulativeTravelTime(callback) {
    this.getCumulativeTravelTime = callback;
  }

  bindGetCumulativeTravelTimeAndNodePath(callback) {
    this.getCumulativeTravelTimeAndNodePath = callback;
  }

  bindUnselectAllTrainruns(callback) {
    this.unselectAllTrainruns = callback;
  }

  bindIsAnyTrainSelected(callback) {
    this.isAnyTrainSelected = callback;
  }

  bindGetConnectedTrainrunIds(callback) {
    this.getConnectedTrainrunIds = callback;
  }

  bindToggleNonStop(callback) {
    this.toggleNonStop = callback;
  }

  bindGetNodeFromTransition(callback) {
    this.getNodeFromTransition = callback;
  }

  bindSplitTrainrunIntoTwoParts(callback) {
    this.splitTrainrunIntoTwoParts = callback;
  }

  bindCombineTwoTrainruns(callback) {
    this.combineTwoTrainruns = callback;
  }

  bindGetNodeFromConnection(callback) {
    this.getNodeFromConnection = callback;
  }

  bindIsFilterTravelTimeEnabled(callback) {
    this.isFilterTravelTimeEnabled = callback;
  }

  bindIsfilterTrainrunNameEnabled(callback) {
    this.isFilterTrainrunNameEnabled = callback;
  }

  bindIsFilterDirectionArrowsEnabled(callback) {
    this.isFilterDirectionArrowsEnabled = callback;
  }

  bindIsfilterArrivalDepartureTimeEnabled(callback) {
    this.isFilterArrivalDepartureTimeEnabled = callback;
  }

  bindIsFilterShowNonStopTimeEnabled(callback) {
    this.isFilterShowNonStopTimeEnabled = callback;
  }

  bindIsfilterTrainrunCategoryEnabled(callback) {
    this.isFilterTrainrunCategoryEnabled = callback;
  }

  bindIsTemporaryDisableFilteringOfItemsInViewEnabled(callback) {
    this.isTemporaryDisableFilteringOfItemsInViewEnabled = callback;
  }

  bindCheckFilterNode(callback) {
    this.checkFilterNode = callback;
  }

  bindFilterNode(callback) {
    this.filterNode = callback;
  }

  bindFilterNote(callback) {
    this.filterNote = callback;
  }

  bindCheckFilterNonStopNode(callback) {
    this.checkFilterNonStopNode = callback;
  }

  bindIsNodeVisible(callback) {
    this.isNodeVisible = callback;
  }

  bindIsJunctionNode(callback) {
    this.isJunctionNode = callback;
  }

  bindFilterTrainrunsection(callback) {
    this.filterTrainrunsection = callback;
  }

  bindFilterTrainrun(callback) {
    this.filterTrainrun = callback;
  }

  bindIsFilterTrainrunFrequencyEnabled(callback) {
    this.isFilterTrainrunFrequencyEnabled = callback;
  }

  bindIsFilterNotesEnabled(callback) {
    this.isFilterNotesEnabled = callback;
  }

  bindIsfilterConnectionsEnabled(callback) {
    this.isFilterConnectionsEnabled = callback;
  }

  bindReplaceIntermediateStopWithNode(callback) {
    this.replaceIntermediateStopWithNode = callback;
  }

  bindGetTimeDisplayPrecision(callback) {
    this.getTimeDisplayPrecision = callback;
  }

  bindSetTimeDisplayPrecision(callback) {
    this.setTimeDisplayPrecision = callback;
  }

  bindSelectNode(callback) {
    this.selectNode = callback;
  }

  bindSelectNote(callback) {
    this.selectNote = callback;
  }

  bindUnselectNode(callback) {
    this.unselectNode = callback;
  }

  bindUnselectNote(callback) {
    this.unselectNote = callback;
  }

  bindUnselectAllNodes(callback) {
    this.unselectAllNodes = callback;
  }

  bindUnselectAllNotes(callback) {
    this.unselectAllNotes = callback;
  }

  bindIsNodeSelected(callback) {
    this.isNodeSelected = callback;
  }

  bindIsNoteSelected(callback) {
    this.isNoteSelected = callback;
  }

  bindAddNote(callback) {
    this.addNote = callback;
  }

  bindEditNote(callback) {
    this.editNote = callback;
  }

  bindMoveNote(callback) {
    this.moveNote = callback;
  }

  bindGetNoteLayerIndex(callback) {
    this.getNoteLayerIndex = callback;
  }

  bindCalculateShortestDistanceNodesFromStartingNode(callback) {
    this.calculateShortestDistanceNodesFromStartingNode = callback;
  }

  bindCalculateShortestDistanceNodesFromStartingTrainrunSection(callback) {
    this.calculateShortestDistanceNodesFromStartingTrainrunSection = callback;
  }

  bindPauseUndoRecording(callback) {
    this.pauseUndoRecording = callback;
  }

  bindStartUndoRecording(callback) {
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

  onEarlyReturnFromMousemove(): boolean {
    return this.trainrunSectionPreviewLineView.updatePreviewLine();
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
      if (this.filterService.filterNode(n)) {
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
      this.noteService.getSelectedNote() === null
    ) {
      this.uiInteractionService.setEditorMode(EditorMode.NetzgrafikEditing);
      return;
    }
  }

  onGraphContainerMouseup(mousePosition: Vec2D, onPanning: boolean) {
    if (this.isMultiSelectOn) {
      return;
    }
    if (!this.trainrunSectionPreviewLineView.isDragging() && !onPanning) {
      if (
        d3.event.button === 0 &&
        this.editorMode === EditorMode.TopologyEditing &&
        d3.select(d3.event.target).attr("id") === EditorView.svgName
      ) {
        this.uiInteractionService.setEditorMode(EditorMode.NetzgrafikEditing);
        this.addNode(mousePosition.getX(), mousePosition.getY());
        this.uiInteractionService.showNodeStammdaten();
      } else if (this.isAnyTrainSelected()) {
        this.unselectAllTrainruns();
      } else {
        this.nodeService.unselectAllNodes();
        this.uiInteractionService.closeNodeStammdaten();
      }
      if (
        d3.event.button === 0 &&
        this.editorMode === EditorMode.MultiNodeMoving &&
        d3.select(d3.event.target).attr("id") === EditorView.svgName
      ) {
        this.unselectAllNodes();
        this.unselectAllNotes();
        this.uiInteractionService.setEditorMode(EditorMode.NetzgrafikEditing);
      }
      if (
        d3.event.button === 0 &&
        this.editorMode === EditorMode.NoteEditing &&
        d3.select(d3.event.target).attr("id") === EditorView.svgName
      ) {
        const clickPosition = new Vec2D(
          d3.event.pageX + Note.DEFAULT_NOTE_WIDTH / 2,
          d3.event.pageY + Note.DEFAULT_NOTE_HEIGHT / 2,
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
      D3Utils.removeGrayout(dragTransitionInfo.trainrunSection1);
      D3Utils.removeGrayout(dragTransitionInfo.trainrunSection2);
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
