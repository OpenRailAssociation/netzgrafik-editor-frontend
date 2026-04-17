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
import {TrainrunService} from "../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../services/data/trainrunsection.service";
import {takeUntil} from "rxjs/operators";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {Observable, Subject} from "rxjs";
import {TrainrunSection} from "../../models/trainrunsection.model";
import {TrainrunSectionTimesService} from "../../services/data/trainrun-section-times.service";
import {TrainrunSectionsView} from "../../view/editor-main-view/data-views/trainrunsections.view";
import {FilterService} from "../../services/ui/filter.service";
import {LoadPerlenketteService} from "../service/load-perlenkette.service";
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
import {ToggleSwitchButtonComponent} from "../../view/toggle-switch-button/toggle-switch-button.component";
import {Trainrun} from "src/app/models/trainrun.model";
import {Node} from "src/app/models/node.model";

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
  @ViewChild("bottomTravelTime", {static: false}) bottomTravelTimeElement: ElementRef;
  @ViewChild("leftDepartureTime", {static: false})
  leftDepartureTimeElement: ElementRef;
  @ViewChild("leftArrivalTime", {static: false})
  leftArrivalTimeElement: ElementRef;
  @ViewChild("nbrOfStops", {static: false}) nbrOfStops: ElementRef;
  @ViewChild("leftSymmetryToggle") leftSymmetryToggle: ToggleSwitchButtonComponent;
  @ViewChild("rightSymmetryToggle") rightSymmetryToggle: ToggleSwitchButtonComponent;

  private static timeEditor = true;

  stationNumberArray: number[];
  private firstSection: TrainrunSection;
  private lastSection: TrainrunSection;
  public trainrun: Trainrun;

  public numberOfStops: number;

  private destroyed$ = new Subject<void>();

  constructor(
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private uiInteractionService: UiInteractionService,
    public trainrunSectionTimesService: TrainrunSectionTimesService,
    readonly filterService: FilterService,
    private loadPerlenketteService: LoadPerlenketteService,
    private versionControlService: VersionControlService,
  ) {}

  ngOnInit() {
    this.numberOfStops = this.perlenketteSection.numberOfStops;
    this.stationNumberArray = Array(this.perlenketteSection.numberOfStops)
      .fill(1)
      .map((x, i) => i + 1);
    const group = this.trainrunSectionService.getTrainrunSectionGroupForSection(
      this.perlenketteSection.section,
    );
    this.firstSection = group[0];
    this.lastSection = group.at(-1)!;
    this.trainrun = this.firstSection.getTrainrun();
    this.trainrunSectionTimesService.setTrainrunSection(this.firstSection);
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

    this.signalHeightChanged.next(192);
  }

  ngOnDestroy() {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  getEdgeLineArrowClass() {
    return (
      StaticDomTags.EDGE_LINE_ARROW_CLASS +
      StaticDomTags.makeClassTag(
        StaticDomTags.FREQ_LINE_PATTERN,
        this.trainrun.getFrequencyLinePatternRef(),
      ) +
      " " +
      StaticDomTags.TAG_UI_DIALOG +
      " " +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_COLOR_REF, this.trainrun.getCategoryColorRef()) +
      StaticDomTags.makeClassTag(
        StaticDomTags.TAG_LINEPATTERN_REF,
        this.trainrun.getTimeCategoryLinePatternRef(),
      )
    );
  }

  shouldDisplayDirectionArrow(location: "top" | "bottom"): boolean {
    return !this.trainrun.isRoundTrip() && !this.isExtremityCollapsed(location);
  }

  getDirectionArrowTranslateAndRotate(y: number) {
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
    if (this.firstSection === null) {
      return false;
    }
    return this.trainrun.isRoundTrip() || !this.trainrunService.isTrainrunTargetRightOrBottom();
  }

  isRightSideDisplayed(): boolean {
    if (this.firstSection === null) {
      return false;
    }
    return this.trainrun.isRoundTrip() || this.trainrunService.isTrainrunTargetRightOrBottom();
  }

  shouldDisplayAsymmetryArrow(arrowLocation: "top" | "bottom"): boolean {
    if (!this.trainrun.isRoundTrip() || this.isExtremityCollapsed(arrowLocation)) return false;
    if (this.getLeftToRightDirection(arrowLocation) === "sourceToTarget") {
      return !this.firstSection.isSourceSymmetricOrTimesSymmetric();
    } else {
      return !this.lastSection.isTargetSymmetricOrTimesSymmetric();
    }
  }

  getAsymmetryArrowTranslate(y: number) {
    return `translate(137, ${y}) rotate(90)`;
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
    return this.trainrunSectionTimesService.getLockStructure().travelTimeLock;
  }

  showLeftLock(): boolean {
    if (this.isExtremityCollapsed("top")) return false;
    if (this.showAllLockStates) {
      return true;
    }
    return this.trainrunSectionTimesService.getLockStructure().leftLock;
  }

  showRightLock(): boolean {
    if (this.isExtremityCollapsed("bottom")) return false;
    if (this.showAllLockStates) {
      return true;
    }
    return this.trainrunSectionTimesService.getLockStructure().rightLock;
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

  private handleSwitchSection(fieldKey: string) {
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
    if (fieldKey === "bottomTravelTime") {
      PerlenketteSectionComponent.timeEditor = true;
      setTimeout(() => this.focusAndSelect(this.bottomTravelTimeElement), 100);
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
    return this.roundTime(this.trainrunSectionTimesService.getTimeStructure().rightDepartureTime);
  }

  getRightDepartureTimeClassTag(): string {
    const targetId = this.lastSection.getTargetNodeId();
    const toId = this.perlenketteSection.toNode.getId();
    if (targetId === toId) {
      return (
        " " +
        TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
          this.lastSection.getTargetDepartureConsecutiveTime(),
          this.trainrun,
        ) +
        (this.lastSection.hasTargetDepartureWarning() ? " " + StaticDomTags.TAG_WARNING : "")
      );
    }
    return (
      " " +
      TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
        this.firstSection.getSourceDepartureConsecutiveTime(),
        this.trainrun,
      ) +
      (this.firstSection.hasSourceDepartureWarning() ? " " + StaticDomTags.TAG_WARNING : "")
    );
  }

  /* right arrival time */
  getRightArrivalTime(): number {
    return this.roundTime(this.trainrunSectionTimesService.getTimeStructure().rightArrivalTime);
  }

  getRightArrivalTimeClassTag(): string {
    const targetId = this.lastSection.getTargetNodeId();
    const toId = this.perlenketteSection.toNode.getId();
    if (targetId === toId) {
      return (
        " " +
        TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
          this.lastSection.getTargetArrivalConsecutiveTime(),
          this.trainrun,
        ) +
        (this.lastSection.hasTargetArrivalWarning() ? " " + StaticDomTags.TAG_WARNING : "")
      );
    }
    return (
      " " +
      TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
        this.firstSection.getSourceArrivalConsecutiveTime(),
        this.trainrun,
      ) +
      (this.firstSection.hasSourceArrivalWarning() ? " " + StaticDomTags.TAG_WARNING : "")
    );
  }

  showStopArcStart(): boolean {
    const targetId = this.lastSection.getTargetNodeId();
    const fromId = this.perlenketteSection.fromNode.getId();
    let trans = this.firstSection.getSourceNode().getTransition(this.firstSection.getId());
    if (targetId === fromId) {
      trans = this.lastSection.getTargetNode().getTransition(this.lastSection.getId());
    }
    if (trans === undefined) {
      return true;
    }
    return !trans.getIsNonStopTransit();
  }

  showStopArcEnd(): boolean {
    const targetId = this.lastSection.getTargetNodeId();
    const toId = this.perlenketteSection.toNode.getId();
    let trans = this.firstSection.getSourceNode().getTransition(this.firstSection.getId());
    if (targetId === toId) {
      trans = this.lastSection.getTargetNode().getTransition(this.lastSection.getId());
    }
    if (trans === undefined) {
      return true;
    }
    return !trans.getIsNonStopTransit();
  }

  showRightDepartureTime(): boolean {
    if (this.isExtremityCollapsed("bottom")) return false;
    return true;
  }

  showRightArrivalTime() {
    if (this.isExtremityCollapsed("bottom")) return false;
    const targetId = this.lastSection.getTargetNodeId();
    const toId = this.perlenketteSection.toNode.getId();
    if (!this.filterService.isFilterArrivalDepartureTimeEnabled()) {
      if (!this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
        return false;
      }
    }
    let trans = this.firstSection.getSourceNode().getTransition(this.firstSection.getId());
    if (targetId === toId) {
      trans = this.lastSection.getTargetNode().getTransition(this.lastSection.getId());
    }
    if (trans === undefined) {
      return true;
    }
    return !trans.getIsNonStopTransit();
  }

  /* left departure time */
  getLeftDepartureTime(): number {
    return this.roundTime(this.trainrunSectionTimesService.getTimeStructure().leftDepartureTime);
  }

  getLeftDepartureTimeClassTag(): string {
    const sourceId = this.firstSection.getSourceNodeId();
    const fromId = this.perlenketteSection.fromNode.getId();
    if (sourceId === fromId) {
      return (
        " " +
        TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
          this.firstSection.getSourceDepartureConsecutiveTime(),
          this.trainrun,
        ) +
        (this.firstSection.hasSourceDepartureWarning() ? " " + StaticDomTags.TAG_WARNING : "")
      );
    }
    return (
      " " +
      TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
        this.lastSection.getTargetDepartureConsecutiveTime(),
        this.trainrun,
      ) +
      (this.lastSection.hasTargetDepartureWarning() ? " " + StaticDomTags.TAG_WARNING : "")
    );
  }

  showLeftDepartureTime() {
    if (this.isExtremityCollapsed("top")) return false;
    return true;
  }

  /* left arrival time */
  getLeftArrivalTime(): number {
    return this.roundTime(this.trainrunSectionTimesService.getTimeStructure().leftArrivalTime);
  }

  getLeftArrivalTimeClassTag(): string {
    const sourceId = this.firstSection.getSourceNodeId();
    const fromId = this.perlenketteSection.fromNode.getId();
    if (sourceId === fromId) {
      return (
        " " +
        TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
          this.firstSection.getSourceArrivalConsecutiveTime(),
          this.trainrun,
        ) +
        (this.firstSection.hasSourceArrivalWarning() ? " " + StaticDomTags.TAG_WARNING : "")
      );
    }
    return (
      " " +
      TrainrunSectionsView.getTrainrunSectionTimeElementOddOffsetTag(
        this.lastSection.getTargetArrivalConsecutiveTime(),
        this.trainrun,
      ) +
      (this.lastSection.hasTargetArrivalWarning() ? " " + StaticDomTags.TAG_WARNING : "")
    );
  }

  showLeftArrivalTime() {
    if (this.isExtremityCollapsed("top")) return false;
    const sourceId = this.firstSection.getSourceNodeId();
    const fromId = this.perlenketteSection.fromNode.getId();
    if (!this.filterService.isFilterArrivalDepartureTimeEnabled()) {
      if (!this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
        return false;
      }
    }
    let trans = this.lastSection.getTargetNode().getTransition(this.lastSection.getId());
    if (sourceId === fromId) {
      trans = this.firstSection.getSourceNode().getTransition(this.firstSection.getId());
    }
    if (trans === undefined) {
      return true;
    }
    return !trans.getIsNonStopTransit();
  }

  /* travel time */
  showTravelTime() {
    if (this.isTip()) return false;
    if (this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }
    return this.filterService.isFilterTravelTimeEnabled();
  }

  showBottomTravelTime() {
    if (this.isTip()) return false;
    if (this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }
    return (
      this.trainrun.isRoundTrip() &&
      !this.areEndSectionsSymmetric() &&
      this.filterService.isFilterBackwardTravelTimeEnabled()
    );
  }

  showArrivalAndDepartureTime(): boolean {
    if (this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }
    return this.filterService.isFilterArrivalDepartureTimeEnabled();
  }

  getTravelTimeTransform(element: "travelTime" | "bottomTravelTime") {
    if (element === "travelTime") {
      if (this.areEndSectionsSymmetric()) {
        // default position
        return "translate(121, 93)";
      }
      // position swapped when asymmetric to match leftDepartureTime and rightArrivalTime that are always shown on the right side
      if (this.stationNumberArray.length > 5) {
        // move a bit more to the right when many stops are shown
        return "translate(165, 106)";
      }
      return "translate(155, 106)";
    } else {
      // position on the left side to match leftArrivalTime and rightDepartureTime that are always shown on the left side
      return "translate(121, 93)";
    }
  }

  getNodeBorderContainerClassSuffix(): "" | "Right" {
    if (this.areEndSectionsSymmetric()) {
      return "";
    }
    // show travel time on the right side
    return "Right";
  }

  /* lock icons */
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
    if (!this.showTravelTime() || !this.areEndSectionsSymmetric()) {
      // lock in center when trainrun is asymmetric or travel time is not shown
      tag += " Center";
    }
    return tag;
  }

  getTravelTimeLockTransform() {
    if (this.stationNumberArray.length > 0) {
      if (this.stationNumberArray.length <= 5) {
        // move a bit to the right when some stops are shown
        return this.areEndSectionsSymmetric() ? "translate(142, 82)" : "translate(159, 82)";
      } else {
        // move a bit more to the right when many stops are shown
        return this.areEndSectionsSymmetric() ? "translate(155, 82)" : "translate(168, 82)";
      }
    } else {
      // default position
      return "translate(125, 82)";
    }
  }

  getTravelTime() {
    return this.getTopOrBottomTravelTime("top");
  }

  getBottomTravelTime() {
    return this.getTopOrBottomTravelTime("bottom");
  }

  private getTopOrBottomTravelTime(side: "top" | "bottom") {
    const timeStructure = this.trainrunSectionTimesService.getTimeStructure();
    const travelTime = side === "top" ? timeStructure.travelTime : timeStructure.bottomTravelTime;

    if (
      this.getNode(this.firstSection, true).isNonStop(this.firstSection) ||
      this.getNode(this.lastSection, false).isNonStop(this.lastSection)
    ) {
      const cumulativeTravelTime = this.trainrunService.getCumulativeTravelTime(
        this.firstSection,
        this.getLeftToRightDirection(side), // ???
      );
      return "" + this.roundTime(cumulativeTravelTime) + "' (" + this.roundTime(travelTime) + "')";
    }
    return "" + this.roundTime(travelTime) + "'";
  }

  /* Left Departure Time */
  onNodeLeftDepartureTimeButtonPlus(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onNodeLeftDepartureTimeButtonPlus();
  }

  onNodeLeftDepartureTimeButtonMinus(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onNodeLeftDepartureTimeButtonMinus();
  }

  onNodeLeftDepartureTimeChanged() {
    this.trainrunSectionTimesService.onNodeLeftDepartureTimeChanged();
  }

  /* Left Arrival Time */
  onNodeLeftArrivalTimeButtonPlus(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onNodeLeftArrivalTimeButtonPlus();
  }

  onNodeLeftArrivalTimeButtonMinus(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onNodeLeftArrivalTimeButtonMinus();
  }

  onNodeLeftArrivalTimeChanged() {
    this.trainrunSectionTimesService.onNodeLeftArrivalTimeChanged();
  }

  /* Right Arrival Time */
  onNodeRightArrivalTimeButtonPlus(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onNodeRightArrivalTimeButtonPlus();
  }

  onNodeRightArrivalTimeButtonMinus(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onNodeRightArrivalTimeButtonMinus();
  }

  onNodeRightArrivalTimeChanged() {
    this.trainrunSectionTimesService.onNodeRightArrivalTimeChanged();
  }

  /* Right Departure Time */
  onNodeRightDepartureTimeButtonPlus(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onNodeRightDepartureTimeButtonPlus();
  }

  onNodeRightDepartureTimeButtonMinus(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onNodeRightDepartureTimeButtonMinus();
  }

  onNodeRightDepartureTimeChanged() {
    this.trainrunSectionTimesService.onNodeRightDepartureTimeChanged();
  }

  /* Travel Time */
  onTravelTimeButtonPlus(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onTravelTimeButtonPlus();
  }

  onTravelTimeButtonMinus(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onTravelTimeButtonMinus();
  }

  onTravelTimeChanged() {
    this.trainrunSectionTimesService.onTravelTimeChanged();
  }

  /* Bottom travel time */
  onBottomTravelTimeButtonPlus(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onBottomTravelTimeButtonPlus();
  }

  onBottomTravelTimeButtonMinus(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onBottomTravelTimeButtonMinus();
  }

  onBottomTravelTimeChanged() {
    this.trainrunSectionTimesService.onBottomTravelTimeChanged();
  }

  private roundTime(time: number) {
    return MathUtils.round(time, this.filterService.getTimeDisplayPrecision());
  }

  /* Lock */
  onButtonTravelTimeLock(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onButtonTravelTimeLock();
  }

  onButtonNodeLeftLock(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onButtonNodeLeftLock();
  }

  onButtonNodeRightLock(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onButtonNodeRightLock();
  }

  /* Buttons in Footer */
  onPropagateTimeLeft(event: MouseEvent) {
    this.stopPropagation(event);
    const toId = this.perlenketteSection.toNode.getId();
    this.trainrunSectionService.propagateTimeAlongTrainrun(this.lastSection.getId(), toId); // ??
    this.loadPerlenketteService.render();
  }

  onPropagateTimeRight(event: MouseEvent) {
    this.stopPropagation(event);
    const fromId = this.perlenketteSection.fromNode.getId();
    this.trainrunSectionService.propagateTimeAlongTrainrun(this.firstSection.getId(), fromId); // ??
    this.loadPerlenketteService.render();
  }

  clickStopElement() {
    this.handleSwitchSection("stops");
  }

  onEdgeLineClick() {
    const fromNode = this.perlenketteSection.toNode;
    const toNode = this.perlenketteSection.fromNode;
    if (this.uiInteractionService.getEditorMode() === EditorMode.NetzgrafikEditing) {
      const fromPort = fromNode.getPortOfTrainrunSection(this.perlenketteSection.trainrunSectionId); // source
      const toPort = toNode.getPortOfTrainrunSection(this.perlenketteSection.trainrunSectionId); // target
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

  onLeftNodeSymmetryToggle(symmetry: boolean) {
    this.trainrunSectionTimesService.onLeftNodeSymmetryToggle(symmetry);
  }

  onRightNodeSymmetryToggle(symmetry: boolean) {
    this.trainrunSectionTimesService.onRightNodeSymmetryToggle(symmetry);
  }

  isTrainrunSymmetric() {
    return this.trainrunSectionService.isTrainrunSymmetric(this.trainrun.getId());
  }

  private getLockOpenSvgPath(): string {
    return "M4 6a3 3 0 1 1 6 0v3h8v11H6V9h3V6a2 2 0 1 0-4 0H4Zm8.5 7v4h-1v-4h1ZM7 19v-9h10v9H7Z";
  }

  private getLockCloseSvgPath(): string {
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

  private getLeftToRightDirection(side: "top" | "bottom"): "sourceToTarget" | "targetToSource" {
    const direction =
      this.perlenketteSection.fromNode.getId() === this.firstSection.getSourceNode().getId()
        ? "sourceToTarget"
        : "targetToSource";
    if (side === "top") {
      return direction;
    } else {
      return direction === "sourceToTarget" ? "targetToSource" : "sourceToTarget";
    }
  }

  private areEndSectionsSymmetric(): boolean {
    return this.firstSection.getSourceSymmetry() && this.lastSection.getTargetSymmetry();
  }

  private getNode(trainrunSection: TrainrunSection, atSource: boolean): Node {
    return atSource ? trainrunSection.getSourceNode() : trainrunSection.getTargetNode();
  }

  private isExtremityCollapsed(location: "top" | "bottom"): boolean {
    return location === "top"
      ? this.firstSection.getSourceNode().getIsCollapsed()
      : this.lastSection.getTargetNode().getIsCollapsed();
  }

  isTip(): boolean {
    return this.isExtremityCollapsed("top") || this.isExtremityCollapsed("bottom");
  }

  getEdgeLinePath(): string {
    if (this.isExtremityCollapsed("top")) return "M137,130V192";
    if (this.isExtremityCollapsed("bottom")) return "M137,0V62";
    return "M137,0V192";
  }
}
