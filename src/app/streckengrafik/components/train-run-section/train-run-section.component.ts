import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
} from "@angular/core";
import {SgTrainrun} from "../../model/streckengrafik-model/sg-trainrun";
import {SgTrainrunItem} from "../../model/streckengrafik-model/sg-trainrun-item";
import {TrainrunService} from "../../../services/data/trainrun.service";
import {TrainDataService} from "../../services/train-data-service";
import {TrainrunBranchType} from "../../model/enum/trainrun-branch-type-type";
import {Vec2D} from "../../../utils/vec2D";
import {takeUntil} from "rxjs/operators";
import {TimeSliderService} from "../../services/time-slider.service";
import {interval, Subject, take} from "rxjs";
import {TrainrunSectionText} from "../../../data-structures/technical.data.structures";
import {
  TrainrunDialogParameter,
  TrainrunDialogType,
} from "../../../view/dialogs/trainrun-and-section-dialog/trainrun-and-section-dialog.component";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {
  InformSelectedTrainrunClick,
  TrainrunSectionService,
} from "../../../services/data/trainrunsection.service";
import {FilterService} from "../../../services/ui/filter.service";
import {
  UpdateCounterController,
  UpdateCounterHandler,
  UpdateCounterTriggerService,
} from "../../services/util/update-counter.service";
import {SliderChangeInfo} from "../../model/util/sliderChangeInfo";
import {NodeService} from "../../../services/data/node.service";
import {SgTrainrunSection} from "../../model/streckengrafik-model/sg-trainrun-section";
import {StreckengrafikDisplayElementService} from "../../services/util/streckengrafik-display-element.service";
import {ViewBoxChangeInfo} from "../../model/util/viewBoxChangeInfo";
import {ViewBoxService} from "../../services/util/view-box.service";
import {Sg4ToggleTrackOccupierService} from "../../services/sg-4-toggle-track-occupier.service";

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: "[sbb-train-run-section]",
  templateUrl: "./train-run-section.component.html",
  styleUrls: ["./train-run-section.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainRunSectionComponent implements OnDestroy, UpdateCounterHandler {
  @Input()
  trainrun: SgTrainrun;

  @Input()
  trainrunItem: SgTrainrunItem;

  @Input()
  freqOffset: number;

  showArrivalTime = true;
  showDepartureTime = true;
  showTextLabel = true;
  showTrainRunSectionStops = true;

  yZoom = 1;
  yMove = 0;
  recalc = true;

  delayedRendering = false;
  private fullDetailRenderingUpdateCounter = 0;
  private readonly destroyed$ = new Subject<void>();
  private updateCounterController: UpdateCounterController = undefined;
  viewBoxChangeInfo: ViewBoxChangeInfo = new ViewBoxChangeInfo();
  clipData: boolean = false;

  constructor(
    private readonly trainrunService: TrainrunService,
    private readonly trainDataService: TrainDataService,
    private readonly nodeService: NodeService,
    private readonly timeSliderService: TimeSliderService,
    private readonly uiInteractionService: UiInteractionService,
    private readonly trainrunSectionService: TrainrunSectionService,
    private readonly filterService: FilterService,
    private readonly updateCounterTriggerService: UpdateCounterTriggerService,
    private readonly streckengrafikDisplayElementService: StreckengrafikDisplayElementService,
    private readonly viewBoxService: ViewBoxService,
    private readonly sg4ToggleTrackOccupierService: Sg4ToggleTrackOccupierService,
    private readonly cd: ChangeDetectorRef,
  ) {
    this.timeSliderService
      .getSliderChangeObservable()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((sliderChangeInfo: SliderChangeInfo) => {
        this.yZoom = sliderChangeInfo.zoom;
        this.yMove = sliderChangeInfo.move;
        this.recalc = sliderChangeInfo.recalc;
        this.cd.markForCheck();
        this.doDelayedRendering();
      });

    this.viewBoxService
      .getViewBox()
      .pipe(takeUntil(this.destroyed$))
      .subscribe((viewBoxChangeInfo) => {
        this.viewBoxChangeInfo = viewBoxChangeInfo;
        this.cd.markForCheck();
        this.doDelayedRendering();
      });

    this.sg4ToggleTrackOccupierService
      .getTrackOccupierOnOff()
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        this.cd.markForCheck();
      });

    this.streckengrafikDisplayElementService
      .getStreckengrafikDisplayElement()
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        this.cd.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  onEdgeLineClick($event: MouseEvent) {
    $event.preventDefault();
    $event.stopImmediatePropagation();
    if (!this.trainrunService.getTrainrunFromId(this.trainrun.trainrunId)?.selected()) {
      this.trainrunService.setTrainrunAsSelected(this.trainrun.trainrunId);
    } else {
      const param: InformSelectedTrainrunClick = {
        trainrunSectionId: this.trainrunItem.getTrainrunSection().trainrunSectionId,
        open: true,
      };
      this.trainrunSectionService.clickSelectedTrainrunSection(param);
    }
  }

  public getClassTag(tag: string): string {
    let retTag = this.getGeneralNoColorRefClassTag(tag);
    retTag += " ColorRef_" + this.trainrun.colorRef;
    retTag += " backward_" + this.trainrunItem.backward;
    retTag +=
      " trainrunBranchType_" +
      TrainrunBranchType[this.trainrunItem.getTrainrunSection().trainrunBranchType];

    retTag += " Streckengrafik ";
    return retTag;
  }

  getGeneralNoColorRefClassTag(tag: string): string {
    tag += " " + this.trainDataService.createColoringClassTags(this.trainrun.trainrunId);
    return tag;
  }

  sectionPath(sectionPath: ScaledPath): string {
    return this.path(sectionPath);
  }

  sectionBandPath(scaledPath: ScaledPath): string {
    const ts = this.trainrunSectionService.getTrainrunSectionFromId(
      this.trainrunItem.getTrainrunSection().trainrunSectionId,
    );

    const scaledBand =
      ts !== undefined
        ? this.yZoom * ts.getTrainrun().getTrainrunCategory().sectionHeadway
        : this.yZoom * 2;
    return (
      "M " +
      scaledPath.scaledPathFrom.getX() +
      " " +
      scaledPath.scaledPathFrom.getY() +
      " L " +
      scaledPath.scaledPathTo.getX() +
      " " +
      scaledPath.scaledPathTo.getY() +
      " L " +
      scaledPath.scaledPathTo.getX() +
      " " +
      (scaledPath.scaledPathTo.getY() + scaledBand) +
      " L " +
      scaledPath.scaledPathFrom.getX() +
      " " +
      (scaledPath.scaledPathFrom.getY() + scaledBand) +
      " L " +
      scaledPath.scaledPathFrom.getX() +
      " " +
      scaledPath.scaledPathFrom.getY()
    );
  }

  showHeadwayBand(): boolean {
    return this.streckengrafikDisplayElementService.isHeadwayBandVisible();
  }

  scaledPath(): ScaledPath {
    const sp = this.scaledPath2();

    const x1 = this.viewBoxChangeInfo.x;
    const x2 = this.viewBoxChangeInfo.x + this.viewBoxChangeInfo.width;
    const y1 = this.viewBoxChangeInfo.y;
    const y2 = this.viewBoxChangeInfo.y + this.viewBoxChangeInfo.height;

    const checkToX = sp.scaledPathTo.getX() < x1 || sp.scaledPathTo.getX() > x2;
    const checkFromX = sp.scaledPathFrom.getX() < x1 || sp.scaledPathFrom.getX() > x2;
    const checkToY = sp.scaledPathTo.getY() < y1 || sp.scaledPathTo.getY() > y2;
    const checkFromY = sp.scaledPathFrom.getY() < y1 || sp.scaledPathFrom.getY() > y2;
    this.clipData = checkFromX && checkToX && checkFromY && checkToY;

    return sp;
  }

  scaledPath2(): ScaledPath {
    // Trainrun
    if (this.trainrunItem.getTrainrunSection().trainrunBranchType === TrainrunBranchType.Trainrun) {
      const departureTime = this.trainrunItem.departureTime * this.yZoom;
      const arrivalTime = this.trainrunItem.arrivalTime * this.yZoom;
      const zommedXPath = this.trainrunItem.getPathSection().zoomedXPath();
      this.showArrivalTime = true;
      this.showDepartureTime = true;
      this.showTextLabel = true;
      this.showTrainRunSectionStops = true;
      if (this.trainrunItem.backward) {
        const scaledPathFrom = new Vec2D(0, arrivalTime);
        const scaledPathTo = new Vec2D(zommedXPath, departureTime);
        return new ScaledPath(scaledPathFrom, scaledPathTo);
      }
      const scaledPathFrom = new Vec2D(0, departureTime);
      const scaledPathTo = new Vec2D(zommedXPath, arrivalTime);
      return new ScaledPath(scaledPathFrom, scaledPathTo);
    }
    if (this.showArrivalBranch()) {
      this.showTextLabel = false;
      this.showArrivalTime = true;
      this.showDepartureTime = true;
      this.showTrainRunSectionStops = false;
      const arrivalTime = this.trainrunItem.arrivalTime * this.yZoom;
      const travelTime = this.trainrunItem.getPathSection().travelTime();
      const arrivalTimeAndTravelTime = (this.trainrunItem.arrivalTime - travelTime) * this.yZoom;
      const zommedXPath = this.trainrunItem.getPathSection().zoomedXPath();
      if (this.trainrunItem.backward) {
        const scaledPathFrom = new Vec2D(0, arrivalTime);
        const scaledPathTo = new Vec2D(zommedXPath, arrivalTimeAndTravelTime);
        return new ScaledPath(
          scaledPathFrom,
          this.calcBranchingTrainrunSection(scaledPathFrom, scaledPathTo),
        );
      }
      const scaledPathFrom = new Vec2D(zommedXPath, arrivalTime);
      const scaledPathTo = new Vec2D(0, arrivalTimeAndTravelTime);
      return new ScaledPath(
        scaledPathFrom,
        this.calcBranchingTrainrunSection(scaledPathFrom, scaledPathTo),
      );
    }
    if (this.showDepartureBranch()) {
      this.showTextLabel = false;
      this.showArrivalTime = true;
      this.showDepartureTime = true;
      this.showTrainRunSectionStops = false;
      const departureTime = this.trainrunItem.departureTime * this.yZoom;
      const travelTime = this.trainrunItem.getPathSection().travelTime();
      const zommedXPath = this.trainrunItem.getPathSection().zoomedXPath();
      const departureTimeAndTravelTime =
        (this.trainrunItem.departureTime + travelTime) * this.yZoom;
      if (this.trainrunItem.backward) {
        const scaledPathFrom = new Vec2D(zommedXPath, departureTime);
        const scaledPathTo = new Vec2D(0, departureTimeAndTravelTime);
        return new ScaledPath(
          scaledPathFrom,
          this.calcBranchingTrainrunSection(scaledPathFrom, scaledPathTo),
        );
      }
      const scaledPathFrom = new Vec2D(0, departureTime);
      const scaledPathTo = new Vec2D(zommedXPath, departureTimeAndTravelTime);
      return new ScaledPath(
        scaledPathFrom,
        this.calcBranchingTrainrunSection(scaledPathFrom, scaledPathTo),
      );
    }
    this.showArrivalTime = false;
    this.showDepartureTime = false;
    this.showTextLabel = false;
    this.showTrainRunSectionStops = false;
    const scaledPathFrom = new Vec2D(0, 0);
    const scaledPathTo = new Vec2D(0, 0);
    return new ScaledPath(scaledPathFrom, scaledPathTo);
  }

  private showArrivalBranch() {
    if (
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.ArrivalBranchWithSection ||
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.ArrivalBranchFilter
    ) {
      return true;
    }
    if (
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.ArrivalBranchOnly &&
      !this.trainrunItem.backward &&
      this.trainrunItem.getPathSection().arrivalPathNode &&
      this.trainrunItem.getPathSection().arrivalPathNode.trackOccupier
    ) {
      return true;
    }
    return (
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.ArrivalBranchOnly &&
      this.trainrunItem.backward &&
      this.trainrunItem.getPathSection().departurePathNode &&
      this.trainrunItem.getPathSection().departurePathNode.trackOccupier
    );
  }

  private showDepartureBranch() {
    if (
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.DepartureBranchWithSection ||
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.DepartureBranchFilter
    ) {
      return true;
    }
    if (
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.DepartureBranchOnly &&
      !this.trainrunItem.backward &&
      this.trainrunItem.getPathSection().departurePathNode &&
      this.trainrunItem.getPathSection().departurePathNode.trackOccupier
    ) {
      return true;
    }
    return (
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.DepartureBranchOnly &&
      this.trainrunItem.backward &&
      this.trainrunItem.getPathSection().arrivalPathNode &&
      this.trainrunItem.getPathSection().arrivalPathNode.trackOccupier
    );
  }

  private path(scaledPath: ScaledPath) {
    return (
      "M " +
      scaledPath.scaledPathFrom.getX() +
      " " +
      scaledPath.scaledPathFrom.getY() +
      " L " +
      scaledPath.scaledPathTo.getX() +
      " " +
      scaledPath.scaledPathTo.getY()
    );
  }

  getDepartureTextWidth(): string {
    const formattedTimeStyle = this.trainDataService.getDisplayTextWidth(
      this.trainrunItem.getPathSection().trainrunSectionId,
      this.trainrunItem.backward
        ? TrainrunSectionText.TargetDeparture
        : TrainrunSectionText.SourceDeparture,
    );
    if (formattedTimeStyle !== undefined) {
      return "" + formattedTimeStyle;
    }
    return "21";
  }

  getArrivalTextWidth(): string {
    const formattedTimeStyle = this.trainDataService.getDisplayTextWidth(
      this.trainrunItem.getPathSection().trainrunSectionId,
      this.trainrunItem.backward
        ? TrainrunSectionText.SourceArrival
        : TrainrunSectionText.TargetArrival,
    );
    if (formattedTimeStyle !== undefined) {
      return "" + formattedTimeStyle;
    }
    return "21";
  }

  getDepartureTextStyle(): string {
    return this.trainDataService.getDisplayTextHtmlStyle(
      this.trainrunItem.getPathSection().trainrunSectionId,
      this.trainrunItem.backward
        ? TrainrunSectionText.TargetDeparture
        : TrainrunSectionText.SourceDeparture,
    );
  }

  getArrivalTextStyle(): string {
    return this.trainDataService.getDisplayTextHtmlStyle(
      this.trainrunItem.getPathSection().trainrunSectionId,
      this.trainrunItem.backward
        ? TrainrunSectionText.SourceArrival
        : TrainrunSectionText.TargetArrival,
    );
  }

  public getDepartureClassTag(tag: string): string {
    const formattedTimeStyle = this.trainDataService.getDisplayTextColorRef(
      this.trainrunItem.getPathSection().trainrunSectionId,
      this.trainrunItem.backward
        ? TrainrunSectionText.TargetDeparture
        : TrainrunSectionText.SourceDeparture,
    );
    if (formattedTimeStyle !== undefined) {
      return this.getGeneralNoColorRefClassTag(tag + " ColorRef_" + formattedTimeStyle);
    }
    return this.getClassTag(tag);
  }

  public getArrivalClassTag(tag: string): string {
    const formattedTimeStyle = this.trainDataService.getDisplayTextColorRef(
      this.trainrunItem.getPathSection().trainrunSectionId,
      this.trainrunItem.backward
        ? TrainrunSectionText.SourceArrival
        : TrainrunSectionText.TargetArrival,
    );
    if (formattedTimeStyle !== undefined) {
      return this.getGeneralNoColorRefClassTag(tag + " ColorRef_" + formattedTimeStyle);
    }
    return this.getClassTag(tag);
  }

  getDepartureTextTransformation(scaledPath: ScaledPath): string {
    const scaledPathTo = scaledPath.scaledPathFrom;
    const scaledPathFrom = scaledPath.scaledPathTo;
    const diff: Vec2D = Vec2D.normalize(Vec2D.sub(scaledPathTo, scaledPathFrom));
    const centerPosition = Vec2D.add(
      scaledPath.scaledPathFrom,
      Vec2D.scale(diff, this.getDepartureTextOffset()),
    );
    const alignOffset = new Vec2D(0, 0);
    return this.translateAndRotateText(centerPosition, alignOffset, scaledPathTo, scaledPathFrom);
  }

  getArrivalTextTransformation(scaledPath: ScaledPath): string {
    const scaledPathTo = scaledPath.scaledPathFrom;
    const scaledPathFrom = scaledPath.scaledPathTo;
    const diff: Vec2D = Vec2D.normalize(Vec2D.sub(scaledPathFrom, scaledPathTo));
    const centerPosition = Vec2D.add(
      scaledPath.scaledPathTo,
      Vec2D.scale(diff, this.getArrivalTextPosOffset()),
    );
    const alignOffset = new Vec2D(0, 0);
    return this.translateAndRotateText(centerPosition, alignOffset, scaledPathFrom, scaledPathTo);
  }

  getTextLabelTransformation(scaledPath: ScaledPath): string {
    const alignOffset = new Vec2D(0, 0);
    const scaledPathTo = scaledPath.scaledPathFrom;
    const scaledPathFrom = scaledPath.scaledPathTo;
    const centerPosition = Vec2D.scale(Vec2D.add(scaledPathFrom, scaledPathTo), 0.5);
    return this.translateAndRotateText(centerPosition, alignOffset, scaledPathTo, scaledPathFrom);
  }

  getDepartureText(): string {
    let orgTime = this.trainrunItem.departureTime;
    if (
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.ArrivalBranchWithSection ||
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.ArrivalBranchOnly ||
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.ArrivalBranchFilter
    ) {
      orgTime = this.trainrunItem.arrivalTime;
    }

    if (this.trainrunItem.getTrainrunSection().trainrunBranchType === TrainrunBranchType.Trainrun) {
      if (this.trainrunItem.backward) {
        orgTime = this.trainrunItem.arrivalTime;
      }
    }
    return "" + (Math.floor(orgTime + this.freqOffset + 10080) % 60);
  }

  getArrivalText(): string {
    if (
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.ArrivalBranchWithSection ||
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.ArrivalBranchOnly ||
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.ArrivalBranchFilter
    ) {
      if (this.trainrunItem.backward) {
        if (
          this.trainrunItem.getTrainrunSection() &&
          this.trainrunItem.getTrainrunSection().departureBranchEndNodeShortName
        ) {
          return this.trainrunItem.getTrainrunSection().departureBranchEndNodeShortName;
        }
      }
      if (
        this.trainrunItem.getTrainrunSection() &&
        this.trainrunItem.getTrainrunSection().arrivalBranchEndNodeShortName
      ) {
        return this.trainrunItem.getTrainrunSection().arrivalBranchEndNodeShortName;
      }
    }
    if (
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.DepartureBranchWithSection ||
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.DepartureBranchOnly ||
      this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.DepartureBranchFilter
    ) {
      if (this.trainrunItem.backward) {
        if (
          this.trainrunItem.getTrainrunSection() &&
          this.trainrunItem.getTrainrunSection().arrivalBranchEndNodeShortName
        ) {
          return this.trainrunItem.getTrainrunSection().arrivalBranchEndNodeShortName;
        }
      }
      if (
        this.trainrunItem.getTrainrunSection() &&
        this.trainrunItem.getTrainrunSection().departureBranchEndNodeShortName
      ) {
        return this.trainrunItem.getTrainrunSection().departureBranchEndNodeShortName;
      }
    }

    let orgTime = this.trainrunItem.arrivalTime;
    if (this.trainrunItem.getTrainrunSection().trainrunBranchType === TrainrunBranchType.Trainrun) {
      if (this.trainrunItem.backward) {
        orgTime = this.trainrunItem.departureTime;
      }
    }

    return "" + (Math.floor(orgTime + this.freqOffset + 10080) % 60);
  }

  isArrivalTimeTextFiltering() {
    if (this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }

    if (!this.filterService.isFilterShowNonStopTimeEnabled()) {
      if (
        this.trainrunItem.getTrainrunSection().trainrunBranchType ===
          TrainrunBranchType.ArrivalBranchWithSection ||
        this.trainrunItem.getTrainrunSection().trainrunBranchType ===
          TrainrunBranchType.ArrivalBranchOnly ||
        this.trainrunItem.getTrainrunSection().trainrunBranchType ===
          TrainrunBranchType.ArrivalBranchFilter
      ) {
        if (this.trainrunItem.backward) {
          if (
            this.trainrunItem.getTrainrunSection() &&
            this.trainrunItem.getTrainrunSection().departureBranchEndNodeShortName
          ) {
            const nodeId = this.trainrunItem.getTrainrunSection().arrivalNodeId;
            if (!this.isTimeFiltering(nodeId)) {
              return false;
            }
          }
        }
        if (
          this.trainrunItem.getTrainrunSection() &&
          this.trainrunItem.getTrainrunSection().arrivalBranchEndNodeShortName
        ) {
          const nodeId = this.trainrunItem.getTrainrunSection().departureNodeId;
          if (!this.isTimeFiltering(nodeId)) {
            return false;
          }
        }
      }
      if (
        this.trainrunItem.getTrainrunSection().trainrunBranchType ===
          TrainrunBranchType.DepartureBranchWithSection ||
        this.trainrunItem.getTrainrunSection().trainrunBranchType ===
          TrainrunBranchType.DepartureBranchOnly ||
        this.trainrunItem.getTrainrunSection().trainrunBranchType ===
          TrainrunBranchType.DepartureBranchFilter
      ) {
        if (this.trainrunItem.backward) {
          if (
            this.trainrunItem.getTrainrunSection() &&
            this.trainrunItem.getTrainrunSection().arrivalBranchEndNodeShortName
          ) {
            const nodeId = this.trainrunItem.getTrainrunSection().departureNodeId;
            if (!this.isTimeFiltering(nodeId)) {
              return false;
            }
          }
        }
        if (
          this.trainrunItem.getTrainrunSection() &&
          this.trainrunItem.getTrainrunSection().departureBranchEndNodeShortName
        ) {
          const nodeId = this.trainrunItem.getTrainrunSection().arrivalNodeId;
          if (!this.isTimeFiltering(nodeId)) {
            return false;
          }
        }
      }

      const sgTs: SgTrainrunSection = this.trainrunItem.getTrainrunSection();
      const nodeId = sgTs.backward ? sgTs.departureNodeId : sgTs.arrivalNodeId;
      if (!this.isTimeFiltering(nodeId)) {
        return false;
      }
    }
    return this.filterService.isFilterArrivalDepartureTimeEnabled();
  }

  isDepatureTimeTextFiltering(isTrainrunBranch: boolean) {
    if (this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }

    if (!this.filterService.isFilterShowNonStopTimeEnabled()) {
      if (isTrainrunBranch) {
        const sgTs: SgTrainrunSection = this.trainrunItem.getTrainrunSection();
        const nodeId = sgTs.backward ? sgTs.arrivalNodeId : sgTs.departureNodeId;
        if (!this.isTimeFiltering(nodeId)) {
          return false;
        }
      } else {
        const sgTs: SgTrainrunSection = this.trainrunItem.getTrainrunSection();
        if (!this.isTimeFiltering(sgTs.departureNodeId)) {
          return false;
        }
        if (!this.isTimeFiltering(sgTs.arrivalNodeId)) {
          return false;
        }
      }
    }

    return this.filterService.isFilterArrivalDepartureTimeEnabled();
  }

  isTimeFiltering(nodeId: number) {
    const sgTs: SgTrainrunSection = this.trainrunItem.getTrainrunSection();
    const node = this.nodeService.getNodeFromId(nodeId);
    const trans = node.getTransition(sgTs.trainrunSectionId);
    if (trans) {
      if (trans.getIsNonStopTransit()) {
        if (!this.filterService.isFilterShowNonStopTimeEnabled()) {
          return false;
        }
      }
    }
    return true;
  }

  getText(): string {
    return this.trainrun.categoryShortName + this.trainrun.title;
  }

  textWidth(): number {
    const str = this.getText();
    return Math.max(31, str.length * 8);
  }

  getTextTransform(): string {
    if (this.trainrunItem.getTrainrunSection().numberOfStops > 0) {
      return "translate(0,-8)";
    }
    return "translate(0,0)";
  }

  isShowText() {
    if (this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }
    return this.filterService.isFilterTrainrunNameEnabled();
  }

  openTrainrunSectionDialogDeparture($event: MouseEvent, sgTrainrunItem: SgTrainrunItem) {
    $event.preventDefault();
    $event.stopImmediatePropagation();

    this.trainrunService.setTrainrunAsSelected(this.trainrun.trainrunId);
    this.trainrunSectionService.setTrainrunSectionAsSelected(
      sgTrainrunItem.getTrainrunSection().trainrunSectionId,
    );
    const position = new Vec2D($event.x, $event.y + 30);
    const parameter = new TrainrunDialogParameter(
      TrainrunDialogType.TRAINRUN_SECTION_DIALOG,
      position,
    );
    parameter.setOffset(this.trainrun.frequencyOffset + this.freqOffset);
    const selectedTrainrunSection = this.trainrunSectionService.getSelectedTrainrunSection();
    if (
      selectedTrainrunSection.getTargetNode().getId() ===
        this.trainrunItem.getTrainrunSection().departureNodeId &&
      selectedTrainrunSection.getSourceNode().getId() ===
        this.trainrunItem.getTrainrunSection().arrivalNodeId
    ) {
      if (sgTrainrunItem.backward) {
        parameter.trainrunSectionText = TrainrunSectionText.SourceArrival;
      } else {
        parameter.trainrunSectionText = TrainrunSectionText.TargetDeparture;
      }
    }
    if (
      selectedTrainrunSection.getTargetNode().getId() ===
        this.trainrunItem.getTrainrunSection().arrivalNodeId &&
      selectedTrainrunSection.getSourceNode().getId() ===
        this.trainrunItem.getTrainrunSection().departureNodeId
    ) {
      if (sgTrainrunItem.backward) {
        parameter.trainrunSectionText = TrainrunSectionText.TargetArrival;
      } else {
        parameter.trainrunSectionText = TrainrunSectionText.SourceDeparture;
      }
    }
    parameter.setForward(!sgTrainrunItem.backward);
    this.uiInteractionService.showTrainrunDialog(parameter);
  }

  openTrainrunSectionDialogArrival($event: MouseEvent, sgTrainrunItem: SgTrainrunItem) {
    $event.preventDefault();
    $event.stopImmediatePropagation();

    this.trainrunService.setTrainrunAsSelected(this.trainrun.trainrunId);
    this.trainrunSectionService.setTrainrunSectionAsSelected(
      sgTrainrunItem.getTrainrunSection().trainrunSectionId,
    );
    const position = new Vec2D($event.x, $event.y + 30);
    const parameter = new TrainrunDialogParameter(
      TrainrunDialogType.TRAINRUN_SECTION_DIALOG,
      position,
    );
    parameter.setOffset(this.trainrun.frequencyOffset + this.freqOffset);
    const selectedTrainrunSection = this.trainrunSectionService.getSelectedTrainrunSection();
    if (
      selectedTrainrunSection.getTargetNode().getId() ===
        this.trainrunItem.getTrainrunSection().departureNodeId &&
      selectedTrainrunSection.getSourceNode().getId() ===
        this.trainrunItem.getTrainrunSection().arrivalNodeId
    ) {
      if (sgTrainrunItem.backward) {
        parameter.trainrunSectionText = TrainrunSectionText.TargetDeparture;
      } else {
        parameter.trainrunSectionText = TrainrunSectionText.SourceArrival;
      }
    }
    if (
      selectedTrainrunSection.getTargetNode().getId() ===
        this.trainrunItem.getTrainrunSection().arrivalNodeId &&
      selectedTrainrunSection.getSourceNode().getId() ===
        this.trainrunItem.getTrainrunSection().departureNodeId
    ) {
      if (sgTrainrunItem.backward) {
        parameter.trainrunSectionText = TrainrunSectionText.SourceDeparture;
      } else {
        parameter.trainrunSectionText = TrainrunSectionText.TargetArrival;
      }
    }
    parameter.setForward(!sgTrainrunItem.backward);
    this.uiInteractionService.showTrainrunDialog(parameter);
  }

  openTrainrunDialog($event: MouseEvent, sgTrainrunItem: SgTrainrunItem) {
    $event.preventDefault();
    $event.stopImmediatePropagation();

    this.trainrunService.setTrainrunAsSelected(this.trainrun.trainrunId);
    this.trainrunSectionService.setTrainrunSectionAsSelected(
      sgTrainrunItem.getTrainrunSection().trainrunSectionId,
    );
    const position = new Vec2D($event.x, $event.y + 30);
    const parameter = new TrainrunDialogParameter(TrainrunDialogType.TRAINRUN_DIALOG, position);
    parameter.setOffset(this.trainrun.frequencyOffset + this.freqOffset);
    parameter.setForward(!sgTrainrunItem.backward);
    this.uiInteractionService.showTrainrunDialog(parameter);
  }

  private getDepartureTextOffset() {
    return -16.0;
  }

  private getArrivalTextPosOffset() {
    if (this.trainrunItem.getTrainrunSection().trainrunBranchType !== TrainrunBranchType.Trainrun) {
      return 0.0;
    }
    return -16.0;
  }

  private translateAndRotateText(
    centerPosition: Vec2D,
    alignOffset: Vec2D,
    scaledPathTo: Vec2D,
    scaledPathFrom: Vec2D,
  ) {
    const position: Vec2D = Vec2D.add(centerPosition, alignOffset);

    const diff: Vec2D = Vec2D.sub(scaledPathTo, scaledPathFrom);
    let a: number = (Math.atan2(diff.getY(), diff.getX()) / Math.PI) * 180.0;
    if (Math.abs(a) > 90) {
      a = a + 180;
    }
    // Math.atan2 -> edge cases -> correct manually
    if (Math.abs(diff.getX()) < 1) {
      a = -90;
    }
    if (Math.abs(diff.getY()) < 1) {
      a = 0;
    }
    return (
      " translate(" +
      position.getX() +
      "," +
      position.getY() +
      ")" +
      " rotate(" +
      a +
      "," +
      -alignOffset.getX() +
      "," +
      -alignOffset.getY() +
      ") "
    );
  }

  private calcBranchingTrainrunSection(scaledPathFrom: Vec2D, scaledPathTo: Vec2D): Vec2D {
    const diff = Vec2D.sub(scaledPathTo, scaledPathFrom);
    const nDiff = Vec2D.normalize(diff);
    const sDiff = Vec2D.scale(nDiff, 60);
    return Vec2D.add(sDiff, scaledPathFrom);
  }

  showText() {
    if (this.showTextLabel === true) {
      if (this.streckengrafikDisplayElementService.isFilterStreckengrafikNameNotFocusNorEnabled()) {
        return false;
      }
      return this.isShowText();
    }
    return this.showTextLabel;
  }

  private isSelectedTrainrun(): boolean {
    const selectedTrainrun = this.trainrunService.getSelectedTrainrun();
    if (selectedTrainrun) {
      if (this.trainrun.trainrunId === selectedTrainrun.getId()) {
        return true;
      }
    }
    return false;
  }

  showArrival() {
    if (!this.showArrivalTime) {
      return false;
    }

    if (
      this.trainrunItem.getTrainrunSection().trainrunBranchType === TrainrunBranchType.Trainrun ||
      this.trainrunItem.getTrainrunSection().trainrunBranchType === TrainrunBranchType.Filter
    ) {
      if (this.streckengrafikDisplayElementService.isFilterStreckengrafikTimeNotFocusNorEnabled()) {
        return false;
      }
    }

    if (
      this.trainrunItem &&
      this.trainrunItem.isSection() &&
      this.trainrunItem.getTrainrunSection().trainrunBranchType === TrainrunBranchType.Trainrun
    ) {
      return this.isArrivalTimeTextFiltering();
    }
    return true;
  }

  showDeparture() {
    if (!this.showDepartureTime) {
      return false;
    }
    if (this.streckengrafikDisplayElementService.isFilterStreckengrafikTimeNotFocusNorEnabled()) {
      return false;
    }

    if (
      this.trainrunItem &&
      this.trainrunItem.isSection() &&
      this.trainrunItem.getTrainrunSection().trainrunBranchType === TrainrunBranchType.Trainrun
    ) {
      return this.isDepatureTimeTextFiltering(true);
    }

    if (
      this.trainrunItem &&
      this.trainrunItem.isSection() &&
      (this.trainrunItem.getTrainrunSection().trainrunBranchType ===
        TrainrunBranchType.ArrivalBranchWithSection ||
        this.trainrunItem.getTrainrunSection().trainrunBranchType ===
          TrainrunBranchType.DepartureBranchWithSection ||
        this.trainrunItem.getTrainrunSection().trainrunBranchType ===
          TrainrunBranchType.ArrivalBranchOnly ||
        this.trainrunItem.getTrainrunSection().trainrunBranchType ===
          TrainrunBranchType.DepartureBranchOnly)
    ) {
      return this.isDepatureTimeTextFiltering(false);
    }
    return true;
  }

  doDelayedRendering() {
    this.fullDetailRenderingUpdateCounter++;
    this.delayedRendering = this.fullDetailRenderingUpdateCounter < 2;
    if (this.updateCounterController !== undefined) {
      this.updateCounterController.clear();
    }
    if (this.recalc) {
      this.updateCounterCallback(true);
    } else {
      this.updateCounterController = new UpdateCounterController(
        this.fullDetailRenderingUpdateCounter,
        this,
      );
    }
  }

  getUpdateCounterTriggerService(): UpdateCounterTriggerService {
    return this.updateCounterTriggerService;
  }

  updateCounterCallback(delayedRendering = true) {
    this.delayedRendering = delayedRendering;
    this.cd.markForCheck();
  }

  getCurrentUpdateCounter(): number {
    return this.fullDetailRenderingUpdateCounter;
  }

  hasStops(): boolean {
    if (this.trainrunItem.isSection()) {
      const ps = this.trainrunItem.getTrainrunSection();
      return ps.numberOfStops > 0;
    }
    return false;
  }
}

export class ScaledPath {
  constructor(
    public scaledPathFrom: Vec2D,
    public scaledPathTo: Vec2D,
  ) {}
}
