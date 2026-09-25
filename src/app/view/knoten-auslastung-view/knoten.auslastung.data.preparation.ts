import {TrainrunSection} from "../../models/trainrunsection.model";
import {Node} from "../../models/node.model";
import {ResourceService} from "../../services/data/resource.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {TrainrunService} from "../../services/data/trainrun.service";
import {InfrastructureEstimatorService} from "../../services/infrastructure/infrastructure-estimator.service";
import {FilterService} from "../../services/ui/filter.service";
import {NodeService} from "../../services/data/node.service";
import {merge, Observable, Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";

type NodeTrackOccupancy = ReturnType<
  InfrastructureEstimatorService["estimateNodeTracks"]
>[number]["occupancies"][number];
type NodeTrackEstimate = ReturnType<InfrastructureEstimatorService["estimateNodeTracks"]>[number];

export interface KnotenAuslastungData {
  trainrunSection: TrainrunSection;
  trainrunId: number;
  occurrenceIndex: number;
  arrivalSectionId?: number;
  departureSectionId?: number;
  track: number;
  name: string;
  tooltip: string;
  startAngle: number;
  endAngle: number;
  headwayStartAngle: number;
  headwayEndAngle: number;
  innerRadius: number;
  outerRadius: number;
}

export interface KnotenAuslastungProjection {
  nodeDatas: KnotenAuslastungData[];
  resourceDatas: KnotenAuslastungResourceData[];
  usedTrackCount: number;
  trackCount: number;
}

interface KnotenAuslastungResourceData {
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
  capacityLimitReached: boolean;
}

export class KnotenAuslastungDataPreparation {
  static readonly PROJECTION_MINUTES = 60;
  static readonly ESTIMATION_MINUTES = 2 * KnotenAuslastungDataPreparation.PROJECTION_MINUTES;

  private evenHour: KnotenAuslastungProjection = this.emptyProjection();
  private oddHour: KnotenAuslastungProjection = this.emptyProjection();
  private hoursDiffer = false;
  private readonly destroyed = new Subject<void>();
  private readonly updateSubject = new Subject<void>();
  readonly updates: Observable<void> = this.updateSubject.asObservable();

  constructor(
    private readonly trainrunService: TrainrunService,
    private readonly resourceService: ResourceService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly infrastructureEstimatorService: InfrastructureEstimatorService,
    filterService: FilterService,
    nodeService: NodeService,
  ) {
    merge(
      nodeService.nodes,
      trainrunService.trainruns,
      trainrunSectionService.trainrunSections,
      filterService.filter,
    )
      .pipe(takeUntil(this.destroyed))
      .subscribe(() => this.updateSubject.next());
  }

  static getTrainrunLabel(trainrunSection: TrainrunSection): string {
    return (
      trainrunSection.getTrainrun().getCategoryShortName() +
      trainrunSection.getTrainrun().getTitle()
    );
  }

  computeAuslastungsMatrix(node: Node): void {
    if (node === undefined) {
      return;
    }

    const sections = this.getVisibleTrainrunSections();
    const sectionById = new Map(sections.map((section) => [section.getId(), section]));
    const sectionByTrainrunId = new Map(
      sections.map((section) => [section.getTrainrunId(), section]),
    );
    const estimates = this.infrastructureEstimatorService.estimateNodeTracks(
      node,
      sections,
      {
        windowStartMinutes: 0,
        windowMinutes: KnotenAuslastungDataPreparation.ESTIMATION_MINUTES,
        separateForwardBackwardTracks: true,
      },
    );
    this.evenHour = this.createProjection(node, 0, sectionById, sectionByTrainrunId, estimates);
    this.oddHour = this.createProjection(
      node,
      KnotenAuslastungDataPreparation.PROJECTION_MINUTES,
      sectionById,
      sectionByTrainrunId,
      estimates,
    );
    const trackCount = Math.max(this.evenHour.trackCount, this.oddHour.trackCount);
    const resourceDatas = this.createResourceData(node, trackCount);
    this.evenHour = {...this.evenHour, trackCount, resourceDatas};
    this.oddHour = {...this.oddHour, trackCount, resourceDatas};
    this.hoursDiffer = !this.projectionsEqual(this.evenHour, this.oddHour);
  }

  getProjection(oddHour: boolean): KnotenAuslastungProjection {
    return oddHour ? this.oddHour : this.evenHour;
  }

  hasDifferentHours(): boolean {
    return this.hoursDiffer;
  }

  destroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
    this.updateSubject.complete();
  }

  private createProjection(
    node: Node,
    projectionStart: number,
    sectionById: Map<number, TrainrunSection>,
    sectionByTrainrunId: Map<number, TrainrunSection>,
    estimates: NodeTrackEstimate[],
  ): KnotenAuslastungProjection {
    const projectionEnd = projectionStart + KnotenAuslastungDataPreparation.PROJECTION_MINUTES;
    const nodeDatas: KnotenAuslastungData[] = [];
    let usedTrackCount = 0;

    estimates.forEach((estimate) => {
      usedTrackCount = Math.max(usedTrackCount, estimate.track);
      estimate.occupancies.forEach((occupancy) => {
        const section = this.findSectionForOccupancy(
          occupancy,
          sectionById,
          sectionByTrainrunId,
        );
        const clipped = this.clipOccupancy(occupancy, projectionStart, projectionEnd);
        if (section === undefined || clipped === undefined) {
          return;
        }
        const oppositeNode = node.getOppositeNode(section);
        nodeDatas.push({
          trainrunSection: section,
          trainrunId: occupancy.trainrunId,
          occurrenceIndex: occupancy.occurrenceIndex,
          arrivalSectionId: occupancy.arrivalSectionId,
          departureSectionId: occupancy.departureSectionId,
          track: estimate.track,
          name: KnotenAuslastungDataPreparation.getTrainrunLabel(section),
          tooltip: this.getTrainrunTooltip(section, oppositeNode),
          startAngle: this.toAngle(clipped.occupancyStart - projectionStart),
          endAngle: this.toAngle(clipped.occupancyEnd - projectionStart),
          headwayStartAngle: this.toAngle(clipped.headwayStart - projectionStart),
          headwayEndAngle: this.toAngle(clipped.headwayEnd - projectionStart),
          innerRadius: estimate.track - 1,
          outerRadius: estimate.track - 1,
        });
      });
    });

    return {nodeDatas, resourceDatas: [], usedTrackCount, trackCount: Math.max(usedTrackCount, 1)};
  }

  private findSectionForOccupancy(
    occupancy: NodeTrackOccupancy,
    sectionById: Map<number, TrainrunSection>,
    sectionByTrainrunId: Map<number, TrainrunSection>,
  ): TrainrunSection | undefined {
    return (
      sectionById.get(occupancy.arrivalSectionId) ??
      sectionById.get(occupancy.departureSectionId) ??
      sectionByTrainrunId.get(occupancy.trainrunId)
    );
  }

  private getVisibleTrainrunSections(): TrainrunSection[] {
    const visibleTrainrunIds = new Set(
      this.trainrunService.getVisibleTrainruns().map((trainrun) => trainrun.getId()),
    );
    return this.trainrunSectionService
      .getTrainrunSections()
      .filter((section) => visibleTrainrunIds.has(section.getTrainrunId()));
  }

  private clipOccupancy(
    occupancy: NodeTrackOccupancy,
    projectionStart: number,
    projectionEnd: number,
  ): {
    occupancyStart: number;
    occupancyEnd: number;
    headwayStart: number;
    headwayEnd: number;
  } | undefined {
    if (occupancy.arrivalMinute >= projectionEnd || occupancy.headwayUntilMinute <= projectionStart) {
      return undefined;
    }
    const clipped = {
      occupancyStart: Math.max(occupancy.arrivalMinute, projectionStart),
      occupancyEnd: Math.min(occupancy.departureMinute, projectionEnd),
      headwayStart: Math.max(occupancy.departureMinute, projectionStart),
      headwayEnd: Math.min(occupancy.headwayUntilMinute, projectionEnd),
    };
    return clipped.occupancyEnd > clipped.occupancyStart || clipped.headwayEnd > clipped.headwayStart
      ? clipped
      : undefined;
  }

  private toAngle(minutes: number): number {
    return (minutes / KnotenAuslastungDataPreparation.PROJECTION_MINUTES) * 2 * Math.PI;
  }

  private createResourceData(node: Node, trackCount: number): KnotenAuslastungResourceData[] {
    const capacity = this.resourceService.getResource(node.getResourceId())?.getCapacity() ?? 0;
    const resources: KnotenAuslastungResourceData[] = [];
    trackCount = Math.max(trackCount, capacity, 1);
    for (let track = 0; track < trackCount; track += 1) {
      for (let minute = 0; minute < KnotenAuslastungDataPreparation.PROJECTION_MINUTES; minute += 5) {
        resources.push({
          startAngle: this.toAngle(minute + 0.1),
          endAngle: this.toAngle(minute + 4.9),
          innerRadius: track,
          outerRadius: track,
          capacityLimitReached: track + 1 > capacity,
        });
      }
    }
    return resources;
  }

  private projectionsEqual(
    first: KnotenAuslastungProjection,
    second: KnotenAuslastungProjection,
  ): boolean {
    return JSON.stringify(first.nodeDatas.map(this.projectionKey)) ===
      JSON.stringify(second.nodeDatas.map(this.projectionKey));
  }

  private projectionKey(data: KnotenAuslastungData): string {
    return [
      data.trainrunSection.getId(),
      data.trainrunId,
      data.occurrenceIndex,
      data.arrivalSectionId,
      data.departureSectionId,
      data.track,
      data.startAngle,
      data.endAngle,
      data.headwayStartAngle,
      data.headwayEndAngle,
      data.innerRadius,
    ].join(":");
  }

  private emptyProjection(): KnotenAuslastungProjection {
    return {nodeDatas: [], resourceDatas: [], usedTrackCount: 0, trackCount: 1};
  }

  private getTrainrunTooltip(trainrunSection: TrainrunSection, targetNode: Node): string {
    const trainrunName = KnotenAuslastungDataPreparation.getTrainrunLabel(trainrunSection);
    if (targetNode === undefined || trainrunSection.getTrainrun().isRoundTrip()) {
      return trainrunName;
    }
    const endNode = this.trainrunService.getEndNode(targetNode, trainrunSection);
    return trainrunName + " &#x2192; " + endNode.getBetriebspunktName();
  }
}
