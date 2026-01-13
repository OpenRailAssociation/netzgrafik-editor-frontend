import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import {TrainrunSectionService} from "../../../../services/data/trainrunsection.service";
import {TrainrunSection} from "../../../../models/trainrunsection.model";
import {TrainrunService} from "../../../../services/data/trainrun.service";
import {TrainrunDialogParameter} from "../trainrun-and-section-dialog.component";
import {DataService} from "../../../../services/data/data.service";
import {
  LeftAndRightElement,
  TrainrunsectionHelper,
} from "../../../../services/util/trainrunsection.helper";
import {FilterService} from "../../../../services/ui/filter.service";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {LinePatternRefs} from "../../../../data-structures/business.data.structures";
import {StaticDomTags} from "../../../editor-main-view/data-views/static.dom.tags";
import {ColorRefType} from "../../../../data-structures/technical.data.structures";
import {
  TrainrunSectionTimesService,
  LeftAndRightLockStructure,
  LeftAndRightTimeStructure,
} from "../../../../services/data/trainrun-section-times.service";
import {VersionControlService} from "../../../../services/data/version-control.service";

@Component({
  selector: "sbb-trainrunsection-tab",
  templateUrl: "./trainrun-section-tab.component.html",
  styleUrls: ["./trainrun-section-tab.component.scss"],
  providers: [TrainrunSectionTimesService],
})
export class TrainrunSectionTabComponent implements AfterViewInit, OnDestroy {
  @Input()
  trainrunDialogParameter: TrainrunDialogParameter;
  @ViewChild("leftDepartureTimeInputElement")
  leftDepartureTimeInputElement: ElementRef;
  @ViewChild("leftArrivalTimeInputElement")
  leftArrivalTimeInputElement: ElementRef;
  @ViewChild("rightDepartureTimeInputElement")
  rightDepartureTimeInputElement: ElementRef;
  @ViewChild("rightArrivalTimeInputElement")
  rightArrivalTimeInputElement: ElementRef;
  @ViewChild("travelTimeInputElement")
  travelTimeInputElement: ElementRef;

  public selectedTrainrunSection: TrainrunSection;
  public leftBetriebspunkt: string[] = ["", ""];
  public rightBetriebspunkt: string[] = ["", ""];
  public tagNbrStopInput = false;
  public numberOfStops: number;
  public frequency: number;
  public frequencyLinePattern: LinePatternRefs;
  public categoryShortName: string;
  public categoryColorRef: ColorRefType;
  public timeCategoryShortName: string;
  public timeCategoryLinePattern: LinePatternRefs;

  private trainrunSectionHelper: TrainrunsectionHelper;
  private destroyed = new Subject<void>();

  public get isTopTrainrunSectionInfoDisplayed(): boolean {
    if (this.selectedTrainrunSection === null) {
      return false;
    }
    const isTargetRightOrBottom = TrainrunsectionHelper.isTargetRightOrBottom(
      this.selectedTrainrunSection,
    );
    return this.isRoundTrip() || isTargetRightOrBottom;
  }

  public get isBottomTrainrunSectionInfoDisplayed(): boolean {
    if (this.selectedTrainrunSection === null) {
      return false;
    }
    const isTargetRightOrBottom = TrainrunsectionHelper.isTargetRightOrBottom(
      this.selectedTrainrunSection,
    );
    return this.isRoundTrip() || !isTargetRightOrBottom;
  }

