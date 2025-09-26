import {
  AfterContentInit,
  ChangeDetectorRef,
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
import {SymmetryToggleService} from "../../services/util/symmetry-toggle.service";
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
import {VersionControlService} from "../../services/data/version-control.service";
import {ToggleSwitchButtonComponent} from "../../view/toggle-switch-button/toggle-switch-button.component";

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
  public trainrunSection: TrainrunSection;
  public trainrunSectionHelper: TrainrunsectionHelper;
  // for static methods
  public TrainrunsectionHelper = TrainrunsectionHelper;

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
    private changeDetectionRef: ChangeDetectorRef,
    private symmetryToggleService: SymmetryToggleService,
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
    this.trainrunSectionTimesService.setTrainrunSection(this.trainrunSection);
    this.trainrunSectionTimesService.setOffset(0);
    this.trainrunSectionTimesService.setLockStructure(
      this.trainrunSectionHelper.getLeftAndRightLock(
        this.trainrunSection,
        this.trainrunSectionTimesService.getNodesOrdered(),
      ),
    );
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

  shouldDisplayDirectionArrow(): boolean {
    return !this.trainrunSection.getTrainrun().isRoundTrip();
  }

  getDirectionArrowTranslateAndRotate(y: number) {
    if (
      TrainrunsectionHelper.isRightSideDisplayed(this.trainrunSection) &&
      !TrainrunsectionHelper.isLeftSideDisplayed(this.trainrunSection)
    ) {
      return `translate(137, ${y}) rotate(90)`;
    } else if (
      !TrainrunsectionHelper.isRightSideDisplayed(this.trainrunSection) &&
      TrainrunsectionHelper.isLeftSideDisplayed(this.trainrunSection)
    ) {
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

  shouldDisplayAsymmetryArrows(arrow: "top" | "bottom"): boolean {
    if (arrow === "top") {
      if (this.isTargetRightOrBottom()) {
        return !this.trainrunSection.isSourceSymmetricOrTimesSymmetric();
      } else {
        return !this.trainrunSection.isTargetSymmetricOrTimesSymmetric();
      }
    } else {
      if (this.isTargetRightOrBottom()) {
        return !this.trainrunSection.isTargetSymmetricOrTimesSymmetric();
      } else {
        return !this.trainrunSection.isSourceSymmetricOrTimesSymmetric();
      }
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
      this.trainrunSectionTimesService.onButtonNodeLeftLock();
      return;
    }
    if (fieldKey === "travelTime") {
      this.trainrunSectionTimesService.onButtonTravelTimeLock();
      return;
    }
    if (fieldKey === "rightDepartureTime") {
      this.trainrunSectionTimesService.onButtonNodeRightLock();
      return;
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

  showBottomTravelTime() {
    if (this.filterService.isTemporaryDisableFilteringOfItemsInViewEnabled()) {
      return true;
    }
    return (
      !this.trainrunSection.isSymmetric() && this.filterService.isFilterBackwardTravelTimeEnabled()
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
      if (this.trainrunSection.isSymmetric()) {
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

  getNodeBorderContainerScssSuffix(): string {
    if (this.trainrunSection.isSymmetric()) {
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
    if (!this.showTravelTime() || !this.trainrunSection.isSymmetric()) {
      // lock in center when trainrun is asymmetric or travel time is not shown
      tag += " Center";
    }
    return tag;
  }

  getTravelTimeLockTransform() {
    if (this.stationNumberArray.length > 0) {
      if (this.stationNumberArray.length <= 5) {
        // move a bit to the right when some stops are shown
        return this.trainrunSection.isSymmetric() ? "translate(142, 82)" : "translate(159, 82)";
      } else {
        // move a bit more to the right when many stops are shown
        return this.trainrunSection.isSymmetric() ? "translate(155, 82)" : "translate(168, 82)";
      }
    } else {
      // default position
      return "translate(125, 82)";
    }
  }

  clickStopElement() {
    this.handleSwitchSection("stops");
  }

  /* number of stops */
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

  getLockSvgPath(isClosed: boolean) {
    if (isClosed) {
      return this.getLockCloseSvgPath();
    }
    return this.getLockOpenSvgPath();
  }

  onLeftNodeSymmetryToggleChanged(symmetry: boolean) {
    const originalState = this.trainrunSectionHelper.isLeftNextStopNodeSymmetric(
      this.trainrunSection,
      this.trainrunSectionTimesService.getNodesOrdered(),
    );
    this.symmetryToggleService.onLeftNodeSymmetryToggleChanged(
      this.trainrunSection,
      this.trainrunSectionTimesService,
      symmetry,
      () => {
        // Revert the toggle state
        if (this.leftSymmetryToggle) {
          this.leftSymmetryToggle.checked = !originalState;
        }
        this.changeDetectionRef.detectChanges();
      },
    );
  }

  onRightNodeSymmetryToggleChanged(symmetry: boolean) {
    const originalState = this.trainrunSectionHelper.isRightNextStopNodeSymmetric(
      this.trainrunSection,
      this.trainrunSectionTimesService.getNodesOrdered(),
    );
    this.symmetryToggleService.onRightNodeSymmetryToggleChanged(
      this.trainrunSection,
      this.trainrunSectionTimesService,
      symmetry,
      () => {
        // Revert the toggle state
        if (this.rightSymmetryToggle) {
          this.rightSymmetryToggle.checked = !originalState;
        }
        this.changeDetectionRef.detectChanges();
      },
    );
  }

  isTrainrunSymmetric() {
    return this.trainrunSectionService.isTrainrunSymmetric(this.trainrunSection.getTrainrunId());
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

  private getLockOpenSvgPath(): string {
    return "M4 6a3 3 0 1 1 6 0v3h8v11H6V9h3V6a2 2 0 1 0-4 0H4Zm8.5 7v4h-1v-4h1ZM7 19v-9h10v9H7Z";
  }

  private getLockCloseSvgPath(): string {
    return (
      "M12 4a2 2 0 0 0-2 2v3h4V6a2 2 0 0 0-2-2Zm3 5V6a3 3 0 0 0-6 0v3H6v11h12V9h-3Zm-2.5 " +
      "4v4h-1v-4h1ZM7 19v-9h10v9H7Z"
    );
  }

  private isTargetRightOrBottom() {
    return TrainrunsectionHelper.isTargetRightOrBottom(
      this.trainrunSectionService.getAllTrainrunSectionsForTrainrun(
        this.trainrunSection.getTrainrunId(),
      )[0],
    );
  }
}
