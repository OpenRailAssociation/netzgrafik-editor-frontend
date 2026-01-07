import * as d3 from "d3";
import {Note} from "../../../models/note.model";
import {EditorView} from "./editor.view";
import {StaticDomTags} from "./static.dom.tags";
import {NodeViewObject} from "./nodeViewObject";
import {NoteViewObject} from "./noteViewObject";
import {
  NODE_POSITION_BASIC_RASTER,
  NOTE_TEXT_AREA_HEIGHT,
  NOTE_TEXT_LEFT_SPACING,
  TEXT_SIZE,
} from "../../rastering/definitions";
import {Vec2D} from "../../../utils/vec2D";
import {PreviewLineMode} from "./trainrunsection.previewline.view";
import {EditorMode} from "../../editor-menu/editor-mode";
import {LevelOfDetail} from "../../../services/ui/level.of.detail.service";

// See -> https://www.npmjs.com/package/ngx-editor

export class NotesView {
  dragPreviousMousePosition: Vec2D;
  notesGroup;
  draggable: any;

  constructor(private editorView: EditorView) {
    this.draggable = d3
      .drag()
      .on("start", (n: NoteViewObject, i, a) => this.onNoteDragStart(n.note, a[i]))
      .on("drag", (n: NoteViewObject) => this.onNoteDragged(n.note))
      .on("end", (n: NoteViewObject, i, a) => this.onNoteDragEnd(n.note, a[i]));
    this.dragPreviousMousePosition = new Vec2D();
  }

