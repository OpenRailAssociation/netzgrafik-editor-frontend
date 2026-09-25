import {TrainRunNodeComponent} from "./trainrun-node.component";
import {SgPathNode} from "../../model/streckengrafik-model/sg-path-node";
import {SgTrainrunNode} from "../../model/streckengrafik-model/sg-trainrun-node";
import {SgTrainrunSection} from "../../model/streckengrafik-model/sg-trainrun-section";
import {TrackData} from "../../model/trackData";

function createNode(): SgTrainrunNode {
  const pathNode = new SgPathNode(
    1,
    10,
    "N",
    "Node",
    20,
    10,
    undefined,
    undefined,
    new TrackData(2),
    false,
    true,
  );
  const node = new SgTrainrunNode(
    1,
    10,
    "N",
    100,
    20,
    10,
    false,
    new TrackData(1),
    pathNode,
    false,
  );
  node.trackOccupancy = {
    track: 2,
    arrivalTime: 10,
    departureTime: 20,
    headwayUntilTime: 25,
  };
  node.arrivalPathSection = new SgTrainrunSection(
    0,
    1,
    0,
    10,
    1,
    10,
    "A",
    "N",
    undefined,
    undefined,
    false,
    0,
    new TrackData(1),
    undefined,
  );
  node.departurePathSection = new SgTrainrunSection(
    2,
    2,
    20,
    30,
    10,
    20,
    "N",
    "B",
    undefined,
    undefined,
    true,
    0,
    new TrackData(1),
    undefined,
  );
  return node;
}

describe("TrainRunNodeComponent", () => {
  it("renders matrix occupancy and direction-derived connections", () => {
    const component = new TrainRunNodeComponent(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    component.sgTrainrunItem = createNode();
    component.trackOccupier = true;

    expect(component.pathGleisbelegung()).toBe("M 40 10 L 40 20");
    expect(component.pathHeadwayReservation()).toBe("M 40 20 L 40 25");
    expect(component.nodePath()).toBe("M 60 10 L 46 10 M 46 20 L 60 20");
  });
});
