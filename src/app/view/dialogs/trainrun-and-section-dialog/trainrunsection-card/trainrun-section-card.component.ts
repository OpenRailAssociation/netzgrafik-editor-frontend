import {AfterViewInit, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from "@angular/core";
import {TrainrunSectionService} from "../../../../services/data/trainrunsection.service";
import {TrainrunService} from "../../../../services/data/trainrun.service";
import {TrainrunDialogParameter} from "../trainrun-and-section-dialog.component";
import {TrainrunsectionHelper} from "../../../../services/util/trainrunsection.helper";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {Node} from "../../../../models/node.model";
import {Direction, LinePatternRefs} from "../../../../data-structures/business.data.structures";
import {StaticDomTags} from "../../../editor-main-view/data-views/static.dom.tags";
import {ColorRefType} from "../../../../data-structures/technical.data.structures";
import {TrainrunSectionTimesService} from "../../../../services/data/trainrun-section-times.service";
import {LeftAndRightTimeStructure} from "../trainrunsection-tab/trainrun-section-tab.component";
import {GeneralViewFunctions} from "../../../util/generalViewFunctions";

@Component({
  selector: "sbb-trainrunsection-card",
  templateUrl: "./trainrun-section-card.component.html",
  styleUrls: ["./trainrun-section-card.component.scss"],
  providers: [TrainrunSectionTimesService],
})
export class TrainrunSectionCardComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() trainrunDialogParameter: TrainrunDialogParameter;
  @Input() innerContentScaleFactor = "1.0";

  public startNode: string[] = ["", ""];
  public endNode: string[] = ["", ""];
  public frequencyLinePattern: LinePatternRefs;
  public categoryColorRef: ColorRefType;
  public timeCategoryLinePattern: LinePatternRefs;
  public chosenCard: "top" | "bottom";

  private trainrunSectionHelper: TrainrunsectionHelper;
  private destroyed = new Subject<void>();

  public get nodesOrdered(): Node[] {
    return this.trainrunSectionTimesService.getNodesOrdered();
  }

  constructor(
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private changeDetection: ChangeDetectorRef,
    public trainrunSectionTimesService: TrainrunSectionTimesService,
  ) {
    this.trainrunSectionHelper = new TrainrunsectionHelper(this.trainrunService);

    this.trainrunSectionTimesService.setOffset(0);
    this.trainrunService.trainruns.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.updateAllValues();
    });
    this.trainrunSectionService.trainrunSections.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.updateAllValues();
    });
  }

  ngOnInit() {
    this.updateAllValues();
  }

  updateAllValues() {
    const selectedTrainrun = this.trainrunService.getSelectedTrainrun();
    if (!selectedTrainrun) {
      return;
    }
    const trainrunSection = this.trainrunService.getFirstTrainrunSection(selectedTrainrun);

    this.trainrunSectionTimesService.setOffset(0);

    // Initialize the selected trainrun as one-way, selecting the [source] → [target] card
    if (selectedTrainrun.isRoundTrip()) {
      if (TrainrunsectionHelper.isTargetRightOrBottom(trainrunSection)) {
        this.onTrainrunSectionCardClick("top");
      } else {
        this.onTrainrunSectionCardClick("bottom");
      }
    }

    this.trainrunSectionTimesService.setTrainrunSection(trainrunSection);
    this.frequencyLinePattern = trainrunSection.getFrequencyLinePatternRef();
    this.categoryColorRef = selectedTrainrun.getCategoryColorRef();
    this.timeCategoryLinePattern = selectedTrainrun.getTimeCategoryLinePatternRef();
    this.trainrunSectionTimesService.setHighlightTravelTimeElement(false);
    this.trainrunSectionTimesService.setHighlightBottomTravelTimeElement(false);
    this.trainrunSectionTimesService.applyOffsetAndTransformTimeStructure();

    const startNode = this.trainrunService.getStartNodeWithTrainrunId(
      trainrunSection.getTrainrunId(),
    );
    this.startNode = [startNode.getFullName(), startNode.getBetriebspunktName()];
    const endNode = this.trainrunService.getEndNodeWithTrainrunId(trainrunSection.getTrainrunId());
    this.endNode = [endNode.getFullName(), endNode.getBetriebspunktName()];

    if (!selectedTrainrun.isRoundTrip()) {
      this.chosenCard = TrainrunsectionHelper.isTargetRightOrBottom(trainrunSection)
        ? "top"
        : "bottom";
    }
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  ngAfterViewInit(): void {
    if (
      this.trainrunDialogParameter !== undefined &&
      this.trainrunDialogParameter.nodesOrdered.length > 0
    ) {
      this.trainrunSectionTimesService.setNodesOrdered(this.trainrunDialogParameter.nodesOrdered);
    }

    this.updateAllValues();
    this.changeDetection.detectChanges();
  }

  getInnerContentStyleTag(): string {
    return "transform: scale(" + this.innerContentScaleFactor + ");";
  }

  getEdgeLineClassAttrString(layer: number, cardPosition: string) {
    return (
      StaticDomTags.EDGE_LINE_CLASS +
      StaticDomTags.makeClassTag(StaticDomTags.LINE_LAYER, "" + layer) +
      StaticDomTags.makeClassTag(StaticDomTags.FREQ_LINE_PATTERN, this.frequencyLinePattern) +
      " " +
      StaticDomTags.TAG_UI_DIALOG +
      " " +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_COLOR_REF, this.getColorRefTag(cardPosition)) +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_LINEPATTERN_REF, this.timeCategoryLinePattern)
    );
  }

  getColorRefTag(cardPosition: string) {
    return (
      this.categoryColorRef +
      " " +
      (this.chosenCard === cardPosition
        ? StaticDomTags.TAG_FOCUS
        : this.chosenCard === null
          ? ""
          : StaticDomTags.TAG_MUTED)
    );
  }

  getOneWayCardBetriebspunktClassTag(cardPosition: string) {
    return "OneWayCardBetriebspunkt " + this.getColorRefTag(cardPosition);
  }

  getEdgeLineTextClass(cardPosition: string) {
    return (
      StaticDomTags.EDGE_LINE_TEXT_CLASS +
      " " +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_COLOR_REF, this.getColorRefTag(cardPosition))
    );
  }

  getEdgeLineArrowClass(cardPosition: string) {
    return (
      StaticDomTags.EDGE_LINE_ARROW_CLASS +
      " " +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_COLOR_REF, this.getColorRefTag(cardPosition))
    );
  }

  onTrainrunSectionCardClick(position: "top" | "bottom") {
    if (this.chosenCard === position) {
      return;
    }

    const selectedTrainrun = this.trainrunService.getSelectedTrainrun();
    if (!selectedTrainrun) {
      return;
    }

    let trainrunSection = undefined;
    let wantedSourceNode = undefined;
    if (selectedTrainrun.isRoundTrip()) {
      const bothEndNodes = this.trainrunService.getBothEndNodesWithTrainrunId(
        selectedTrainrun.getId(),
      );
      // direction top-left -> default
      wantedSourceNode = GeneralViewFunctions.getLeftOrTopNode(
        bothEndNodes.endNode1,
        bothEndNodes.endNode2,
      );
      trainrunSection = wantedSourceNode.getStartTrainrunSection(selectedTrainrun.getId());
    } else {
      trainrunSection = this.trainrunService.getFirstTrainrunSection(selectedTrainrun);
      // Get the left and right nodes to determine the cards order
      const leftNode = this.trainrunSectionHelper.getNextStopLeftNode(
        trainrunSection,
        this.nodesOrdered,
      );
      const rightNode = this.trainrunSectionHelper.getNextStopRightNode(
        trainrunSection,
        this.nodesOrdered,
      );
      wantedSourceNode = position === "top" ? leftNode : rightNode;
    }

    if (wantedSourceNode !== trainrunSection.getSourceNode()) {
      this.trainrunSectionService.invertTrainrunSectionsSourceAndTarget(
        trainrunSection.getTrainrunId(),
      );
    }
    this.chosenCard = position;
    this.trainrunService.updateDirection(selectedTrainrun, Direction.ONE_WAY);
  }
}
