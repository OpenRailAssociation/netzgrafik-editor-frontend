import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {SgSelectedTrainrun} from "../model/streckengrafik-model/sg-selected-trainrun";
import {takeUntil} from "rxjs/operators";
import {TrackData, TrackSegments} from "../model/trackData";
import {SgTrainrunSection} from "../model/streckengrafik-model/sg-trainrun-section";
import {SgTrainrunItem} from "../model/streckengrafik-model/sg-trainrun-item";
import {SgTrainrunNode} from "../model/streckengrafik-model/sg-trainrun-node";
import {SgTrainrun} from "../model/streckengrafik-model/sg-trainrun";
import {TrainrunBranchType} from "../model/enum/trainrun-branch-type-type";
import {Sg5FilterService} from "./sg-5-filter.service";
import {DataService} from "../../services/data/data.service";
import {TrainrunFrequency} from "../../data-structures/business.data.structures";
import {NodeService} from "../../services/data/node.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {TrainrunService} from "../../services/data/trainrun.service";
import {TrainrunSection} from "../../models/trainrunsection.model";

@Injectable({
  providedIn: "root",
})
export class Sg6TrackService implements OnDestroy {
  public separateMainTracks = false;
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

  private getTrainrunSectionFromCacheDuringRendering(
    trainrunSectionId: number,
    trainrunSectionLookupCache: Map<number, TrainrunSection>,
  ): TrainrunSection {
    // Retrieves a TrainrunSection by its ID, using a cache to avoid redundant lookups.
    // If the section is not already in the provided cache, it fetches it from the service
    // and stores it in the cache for future use. This improves performance during rendering.
    let cachedLookup: TrainrunSection = trainrunSectionLookupCache.get(trainrunSectionId);
    if (cachedLookup === undefined) {
      cachedLookup = this.trainrunSectionService.getTrainrunSectionFromId(trainrunSectionId);
      trainrunSectionLookupCache.set(trainrunSectionId, cachedLookup);
    }
    return cachedLookup;
  }

  private render() {
    if (this.selectedTrainrun === undefined) {
      return;
    }

    // prepare fast look (cache for big netzgrafik)
    const trainrunSectionLookupCache = new Map<number, TrainrunSection>();

    // calculate the track occupier (node)
    const separateForwardBackwardTracks = this.separateForwardBackwardMainTracks;
    this.computeTrackAlignments(
      this.selectedTrainrun,
      separateForwardBackwardTracks,
      trainrunSectionLookupCache,
    );

    // calculate the required tracks "blocks" (section)
    const separateForwardBackwardSectionTracks = false;
    const sectionTrackMap = this.extractStreckenGleis(
      this.selectedTrainrun.trainruns,
      separateForwardBackwardSectionTracks,
      trainrunSectionLookupCache,
    );
    this.mapTrackToTop(
      this.selectedTrainrun.trainruns,
      sectionTrackMap,
      separateForwardBackwardSectionTracks,
      trainrunSectionLookupCache,
    );

    // update the rendering -> goto next pipeline step
    this.sgSelectedTrainrunSubject.next(this.selectedTrainrun);
  }

  private extractStreckenGleis(
    trainrunItems: SgTrainrun[],
    separateForwardBackwardTracks: boolean,
    trainrunSectionLookupCache: Map<number, TrainrunSection>,
  ) {
    const sectionsOfInterest = this.createSectionsOfInterestMap(
      trainrunItems,
      separateForwardBackwardTracks,
    );
    return this.extractSectionTracks(sectionsOfInterest, trainrunSectionLookupCache);
  }

