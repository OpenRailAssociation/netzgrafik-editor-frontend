import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, merge, Observable, Subject} from "rxjs";
import {auditTime, takeUntil} from "rxjs/operators";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {NodeService} from "../data/node.service";
import {ResourceService} from "../data/resource.service";
import {TrainrunService} from "../data/trainrun.service";
import {TrainrunSectionService} from "../data/trainrunsection.service";
import {
  InfrastructureGraph,
  InfrastructureGraphNode,
  InfrastructureGraphSection,
} from "./infrastructure-graph";
import {
  calculateInfrastructureOccupation,
  InfrastructureOccupation,
  NodeTrackOccupation,
} from "./infrastructure-occupation.calculator";
import {
  calculateSectionTrackRequirements,
  SectionTrackRequirement,
  SectionTrackSegment,
} from "./section-track-requirement.calculator";

export type InfrastructureTrackSegment = SectionTrackSegment;

export interface SectionInfrastructure {
  sourceNodeId: number;
  targetNodeId: number;
  resourceIds: number[];
  trackSegments: InfrastructureTrackSegment[];
}

@Injectable({
  providedIn: "root",
})
export class InfrastructureService implements OnDestroy {
  private readonly graphSubject = new BehaviorSubject<InfrastructureGraph>(
    new InfrastructureGraph([], [], []),
  );
  private readonly occupationSubject = new BehaviorSubject<InfrastructureOccupation>({
    horizonMinutes: 60,
    nodeOccupations: new Map(),
    sectionTopology: [],
  });
  private sectionRequirementsByKey = new Map<string, SectionTrackRequirement>();
  private trainrunSections: TrainrunSection[] = [];
  private horizonMinutes = 60;
  private readonly destroyed$ = new Subject<void>();

  constructor(
    private readonly nodeService: NodeService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly trainrunService: TrainrunService,
    private readonly resourceService: ResourceService,
  ) {
    merge(
      this.nodeService.nodes,
      this.trainrunSectionService.trainrunSections,
      this.trainrunService.trainruns,
      this.resourceService.resourceObservable,
    )
      .pipe(auditTime(0), takeUntil(this.destroyed$))
      .subscribe(() => this.recalculate());
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  getInfrastructure(): Observable<InfrastructureGraph> {
    return this.graphSubject.asObservable();
  }

  getNodeInfrastructure(nodeId: number): InfrastructureGraphNode | undefined {
    return this.graphSubject.value.getNode(nodeId);
  }

  getNodeOccupation(nodeId: number): NodeTrackOccupation | undefined {
    return this.occupationSubject.value.nodeOccupations.get(nodeId);
  }

  getNodeOccupations(): Observable<InfrastructureOccupation> {
    return this.occupationSubject.asObservable();
  }

  getSectionInfrastructure(
    sourceNodeId: number,
    targetNodeId: number,
  ): SectionInfrastructure | undefined {
    const section = this.graphSubject.value.getSection(sourceNodeId, targetNodeId);
    if (section === undefined) {
      return undefined;
    }
    const infrastructure = this.toSectionInfrastructure(section);
    return section.sourceNodeId === sourceNodeId
      ? infrastructure
      : {
          ...infrastructure,
          sourceNodeId,
          targetNodeId,
          trackSegments: infrastructure.trackSegments
            .slice()
            .reverse()
            .map(([start, end, trackCount]) => [1 - end, 1 - start, trackCount]),
        };
  }

  private recalculate() {
    const nodes = this.nodeService.getNodes();
    const trainrunSections = this.trainrunSectionService.getTrainrunSections();
    const resources = this.resourceService.getResources();
    const occupation = calculateInfrastructureOccupation(nodes, trainrunSections, resources);
    this.trainrunSections = trainrunSections;
    this.horizonMinutes = occupation.horizonMinutes;
    this.sectionRequirementsByKey.clear();
    this.graphSubject.next(new InfrastructureGraph(nodes, trainrunSections, resources));
    this.occupationSubject.next(occupation);
  }

  private toSectionInfrastructure(section: InfrastructureGraphSection): SectionInfrastructure {
    return {
      sourceNodeId: section.sourceNodeId,
      targetNodeId: section.targetNodeId,
      resourceIds: section.resourceIds,
      trackSegments: section.resources.flatMap((resource) =>
        this.getSectionTrackRequirement(section.sourceNodeId, section.targetNodeId, resource.resourceId)
          ?.trackSegments ?? [],
      ),
    };
  }

  private getSectionTrackRequirement(
    sourceNodeId: number,
    targetNodeId: number,
    resourceId: number,
  ): SectionTrackRequirement | undefined {
    const key = this.sectionKey({sourceNodeId, targetNodeId, resourceId});
    const cachedRequirement = this.sectionRequirementsByKey.get(key);
    if (cachedRequirement !== undefined) {
      return cachedRequirement;
    }
    const matchingSections = this.trainrunSections.filter(
      (section) =>
        section.getResourceId() === resourceId &&
        ((section.getSourceNodeId() === sourceNodeId &&
          section.getTargetNodeId() === targetNodeId) ||
          (section.getSourceNodeId() === targetNodeId &&
            section.getTargetNodeId() === sourceNodeId)),
    );
    const requirement = calculateSectionTrackRequirements(
      matchingSections,
      this.horizonMinutes,
    )[0];
    if (requirement !== undefined) {
      this.sectionRequirementsByKey.set(key, requirement);
    }
    return requirement;
  }

  private sectionKey(section: Pick<SectionTrackRequirement, "sourceNodeId" | "targetNodeId" | "resourceId">): string {
    return `${section.sourceNodeId}:${section.targetNodeId}:${section.resourceId}`;
  }
}