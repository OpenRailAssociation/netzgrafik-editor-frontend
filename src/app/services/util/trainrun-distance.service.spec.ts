import {TrainrunDistanceService} from "./trainrun-distance.service";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {Node} from "../../models/node.model";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {Vec2D} from "../../utils/vec2D";

describe("TrainrunDistanceService", () => {
  let service: TrainrunDistanceService;
  let measureTextWidthSpy: jasmine.Spy;

  const mockPort = (overrides: any = {}) => ({
    getId: () => 1,
    getTrainrunSectionId: () => 100,
    getPositionAlignment: () => PortAlignment.Left,
    getTrainrunSection: () => undefined,
    ...overrides,
  });

  const mockNode = (ports: any[] = [], isNonStop = false): Node =>
    ({
      getPorts: () => ports,
      isNonStop: () => isNonStop,
    }) as unknown as Node;

  const mockSourceNode = (
    sectionId = 100,
    alignment: PortAlignment = PortAlignment.Left,
    isNonStop = false,
  ): Node =>
    mockNode(
      [
        mockPort({
          getTrainrunSectionId: () => sectionId,
          getPositionAlignment: () => alignment,
        }),
      ],
      isNonStop,
    );

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
      sourceAlignment: PortAlignment.Left,
      sourceIsNonStop: false,
      targetIsNonStop: false,
      sourceNode: undefined,
      targetNode: undefined,
      targetPortId: 2,
    };

    const o = {...defaults, ...overrides};

    const sourceNode = o.sourceNode ?? mockSourceNode(o.id, o.sourceAlignment, o.sourceIsNonStop);

    const targetNode = o.targetNode ?? mockNode([], o.targetIsNonStop);

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
      getSourceNode: () => sourceNode,
      getTargetNode: () => targetNode,
      getTargetPortId: () => o.targetPortId,
    } as unknown as TrainrunSection;
  };

  beforeEach(() => {
    service = new TrainrunDistanceService();

    measureTextWidthSpy = spyOn<any>(service, "measureTextWidth").and.callFake(
      (text: string) => text.length,
    );
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("getMinSectionLengthInPx", () => {
    it("is based on the measured text width of category, title, travel time and timings", () => {
      const section = mockSection();

      service.getMinSectionLengthInPx(section);

      expect(measureTextWidthSpy).toHaveBeenCalledOnceWith("IC1'30030");
    });

    it("returns a strictly positive number", () => {
      const section = mockSection();
      expect(service.getMinSectionLengthInPx(section)).toBeGreaterThan(0);
    });

    it("scales linearly with the measured text width", () => {
      // Two sections that only differ in the length of their title => only the
      // measured text differs. The relationship between their results must be
      // linear (textWidth * factor + margin).
      const shortSection = mockSection({title: "1"});
      const longSection = mockSection({title: "1234567890"});

      const shortLen = service.getMinSectionLengthInPx(shortSection);
      const longLen = service.getMinSectionLengthInPx(longSection);

      // Difference must equal exactly the difference in measured text width
      // multiplied by the (unknown) factor. We just check it's >0 and stable.
      expect(longLen).toBeGreaterThan(shortLen);

      // A third data point lets us verify linearity without knowing constants.
      const mediumSection = mockSection({title: "12345"});
      const mediumLen = service.getMinSectionLengthInPx(mediumSection);

      const factorA = (longLen - shortLen) / ("1234567890".length - "1".length);
      const factorB = (mediumLen - shortLen) / ("12345".length - "1".length);
      expect(factorA).toBeCloseTo(factorB, 6);
    });

    it("does not use the path length", () => {
      const shortPathSection = mockSection({
        path: [new Vec2D(0, 0), new Vec2D(50, 0)],
      });
      const longPathSection = mockSection({
        path: [new Vec2D(0, 0), new Vec2D(10000, 0)],
      });

      expect(service.getMinSectionLengthInPx(shortPathSection)).toBe(
        service.getMinSectionLengthInPx(longPathSection),
      );
    });
  });

  describe("port alignment", () => {
    const longTimeSection = (alignment: PortAlignment) =>
      mockSection({
        sourceAlignment: alignment,
        sourceDeparture: 123456789012345,
        targetArrival: 123456789012345,
      });

    it("treats Top and Bottom as vertical (same result for both)", () => {
      const top = service.getMinSectionLengthInPx(longTimeSection(PortAlignment.Top));
      const bottom = service.getMinSectionLengthInPx(longTimeSection(PortAlignment.Bottom));
      expect(top).toBe(bottom);
    });

    it("treats Left and Right as horizontal (same result for both)", () => {
      const left = service.getMinSectionLengthInPx(longTimeSection(PortAlignment.Left));
      const right = service.getMinSectionLengthInPx(longTimeSection(PortAlignment.Right));
      expect(left).toBe(right);
    });

    it("includes departure and arrival times in measured text for horizontal alignment", () => {
      service.getMinSectionLengthInPx(longTimeSection(PortAlignment.Left));
      expect(measureTextWidthSpy).toHaveBeenCalledOnceWith(
        `IC1'30${123456789012345}${123456789012345}`,
      );
    });

    it("excludes departure and arrival times from measured text for vertical alignment", () => {
      service.getMinSectionLengthInPx(longTimeSection(PortAlignment.Top));
      expect(measureTextWidthSpy).toHaveBeenCalledOnceWith("IC1'30");
    });

    it("makes horizontal sections (with long times) longer than vertical ones", () => {
      // For long source/target times the horizontal variant must produce a
      // larger min length because the times contribute to the measured text.
      const horizontal = service.getMinSectionLengthInPx(longTimeSection(PortAlignment.Left));
      const vertical = service.getMinSectionLengthInPx(longTimeSection(PortAlignment.Top));
      expect(horizontal).toBeGreaterThan(vertical);
    });
  });

  describe("non-stop handling", () => {
    it("excludes target arrival from horizontal text when target is non-stop and adds parentheses", () => {
      const common = {
        sourceDeparture: 123456789012345,
        targetArrival: 123456789012345,
      };

      const stopSection = mockSection({
        ...common,
        targetNode: mockNode([], false),
      });

      const nonStopSection = mockSection({
        ...common,
        targetNode: mockNode([], true),
      });

      service.getMinSectionLengthInPx(stopSection);
      expect(measureTextWidthSpy).toHaveBeenCalledOnceWith(
        `IC1'30${123456789012345}${123456789012345}`,
      );

      measureTextWidthSpy.calls.reset();

      service.getMinSectionLengthInPx(nonStopSection);
      expect(measureTextWidthSpy).toHaveBeenCalledOnceWith(`IC1'30${123456789012345}()`);

      // And the resulting min length must be smaller for the non-stop case
      // (less text to fit).
      expect(service.getMinSectionLengthInPx(nonStopSection)).toBeLessThan(
        service.getMinSectionLengthInPx(stopSection),
      );
    });

    it("adds parentheses and calculated travel time when source is non-stop and target is not", () => {
      const section = mockSection({
        sourceDeparture: 123456789012345,
        targetArrival: 123456789012345,
        sourceNode: mockSourceNode(100, PortAlignment.Left, true),
        targetNode: mockNode([], false),
        travelTime: 30,
      });

      service.getMinSectionLengthInPx(section);

      expect(measureTextWidthSpy).toHaveBeenCalledOnceWith(
        `IC1'30${123456789012345}${123456789012345}()(30)`,
      );
    });

    it("handles a target non-stop node without throwing", () => {
      const section = mockSection({
        targetNode: mockNode([], true),
      });

      expect(() => service.getMinSectionLengthInPx(section)).not.toThrow();
    });
  });
});
