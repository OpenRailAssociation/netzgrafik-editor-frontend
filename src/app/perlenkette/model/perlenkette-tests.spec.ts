import {PerlenketteNode} from "./perlenketteNode";
import {PerlenketteSection} from "./perlenketteSection";

describe("PerlenketteModelTests", () => {
  it("Perlenkette-Model - Test - PerlenketteNode - 001", () => {
    const node = new PerlenketteNode(0, "BN", "Berm", 10, [], undefined, false, true);

    expect(node.isFristTrainrunPartNode()).toBe(false);
    expect(node.isLastTrainrunPartNode()).toBe(true);
    expect(node instanceof PerlenketteSection).toBe(false); // make sure one class does not extend the other
  });

  it("Perlenkette-Model - Test - PerlenketteSection - 001", () => {
    const section = new PerlenketteSection(0, 10, undefined, undefined, 0, false, false, true);

    expect(section.isFristTrainrunPartSection()).toBe(false);
    expect(section.isLastTrainrunPartSection()).toBe(true);
    expect(section instanceof PerlenketteNode).toBe(false); // make sure one class does not extend the other
  });
});
