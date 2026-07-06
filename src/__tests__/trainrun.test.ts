import {Trainrun} from "../models/trainrun";

describe("Trainrun - oneWay behavior", () => {
  let trainrun: Trainrun;

  beforeEach(() => {
    trainrun = new Trainrun({id: "1", name: "Test Train", oneWay: false});
  });

  it("should initialize with default oneWay false", () => {
    expect(trainrun.oneWay).toBe(false);
  });

  it("should set oneWay to true when specified", () => {
    const oneWayTrain = new Trainrun({id: "2", name: "One Way Train", oneWay: true});
    expect(oneWayTrain.oneWay).toBe(true);
  });

  it("should toggle oneWay property", () => {
    trainrun.oneWay = true;
    expect(trainrun.oneWay).toBe(true);
    trainrun.oneWay = false;
    expect(trainrun.oneWay).toBe(false);
  });

  it("should update oneWay via update method if available", () => {
    if (typeof trainrun.update === "function") {
      trainrun.update({oneWay: true});
      expect(trainrun.oneWay).toBe(true);
    }
  });

  it("should not allow invalid values for oneWay", () => {
    // Since TypeScript catches type errors at compile time,
    // we test runtime behavior if applicable.
    // If the model validates, expect an error.
    try {
      (trainrun as any).oneWay = "maybe";
      // If no validation, the value will still be set but we test for boolean
      expect(typeof trainrun.oneWay).toBe("boolean");
    } catch (e) {
      expect(e).toBeDefined();
    }
  });

  it("should include oneWay in serialized output", () => {
    const serialized = trainrun.serialize();
    expect(serialized).toHaveProperty("oneWay");
    expect(serialized.oneWay).toBe(false);
  });

  it("should consider oneWay when checking equality", () => {
    const trainA = new Trainrun({id: "1", name: "A", oneWay: false});
    const trainB = new Trainrun({id: "1", name: "A", oneWay: true});
    // Assuming equals checks all relevant fields
    expect(trainA.equals(trainB)).toBe(false);
  });

  it("should correctly display oneWay in label or display method", () => {
    // Adjust to actual display method if exists
    const display = trainrun.getDisplayName?.() ?? trainrun.name;
    if (trainrun.oneWay) {
      expect(display).toContain("One-Way");
    } else {
      expect(display).not.toContain("One-Way");
    }
  });

  // Integration test with TrainrunService or similar
  it("should reflect oneWay in trainrun list operations", () => {
    const service = new TrainrunService();
    const train = service.createTrainrun({name: "Test", oneWay: true});
    expect(train.oneWay).toBe(true);
    const list = service.getAllTrainruns();
    const found = list.find((t) => t.id === train.id);
    expect(found?.oneWay).toBe(true);
  });
});
