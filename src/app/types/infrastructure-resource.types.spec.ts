import {
  createDefaultNodeInfrastructure,
  InfrastructureDataSource,
} from "./infrastructure-resource.types";

describe("createDefaultNodeInfrastructure", () => {
  it("creates the standard manual node infrastructure", () => {
    const infrastructure = createDefaultNodeInfrastructure();

    expect(infrastructure.platformTrackCount).toBe(2);
    expect(infrastructure.throughTrackCount).toBe(0);
    expect(infrastructure.sidingTrackCount).toBe(0);
    expect(infrastructure.source).toBe(InfrastructureDataSource.Manual);
    expect(new Date(infrastructure.lastUpdatedAt).toString()).not.toBe("Invalid Date");
  });
});