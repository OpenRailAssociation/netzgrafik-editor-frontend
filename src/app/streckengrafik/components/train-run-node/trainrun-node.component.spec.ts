import {TrainRunNodeComponent} from "./trainrun-node.component";
import {SgPathNode} from "../../model/streckengrafik-model/sg-path-node";
import {SgTrainrunNode} from "../../model/streckengrafik-model/sg-trainrun-node";
import {SgTrainrunSection} from "../../model/streckengrafik-model/sg-trainrun-section";
import {SgPathSection} from "../../model/streckengrafik-model/sg-path-section";
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
  pathNode.startPosition = 40;
  node.trackReservations = [
    {
      trainrunId: 100,
      occurrenceIndex: 0,
      track: 2,
      arrivalTime: 10,
      departureTime: 20,
      headwayUntilTime: 25,
    },
    {
      trainrunId: 100,
      occurrenceIndex: 1,
      track: 1,
      arrivalTime: 130,
      departureTime: 140,
      headwayUntilTime: 145,
    },
  ];
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
    new SgPathSection(
      0,
      1,
      0,
      10,
      1,
      10,
      "A",
      "N",
      new TrackData(1),
      false,
      false,
      0,
      20,
    ),
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
    new SgPathSection(
      2,
      2,
      20,
      30,
      10,
      20,
      "N",
      "B",
      new TrackData(1),
      false,
      false,
      0,
      60,
    ),
  );
  return node;
}

describe("TrainRunNodeComponent", () => {
  it("renders matrix occupancy and path-order connections", () => {
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
    expect(component.nodePaths()).toEqual(["M 0 10 L 34 10", "M 46 20 L 60 20"]);
    expect(component.nodePath()).toBe("M 0 10 L 34 10 M 46 20 L 60 20");

    component.trackOccupier = false;
    expect(component.collapsedNodePath()).toBe("M 0 10 L 0 20");

    component.offset = 120;
    component.trackOccupier = true;
    expect(component.pathGleisbelegung()).toBe("M 20 10 L 20 20");
    expect(component.pathHeadwayReservation()).toBe("M 20 20 L 20 25");

    component.offset = 60;
    expect(component.pathGleisbelegung()).toBe("");
    expect(component.pathHeadwayReservation()).toBe("");
  });

  it("uses section endpoints when turnaround positions are not distinct", () => {
    const component = new TrainRunNodeComponent(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    const node = createNode();
    node.sgPathNode.startPosition = 0;
    node.arrivalPathSection.pathSection.startPosition = 0;
    node.departurePathSection.pathSection.startPosition = 0;
    node.arrivalPathSection.pathSection.arrivalPathNode = node.sgPathNode;
    node.departurePathSection.pathSection.departurePathNode = node.sgPathNode;
    component.sgTrainrunItem = node;
    component.trackOccupier = true;

    expect(component.nodePath()).toBe("M 0 10 L 34 10 M 46 20 L 60 20");
  });

  it("uses concrete section neighbors for forward through nodes", () => {
    const component = new TrainRunNodeComponent(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    const node = createNode();
    const leftNeighborNode = createNode();
    leftNeighborNode.sgPathNode.startPosition = 20;
    const rightNeighborNode = createNode();
    rightNeighborNode.sgPathNode.startPosition = 60;
    node.arrivalPathSection.arrivalPathNode = node;
    node.arrivalPathSection.departurePathNode = leftNeighborNode;
    node.departurePathSection.departurePathNode = node;
    node.departurePathSection.arrivalPathNode = rightNeighborNode;
    node.arrivalPathSection.pathSection.startPosition = 60;
    node.departurePathSection.pathSection.startPosition = 20;
    component.sgTrainrunItem = node;
    component.trackOccupier = true;

    expect(component.nodePath()).toBe("M 0 10 L 34 10 M 46 20 L 60 20");
  });

  it("uses incoming and outgoing neighbors for reverse departures", () => {
    const component = new TrainRunNodeComponent(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    const node = createNode();
    const rightNeighbor = new SgPathNode(
      2,
      2,
      "C",
      "C",
      0,
      0,
      undefined,
      undefined,
      new TrackData(1),
      false,
      false,
      0,
      60,
    );
    const leftNeighbor = new SgPathNode(
      0,
      1,
      "A",
      "A",
      0,
      0,
      undefined,
      undefined,
      new TrackData(1),
      false,
      false,
      0,
      20,
    );
    node.arrivalPathSection.backward = true;
    const rightNeighborNode = createNode();
    rightNeighborNode.sgPathNode = rightNeighbor;
    const leftNeighborNode = createNode();
    leftNeighborNode.sgPathNode = leftNeighbor;
    node.arrivalPathSection.arrivalPathNode = node;
    node.arrivalPathSection.departurePathNode = rightNeighborNode;
    node.departurePathSection.departurePathNode = node;
    node.departurePathSection.arrivalPathNode = leftNeighborNode;
    component.sgTrainrunItem = node;
    component.trackOccupier = true;

    expect(component.nodePath()).toBe("M 60 10 L 46 10 M 34 20 L 0 20");
  });

  it("renders one TransitLine at a one-way start node", () => {
    const component = new TrainRunNodeComponent(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    const node = createNode();
    node.arrivalPathSection = undefined;
    component.sgTrainrunItem = node;
    component.trackOccupier = true;

    expect(component.nodePaths().length).toBe(1);
    expect(component.nodePath()).toBe("M 46 20 L 60 20");
  });

  it("renders one TransitLine at a one-way end node", () => {
    const component = new TrainRunNodeComponent(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    const node = createNode();
    node.departurePathSection = undefined;
    component.sgTrainrunItem = node;
    component.trackOccupier = true;

    expect(component.nodePaths().length).toBe(1);
    expect(component.nodePath()).toBe("M 0 10 L 34 10");
  });

  it("renders a rolled-out reservation without a base occupancy", () => {
    const component = new TrainRunNodeComponent(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    const node = createNode();
    node.arrivalTime = -1;
    node.departureTime = 16;
    node.trackReservations = [
      {
        trainrunId: 100,
        occurrenceIndex: 4,
        track: 1,
        arrivalTime: 119,
        departureTime: 136,
        headwayUntilTime: 138,
      },
    ];
    component.sgTrainrunItem = node;
    component.trackOccupier = true;
    component.offset = 120;

    expect(component.pathGleisbelegung()).toBe("M 20 -1 L 20 16");
    expect(component.pathHeadwayReservation()).toBe("M 20 16 L 20 18");
  });
});
