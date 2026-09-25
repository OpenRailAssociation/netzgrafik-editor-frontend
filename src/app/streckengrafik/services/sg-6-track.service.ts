import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {SgSelectedTrainrun} from "../model/streckengrafik-model/sg-selected-trainrun";
import {takeUntil} from "rxjs/operators";
import {TrackData, TrackSegments} from "../model/trackData";
import {InfrastructureEstimatorService} from "../../services/infrastructure/infrastructure-estimator.service";
import {SgTrainrunSection} from "../model/streckengrafik-model/sg-trainrun-section";
import {SgTrainrunItem} from "../model/streckengrafik-model/sg-trainrun-item";
import {SgTrainrunNode} from "../model/streckengrafik-model/sg-trainrun-node";
import {SgPathNode} from "../model/streckengrafik-model/sg-path-node";
import {SgTrainrun} from "../model/streckengrafik-model/sg-trainrun";
import {TrainrunBranchType} from "../model/enum/trainrun-branch-type-type";
import {Sg5FilterService} from "./sg-5-filter.service";
import {DataService} from "../../services/data/data.service";
import {Direction, TrainrunFrequency} from "../../data-structures/business.data.structures";
import {Node} from "../../models/node.model";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {NodeService} from "../../services/data/node.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {TrainrunService} from "../../services/data/trainrun.service";

@Injectable({
  providedIn: "root",
})
export class Sg6TrackService implements OnDestroy {
  public separateForwardBackwardMainTracks = true;

  public minimumHeadwayTime = 2;
  public maxFrequency = 240;

  private readonly sgSelectedTrainrunSubject = new BehaviorSubject<SgSelectedTrainrun>(undefined);
  private readonly sgSelectedTrainrun$ = this.sgSelectedTrainrunSubject.asObservable();

  private selectedTrainrun: SgSelectedTrainrun;

  private readonly destroyed$ = new Subject<void>();

