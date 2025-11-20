import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import {Node} from "../../models/node.model";
import {Trainrun} from "../../models/trainrun.model";
import {Vec2D} from "../../utils/vec2D";
import {NodeService} from "../../services/data/node.service";
import {
  InformSelectedTrainrunClick,
  TrainrunSectionService,
} from "../../services/data/trainrunsection.service";
import {TrainrunService} from "../../services/data/trainrun.service";
import {EditorView} from "./data-views/editor.view";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {Connection} from "../../models/connection.model";
import {Transition} from "../../models/transition.model";
import {FilterService} from "../../services/ui/filter.service";
import {TrainrunCategory, TrainrunFrequency} from "../../data-structures/business.data.structures";
import {
  TrainrunDialogParameter,
  TrainrunDialogType,
} from "../dialogs/trainrun-and-section-dialog/trainrun-and-section-dialog.component";
import {TrainrunSectionText} from "../../data-structures/technical.data.structures";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {NoteService} from "../../services/data/note.service";
import {NoteDialogParameter, NoteDialogType} from "../dialogs/note-dialog/note-dialog.component";
import {AnalyticsService} from "../../services/analytics/analytics.service";
import {Note} from "../../models/note.model";
import {LogService} from "../../logger/log.service";
import {UndoService} from "../../services/data/undo.service";
import {CopyService} from "../../services/data/copy.service";
import {StreckengrafikDrawingContext} from "../../streckengrafik/model/util/streckengrafik.drawing.context";
import {TravelTimeCreationEstimatorType} from "../themes/editor-trainrun-traveltime-creator-type";
import {Port} from "../../models/port.model";
import {LevelOfDetailService} from "../../services/ui/level.of.detail.service";
import {ViewportCullService} from "../../services/ui/viewport.cull.service";
import {VersionControlService} from "../../services/data/version-control.service";
import {PositionTransformationService} from "../../services/util/position.transformation.service";

@Component({
  selector: "sbb-editor-main-view",
  templateUrl: "./editor-main-view.component.html",
  styleUrls: ["./editor-main-view.component.scss"],
})
export class EditorMainViewComponent implements AfterViewInit, OnDestroy {
  /* MVC/MVVM structure:
   * This class represents the Controller respectively the ViewModel which binds the callbacks from the view to the model (service)
   * The technique implemented here is described here: https://www.carloscaballero.io/understanding-mvc-for-frontend-typescript/
   * The observable data service is described here: https://coryrylan.com/blog/angular-observable-data-services
   * The MVVM usually applied in angular applications is described here: https://scotch.io/tutorials/mvc-in-an-angular-world */

  @ViewChild("graphContainer")
  graphContainer: ElementRef;

  editorView: EditorView;

  private destroyed = new Subject<void>();

  constructor(
    private nodeService: NodeService,
    private trainrunSectionService: TrainrunSectionService,
    private trainrunService: TrainrunService,
    private filterService: FilterService,
    private uiInteractionService: UiInteractionService,
    private noteService: NoteService,
    private analyticsService: AnalyticsService,
    private undoService: UndoService,
    private copyService: CopyService,
    private logService: LogService,
    private viewportCullService: ViewportCullService,
    private levelOfDetailService: LevelOfDetailService,
    private versionControlService: VersionControlService,
    private positionTransformationService: PositionTransformationService,
  ) {
    this.editorView = new EditorView(
      this,
      nodeService,
      trainrunService,
      trainrunSectionService,
      noteService,
      filterService,
      uiInteractionService,
      undoService,
      copyService,
      logService,
      viewportCullService,
      levelOfDetailService,
      versionControlService,
      positionTransformationService,
    );
    this.uiInteractionService.zoomInObservable
      .pipe(takeUntil(this.destroyed))
      .subscribe((zoomCenter: Vec2D) => this.editorView.svgMouseController.zoomIn(zoomCenter));
    this.uiInteractionService.zoomOutObservable
      .pipe(takeUntil(this.destroyed))
      .subscribe((zoomCenter: Vec2D) => this.editorView.svgMouseController.zoomOut(zoomCenter));
    this.uiInteractionService.zoomResetObservable
      .pipe(takeUntil(this.destroyed))
      .subscribe((zoomCenter: Vec2D) => this.editorView.svgMouseController.zoomReset(zoomCenter));
    this.uiInteractionService.setEditorModeObservable
      .pipe(takeUntil(this.destroyed))
      .subscribe((mode: number) => this.editorView.setEditorMode(mode));
    this.uiInteractionService.moveNetzgrafikEditorViewFocalPointObservable
      .pipe(takeUntil(this.destroyed))
      .subscribe((center: Vec2D) => this.moveNetzgrafikEditorViewFocalPoint(center));
  }

