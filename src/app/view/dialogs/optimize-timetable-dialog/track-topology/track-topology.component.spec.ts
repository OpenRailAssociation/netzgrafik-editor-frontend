import {EdgeTrackKpi} from "../../../../services/optimization/optimize-timetable.model";
import {TrackTopologyComponent} from "./track-topology.component";

describe("TrackTopologyComponent", () => {
  let component: TrackTopologyComponent;

  function setTrackCount(tracks: number, maxTracks = 2, trackLimitEnabled = false): void {
    component.edge = {
      edgeId: "edge",
      inScope: true,
      fromNodeName: "A",
      toNodeName: "B",
      tracksBefore: tracks,
      tracksAfter: tracks,
      trackSegments: [{start: 0.2, end: 0.8, tracks}],
    } satisfies EdgeTrackKpi;
    component.maxTracks = maxTracks;
    component.trackLimitEnabled = trackLimitEnabled;
    component.ngOnChanges();
  }

  beforeEach(() => {
    component = new TrackTopologyComponent();
  });

  it("shows one dotted placeholder when no tracks are occupied", () => {
    setTrackCount(0);

    expect(component.topologyLines.map((line) => line.trackNumber)).toEqual([1]);
    expect(component.topologyLines.map((line) => line.occupied)).toEqual([false]);
  });

  it("shows track 1 at 0px and only track 2 dotted at -3px", () => {
    setTrackCount(1);

    expect(component.topologyLines.length).toBe(2);
    expect(component.topologyLines.map((line) => line.trackNumber)).toEqual([2, 1]);
    expect(component.topologyLines.map((line) => line.occupied)).toEqual([false, true]);
    expect(component.topologyLines.map((line) => line.y)).toEqual([
      13.5 / 33,
      16.5 / 33,
    ]);
  });

  it("occupies tracks 1 and 2 at their numbered positions", () => {
    setTrackCount(2);

    expect(component.topologyLines.map((line) => line.trackNumber)).toEqual([2, 1]);
    expect(component.topologyLines.map((line) => line.occupied)).toEqual([true, true]);
  });

  it("shows three occupied lanes and one dotted lane for three tracks", () => {
    setTrackCount(3);

    expect(component.topologyLines.map((line) => line.occupied)).toEqual([true, true, true, false]);
    expect(component.topologyLines.map((line) => line.y)).toEqual([
      10.5 / 33,
      13.5 / 33,
      16.5 / 33,
      19.5 / 33,
    ]);
  });

  it("shows all four lanes as occupied for four tracks", () => {
    setTrackCount(4);

    expect(component.topologyLines.map((line) => line.occupied)).toEqual([true, true, true, true]);
    expect(component.topologyLines.map((line) => line.y)).toEqual([
      10.5 / 33,
      13.5 / 33,
      16.5 / 33,
      19.5 / 33,
    ]);
  });

  it("warns only occupied lanes beyond an enabled track limit", () => {
    setTrackCount(3, 2, true);

    expect(component.topologyLines.map((line) => line.overLimit)).toEqual([
      true,
      false,
      false,
      false,
    ]);

    setTrackCount(3, 2);

    expect(component.topologyLines.every((line) => !line.overLimit)).toBeTrue();
  });

  it("sizes count boxes by track count and centers them", () => {
    const expectedBounds: Record<number, [number, number]> = {
      5: [7, 20],
      6: [7, 23],
      7: [4, 23],
      8: [4, 26],
      9: [1, 26],
      10: [1, 29],
      11: [0, 31],
      12: [0, 33],
      13: [0, 33],
    };

    Object.entries(expectedBounds).forEach(([trackCount, [boxTop, boxBottom]]) => {
      const tracks = Number(trackCount);
      setTrackCount(tracks);

      const [box] = component.topologyCountBoxes;

      expect(component.topologyLines).toEqual([]);
      expect(box.x).toBe(0.5);
      expect(box.centerY).toBe((boxTop + boxBottom) / 2);
      expect(box.height).toBe(boxBottom - boxTop);
      expect(box.d).toBe(`M 0.2 ${boxTop} L 0.8 ${boxTop} L 0.8 ${boxBottom} L 0.2 ${boxBottom} Z`);
      expect(box.value).toBe(String(tracks));
    });
  });

  it("scales normalized segment positions to the available width", () => {
    component.edge = {
      edgeId: "edge",
      inScope: true,
      fromNodeName: "A",
      toNodeName: "B",
      tracksBefore: 2,
      tracksAfter: 3,
      trackSegments: [
        {start: 0.2, end: 0.5, tracks: 2},
        {start: 0.5, end: 0.8, tracks: 3},
      ],
    };
    component.ngOnChanges();

    component.topologyLines.slice(0, 2).forEach((line) => {
      expect(line.x1).toBeCloseTo(0.2);
      expect(line.x2).toBeCloseTo(0.5);
    });
    component.topologyLines.slice(2).forEach((line) => {
      expect(line.x1).toBeCloseTo(0.5);
      expect(line.x2).toBeCloseTo(0.8);
    });
  });

  it("warns the count label when an enabled track limit is exceeded", () => {
    setTrackCount(5, 4, true);

    expect(component.topologyCountBoxes[0].overLimit).toBeTrue();

    setTrackCount(5, 4);

    expect(component.topologyCountBoxes[0].overLimit).toBeFalse();
  });
});
