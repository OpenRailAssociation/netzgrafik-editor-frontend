import {AfterViewInit, ChangeDetectorRef, Component, Input, OnDestroy, OnInit} from "@angular/core";
import {TrainrunSectionService} from "../../../../services/data/trainrunsection.service";
import {TrainrunService} from "../../../../services/data/trainrun.service";
import {TrainrunsectionHelper} from "../../../../services/util/trainrunsection.helper";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {Node} from "../../../../models/node.model";
import {Direction, LinePatternRefs} from "../../../../data-structures/business.data.structures";
import {StaticDomTags} from "../../../editor-main-view/data-views/static.dom.tags";
import {ColorRefType} from "../../../../data-structures/technical.data.structures";
import {
  TrainrunSectionTimesService,
  LeftAndRightTimeStructure,
} from "../../../../services/data/trainrun-section-times.service";

@Component({
  selector: "sbb-trainrunsection-card",
  templateUrl: "./trainrun-section-card.component.html",
  styleUrls: ["./trainrun-section-card.component.scss"],
  providers: [TrainrunSectionTimesService],
})
export class TrainrunSectionCardComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() innerContentScaleFactor = "1.0";

  public leftNode: Node;
  public rightNode: Node;
  public frequencyLinePattern: LinePatternRefs;
  public categoryColorRef: ColorRefType;
  public timeCategoryLinePattern: LinePatternRefs;
  public chosenCard: "top" | "bottom";

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

    this.leftNode = this.trainrunService.getLeftOrTopNodeWithTrainrunId(
      trainrunSection.getTrainrunId(),
    );
    this.rightNode = this.trainrunService.getRightOrBottomNodeWithTrainrunId(
      trainrunSection.getTrainrunId(),
    );

    this.trainrunSectionTimesService.setOffset(0);
    if (selectedTrainrun.isRoundTrip()) {
      // Initialize round trip trainrun with top card
      this.onTrainrunSectionCardClick("top");
    } else {
      this.chosenCard = this.trainrunService.isTrainrunTargetRightOrBottom() ? "top" : "bottom";
    }

    this.trainrunSectionTimesService.setTrainrunSection(trainrunSection);
    this.frequencyLinePattern = trainrunSection.getFrequencyLinePatternRef();
    this.categoryColorRef = selectedTrainrun.getCategoryColorRef();
    this.timeCategoryLinePattern = selectedTrainrun.getTimeCategoryLinePatternRef();
    this.trainrunSectionTimesService.setHighlightTravelTimeElement(false);
    this.trainrunSectionTimesService.applyOffsetAndTransformTimeStructure();
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  ngAfterViewInit(): void {
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

    let trainrunSection = this.trainrunService.getFirstTrainrunSection(selectedTrainrun);
    if (selectedTrainrun.isRoundTrip()) {
      // For a round trip trainrun, we want to choose the most top/left
      // section as reference when switching to a one-way trainrun
      trainrunSection = this.trainrunService.getLeftOrTopExtremitySection();
    }

    if (this.leftNode === this.rightNode) {
      // Cyclic trainrun
      // This ensures the two cards represent different directions
      this.trainrunSectionService.invertTrainrunSectionsSourceAndTarget(
        trainrunSection.getTrainrunId(),
      );
    } else {
      // Non-cyclic trainrun
      const referenceNode = position === "top" ? this.leftNode : this.rightNode;
      if (referenceNode !== trainrunSection.getSourceNode()) {
        this.trainrunSectionService.invertTrainrunSectionsSourceAndTarget(
          trainrunSection.getTrainrunId(),
        );
      }
    }

    this.chosenCard = position;
    this.trainrunService.updateDirection(selectedTrainrun, Direction.ONE_WAY);
  }

  getTrainrunTimeStructure(): Omit<LeftAndRightTimeStructure, "travelTime" | "stopTime"> {
    const selectedTrainrun = this.trainrunService.getSelectedTrainrun();
    if (!selectedTrainrun) {
      return undefined;
    }
    const selectedTrainrunId = selectedTrainrun.getId();
    const trainrunSections =
      this.trainrunSectionService.getAllTrainrunSectionsForTrainrun(selectedTrainrunId);
    const [startNode, endNode] = [
      this.trainrunService.getLeftOrTopNodeWithTrainrunId(selectedTrainrunId),
      this.trainrunService.getRightOrBottomNodeWithTrainrunId(selectedTrainrunId),
    ];

    // Try to find startNode → endNode
    let firstTrainrunSection = trainrunSections.find(
      (ts) => ts.getSourceNodeId() === startNode.getId(),
    );
    let lastTrainrunSection = [...trainrunSections]
      .reverse()
      .find((ts) => ts.getTargetNodeId() === endNode.getId());

    // If not found, swap first and last sections (and source and target nodes)
    if (!firstTrainrunSection && !lastTrainrunSection) {
      firstTrainrunSection = trainrunSections.find(
        (ts) => ts.getSourceNodeId() === endNode.getId(),
      );
      lastTrainrunSection = [...trainrunSections]
        .reverse()
        .find((ts) => ts.getTargetNodeId() === startNode.getId());
      [firstTrainrunSection, lastTrainrunSection] = [lastTrainrunSection, firstTrainrunSection];
      return {
        leftDepartureTime: firstTrainrunSection.getTargetDeparture(),
        leftArrivalTime: firstTrainrunSection.getTargetArrival(),
        rightDepartureTime: lastTrainrunSection.getSourceDeparture(),
        rightArrivalTime: lastTrainrunSection.getSourceArrival(),
      };
    }

    return {
      leftDepartureTime: firstTrainrunSection.getSourceDeparture(),
      leftArrivalTime: firstTrainrunSection.getSourceArrival(),
      rightDepartureTime: lastTrainrunSection.getTargetDeparture(),
      rightArrivalTime: lastTrainrunSection.getTargetArrival(),
    };
  }
}
