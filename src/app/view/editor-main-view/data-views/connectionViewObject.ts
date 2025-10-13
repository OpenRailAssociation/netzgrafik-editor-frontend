import {Connection} from "../../../models/connection.model";
import {Node} from "../../../models/node.model";
import {EditorView} from "./editor.view";

export class ConnectionsViewObject {
  key: string;

  constructor(
    private editorView: EditorView,
    public connection: Connection,
    public node: Node,
    displayConnectionPin1: boolean,
    displayConnectionPin2: boolean,
  ) {
    this.key = ConnectionsViewObject.generateKey(
      editorView,
      connection,
      displayConnectionPin1,
      displayConnectionPin2,
    );
  }

  static generateKey(
    editorView: EditorView,
    connection: Connection,
    displayConnectionPin1: boolean,
    displayConnectionPin2: boolean,
  ): string {
    let key =
      "#" +
      connection.getId() +
      "@" +
      connection.hasWarning() +
      "_" +
      connection.getPortId1() +
      "_" +
      connection.getPortId2() +
      "_" +
      connection.selected() +
      "_" +
      connection.getPath()[0] +
      "_" +
      connection.getPath()[1] +
      "_" +
      connection.getPath()[2] +
      "_" +
      connection.getPath()[3] +
      "_" +
      displayConnectionPin1 +
      "_" +
      displayConnectionPin2 +
      "_" +
      editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() +
      "_" +
      editorView.getLevelOfDetail() +
      "_" +
      editorView.trainrunSectionPreviewLineView.getVariantIsWritable();

    connection.getPath().forEach((p) => {
      key += p.toString();
    });
    return key;
  }
}
