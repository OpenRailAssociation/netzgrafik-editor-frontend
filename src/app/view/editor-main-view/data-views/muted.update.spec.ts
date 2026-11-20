import {select, type Selection} from "d3";
import {MUTEABLE_CLASS, updateMuted} from "./muted.update";

describe("updateMuted", () => {
  const render = () => {
    const root = select<SVGElement, unknown>(
      document.createElementNS("http://www.w3.org/2000/svg", "g"),
    );
    root.append("path").classed(MUTEABLE_CLASS, true);
    root.append("text");
    return root;
  };
  const getMuted = (root: Selection<SVGElement, unknown, null, undefined>) =>
    [root.node(), ...Array.from(root.node().children)].map((e) => e.classList.contains("muted"));

  it("mutes the root and its marked children only", () => {
    const root = render();
    updateMuted(root, () => true);
    expect(getMuted(root)).toEqual([true, true, false]);
  });

  it("unmutes the root and its marked children", () => {
    const root = render();
    updateMuted(root, () => true);
    updateMuted(root, () => false);
    expect(getMuted(root)).toEqual([false, false, false]);
  });
});
