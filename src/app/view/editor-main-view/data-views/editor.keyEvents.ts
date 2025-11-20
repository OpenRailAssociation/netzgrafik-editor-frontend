import * as d3 from "d3";
import {StaticDomTags} from "./static.dom.tags";
import {NodeService} from "../../../services/data/node.service";
import {TrainrunService} from "../../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../../services/data/trainrunsection.service";
import {SVGMouseController} from "../../util/svg.mouse.controller";
import {LogService} from "../../../logger/log.service";
import {NoteService} from "../../../services/data/note.service";
import {RASTERING_BASIC_GRID_SIZE} from "../../rastering/definitions";
import {EditorMode} from "../../editor-menu/editor-mode";
import {Note} from "../../../models/note.model";
import {Node} from "../../../models/node.model";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {UndoService} from "../../../services/data/undo.service";
import {CopyService} from "../../../services/data/copy.service";
import {Port} from "../../../models/port.model";
import {FilterService} from "../../../services/ui/filter.service";
import {Connection} from "../../../models/connection.model";
import {PreviewLineMode, TrainrunSectionPreviewLineView} from "./trainrunsection.previewline.view";
import {TrainrunSection} from "../../../models/trainrunsection.model";
import {Trainrun} from "../../../models/trainrun.model";
import {PositionTransformationService} from "../../../services/util/position.transformation.service";
import {Vec2D} from "../../../utils/vec2D";

export class EditorKeyEvents {
  private editorMode: EditorMode;

  constructor(
    private nodeService: NodeService,
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private noteService: NoteService,
    private filterService: FilterService,
    private uiInteractionService: UiInteractionService,
    private logService: LogService,
    private undoService: UndoService,
    private copyService: CopyService,
    private svgMouseController: SVGMouseController,
    private trainrunSectionPreviewLineView: TrainrunSectionPreviewLineView,
    private positionTransformationService: PositionTransformationService,
  ) {
    this.activateMousekeyDownHandler(EditorMode.NetzgrafikEditing);
  }

  deactivateMousekeyDownHandler() {
    d3.select("body").on("keydown", () => {});
  }

  ignoreKeyEvent(event: KeyboardEvent): boolean {
    return document.body !== event.target;
  }

  activateMousekeyDownHandler(editorMode: EditorMode) {
    this.editorMode = editorMode;

    d3.select("body").on("keyup", () => {
      if (this.ignoreKeyEvent(d3.event)) {
        return;
      }
      this.forwardCtrlKeyInformation();
    });

    d3.select("body").on("keydown", () => {
      if (this.ignoreKeyEvent(d3.event)) {
        return;
      }

      this.forwardCtrlKeyInformation();

      if (this.trainrunSectionPreviewLineView.getMode() !== PreviewLineMode.NotDragging) {
        d3.event.preventDefault();
        return;
      }

      const keycode = d3.event.code;
      const ctrlKey = d3.event.ctrlKey;
      switch (keycode) {
        case "Delete":
          this.onKeyPressedDelete();
          break;
        case "Insert":
          this.onKeyPressedInsert();
          break;
        case "Escape":
          if (this.onKeyPressedEscape()) {
            d3.event.preventDefault();
          }
          break;
        case "KeyS":
          this.onTrainrunSectionSplit();
          break;
        case "KeyA":
          if (ctrlKey) {
            if (this.onSelectAll()) {
              d3.event.preventDefault();
            }
          }
          break;
        case "KeyC":
          if (ctrlKey) {
            if (this.onCopyAllVisibleElementsToCopyCache()) {
              d3.event.preventDefault();
            }
          }
          break;
        case "KeyV":
          if (ctrlKey) {
            if (this.onInsertAllVisibleElementsFromCopyCache()) {
              d3.event.preventDefault();
            }
          }
          break;
        case "KeyZ":
          if (ctrlKey) {
            if (this.onRevertLastChange()) {
              d3.event.preventDefault();
            }
          }
          break;
        case "KeyY":
          if (ctrlKey) {
            if (this.onRevertLastChange()) {
              d3.event.preventDefault();
            }
          }
          break;
        case "KeyD":
          if (ctrlKey) {
            this.onDuplicate();
            d3.event.preventDefault();
          }
          break;
        case "ArrowLeft":
          this.onArrowLeft();
          d3.event.preventDefault();
          break;
        case "ArrowUp":
          this.onArrowUp();
          d3.event.preventDefault();
          break;
        case "ArrowRight":
          this.onArrowRight();
          d3.event.preventDefault();
          break;
        case "ArrowDown":
          this.onArrowDown();
          d3.event.preventDefault();
          break;

        default:
          break;
      }
    });
  }

