import {Transition} from "../../../models/transition.model";
import {EditorView} from "./editor.view";

export class TransitionViewObject {
  key: string;

  constructor(
    private editorView: EditorView,
    public transition: Transition,
    isMuted: boolean,
  ) {
    this.key = TransitionViewObject.generateKey(editorView, transition, isMuted);
  }

  static generateKey(editorView: EditorView, transition: Transition, isMuted: boolean): string {
    let key =
      "#" +
      transition.getId() +
      "@" +
      transition.getIsNonStopTransit() +
      "_" +
      transition.getTrainrun().selected() +
      "_" +
      transition.getTrainrun().getTrainrunCategory().shortName +
      "_" +
      transition.getTrainrun().getTrainrunFrequency().shortName +
      "_" +
      transition.getTrainrun().getTrainrunTimeCategory().shortName +
      "_" +
      transition.getTrainrun().getTrainrunCategory().id +
      "_" +
      transition.getTrainrun().getTrainrunFrequency().id +
      "_" +
      transition.getTrainrun().getTrainrunTimeCategory().id +
      "_" +
      transition.getTrainrun().getTrainrunCategory().colorRef +
      "_" +
      transition.getTrainrun().getTrainrunFrequency().linePatternRef +
      "_" +
      transition.getTrainrun().getTrainrunTimeCategory().linePatternRef +
      "_" +
      transition.getTrainrun().getTrainrunFrequency().frequency +
      "_" +
      editorView.isTemporaryDisableFilteringOfItemsInViewEnabled() +
      "_" +
      isMuted +
      "_" +
      editorView.trainrunSectionPreviewLineView.getVariantIsWritable();

    transition.getPath().forEach((p) => {
      key += p.toString();
    });
    return key;
  }
}
