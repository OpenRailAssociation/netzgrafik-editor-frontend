import {
  createDefaultNodeInfrastructure,
  findSharedSectionResourceId,
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

describe("findSharedSectionResourceId", () => {
  it("shares one resource for trainrun sections between the same two nodes", () => {
    const sections = [
      {sourceNodeId: 1, targetNodeId: 2, resourceId: 12},
      {sourceNodeId: 2, targetNodeId: 3, resourceId: 23},
    ];

    expect(findSharedSectionResourceId(sections, 1, 2)).toBe(12);
    expect(findSharedSectionResourceId(sections, 2, 1)).toBe(12);
    expect(findSharedSectionResourceId(sections, 1, 3)).toBeUndefined();
  });
});