  private onTrainrunSectionSplit() {
    if (this.doTrainrunSectionsSplit()) {
      return;
    }
    this.doTrainrunSectionsFusion();
  }

  private doTrainrunSectionsFusion() {
    let allNodes = this.nodeService.getSelectedNodes();
    const totalLen = allNodes.length;
    while (allNodes.length > 0) {
      const n = allNodes.find(() => true);
      n.getTransitions().forEach((tr) => {
        const ts = this.nodeService.undockTransition(n.getId(), tr.getId(), false);
        if (ts){
          ts.setNumberOfStops( Math.max(0,ts.getNumberOfStops() - 1));
        }
      });
      this.nodeService.deleteNode(n.getId());
      allNodes = this.nodeService.getSelectedNodes();
    }
    this.nodeService.nodesUpdated();
    this.nodeService.transitionsUpdated();
    this.trainrunService.trainrunsUpdated();
    this.trainrunSectionService.trainrunSectionsUpdated();
    return totalLen > 0;
  }

  private doTrainrunSectionsSplit(): boolean {
    // insert a stop node to split all the selected trainrun sections
    const allSelectedTrainrunSections =
      this.trainrunSectionService.getAllSelectedTrainrunSections();
    if (!allSelectedTrainrunSections || allSelectedTrainrunSections.length === 0){
      return false;
    }

    const collectAllNodesPairs = new Map<string, TrainrunSection[]>();
    allSelectedTrainrunSections.forEach((ts) => {
      const srcNodeId = ts.getSourceNode().getId();
      const trgNodeId = ts.getTargetNode().getId();
      const pair = {
        nodeA: srcNodeId < trgNodeId ? srcNodeId : trgNodeId,
        nodeB: srcNodeId < trgNodeId ? trgNodeId : srcNodeId,
      };
      const key = `${pair.nodeA}-${pair.nodeB}`;
      let d: TrainrunSection[] = collectAllNodesPairs.get(key);
      if (d === undefined) {
        collectAllNodesPairs.set(key, []);
        d = collectAllNodesPairs.get(key);
      }
      d.push(ts);
    });
    for (const [key, sections] of collectAllNodesPairs.entries()) {
      const anchorTs = sections.find(() => true);
      if (anchorTs) {
        let x = 0;
        let y = 0;
        sections.forEach((ts) => {
          const p = anchorTs.getPath();
          const center = Vec2D.scale(Vec2D.add(p[0], p[3]), 0.5);
          x += center.getX();
          y += center.getY();
        });
        x /= sections.length;
        y /= sections.length;
        const node = this.nodeService.addNodeWithPosition(x, y);
        sections.forEach((ts) => {
          ts.setNumberOfStops(ts.getNumberOfStops() + 1);
          this.trainrunSectionService.replaceIntermediateStopWithNode(
            ts.getId(),
            Math.ceil(ts.getNumberOfStops() / 2) - 1,
            node.getId(),
          );
        });
        this.trainrunSectionService.unselectAllTrainrunSections();
      }
    }
    this.nodeService.nodesUpdated();
    this.nodeService.transitionsUpdated();
    this.trainrunService.trainrunsUpdated();
    this.trainrunSectionService.trainrunSectionsUpdated();
    return true;
  }

  private forwardCtrlKeyInformation() {
    const ctrlButtonState =
      d3.event.ctrlKey && this.trainrunSectionPreviewLineView.canCombineTwoTrainruns();

    const obj1 = d3.selectAll(StaticDomTags.EDGE_LINE_PIN_DOM_REF);
    obj1.each(function () {
      d3.select(this).classed(StaticDomTags.TAG_CTRLKEY, ctrlButtonState);
    });

    const obj2 = d3.selectAll(StaticDomTags.TRANSITION_BUTTON_DOM_REF);
    obj2.each(function () {
      d3.select(this).classed(StaticDomTags.TAG_CTRLKEY, ctrlButtonState);
    });
  }

