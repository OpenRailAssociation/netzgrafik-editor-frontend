import {Connection} from "../../../models/connection.model";
import {Node} from "../../../models/node.model";
import {SimpleTrainrunSectionRouter} from "../../../services/util/trainrunsection.routing";
import {Vec2D} from "../../../utils/vec2D";
import {EditorView} from "./editor.view";

export class ConnectionsViewObject {
  key: string;
  readonly path: Vec2D[];

  constructor(
    private editorView: EditorView,
    public connection: Connection,
    public node: Node,
    displayConnectionPin1: boolean,
    displayConnectionPin2: boolean,
  ) {
    const port1 = node.getPort(connection.getPortId1());
    const port2 = node.getPort(connection.getPortId2());
    this.path = SimpleTrainrunSectionRouter.routeConnection(node, port1, port2);
    this.key = this.generateKey(displayConnectionPin1, displayConnectionPin2);
  }

  private generateKey(displayConnectionPin1: boolean, displayConnectionPin2: boolean): string {
    let key =
      "#" +
      this.connection.getId() +
      "@" +
      this.connection.hasWarning() +
      "_" +
      this.connection.getPortId1() +
      "_" +
      this.connection.getPortId2() +
      "_" +
      this.connection.selected() +
      "_" +
      this.path[0] +
      "_" +
      this.path[1] +
      "_" +
      this.path[2] +
      "_" +
      this.path[3] +
      "_" +
      displayConnectionPin1 +
      "_" +
      displayConnectionPin2 +
      "_" +
      this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() +
      "_" +
      this.editorView.getLevelOfDetail() +
      "_" +
      this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable();

    this.path.forEach((p) => {
      key += p.toString();
    });
    return key;
  }
}
