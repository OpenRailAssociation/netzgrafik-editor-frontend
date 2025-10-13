import {SgPathNode} from "./sg-path-node";
import {TrackData} from "../trackData";
import {SgPathSection} from "./sg-path-section";
import {SgTrainrunSection} from "./sg-trainrun-section";
import {SgTrainrunNode} from "./sg-trainrun-node";
import {TrainrunItem} from "../trainrunItem";
import {PathNode} from "../pathNode";
import {SgTrainrun} from "./sg-trainrun";
import {PathSection} from "../pathSection";
import {TrainrunBranchType} from "../enum/trainrun-branch-type-type";
import {Direction} from "src/app/data-structures/business.data.structures";

describe("StreckengrafikModelTests", () => {
  it("Streckengrafik-Model - Test - SgPathNode - 001", () => {
    const node: SgPathNode = new SgPathNode(
      0,
      0,
      "TEST",
      10,
      20,
      0,
      0,
      new TrackData(2),
      undefined,
    );
    expect(node.xPath()).toBe(0);
    expect(node.zoomedXPath()).toBe(0);
    expect(node.nodeWidth()).toBe(60);
    expect(node.travelTime()).toBe(1 / 60);
  });

  it("Streckengrafik-Model - Test - SgPathNode - 002", () => {
    const node: SgPathNode = new SgPathNode(
      0,
      0,
      "TEST",
      20,
      10,
      0,
      0,
      new TrackData(2),
      undefined,
    );
    node.trackOccupier = true;
    expect(node.xPath()).toBe(60);
    expect(node.zoomedXPath()).toBe(60);
    expect(node.nodeWidth()).toBe(60);
    expect(node.travelTime()).toBe(10);
  });

  it("Streckengrafik-Model - Test - SgPathSection - 001", () => {
    const section: SgPathSection = new SgPathSection(
      0,
      0,
      10,
      20,
      0,
      0,
      "AA",
      "BB",
      new TrackData(2),
      false,
    );
    section.trackOccupier = true;
    expect(section.xPath()).toBe(1 / 60);
    expect(section.zoomedXPath()).toBe(0);
    expect(section.calcZoomedXPath()).toBe(0);
    expect(section.travelTime()).toBe(1 / 60);

    section.trackOccupier = false;
    expect(section.xPath()).toBe(1 / 60);
    expect(section.zoomedXPath()).toBe(0);
    expect(section.calcZoomedXPath()).toBe(0);

    section.filter = true;
    expect(section.xPath()).toBe(70);
    expect(section.zoomedXPath()).toBe(70);
    expect(section.calcZoomedXPath()).toBe(0);
  });

  it("Streckengrafik-Model - Test - SgTrainrunSection  - 001", () => {
    const section: SgTrainrunSection = new SgTrainrunSection(
      0,
      0,
      10,
      20,
      0,
      0,
      "AA",
      "BB",
      "CC",
      "DD",
      false,
      2,
      new TrackData(2),
      undefined,
    );

    section.maxUnrollOnlyEvenFrequencyOffsets = 0;
    expect(section.checkUnrollAllowed(10)).toBe(true);
    section.maxUnrollOnlyEvenFrequencyOffsets = 1;
    expect(section.checkUnrollAllowed(10)).toBe(true);
    section.unrollOnlyEvenFrequencyOffsets = 1;
    expect(section.checkUnrollAllowed(0)).toBe(false);
    section.changeOrientation();
  });

  it("Streckengrafik-Model - Test - SgTrainrunNode   - 001", () => {
    const section: SgTrainrunNode = new SgTrainrunNode(
      0,
      0,
      "AA",
      20,
      0,
      0,
      true,
      new TrackData(3),
      new SgPathNode(0, 0, "TEST", 20, 10, 0, 0, new TrackData(2), undefined, false, 0, 12),
      undefined,
      undefined,
      undefined,
      false,
    );

    expect(section.checkUnrollAllowed(10)).toBe(true);

    const copyiedSection = SgTrainrunNode.copy(section);
    expect(copyiedSection.getId() !== section.getId()).toBe(true);

    expect(section.getTrainrunSection()).toBe(undefined);
    expect(section.getPathSection()).toBe(undefined);
    expect(section.getStartposition()).toBe(12);
    expect(section.getMinimumHeadwayTime()).toBe(2);
  });

  it("Streckengrafik-Model - Test - TrainrunItem  - 001", () => {
    const item0: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [],
      true,
      Direction.ROUND_TRIP,
    );

    const item1: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [],
      true,
      Direction.ROUND_TRIP,
    );

    const item2: TrainrunItem = new TrainrunItem(
      2,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [],
      true,
      Direction.ROUND_TRIP,
    );

    expect(item0.equal(item0)).toBe(true);
    expect(item0.equal(item1)).toBe(true);
    expect(item0.equal(item2)).toBe(false);
    expect(TrainrunItem.equalTrainrunItems([item0], [item0])).toBe(true);
    expect(TrainrunItem.equalTrainrunItems([item0], [item2])).toBe(false);
    expect(TrainrunItem.equalTrainrunItems([item0], [item1])).toBe(true);
    expect(TrainrunItem.equalTrainrunItems([item0, item1, item2], [item0, item1, item2])).toBe(
      true,
    );
    expect(TrainrunItem.equalTrainrunItems([item0, item2, item1], [item0, item1, item2])).toBe(
      true,
    );
    expect(TrainrunItem.equalTrainrunItems([], [])).toBe(true);
    expect(TrainrunItem.equalTrainrunItems([item0], [])).toBe(false);
    expect(TrainrunItem.equalTrainrunItems([item0], [item2, item1])).toBe(false);
    expect(TrainrunItem.equalTrainrunItems(undefined, [item2, item1])).toBe(true);
    expect(TrainrunItem.equalTrainrunItems([item0], undefined)).toBe(true);
    const a = [item0];
    expect(TrainrunItem.equalTrainrunItems(a, a)).toBe(true);
  });

  it("Streckengrafik-Model - Test - TrainrunItem  - 002", () => {
    const node0 = new PathNode(0, 0, 9, "AA", 10, new TrackData(2), false, undefined, false, false);
    const node1 = new PathNode(0, 0, 9, "BB", 10, new TrackData(2), false, undefined, false, false);

    const node2 = new PathNode(1, 2, 9, "CC", 10, new TrackData(1), true, undefined, false, false);

    const item0: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [node0],
      true,
      Direction.ROUND_TRIP,
    );

    const item1: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [node0, node1],
      true,
      Direction.ROUND_TRIP,
    );

    const item2: TrainrunItem = new TrainrunItem(
      2,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [node0, node1],
      true,
      Direction.ROUND_TRIP,
    );

    const item3: TrainrunItem = new TrainrunItem(
      2,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      item0.pathItems,
      true,
      Direction.ROUND_TRIP,
    );

    const item4: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [node2, node2],
      true,
      Direction.ROUND_TRIP,
    );

    expect(item0.equal(item0)).toBe(true);
    expect(item0.equal(item1)).toBe(false);
    expect(item0.equal(item2)).toBe(false);
    expect(item3.equal(item0)).toBe(false);
    expect(item3.equal(item3)).toBe(true);

    expect(item1.equal(item4)).toBe(false);
    expect(item4.equal(item3)).toBe(false);

    const pn = item3.pathItems[0];
    const pnC = pn.clone();
    expect(pn.equal(pnC)).toBe(true);
    expect(pnC.equal(pnC)).toBe(true);
    expect(pnC.getPathNode().nodeWidth()).toBe(60);
    expect(pn.isFilter()).toBe(false);
    expect(pn.travelTime()).toBe(1 / 60);
    expect(pn.shortKey()).toBe("9");
    expect(pn.zommedXPath(undefined)).toBe(0);
    expect(pn.xPathFix()).toBe(true);
    expect(pn.xPath()).toBe(0);
  });

  it("Streckengrafik-Model - Test - TrainrunItem  - 003", () => {
    const node0 = new PathNode(0, 0, 9, "AA", 10, new TrackData(2), false, undefined, false, true);
    expect(node0.xPath()).toBe(60);
    expect(node0.getPathSection()).toBe(undefined);
  });

  it("SgTrainrun test", () => {
    const s = new SgTrainrun(1, 60, 0, 12, 32, "test", "S", "S", [], undefined);

    expect(s.getId()).toBe(SgTrainrun.currentId - 1);
  });

  it("Streckengrafik-Model - Test - TrainrunItem  - 004", () => {
    const item0: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [],
      true,
      Direction.ROUND_TRIP,
    );

    const item1: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      item0.pathItems,
      true,
      Direction.ROUND_TRIP,
    );

    expect(item0.equal(item1)).toBe(true);
  });

  it("Streckengrafik-Model - Test - TrainrunItem  - 005", () => {
    const s1: PathSection = new PathSection(
      0,
      0,
      10,
      20,
      new TrackData(1),
      false,
      undefined,
      undefined,
      TrainrunBranchType.DepartureBranchOnly,
    );

    const item0: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [s1],
      true,
      Direction.ROUND_TRIP,
    );

    const item1: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [s1],
      true,
      Direction.ROUND_TRIP,
    );

    expect(item0.equal(item1)).toBe(true);
  });

  it("Streckengrafik-Model - Test - TrainrunItem  - 006", () => {
    const s1: PathSection = new PathSection(
      0,
      0,
      10,
      20,
      new TrackData(1),
      false,
      undefined,
      undefined,
      TrainrunBranchType.DepartureBranchOnly,
    );

    const s2: PathSection = new PathSection(
      0,
      0,
      10,
      20,
      new TrackData(1),
      false,
      undefined,
      undefined,
      TrainrunBranchType.DepartureBranchOnly,
    );

    const item0: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [s1],
      true,
      Direction.ROUND_TRIP,
    );

    const item1: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [s2, s1],
      true,
      Direction.ROUND_TRIP,
    );

    expect(item0.equal(item1)).toBe(false);
  });

  it("Streckengrafik-Model - Test - TrainrunItem  - 007", () => {
    const s1: PathSection = new PathSection(
      0,
      0,
      10,
      20,
      new TrackData(1),
      false,
      undefined,
      undefined,
      TrainrunBranchType.DepartureBranchOnly,
    );

    const s2: PathSection = new PathSection(
      0,
      0,
      10,
      20,
      new TrackData(1),
      false,
      undefined,
      undefined,
      TrainrunBranchType.DepartureBranchOnly,
    );

    const item0: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [s1],
      true,
      Direction.ROUND_TRIP,
    );

    const item1: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [s2],
      true,
      Direction.ROUND_TRIP,
    );

    expect(item0.equal(item1)).toBe(true);
  });

  it("Streckengrafik-Model - Test - TrainrunItem  - 008", () => {
    const s2: PathSection = new PathSection(
      0,
      0,
      11,
      20,
      new TrackData(1),
      false,
      undefined,
      undefined,
      TrainrunBranchType.DepartureBranchOnly,
    );

    const item0: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [],
      true,
      Direction.ROUND_TRIP,
    );

    const item1: TrainrunItem = new TrainrunItem(
      1,
      30,
      0,
      10,
      21,
      "test",
      "S",
      "S",
      [s2],
      true,
      Direction.ROUND_TRIP,
    );

    expect(item0.equal(item1)).toBe(false);
    expect(item1.equal(item0)).toBe(false);
  });

  it("SgTrainrunSection  test", () => {
    const s = new SgTrainrunSection(
      -1,
      0,
      0,
      10,
      0,
      0,
      "",
      "",
      "",
      "",
      false,
      0,
      new TrackData(1),
      undefined,
    );

    expect(s.getId()).toBe(SgTrainrunSection.currentId - 1);
  });
});