  private getSelectedTrainSectionId(): number {
    let selectedTrainrunSectionId: number = undefined;
    d3.select(StaticDomTags.EDGE_LINE_DOM_REF + "." + StaticDomTags.TAG_SELECTED).classed(
      "KeyEventHandling",
      (tsvo) => {
        if (tsvo === undefined) {
          const trainRun = this.trainrunService.getSelectedTrainrun();
          if (trainRun !== null) {
            selectedTrainrunSectionId = trainRun.getId();
          }
          return false;
        }
        if (tsvo.trainrunSection.getTrainrun().selected()) {
          selectedTrainrunSectionId = tsvo.trainrunSection.getTrainrunId();
        }
        return false;
      },
    );
    return selectedTrainrunSectionId;
  }

  private getHoveredNoteId(): number {
    let noteHoveredId: number = undefined;
    d3.select(StaticDomTags.NOTE_ROOT_DOM_REF + "." + StaticDomTags.TAG_HOVER).classed(
      "KeyEventHandling",
      (tsvo) => {
        noteHoveredId = tsvo.note.getId();
        return false;
      },
    );
    return noteHoveredId;
  }

  private getHoveredNodeId(): number {
    let hoveredNodeId: number = undefined;
    d3.select(StaticDomTags.NODE_ROOT_DOM_REF + "." + StaticDomTags.TAG_HOVER).classed(
      "KeyEventHandling",
      (nvo) => {
        hoveredNodeId = nvo.node.getId();
        return false;
      },
    );
    return hoveredNodeId;
  }

  private onCopyAllVisibleElementsToCopyCache(): boolean {
    this.copyService.copyCurrentVisibleNetzgrafik();
    return false;
  }

  private onInsertAllVisibleElementsFromCopyCache(): boolean {
    if (!this.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      return true;
    }
    this.copyService.insertCopiedNetzgrafik();
    return false;
  }

  private onArrowLeft(): boolean {
    this.positionTransformationService.alignSelectedElementsToLeftBorder();
    return true;
  }

  private onArrowUp(): boolean {
    this.positionTransformationService.alignSelectedElementsToTopBorder();
    return true;
  }

  private onArrowDown(): boolean {
    this.positionTransformationService.alignSelectedElementsToBottomBorder();
    return true;
  }

  private onArrowRight(): boolean {
    this.positionTransformationService.alignSelectedElementsToRightBorder();
    return true;
  }

  private onRevertLastChange(): boolean {
    if (!this.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      return true;
    }
    this.undoService.undo();
    return true;
  }

  private onDuplicate(): boolean {
    if (!this.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      return true;
    }

    if (this.doDuplicateTrainrun()) {
      return true;
    }

    if (this.doDuplicateNote()) {
      return true;
    }

    if (this.doDuplicateNode()) {
      return true;
    }

    const retNode = this.doDuplicateMultiSelectedNode();
    const retNote = this.doDuplicateMultiSelectedNote();
    return retNode || retNote;
  }

  private doDuplicateTrainrun(): boolean {
    const selectedTrainrunSectionId = this.getSelectedTrainSectionId();
    if (selectedTrainrunSectionId !== undefined) {
      this.trainrunService.duplicateTrainrunAndSections(selectedTrainrunSectionId);
      return true;
    }
    return false;
  }

  private doDuplicateNote(): boolean {
    const hoveredNoteId = this.getHoveredNoteId();
    if (hoveredNoteId !== undefined) {
      const note = this.noteService.duplicateNote(hoveredNoteId);
      this.noteService.moveNote(
        note.getId(),
        RASTERING_BASIC_GRID_SIZE,
        RASTERING_BASIC_GRID_SIZE,
        1,
        true,
      );
      this.noteService.unselectNote(note.getId());
      return true;
    }
    return false;
  }

  private doDuplicateNode(): boolean {
    if (this.uiInteractionService.getEditorMode() === EditorMode.MultiNodeMoving) {
      return false;
    }
    const hoveredNodeId = this.getHoveredNodeId();
    if (hoveredNodeId !== undefined) {
      const node = this.nodeService.getNodeFromId(hoveredNodeId);
      this.duplicateNode(node, node.getNodeWidth(), node.getNodeHeight());
      return true;
    }
    return false;
  }

