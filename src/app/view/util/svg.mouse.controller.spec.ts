import {SVGMouseController, SVGMouseControllerObserver} from "./svg.mouse.controller";
import {Vec2D} from "../../utils/vec2D";
import {ViewboxProperties} from "../../services/ui/ui.interaction.service";

class DummySVGMouseControllerObserver implements SVGMouseControllerObserver {
  onEarlyReturnFromMousemove(): boolean {
    return true;
  }

  onGraphContainerMouseup(mousePosition: Vec2D, onPaning: boolean) {}

  zoomFactorChanged(newZoomFactor: number) {}

  onViewboxChanged(viewboxProperties: ViewboxProperties) {}

  onStartMultiSelect() {}

  updateMultiSelect(topLeft: Vec2D, bottomRight: Vec2D) {}

  onEndMultiSelect() {}

  onScaleNetzgrafik(factor: number, scaleCenter: Vec2D) {}

  onCtrlKeyChanged(state: boolean) {}
}

describe("general view functions", () => {
  let viewboxProperties: ViewboxProperties;
  let dummySVGMouseControllerObserver: DummySVGMouseControllerObserver = null;

  beforeEach(() => {
    viewboxProperties = {
      currentViewBox: "0 0 1920 937",
      origHeight: 937,
      origWidth: 1920,
      panZoomHeight: 937,
      panZoomLeft: 0,
      panZoomTop: 0,
      panZoomWidth: 1920,
      zoomFactor: 100,
    };

    dummySVGMouseControllerObserver = new DummySVGMouseControllerObserver();
  });

  it("getCurrentMousePosition", () => {
    // not testable
  });

  it("onGraphContainerMousedown", () => {
    // not testable
  });

  it("fixViewbox - in", () => {
    const svgMouseController = new SVGMouseController(
      "graphContainer",
      dummySVGMouseControllerObserver,
      undefined,
    );
    svgMouseController.init(viewboxProperties);
    const prop = svgMouseController.getViewboxProperties();
    expect(prop.panZoomTop).toBe(0);
    expect(prop.panZoomLeft).toBe(0);
    expect(prop.panZoomHeight).toBe(937);
    expect(prop.panZoomWidth).toBe(1920);
    expect(prop.zoomFactor).toBe(100);
    svgMouseController.fixViewbox();
    svgMouseController.zoomIn(new Vec2D(1, 1));
    const postProp = svgMouseController.getViewboxProperties();
    expect(postProp.panZoomTop).toBe(0);
    expect(postProp.panZoomLeft).toBe(0);
    expect(postProp.panZoomHeight).toBe(937);
    expect(postProp.panZoomWidth).toBe(1920);
    expect(postProp.zoomFactor).toBe(100);
  });

  it("fixViewbox - out", () => {
    const svgMouseController = new SVGMouseController(
      "graphContainer",
      dummySVGMouseControllerObserver,
      undefined,
    );
    svgMouseController.init(viewboxProperties);
    const prop = svgMouseController.getViewboxProperties();
    expect(prop.panZoomTop).toBe(0);
    expect(prop.panZoomLeft).toBe(0);
    expect(prop.panZoomHeight).toBe(937);
    expect(prop.panZoomWidth).toBe(1920);
    expect(prop.zoomFactor).toBe(100);
    svgMouseController.fixViewbox();
    svgMouseController.zoomOut(new Vec2D(1, 1));
    const postProp = svgMouseController.getViewboxProperties();
    expect(postProp.panZoomTop).toBe(0);
    expect(postProp.panZoomLeft).toBe(0);
    expect(postProp.panZoomHeight).toBe(937);
    expect(postProp.panZoomWidth).toBe(1920);
    expect(postProp.zoomFactor).toBe(100);
  });

  it("zoomIn", () => {
    const svgMouseController = new SVGMouseController(
      "graphContainer",
      dummySVGMouseControllerObserver,
      undefined,
    );
    svgMouseController.init(viewboxProperties);
    const prop = svgMouseController.getViewboxProperties();
    expect(prop.panZoomTop).toBe(0);
    expect(prop.panZoomLeft).toBe(0);
    expect(prop.panZoomHeight).toBe(937);
    expect(prop.panZoomWidth).toBe(1920);
    svgMouseController.zoomIn(new Vec2D(468.5, 960));
    const postProp = svgMouseController.getViewboxProperties();
    expect(postProp.zoomFactor).toBe(110);
  });

  it("zoomOut", () => {
    const svgMouseController = new SVGMouseController(
      "graphContainer",
      dummySVGMouseControllerObserver,
      undefined,
    );
    svgMouseController.init(viewboxProperties);
    const prop = svgMouseController.getViewboxProperties();
    expect(prop.panZoomTop).toBe(0);
    expect(prop.panZoomLeft).toBe(0);
    expect(prop.panZoomHeight).toBe(937);
    expect(prop.panZoomWidth).toBe(1920);
    expect(prop.zoomFactor).toBe(100);

    svgMouseController.zoomOut(new Vec2D(468.5, 960));
    const postProp = svgMouseController.getViewboxProperties();
    expect(postProp.zoomFactor).toBe(90);
  });
});
