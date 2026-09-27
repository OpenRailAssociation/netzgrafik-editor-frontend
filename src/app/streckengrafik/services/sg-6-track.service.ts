import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {Direction} from "../../data-structures/business.data.structures";
import {InfrastructureEstimatorService} from "../../services/infrastructure/infrastructure-estimator.service";
import {NodeService} from "../../services/data/node.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {TrainrunService} from "../../services/data/trainrun.service";
import {Sg5FilterService} from "./sg-5-filter.service";
import {SgSelectedTrainrun} from "../model/streckengrafik-model/sg-selected-trainrun";
import {SgTrainrun} from "../model/streckengrafik-model/sg-trainrun";
import {SgTrainrunItem} from "../model/streckengrafik-model/sg-trainrun-item";
import {SgTrainrunNode} from "../model/streckengrafik-model/sg-trainrun-node";
import {SgPathNode} from "../model/streckengrafik-model/sg-path-node";
import {TrainrunBranchType} from "../model/enum/trainrun-branch-type-type";
import {TrackData, TrackSegments} from "../model/trackData";

@Injectable({
  providedIn: "root",
})
export class Sg6TrackService implements OnDestroy {
  public separateForwardBackwardMainTracks = true;

  private readonly selectedTrainrunSubject = new BehaviorSubject<SgSelectedTrainrun>(undefined);
  private readonly destroyed$ = new Subject<void>();
  private selectedTrainrun: SgSelectedTrainrun;

