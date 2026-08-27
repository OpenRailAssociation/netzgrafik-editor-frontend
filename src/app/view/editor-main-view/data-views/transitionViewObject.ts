import {Vec2D} from "src/app/utils/vec2D";
import {Transition} from "../../../models/transition.model";
import {EditorView} from "./editor.view";
import {SimpleTrainrunSectionRouter} from "src/app/services/util/trainrunsection.routing";

export class TransitionViewObject {
  key: string;
  path: Vec2D[];

  constructor(
    private editorView: EditorView,
    public transition: Transition,
    private isMuted: boolean = false,
  ) {
    const node = editorView.getNodeFromTransition(transition);
    const port1 = node.getPort(transition.getPortId1());
    const port2 = node.getPort(transition.getPortId2());
    this.path = SimpleTrainrunSectionRouter.routeTransition(node, port1, port2);
    this.key = this.generateKey();
  }

  private generateKey(): string {
    let key =
      "#" +
      this.transition.getId() +
      "@" +
      this.transition.getIsNonStopTransit() +
      "_" +
      this.transition.getTrainrun().selected() +
      "_" +
      this.transition.getTrainrun().getTrainrunCategory().shortName +
      "_" +
      this.transition.getTrainrun().getTrainrunFrequency().shortName +
      "_" +
      this.transition.getTrainrun().getTrainrunTimeCategory().shortName +
      "_" +
      this.transition.getTrainrun().getTrainrunCategory().id +
      "_" +
      this.transition.getTrainrun().getTrainrunFrequency().id +
      "_" +
      this.transition.getTrainrun().getTrainrunTimeCategory().id +
      "_" +
      this.transition.getTrainrun().getTrainrunCategory().colorRef +
      "_" +
      this.transition.getTrainrun().getTrainrunFrequency().linePatternRef +
      "_" +
      this.transition.getTrainrun().getTrainrunTimeCategory().linePatternRef +
      "_" +
      this.transition.getTrainrun().getTrainrunFrequency().frequency +
      "_" +
      this.editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() +
      "_" +
      this.isMuted +
      "_" +
      this.editorView.trainrunSectionPreviewLineView.getVariantIsWritable();

    this.path.forEach((p) => {
      key += p.toString();
    });
    return key;
  }
}
