import {Trainrun} from "./trainrun.model";
import {Direction} from "../data-structures/business.data.structures";

describe("Trainrun Model", () => {
  it("default direction is ROUND_TRIP", () => {
    const t = new Trainrun();
    expect(t.isRoundTrip()).toBe(true);
    expect(t.getDirection()).toBe(Direction.ROUND_TRIP);
  });

  it("constructs with ONE_WAY direction", () => {
    const t = new Trainrun({
      id: 1,
      name: "Test",
      categoryId: 1,
      frequencyId: 1,
      trainrunTimeCategoryId: 1,
      labelIds: [],
      direction: Direction.ONE_WAY,
    });
    expect(t.isRoundTrip()).toBe(false);
    expect(t.getDirection()).toBe(Direction.ONE_WAY);
  });

  it("setDirection changes direction", () => {
    const t = new Trainrun();
    t.setDirection(Direction.ONE_WAY);
    expect(t.isRoundTrip()).toBe(false);
    expect(t.getDirection()).toBe(Direction.ONE_WAY);
  });
});