  private createSectionsOfInterestMap(
    trainrunItems: SgTrainrun[],
    separateForwardBackwardTracks: boolean,
  ) {
    /*
    This method collects all trainrun sections and maps them into the sectionsOfInterest-Map to get fast access
     */
    const sectionsOfInterest = new Map<string, any[]>();
    trainrunItems.forEach((ts) => {
      ts.sgTrainrunItems.forEach((trainrunItem: SgTrainrunItem) => {
        if (trainrunItem.isSection()) {
          const ps: SgTrainrunSection = trainrunItem.getTrainrunSection();
          if (ps.trainrunBranchType === TrainrunBranchType.Trainrun) {
            const sectionKey = this.getSectionKey(ps, separateForwardBackwardTracks).key;
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

  private getSectionKey(ps: SgTrainrunSection, separateForwardBackwardTracks: boolean) {
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

  private getDistanceGridResolutionInfo(sectionData: any[]) {
    let nDistanceCells = 1;
    sectionData.forEach((d) => {
      const item: SgTrainrunItem = d.item;
      const travelTime = item.arrivalTime - item.departureTime;
      nDistanceCells = Math.max(nDistanceCells, Math.round(travelTime));
    });
    return nDistanceCells;
  }

  private mergeDistanceCellGridResoultionToBigSegment(
    tracksMatrix: number[],
    nDistanceCells: number,
  ): any[] {
    // unroll the data to segments
    const tracks: any[] = [];
    let nbrTracks: number = undefined;
    let from = 0.0;
    for (let distCellIdx = 0; distCellIdx < nDistanceCells; distCellIdx++) {
      nbrTracks = tracksMatrix[distCellIdx];
      const to = (distCellIdx + 1.0) / nDistanceCells;
      tracks.push([from, Math.min(to, 1.0), nbrTracks]);
      from = to;
    }
    if (from !== 1.0) {
      tracks.push([from, 1.0, tracksMatrix[nDistanceCells - 1]]);
    }
    if (tracks.length === 0) {
      return tracks;
    }

    // compress the number of sections
    const compactTracks: any[] = [];
    let start = 0;
    let end = 0;
    let value = tracks[0][2];
    tracks.forEach((d) => {
      if (value !== d[2]) {
        compactTracks.push([start, end, value]);
        start = end;
        value = d[2];
      }
      end = d[1];
    });
    compactTracks.push([start, 1.0, value]);

    return compactTracks;
  }

  private extractSectionTracks(
    sectionsOfInterest: Map<string, any[]>,
    trainrunSectionLookupCache: Map<number, TrainrunSection>,
    distRes = 15, // Res 4s
    timeRes = 15, // Res 4s
  ) {
    const sectionsTracks = new Map<string, number[]>();
    for (const keyNodeId of sectionsOfInterest.keys()) {
      // ------------------------------------------------------------------------------------------------------------------
      // step 1 -> get trainrun data (aligned to section)
      // ------------------------------------------------------------------------------------------------------------------
      const sectionData = sectionsOfInterest.get(keyNodeId);

      // ------------------------------------------------------------------------------------------------------------------
      // step 2 -> get distanace grid resolution
      // ------------------------------------------------------------------------------------------------------------------
      const nDistanceCells = distRes * this.getDistanceGridResolutionInfo(sectionData);
      const nTimeCells = timeRes * 2 * this.maxFrequency; // or some dynamic value

      // ------------------------------------------------------------------------------------------------------------------
      // step 3 -> create data structure
      // ------------------------------------------------------------------------------------------------------------------
      const dataMatrix: number[][] = new Array(nDistanceCells)
        .fill(0)
        .map(() => new Array(nTimeCells).fill(0));
      const tracksMatrix: number[] = new Array(nDistanceCells).fill(0);

      // ------------------------------------------------------------------------------------------------------------------
      // step 4 -> project all trainruns onto section occupation matrix
      // ------------------------------------------------------------------------------------------------------------------
      sectionData.forEach((d) => {
        const item: SgTrainrunItem = d.item;
        const travelTime = item.arrivalTime - item.departureTime;
        const departureMod = item.departureTime % this.maxFrequency;

        const ts = this.getTrainrunSectionFromCacheDuringRendering(
          item.getTrainrunSection().trainrunSectionId,
          trainrunSectionLookupCache,
        );

        const headwayTime =
          ts !== undefined
            ? ts.getTrainrun().getTrainrunCategory().sectionHeadway
            : this.minimumHeadwayTime;

        this.extractSectionsTrackDataCellByCell(
          nDistanceCells,
          nTimeCells,
          d.trainrun.frequency,
          item.backward,
          travelTime,
          departureMod,
          timeRes,
          headwayTime,
          dataMatrix,
          tracksMatrix,
        );
      });

      // ------------------------------------------------------------------------------------------------------------------
      // step 5 -> Merging the same number of tracks into one "large" segment
      // ------------------------------------------------------------------------------------------------------------------
      sectionsTracks.set(
        keyNodeId,
        this.mergeDistanceCellGridResoultionToBigSegment(tracksMatrix, nDistanceCells),
      );
    }

    return sectionsTracks;
  }

  private extractSectionsTrackDataCellByCell(
    nDistanceCells: number,
    nTimeCells: number,
    freq: number,
    backward: boolean,
    travelTime: number,
    departureMod: number,
    timeRes: number,
    headwayTime: number,
    dataMatrix: any[],
    tracksMatrix: number[],
  ) {
    // ----------------------------------------
    // iterate section data cell-by-cell foward
    // ----------------------------------------
    const f = 1.0 / (nDistanceCells - 0.5);
    for (let distCellIdx = 0; distCellIdx < nDistanceCells; distCellIdx++) {
      // compute the idx - forward / backward direction (transformation)
      const idx = backward ? nDistanceCells - distCellIdx - 1 : distCellIdx;
      // just precompute "static" part (performance)
      const travelTimeIdxPart = travelTime * distCellIdx * f;
      // unroll frequency to get the trains - generated out of the "template" train
      const localMax = this.extractSectionTracksUnrollFreq(
        departureMod,
        travelTimeIdxPart,
        freq,
        timeRes,
        dataMatrix[idx],
        headwayTime,
        nTimeCells,
      );

      const val = tracksMatrix[idx];
      if (val < localMax) {
        tracksMatrix[idx] = localMax;
      }
    }
  }

  private extractSectionTracksUnrollFreq(
    departureMod: number,
    travelTimeIdxPart: number,
    frequency: number,
    timeRes: number,
    dataMatAtIdx: Uint8Array,
    headwayTime: number,
    nTimeCells: number,
  ): number {
    let localMax = 0;
    const startAt = -this.maxFrequency;
    const endAt = this.maxFrequency;
    for (let freqLoop = startAt; freqLoop <= endAt; freqLoop = freqLoop + frequency) {
      // unroll frequency to get the trains - generated out of the "template" train
      // just precompute "static" part (performance)
      const timeCellIdxBase = departureMod + travelTimeIdxPart + freqLoop;

      // just precompute "static" part (performance)
      const baseTimeCellIdx = Math.round(timeRes * timeCellIdxBase);
      const bandMax = this.extractSectionTracksFillOccupationBand(
        dataMatAtIdx,
        baseTimeCellIdx,
        headwayTime,
        timeRes,
        nTimeCells,
      );
      if (bandMax > localMax) localMax = bandMax;
    }
    return localMax;
  }

  private extractSectionTracksFillOccupationBand(
    dataRow: Uint8Array,
    baseTimeCellIdx: number,
    headwayTime: number,
    timeRes: number,
    nTimeCells: number,
  ): number {
    // The headway bands – 'Nachbelegung' (release the "occupied resource" after this band).
    const bandLength = Math.round(timeRes * headwayTime);

    // ensure if the idx is to small or too big (avoid crash / exception)
    // ------------------------------------------------------------------
    // const startIdx = Math.max(0, Math.min(baseTimeCellIdx, nTimeCells)); -> (perf. opt.)
    const startIdx =
      baseTimeCellIdx < 0 ? 0 : baseTimeCellIdx > nTimeCells ? nTimeCells : baseTimeCellIdx;

    // const endIdx = Math.max(0, Math.min(baseTimeCellIdx + bandLength, nTimeCells)); (perf. opt.)
    const endVal = baseTimeCellIdx + bandLength;
    const endIdx = endVal < 0 ? 0 : endVal > nTimeCells ? nTimeCells : endVal;

    // Loop over the band (expensive part of the code)
    // -----------------------------------------------
    let maxValue = 0;
    for (let timeIdx = startIdx; timeIdx < endIdx; timeIdx++) {
      const current = dataRow[timeIdx];
      if (current < 255) {
        const newValue = current + 1;
        dataRow[timeIdx] = newValue;
        if (newValue > maxValue) maxValue = newValue;
      } else {
        maxValue = 255;
      }
    }
    return maxValue;
  }

  private getNodeKeyAlignmentsNodeData(pn: SgTrainrunNode): string {
    return "" + pn.getTrainrunNode().nodeId + "_" + pn.getTrainrunNode().index;
  }

  private getOrCreateTrackAlignmentsNodeData(
    nodesOfInterest: Map<
      string, // node id (key)
      Map<
        number, // track (key)
        [number, number][]
      >
    >,
    pn: SgTrainrunNode,
  ) {
    let nodeData = nodesOfInterest.get(this.getNodeKeyAlignmentsNodeData(pn));
    if (nodeData === undefined) {
      // create new nodeData
      nodeData = new Map();
      nodesOfInterest.set(this.getNodeKeyAlignmentsNodeData(pn), nodeData);
    }
    return nodesOfInterest.get(this.getNodeKeyAlignmentsNodeData(pn));
  }

  private checkOccupancyTrackAlignments(
    trackData: [number, number][],
    item: SgTrainrunItem,
    arrTime: number,
    depTime: number,
    ts: SgTrainrun,
    minimumHeadwayTime: number,
  ): boolean {
    const arrDepTimes = trackData.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const depArrTimes = trackData.sort((a, b) => (a[1] < b[1] ? -1 : 1));

    for (
      let offset = -((4 * this.maxFrequency) / ts.frequency);
      offset < (4 * this.maxFrequency) / ts.frequency;
      offset++
    ) {
      if (item.checkUnrollAllowed(offset)) {
        if (
          !this.checkOccupancyTrackElement(
            arrTime,
            depTime,
            offset,
            arrDepTimes,
            depArrTimes,
            ts,
            minimumHeadwayTime,
          )
        ) {
          return true;
        }
      }
    }

    return false;
  }

  private checkOccupancyTrackElement(
    arrTime: number,
    depTime: number,
    offset: number,
    arrDepTimes: [number, number][],
    depArrTimes: [number, number][],
    ts: SgTrainrun,
    minimumHeadwayTime: number,
  ): boolean {
    const at = arrTime + offset * ts.frequency;
    const dt = depTime + offset * ts.frequency + minimumHeadwayTime;

    const idxDtCase1 = arrDepTimes.findIndex((t) => t[0] > at);
    if (idxDtCase1 >= 0) {
      if (arrDepTimes[idxDtCase1][0] < dt) {
        return false;
      }
    }

    const idxDtCase2 = depArrTimes.findIndex((t) => t[1] > at);
    if (idxDtCase2 >= 0) {
      if (depArrTimes[idxDtCase2][0] < dt) {
        return false;
      }
    }
    return true;
  }

  private extractTrainrunTrackAlignments(
    trackData: [number, number][],
    item: SgTrainrunItem,
    arrTime: number,
    depTime: number,
    ts: SgTrainrun,
    minimumHeadwayTime: number,
  ) {
    const arrDepTrackData = trackData;
    for (let offset = 0; offset < (2 * this.maxFrequency) / ts.frequency; offset++) {
      if (item.checkUnrollAllowed(offset)) {
        const at = arrTime + offset * ts.frequency;
        const dt = depTime + offset * ts.frequency + minimumHeadwayTime;
        arrDepTrackData.push([at, dt]);
      }
    }
    return arrDepTrackData;
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
      // special case - when the turnaround time is too small - enforce a second train ond a
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

  private calculateMinimumHeadwayTimeAtNode(
    trainrunNode: SgTrainrunNode,
    trainrunSectionLookupCache: Map<number, TrainrunSection>,
  ) {
    //this.calculateMinimumHeadwayTime(pathNode, trainrun, trainrunSection);
    const node = this.nodeService.getNodeFromId(trainrunNode.nodeId);
    let trainrunSectionId: number = undefined;
    if (trainrunNode.arrivalPathSection !== undefined) {
      trainrunSectionId = trainrunNode.arrivalPathSection.trainrunSectionId;
    }
    if (trainrunNode.departurePathSection !== undefined) {
      trainrunSectionId = trainrunNode.departurePathSection.trainrunSectionId;
    }

    if (trainrunSectionId === undefined) {
      const trainrun = this.trainrunService.getTrainrunFromId(trainrunNode.trainrunId);
      if (trainrun === undefined) {
        // return default
        return this.minimumHeadwayTime;
      }
      // no transition ==> stop headway time
      return trainrun.getTrainrunCategory().nodeHeadwayStop;
    }

    const trainrunSection = this.getTrainrunSectionFromCacheDuringRendering(
      trainrunSectionId,
      trainrunSectionLookupCache,
    );

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

  private computeTrackAlignments(
    selectedTrainrun: SgSelectedTrainrun,
    separateForwardBackwardTracks = true,
    trainrunSectionLookupCache: Map<number, TrainrunSection>,
  ) {
    const trackInfoMap = new Map<number, PathNodeNeighbour[]>();

    const nodesOfInterest = new Map<
      string, // node id (key)
      Map<
        number, // track (key)
        [number, number][]
      >
    >(); //   arrTimes / depTimes

    // ------------------------------------------------------------------------------------------------------------------
    // process for each trainrun the three pass pipeline
    // ------------------------------------------------------------------------------------------------------------------
    selectedTrainrun.trainruns.forEach((ts) => {
      // ------------------------------------------------------------------------------------------------------------------
      // pass 1 -> transform endNode ("Umlauf")
      // ------------------------------------------------------------------------------------------------------------------
      ts.sgTrainrunItems.forEach((item) => {
        if (item.isNode()) {
          const headwayTime = this.calculateMinimumHeadwayTimeAtNode(
            item.getTrainrunNode(),
            trainrunSectionLookupCache,
          );
          item.getTrainrunNode().setMinimumHeadwayTime(headwayTime);
        }
      });

      // ------------------------------------------------------------------------------------------------------------------
      // pass 2 -> transform endNode ("Umlauf")
      // ------------------------------------------------------------------------------------------------------------------
      ts.sgTrainrunItems.forEach((item) => {
        if (item.isNode()) {
          this.transformTurnarounds(item.getTrainrunNode(), ts, item.minimumHeadwayTime);
        }
      });

      // ------------------------------------------------------------------------------------------------------------------
      // pass 3 -> detect self alignment issue
      // ------------------------------------------------------------------------------------------------------------------
      this.clearExtraTrains(ts);
      const collectExtraTrainruns: SgTrainrunNode[] = [];
      ts.sgTrainrunItems.forEach((item) => {
        if (item.isNode()) {
          this.detectAndCreateExtraTrains(
            ts,
            item.getTrainrunNode(),
            item.minimumHeadwayTime,
            collectExtraTrainruns,
          );
        }
      });
      this.concatExtraTrains(ts, collectExtraTrainruns);

      // ------------------------------------------------------------------------------------------------------------------
      // pass 4 -> handle all endNode
      // ------------------------------------------------------------------------------------------------------------------
      ts.sgTrainrunItems.forEach((item) => {
        if (item.isNode()) {
          // get the trainrun node data (typ casting)
          const pn: SgTrainrunNode = item.getTrainrunNode();
          if (pn.endNode && !pn.unusedForTurnaround) {
            this.alignTrainrunNodeToTrack(
              item,
              ts,
              nodesOfInterest,
              trackInfoMap,
              item.minimumHeadwayTime,
              separateForwardBackwardTracks,
            );
          }
        }
      });

      // ------------------------------------------------------------------------------------------------------------------
      // pass 5 -> handle all nodes which are not endNode
      // ------------------------------------------------------------------------------------------------------------------
      ts.sgTrainrunItems.forEach((item) => {
        if (item.isNode()) {
          // get the trainrun node data (typ casting)
          const pn: SgTrainrunNode = item.getTrainrunNode();
          if (!pn.endNode) {
            this.alignTrainrunNodeToTrack(
              item,
              ts,
              nodesOfInterest,
              trackInfoMap,
              item.minimumHeadwayTime,
              separateForwardBackwardTracks,
            );
          }
        }
      });
    });

    // ------------------------------------------------------------------------------------------------------------------
    // Transform data
    // ------------------------------------------------------------------------------------------------------------------
    this.makeTrackSymmetric(trackInfoMap, separateForwardBackwardTracks);
    this.updateTracksForAllPathNodes(trackInfoMap, separateForwardBackwardTracks);
  }

  private alignTrainrunNodeToTrack(
    item: SgTrainrunItem,
    ts: SgTrainrun,
    nodesOfInterest: Map<
      string, // node id (key)
      Map<
        number, // track (key)
        [number, number][]
      >
    >,
    trackInfoMap: Map<number, PathNodeNeighbour[]>,
    minimumHeadwayTime: number,
    separateForwardBackwardTracks: boolean,
  ) {
    const pn: SgTrainrunNode = item.getTrainrunNode();

    // get or create the node alignment (per node a data set)
    const nodeData = this.getOrCreateTrackAlignmentsNodeData(nodesOfInterest, pn);

    // calculate the track occupency and create new tracks if no space is left to align a trainrun into a track
    let trackIdx = 0;
    let trackOfInterest = this.estimateTrackOfInterest(
      trackIdx,
      item,
      separateForwardBackwardTracks,
      trackInfoMap,
    );
    let trackData = nodeData.get(trackOfInterest);
    let isOccupied = true;
    while (isOccupied) {
      if (trackData === undefined) {
        trackData = [];
        nodeData.set(trackOfInterest, trackData);
        if (separateForwardBackwardTracks) {
          nodeData.set(trackOfInterest + 1, []);
        }
      }
      if (separateForwardBackwardTracks && !pn.endNode) {
        if (item.backward) {
          if (trackOfInterest % 2 === 0) {
            isOccupied = this.checkOccupancyTrackAlignments(
              trackData,
              item,
              item.arrivalTime,
              item.departureTime,
              ts,
              minimumHeadwayTime,
            );
          }
        } else {
          if (trackOfInterest % 2 === 1) {
            isOccupied = this.checkOccupancyTrackAlignments(
              trackData,
              item,
              item.arrivalTime,
              item.departureTime,
              ts,
              minimumHeadwayTime,
            );
          }
        }
      } else {
        isOccupied = this.checkOccupancyTrackAlignments(
          trackData,
          item,
          item.arrivalTime,
          item.departureTime,
          ts,
          minimumHeadwayTime,
        );
      }
      if (isOccupied) {
        trackIdx += 1;
        trackOfInterest = this.estimateTrackOfInterest(
          trackIdx,
          item,
          separateForwardBackwardTracks,
          trackInfoMap,
        );
        trackData = nodeData.get(trackOfInterest);
      }
    }

    // update the track alignments
    item.getTrainrunNode().trackData.track = 1 + trackOfInterest;
    item.minimumHeadwayTime = minimumHeadwayTime;

    nodeData.set(
      trackOfInterest,
      this.extractTrainrunTrackAlignments(
        trackData,
        item,
        item.arrivalTime,
        item.departureTime,
        ts,
        minimumHeadwayTime,
      ),
    );
    nodesOfInterest.set(this.getNodeKeyAlignmentsNodeData(pn), nodeData);
  }

  private makeTrackSymmetricSortTracks(tracks: PathNodeNeighbour[]): PathNodeNeighbour[] {
    // sort tracks (node1 < node2 < trackNbr)
    return tracks.sort((a: PathNodeNeighbour, b: PathNodeNeighbour) => {
      if (a.nodeId1 === undefined || b.nodeId1 === undefined) {
        return a.trackNbr - b.trackNbr;
      }
      if (a.nodeId1 <= b.nodeId1) {
        if (a.nodeId2 === undefined || b.nodeId2 === undefined) {
          return a.trackNbr - b.trackNbr;
        }
        if (a.nodeId1 === b.nodeId1) {
          if (a.nodeId2 === b.nodeId2) {
            return a.trackNbr - b.trackNbr;
          }
          return a.nodeId2 - b.nodeId2;
        }
        return -1;
      }
      return 1;
    });
  }

  private makeTrackSymmetricUpdateTrackAlignment(
    tracks: PathNodeNeighbour[],
    separateForwardBackwardTracks: boolean,
  ) {
    let trackItr = 0;
    let prevPn = tracks[0];
    let mainTrackIdx = -1;
    const mainTrackIdxMap = new Map<string, number>();
    const mainTrackOffsetMap = new Map<string, number>();
    tracks.forEach((pn: PathNodeNeighbour) => {
      if (prevPn.nodeId1 === pn.nodeId1 && prevPn.nodeId2 === pn.nodeId2) {
        mainTrackIdx += 1;
      } else {
        mainTrackIdx = 0;
      }
      mainTrackIdxMap.set("" + pn.nodeId1 + "#" + pn.nodeId2, mainTrackIdx);
      if (mainTrackIdx === 0) {
        mainTrackOffsetMap.set("" + pn.nodeId1 + "#" + pn.nodeId2, trackItr);
      }
      pn.trackNbr = trackItr;
      pn.mainTrackIdx = mainTrackIdx;
      pn.pathNodes.forEach((sgTN) => {
        const curTrack = this.getTrackNumber(
          pn.trackNbr,
          sgTN.backward,
          separateForwardBackwardTracks,
        );
        sgTN.trackData.track = 1 + curTrack;
      });
      prevPn = pn;
      trackItr++;
    });
    return {
      mainTrackIdxMap: mainTrackIdxMap,
      mainTrackOffsetMap: mainTrackOffsetMap,
    };
  }

  private makeTrackSymmetric(
    nodeTracksMap: Map<number, PathNodeNeighbour[]>,
    separateForwardBackwardTracks,
  ) {
    if (!separateForwardBackwardTracks) {
      return;
    }
    for (const keyNodeId of nodeTracksMap.keys()) {
      // order the tracks -> sort tracks (node1 < node2 < trackNbr)
      const tracks = this.makeTrackSymmetricSortTracks(nodeTracksMap.get(keyNodeId));

      // align train to reordered track (update track nbr)
      const tracKInfo = this.makeTrackSymmetricUpdateTrackAlignment(
        tracks,
        separateForwardBackwardTracks,
      );

      // update track map
      nodeTracksMap.set(keyNodeId, tracks);

      // create symmetric track alignment (layout)
      tracks.forEach((pn: PathNodeNeighbour) => {
        pn.pathNodes.forEach((sgTN) => {
          if (!sgTN.unusedForTurnaround) {
            const mtr = tracKInfo.mainTrackIdxMap.get("" + pn.nodeId1 + "#" + pn.nodeId2) + 1;
            const tracksDirectionCenter = (mtr + 1) / 2;
            const offsetTrack = tracKInfo.mainTrackOffsetMap.get(
              "" + pn.nodeId1 + "#" + pn.nodeId2,
            );
            const curTrack =
              pn.mainTrackIdx % 2 === 0
                ? Math.ceil(tracksDirectionCenter - (1 + pn.mainTrackIdx) / 2)
                : Math.floor(tracksDirectionCenter + (1 + pn.mainTrackIdx) / 2);
            const track = offsetTrack + curTrack - 1.0;
            sgTN.trackData.track = track + 1.0;
          }
        });
      });
    }
  }

  private estimateTrackOfInterest(
    trackIdx: number,
    trainrunItem: SgTrainrunItem,
    separateForwardBackwardTracks: boolean,
    nodeTracksMap: Map<number, PathNodeNeighbour[]>,
  ): number {
    if (!trainrunItem.isNode()) {
      return trackIdx;
    }

    const node = trainrunItem.getTrainrunNode();
    const nodeNeighbors: PathNodeNeighbour = this.getNeighborNodeIDs(node);
    const nodeTracks: PathNodeNeighbour[] = nodeTracksMap.get(node.nodeId);
    if (nodeTracks === undefined) {
      nodeNeighbors.pathNodes.push(node);
      nodeTracksMap.set(node.nodeId, [nodeNeighbors]);
      return this.getTrackNumber(
        nodeNeighbors.trackNbr,
        trainrunItem.backward,
        separateForwardBackwardTracks,
      );
    }

    // find track
    const foundTracks = this.getConnectNeighbourNodeTracks(nodeTracks, nodeNeighbors);

    if (foundTracks === undefined || foundTracks.length === trackIdx) {
      // request for a new track
      nodeNeighbors.trackNbr = foundTracks === undefined ? 0 : this.createNewTrack(nodeTracks);
      nodeNeighbors.mainTrackIdx = foundTracks === undefined ? 0 : this.createNewTrack(foundTracks);
      nodeNeighbors.pathNodes.push(node);
      nodeTracks.push(nodeNeighbors);
      return this.getTrackNumber(
        nodeNeighbors.trackNbr,
        trainrunItem.backward,
        separateForwardBackwardTracks,
      );
    }

    const trackData = foundTracks[trackIdx];
    if (trackData.nodeId1 === undefined || trackData.nodeId2 === undefined) {
      // update track from - to
      trackData.nodeId1 = nodeNeighbors.nodeId1;
      trackData.nodeId2 = nodeNeighbors.nodeId2;
    }
    trackData.pathNodes.push(node);
    return this.getTrackNumber(
      trackData.trackNbr,
      trainrunItem.backward,
      separateForwardBackwardTracks,
    );
  }

  private updateTracksForAllPathNodes(
    nodeTracksMap: Map<number, PathNodeNeighbour[]>,
    separateForwardBackwardTracks,
  ) {
    for (const keyNodeId of nodeTracksMap.keys()) {
      const tracks = nodeTracksMap.get(keyNodeId);
      const nodeTracks: TrackData[] = [];
      tracks.forEach((pn: PathNodeNeighbour) => {
        const track1 = new TrackData(
          this.getTrackNumber(pn.trackNbr, false, separateForwardBackwardTracks),
          pn.nodeId1,
          pn.nodeId2,
        );
        track1.setTrackGrp(pn.trackNbr);
        nodeTracks.push(track1);
      });
      tracks.forEach((pn) => {
        pn.pathNodes.forEach((node) => {
          node.trackData.nodeId1 = pn.nodeId1;
          node.trackData.nodeId2 = pn.nodeId2;
          node.trackData.setNodeTracks(nodeTracks);
        });
      });
    }
  }

  private getTrackNumber(
    track: number,
    backward: boolean,
    separateForwardBackwardTracks: boolean,
  ): number {
    return track;
  }

  private getConnectNeighbourNodeTracks(
    nodeTracks: PathNodeNeighbour[],
    nodeNeighbors: PathNodeNeighbour,
  ): PathNodeNeighbour[] {
    return nodeTracks.filter((pnn: PathNodeNeighbour) => {
      if (nodeNeighbors.nodeId2 === undefined) {
        const ok = pnn.nodeId1 === nodeNeighbors.nodeId1 || pnn.nodeId2 === nodeNeighbors.nodeId1;
        if (ok) {
          return ok;
        }
      }

      if (pnn.nodeId2 === undefined) {
        const ok = pnn.nodeId1 === nodeNeighbors.nodeId1 || pnn.nodeId1 === nodeNeighbors.nodeId2;
        if (ok) {
          return ok;
        }
      }

      return (
        (pnn.nodeId1 === nodeNeighbors.nodeId1 && pnn.nodeId2 === nodeNeighbors.nodeId2) ||
        (pnn.nodeId2 === nodeNeighbors.nodeId1 && pnn.nodeId1 === nodeNeighbors.nodeId2)
      );
    });
  }

  private createNewTrack(pnn: PathNodeNeighbour[]): number {
    let maxTrack = 0;
    pnn.forEach((t) => {
      maxTrack = Math.max(t.trackNbr + 1, maxTrack);
    });
    return maxTrack;
  }

  private getNeighborNodeIDs(node: SgTrainrunNode): PathNodeNeighbour {
    if (!this.separateMainTracks) {
      return new PathNodeNeighbour(undefined, undefined, 0, 0, []);
    }

    // new starting
    let fromNodeId = undefined;
    if (node.arrivalPathSection !== undefined) {
      if (node.nodeId === node.arrivalPathSection.arrivalNodeId) {
        fromNodeId = node.arrivalPathSection.departureNodeId;
      } else {
        fromNodeId = node.arrivalPathSection.arrivalNodeId;
      }
    }

    let toNodeId = undefined;
    if (node.departurePathSection !== undefined) {
      if (node.nodeId === node.departurePathSection.departureNodeId) {
        toNodeId = node.departurePathSection.arrivalNodeId;
      } else {
        toNodeId = node.departurePathSection.departureNodeId;
      }
    }

    if (fromNodeId === undefined) {
      fromNodeId = toNodeId;
      toNodeId = undefined;
    }

    if (fromNodeId !== undefined && toNodeId !== undefined) {
      if (fromNodeId > toNodeId) {
        const s = fromNodeId;
        fromNodeId = toNodeId;
        toNodeId = s;
      }
    }

    if (fromNodeId === toNodeId) {
      toNodeId = undefined;
    }

    return new PathNodeNeighbour(fromNodeId, toNodeId, 0, 0, []);
  }

  private mapTrackToTop(
    trainrunItems: SgTrainrun[],
    sectionTrackMap: Map<string, number[]>,
    separateForwardBackwardTracks: boolean,
    trainrunSectionLookupCache: Map<number, TrainrunSection>,
  ) {
    const maxTrackMap = new Map<string, TrackData>();
    trainrunItems.forEach((trainrunItem) => {
      trainrunItem.sgTrainrunItems.forEach((pathItem) => {
        if (pathItem.isNode()) {
          if (maxTrackMap.has("" + pathItem.getTrainrunNode().nodeId)) {
            const trackData = maxTrackMap.get("" + pathItem.getTrainrunNode().nodeId);
            if (trackData.track < pathItem.getTrainrunNode().trackData.track) {
              maxTrackMap.set(
                "" + pathItem.getTrainrunNode().nodeId,
                pathItem.getTrainrunNode().trackData,
              );
            }
          } else {
            maxTrackMap.set(
              "" + pathItem.getTrainrunNode().nodeId,
              pathItem.getTrainrunNode().trackData,
            );
          }
        }
        if (pathItem.isSection()) {
          const ps = pathItem.getTrainrunSection();
          if (ps.trainrunBranchType === TrainrunBranchType.Trainrun) {
            const sectionKey = this.getSectionKey(ps, separateForwardBackwardTracks);
            const trackSegements = sectionTrackMap.get(sectionKey.key);
            if (trackSegements !== undefined) {
              const convertedTrackSegments: TrackSegments[] = this.convertTrackSegments(
                trackSegements,
                false,
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
              ps.trackData.nodeId1 = sectionKey.node1;
              ps.trackData.nodeId2 = sectionKey.node2;
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
    this.setMaxTrackMap(maxTrackMap, trainrunSectionLookupCache);
  }

  private setMaxTrackMap(
    maxTrackMap: Map<string, TrackData>,
    trainrunSectionLookupCache: Map<number, TrainrunSection>,
  ) {
    maxTrackMap.forEach((trackData, key) => {
      this.selectedTrainrun.paths.forEach((path) => {
        if (path.isNode()) {
          if ("" + path.getPathNode().nodeId === key) {
            if (path.getPathNode().trackData.track !== trackData.track) {
              path.getPathNode().trackData = trackData;
            }
          }
        }
        if (path.isSection()) {
          // This code checks if the current path section matches a specified key
          // before copying track data to it. There are two main conditions:
          //
          // 1. **Common Behavior**:
          //    - We copy the track data if the arrival and departure node IDs of the
          //      path section match the key in the correct order (arrival:departure).
          //
          // 2. **One-Way Check**:
          //    - For one-way train runs (non-round trips), we also check if the
          //      section's departure and arrival node IDs match the key in reverse
          //      order (departure:arrival). This allows us to handle one-way
          //      template train runs correctly.
          //
          // If either condition is satisfied, the track data will be assigned to
          // the path section.
          const ps = path.getPathSection();
          const keyCommonBehavior = ps.arrivalNodeId + ":" + ps.departureNodeId;
          const keyOneWaySpecialCase = ps.departureNodeId + ":" + ps.arrivalNodeId;

          const ts = this.getTrainrunSectionFromCacheDuringRendering(
            ps.trainrunSectionId,
            trainrunSectionLookupCache,
          );
          const isRoundTrip = ts.getTrainrun().isRoundTrip();

          if (keyCommonBehavior === key || (!isRoundTrip && keyOneWaySpecialCase === key)) {
            ps.trackData = trackData;
          }
        }
      });
    });
  }

  private convertTrackSegments(trackSegements: number[], backward: boolean, initMaxTracks: number) {
    const convertedTrackSegments: TrackSegments[] = [];
    let maxTracks = initMaxTracks;
    trackSegements.forEach((trackSeg) => {
      maxTracks = Math.max(trackSeg[2], maxTracks);
    });

    trackSegements.forEach((trackSeg) => {
      convertedTrackSegments.push(
        new TrackSegments(trackSeg[0], trackSeg[1], maxTracks, trackSeg[2], backward),
      );
    });
    return convertedTrackSegments;
  }
}

class PathNodeNeighbour {
  constructor(
    public nodeId1: number,
    public nodeId2: number,
    public trackNbr: number,
    public mainTrackIdx: number,
    public pathNodes: SgTrainrunNode[],
  ) {}
}
