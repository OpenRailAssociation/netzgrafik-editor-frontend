import {Note} from "../../../models/note.model";
import {EditorView} from "./editor.view";

export class NoteViewObject {
  key: string;

  constructor(
    private editorView: EditorView,
    public note: Note,
  ) {
    this.key = NoteViewObject.generateKey(editorView, note);
  }

  static generateKey(editorView: EditorView, n: Note): string {
    return (
      "LC" +
      editorView.getNetzgrafikLoadCounter() +
      "#" +
      n.getId() +
      "@" +
      n.getPositionX() +
      "_" +
      n.getPositionY() +
      "_" +
      n.getHeight() +
      "_" +
      n.getWidth() +
      "_" +
      n.getText() +
      "_" +
      n.getTitle() +
      "_" +
      n.selected() +
      "_" +
      editorView.getNoteLayerIndex(n.getId()) +
      "_" +
      editorView.isFilterNotesEnabled() +
      "_" +
      editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() +
      "_" +
      editorView.getLevelOfDetail() +
      "_" +
      editorView.trainrunSectionPreviewLineView.getVariantIsWritable()
    );
  }
}
