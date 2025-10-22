import {StaticDomTags} from "./static.dom.tags";
import * as d3 from "d3";
import {Vec2D} from "../../../utils/vec2D";

export class MultiSelectRenderer {
  private isBoxDrawing = false;

  static setGroup(nodeGroup: d3.Selector) {
    nodeGroup
      .append(StaticDomTags.PREVIEW_MULTISELECT_ROOT_BOX_SVG)
      .attr("class", StaticDomTags.PREVIEW_MULTISELECT_ROOT_BOX_CLASS);
  }

  displayBox() {
    if (this.isBoxDrawing) {
      return;
    }

    this.isBoxDrawing = true;
    d3.selectAll(StaticDomTags.PREVIEW_MULTISELECT_ROOT_BOX_DOM_REF)
      .append(StaticDomTags.PREVIEW_MULTISELECT_BOX_SVG)
      .attr("class", StaticDomTags.PREVIEW_MULTISELECT_BOX_CLASS);
  }

  updateBox(topLeft: Vec2D, bottomRight: Vec2D) {
    d3.selectAll(StaticDomTags.PREVIEW_MULTISELECT_BOX_DOM_REF)
      .attr("x", topLeft.getX())
      .attr("y", topLeft.getY())
      .attr("width", bottomRight.getX() - topLeft.getX())
      .attr("height", bottomRight.getY() - topLeft.getY());
  }

  hideBox() {
    if (!this.isBoxDrawing) {
      return;
    }

    this.isBoxDrawing = false;
    d3.selectAll(StaticDomTags.PREVIEW_MULTISELECT_BOX_DOM_REF).remove();
  }
}