  @HostListener("window:resize", ["$event"])
  getScreenSize() {
    this.editorView.svgMouseController.resize(window.innerWidth, window.innerHeight);
    StreckengrafikDrawingContext.updateDrawingContainerData();
  }

  ngAfterViewInit(): void {
    this.init();
  }

  init() {
    this.editorView.initView();
    this.bindViewToServices();
    this.subscribeViewToServices();
  }

  zoomFactorChanged(zoomFactor: number) {
    this.uiInteractionService.zoomFactorChanged(zoomFactor);
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
    this.editorView.destroyView();
  }

  moveNetzgrafikEditorViewFocalPoint(center: Vec2D) {
    this.editorView.svgMouseController.moveNetzgrafikEditorViewFocalPoint(center);
  }

  showEditNote(note: Note, position: Vec2D) {
    this.noteService.moveNoteToFront(note.getId());

    const parameter = new NoteDialogParameter(NoteDialogType.NOTE_DIALOG, position);
    parameter.noteFormComponentModel = {
      id: note.getId(),
      noteTitle: note.getTitle(),
      noteText: note.getText(),
      noteHeight: note.getHeight(),
      noteWidth: note.getWidth(),
      notePositionX: note.getPositionX(),
      notePositionY: note.getPositionY(),
      saveNoteCallback: (noteId, noteTitle, noteText, noteHeight, noteWidth) =>
        this.noteService.editNote(noteId, noteTitle, noteText, noteHeight, noteWidth),
      deleteNoteCallback: (noteId) => this.noteService.deleteNote(noteId),
      updateNoteCallback: () => this.noteService.notesUpdated(),
    };
    this.uiInteractionService.showNoteDialogSubject.next(parameter);
  }

