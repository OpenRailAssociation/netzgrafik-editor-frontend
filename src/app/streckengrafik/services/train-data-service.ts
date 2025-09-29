import {Injectable, OnDestroy} from "@angular/core";
import {TrainrunService} from "../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {StaticDomTags} from "../../view/editor-main-view/data-views/static.dom.tags";
import {TrainrunSectionText} from "../../data-structures/technical.data.structures";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {NodeService} from "../../services/data/node.service";

@Injectable({
  providedIn: "root",
})
export class TrainDataService implements OnDestroy {
  private lruCacheIsTrainrunConnected = new Map<number, boolean>();
  private destroyed = new Subject<void>();

  constructor(
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private nodeService: NodeService,
  ) {
    this.trainrunService.trainruns.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.lruCacheIsTrainrunConnected.clear();
    });
    this.trainrunSectionService.trainrunSections.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.lruCacheIsTrainrunConnected.clear();
    });
    this.nodeService.transitions.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.lruCacheIsTrainrunConnected.clear();
    });
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  isTrainrunSelected(trainrunId: number): boolean {
    return this.trainrunService.getSelectedTrainrun().getId() === trainrunId;
  }

  isTrainrunConnected(trainrunId: number): boolean {
    const selectedTrainrun = this.trainrunService.getSelectedTrainrun();
    if (selectedTrainrun !== null) {
      const data = this.lruCacheIsTrainrunConnected.get(trainrunId);
      if (data !== undefined) {
        return data;
      }
      const connectedTrainruns = this.trainrunService.getConnectedTrainrunIdsFirstOrder(
        selectedTrainrun.getId(),
      );
      const ret = connectedTrainruns.find((id) => id === trainrunId) !== undefined;
      this.lruCacheIsTrainrunConnected.set(trainrunId, ret);
      return ret;
    }
    return false;
  }

  createColoringClassTags(trainrunId: number): string {
    let tag = "";
    if (this.trainrunService.getSelectedTrainrun() === null) {
      return tag;
    }
    if (this.isTrainrunSelected(trainrunId)) {
      tag += " " + StaticDomTags.TAG_SELECTED;
    } else {
      if (!this.isTrainrunConnected(trainrunId)) {
        tag += " " + StaticDomTags.TAG_MUTED;
      }
    }
    return tag;
  }

  getDisplayTextHtmlStyle(trainrunSectionId: number, textElement: TrainrunSectionText): string {
    const trainrunSection = this.trainrunSectionService.getTrainrunSectionFromId(trainrunSectionId);
    if (trainrunSection === undefined) {
      return undefined;
    }
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
        return trainrunSection.getSourceDepartureFormattedDisplayHtmlStyle();
      case TrainrunSectionText.SourceArrival:
        return trainrunSection.getSourceArrivalFormattedDisplayHtmlStyle();
      case TrainrunSectionText.TargetDeparture:
        return trainrunSection.getTargetDepartureFormattedDisplayHtmlStyle();
      case TrainrunSectionText.TargetArrival:
        return trainrunSection.getTargetArrivalFormattedDisplayHtmlStyle();
      case TrainrunSectionText.TrainrunSectionTravelTime:
        return trainrunSection.getTravelTimeFormattedDisplayHtmlStyle();
      default:
        return undefined;
    }
  }

  getDisplayText(
    trainrunSectionId: number,
    textElement: TrainrunSectionText,
    offset: number,
  ): string {
    const trainrunSection = this.trainrunSectionService.getTrainrunSectionFromId(trainrunSectionId);
    if (trainrunSection === undefined) {
      return undefined;
    }
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
        return trainrunSection.getSourceDepartureFormattedDisplayText(offset);
      case TrainrunSectionText.SourceArrival:
        return trainrunSection.getSourceArrivalFormattedDisplayText(offset);
      case TrainrunSectionText.TargetDeparture:
        return trainrunSection.getTargetDepartureFormattedDisplayText(offset);
      case TrainrunSectionText.TargetArrival:
        return trainrunSection.getTargetArrivalFormattedDisplayText(offset);
      case TrainrunSectionText.TrainrunSectionTravelTime:
        return trainrunSection.getTravelTimeFormattedDisplayText(offset);
      default:
        return undefined;
    }
  }

  getDisplayTextColorRef(trainrunSectionId: number, textElement: TrainrunSectionText): string {
    const trainrunSection = this.trainrunSectionService.getTrainrunSectionFromId(trainrunSectionId);
    if (trainrunSection === undefined) {
      return undefined;
    }
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
        return trainrunSection.getSourceDepartureFormatterColorRef();
      case TrainrunSectionText.SourceArrival:
        return trainrunSection.getSourceArrivalFormatterColorRef();
      case TrainrunSectionText.TargetDeparture:
        return trainrunSection.getTargetDepartureFormatterColorRef();
      case TrainrunSectionText.TargetArrival:
        return trainrunSection.getTargetArrivalFormatterColorRef();
      case TrainrunSectionText.TrainrunSectionTravelTime:
        return trainrunSection.getTravelTimeFormatterColorRef();
      default:
        return undefined;
    }
  }

  getDisplayTextWidth(trainrunSectionId: number, textElement: TrainrunSectionText): number {
    const trainrunSection = this.trainrunSectionService.getTrainrunSectionFromId(trainrunSectionId);
    if (trainrunSection === undefined) {
      return undefined;
    }
    switch (textElement) {
      case TrainrunSectionText.SourceDeparture:
        return trainrunSection.getSourceDepartureFormattedDisplayTextWidth();
      case TrainrunSectionText.SourceArrival:
        return trainrunSection.getSourceArrivalFormattedDisplayTextWidth();
      case TrainrunSectionText.TargetDeparture:
        return trainrunSection.getTargetDepartureFormattedDisplayTextWidth();
      case TrainrunSectionText.TargetArrival:
        return trainrunSection.getTargetArrivalFormattedDisplayTextWidth();
      case TrainrunSectionText.TrainrunSectionTravelTime:
        return trainrunSection.getTravelTimeFormattedDisplayTextWidth();
      default:
        return undefined;
    }
  }
}