  static convertText(strToConvert: string): string {
    return strToConvert
      .trim()
      // Convert HTML tab entities to actual tab characters first, then handle them
      .replace(/&amp;#9;/g, '\t')
      .replace(/&#9;/g, '\t')
      .replace(/&nbsp;&nbsp;&nbsp;&nbsp;/g, '\t') // 4 spaces as approximation
      // Handle actual tab characters by converting to spaces for SVG display
      .replace(/\t/g, '    ') // Convert tabs to 4 spaces for display
      .split("::marker")
      .join("")
      .split("<ul>")
      .join("")
      .split("</ul>")
      .join("")
      .split("</li>")
      .join("")
      .split("<li><p>")
      .join("<p> - ")
      .split("<br>")
      .join('<tspan x="' + (NOTE_TEXT_LEFT_SPACING - 4) + '" dy="' + TEXT_SIZE + '">&nbsp;</tspan>')
      .split("<p>")
      .join('<tspan x="' + NOTE_TEXT_LEFT_SPACING + '" dy="' + 1.5 * TEXT_SIZE + '">')
      .split("</p>")
      .join("&nbsp;</tspan>")
      .split("<em>")
      .join('<tspan style="font-style: italic">')
      .split("</em>")
      .join("&nbsp;</tspan>")
      .split("<strong>")
      .join('<tspan style="font-weight: bold">')
      .split("</strong>")
      .join("&nbsp;</tspan>")
      .split("<span")
      .join("<tspan")
      .split("</span")
      .join("</tspan")
      .split('style="color:')
      .join('style="fill:');
  }

  static extractTextBasedHeight(n: Note): number {
    return Math.max(
      n.getText().split("<br>").join("<p>").split("<p>", 9999).length * 1.5 * TEXT_SIZE +
        NOTE_TEXT_AREA_HEIGHT +
        16,
      n.getHeight(),
    );
  }

  static extractTextBasedWidth(n: Note): number {
    let maxLen = 0;
    const div = document.createElement("div");
    // Pre-process the text to handle tabs like in convertText
    const processedText = n.getText()
      .replace(/&amp;#9;/g, '\t')
      .replace(/&#9;/g, '\t')
      .replace(/&nbsp;&nbsp;&nbsp;&nbsp;/g, '\t')
      .replace(/\t/g, '    '); // Convert tabs to 4 spaces for width calculation

    div.innerHTML = processedText.split("<br>").join("<br>\n").split("<p>").join("<p>\n");
    div.textContent.split("\n", 9999).forEach((v) => {
      maxLen = Math.max(maxLen, v.length);
    });
    maxLen = Math.max(maxLen, n.getTitle().length);
    return Math.max(n.getWidth(), maxLen * NOTE_TEXT_LEFT_SPACING) + NOTE_TEXT_LEFT_SPACING;
  }

  setGroup(connectionsGroup) {
    this.notesGroup = connectionsGroup;
    this.notesGroup.attr("class", "NotesView");
  }

  filterNotesToDisplay(note: Note): boolean {
    return this.editorView.filterNote(note);
  }

  createViewNoteDataObjects(nodes: Note[]): NoteViewObject[] {
    const viewNoteDataObjects: NoteViewObject[] = [];
    nodes.forEach((n: Note) => {
      viewNoteDataObjects.push(new NoteViewObject(this.editorView, n));
    });
    return viewNoteDataObjects;
  }

  displayNotes(inputNotes: Note[]) {
    const notes = inputNotes.filter(
      (n) =>
        this.editorView.doCullCheckPositionsInViewport([
          new Vec2D(n.getPositionX(), n.getPositionY()),
          new Vec2D(n.getPositionX() + n.getWidth(), n.getPositionY()),
          new Vec2D(n.getPositionX(), n.getPositionY() + n.getHeight()),
          new Vec2D(n.getPositionX() + n.getWidth(), n.getPositionY() + n.getHeight()),
        ]) && this.filterNotesToDisplay(n),
    );

    const group = this.notesGroup
      .selectAll(StaticDomTags.NOTE_ROOT_CONTAINER_DOM_REF)
      .data(this.createViewNoteDataObjects(notes), (n: NodeViewObject) => n.key);

    const groupEnter2 = group
      .enter()
      .append(StaticDomTags.NOTE_SVG)
      .attr("class", StaticDomTags.NOTE_ROOT_CONTAINER);

    const groupEnter = groupEnter2
      .append(StaticDomTags.NOTE_SVG)
      .attr("class", StaticDomTags.NOTE_CLASS)
      .attr(StaticDomTags.NOTE_ID, (n: NoteViewObject) => n.note.getId())
      .attr(
        "transform",
        (n: NoteViewObject) =>
          "translate(" + n.note.getPositionX() + "," + n.note.getPositionY() + ")",
      );

    this.renderNoteObject(groupEnter);

    group.exit().remove();
  }

  renderNoteObject(groupEnter: any) {
    switch (this.editorView.getLevelOfDetail()) {
      case LevelOfDetail.LEVEL3: {
        //statements;
        this.makeNoteLODLevel3(groupEnter);
        break;
      }
      case LevelOfDetail.LEVEL2: {
        //statements;
        this.makeNoteLODLevel2(groupEnter);
        break;
      }
      case LevelOfDetail.LEVEL1: {
        //statements;
        this.makeNoteLODLevel1(groupEnter);
        break;
      }
      case LevelOfDetail.LEVEL0: {
        //statements;
        this.makeNoteLODLevel0(groupEnter);
        break;
      }
      default: {
        //statements;
        this.makeNodeLODFull(groupEnter);
      }
    }
  }

  makeNodeLODFull(groupEnter: any) {
    this.makeNoteHoverRoot(groupEnter);
    this.makeNoteRoot(groupEnter);
    this.makeNoteTitleArea(groupEnter);
    this.makeNoteTextArea(groupEnter);
    this.makeNoteTitleAreaText(groupEnter);
    this.makeNoteText(groupEnter);
    this.makeNoteDragAreaBackground(groupEnter);
    this.makeNoteDragArea(groupEnter);
  }

  makeNoteLODLevel3(groupEnter: any) {
    this.makeNoteHoverRoot(groupEnter);
    this.makeNoteRoot(groupEnter);
    this.makeNoteTitleArea(groupEnter);
    this.makeNoteTextArea(groupEnter);
    this.makeNoteTitleAreaText(groupEnter);
    this.makeNoteText(groupEnter);
  }

  makeNoteLODLevel2(groupEnter: any) {
    this.makeNoteRoot(groupEnter);
    this.makeNoteTitleAreaText(groupEnter);
    this.makeNoteText(groupEnter);
  }

  makeNoteLODLevel1(groupEnter: any) {
    this.makeNoteRoot(groupEnter);
    this.makeNoteTitleAreaText(groupEnter);
  }

  makeNoteLODLevel0(groupEnter: any) {
    this.makeNoteRoot(groupEnter);
    this.makeNoteTitleAreaText(groupEnter);
  }

  private makeNoteHoverRoot(groupEnter: any) {
    const added = groupEnter.append(StaticDomTags.NOTE_HOVER_ROOT_SVG);
    added
      .attr("class", StaticDomTags.NOTE_HOVER_ROOT_CLASS)
      .attr(StaticDomTags.NOTE_ID, (n: NoteViewObject) => n.note.getId())
      .attr("width", (n: NoteViewObject) => NotesView.extractTextBasedWidth(n.note) + 48)
      .attr("height", (n: NoteViewObject) => NotesView.extractTextBasedHeight(n.note) + 48)
      .attr("x", -24)
      .attr("y", -24);

    if (!this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      return;
    }

    added
      .call(this.draggable)
      .on("mouseout", (n: NoteViewObject) => this.onNoteMouseout(n.note, null))
      .on("mouseover", (n: NoteViewObject, i, a) => this.onNoteMouseover(n.note, a[i]));
  }

  private makeNoteRoot(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NOTE_ROOT_SVG)
      .attr("class", StaticDomTags.NOTE_ROOT_CLASS)
      .attr(StaticDomTags.NOTE_ID, (n: NoteViewObject) => n.note.getId())
      .attr("width", (n: NoteViewObject) => NotesView.extractTextBasedWidth(n.note) + 40)
      .attr("height", (n: NoteViewObject) => NotesView.extractTextBasedHeight(n.note) + 40)
      .attr("x", -20)
      .attr("y", -20)
      .classed(
        StaticDomTags.TAG_MULTI_SELECTED,
        (n: NoteViewObject) =>
          n.note.selected() && this.editorView.editorMode === EditorMode.MultiNodeMoving,
      )
      .on("mousedown", (n: NoteViewObject) => this.onNoteMousedown(n.note))
      .on("mouseup", (n: NoteViewObject, i, a) => this.onNoteMouseup(n.note, a[i]))
      .on("mouseout", (n: NoteViewObject) => this.onNoteMouseout(n.note, null))
      .on("mouseover", (n: NoteViewObject, i, a) => this.onNoteMouseover(n.note, a[i]));
  }

  private makeNoteTitleArea(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NOTE_TITELAREA_SVG)
      .attr("class", StaticDomTags.NOTE_TITELAREA_CLASS)
      .attr(StaticDomTags.NOTE_ID, (n: NoteViewObject) => n.note.getId())
      .attr("width", (n: NoteViewObject) => NotesView.extractTextBasedWidth(n.note))
      .attr("height", () => NOTE_TEXT_AREA_HEIGHT)
      .attr("x", 0)
      .attr("y", 0)
      .classed(
        StaticDomTags.TAG_MULTI_SELECTED,
        (n: NoteViewObject) =>
          n.note.selected() && this.editorView.editorMode === EditorMode.MultiNodeMoving,
      )
      .on("mousedown", (n: NoteViewObject) => this.onNoteMousedown(n.note))
      .on("mouseup", (n: NoteViewObject, i, a) => this.onNoteMouseup(n.note, a[i]))
      .on("mouseout", (n: NoteViewObject) => this.onNoteMouseout(n.note, null))
      .on("mouseover", (n: NoteViewObject, i, a) => this.onNoteMouseover(n.note, a[i]));
  }

  private makeNoteTextArea(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NOTE_TEXTAREA_SVG)
      .attr("class", StaticDomTags.NOTE_TEXTAREA_CLASS)
      .attr(StaticDomTags.NOTE_ID, (n: NoteViewObject) => n.note.getId())
      .attr("width", (n: NoteViewObject) => NotesView.extractTextBasedWidth(n.note))
      .attr(
        "height",
        (n: NoteViewObject) => NotesView.extractTextBasedHeight(n.note) - NOTE_TEXT_AREA_HEIGHT,
      )
      .attr("x", 0)
      .attr("y", NOTE_TEXT_AREA_HEIGHT)
      .classed(
        StaticDomTags.TAG_MULTI_SELECTED,
        (n: NoteViewObject) =>
          n.note.selected() && this.editorView.editorMode === EditorMode.MultiNodeMoving,
      )
      .on("mousedown", (n: NoteViewObject) => this.onNoteMousedown(n.note))
      .on("mouseup", (n: NoteViewObject, i, a) => this.onNoteMouseup(n.note, a[i]))
      .on("mouseout", (n: NoteViewObject) => this.onNoteMouseout(n.note, null))
      .on("mouseover", (n: NoteViewObject, i, a) => this.onNoteMouseover(n.note, a[i]));
  }

  private makeNoteTitleAreaText(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NOTE_TITELAREA_TEXT_SVG)
      .attr("class", StaticDomTags.NOTE_TITELAREA_TEXT_CLASS)
      .attr(StaticDomTags.NOTE_ID, (n: NoteViewObject) => n.note.getId())
      .attr("x", NOTE_TEXT_LEFT_SPACING)
      .attr("y", 4 + TEXT_SIZE)
      .text((n: NoteViewObject) => n.note.getTitle())
      .on("mousedown", (n: NoteViewObject) => this.onNoteMousedown(n.note))
      .on("mouseout", (n: NoteViewObject) => this.onNoteMouseout(n.note, null))
      .on("mouseover", (n: NoteViewObject, i, a) => this.onNoteMouseover(n.note, a[i]));
  }