  private doDuplicateMultiSelectedNode(): boolean {
    if (this.uiInteractionService.getEditorMode() !== EditorMode.MultiNodeMoving) {
      return false;
    }

    // --- Pass 1 ---- collect all selected nodes
    const collectedSelectedNodes: Node[] = [];
    this.nodeService.getNodes().forEach((n: Node) => {
      if (n.selected()) {
        collectedSelectedNodes.push(n);
      }
    });

    // --- Pass 2 ---- collect all trains that have at least one section between the two marked "nodes"
    // >>> Pass 2.1 -- filter all trainruns
    const collectedTrainrunSectionBetweenSelectedNodes = this.trainrunSectionService
      .getTrainrunSections()
      .filter(
        (ts: TrainrunSection) => ts.getSourceNode().selected() && ts.getTargetNode().selected(),
      );

    // >>> Pass 2.2 -- collect all trainruns to duplicate
    const collectedTrainrun: Trainrun[] = [];
    collectedTrainrunSectionBetweenSelectedNodes.forEach((ts: TrainrunSection) => {
      if (collectedTrainrun.find((t: Trainrun) => t.getId() === ts.getTrainrunId()) === undefined) {
        collectedTrainrun.push(ts.getTrainrun());
      }
    });

    // >>> Pass 2.3 -- remove all duplicate trainrun sections that are not encapsulated by marked nodes
    const newTrainrunSectionToModify: TrainrunSection[] = [];
    collectedTrainrun.forEach((t: Trainrun) => {
      const newTrainrun = this.trainrunService.duplicateTrainrunAndSections(t.getId(), false, "");
      const newTrainrunSections = this.trainrunSectionService.getAllTrainrunSectionsForTrainrun(
        newTrainrun.getId(),
      );
      newTrainrunSections.forEach((ts: TrainrunSection) => {
        if (ts.getSourceNode().selected() && ts.getTargetNode().selected()) {
          newTrainrunSectionToModify.push(ts);
        } else {
          this.trainrunSectionService.deleteTrainrunSection(ts.getId(), false);
        }
      });
    });

    // --- Pass 3 ----  duplicate all notes and calculate the max notes offset (position move to)
    this.nodeService.unselectAllNodes(false);
    const newNodes: Node[] = [];
    let maxW = 0;
    let maxH = 0;
    collectedSelectedNodes.forEach((n: Node) => {
      maxW = Math.max(n.getNodeWidth(), maxW);
      maxH = Math.max(n.getNodeHeight(), maxH);
    });
    collectedSelectedNodes.forEach((n: Node) => {
      const cNode = this.duplicateNode(n, maxW, maxH, false);
      newNodes.push(cNode);
    });

    // --- Pass 4 ---- reconnect the duplicated trainrun sections to the new created (duplicated) nodes
    // >>> Pass 4.1 -- collect non-stop information / per default stop and reconnect trainrun sections
    const srcNonStop: boolean[] = [];
    const trgNonStop: boolean[] = [];
    newTrainrunSectionToModify.forEach((ts: TrainrunSection) => {
      const newSrcNodeId = newNodes[collectedSelectedNodes.indexOf(ts.getSourceNode())].getId();
      const newTrgNodeId = newNodes[collectedSelectedNodes.indexOf(ts.getTargetNode())].getId();

      const transSrc = ts.getSourceNode().getTransition(ts.getId());
      const transNonStopSrc = transSrc !== undefined ? transSrc.getIsNonStopTransit() : false;
      const transTrg = ts.getTargetNode().getTransition(ts.getId());
      const transNonStopTrg = transTrg !== undefined ? transTrg.getIsNonStopTransit() : false;
      srcNonStop.push(transNonStopSrc);
      trgNonStop.push(transNonStopTrg);

      this.trainrunSectionService.reconnectTrainrunSection(
        ts.getSourceNodeId(),
        newTrgNodeId,
        ts.getId(),
        ts.getTargetNodeId(),
        ts.getSourceNodeId(),
        false,
      );
      this.trainrunSectionService.reconnectTrainrunSection(
        ts.getTargetNodeId(),
        newSrcNodeId,
        ts.getId(),
        ts.getTargetNodeId(),
        ts.getSourceNodeId(),
        false,
      );
    });

    // >>> Pass 4.2 -- correct the non-stop transitions
    newTrainrunSectionToModify.forEach((ts: TrainrunSection, index: number) => {
      const tSrc = ts.getSourceNode().getTransition(ts.getId());
      if (tSrc !== undefined && srcNonStop[index]) {
        tSrc.setIsNonStopTransit(srcNonStop[index]);
      }
      const tTrg = ts.getTargetNode().getTransition(ts.getId());
      if (tTrg !== undefined && trgNonStop[index]) {
        tTrg.setIsNonStopTransit(trgNonStop[index]);
      }
    });

    // --- Pass 5 ---- unselect all trainruns and select all new nodes
    this.trainrunService.unselectAllTrainruns();
    newNodes.forEach((n: Node) => {
      n.select();
    });

    // call update - due of disabled update (signal) in the passes 1-5
    this.nodeService.nodesUpdated();
    this.nodeService.transitionsUpdated();
    this.nodeService.connectionsUpdated();
    this.trainrunService.trainrunsUpdated();
    this.trainrunService.trainrunsUpdated();
    return true;
  }

