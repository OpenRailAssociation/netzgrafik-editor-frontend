import {Component, OnDestroy, OnInit, ChangeDetectionStrategy} from "@angular/core";
import {Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {TrainrunSection} from "../../../../models/trainrunsection.model";
import {Node} from "../../../../models/node.model";
import {Resource} from "../../../../models/resource.model";
import {
  InfrastructureService,
  InfrastructureTrackSegment,
} from "../../../../services/analytics/infrastructure.service";
import {ResourceService} from "../../../../services/data/resource.service";
import {TrainrunService} from "../../../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../../../services/data/trainrunsection.service";
import {findSharedSectionResourceId} from "../../../../types/infrastructure-resource.types";
import {TrainrunsectionHelper} from "../../../../services/util/trainrunsection.helper";

type CorridorItem = CorridorNode | CorridorSection;

interface CorridorNode {
  type: "node";
  node: Node;
}

interface CorridorSection {
  type: "section";
  resourceId: number;
  trackCapacity: number;
  trackSegments: InfrastructureTrackSegment[];
}

@Component({
  selector: "sbb-trainrun-section-infrastructure-tab",
  templateUrl: "./trainrun-section-infrastructure-tab.component.html",
  styleUrls: ["./trainrun-section-infrastructure-tab.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TrainrunSectionInfrastructureTabComponent implements OnInit, OnDestroy {
  public selectedTrainrunSection: TrainrunSection;
  public trackSegments: InfrastructureTrackSegment[] = [];
  public corridorItems: CorridorItem[] = [];
  private readonly trainrunSectionHelper: TrainrunsectionHelper;
  private readonly destroyed$ = new Subject<void>();

  constructor(
    private resourceService: ResourceService,
    private trainrunSectionService: TrainrunSectionService,
    private infrastructureService: InfrastructureService,
    private trainrunService: TrainrunService,
  ) {
    this.trainrunSectionHelper = new TrainrunsectionHelper(trainrunService);
  }

  ngOnInit(): void {
    this.selectedTrainrunSection = this.trainrunSectionService.getSelectedTrainrunSection();
    this.getOrCreateSectionResource(
      this.selectedTrainrunSection.getSourceNodeId(),
      this.selectedTrainrunSection.getTargetNodeId(),
    );
    this.infrastructureService
      .getInfrastructure()
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => this.updateTrackSegments());
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  onTrackCapacityChanged(resourceId: number, trackCapacity: number | undefined) {
    this.resourceService.changeCapacity(
      resourceId,
      Math.max(1, trackCapacity ?? 1),
    );
  }

  getTrackSegmentsText(): string {
    return `[${this.trackSegments.map(([start, end, tracks]) => `(${start}, ${end}, ${tracks})`).join(", ")}]`;
  }

  getTrackIndexes(trackCount: number): number[] {
    return Array.from({length: trackCount}, (_, index) => index);
  }

  getVisibleTrackCount(trackCount: number): number {
    return Math.min(trackCount, 4);
  }

  getMaximumTrackCount(trackSegments: InfrastructureTrackSegment[]): number {
    return Math.max(...trackSegments.map(([, , trackCount]) => trackCount), 1);
  }

  getTrackSegmentStart(start: number): number {
    return start === 0 ? -4 : start * 192;
  }

  getTrackSegmentEnd(end: number): number {
    return end === 1 ? 196 : end * 192;
  }

  getTrackLineY(trackIndex: number, trackCount: number): number {
    const trackSpacing = 8;
    return 32.5 + (trackIndex - (trackCount - 1) / 2) * trackSpacing;
  }

  getTrackSegmentTop(trackCount: number): number {
    return this.getTrackLineY(0, trackCount);
  }

  getTrackSegmentBottom(trackCount: number): number {
    return this.getTrackLineY(trackCount - 1, trackCount);
  }

  getTrackSegmentWidth(start: number, end: number): number {
    return this.getTrackSegmentEnd(end) - this.getTrackSegmentStart(start);
  }

  private updateTrackSegments() {
    this.trackSegments =
      this.infrastructureService.getSectionInfrastructure(
        this.selectedTrainrunSection.getSourceNodeId(),
        this.selectedTrainrunSection.getTargetNodeId(),
      )?.trackSegments ?? [];
    this.updateCorridorItems();
  }

  private updateCorridorItems() {
    const {lastLeftNode, leftSection} = this.trainrunSectionHelper.getLeftRightSections(
      this.selectedTrainrunSection,
    );
    const iterator = this.trainrunService.getNonStopIterator(lastLeftNode, leftSection);
    const corridorItems: CorridorItem[] = [{type: "node", node: lastLeftNode}];
    let sourceNode = lastLeftNode;

    while (iterator.hasNext()) {
      const pair = iterator.next();
      const targetNode = pair.node;
      const resource = this.getOrCreateSectionResource(sourceNode.getId(), targetNode.getId());
      const infrastructure = this.infrastructureService.getSectionInfrastructure(
        sourceNode.getId(),
        targetNode.getId(),
      );
      corridorItems.push({
        type: "section",
        resourceId: resource.getId(),
        trackCapacity: resource.getCapacity(),
        trackSegments: infrastructure?.trackSegments ?? [],
      });
      corridorItems.push({type: "node", node: targetNode});
      sourceNode = targetNode;
    }
    this.corridorItems = corridorItems;
  }

  private getOrCreateSectionResource(sourceNodeId: number, targetNodeId: number): Resource {
    const sectionsOnSameEdge = this.trainrunSectionService
      .getTrainrunSections()
      .filter(
        (section) =>
          (section.getSourceNodeId() === sourceNodeId &&
            section.getTargetNodeId() === targetNodeId) ||
          (section.getSourceNodeId() === targetNodeId &&
            section.getTargetNodeId() === sourceNodeId),
      );
    const sharedResourceId = findSharedSectionResourceId(
      sectionsOnSameEdge.map((section) => ({
        sourceNodeId: section.getSourceNodeId(),
        targetNodeId: section.getTargetNodeId(),
        resourceId: section.getResourceId(),
      })),
      sourceNodeId,
      targetNodeId,
    );

    if (sharedResourceId !== undefined) {
      const resourceAssignmentsChanged = sectionsOnSameEdge.some(
        (section) => section.getResourceId() !== sharedResourceId,
      );
      if (resourceAssignmentsChanged) {
        sectionsOnSameEdge.forEach((section) => section.setResourceId(sharedResourceId));
        this.trainrunSectionService.trainrunSectionsUpdated();
      }
      return this.resourceService.getResource(sharedResourceId);
    }

    const resource = this.resourceService.createAndGetResource(false);
    sectionsOnSameEdge.forEach((section) => section.setResourceId(resource.getId()));
    this.resourceService.resourceUpdated();
    this.trainrunSectionService.trainrunSectionsUpdated();
    return resource;
  }
}