  constructor(
    private dataService: DataService,
    private filterService: FilterService,
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private changeDetection: ChangeDetectorRef,
    public trainrunSectionTimesService: TrainrunSectionTimesService,
    private versionControlService: VersionControlService,
  ) {
    this.trainrunSectionHelper = new TrainrunsectionHelper(this.trainrunService);

    this.trainrunSectionTimesService.setOffset(0);
    this.trainrunService.trainruns.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.resetOffsetAfterTrainrunChanged();
      this.updateAllValues();
    });
    this.trainrunSectionService.trainrunSections.pipe(takeUntil(this.destroyed)).subscribe(() => {
      if (
        this.selectedTrainrunSection !== this.trainrunSectionService.getSelectedTrainrunSection()
      ) {
        this.resetOffsetAfterTrainrunChanged();
        this.updateAllValues();
      }
    });
  }

  updateAllValues() {
    this.selectedTrainrunSection = this.trainrunSectionService.getSelectedTrainrunSection();
    if (this.selectedTrainrunSection === null) {
      return;
    }
    this.trainrunSectionTimesService.setTrainrunSection(this.selectedTrainrunSection);
    this.frequency = this.selectedTrainrunSection.getFrequency();
    this.frequencyLinePattern = this.selectedTrainrunSection.getFrequencyLinePatternRef();
    this.categoryShortName = this.selectedTrainrunSection.getTrainrun().getCategoryShortName();
    this.categoryColorRef = this.selectedTrainrunSection.getTrainrun().getCategoryColorRef();
    this.timeCategoryShortName = this.selectedTrainrunSection
      .getTrainrun()
      .getTimeCategoryShortName();
    this.timeCategoryLinePattern = this.selectedTrainrunSection
      .getTrainrun()
      .getTimeCategoryLinePatternRef();
    this.trainrunSectionTimesService.setHighlightTravelTimeElement(false);
    this.numberOfStops = this.selectedTrainrunSection.getNumberOfStops();
    this.trainrunSectionTimesService.applyOffsetAndTransformTimeStructure();

    this.leftBetriebspunkt = this.trainrunSectionHelper.getLeftBetriebspunkt(
      this.selectedTrainrunSection,
      this.trainrunSectionTimesService.getNodesOrdered(),
    );
    this.rightBetriebspunkt = this.trainrunSectionHelper.getRightBetriebspunkt(
      this.selectedTrainrunSection,
      this.trainrunSectionTimesService.getNodesOrdered(),
    );
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  ngAfterViewInit(): void {
    this.calcAndSetOffset();
    const focusElement = this.trainrunSectionHelper.mapSelectedTimeElement(
      this.trainrunDialogParameter.trainrunSectionText,
      this.selectedTrainrunSection,
      this.trainrunSectionTimesService.getNodesOrdered(),
      this.trainrunDialogParameter.forward,
    );
    this.trainrunSectionTimesService.setInitialLeftAndRightElement(focusElement);
    this.setFocusToUIElement(focusElement);

    this.updateAllValues();
    this.changeDetection.detectChanges();
  }

  getContentClassTag(): string {
    const retVal: string = "EditTrainrunSectionDialogTabContent";
    if (this.versionControlService.getVariantIsWritable()) {
      return retVal;
    }
    return retVal + " readonly";
  }

  getContentFooterClassTag(): string {
    const retVal: string = "EditTrainrunDialogTabFooter";
    if (this.versionControlService.getVariantIsWritable()) {
      return retVal;
    }
    return retVal + " readonly";
  }

  setFocusToUIElement(focusElement: LeftAndRightElement) {
    switch (focusElement) {
      case LeftAndRightElement.LeftArrival:
        this.setFocusAndSelectInputElement(this.leftArrivalTimeInputElement.nativeElement);
        break;
      case LeftAndRightElement.LeftDeparture:
        this.setFocusAndSelectInputElement(this.leftDepartureTimeInputElement.nativeElement);
        break;
      case LeftAndRightElement.RightArrival:
        this.setFocusAndSelectInputElement(this.rightArrivalTimeInputElement.nativeElement);
        break;
      case LeftAndRightElement.RightDeparture:
        this.setFocusAndSelectInputElement(this.rightDepartureTimeInputElement.nativeElement);
        break;
      case LeftAndRightElement.TravelTime:
        this.setFocusAndSelectInputElement(this.travelTimeInputElement.nativeElement);
        break;
    }
  }

  setFocusAndSelectInputElement(element: HTMLInputElement) {
    setTimeout(() => {
      element.focus();
      element.select();
    }, 800);
  }

  getEdgeLineClassAttrString(layer: number) {
    return (
      StaticDomTags.EDGE_LINE_CLASS +
      StaticDomTags.makeClassTag(StaticDomTags.LINE_LAYER, "" + layer) +
      StaticDomTags.makeClassTag(StaticDomTags.FREQ_LINE_PATTERN, this.frequencyLinePattern) +
      " " +
      StaticDomTags.TAG_UI_DIALOG +
      " " +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_COLOR_REF, this.categoryColorRef) +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_LINEPATTERN_REF, this.timeCategoryLinePattern)
    );
  }

  getEdgeLineArrowClassAttrString() {
    return (
      StaticDomTags.EDGE_LINE_ARROW_CLASS +
      StaticDomTags.makeClassTag(StaticDomTags.FREQ_LINE_PATTERN, this.frequencyLinePattern) +
      " " +
      StaticDomTags.TAG_UI_DIALOG +
      " " +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_COLOR_REF, this.categoryColorRef) +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_LINEPATTERN_REF, this.timeCategoryLinePattern)
    );
  }

  getArrowTranslateAndRotate() {
    if (this.isTopTrainrunSectionInfoDisplayed && !this.isBottomTrainrunSectionInfoDisplayed) {
      return "translate(60, 16) rotate(0)";
    } else if (
      !this.isTopTrainrunSectionInfoDisplayed &&
      this.isBottomTrainrunSectionInfoDisplayed
    ) {
      return "translate(60, 16) rotate(180)";
    }
    return "";
  }

  /* methods for tabbing */
  setFocusToBeginningOfLoop() {
    this.leftDepartureTimeInputElement.nativeElement.focus();
    this.leftDepartureTimeInputElement.nativeElement.select();
  }

  setFocusToEndOfLoop() {
    this.leftArrivalTimeInputElement.nativeElement.focus();
    this.leftArrivalTimeInputElement.nativeElement.select();
  }

  /* number of stops */
  onNumberOfStopsChanged() {
    this.numberOfStops = Math.max(0, this.numberOfStops);
    this.trainrunSectionService.updateTrainrunSectionNumberOfStops(
      this.selectedTrainrunSection,
      this.numberOfStops,
    );
  }

  onInputNumberOfStopsElementButtonPlus() {
    this.numberOfStops += 1;
    this.trainrunSectionTimesService.setHighlightTravelTimeElement(false);
    this.onNumberOfStopsChanged();
  }

  onInputNumberOfStopsElementButtonMinus() {
    this.numberOfStops -= 1;
    this.numberOfStops = Math.max(0, this.numberOfStops);
    this.onNumberOfStopsChanged();
  }

  onMouseEnterNbrStopInput() {
    this.tagNbrStopInput = true;
  }

  onMouseOutNbrStopInput() {
    this.tagNbrStopInput = false;
  }

  getNumberOfStopsInputElementClass() {
    const activeTag = this.tagNbrStopInput ? " IsActive" : " NotActive";
    if (this.numberOfStops > 0) {
      return "NumberOfStopsInputElement show" + activeTag;
    }
    return "NumberOfStopsInputElement" + activeTag;
  }

  private resetOffsetAfterTrainrunChanged() {
    if (this.trainrunSectionTimesService.getOffsetTransformationActive()) {
      this.trainrunSectionTimesService.removeOffsetAndBackTransformTimeStructure();

      this.selectedTrainrunSection = this.trainrunSectionService.getSelectedTrainrunSection();
      if (this.selectedTrainrunSection !== null) {
        this.frequency = this.selectedTrainrunSection.getFrequency();
        if (this.trainrunSectionTimesService.getOffset() % this.frequency !== 0) {
          this.trainrunSectionTimesService.setOffset(0);
        }
      } else {
        this.trainrunSectionTimesService.setOffset(0);
      }
    }
  }

  private calcAndSetOffset() {
    if (this.trainrunDialogParameter.offset < 0) {
      this.trainrunSectionTimesService.setOffset(
        Math.ceil(Math.abs(this.trainrunDialogParameter.offset) / 60) * 60 -
          Math.abs(this.trainrunDialogParameter.offset),
      );
    } else {
      this.trainrunSectionTimesService.setOffset(this.trainrunDialogParameter.offset);
    }
  }

  private isRoundTrip() {
    return this.selectedTrainrunSection.getTrainrun().isRoundTrip();
  }
}