  constructor(
    private readonly sg5FilterService: Sg5FilterService,
    private readonly dataService: DataService,
    private readonly nodeService: NodeService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly trainrunService: TrainrunService,
    private readonly infrastructureEstimatorService: InfrastructureEstimatorService,
  ) {
    this.sg5FilterService
      .getSgSelectedTrainrun()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((selectedTrainrun) => {
        this.maxFrequency = 0;
        this.dataService
          .getNetzgrafikDto()
          .metadata.trainrunFrequencies.forEach((freq: TrainrunFrequency) => {
            this.maxFrequency = Math.max((this.maxFrequency = 0), freq.frequency);
          });
        this.selectedTrainrun = selectedTrainrun;
        this.render();
      });
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  public getSgSelectedTrainrun(): Observable<SgSelectedTrainrun> {
    return this.sgSelectedTrainrun$;
  }

  private render() {
    if (this.selectedTrainrun === undefined) {
      return;
    }

    // calculate the track occupier (node)
    this.computeTrackAlignments(this.selectedTrainrun);

    // calculate the required tracks "blocks" (section)
    const sectionTrackMap = this.extractStreckenGleis(this.selectedTrainrun.trainruns);
    this.mapTrackToTop(this.selectedTrainrun.trainruns, sectionTrackMap);

    // update the rendering -> goto next pipeline step
    this.sgSelectedTrainrunSubject.next(this.selectedTrainrun);
  }

  private extractStreckenGleis(trainrunItems: SgTrainrun[]) {
    const sectionsOfInterest = this.createSectionsOfInterestMap(trainrunItems);
    return this.extractSectionTracks(sectionsOfInterest);
  }

  private createSectionsOfInterestMap(trainrunItems: SgTrainrun[]) {
    /*
    This method collects all trainrun sections and maps them into the sectionsOfInterest-Map to get fast access
     */
    const sectionsOfInterest = new Map<string, {item: SgTrainrunItem; trainrun: SgTrainrun}[]>();
    trainrunItems.forEach((ts) => {
      ts.sgTrainrunItems.forEach((trainrunItem: SgTrainrunItem) => {
        if (trainrunItem.isSection()) {
          const ps: SgTrainrunSection = trainrunItem.getTrainrunSection();
          if (ps.trainrunBranchType === TrainrunBranchType.Trainrun) {
            const sectionKey = this.getSectionKey(ps).key;
            const sOfI = sectionsOfInterest.get(sectionKey);
            if (sOfI === undefined) {
              sectionsOfInterest.set(sectionKey, []);
            }
            sectionsOfInterest.get(sectionKey).push({item: trainrunItem, trainrun: ts});
          }
        }
      });
    });
    return sectionsOfInterest;
  }

  private getSectionKey(ps: SgTrainrunSection) {
    let node1 = ps.arrivalPathNode === undefined ? undefined : ps.arrivalPathNode.nodeId;
    let node2 = ps.departurePathNode === undefined ? undefined : ps.departurePathNode.nodeId;
    if (node1 > node2) {
      const tmp = node1;
      node1 = node2;
      node2 = tmp;
    }
    const sectionKey = "@" + ps.index;
    return {key: sectionKey, node1: node1, node2: node2};
  }

  private extractSectionTracks(
    sectionsOfInterest: Map<string, {item: SgTrainrunItem; trainrun: SgTrainrun}[]>,
  ) {
    // this methode is the wrapper that extracts section tracks from the sectionsOfInterest map and
    // estimates the track layout for each section. The new calculation is done in the stateless
    // InfrastructureEstimatorService.
    const sectionTrackMap = new Map<string, [number, number, number][]>();
    sectionsOfInterest.forEach((sectionData, sectionKey) => {
      // Resolve the domain sections referenced by the rendered Sg items and remove duplicates.
      const trainrunSections = Array.from(
        new Map(
          sectionData
            .map(({item}) =>
              this.trainrunSectionService.getTrainrunSectionFromId(
                item.getTrainrunSection().trainrunSectionId,
              ),
            )
            .filter((section) => section !== undefined)
            .map((section) => [section.getId(), section] as const),
        ).values(),
      );
      const firstSection = trainrunSections[0];
      if (firstSection === undefined) {
        sectionTrackMap.set(sectionKey, []);
        return;
      }

      // Estimate in the direction of the selected path so the result is rendered 1:1.
      const firstSgSection = sectionData[0].item.getTrainrunSection();
      const selectedPathSection = this.selectedTrainrun.paths.find(
        (path) =>
          path.isSection() &&
          ((path.getPathSection().departureNodeId === firstSgSection.departureNodeId &&
            path.getPathSection().arrivalNodeId === firstSgSection.arrivalNodeId) ||
            (path.getPathSection().departureNodeId === firstSgSection.arrivalNodeId &&
              path.getPathSection().arrivalNodeId === firstSgSection.departureNodeId)),
      );
      const fromNode = this.nodeService.getNodeFromId(
        selectedPathSection?.getPathSection().departureNodeId ?? firstSgSection.departureNodeId,
      );
      const toNode = this.nodeService.getNodeFromId(
        selectedPathSection?.getPathSection().arrivalNodeId ?? firstSgSection.arrivalNodeId,
      );

      sectionTrackMap.set(
        sectionKey,
        this.infrastructureEstimatorService.estimateSectionTracks(
          fromNode,
          toNode,
          trainrunSections,
        ),
      );
    });
    return sectionTrackMap;
  }

  private transformUmlaufNodePair(
    forwardNode: SgTrainrunNode,
    backwardNode: SgTrainrunNode,
    trainrun: SgTrainrun,
    minimumHeadwayTime: number,
  ) {
    const turnaroundTime = forwardNode.departureTime - forwardNode.arrivalTime;
    const deltaTurnaroundTime = trainrun.frequency - turnaroundTime;
    if (deltaTurnaroundTime > 0 && deltaTurnaroundTime < minimumHeadwayTime) {
      // special case - when the turnaround time is too small - enforce a second train on a
      // second track
      // tag / mark for further processing
      let estimateFreqOffset =
        (backwardNode.departureTime - forwardNode.arrivalTime) / trainrun.frequency;
      estimateFreqOffset = Math.floor(estimateFreqOffset);
      forwardNode.unrollOnlyEvenFrequencyOffsets = estimateFreqOffset % 2;
      backwardNode.unrollOnlyEvenFrequencyOffsets = 1;
      forwardNode.maxUnrollOnlyEvenFrequencyOffsets = 1;
      backwardNode.maxUnrollOnlyEvenFrequencyOffsets = 1;
      backwardNode.unusedForTurnaround = false;
      forwardNode.unusedForTurnaround = false;
    } else {
      // only one train is required - turnaround can be done with one train
      if (turnaroundTime < trainrun.frequency) {
        if (backwardNode.backward) {
          forwardNode.unusedForTurnaround = true;
        } else {
          backwardNode.unusedForTurnaround = true;
        }
      } else {
        // at least two trainruns are required - turnaround must be done with at least two trains
        // tag / mark for further processing
        forwardNode.unrollOnlyEvenFrequencyOffsets = 1;
        backwardNode.unrollOnlyEvenFrequencyOffsets = 1;
        forwardNode.maxUnrollOnlyEvenFrequencyOffsets = 1;
        backwardNode.maxUnrollOnlyEvenFrequencyOffsets = 1;
        backwardNode.unusedForTurnaround = false;
        forwardNode.unusedForTurnaround = false;
      }
    }
    backwardNode.isTurnaround = true;
    forwardNode.isTurnaround = true;
  }

  private transformTurnarounds(
    item: SgTrainrunNode,
    trainrun: SgTrainrun,
    minimumHeadwayTime: number,
  ) {
    if (!item.endNode) {
      return;
    }

    // minIndexEndNode is used to distinguish the “left” or “right” end node -> two cases!
    let minIndexEndNode = Infinity;
    trainrun.sgTrainrunItems
      .filter((el) => el.isNode())
      .forEach((el) => {
        const n = el.getTrainrunNode();
        if (n.isEndNode()) {
          minIndexEndNode = Math.min(minIndexEndNode, n.index);
        }
      });

    // case "left end node -> forward -> backward
    if (!item.backward && item.index === minIndexEndNode) {
      // forward starting node (case 1)
      const forwardNode = item;
      const backwardNodes = trainrun.sgTrainrunItems.filter(
        (el) => el.backward && el.index === item.index,
      );
      if (backwardNodes.length > 0) {
        const backwardNode = backwardNodes[backwardNodes.length - 1].getTrainrunNode();
        this.transformUmlaufNodePair(forwardNode, backwardNode, trainrun, minimumHeadwayTime);
      }
    }

    // case "right" end node -> backward -> forward
    if (item.backward && item.index !== minIndexEndNode) {
      // backward starting node (case 2)
      const backwardNode = item;
      const forwardNodes = trainrun.sgTrainrunItems.filter(
        (el) => !el.backward && el.index === item.index,
      );

      if (forwardNodes.length > 0) {
        const forwardNode = forwardNodes[0].getTrainrunNode();
        this.transformUmlaufNodePair(backwardNode, forwardNode, trainrun, minimumHeadwayTime);
        if (forwardNodes.length > 1) {
          backwardNode.unusedForTurnaround = true;
          forwardNode.unusedForTurnaround = false;
        }
      } // ensured at least one forward node found
    }
  }

  private clearExtraTrains(ts: SgTrainrun) {
    ts.sgTrainrunItems = ts.sgTrainrunItems.filter((el) => {
      if (el.isNode()) {
        return !el.getTrainrunNode().extraTrains;
      }
      return true;
    });
  }

  private detectAndCreateExtraTrains(
    ts: SgTrainrun,
    trainrunNode: SgTrainrunNode,
    minimumHeadwayTime: number,
    specialItems: SgTrainrunNode[],
  ) {
    const tmpItem: SgTrainrunNode[] = [];
    if (!trainrunNode.endNode) {
      const transformedDepartureTime = trainrunNode.departureTime + minimumHeadwayTime;
      let maxUnrollOnlyEvenFrequencyOffsets = trainrunNode.maxUnrollOnlyEvenFrequencyOffsets;
      const transformedArrivalTime = trainrunNode.arrivalTime + ts.frequency;
      if (transformedDepartureTime > transformedArrivalTime) {
        for (let offset = 1; offset <= Math.floor(60 / ts.frequency) + 1; offset++) {
          const cpTrainrunNode: SgTrainrunNode = SgTrainrunNode.copy(trainrunNode);
          cpTrainrunNode.unrollOnlyEvenFrequencyOffsets = offset;
          trainrunNode.unrollOnlyEvenFrequencyOffsets = 0;
          tmpItem.push(cpTrainrunNode);
          maxUnrollOnlyEvenFrequencyOffsets = Math.max(maxUnrollOnlyEvenFrequencyOffsets, offset);
        }
      }
      tmpItem.forEach((el) => {
        el.maxUnrollOnlyEvenFrequencyOffsets = maxUnrollOnlyEvenFrequencyOffsets;
        specialItems.push(el);
        el.extraTrains = true;
      });
      trainrunNode.maxUnrollOnlyEvenFrequencyOffsets = maxUnrollOnlyEvenFrequencyOffsets;
    }
  }

  private concatExtraTrains(ts: SgTrainrun, collectExtraTrainruns: SgTrainrunNode[]) {
    ts.sgTrainrunItems = ts.sgTrainrunItems.concat(collectExtraTrainruns);
  }

  private calculateMinimumHeadwayTimeAtNode(trainrunNode: SgTrainrunNode) {
    //this.calculateMinimumHeadwayTime(pathNode, trainrun, trainrunSection);
    const node = this.nodeService.getNodeFromId(trainrunNode.nodeId);
    let trainrunSectionId: number = undefined;
    if (trainrunNode.arrivalPathSection !== undefined) {
      trainrunSectionId = trainrunNode.arrivalPathSection.trainrunSectionId;
    }
    if (trainrunNode.departurePathSection !== undefined) {
      trainrunSectionId = trainrunNode.departurePathSection.trainrunSectionId;
    }

    const trainrunSection = this.trainrunSectionService.getTrainrunSectionFromId(trainrunSectionId);
    if (trainrunSection === undefined) {
      const trainrun = this.trainrunService.getTrainrunFromId(trainrunNode.trainrunId);
      if (trainrun === undefined) {
        // return default
        return this.minimumHeadwayTime;
      }
      // no transition ==> stop headway time
      return trainrun.getTrainrunCategory().nodeHeadwayStop;
    }

    const trans = node.getTransition(trainrunSection.getId());
    const trainrun = trainrunSection.getTrainrun();

    if (trans !== undefined) {
      if (trans.getIsNonStopTransit()) {
        // non-stop transition => non-stop headway time
        return trainrun.getTrainrunCategory().nodeHeadwayNonStop;
      }
    }

    // no transition ==> stop headway time
    return trainrun.getTrainrunCategory().nodeHeadwayStop;
  }

  private computeTrackAlignments(selectedTrainrun: SgSelectedTrainrun) {
    selectedTrainrun.trainruns.forEach((trainrun) => {
      trainrun.sgTrainrunItems.forEach((item) => {
        if (item.isNode()) {
          const node = item.getTrainrunNode();
          node.setMinimumHeadwayTime(this.calculateMinimumHeadwayTimeAtNode(node));
        }
      });
      trainrun.sgTrainrunItems.forEach((item) => {
        if (item.isNode()) {
          this.transformTurnarounds(item.getTrainrunNode(), trainrun, item.minimumHeadwayTime);
        }
      });
      this.clearExtraTrains(trainrun);
      const extraNodes: SgTrainrunNode[] = [];
      trainrun.sgTrainrunItems.forEach((item) => {
        if (item.isNode()) {
          this.detectAndCreateExtraTrains(
            trainrun,
            item.getTrainrunNode(),
            item.minimumHeadwayTime,
            extraNodes,
          );
        }
      });
      this.concatExtraTrains(trainrun, extraNodes);
    });
    this.estimateNodeTracks(selectedTrainrun.trainruns);
  }

  private estimateNodeTracks(trainruns: SgTrainrun[]) {
    const nodes = new Map<number, SgTrainrunNode[]>();
    trainruns.forEach((trainrun) => {
      trainrun.sgTrainrunItems.forEach((item) => {
        if (!item.isNode()) {
          return;
        }
        const node = item.getTrainrunNode();
        if (node.endNode) {
          this.updateStagingDwellAtEndpoints(node);
        }
        const nodeItems = nodes.get(node.nodeId) ?? [];
        nodeItems.push(node);
        nodes.set(node.nodeId, nodeItems);
      });
    });

    nodes.forEach((nodeItems, nodeId) => {
      const businessNode = this.nodeService.getNodeFromId(nodeId);
      if (businessNode === undefined) {
        return;
      }
      // The node track estimator looks at every trainrun touching the node, not only the corridor.
      const visibleTrainrunIds = new Set(
        this.trainrunService.getVisibleTrainruns().map((trainrun) => trainrun.getId()),
      );
      const visibleTrainrunSections = this.trainrunSectionService
        .getTrainrunSections()
        .filter((section) => visibleTrainrunIds.has(section.getTrainrunId()));
      const estimates = this.infrastructureEstimatorService.estimateNodeTracks(
        businessNode,
        visibleTrainrunSections,
        {
          ...this.getNodeTrackEstimationRange(nodeItems),
          separateForwardBackwardTracks: this.separateForwardBackwardMainTracks,
        },
      );
      this.logNodeTrackMatrix(businessNode, visibleTrainrunSections, estimates);
      const matrixTrackCount = Math.max(1, ...estimates.map((estimate) => estimate.track));
      const pathNodes = new Set(nodeItems.map((node) => node.sgPathNode));
      pathNodes.forEach((pathNode) => {
        pathNode.trackData.track = matrixTrackCount;
      });
      nodeItems.forEach((node) => {
        const reservations = estimates.flatMap((estimate) =>
          estimate.occupancies
            .filter((occupancy) => this.matchesNodeTrackReservation(occupancy, node))
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
      });
    });
  }

  private logNodeTrackMatrix(
    businessNode: Node,
    trainrunSections: TrainrunSection[],
    estimates: Array<{
      track: number;
      occupancies: Array<{
        arrivalMinute: number;
        departureMinute: number;
        headwayUntilMinute: number;
        trainrunId: number;
        arrivalSectionId?: number;
        departureSectionId?: number;
        transitionId?: number;
        direction: Direction;
        travelDirection?: string;
        separateByDirection: boolean;
        trackGroupId?: string;
        occurrenceIndex: number;
      }>;
    }>,
  ): void {
    const debugStartMinute = 6 * 60 - 6 * 60;
    const debugEndMinute = 12 * 60 - 6 * 60;
    const sectionById = new Map(trainrunSections.map((section) => [section.getId(), section]));
    const rows = estimates.flatMap((estimate) =>
      estimate.occupancies
        .filter(
          (occupancy) =>
            occupancy.arrivalMinute < debugEndMinute &&
            occupancy.headwayUntilMinute > debugStartMinute,
        )
        .map((occupancy) => {
          const trainrun = this.trainrunService.getTrainrunFromId(occupancy.trainrunId);
          const arrivalSection =
            occupancy.arrivalSectionId === undefined
              ? undefined
              : sectionById.get(occupancy.arrivalSectionId);
          const departureSection =
            occupancy.departureSectionId === undefined
              ? undefined
              : sectionById.get(occupancy.departureSectionId);
          const transition =
            arrivalSection === undefined
              ? undefined
              : businessNode.getTransition(arrivalSection.getId());
          const trainCategory = trainrun?.getCategoryShortName() ?? "undefined";
          const trainTitle = trainrun?.getTitle() ?? "undefined";
          return {
            NodeId: businessNode.getId(),
            KnotenAbk: businessNode.getBetriebspunktName(),
            Zug: `${trainCategory} ${trainTitle}`,
            Zugkategorie: trainCategory,
            Zugtitel: trainTitle,
            Zuglauf: occupancy.trainrunId,
            Occurrence: occupancy.occurrenceIndex,
            Ankunft: this.formatNodeTrackDebugTime(occupancy.arrivalMinute),
            Abfahrt: this.formatNodeTrackDebugTime(occupancy.departureMinute),
            Freigabe: this.formatNodeTrackDebugTime(occupancy.headwayUntilMinute),
            Gleis: estimate.track,
            "Corridor through node": this.getCorridorThroughNode(
              businessNode,
              arrivalSection,
              departureSection,
            ),
            AnkunftSection: occupancy.arrivalSectionId,
            AbfahrtSection: occupancy.departureSectionId,
            Transition: occupancy.transitionId,
            Richtung: occupancy.direction,
            Fahrtrichtung: occupancy.travelDirection,
            Gleisgruppe: occupancy.trackGroupId,
            GetrennteRichtung: occupancy.separateByDirection ? "Yes" : "No",
            "One-way": trainrun?.getDirection() === Direction.ONE_WAY ? "Yes" : "No",
            Transit:
              transition === undefined
                ? "undefined"
                : transition.getIsNonStopTransit()
                  ? "non-stop"
                  : "stop",
            Start: occupancy.arrivalSectionId === undefined ? "Yes" : "No",
            Ende: occupancy.departureSectionId === undefined ? "Yes" : "No",
          };
        }),
    );
    rows.sort(
      (first, second) =>
        first.Ankunft.localeCompare(second.Ankunft) ||
        first.KnotenAbk.localeCompare(second.KnotenAbk) ||
        first.Gleis - second.Gleis ||
        first.Occurrence - second.Occurrence,
    );
    console.group(`Node matrix 06:00-12:00 (${businessNode.getBetriebspunktName()})`);
    console.table(rows);
    console.groupEnd();
  }

  private formatNodeTrackDebugTime(minute: number): string {
    const normalizedMinute = (((6 * 60 + minute) % (24 * 60)) + 24 * 60) % (24 * 60);
    return `${Math.floor(normalizedMinute / 60)
      .toString()
      .padStart(2, "0")}:${(normalizedMinute % 60).toString().padStart(2, "0")}`;
  }

  private getCorridorThroughNode(
    businessNode: Node,
    arrivalSection: TrainrunSection | undefined,
    departureSection: TrainrunSection | undefined,
  ): string {
    const formatNode = (node: Node | undefined, fallback: string): string =>
      node === undefined ? fallback : `${node.getBetriebspunktName()}(${node.getId()})`;
    return [
      formatNode(
        arrivalSection === undefined ? undefined : businessNode.getOppositeNode(arrivalSection),
        "start",
      ),
      `${businessNode.getBetriebspunktName()}(${businessNode.getId()})`,
      formatNode(
        departureSection === undefined ? undefined : businessNode.getOppositeNode(departureSection),
        "end",
      ),
    ].join(" -> ");
  }

  private matchesNodeTrackReservation(
    reservation: {
      trainrunId: number;
    },
    node: SgTrainrunNode,
  ): boolean {
    return reservation.trainrunId === node.trainrunId;
  }

  private getNodeTrackEstimationRange(nodes: SgTrainrunNode[]): {
    windowStartMinutes: number;
    windowMinutes: number;
  } {
    const nodeTimes = nodes.flatMap((node) => [node.arrivalTime, node.departureTime]);
    return {
      windowStartMinutes: Math.min(...nodeTimes, 0),
      windowMinutes: Math.max(...nodeTimes, 24 * 60),
    };
  }

  private updateStagingDwellAtEndpoints(pn: SgTrainrunNode) {
    // handle special case one way
    const tr = this.trainrunService.getTrainrunFromId(pn.trainrunId);
    if (tr === undefined) {
      // Ensure that the trainrun section is still valid. This may no
      // longer be the case, e.g., when a trainrun has been deleted and the
      // graphical timetable has not yet been fully updated.
      return;
    }
    if (tr.getDirection() === Direction.ONE_WAY) {
      const node = this.nodeService.getNodeFromId(pn.nodeId);
      const nodeHaltezeiten = node.getTrainrunCategoryHaltezeit();
      const trainrunHaltezeit = nodeHaltezeiten[tr.getTrainrunCategory().fachCategory].haltezeit;
      if (pn.arrivalPathSection === undefined) {
        pn.arrivalTime = pn.departureTime - trainrunHaltezeit;
      } else {
        pn.departureTime = pn.arrivalTime + trainrunHaltezeit;
      }
    }
  }

  private mapTrackToTop(
    trainrunItems: SgTrainrun[],
    sectionTrackMap: Map<string, [number, number, number][]>,
  ) {
    const maxTrackMap = new Map<string, TrackData>();
    const maxNodeTrackMap = new Map<SgPathNode, number>();
    trainrunItems.forEach((trainrunItem) => {
      trainrunItem.sgTrainrunItems.forEach((pathItem) => {
        if (pathItem.isNode()) {
          const pathNode = pathItem.getTrainrunNode().sgPathNode;
          const track = Math.max(
            pathNode.trackData.track,
            pathItem.getTrainrunNode().trackData.track,
          );
          maxNodeTrackMap.set(pathNode, Math.max(maxNodeTrackMap.get(pathNode) ?? 0, track));
        }
        if (pathItem.isSection()) {
          const ps = pathItem.getTrainrunSection();
          if (ps.trainrunBranchType === TrainrunBranchType.Trainrun) {
            const sectionKey = this.getSectionKey(ps);
            const trackSegments = sectionTrackMap.get(sectionKey.key);
            if (trackSegments !== undefined) {
              const convertedTrackSegments: TrackSegments[] = this.convertTrackSegments(
                trackSegments,
                1,
              );
              let maxTracks = 0;
              convertedTrackSegments.forEach((ts) => {
                maxTracks = Math.max(maxTracks, ts.nbrTracks);
              });
              convertedTrackSegments.forEach((t) => {
                t.nbrTracks = Math.ceil(t.minNbrTracks / 2) * 2;
              });
              ps.trackData.track = maxTracks;
              ps.trackData.nodeId1 = ps.departureNodeId;
              ps.trackData.nodeId2 = ps.arrivalNodeId;
              ps.trackData.sectionTrackSegments = convertedTrackSegments;
              maxTrackMap.set(
                pathItem.getTrainrunSection().departureNodeId +
                  ":" +
                  pathItem.getTrainrunSection().arrivalNodeId,
                ps.trackData,
              );
            }
          }
        }
      });
    });
    maxNodeTrackMap.forEach((track, pathNode) => {
      pathNode.trackData.track = Math.max(1, track);
    });
    this.setMaxTrackMap(maxTrackMap);
  }

  private setMaxTrackMap(maxTrackMap: Map<string, TrackData>) {
    maxTrackMap.forEach((trackData, key) => {
      this.selectedTrainrun.paths.forEach((path) => {
        if (path.isSection()) {
          const ps = path.getPathSection();
          const keyCommonBehavior = ps.arrivalNodeId + ":" + ps.departureNodeId;
          const keyOneWaySpecialCase = ps.departureNodeId + ":" + ps.arrivalNodeId;
          const ts = this.trainrunSectionService.getTrainrunSectionFromId(ps.trainrunSectionId);
          if (ts) {
            const pathKey = ts.getTrainrun().isRoundTrip()
              ? keyCommonBehavior
              : keyOneWaySpecialCase;
            if (pathKey === key) {
              ps.trackData = trackData;
            }
          }
        }
      });
    });
  }

  private convertTrackSegments(
    trackSegments: [number, number, number][],
    initMaxTracks: number,
  ) {
    const convertedTrackSegments: TrackSegments[] = [];
    let maxTracks = initMaxTracks;
    trackSegments.forEach((trackSeg) => {
      maxTracks = Math.max(trackSeg[2], maxTracks);
    });

    trackSegments.forEach((trackSeg) => {
      convertedTrackSegments.push(
        new TrackSegments(trackSeg[0], trackSeg[1], maxTracks, trackSeg[2], false),
      );
    });
    return convertedTrackSegments;
  }
}