  bindViewToServices() {
    this.editorView.bindAddNode((positionX: number, positionY: number) =>
      this.nodeService.addNodeWithPosition(positionX, positionY),
    );

    this.editorView.bindGetNodePathToEnd((node: Node, trainrunSection: TrainrunSection) =>
      this.trainrunService.getNodePathToEnd(node, trainrunSection),
    );

    this.editorView.bindMoveSelectedNodes(
      (deltaPositionX: number, deltaPositionY: number, round: number, dragEnd: boolean) =>
        this.nodeService.moveSelectedNodes(deltaPositionX, deltaPositionY, round, dragEnd),
    );

    this.editorView.bindMoveSelectedNotes(
      (deltaPositionX: number, deltaPositionY: number, round: number, dragEnd: boolean) =>
        this.noteService.moveSelectedNotes(deltaPositionX, deltaPositionY, round, dragEnd),
    );

    this.editorView.bindAddTrainrunSectionWithSourceTarget(
      (sourceNode: Node, targetNode: Node, position: Vec2D) => {
        const isTrainrunSelected = this.trainrunService.getSelectedTrainrun() !== null;
        this.trainrunSectionService.createTrainrunSection(
          sourceNode.getId(),
          targetNode.getId(),
          this.uiInteractionService.getActiveTravelTimeCreationEstimatorType() ===
            TravelTimeCreationEstimatorType.RetrieveFromEdge,
        );
        if (!isTrainrunSelected) {
          const parameter = new TrainrunDialogParameter(
            TrainrunDialogType.TRAINRUN_DIALOG,
            position,
          );
          this.uiInteractionService.showTrainrunDialog(parameter);
        }
      },
    );
    this.editorView.bindReconnectTrainrunSection(
      (
        sourceNode: Node,
        targetNode: Node,
        existingTrainrunSection: TrainrunSection,
        enforceUpdate = true,
      ) => {
        this.trainrunSectionService.reconnectTrainrunSection(
          sourceNode.getId(),
          targetNode.getId(),
          existingTrainrunSection.getId(),
          existingTrainrunSection.getTargetNodeId(),
          existingTrainrunSection.getSourceNodeId(),
          enforceUpdate,
        );
      },
    );
    this.editorView.bindDeleteTrainrunSection((trainrunSection: TrainrunSection) =>
      this.trainrunSectionService.deleteTrainrunSection(trainrunSection.getId()),
    );
    this.editorView.bindSetTrainrunSectionAsSelected((trainrunSection: TrainrunSection) => {
      this.trainrunService.setTrainrunAsSelected(trainrunSection.getTrainrun().getId());
      this.trainrunSectionService.setTrainrunSectionAsSelected(trainrunSection.getId());
    });
    this.editorView.bindUndockTransition((nodeId: number, transitionId: number) =>
      this.nodeService.undockTransition(nodeId, transitionId),
    );
    this.editorView.bindSetTrainrunAsSelected((trainrun: Trainrun) =>
      this.trainrunService.setTrainrunAsSelected(trainrun.getId()),
    );

    this.editorView.bindClickSelectedTrainrunSection(
      (informSelectedTrainrunClick: InformSelectedTrainrunClick) =>
        this.trainrunSectionService.clickSelectedTrainrunSection(informSelectedTrainrunClick),
    );

    this.editorView.bindGetSelectedTrainrun(() => this.trainrunService.getSelectedTrainrun());

    this.editorView.bindGetCumulativeTravelTime((trainrunSection: TrainrunSection) =>
      this.trainrunService.getCumulativeTravelTime(trainrunSection),
    );

    this.editorView.bindGetCumulativeTravelTimeAndNodePath((trainrunSection: TrainrunSection) =>
      this.trainrunService.getCumulativeTravelTimeAndNodePath(trainrunSection),
    );

    this.editorView.bindAddConnectionToNode(
      (node: Node, trainrunSectionFrom: TrainrunSection, trainrunSectionTo: TrainrunSection) => {
        this.nodeService.addConnectionToNode(
          node.getId(),
          trainrunSectionFrom.getId(),
          trainrunSectionTo.getId(),
        );
      },
    );

    this.editorView.bindRemoveConnectionFromNode((connection: Connection, node: Node) =>
      this.nodeService.removeConnectionFromNode(node.getId(), connection.getId()),
    );

    this.editorView.bindShowNodeInformation(async (node: Node) => {
      this.uiInteractionService.updateNodeStammdaten();
      await new Promise((f) => setTimeout(f, 50));
      const selectedNode = this.nodeService.getSelectedNode();
      if (selectedNode !== null) {
        if (selectedNode.getId() === node.getId()) {
          this.nodeService.unselectAllNodes();
          this.uiInteractionService.closeNodeStammdaten();
        } else {
          this.nodeService.setSingleNodeAsSelected(node.getId());
          this.uiInteractionService.showNodeStammdaten();
        }
      } else {
        this.nodeService.setSingleNodeAsSelected(node.getId());
        this.uiInteractionService.showNodeStammdaten();
      }
    });

    this.editorView.bindShowTrainrunInformation(
      (trainrunSection: TrainrunSection, position: Vec2D) => {
        this.trainrunService.setTrainrunAsSelected(trainrunSection.getTrainrun().getId());
        this.trainrunSectionService.setTrainrunSectionAsSelected(trainrunSection.getId());
        const parameter = new TrainrunDialogParameter(TrainrunDialogType.TRAINRUN_DIALOG, position);
        this.uiInteractionService.showTrainrunDialog(parameter);
      },
    );

    this.editorView.bindShowTrainrunSectionInformation(
      (
        trainrunSection: TrainrunSection,
        position: Vec2D,
        trainrunSectionText: TrainrunSectionText,
      ) => {
        this.trainrunService.setTrainrunAsSelected(trainrunSection.getTrainrun().getId());
        this.trainrunSectionService.setTrainrunSectionAsSelected(trainrunSection.getId());
        const parameter = new TrainrunDialogParameter(
          TrainrunDialogType.TRAINRUN_SECTION_DIALOG,
          position,
        );
        parameter.setTrainrunSectionText(trainrunSectionText);
        this.uiInteractionService.showTrainrunDialog(parameter);
      },
    );

    this.editorView.bindShowTrainrunOneWayInformation(
      (trainrunSection: TrainrunSection, position: Vec2D) => {
        this.trainrunService.setTrainrunAsSelected(trainrunSection.getTrainrun().getId());
        this.trainrunSectionService.setTrainrunSectionAsSelected(trainrunSection.getId());
        const parameter = new TrainrunDialogParameter(
          TrainrunDialogType.TRAINRUN_ONEWAY_DIALOG,
          position,
        );
        this.uiInteractionService.showTrainrunDialog(parameter);
      },
    );

    this.editorView.bindGetConnectedTrainrunIds((trainrun: Trainrun) =>
      this.trainrunService.getConnectedTrainrunIdsFirstOrder(trainrun.getId()),
    );

    this.editorView.bindToggleNonStop((node: Node, t: Transition) => {
      this.nodeService.toggleNonStop(node.getId(), t.getId());
      this.trainrunService.trainrunsUpdated();
    });

    this.editorView.bindGetNodeFromTransition((t: Transition) =>
      this.nodeService.getNodeFromTransition(t),
    );

    this.editorView.bindSplitTrainrunIntoTwoParts((t: Transition) => {
      this.trainrunService.splitTrainrunIntoTwoParts(t);
    });

    this.editorView.bindCombineTwoTrainruns((n: Node, port1: Port, port2: Port) => {
      this.trainrunService.combineTwoTrainruns(n, port1, port2);
    });

    this.editorView.bindGetNodeFromConnection((c: Connection) =>
      this.nodeService.getNodeForConnection(c),
    );

    this.editorView.bindUnselectAllTrainruns(() => this.trainrunService.unselectAllTrainruns());

    this.editorView.bindIsAnyTrainSelected(() => this.trainrunService.isAnyTrainrunSelected());

    this.editorView.bindIsFilterTravelTimeEnabled(() =>
      this.filterService.isFilterTravelTimeEnabled(),
    );

    this.editorView.bindIsfilterTrainrunNameEnabled(() =>
      this.filterService.isFilterTrainrunNameEnabled(),
    );

    this.editorView.bindIsFilterDirectionArrowsEnabled(() =>
      this.filterService.isFilterDirectionArrowsEnabled(),
    );

    this.editorView.bindIsfilterArrivalDepartureTimeEnabled(() =>
      this.filterService.isFilterArrivalDepartureTimeEnabled(),
    );

    this.editorView.bindIsFilterShowNonStopTimeEnabled(() =>
      this.filterService.isFilterShowNonStopTimeEnabled(),
    );

    this.editorView.bindIsfilterTrainrunCategoryEnabled((trainrunCatgory: TrainrunCategory) =>
      this.filterService.isFilterTrainrunCategoryEnabled(trainrunCatgory),
    );

    this.editorView.bindCheckFilterNode(
      (node: Node) =>
        this.filterService.checkFilterNode(node) && this.filterService.checkFilterEmptyNode(node),
    );

    this.editorView.bindFilterNode((node: Node) => this.filterService.filterNode(node));

    this.editorView.bindFilterNote((note: Note) => this.filterService.filterNote(note));

    this.editorView.bindCheckFilterNonStopNode((node: Node) =>
      this.filterService.checkFilterNonStopNode(node),
    );

    this.editorView.bindIsNodeVisible((node: Node) => this.filterService.isNodeVisible(node));

    this.editorView.bindIsJunctionNode((node: Node) => this.filterService.isJunctionNode(node));

    this.editorView.bindFilterTrainrunsection((trainrunSection: TrainrunSection) =>
      this.filterService.filterTrainrunsection(trainrunSection),
    );

    this.editorView.bindIsTemporaryDisableFilteringOfItemsInViewEnabled(() =>
      this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled(),
    );

    this.editorView.bindFilterTrainrun((trainrun: Trainrun) =>
      this.filterService.filterTrainrun(trainrun),
    );

    this.editorView.bindIsfilterConnectionsEnabled(() =>
      this.filterService.isFilterConnectionsEnabled(),
    );

    this.editorView.bindIsFilterTrainrunFrequencyEnabled((trainrunFrequency: TrainrunFrequency) =>
      this.filterService.isFilterTrainrunFrequencyEnabled(trainrunFrequency),
    );

    this.editorView.bindIsFilterNotesEnabled(() => this.filterService.isFilterNotesEnabled());

    this.editorView.bindReplaceIntermediateStopWithNode(
      (trainsectionId: number, stopIndex: number, nodeId: number) =>
        this.trainrunSectionService.replaceIntermediateStopWithNode(
          trainsectionId,
          stopIndex,
          nodeId,
        ),
    );

    this.editorView.bindGetTimeDisplayPrecision(() => this.filterService.getTimeDisplayPrecision());

    this.editorView.bindSetTimeDisplayPrecision((precision) =>
      this.filterService.setTimeDisplayPrecision(precision),
    );

    this.editorView.bindSelectNode((nodeId, enforceUpdate = true) =>
      this.nodeService.selectNode(nodeId, enforceUpdate),
    );

    this.editorView.bindUnselectNode((nodeId, enforceUpdate = true) =>
      this.nodeService.unselectNode(nodeId, enforceUpdate),
    );

    this.editorView.bindUnselectAllNodes((enforceUpdate = true) =>
      this.nodeService.unselectAllNodes(enforceUpdate),
    );

    this.editorView.bindIsNodeSelected((nodeId) => this.nodeService.isNodeSelected(nodeId));

    this.editorView.bindSelectNote((noteId) => this.noteService.selectNote(noteId));

    this.editorView.bindUnselectNote((noteId) => this.noteService.unselectNote(noteId));

    this.editorView.bindUnselectAllNotes(() => this.noteService.unselectAllNotes());

    this.editorView.bindUnselectAllTrainrunSections(() =>
      this.trainrunSectionService.unselectAllTrainrunSections(),
    );

    this.editorView.bindIsNoteSelected((noteId) => this.noteService.isNoteSelected(noteId));

    this.editorView.bindAddNote((position: Vec2D, clickPosition: Vec2D) => {
      const newNote = this.noteService.addNote(position);
      this.showEditNote(newNote, clickPosition);
    });

    this.editorView.bindEditNote((inputNoteId: number, clickPosition: Vec2D) => {
      const note = this.noteService.getNoteFromId(inputNoteId);
      this.showEditNote(note, clickPosition);
    });

    this.editorView.bindMoveNote(
      (inputNoteId: number, newPosition: Vec2D, round: number, dragEnd: boolean) => {
        this.noteService.moveNote(
          inputNoteId,
          newPosition.getX(),
          newPosition.getY(),
          round,
          dragEnd,
        );
      },
    );

    this.editorView.bindGetNoteLayerIndex((noteId: number) =>
      this.noteService.getNoteLayerIndex(noteId),
    );

    this.editorView.bindCalculateShortestDistanceNodesFromStartingNode(
      (departureNodeId: number) => {
        this.analyticsService.calculateShortestDistanceNodesFromStartingNode(departureNodeId);
      },
    );

    this.editorView.bindCalculateShortestDistanceNodesFromStartingTrainrunSection(
      (trainrunSectionId: number, departureNodeId: number) => {
        this.analyticsService.calculateShortestDistanceNodesFromStartingTrainrunSection(
          trainrunSectionId,
          departureNodeId,
        );
      },
    );

    this.editorView.bindPauseUndoRecording(() => {
      this.undoService.pauseUndoRecording();
    });

    this.editorView.bindStartUndoRecording(() => {
      this.undoService.startUndoRecording();
    });
  }

