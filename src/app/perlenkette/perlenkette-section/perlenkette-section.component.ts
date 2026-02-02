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
  ) {
    this.trainrunSectionHelper = new TrainrunsectionHelper(this.trainrunService);
  }

  ngOnInit() {
    this.numberOfStops = this.perlenketteSection.numberOfStops;
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
    return this.trainrunSectionTimesService.getLockStructure().travelTimeLock;
  }

  showLeftLock(): boolean {
    if (this.showAllLockStates) {
      return true;
    }
    return this.trainrunSectionTimesService.getLockStructure().leftLock;
  }

  showRightLock(): boolean {
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

  getTravelTimeLockTransform() {
    if (this.stationNumberArray.length > 0) {
      if (this.stationNumberArray.length <= 5) {
        // move a bit to the right when some stops are shown
        return "translate(142, 82)";
      } else {
        // move a bit more to the right when many stops are shown
        return "translate(155, 82)";
      }
    } else {
      // default position
      return "translate(125, 82)";
    }
  }

  getTravelTime() {
    if (
      TrainrunSectionsView.getNode(this.trainrunSection, true).isNonStop(this.trainrunSection) ||
      TrainrunSectionsView.getNode(this.trainrunSection, false).isNonStop(this.trainrunSection)
    ) {
      const cumulativeTravelTime = this.trainrunService.getCumulativeTravelTime(
        this.trainrunSection,
        "sourceToTarget",
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
    this.trainrunSectionTimesService.onPropagateTimeLeft(this.trainrunSection);
  }

  onPropagateTimeRight(event: MouseEvent) {
    this.stopPropagation(event);
    this.trainrunSectionTimesService.onPropagateTimeRight(this.trainrunSection);
  }

  clickStopElement() {
    this.handleSwitchSection("stops");
  }

  onInputNbrStopsElementButtonMinus(event: MouseEvent) {
    event.stopPropagation();
    const nos = Math.max(0, this.trainrunSection.getNumberOfStops() - 1);
    this.trainrunSectionService.updateTrainrunSectionNumberOfStops(this.trainrunSection, nos);
  }

  onInputNbrStopsChanged() {
    const nos = Math.max(this.numberOfStops);
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
}
