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
import {D3Utils} from "./d3.utils";
import {PreviewLineMode} from "./trainrunsection.previewline.view";
import {EditorMode} from "../../editor-menu/editor-mode";
import {LevelOfDetail} from "../../../services/ui/level.of.detail.service";

// See -> https://www.npmjs.com/package/ngx-editor

type NoteDragEvent = d3.D3DragEvent<SVGElement, NodeViewObject, unknown>;

export class NotesView {
  dragPreviousMousePosition: Vec2D;
  notesGroup: d3.Selection<SVGElement, undefined, Element, undefined>;
  draggable: d3.DragBehavior<SVGElement, NoteViewObject, unknown>;
  dragDomObj: SVGElement | null = null;

  constructor(private editorView: EditorView) {
    this.draggable = d3
      .drag<SVGElement, NoteViewObject>()
      .on("start", (event: NoteDragEvent, n: NoteViewObject) => this.onNoteDragStart(event, n.note))
      .on("drag", (event: NoteDragEvent, n: NoteViewObject) => this.onNoteDragged(event, n.note))
      .on("end", (event: NoteDragEvent, n: NoteViewObject) => this.onNoteDragEnd(event, n.note));
    this.dragPreviousMousePosition = new Vec2D();
  }

  static convertText(strToConvert: string): string {
    return strToConvert
      .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
      .trim()
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
    div.innerHTML = n.getSanitizedText().split("<br>").join("<br>\n").split("<p>").join("<p>\n");
    div.textContent.split("\n", 9999).forEach((v) => {
      maxLen = Math.max(maxLen, v.length);
    });
    maxLen = Math.max(maxLen, n.getTitle().length);
    return Math.max(n.getWidth(), maxLen * NOTE_TEXT_LEFT_SPACING) + NOTE_TEXT_LEFT_SPACING;
  }

