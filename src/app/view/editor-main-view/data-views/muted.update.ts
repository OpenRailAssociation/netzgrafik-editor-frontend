import * as d3 from "d3";
import {StaticDomTags} from "./static.dom.tags";

// Marks the elements that get the muted class, so that it can change without rendering them again
export const MUTEABLE_CLASS = "muteable";

// Updates the muted class of rendered root elements, and of their marked descendants
export const updateMuted = <D, P extends d3.BaseType, PD>(
  selection: d3.Selection<SVGElement, D, P, PD>,
  isMuted: (d: D) => boolean,
) =>
  selection.each(function (d) {
    const muted = isMuted(d);
    if (this.classList.contains(StaticDomTags.TAG_MUTED) === muted) return;
    this.classList.toggle(StaticDomTags.TAG_MUTED, muted);
    this.querySelectorAll("." + MUTEABLE_CLASS).forEach((element) =>
      element.classList.toggle(StaticDomTags.TAG_MUTED, muted),
    );
  });