  private doDuplicateMultiSelectedNote(): boolean {
    if (this.uiInteractionService.getEditorMode() !== EditorMode.MultiNodeMoving) {
      return false;
    }

    // --- Pass 1 ---- collect all selected nodes
    const collectedSelectedNotes: Note[] = [];
    this.noteService.getNotes().forEach((n: Note) => {
      if (n.selected()) {
        collectedSelectedNotes.push(n);
      }
    });

    // --- Pass 2 ----  duplicate all notes and calculate the max notes offset (position move to)
    this.noteService.unselectAllNotes(false);
    const newNotes: Note[] = [];
    let maxW = 0;
    let maxH = 0;
    collectedSelectedNotes.forEach((n: Note) => {
      maxW = Math.max(n.getWidth(), maxW);
      maxH = Math.max(n.getHeight(), maxH);
    });
    collectedSelectedNotes.forEach((n: Note) => {
      const cNode = this.noteService.duplicateNote(n.getId());
      this.noteService.moveNote(
        cNode.getId(),
        maxW + RASTERING_BASIC_GRID_SIZE,
        maxH + RASTERING_BASIC_GRID_SIZE,
        1,
        true,
        false,
      );
      newNotes.push(cNode);
    });

    // --- Pass 3 ---- unselect all trainruns and select all new nodes
    newNotes.forEach((n: Note) => {
      n.select();
    });

    // call update - due of disabled update (signal) in the passes 1-5
    this.noteService.notesUpdated();
    return true;
  }

  private duplicateNode(
    node: Node,
    nodeWidth: number,
    nodeHeight: number,
    enforceUpdate = true,
  ): Node {
    const newNode = this.nodeService.duplicateNode(node.getId());
    this.nodeService.changeNodePosition(
      newNode.getId(),
      newNode.getPositionX() + nodeWidth + RASTERING_BASIC_GRID_SIZE,
      newNode.getPositionY() + nodeHeight + RASTERING_BASIC_GRID_SIZE,
      true,
      enforceUpdate,
    );
    this.nodeService.unselectNode(newNode.getId(), enforceUpdate);
    return newNode;
  }

  private onKeyPressedEscape(): boolean {
    this.trainrunService.unselectAllTrainruns();
    if (this.editorMode === EditorMode.MultiNodeMoving) {
      this.nodeService.unselectAllNodes();
      this.noteService.unselectAllNotes();
      this.trainrunSectionService.unselectAllTrainrunSections();
    }
    return true;
  }

  private onSelectAll(): boolean {
    if (
      this.uiInteractionService.getEditorMode() === EditorMode.MultiNodeMoving ||
      this.uiInteractionService.getEditorMode() === EditorMode.NetzgrafikEditing
    ) {
      this.uiInteractionService.setEditorMode(EditorMode.MultiNodeMoving);
      this.noteService.getNotes().forEach((n: Note) => n.select());
      this.nodeService.getNodes().forEach((n: Node) => n.select());
      this.noteService.notesUpdated();
      this.nodeService.nodesUpdated();
    }
    return true;
  }

  private onKeyPressedInsert(): boolean {
    if (!this.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      return true;
    }

    if (this.onDuplicate()) {
      return true;
    }

    const mousePosition = this.svgMouseController.getLastMousePosition();
    const hoveredNodeId = this.getHoveredNodeId();
    if (hoveredNodeId !== undefined) {
      this.nodeService.addNodeWithPosition(mousePosition.getX(), mousePosition.getY());
      return true;
    }

    this.nodeService.addNodeWithPosition(mousePosition.getX(), mousePosition.getY());
    return true;
  }

