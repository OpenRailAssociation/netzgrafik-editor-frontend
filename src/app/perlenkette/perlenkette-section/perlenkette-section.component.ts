import {
  AfterContentInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import {PerlenketteSection} from "../model/perlenketteSection";
import {PerlenketteTrainrun} from "../model/perlenketteTrainrun";
import {TrainrunsectionHelper} from "../../services/util/trainrunsection.helper";
import {TrainrunService} from "../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {takeUntil} from "rxjs/operators";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {Observable, Subject} from "rxjs";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {TrainrunSectionTimesService} from "../../services/data/trainrun-section-times.service";
import {TrainrunSectionsView} from "../../view/editor-main-view/data-views/trainrunsections.view";
import {FilterService} from "../../services/ui/filter.service";
import {Node} from "../../models/node.model";
import {LoadPerlenketteService} from "../service/load-perlenkette.service";
import {NodeService} from "../../services/data/node.service";
import {EditorMode} from "../../view/editor-menu/editor-mode";
import {Vec2D} from "../../utils/vec2D";
import {PortAlignment} from "../../data-structures/technical.data.structures";
import {
  TRAINRUN_SECTION_PORT_SPAN_HORIZONTAL,
  TRAINRUN_SECTION_PORT_SPAN_VERTICAL,
} from "../../view/rastering/definitions";
import {StaticDomTags} from "../../view/editor-main-view/data-views/static.dom.tags";
import {MathUtils} from "../../utils/math";
import {VersionControlService} from "../../services/data/version-control.service";

export interface TopAndBottomTimeStructure {
  leftDepartureTime: number;
  leftArrivalTime: number;
  rightDepartureTime: number;
  rightArrivalTime: number;
  travelTime: number;
  nbrOfStops: number;
}

export interface LeftAndRightLockStructure {
  leftLock: boolean;
  rightLock: boolean;
  travelTimeLock: boolean;
}

@Component({
  selector: "sbb-perlenkette-section",
  templateUrl: "./perlenkette-section.component.html",
  styleUrls: ["./perlenkette-section.component.scss"],
  providers: [TrainrunSectionTimesService],
})
export class PerlenketteSectionComponent implements OnInit, AfterContentInit, OnDestroy {
  @Input() perlenketteSection: PerlenketteSection;
  @Input() perlenketteTrainrun: PerlenketteTrainrun;

  @Input() isFirstSection = false;
  @Input() isLastSection = false;

  @Input() showAllLockStates = false;

  @Output() signalIsBeingEdited = new EventEmitter<PerlenketteSection>();
  @Output() signalHeightChanged = new EventEmitter<number>();
  @Input() notificationIsBeingEdited: Observable<PerlenketteSection>;

  @ViewChild("rightArrivalTime", {static: false})
  rightArrivalTimeElement: ElementRef;
  @ViewChild("rightDepartureTime", {static: false})
  rightDepartureTimeElement: ElementRef;
  @ViewChild("travelTime", {static: false}) travelTimeElement: ElementRef;
  @ViewChild("leftDepartureTime", {static: false})
  leftDepartureTimeElement: ElementRef;
  @ViewChild("leftArrivalTime", {static: false})
  leftArrivalTimeElement: ElementRef;
  @ViewChild("nbrOfStops", {static: false}) nbrOfStops: ElementRef;

  private static timeEditor = true;

  stationNumberArray: number[];
  public trainrunSection: TrainrunSection;
  private trainrunSectionHelper: TrainrunsectionHelper;

  public leftAndRightTimeStructure: TopAndBottomTimeStructure;
  lockStructure: LeftAndRightLockStructure = {
    leftLock: false,
    rightLock: false,
    travelTimeLock: false,
  };

  private destroyed$ = new Subject<void>();

  constructor(
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private nodeService: NodeService,
    private uiInteractionService: UiInteractionService,
    public trainrunSectionTimesService: TrainrunSectionTimesService,
    readonly filterService: FilterService,
    private loadPerlenketteService: LoadPerlenketteService,
    private versionControlService: VersionControlService,
  ) {
    this.trainrunSectionHelper = new TrainrunsectionHelper(this.trainrunService);
  }

  ngOnInit() {
    this.stationNumberArray = Array(this.perlenketteSection.numberOfStops)
      .fill(1)
      .map((x, i) => i + 1);
    this.trainrunSection = this.trainrunSectionService.getTrainrunSectionFromId(
      this.perlenketteSection.trainrunSectionId,
    );
    this.trainrunSectionTimesService.setNodesOrdered([
      this.perlenketteSection.fromNode,
      this.perlenketteSection.toNode,
    ]);
    this.trainrunSectionTimesService.setTrainrunSection(this.trainrunSection);
    this.trainrunSectionTimesService.setLockStructure(
      this.trainrunSectionHelper.getLeftAndRightLock(
        this.trainrunSection,
        this.trainrunSectionTimesService.getNodesOrdered(),
      ),
    );
    this.updateLeftAndRightTimeStructure();
  }

  ngAfterContentInit() {
    this.notificationIsBeingEdited
      .pipe(takeUntil(this.destroyed$))
      .subscribe((ps: PerlenketteSection) => {
        if (ps === undefined) {
          this.perlenketteSection.isBeingEdited = false;
          return;
        }
        if (ps.trainrunSectionId !== this.perlenketteSection.trainrunSectionId) {
          if (this.perlenketteSection.isBeingEdited) {
            this.perlenketteSection.isBeingEdited = false;
          }
        }
      });

    this.updateLockStructure();

    this.signalHeightChanged.next(192);
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  isRoundTrip(): boolean {
    return this.trainrunSection.getTrainrun().isRoundTrip();
  }

  getEdgeLineArrowClass() {
    const trainrun = this.trainrunSection.getTrainrun();
    return (
      StaticDomTags.EDGE_LINE_ARROW_CLASS +
      StaticDomTags.makeClassTag(
        StaticDomTags.FREQ_LINE_PATTERN,
        trainrun.getFrequencyLinePatternRef(),
      ) +
      " " +
      StaticDomTags.TAG_UI_DIALOG +
      " " +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_COLOR_REF, trainrun.getCategoryColorRef()) +
      StaticDomTags.makeClassTag(
        StaticDomTags.TAG_LINEPATTERN_REF,
        trainrun.getTimeCategoryLinePatternRef(),
      )
    );
  }

  getArrowTranslateAndRotate(y: number) {
    if (this.isRightSideDisplayed() && !this.isLeftSideDisplayed()) {
      return `translate(137, ${y}) rotate(90)`;
    } else if (!this.isRightSideDisplayed() && this.isLeftSideDisplayed()) {
      return `translate(137, ${y + 15}) rotate(-90)`;
    }
    return "";
  }

  isDirectionArrowHidden(): boolean {
    return (
      !this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled() &&
      !this.filterService.isFilterDirectionArrowsEnabled()
    );
  }

  isLeftSideDisplayed(): boolean {
    if (this.trainrunSection === null) {
      return false;
    }
    return (
      this.trainrunSection.getTrainrun().isRoundTrip() ||
      !this.trainrunService.isTrainrunTargetRightOrBottom()
    );
  }

  isRightSideDisplayed(): boolean {
    if (this.trainrunSection === null) {
      return false;
    }
    return (
      this.trainrunSection.getTrainrun().isRoundTrip() ||
      this.trainrunService.isTrainrunTargetRightOrBottom()
    );
  }

  getVariantIsWritable(): boolean {
    return this.versionControlService.getVariantIsWritable();
  }

  isBeingEdited(): string {
    if (this.perlenketteSection.isBeingEdited === false) {
      return "Rendering";
    }
    if (PerlenketteSectionComponent.timeEditor) {
      return "TimeEditor";
    }
    return "StopsEditor";
  }

  showTravelTimeLock(): boolean {
    if (this.showAllLockStates) {
      return true;
    }
    return this.lockStructure.travelTimeLock;
  }

  showLeftLock(): boolean {
    if (this.showAllLockStates) {
      return true;
    }
    return this.lockStructure.leftLock;
  }

  showRightLock(): boolean {
    if (this.showAllLockStates) {
      return true;
    }
    return this.lockStructure.rightLock;
  }

  getPathClassTag(noLinePatterns = false): string {
    return (
      "UI_DIALOG " +
      " ColorRef_" +
      this.perlenketteTrainrun.colorRef +
      (noLinePatterns
        ? " "
        : " Freq_" +
          this.perlenketteTrainrun.frequency +
          " LinePatternRef_" +
          this.perlenketteTrainrun.trainrunTimeCategory.linePatternRef)
    );
  }

  disableSectionView(event: MouseEvent) {
    if (!this.getVariantIsWritable()) {
      this.signalIsBeingEdited.next(this.perlenketteSection);
    }
    event.stopPropagation();
  }

  switchSectionView(event: MouseEvent, fieldKey: string) {
    event.stopPropagation();
    this.handleSwitchSection(fieldKey);
  }

  switchSectionViewToggleLock(event: MouseEvent, fieldKey: string) {
    event.stopPropagation();

    if (fieldKey === "leftDepartureTime") {
      this.onButtonNodeLeftLock(event);
      return;
    }
    if (fieldKey === "travelTime") {
      this.onButtonTravelTimeLock(event);
      return;
    }
    if (fieldKey === "rightDepartureTime") {
      this.onButtonNodeRightLock(event);
      return;
    }
  }

  handleSwitchSection(fieldKey: string) {
    this.perlenketteSection.isBeingEdited = !this.perlenketteSection.isBeingEdited;
    if (this.perlenketteSection.isBeingEdited) {
      this.signalIsBeingEdited.next(this.perlenketteSection);
    }

    if (fieldKey === "rightArrivalTime") {
      PerlenketteSectionComponent.timeEditor = true;
      setTimeout(() => this.focusAndSelect(this.rightArrivalTimeElement), 100);
    }
    if (fieldKey === "rightDepartureTime") {
      PerlenketteSectionComponent.timeEditor = true;
      setTimeout(() => this.focusAndSelect(this.rightDepartureTimeElement), 100);
    }
    if (fieldKey === "travelTime") {
      PerlenketteSectionComponent.timeEditor = true;
      setTimeout(() => this.focusAndSelect(this.travelTimeElement), 100);
    }
    if (fieldKey === "leftDepartureTime") {
      PerlenketteSectionComponent.timeEditor = true;
      setTimeout(() => this.focusAndSelect(this.leftDepartureTimeElement), 100);
    }
    if (fieldKey === "leftArrivalTime") {
      PerlenketteSectionComponent.timeEditor = true;
      setTimeout(() => this.focusAndSelect(this.leftArrivalTimeElement), 100);
    }
    if (fieldKey === "stops") {
      PerlenketteSectionComponent.timeEditor = false;
      setTimeout(() => this.focusAndSelect(this.nbrOfStops), 100);
    }
  }

  focusAndSelect(el: ElementRef) {
    el.nativeElement.focus();
    el.nativeElement.select();
  }

  stopPropagation(event: Event) {
    event.stopPropagation();
  }

  /* right departure time */
  getRightDepartureTime(): number {
    const targetId = this.trainrunSection.getTargetNodeId();
    const toId = this.perlenketteSection.toNode.getId();
    if (targetId === toId) {
      return this.roundTime(this.trainrunSection.getTargetDeparture());
    }
    return this.roundTime(this.trainrunSection.getSourceDeparture());
  }

  getRightDepartureTimeClassTag(): string {
    const targetId = this.trainrunSection.getTargetNodeId();
    const toId = this.perlenketteSection.toNode.getId();
    if (targetId === toId) {
      return (
        " " +
        TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
          this.trainrunSection.getTargetDepartureConsecutiveTime(),
          this.trainrunSection.getTrainrun(),
        ) +
        (this.trainrunSection.hasTargetDepartureWarning() ? " " + StaticDomTags.TAG_WARNING : "")
      );
    }
    return (
      " " +
      TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
        this.trainrunSection.getSourceDepartureConsecutiveTime(),
        this.trainrunSection.getTrainrun(),
      ) +
      (this.trainrunSection.hasSourceDepartureWarning() ? " " + StaticDomTags.TAG_WARNING : "")
    );
  }

  showRightDepartureTime() {
    if (this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }
    return this.filterService.isFilterArrivalDepartureTimeEnabled();
  }

  /* right arrival time */
  getRightArrivalTime(): number {
    const targetId = this.trainrunSection.getTargetNodeId();
    const toId = this.perlenketteSection.toNode.getId();
    if (targetId === toId) {
      return this.roundTime(this.trainrunSection.getTargetArrival());
    }
    return this.roundTime(this.trainrunSection.getSourceArrival());
  }

  getRightArrivalTimeClassTag(): string {
    const targetId = this.trainrunSection.getTargetNodeId();
    const toId = this.perlenketteSection.toNode.getId();
    if (targetId === toId) {
      return (
        " " +
        TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
          this.trainrunSection.getTargetArrivalConsecutiveTime(),
          this.trainrunSection.getTrainrun(),
        ) +
        (this.trainrunSection.hasTargetArrivalWarning() ? " " + StaticDomTags.TAG_WARNING : "")
      );
    }
    return (
      " " +
      TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
        this.trainrunSection.getSourceArrivalConsecutiveTime(),
        this.trainrunSection.getTrainrun(),
      ) +
      (this.trainrunSection.hasSourceArrivalWarning() ? " " + StaticDomTags.TAG_WARNING : "")
    );
  }

  showStopArcStart(): boolean {
    const targetId = this.trainrunSection.getTargetNodeId();
    const fromId = this.perlenketteSection.fromNode.getId();
    let trans = this.trainrunSection.getSourceNode().getTransition(this.trainrunSection.getId());
    if (targetId === fromId) {
      trans = this.trainrunSection.getTargetNode().getTransition(this.trainrunSection.getId());
    }
    if (trans === undefined) {
      return true;
    }
    return !trans.getIsNonStopTransit();
  }

  showStopArcEnd(): boolean {
    const targetId = this.trainrunSection.getTargetNodeId();
    const toId = this.perlenketteSection.toNode.getId();
    let trans = this.trainrunSection.getSourceNode().getTransition(this.trainrunSection.getId());
    if (targetId === toId) {
      trans = this.trainrunSection.getTargetNode().getTransition(this.trainrunSection.getId());
    }
    if (trans === undefined) {
      return true;
    }
    return !trans.getIsNonStopTransit();
  }

  showRightArrivalTime() {
    const targetId = this.trainrunSection.getTargetNodeId();
    const toId = this.perlenketteSection.toNode.getId();
    if (!this.filterService.isFilterArrivalDepartureTimeEnabled()) {
      if (!this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
        return false;
      }
    }
    let trans = this.trainrunSection.getSourceNode().getTransition(this.trainrunSection.getId());
    if (targetId === toId) {
      trans = this.trainrunSection.getTargetNode().getTransition(this.trainrunSection.getId());
    }
    if (trans === undefined) {
      return true;
    }
    return !trans.getIsNonStopTransit();
  }

  /* left departure time */
  getLeftDepartureTime(): number {
    const sourceId = this.trainrunSection.getSourceNodeId();
    const fromId = this.perlenketteSection.fromNode.getId();
    if (sourceId === fromId) {
      return this.roundTime(this.trainrunSection.getSourceDeparture());
    }
    return this.roundTime(this.trainrunSection.getTargetDeparture());
  }

  getLeftDepartureTimeClassTag(): string {
    const sourceId = this.trainrunSection.getSourceNodeId();
    const fromId = this.perlenketteSection.fromNode.getId();
    if (sourceId === fromId) {
      return (
        " " +
        TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
          this.trainrunSection.getSourceDepartureConsecutiveTime(),
          this.trainrunSection.getTrainrun(),
        ) +
        (this.trainrunSection.hasSourceDepartureWarning() ? " " + StaticDomTags.TAG_WARNING : "")
      );
    }
    return (
      " " +
      TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
        this.trainrunSection.getTargetDepartureConsecutiveTime(),
        this.trainrunSection.getTrainrun(),
      ) +
      (this.trainrunSection.hasTargetDepartureWarning() ? " " + StaticDomTags.TAG_WARNING : "")
    );
  }

  showLeftDepartureTime() {
    if (this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }
    return this.filterService.isFilterArrivalDepartureTimeEnabled();
  }

  /* left arrival time */
  getLeftArrivalTime(): number {
    const sourceId = this.trainrunSection.getSourceNodeId();
    const fromId = this.perlenketteSection.fromNode.getId();
    if (sourceId === fromId) {
      return this.roundTime(this.trainrunSection.getSourceArrival());
    }
    return this.roundTime(this.trainrunSection.getTargetArrival());
  }

  getLeftArrivalTimeClassTag(): string {
    const sourceId = this.trainrunSection.getSourceNodeId();
    const fromId = this.perlenketteSection.fromNode.getId();
    if (sourceId === fromId) {
      return (
        " " +
        TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
          this.trainrunSection.getSourceArrivalConsecutiveTime(),
          this.trainrunSection.getTrainrun(),
        ) +
        (this.trainrunSection.hasSourceArrivalWarning() ? " " + StaticDomTags.TAG_WARNING : "")
      );
    }
    return (
      " " +
      TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
        this.trainrunSection.getTargetArrivalConsecutiveTime(),
        this.trainrunSection.getTrainrun(),
      ) +
      (this.trainrunSection.hasTargetArrivalWarning() ? " " + StaticDomTags.TAG_WARNING : "")
    );
  }

  showLeftArrivalTime() {
    const sourceId = this.trainrunSection.getSourceNodeId();
    const fromId = this.perlenketteSection.fromNode.getId();
    if (!this.filterService.isFilterArrivalDepartureTimeEnabled()) {
      if (!this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
        return false;
      }
    }
    let trans = this.trainrunSection.getTargetNode().getTransition(this.trainrunSection.getId());
    if (sourceId === fromId) {
      trans = this.trainrunSection.getSourceNode().getTransition(this.trainrunSection.getId());
    }
    if (trans === undefined) {
      return true;
    }
    return !trans.getIsNonStopTransit();
  }

  /* travel time */
  showTravelTime() {
    if (this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }
    return this.filterService.isFilterTravelTimeEnabled();
  }

  /* Get Section Times */
  getSectionSourceArrivalTime(): number {
    const sourceId = this.trainrunSection.getSourceNodeId();
    const fromId = this.perlenketteSection.fromNode.getId();
    if (sourceId === fromId) {
      return this.leftAndRightTimeStructure.leftArrivalTime;
    }
    return this.leftAndRightTimeStructure.rightArrivalTime;
  }

  showArrivalAndDepartureTime(): boolean {
    if (this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }
    return this.filterService.isFilterArrivalDepartureTimeEnabled();
  }

  getNodeRightLockClassTag(): string {
    let tag = "NodeRightLock";
    if (!this.showArrivalAndDepartureTime()) {
      tag += " Center";
    }
    return tag;
  }

  getNodeLeftLockClassTag(): string {
    let tag = "NodeLeftLock";
    if (!this.showArrivalAndDepartureTime()) {
      tag += " Center";
    }
    return tag;
  }

  getTravelTimeLockClassTag(): string {
    let tag = "TravelTimeLock";
    if (!this.showTravelTime()) {
      tag += " Center";
    }
    return tag;
  }

  getSectionSourceDepartureTime(): number {
    const sourceId = this.trainrunSection.getSourceNodeId();
    const fromId = this.perlenketteSection.fromNode.getId();
    if (sourceId === fromId) {
      return this.leftAndRightTimeStructure.leftDepartureTime;
    }
    return this.leftAndRightTimeStructure.rightDepartureTime;
  }

  getSectionTargetDepartureTime(): number {
    const sourceId = this.trainrunSection.getSourceNodeId();
    const toId = this.perlenketteSection.toNode.getId();
    if (sourceId === toId) {
      return this.leftAndRightTimeStructure.leftDepartureTime;
    }
    return this.leftAndRightTimeStructure.rightDepartureTime;
  }

  getSectionTargetArrivalTime(): number {
    const sourceId = this.trainrunSection.getSourceNodeId();
    const toId = this.perlenketteSection.toNode.getId();
    if (sourceId === toId) {
      return this.leftAndRightTimeStructure.leftArrivalTime;
    }
    return this.leftAndRightTimeStructure.rightArrivalTime;
  }

  getTravelTime() {
    if (
      TrainrunSectionsView.getNode(this.trainrunSection, true).isNonStop(this.trainrunSection) ||
      TrainrunSectionsView.getNode(this.trainrunSection, false).isNonStop(this.trainrunSection)
    ) {
      const cumulativeTravelTime = this.trainrunService.getCumulativeTravelTime(
        this.trainrunSection,
      );
      return (
        "" +
        this.roundTime(cumulativeTravelTime) +
        "' (" +
        this.roundTime(this.trainrunSectionTimesService.getTimeStructure().travelTime) +
        "')"
      );
    }
    return (
      "" + this.roundTime(this.trainrunSectionTimesService.getTimeStructure().travelTime) + "'"
    );
  }

  getSectionTravelTime() {
    return this.leftAndRightTimeStructure.travelTime;
  }

  private getTimeButtonPlusMinusStep(val: number) {
    return 1 - val + Math.floor(val);
  }

  /* Left Departure Time */
  onNodeLeftDepartureTimeButtonPlus(event: MouseEvent) {
    this.stopPropagation(event);
    this.leftAndRightTimeStructure.leftDepartureTime += this.getTimeButtonPlusMinusStep(
      this.leftAndRightTimeStructure.leftDepartureTime,
    );
    this.leftAndRightTimeStructure.leftDepartureTime %= 60;
    this.onNodeLeftDepartureTimeChanged();
  }

  onNodeLeftDepartureTimeButtonMinus(event: MouseEvent) {
    this.stopPropagation(event);
    this.leftAndRightTimeStructure.leftDepartureTime -= this.getTimeButtonPlusMinusStep(
      this.leftAndRightTimeStructure.leftDepartureTime,
    );
    this.leftAndRightTimeStructure.leftDepartureTime +=
      this.leftAndRightTimeStructure.leftDepartureTime < 0 ? 60 : 0;
    this.onNodeLeftDepartureTimeChanged();
  }

  onNodeLeftDepartureTimeChanged() {
    this.leftAndRightTimeStructure.leftDepartureTime =
      this.leftAndRightTimeStructure.leftDepartureTime % 60;
    this.leftAndRightTimeStructure.leftDepartureTime +=
      this.leftAndRightTimeStructure.leftDepartureTime < 0 ? 60 : 0;

    this.leftAndRightTimeStructure.leftArrivalTime = TrainrunsectionHelper.getSymmetricTime(
      this.leftAndRightTimeStructure.leftDepartureTime,
    );
    if (!this.lockStructure.rightLock) {
      this.leftAndRightTimeStructure.rightArrivalTime =
        this.leftAndRightTimeStructure.leftDepartureTime +
        (this.leftAndRightTimeStructure.travelTime % 60);
      this.leftAndRightTimeStructure.rightArrivalTime %= 60;
      this.leftAndRightTimeStructure.rightDepartureTime = TrainrunsectionHelper.getSymmetricTime(
        this.leftAndRightTimeStructure.rightArrivalTime,
      );
    } else if (!this.lockStructure.travelTimeLock && this.lockStructure.rightLock) {
      this.leftAndRightTimeStructure.travelTime =
        this.leftAndRightTimeStructure.leftArrivalTime -
        this.leftAndRightTimeStructure.rightDepartureTime;
      this.leftAndRightTimeStructure.travelTime +=
        this.leftAndRightTimeStructure.travelTime < 0 ? 60 : 0;
    }

    this.updateTrainrunSectionTime();
  }

  /* Left Arrival Time */
  onNodeLeftArrivalTimeButtonPlus(event: MouseEvent) {
    this.stopPropagation(event);
    this.leftAndRightTimeStructure.leftArrivalTime += this.getTimeButtonPlusMinusStep(
      this.leftAndRightTimeStructure.leftArrivalTime,
    );
    this.leftAndRightTimeStructure.leftArrivalTime %= 60;
    this.onNodeLeftArrivalTimeChanged();
  }

  onNodeLeftArrivalTimeButtonMinus(event: MouseEvent) {
    this.stopPropagation(event);
    this.leftAndRightTimeStructure.leftArrivalTime -= this.getTimeButtonPlusMinusStep(
      this.leftAndRightTimeStructure.leftArrivalTime,
    );
    this.leftAndRightTimeStructure.leftArrivalTime +=
      this.leftAndRightTimeStructure.leftArrivalTime < 0 ? 60 : 0;
    this.onNodeLeftArrivalTimeChanged();
  }

  onNodeLeftArrivalTimeChanged() {
    this.leftAndRightTimeStructure.leftArrivalTime =
      this.leftAndRightTimeStructure.leftArrivalTime % 60;
    this.leftAndRightTimeStructure.leftArrivalTime +=
      this.leftAndRightTimeStructure.leftArrivalTime < 0 ? 60 : 0;

    this.leftAndRightTimeStructure.leftDepartureTime = TrainrunsectionHelper.getSymmetricTime(
      this.leftAndRightTimeStructure.leftArrivalTime,
    );
    if (!this.lockStructure.rightLock) {
      this.leftAndRightTimeStructure.rightDepartureTime =
        this.leftAndRightTimeStructure.leftArrivalTime -
        (this.leftAndRightTimeStructure.travelTime % 60);
      this.leftAndRightTimeStructure.rightDepartureTime +=
        this.leftAndRightTimeStructure.rightDepartureTime < 0 ? 60 : 0;
      this.leftAndRightTimeStructure.rightArrivalTime = TrainrunsectionHelper.getSymmetricTime(
        this.leftAndRightTimeStructure.rightDepartureTime,
      );
    } else if (!this.lockStructure.travelTimeLock && this.lockStructure.rightLock) {
      this.leftAndRightTimeStructure.travelTime =
        this.leftAndRightTimeStructure.leftArrivalTime -
        this.leftAndRightTimeStructure.rightDepartureTime;
      this.leftAndRightTimeStructure.travelTime +=
        this.leftAndRightTimeStructure.travelTime < 0 ? 60 : 0;
    }

    this.updateTrainrunSectionTime();
  }

  /* Right Arrival Time */
  onNodeRightArrivalTimeButtonPlus(event: MouseEvent) {
    this.stopPropagation(event);
    this.leftAndRightTimeStructure.rightArrivalTime += this.getTimeButtonPlusMinusStep(
      this.leftAndRightTimeStructure.rightArrivalTime,
    );
    this.leftAndRightTimeStructure.rightArrivalTime %= 60;
    this.onNodeRightArrivalTimeChanged();
  }

  onNodeRightArrivalTimeButtonMinus(event: MouseEvent) {
    this.stopPropagation(event);
    this.leftAndRightTimeStructure.rightArrivalTime -= this.getTimeButtonPlusMinusStep(
      this.leftAndRightTimeStructure.rightArrivalTime,
    );
    this.leftAndRightTimeStructure.rightArrivalTime +=
      this.leftAndRightTimeStructure.rightArrivalTime < 0 ? 60 : 0;
    this.onNodeRightArrivalTimeChanged();
  }

  onNodeRightArrivalTimeChanged() {
    this.leftAndRightTimeStructure.rightArrivalTime =
      this.leftAndRightTimeStructure.rightArrivalTime % 60;
    this.leftAndRightTimeStructure.rightArrivalTime +=
      this.leftAndRightTimeStructure.rightArrivalTime < 0 ? 60 : 0;

    this.leftAndRightTimeStructure.rightDepartureTime = TrainrunsectionHelper.getSymmetricTime(
      this.leftAndRightTimeStructure.rightArrivalTime,
    );
    if (!this.lockStructure.leftLock) {
      this.leftAndRightTimeStructure.leftDepartureTime =
        this.leftAndRightTimeStructure.rightArrivalTime -
        (this.leftAndRightTimeStructure.travelTime % 60);
      this.leftAndRightTimeStructure.leftDepartureTime +=
        this.leftAndRightTimeStructure.leftDepartureTime < 0 ? 60 : 0;
      this.leftAndRightTimeStructure.leftArrivalTime = TrainrunsectionHelper.getSymmetricTime(
        this.leftAndRightTimeStructure.leftDepartureTime,
      );
    } else if (!this.lockStructure.travelTimeLock && this.lockStructure.leftLock) {
      this.leftAndRightTimeStructure.travelTime =
        this.leftAndRightTimeStructure.rightArrivalTime -
        this.leftAndRightTimeStructure.leftDepartureTime;
      this.leftAndRightTimeStructure.travelTime +=
        this.leftAndRightTimeStructure.travelTime < 0 ? 60 : 0;
    }

    this.updateTrainrunSectionTime();
  }

  /* Right Departure Time */
  onNodeRightDepartureTimeButtonPlus(event: MouseEvent) {
    this.stopPropagation(event);
    this.leftAndRightTimeStructure.rightDepartureTime += this.getTimeButtonPlusMinusStep(
      this.leftAndRightTimeStructure.rightDepartureTime,
    );
    this.leftAndRightTimeStructure.rightDepartureTime %= 60;
    this.onNodeRightDepartureTimeChanged();
  }

  onNodeRightDepartureTimeButtonMinus(event: MouseEvent) {
    this.stopPropagation(event);
    this.leftAndRightTimeStructure.rightDepartureTime -= this.getTimeButtonPlusMinusStep(
      this.leftAndRightTimeStructure.rightDepartureTime,
    );
    this.leftAndRightTimeStructure.rightDepartureTime +=
      this.leftAndRightTimeStructure.rightDepartureTime < 0 ? 60 : 0;
    this.onNodeRightDepartureTimeChanged();
  }

  onNodeRightDepartureTimeChanged() {
    this.leftAndRightTimeStructure.rightDepartureTime =
      this.leftAndRightTimeStructure.rightDepartureTime % 60;
    this.leftAndRightTimeStructure.rightDepartureTime +=
      this.leftAndRightTimeStructure.rightDepartureTime < 0 ? 60 : 0;

    this.leftAndRightTimeStructure.rightArrivalTime = TrainrunsectionHelper.getSymmetricTime(
      this.leftAndRightTimeStructure.rightDepartureTime,
    );
    if (!this.lockStructure.leftLock) {
      this.leftAndRightTimeStructure.leftArrivalTime =
        this.leftAndRightTimeStructure.rightDepartureTime +
        (this.leftAndRightTimeStructure.travelTime % 60);
      this.leftAndRightTimeStructure.leftArrivalTime %= 60;
      this.leftAndRightTimeStructure.leftDepartureTime = TrainrunsectionHelper.getSymmetricTime(
        this.leftAndRightTimeStructure.leftArrivalTime,
      );
    } else if (!this.lockStructure.travelTimeLock && this.lockStructure.leftLock) {
      this.leftAndRightTimeStructure.travelTime =
        this.leftAndRightTimeStructure.rightArrivalTime -
        this.leftAndRightTimeStructure.leftDepartureTime;
      this.leftAndRightTimeStructure.travelTime +=
        this.leftAndRightTimeStructure.travelTime < 0 ? 60 : 0;
    }

    this.updateTrainrunSectionTime();
  }

  /* Travel Time */
  onInputTravelTimeElementButtonPlus(event: MouseEvent) {
    this.stopPropagation(event);
    this.leftAndRightTimeStructure.travelTime += this.getTimeButtonPlusMinusStep(
      this.leftAndRightTimeStructure.travelTime,
    );
    this.onInputTravelTimeChanged();
  }

  onInputTravelTimeElementButtonMinus(event: MouseEvent) {
    this.stopPropagation(event);
    this.leftAndRightTimeStructure.travelTime -= this.getTimeButtonPlusMinusStep(
      this.leftAndRightTimeStructure.travelTime,
    );
    this.leftAndRightTimeStructure.travelTime = Math.max(
      1,
      this.leftAndRightTimeStructure.travelTime,
    );
    this.onInputTravelTimeChanged();
  }

  updateTravelTimeChanged() {
    this.leftAndRightTimeStructure.travelTime = Math.max(
      this.leftAndRightTimeStructure.travelTime,
      1,
    );

    if (!this.lockStructure.rightLock) {
      this.leftAndRightTimeStructure.rightArrivalTime =
        this.leftAndRightTimeStructure.leftDepartureTime +
        this.leftAndRightTimeStructure.travelTime;
      this.leftAndRightTimeStructure.rightArrivalTime +=
        this.leftAndRightTimeStructure.rightArrivalTime < 0 ? 60 : 0;
      this.leftAndRightTimeStructure.rightArrivalTime %= 60;
      this.leftAndRightTimeStructure.rightDepartureTime = TrainrunsectionHelper.getSymmetricTime(
        this.leftAndRightTimeStructure.rightArrivalTime,
      );
    } else if (!this.lockStructure.leftLock) {
      this.leftAndRightTimeStructure.leftArrivalTime =
        this.leftAndRightTimeStructure.rightDepartureTime +
        this.leftAndRightTimeStructure.travelTime;
      this.leftAndRightTimeStructure.leftArrivalTime +=
        this.leftAndRightTimeStructure.leftArrivalTime < 0 ? 60 : 0;
      this.leftAndRightTimeStructure.leftArrivalTime %= 60;
      this.leftAndRightTimeStructure.leftDepartureTime = TrainrunsectionHelper.getSymmetricTime(
        this.leftAndRightTimeStructure.leftArrivalTime,
      );
    }
  }

  onInputTravelTimeChanged() {
    this.updateTravelTimeChanged();
    this.updateTrainrunSectionTime();
  }

  roundTime(time: number) {
    return MathUtils.round(time, this.filterService.getTimeDisplayPrecision());
  }

  /* Lock */
  onButtonTravelTimeLock(event: MouseEvent) {
    this.stopPropagation(event);
    this.lockStructure.travelTimeLock = !this.lockStructure.travelTimeLock;
    this.updateTrainrunSectionTimeLock();
  }

  onButtonNodeLeftLock(event: MouseEvent) {
    this.stopPropagation(event);
    this.lockStructure.leftLock = !this.lockStructure.leftLock;
    this.updateTrainrunSectionTimeLock();
  }

  onButtonNodeRightLock(event: MouseEvent) {
    this.stopPropagation(event);
    this.lockStructure.rightLock = !this.lockStructure.rightLock;
    this.updateTrainrunSectionTimeLock();
  }

  getSourceLock(): boolean {
    const sourceId = this.trainrunSection.getSourceNodeId();
    const fromNode = this.perlenketteSection.fromNode.getId();
    if (sourceId === fromNode) {
      return this.lockStructure.leftLock;
    }
    return this.lockStructure.rightLock;
  }

  getTargetLock(): boolean {
    const targetId = this.trainrunSection.getTargetNodeId();
    const toId = this.perlenketteSection.toNode.getId();
    if (targetId === toId) {
      return this.lockStructure.rightLock;
    }
    return this.lockStructure.leftLock;
  }

  updateTrainrunSectionTimeLock() {
    this.trainrunSectionService.updateTrainrunSectionTimeLock(
      this.trainrunSection.getId(),
      this.getSourceLock(),
      this.getTargetLock(),
      this.lockStructure.travelTimeLock,
    );
  }

  /* Buttons in Footer */
  onPropagateTimeLeft(event: MouseEvent) {
    this.stopPropagation(event);
    const toId = this.perlenketteSection.toNode.getId();
    this.trainrunSectionService.propagateTimeAlongTrainrun(this.trainrunSection.getId(), toId);
    this.loadPerlenketteService.render();
  }

  onPropagateTimeRight(event: MouseEvent) {
    this.stopPropagation(event);
    const fromId = this.perlenketteSection.fromNode.getId();
    this.trainrunSectionService.propagateTimeAlongTrainrun(this.trainrunSection.getId(), fromId);
    this.loadPerlenketteService.render();
  }

  clickStopElement(perlenketteSection: PerlenketteSection) {
    this.handleSwitchSection("stops");
  }

  onInputNbrStopsElementButtonMinus(event: MouseEvent) {
    event.stopPropagation();
    const nos = Math.max(0, this.trainrunSection.getNumberOfStops() - 1);
    this.trainrunSectionService.updateTrainrunSectionNumberOfStops(this.trainrunSection, nos);
  }

  onInputNbrStopsChanged() {
    const nos = Math.max(this.leftAndRightTimeStructure.nbrOfStops);
    this.trainrunSectionService.updateTrainrunSectionNumberOfStops(this.trainrunSection, nos);
  }

  onInputNbrStopsElementButtonPlus(event: MouseEvent) {
    event.stopPropagation();
    const nos = Math.max(0, this.trainrunSection.getNumberOfStops() + 1);
    this.trainrunSectionService.updateTrainrunSectionNumberOfStops(this.trainrunSection, nos);
  }

  onEdgeLineClick() {
    const fromNode = this.perlenketteSection.toNode;
    const toNode = this.perlenketteSection.fromNode;
    if (this.uiInteractionService.getEditorMode() === EditorMode.NetzgrafikEditing) {
      const fromPort = fromNode.getPortOfTrainrunSection(this.perlenketteSection.trainrunSectionId);
      const toPort = toNode.getPortOfTrainrunSection(this.perlenketteSection.trainrunSectionId);
      let fromX = fromNode.getPositionX();
      let fromY = fromNode.getPositionY();
      let toX = toNode.getPositionX();
      let toY = toNode.getPositionY();
      if (fromX < toX) {
        toX += toNode.getNodeWidth();
      } else {
        fromX += fromNode.getNodeWidth();
      }
      if (fromY < toY) {
        toY += toNode.getNodeHeight();
      } else {
        fromY += fromNode.getNodeHeight();
      }
      if (
        fromPort.getPositionAlignment() === PortAlignment.Top ||
        fromPort.getPositionAlignment() === PortAlignment.Bottom
      ) {
        fromX += (0.5 + fromPort.getPositionIndex()) * TRAINRUN_SECTION_PORT_SPAN_VERTICAL;
      } else {
        fromY += (0.5 + fromPort.getPositionIndex()) * TRAINRUN_SECTION_PORT_SPAN_HORIZONTAL;
      }
      if (
        toPort.getPositionAlignment() === PortAlignment.Top ||
        toPort.getPositionAlignment() === PortAlignment.Bottom
      ) {
        toX += (0.5 + toPort.getPositionIndex()) * TRAINRUN_SECTION_PORT_SPAN_VERTICAL;
      } else {
        toY += (0.5 + toPort.getPositionIndex()) * TRAINRUN_SECTION_PORT_SPAN_HORIZONTAL;
      }
      const x = (fromX + toX) / 2.0;
      const y = (fromY + toY) / 2.0;
      const center = new Vec2D(x, y);
      this.uiInteractionService.moveNetzgrafikEditorFocalViewPoint(center);
    }
  }

  getLockOpenSvgPath(): string {
    return "M4 6a3 3 0 1 1 6 0v3h8v11H6V9h3V6a2 2 0 1 0-4 0H4Zm8.5 7v4h-1v-4h1ZM7 19v-9h10v9H7Z";
  }

  getLockCloseSvgPath(): string {
    return (
      "M12 4a2 2 0 0 0-2 2v3h4V6a2 2 0 0 0-2-2Zm3 5V6a3 3 0 0 0-6 0v3H6v11h12V9h-3Zm-2.5 " +
      "4v4h-1v-4h1ZM7 19v-9h10v9H7Z"
    );
  }

  getLockSvgPath(isClosed: boolean) {
    if (isClosed) {
      return this.getLockCloseSvgPath();
    }
    return this.getLockOpenSvgPath();
  }

  private updateTrainrunSectionTime() {
    const trsId = this.trainrunSection.getId();
    const sourceArrivalTime = this.getSectionSourceArrivalTime();
    const sourceDeparture = this.getSectionSourceDepartureTime();
    const targetArrival = this.getSectionTargetArrivalTime();
    const targetDeparture = this.getSectionTargetDepartureTime();
    const travelTime = this.getSectionTravelTime();

    this.trainrunSectionService.updateTrainrunSectionTime(
      trsId,
      sourceArrivalTime,
      sourceDeparture,
      targetArrival,
      targetDeparture,
      travelTime,
    );
    this.trainrunSectionService.trainrunSectionsUpdated();
  }

  private updateLeftAndRightTimeStructure() {
    this.leftAndRightTimeStructure = {
      leftArrivalTime: this.getLeftArrivalTime(),
      leftDepartureTime: this.getLeftDepartureTime(),
      rightArrivalTime: this.getRightArrivalTime(),
      rightDepartureTime: this.getRightDepartureTime(),
      travelTime: this.trainrunSection.getTravelTime(),
      nbrOfStops: this.trainrunSection.getNumberOfStops(),
    };
  }

  private updateLockStructure() {
    const sourceId = this.trainrunSection.getSourceNodeId();
    const fromId = this.perlenketteSection.fromNode.getId();
    if (sourceId === fromId) {
      this.lockStructure.leftLock = this.trainrunSection.getSourceDepartureLock();
    } else {
      this.lockStructure.leftLock = this.trainrunSection.getTargetArrivalLock();
    }
    const targetId = this.trainrunSection.getTargetNodeId();
    const toId = this.perlenketteSection.toNode.getId();
    if (targetId === toId) {
      this.lockStructure.rightLock = this.trainrunSection.getTargetArrivalLock();
    } else {
      this.lockStructure.rightLock = this.trainrunSection.getSourceDepartureLock();
    }
    this.lockStructure.travelTimeLock = this.trainrunSection.getTravelTimeLock();
  }
}