  private handleVariantChanged() {
    if (this.versionControlService?.getAndClearVarianteChangedSignal()) {
      this.uiInteractionService.viewportCenteringOnNodesBoundingBox();
    }
  }

  private subscribeViewToServices() {
    this.nodeService.nodes.pipe(takeUntil(this.destroyed)).subscribe((updatedNodes) => {
      this.editorView.nodesView.displayNodes(updatedNodes);
      this.editorView.postDisplayRendering();
    });

    this.nodeService.transitions.pipe(takeUntil(this.destroyed)).subscribe((updatedTransitions) => {
      this.editorView.transitionsView.displayTransitions(updatedTransitions);
      this.editorView.postDisplayRendering();
    });

    this.nodeService.connections.pipe(takeUntil(this.destroyed)).subscribe((updatedConnections) => {
      this.editorView.connectionsView.displayConnections(updatedConnections);
      this.editorView.postDisplayRendering();
    });

    this.trainrunSectionService.trainrunSections
      .pipe(takeUntil(this.destroyed))
      .subscribe((updatedTrainrunSections) => {
        this.editorView.trainrunSectionsView.displayTrainrunSection(updatedTrainrunSections);
        this.editorView.postDisplayRendering();
      });

    this.noteService.notes.pipe(takeUntil(this.destroyed)).subscribe((updatedNotes) => {
      this.editorView.notesView.displayNotes(updatedNotes);
      this.editorView.postDisplayRendering();
    });

    this.nodeService.nodes.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.handleVariantChanged();
    });
  }
}