  setGroup(connectionsGroup: d3.Selection<SVGElement, undefined, Element, undefined>) {
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

  renderNoteObject(groupEnter: d3.Selection<SVGElement, NoteViewObject, Element, undefined>) {
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

  makeNodeLODFull(groupEnter: d3.Selection<SVGElement, NoteViewObject, Element, undefined>) {
    this.makeNoteHoverRoot(groupEnter);
    this.makeNoteRoot(groupEnter);
    this.makeNoteTitleArea(groupEnter);
    this.makeNoteTextArea(groupEnter);
    this.makeNoteTitleAreaText(groupEnter);
    this.makeNoteText(groupEnter);
    this.makeNoteDragAreaBackground(groupEnter);
    this.makeNoteDragArea(groupEnter);
  }

  makeNoteLODLevel3(groupEnter: d3.Selection<SVGElement, NoteViewObject, Element, undefined>) {
    this.makeNoteHoverRoot(groupEnter);
    this.makeNoteRoot(groupEnter);
    this.makeNoteTitleArea(groupEnter);
    this.makeNoteTextArea(groupEnter);
    this.makeNoteTitleAreaText(groupEnter);
    this.makeNoteText(groupEnter);
  }

  makeNoteLODLevel2(groupEnter: d3.Selection<SVGElement, NoteViewObject, Element, undefined>) {
    this.makeNoteRoot(groupEnter);
    this.makeNoteTitleAreaText(groupEnter);
    this.makeNoteText(groupEnter);
  }

  makeNoteLODLevel1(groupEnter: d3.Selection<SVGElement, NoteViewObject, Element, undefined>) {
    this.makeNoteRoot(groupEnter);
    this.makeNoteTitleAreaText(groupEnter);
  }

  makeNoteLODLevel0(groupEnter: d3.Selection<SVGElement, NoteViewObject, Element, undefined>) {
    this.makeNoteRoot(groupEnter);
    this.makeNoteTitleAreaText(groupEnter);
  }

  private makeNoteHoverRoot(
    groupEnter: d3.Selection<SVGElement, NoteViewObject, Element, undefined>,
  ) {
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
      .on("mouseout", (event: MouseEvent, n: NoteViewObject) => this.onNoteMouseout(event, n.note))
      .on("mouseover", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMouseover(event, n.note),
      );
  }

  private makeNoteRoot(groupEnter: d3.Selection<SVGElement, NoteViewObject, Element, undefined>) {
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
      .on("mousedown", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMousedown(event, n.note),
      )
      .on("mouseup", (event: MouseEvent, n: NoteViewObject) => this.onNoteMouseup(event, n.note))
      .on("mouseout", (event: MouseEvent, n: NoteViewObject) => this.onNoteMouseout(event, n.note))
      .on("mouseover", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMouseover(event, n.note),
      );
  }

  private makeNoteTitleArea(
    groupEnter: d3.Selection<SVGElement, NoteViewObject, Element, undefined>,
  ) {
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
      .on("mousedown", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMousedown(event, n.note),
      )
      .on("mouseup", (event: MouseEvent, n: NoteViewObject) => this.onNoteMouseup(event, n.note))
      .on("mouseout", (event: MouseEvent, n: NoteViewObject) => this.onNoteMouseout(event, n.note))
      .on("mouseover", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMouseover(event, n.note),
      );
  }

  private makeNoteTextArea(
    groupEnter: d3.Selection<SVGElement, NoteViewObject, Element, undefined>,
  ) {
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
      .on("mousedown", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMousedown(event, n.note),
      )
      .on("mouseup", (event: MouseEvent, n: NoteViewObject) => this.onNoteMouseup(event, n.note))
      .on("mouseout", (event: MouseEvent, n: NoteViewObject) => this.onNoteMouseout(event, n.note))
      .on("mouseover", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMouseover(event, n.note),
      );
  }

  private makeNoteTitleAreaText(
    groupEnter: d3.Selection<SVGElement, NoteViewObject, Element, undefined>,
  ) {
    groupEnter
      .append(StaticDomTags.NOTE_TITELAREA_TEXT_SVG)
      .attr("class", StaticDomTags.NOTE_TITELAREA_TEXT_CLASS)
      .attr(StaticDomTags.NOTE_ID, (n: NoteViewObject) => n.note.getId())
      .attr("x", NOTE_TEXT_LEFT_SPACING)
      .attr("y", 4 + TEXT_SIZE)
      .text((n: NoteViewObject) => n.note.getTitle())
      .on("mousedown", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMousedown(event, n.note),
      )
      .on("mouseout", (event: MouseEvent, n: NoteViewObject) => this.onNoteMouseout(event, n.note))
      .on("mouseover", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMouseover(event, n.note),
      );
  }

  private makeNoteText(groupEnter: d3.Selection<SVGElement, NoteViewObject, Element, undefined>) {
    groupEnter
      .append(StaticDomTags.NOTE_TEXT_SVG)
      .attr("class", StaticDomTags.NOTE_TEXT_CLASS)
      .attr(StaticDomTags.NOTE_ID, (n: NoteViewObject) => n.note.getId())
      .attr("x", NOTE_TEXT_LEFT_SPACING)
      .attr("y", 3 * TEXT_SIZE)
      .html((n: NoteViewObject) => NotesView.convertText(n.note.getSanitizedText()))
      .on("mousedown", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMousedown(event, n.note),
      )
      .on("mouseout", (event: MouseEvent, n: NoteViewObject) => this.onNoteMouseout(event, n.note))
      .on("mouseover", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMouseover(event, n.note),
      );
  }

  private makeNoteDragAreaBackground(
    groupEnter: d3.Selection<SVGElement, NoteViewObject, Element, undefined>,
  ) {
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
      .on("mouseout", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMouseoutDragButton(event, n.note),
      )
      .on("mouseover", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMouseoverDragButton(event, n.note),
      )
      .call(this.draggable);
  }

  private makeNoteDragArea(
    groupEnter: d3.Selection<SVGElement, NoteViewObject, Element, undefined>,
  ) {
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
      .on("mouseout", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMouseoutDragButton(event, n.note),
      )
      .on("mouseover", (event: MouseEvent, n: NoteViewObject) =>
        this.onNoteMouseoverDragButton(event, n.note),
      )
      .call(this.draggable);
  }

  onNoteMousedown(event: MouseEvent, note: Note) {
    if (!this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      event.stopPropagation();
      return;
    }

    if (this.editorView.editorMode === EditorMode.MultiNodeMoving) {
      const multiSelected = this.editorView.isNoteSelected(note.getId());
      if (multiSelected) {
        this.editorView.unselectNote(note.getId());
      } else {
        this.editorView.selectNote(note.getId());
      }
      event.stopPropagation();
    }
  }

  onNoteMouseup(event: MouseEvent, note: Note) {
    if (!this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable()) {
      event.stopPropagation();
      return;
    }

    const domObj = D3Utils.getMouseEventCurrentTarget(event);
    const rect: DOMRect = d3.select(domObj).node().getBoundingClientRect();
    const clickPosition = new Vec2D(rect.x + rect.width / 2, rect.y + rect.height / 2);

    if (this.editorView.editorMode === EditorMode.MultiNodeMoving) {
      event.stopPropagation();
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

  onNoteMouseout(event: MouseEvent, note: Note) {
    this.unhoverNote(note);
  }

  onNoteMouseover(event: MouseEvent, note: Note) {
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
    this.hoverNote(note);
  }

  onNoteMouseoverDragButton(event: MouseEvent, note: Note) {
    this.onNoteMouseover(event, note);
    d3.selectAll(StaticDomTags.NOTE_HOVER_DRAG_AREA_DOM_REF)
      .filter((n: NoteViewObject) => n.note.getId() === note.getId())
      .classed(StaticDomTags.TAG_HOVER, true);
  }

  onNoteMouseoutDragButton(event: MouseEvent, note: Note) {
    d3.selectAll(StaticDomTags.NOTE_HOVER_DRAG_AREA_DOM_REF)
      .filter((n: NoteViewObject) => n.note.getId() === note.getId())
      .classed(StaticDomTags.TAG_HOVER, false);
    this.onNoteMouseout(event, note);
  }

  hoverNote(note: Note) {
    d3.selectAll(StaticDomTags.NOTE_HOVER_DRAG_AREA_DOM_REF)
      .filter((n: NoteViewObject) => n.note.getId() === note.getId())
      .classed(StaticDomTags.TAG_MUTED, true);
    d3.selectAll(StaticDomTags.NOTE_ROOT_DOM_REF)
      .filter((n: NoteViewObject) => n.note.getId() === note.getId())
      .classed(StaticDomTags.TAG_HOVER, true);
  }

  unhoverNote(note: Note) {
    d3.selectAll(StaticDomTags.NOTE_HOVER_DRAG_AREA_DOM_REF)
      .filter((n: NoteViewObject) => n.note.getId() === note.getId())
      .classed(StaticDomTags.TAG_MUTED, false);
    d3.selectAll(StaticDomTags.NOTE_ROOT_DOM_REF)
      .filter((n: NoteViewObject) => n.note.getId() === note.getId())
      .classed(StaticDomTags.TAG_HOVER, false);
  }

  onNoteDragStart(event: NoteDragEvent, note: Note) {
    const domObj = D3Utils.getMouseEventCurrentTarget(event.sourceEvent);
    this.dragDomObj = domObj;
    d3.select(domObj).classed(StaticDomTags.TAG_HOVER, true);
    d3.select(domObj).classed(StaticDomTags.TAG_DRAGGING, true);
    this.dragPreviousMousePosition = this.editorView.svgMouseController.getCurrentMousePosition(
      event.sourceEvent,
    );
    this.editorView.pauseUndoRecording();
  }

  onNoteDragged(event: NoteDragEvent, note: Note) {
    this.editorView.enableElementDragging();
    this.doDrag(event, note.getId());
    this.editorView.disableElementDragging();
  }

  onNoteDragEnd(event: NoteDragEvent, note: Note) {
    this.editorView.startUndoRecording();
    const domObj = this.dragDomObj;
    this.dragDomObj = null;
    d3.select(domObj).classed(StaticDomTags.TAG_HOVER, false);
    d3.select(domObj).classed(StaticDomTags.TAG_DRAGGING, false);
    this.doDrag(event, note.getId(), NODE_POSITION_BASIC_RASTER, true);
  }

  private doDrag(event: NoteDragEvent, noteId: number, round = 1, dragEnd = false) {
    const currentMousePosition = this.editorView.svgMouseController.getCurrentMousePosition(
      event.sourceEvent,
    );
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
