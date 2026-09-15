export interface SectionResourceReference {
  sourceNodeId: number;
  targetNodeId: number;
  resourceId: number;
}

export function findSharedSectionResourceId(
  sections: SectionResourceReference[],
  sourceNodeId: number,
  targetNodeId: number,
): number | undefined {
  return sections.find(
    (section) =>
      section.resourceId !== 0 &&
      ((section.sourceNodeId === sourceNodeId && section.targetNodeId === targetNodeId) ||
        (section.sourceNodeId === targetNodeId && section.targetNodeId === sourceNodeId)),
  )?.resourceId;
}