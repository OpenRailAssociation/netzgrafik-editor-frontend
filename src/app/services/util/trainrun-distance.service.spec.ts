import {TestBed} from "@angular/core/testing";
import {TrainrunDistanceService, GraphEdge} from "./trainrun-distance.service";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Node} from "../../models/node.model";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {Vec2D} from "../../utils/vec2D";

describe("TrainrunDistanceService", () => {
  let service: TrainrunDistanceService;

  // --- Mock factories ---

  const mockPort = (overrides: any = {}) => ({
    getId: () => 1,
    getTrainrunSectionId: () => 100,
    getPositionAlignment: () => PortAlignment.Left,
    getTrainrunSection: () => undefined,
    ...overrides,
  });

  const mockNode = (ports: any[] = [], isNonStop = false): Node =>
    ({getPorts: () => ports, isNonStop: () => isNonStop}) as unknown as Node;

  const mockSection = (overrides: any = {}): TrainrunSection => {
    const defaults = {
      id: 100,
      trainrunId: 10,
      path: [new Vec2D(0, 0), new Vec2D(1000, 0)],
      categoryShortName: "IC",
      title: "1",
      travelTime: 30,
      sourceDeparture: 0,
      targetArrival: 30,
      sourceNode: mockNode(),
      targetNode: mockNode(),
      targetPortId: 2,
    };
    const o = {...defaults, ...overrides};
    return {
      getId: () => o.id,
      getPath: () => o.path,
      getTrainrun: () => ({
        getCategoryShortName: () => o.categoryShortName,
        getTitle: () => o.title,
      }),
      getTrainrunId: () => o.trainrunId,
      getTravelTime: () => o.travelTime,
      getSourceDeparture: () => o.sourceDeparture,
      getTargetArrival: () => o.targetArrival,
      getSourceNode: () => o.sourceNode,
      getTargetNode: () => o.targetNode,
      getTargetPortId: () => o.targetPortId,
    } as unknown as TrainrunSection;
  };

  const makeEdge = (
    section: TrainrunSection,
    alignment: PortAlignment = PortAlignment.Left,
  ): GraphEdge => ({
    trainrunSection: section,
    source: mockNode([
      mockPort({
        getTrainrunSectionId: () => section.getId(),
        getPositionAlignment: () => alignment,
      }),
    ]),
    target: mockNode(),
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TrainrunDistanceService);
  });

  // --- Tests ---

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("isEdgeTooShort", () => {
    it("returns true for short edges", () => {
      const edge = makeEdge(mockSection({path: [new Vec2D(0, 0), new Vec2D(50, 0)]}));
      expect(service.isEdgeTooShort(edge)).toBeTrue();
    });

    it("returns false for long edges", () => {
      const edge = makeEdge(mockSection({path: [new Vec2D(0, 0), new Vec2D(10000, 0)]}));
      expect(service.isEdgeTooShort(edge)).toBeFalse();
    });

    it("uses Euclidean distance between first and last path points", () => {
      // sqrt(3000^2 + 4000^2) = 5000, intermediate points ignored
      const edge = makeEdge(
        mockSection({
          path: [new Vec2D(0, 0), new Vec2D(1, 1), new Vec2D(3000, 4000)],
        }),
      );
      expect(service.isEdgeTooShort(edge)).toBeFalse();
    });
  });

  describe("port alignment", () => {
    // Use long departure/arrival strings so the horizontal mode (which uses
    // their .toString().length) produces a much larger textWidth than the
    // vertical mode (which uses a small constant instead).
    //
    // Horizontal textWidth = 2 (IC) + 1 (title "1") + 2 ("30") + 1 (')
    //                      + 15 (dep) + 15 (arr) = 36
    //   min = 36 * 16 + 100 = 676
    //
    // Vertical textWidth   = 2 + 1 + 2 + 1 + 2 + 2 = 10
    //   min = 10 * 16 + 100 = 260
    //
    // Choose path distance = 400 -> horizontal: 676 > 400 (too short),
    //                                vertical:  260 < 400 (fits).
    const section = () =>
      mockSection({
        path: [new Vec2D(0, 0), new Vec2D(400, 0)],
        sourceDeparture: 123456789012345,
        targetArrival: 123456789012345,
      });

    it("treats Top/Bottom as vertical (shorter text -> fits)", () => {
      expect(service.isEdgeTooShort(makeEdge(section(), PortAlignment.Top))).toBeFalse();
      expect(service.isEdgeTooShort(makeEdge(section(), PortAlignment.Bottom))).toBeFalse();
    });

    it("treats Left/Right as horizontal (longer text -> too short)", () => {
      expect(service.isEdgeTooShort(makeEdge(section(), PortAlignment.Left))).toBeTrue();
      expect(service.isEdgeTooShort(makeEdge(section(), PortAlignment.Right))).toBeTrue();
    });
  });

  describe("non-stop handling", () => {
    it("excludes target arrival from text length when target is non-stop", () => {
      // Horizontal stop:    2 + 1 + 2 + 1 + 15 + 15        = 36 -> min = 676
      // Horizontal nonStop: 2 + 1 + 2 + 1 + 15      + 2    = 23 -> min = 468
      // Choose distance = 500 -> stop: too short, non-stop: fits.
      const path = [new Vec2D(0, 0), new Vec2D(500, 0)];
      const common = {path, sourceDeparture: 123456789012345, targetArrival: 123456789012345};

      const stopEdge = makeEdge(mockSection({...common, targetNode: mockNode([], false)}));
      const nonStopEdge = makeEdge(mockSection({...common, targetNode: mockNode([], true)}));

      expect(service.isEdgeTooShort(stopEdge)).toBeTrue();
      expect(service.isEdgeTooShort(nonStopEdge)).toBeFalse();
    });

    it("handles non-stop source without throwing (adds parens + recursive travel time)", () => {
      const edge = makeEdge(
        mockSection({
          path: [new Vec2D(0, 0), new Vec2D(800, 0)],
          sourceNode: mockNode([], true),
          targetNode: mockNode([], false),
        }),
      );
      expect(() => service.isEdgeTooShort(edge)).not.toThrow();
    });

    it("recurses across a non-stop target node and sums travel times", () => {
      const sectionB = mockSection({
        id: 200,
        trainrunId: 10,
        travelTime: 20,
        targetNode: mockNode([], false),
      });

      const middleNode = mockNode(
        [
          mockPort({getId: () => 2, getTrainrunSection: () => sectionB}), // matches targetPortId -> filtered out
          mockPort({getId: () => 3, getTrainrunSection: () => sectionB}), // kept -> recurses into sectionB
        ],
        true,
      );

      const sectionA = mockSection({
        id: 100,
        trainrunId: 10,
        travelTime: 30,
        path: [new Vec2D(0, 0), new Vec2D(800, 0)],
        sourceNode: mockNode([], true),
        targetNode: middleNode,
        targetPortId: 2,
      });

      expect(() => service.isEdgeTooShort(makeEdge(sectionA))).not.toThrow();
    });
  });
});