  private makeNoteText(groupEnter: any) {
    groupEnter
      .append(StaticDomTags.NOTE_TEXT_SVG)
      .attr("class", StaticDomTags.NOTE_TEXT_CLASS)
      .attr(StaticDomTags.NOTE_ID, (n: NoteViewObject) => n.note.getId())
      .attr("x", NOTE_TEXT_LEFT_SPACING)
      .attr("y", 3 * TEXT_SIZE)
      .html((n: NoteViewObject) => NotesView.convertText(n.note.getText()))
      .on("mousedown", (n: NoteViewObject) => this.onNoteMousedown(n.note))
      .on("mouseout", (n: NoteViewObject) => this.onNoteMouseout(n.note, null))
      .on("mouseover", (n: NoteViewObject, i, a) => this.onNoteMouseover(n.note, a[i]));
  }

  private makeNoteDragAreaBackground(groupEnter: any) {
    const added = groupEnter.append(StaticDomTags.NOTE_HOVER_DRAG_AREA_BACKGROUND_SVG);

    added
      .attr("class", StaticDomTags.NOTE_HOVER_DRAG_AREA_BACKGROUND_CLASS)
      .classed(StaticDomTags.TAG_SELECTED, (n: NoteViewObject) => n.note.selected())
      .attr(StaticDomTags.NOTE_ID, (n: NoteViewObject) => n.note.getId())
      .attr("transform", (n: NoteViewObject) => "translate(-50,-20)")
      .attr("width", 28)
      .attr("height", 28)
      .attr("x", 0)
      .attr("y", 0);

    if (!this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      return;
    }

    added
      .on("mouseout", (n: NoteViewObject) => this.onNoteMouseoutDragButton(n.note, null))
      .on("mouseover", (n: NoteViewObject, i, a) => this.onNoteMouseoverDragButton(n.note, a[i]))
      .call(this.draggable);
  }

