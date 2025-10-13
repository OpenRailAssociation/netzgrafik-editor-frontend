import {Node} from "../../../models/node.model";
import {EditorView} from "./editor.view";

export class NodeViewObject {
  key: string;

  constructor(
    private editorView: EditorView,
    public node: Node,
    isNodeStopNode: boolean,
  ) {
    this.key = NodeViewObject.generateKey(editorView, node, isNodeStopNode);
  }

  static generateKey(editorView: EditorView, n: Node, isNodeStopNode: boolean): string {
    return (
      "#" +
      n.getId() +
      "@" +
      n.getPositionX() +
      "_" +
      n.getPositionY() +
      "_" +
      n.getBetriebspunktName() +
      "_" +
      n.getPorts().length +
      "_" +
      n.getConnectionTime() +
      "_" +
      n.getNodeWidth() +
      "_" +
      n.getNodeHeight() +
      "_" +
      n.selected() +
      "_" +
      n.getConnections().length +
      "_" +
      isNodeStopNode +
      "_" +
      editorView.isJunctionNode(n) +
      "_" +
      editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() +
      "_" +
      editorView.getLevelOfDetail() +
      "_" +
      editorView.trainrunSectionPreviewLineView.getVariantIsWritable()
    );
  }
}
