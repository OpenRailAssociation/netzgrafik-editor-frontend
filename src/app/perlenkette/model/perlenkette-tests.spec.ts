import {PerlenketteNode} from "./perlenketteNode";
import {PerlenketteSection} from "./perlenketteSection";

describe("PerlenketteModelTests", () => {
  it("Perlenkette-Model - Test - PerlenketteNode - 001", () => {
    const node = new PerlenketteNode(0, "BN", "Berm", 10, [], undefined, false, true);

    expect(node.isFristTrainrunPartNode()).toBe(false);
    expect(node.isLastTrainrunPartNode()).toBe(true);
    expect(node.isPerlenketteNode()).toBe(true);
    expect(node.isPerlenketteSection()).toBe(false);
    expect(node.getPerlenketteNode()).toEqual(node);
    expect(node.getPerlenketteSection()).toEqual(undefined);
  });

  it("Perlenkette-Model - Test - PerlenketteSection - 001", () => {
    const section = new PerlenketteSection(0, 10, undefined, undefined, 0, false, false, true);

    expect(section.isFristTrainrunPartSection()).toBe(false);
    expect(section.isLastTrainrunPartSection()).toBe(true);
    expect(section.isPerlenketteNode()).toBe(false);
    expect(section.isPerlenketteSection()).toBe(true);
    expect(section.getPerlenketteNode()).toEqual(undefined);
    expect(section.getPerlenketteSection()).toEqual(section);
  });
});