  private makeNoteDragArea(groupEnter: any) {
    if (!this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      return;
    }
    groupEnter
      .append(StaticDomTags.NOTE_HOVER_DRAG_AREA_SVG)
      .attr("class", StaticDomTags.NOTE_HOVER_DRAG_AREA_CLASS)
      .classed(StaticDomTags.TAG_SELECTED, (n: NoteViewObject) => n.note.selected())
      .attr(StaticDomTags.NOTE_ID, (n: NoteViewObject) => n.note.getId())
      .attr(
        "d",
        "m11.855 2.398-.356-.36-.356.36-3.841 3.897.712.702L11 " +
          "3.97V11H3.957l2.647-2.647-.707-.708-3.5 3.5-.354.354.354.354 3.5 " +
          "3.5.707-.708-2.646-2.645H11v7.03l-2.995-3.027-.71.703 3.852 3.894.356.36.355-.36 " +
          "3.842-3.898-.712-.701L12 19.032v-7.031h7.041l-2.645 2.645.708.708 " +
          "3.5-3.5.353-.354-.353-.354-3.5-3.5-.707.708L19.043 11H12V3.967l2.997 " +
          "3.029.711-.704-3.853-3.894Z",
      )
      .attr("transform", (n: NoteViewObject) => "translate(-45,-15),scale(1.0)")
      .on("mouseout", (n: NoteViewObject) => this.onNoteMouseoutDragButton(n.note, null))
      .on("mouseover", (n: NoteViewObject, i, a) => this.onNoteMouseoverDragButton(n.note, a[i]))
      .call(this.draggable);
  }

  onNoteMousedown(note: Note) {
    if (!this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      d3.event.stopPropagation();
      return;
    }

    if (this.editorView.editorMode === EditorMode.MultiNodeMoving) {
      const multiSelected = this.editorView.isNoteSelected(note.getId());
      if (multiSelected) {
        this.editorView.unselectNote(note.getId());
      } else {
        this.editorView.selectNote(note.getId());
      }
      d3.event.stopPropagation();
    }
  }

  onNoteMouseup(note: Note, domObj: any) {
    if (!this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      d3.event.stopPropagation();
      return;
    }

    const rect: DOMRect = d3.select(domObj).node().getBoundingClientRect();
    const clickPosition = new Vec2D(rect.x + rect.width / 2, rect.y + rect.height / 2);

    if (this.editorView.editorMode === EditorMode.MultiNodeMoving) {
      d3.event.stopPropagation();
      return;
    }

    if (this.editorView.trainrunSectionPreviewLineView.getMode() !== PreviewLineMode.NotDragging) {
      return;
    }

    if (this.editorView.editorMode !== EditorMode.NetzgrafikEditing) {
      return;
    }

    if (this.editorView.svgMouseController.isPanning()) {
      return;
    }

    this.editorView.editNote(note.getId(), clickPosition);
  }