  constructor(
    private readonly sg5FilterService: Sg5FilterService,
    private readonly nodeService: NodeService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly trainrunService: TrainrunService,
    private readonly infrastructureEstimatorService: InfrastructureEstimatorService,
  ) {
    this.sg5FilterService
      .getSgSelectedTrainrun()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((selectedTrainrun) => {
        this.selectedTrainrun = selectedTrainrun;
        this.render();
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  getSgSelectedTrainrun(): Observable<SgSelectedTrainrun> {
    return this.selectedTrainrunSubject.asObservable();
  }

  private render(): void {
    if (this.selectedTrainrun === undefined) {
      return;
    }

    const trainruns = this.selectedTrainrun.trainruns;
    const sectionTracks = this.estimateSectionTracks(trainruns);
    this.estimateNodeReservations(trainruns);
    this.applySectionTracks(trainruns, sectionTracks);
    this.selectedTrainrunSubject.next(this.selectedTrainrun);
  }

  private estimateSectionTracks(trainruns: SgTrainrun[]) {
    const sectionsByKey = this.collectSectionsByKey(trainruns);
    const sectionTracks = new Map<string, [number, number, number][]>();

    sectionsByKey.forEach((items, sectionKey) => {
      const trainrunSections = Array.from(
        new Map(
          items
            .map((item) =>
              this.trainrunSectionService.getTrainrunSectionFromId(
                item.getTrainrunSection().trainrunSectionId,
              ),
            )
            .filter((section) => section !== undefined)
            .map((section) => [section.getId(), section] as const),
        ).values(),
      );
      if (trainrunSections.length === 0) {
        sectionTracks.set(sectionKey, []);
        return;
      }

      const firstSection = items[0].getTrainrunSection();
      const selectedPathSection = this.selectedTrainrun.paths.find(
        (path) =>
          path.isSection() &&
          ((path.getPathSection().departureNodeId === firstSection.departureNodeId &&
            path.getPathSection().arrivalNodeId === firstSection.arrivalNodeId) ||
            (path.getPathSection().departureNodeId === firstSection.arrivalNodeId &&
              path.getPathSection().arrivalNodeId === firstSection.departureNodeId)),
      );
      const fromNode = this.nodeService.getNodeFromId(
        selectedPathSection?.getPathSection().departureNodeId ?? firstSection.departureNodeId,
      );
      const toNode = this.nodeService.getNodeFromId(
        selectedPathSection?.getPathSection().arrivalNodeId ?? firstSection.arrivalNodeId,
      );

      sectionTracks.set(
        sectionKey,
        this.infrastructureEstimatorService.estimateSectionTracks(
          fromNode,
          toNode,
          trainrunSections,
        ),
      );
    });

    return sectionTracks;
  }

  private collectSectionsByKey(trainruns: SgTrainrun[]): Map<string, SgTrainrunItem[]> {
    const sectionsByKey = new Map<string, SgTrainrunItem[]>();
    trainruns.forEach((trainrun) =>
      trainrun.sgTrainrunItems.forEach((item) => {
        if (!item.isSection()) {
          return;
        }
        const section = item.getTrainrunSection();
        if (section.trainrunBranchType !== TrainrunBranchType.Trainrun) {
          return;
        }
        const key = String(section.index);
        sectionsByKey.set(key, [...(sectionsByKey.get(key) ?? []), item]);
      }),
    );
    return sectionsByKey;
  }

  private estimateNodeReservations(trainruns: SgTrainrun[]): void {
    const nodesById = this.collectNodesById(trainruns);
    const visibleTrainrunIds = new Set(
      this.trainrunService.getVisibleTrainruns().map((trainrun) => trainrun.getId()),
    );
    const visibleSections = this.trainrunSectionService
      .getTrainrunSections()
      .filter((section) => visibleTrainrunIds.has(section.getTrainrunId()));

    nodesById.forEach((nodes, nodeId) => {
      const businessNode = this.nodeService.getNodeFromId(nodeId);
      if (businessNode === undefined) {
        return;
      }

      const nodeTimes = nodes.flatMap((node) => [node.arrivalTime, node.departureTime]);
      const estimates = this.infrastructureEstimatorService.estimateNodeTracks(
        businessNode,
        visibleSections,
        {
          windowStartMinutes: Math.min(...nodeTimes, 0),
          windowMinutes: Math.max(...nodeTimes, 24 * 60),
          separateForwardBackwardTracks: this.separateForwardBackwardMainTracks,
        },
      );
      const trackCount = Math.max(1, ...estimates.map((estimate) => estimate.track));
      new Set(nodes.map((node) => node.sgPathNode)).forEach((pathNode) => {
        pathNode.trackData.track = trackCount;
      });
      nodes.forEach((node) => {
        const reservations = estimates.flatMap((estimate) =>
          estimate.occupancies
            .filter((occupancy) => occupancy.trainrunId === node.trainrunId)
            .map((occupancy) => ({
              offset: occupancy.arrivalMinute - node.arrivalTime,
              trainrunId: occupancy.trainrunId,
              occurrenceIndex: occupancy.occurrenceIndex,
              arrivalSectionId: occupancy.arrivalSectionId,
              departureSectionId: occupancy.departureSectionId,
              track: estimate.track,
              arrivalTime: occupancy.arrivalMinute,
              departureTime: occupancy.departureMinute,
              headwayUntilTime: occupancy.headwayUntilMinute,
            })),
        );
        node.trackReservations = reservations;
        if (reservations.length > 0) {
          node.minimumHeadwayTime = Math.min(
            ...reservations.map(
              (reservation) => reservation.headwayUntilTime - reservation.departureTime,
            ),
          );
        }
      });
    });
  }

  private collectNodesById(trainruns: SgTrainrun[]): Map<number, SgTrainrunNode[]> {
    const nodesById = new Map<number, SgTrainrunNode[]>();
    trainruns.forEach((trainrun) =>
      trainrun.sgTrainrunItems.forEach((item) => {
        if (!item.isNode()) {
          return;
        }
        const node = item.getTrainrunNode();
        if (node.endNode) {
          this.updateStagingDwellAtEndpoint(node);
        }
        nodesById.set(node.nodeId, [...(nodesById.get(node.nodeId) ?? []), node]);
      }),
    );
    return nodesById;
  }

  private updateStagingDwellAtEndpoint(node: SgTrainrunNode): void {
    const trainrun = this.trainrunService.getTrainrunFromId(node.trainrunId);
    if (trainrun === undefined || trainrun.getDirection() !== Direction.ONE_WAY) {
      return;
    }
    const businessNode = this.nodeService.getNodeFromId(node.nodeId);
    const haltezeit = businessNode
      .getTrainrunCategoryHaltezeit()[trainrun.getTrainrunCategory().fachCategory].haltezeit;
    if (node.arrivalPathSection === undefined) {
      node.arrivalTime = node.departureTime - haltezeit;
    } else {
      node.departureTime = node.arrivalTime + haltezeit;
    }
  }

  private applySectionTracks(
    trainruns: SgTrainrun[],
    sectionTracks: Map<string, [number, number, number][]>,
  ): void {
    const maxTrackData = new Map<string, TrackData>();
    const maxNodeTracks = new Map<SgPathNode, number>();

    trainruns.forEach((trainrun) =>
      trainrun.sgTrainrunItems.forEach((item) => {
        if (item.isNode()) {
          const pathNode = item.getTrainrunNode().sgPathNode;
          maxNodeTracks.set(
            pathNode,
            Math.max(
              maxNodeTracks.get(pathNode) ?? 0,
              item.getTrainrunNode().trackData.track,
              pathNode.trackData.track,
            ),
          );
          return;
        }
        const section = item.getTrainrunSection();
        if (section.trainrunBranchType !== TrainrunBranchType.Trainrun) {
          return;
        }
        const tracks = sectionTracks.get(String(section.index));
        if (tracks === undefined) {
          return;
        }
        const maxTracks = Math.max(1, ...tracks.map((track) => track[2]));
        const segments = tracks.map(
          (track) => new TrackSegments(track[0], track[1], maxTracks, track[2], false),
        );
        section.trackData.track = maxTracks;
        segments.forEach((segment) => {
          segment.nbrTracks = Math.ceil(segment.minNbrTracks / 2) * 2;
        });
        section.trackData.nodeId1 = section.departureNodeId;
        section.trackData.nodeId2 = section.arrivalNodeId;
        section.trackData.sectionTrackSegments = segments;
        maxTrackData.set(
          section.departureNodeId + ":" + section.arrivalNodeId,
          section.trackData,
        );
      }),
    );

    maxNodeTracks.forEach((track, pathNode) => {
      pathNode.trackData.track = Math.max(1, track);
    });
    this.applyTrackDataToSelectedPath(maxTrackData);
  }

  private applyTrackDataToSelectedPath(maxTrackData: Map<string, TrackData>): void {
    this.selectedTrainrun.paths.forEach((path) => {
      if (!path.isSection()) {
        return;
      }
      const section = path.getPathSection();
      const domainSection = this.trainrunSectionService.getTrainrunSectionFromId(
        section.trainrunSectionId,
      );
      if (domainSection === undefined) {
        return;
      }
      const key = domainSection.getTrainrun().isRoundTrip()
        ? section.arrivalNodeId + ":" + section.departureNodeId
        : section.departureNodeId + ":" + section.arrivalNodeId;
      const trackData = maxTrackData.get(key);
      if (trackData !== undefined) {
        section.trackData = trackData;
      }
    });
  }

}