  private deleteTrainrunsAndEmptyNodesIfFilteringActive() {
    let visibleTrainrunSections: number[] = [];
    this.nodeService.getNodes().forEach((n: Node) => {
      if (n.selected()) {
        n.getPorts().forEach((p: Port) => {
          const trainrunSection = p.getTrainrunSection();
          if (this.filterService.filterTrainrunsection(trainrunSection)) {
            visibleTrainrunSections.push(trainrunSection.getId());
          }
        });
      }
    });
    visibleTrainrunSections = visibleTrainrunSections.filter((v, i, a) => a.indexOf(v) === i);
    visibleTrainrunSections.forEach((trainrunSectionId: number) => {
      this.trainrunSectionService.deleteTrainrunSection(trainrunSectionId, false);
    });

    let selectedNodeDeleted = false;
    this.nodeService.getNodes().forEach((n: Node) => {
      if (n.selected()) {
        if (n.getPorts().length === 0) {
          if (n.selected()) {
            selectedNodeDeleted = true;
          }
          this.nodeService.deleteNode(n.getId(), false);
        }
      }
    });

    this.netzgrafikElementsUpdated();

    if (selectedNodeDeleted) {
      this.uiInteractionService.closeNodeStammdaten();
    }
  }

  private removeAllSelectedNodes() {
    let selectedNodeDeleted = false;
    this.nodeService.getNodes().forEach((n: Node) => {
      if (n.selected()) {
        selectedNodeDeleted = true;
        this.nodeService.deleteNode(n.getId(), false);
      }
    });

    if (selectedNodeDeleted) {
      this.uiInteractionService.closeNodeStammdaten();
    }
  }

  private removeAllSelectedNotes() {
    this.noteService.getNotes().forEach((n: Note) => {
      if (n.selected()) {
        this.noteService.deleteNote(n.getId(), false);
      }
    });
  }

  private onKeyPressedDelete(): boolean {
    if (!this.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      return true;
    }
    const selectedTrainrunSectionId = this.getSelectedTrainSectionId();

    const connections = this.nodeService.getAllSelectedConnections();
    if (connections.length > 0) {
      connections.forEach((connection: Connection) => {
        const node = this.nodeService
          .getNodes()
          .find(
            (n: Node) =>
              n.getConnections().find((c) => connection.getId() === c.getId()) !== undefined,
          );
        if (node !== undefined) {
          this.nodeService.removeConnectionFromNode(node.getId(), connection.getId());
        }
      });
      return true;
    }

    if (this.editorMode === EditorMode.MultiNodeMoving) {
      /* handle Nodes and Trainruns/TrainrunSections */
      if (this.filterService.isAnyFilterActive()) {
        this.deleteTrainrunsAndEmptyNodesIfFilteringActive();
      } else {
        this.removeAllSelectedNodes();
      }
      this.netzgrafikElementsUpdated();

      /* handle Notes */
      this.removeAllSelectedNotes();
      this.noteService.notesUpdated();

      this.uiInteractionService.setEditorMode(EditorMode.NetzgrafikEditing);
      this.nodeService.unselectAllNodes();
      this.noteService.unselectAllNotes();
      return true;
    }

    if (selectedTrainrunSectionId !== undefined) {
      this.trainrunSectionService.deleteAllTrainrunSectionsOfTrainrun(selectedTrainrunSectionId);
      return true;
    }

    const hoveredNodeId = this.getHoveredNodeId();
    if (hoveredNodeId !== undefined) {
      const selNodeDelete = this.nodeService.isNodeSelected(hoveredNodeId);
      this.nodeService.deleteNode(hoveredNodeId);
      if (selNodeDelete) {
        this.uiInteractionService.closeNodeStammdaten();
      }
      return true;
    }

    const hoveredNoteId = this.getHoveredNoteId();
    if (hoveredNoteId !== undefined) {
      this.noteService.deleteNote(hoveredNoteId);
      return true;
    }

    return false;
  }

  private netzgrafikElementsUpdated() {
    this.trainrunSectionService.trainrunSectionsUpdated();
    this.trainrunService.trainrunsUpdated();
    this.nodeService.transitionsUpdated();
    this.nodeService.connectionsUpdated();
    this.nodeService.nodesUpdated();
  }
}