  onNoteMouseout(note: Note, domObj: any) {
    this.unhoverNote(note, domObj);
  }

  onNoteMouseover(note: Note, domObj: any) {
    if (this.editorView.trainrunSectionPreviewLineView.getMode() !== PreviewLineMode.NotDragging) {
      return;
    }
    if (
      this.editorView.editorMode === EditorMode.TopologyEditing ||
      this.editorView.editorMode === EditorMode.NoteEditing ||
      this.editorView.editorMode === EditorMode.StreckengrafikEditing
    ) {
      return;
    }
    this.hoverNote(note, domObj);
  }

  onNoteMouseoverDragButton(note: Note, domObj: any) {
    this.onNoteMouseover(note, domObj);
    d3.selectAll(StaticDomTags.NOTE_HOVER_DRAG_AREA_DOM_REF)
      .filter((n: NoteViewObject) => n.note.getId() === note.getId())
      .classed(StaticDomTags.TAG_HOVER, true);
  }

  onNoteMouseoutDragButton(note: Note, domObj: any) {
    d3.selectAll(StaticDomTags.NOTE_HOVER_DRAG_AREA_DOM_REF)
      .filter((n: NoteViewObject) => n.note.getId() === note.getId())
      .classed(StaticDomTags.TAG_HOVER, false);
    this.onNoteMouseout(note, domObj);
  }

  hoverNote(note: Note, domObj: any) {
    d3.selectAll(StaticDomTags.NOTE_HOVER_DRAG_AREA_DOM_REF)
      .filter((n: NoteViewObject) => n.note.getId() === note.getId())
      .classed(StaticDomTags.TAG_MUTED, true);
    d3.selectAll(StaticDomTags.NOTE_ROOT_DOM_REF)
      .filter((n: NoteViewObject) => n.note.getId() === note.getId())
      .classed(StaticDomTags.TAG_HOVER, true);
  }

  unhoverNote(note: Note, domObj: any) {
    d3.selectAll(StaticDomTags.NOTE_HOVER_DRAG_AREA_DOM_REF)
      .filter((n: NoteViewObject) => n.note.getId() === note.getId())
      .classed(StaticDomTags.TAG_MUTED, false);
    d3.selectAll(StaticDomTags.NOTE_ROOT_DOM_REF)
      .filter((n: NoteViewObject) => n.note.getId() === note.getId())
      .classed(StaticDomTags.TAG_HOVER, false);
  }

  onNoteDragStart(note: Note, domObj: any) {
    d3.select(domObj).classed(StaticDomTags.TAG_HOVER, true);
    d3.select(domObj).classed(StaticDomTags.TAG_DRAGGING, true);
    this.dragPreviousMousePosition = this.editorView.svgMouseController.getCurrentMousePosition();
    this.editorView.pauseUndoRecording();
  }

  onNoteDragged(note: Note) {
    this.editorView.enableElementDragging();
    this.doDrag(note.getId());
    this.editorView.disableElementDragging();
  }

  onNoteDragEnd(note: Note, domObj: any) {
    this.editorView.startUndoRecording();
    d3.select(domObj).classed(StaticDomTags.TAG_HOVER, false);
    d3.select(domObj).classed(StaticDomTags.TAG_DRAGGING, false);
    this.doDrag(note.getId(), NODE_POSITION_BASIC_RASTER, true);
  }

  private doDrag(noteId: number, round = 1, dragEnd = false) {
    const currentMousePosition = this.editorView.svgMouseController.getCurrentMousePosition();
    const newPosition: Vec2D = Vec2D.sub(currentMousePosition, this.dragPreviousMousePosition);
    newPosition.setData(newPosition.getX(), newPosition.getY());

    if (this.editorView.editorMode === EditorMode.MultiNodeMoving) {
      this.editorView.moveSelectedNodes(newPosition.getX(), newPosition.getY(), round, dragEnd);
      this.editorView.moveSelectedNotes(newPosition.getX(), newPosition.getY(), round, dragEnd);
    } else {
      this.editorView.moveNote(noteId, newPosition, round, dragEnd);
    }

    // update the drag mouse position (previous for next dragging step)
    this.dragPreviousMousePosition = currentMousePosition;
  }
}