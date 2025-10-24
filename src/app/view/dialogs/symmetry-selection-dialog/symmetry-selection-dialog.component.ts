import {Component, OnDestroy, TemplateRef, ViewChild} from "@angular/core";
import {SbbDialog, SbbDialogConfig} from "@sbb-esta/angular/dialog";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {Observable, Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {StaticDomTags} from "../../editor-main-view/data-views/static.dom.tags";
import {ColorRefType} from "src/app/data-structures/technical.data.structures";
import {TrainrunSection} from "src/app/models/trainrunsection.model";
import {TrainrunSectionService} from "src/app/services/data/trainrunsection.service";
import {LinePatternRefs} from "src/app/data-structures/business.data.structures";
import {TrainrunsectionHelper} from "../../../services/util/trainrunsection.helper";
import {Node} from "src/app/models/node.model";
import {
  TrainrunSectionTimesService,
  LeftAndRightTimeStructure,
} from "src/app/services/data/trainrun-section-times.service";
import {TrainrunService} from "src/app/services/data/trainrun.service";
import {GeneralViewFunctions} from "../../util/generalViewFunctions";
import {SymmetryReference, SymmetryOn} from "src/app/services/util/symmetry-toggle.service";

export class SymmetrySelectionDialogParameter {
  private trainrunSection: TrainrunSection;
  public readonly symmetryOn: SymmetryOn;
  public readonly topSymmetryTimeStructure: LeftAndRightTimeStructure;
  public readonly bottomSymmetryTimeStructure: LeftAndRightTimeStructure;
  public readonly startNode: string[];
  public readonly endNode: string[];
  public readonly subject: Subject<SymmetryReference | null>;
  public dialogFeedback: Observable<SymmetryReference | null>;

  constructor(
    symmetryOn: SymmetryOn,
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    public trainrunSectionTimesService: TrainrunSectionTimesService,
  ) {
    this.trainrunSection = this.trainrunSectionService.getSelectedTrainrunSection();
    if (this.trainrunSection === null) {
      return;
    }
    this.trainrunSectionTimesService.setTrainrunSection(this.trainrunSection);

    // Calculate both symmetry alternatives for card preview
    this.topSymmetryTimeStructure =
      this.trainrunSectionTimesService.calculateTimeStructureAfterSymmetrySelection(
        symmetryOn,
        SymmetryReference.Top,
      );
    this.bottomSymmetryTimeStructure =
      this.trainrunSectionTimesService.calculateTimeStructureAfterSymmetrySelection(
        symmetryOn,
        SymmetryReference.Bottom,
      );

    // Determine start and end nodes based on symmetryOn
    let nodes: {startNode: Node; endNode: Node};
    if (symmetryOn === SymmetryOn.Trainrun) {
      const bothEndNodes = this.trainrunService.getBothEndNodesWithTrainrunId(
        this.trainrunSection.getTrainrunId(),
      );
      nodes = {
        startNode: GeneralViewFunctions.getLeftOrTopNode(
          bothEndNodes.endNode1,
          bothEndNodes.endNode2,
        ),
        endNode: GeneralViewFunctions.getRightOrBottomNode(
          bothEndNodes.endNode1,
          bothEndNodes.endNode2,
        ),
      };
    } else {
      nodes = this.getNodesFromTrainrunSection(this.trainrunSection);
    }

    this.startNode = [nodes.startNode.getFullName(), nodes.startNode.getBetriebspunktName()];
    this.endNode = [nodes.endNode.getFullName(), nodes.endNode.getBetriebspunktName()];

    const dialogFeedbackSubject = new Subject<SymmetryReference | null>();
    const dialogFeedback = dialogFeedbackSubject.asObservable();
    this.subject = dialogFeedbackSubject;
    this.dialogFeedback = dialogFeedback;
  }

  private getNodesFromTrainrunSection(trainrunSection: TrainrunSection): {
    startNode: Node;
    endNode: Node;
  } {
    // TODO: peut-être réutiliser de la logique de TrainrunSectionService
    if (TrainrunsectionHelper.isTargetRightOrBottom(trainrunSection)) {
      return {
        startNode: trainrunSection.getSourceNode(),
        endNode: trainrunSection.getTargetNode(),
      };
    } else {
      return {
        startNode: trainrunSection.getTargetNode(),
        endNode: trainrunSection.getSourceNode(),
      };
    }
  }
}

@Component({
  selector: "sbb-symmetry-selection-dialog",
  templateUrl: "./symmetry-selection-dialog.component.html",
  styleUrls: ["./symmetry-selection-dialog.component.scss"],
})
export class SymmetrySelectionDialogComponent implements OnDestroy {
  @ViewChild("symmetrySelectionDialogTemplate", {static: true})
  symmetrySelectionDialogTemplate: TemplateRef<any>;

  public selectedTrainrunSection: TrainrunSection;
  public timeStructure: LeftAndRightTimeStructure;
  public topSymmetryTimeStructure: LeftAndRightTimeStructure;
  public bottomSymmetryTimeStructure: LeftAndRightTimeStructure;
  public startNode: string[] = ["", ""];
  public endNode: string[] = ["", ""];
  public selectedSymmetryReference: SymmetryReference | null = null;
  public frequencyLinePattern: LinePatternRefs;
  public categoryColorRef: ColorRefType;
  public timeCategoryLinePattern: LinePatternRefs;
  public readonly SymmetryReference = SymmetryReference;

  private destroyed = new Subject<void>();

  constructor(
    public dialog: SbbDialog,
    private uiInteractionService: UiInteractionService,
    private trainrunSectionService: TrainrunSectionService,
  ) {
    this.trainrunSectionService.trainrunSections
      .pipe(takeUntil(this.destroyed))
      .subscribe(() => {});

    this.uiInteractionService.symmetrySelectionDialog
      .pipe(takeUntil(this.destroyed))
      .subscribe((parameter: SymmetrySelectionDialogParameter) => {
        this.selectedTrainrunSection = this.trainrunSectionService.getSelectedTrainrunSection();
        if (this.selectedTrainrunSection === null) {
          return;
        }

        const selectedTrainrun = this.selectedTrainrunSection.getTrainrun();
        this.frequencyLinePattern = this.selectedTrainrunSection.getFrequencyLinePatternRef();
        this.categoryColorRef = selectedTrainrun.getCategoryColorRef();
        this.timeCategoryLinePattern = selectedTrainrun.getTimeCategoryLinePatternRef();
        this.startNode = parameter.startNode;
        this.endNode = parameter.endNode;
        this.selectedSymmetryReference = null;
        this.topSymmetryTimeStructure = parameter.topSymmetryTimeStructure;
        this.bottomSymmetryTimeStructure = parameter.bottomSymmetryTimeStructure;

        this.openDialog(parameter);
      });
  }

  static getDialogConfig() {
    const dialogConfig = new SbbDialogConfig();
    const width = 500;
    dialogConfig.width = width + "px";
    dialogConfig.panelClass = "symmetry-selection-dialog";
    return dialogConfig;
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  onCardSelection(reference: SymmetryReference) {
    this.selectedSymmetryReference = reference;
  }

  isConfirmButtonDisabled() {
    return !Object.values(SymmetryReference).includes(this.selectedSymmetryReference);
  }

  onConfirm() {
    this.dialog.openDialogs[this.dialog.openDialogs.length - 1].close(
      this.selectedSymmetryReference,
    );
  }

  onCancel() {
    this.dialog.openDialogs[this.dialog.openDialogs.length - 1].close(null);
  }

  openDialog(parameter: SymmetrySelectionDialogParameter) {
    const dialogConfig = SymmetrySelectionDialogComponent.getDialogConfig();
    const dialogRef = this.dialog.open(this.symmetrySelectionDialogTemplate, dialogConfig);
    dialogRef.afterClosed().subscribe((reference: SymmetryReference | null) => {
      parameter.subject.next(reference);
    });
  }

  getEdgeLineClassAttrString(layer: number, symmetryCard: SymmetryReference) {
    return (
      StaticDomTags.EDGE_LINE_CLASS +
      StaticDomTags.makeClassTag(StaticDomTags.LINE_LAYER, "" + layer) +
      StaticDomTags.makeClassTag(StaticDomTags.FREQ_LINE_PATTERN, this.frequencyLinePattern) +
      " " +
      StaticDomTags.TAG_UI_DIALOG +
      " " +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_COLOR_REF, this.getColorRefTag(symmetryCard)) +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_LINEPATTERN_REF, this.timeCategoryLinePattern)
    );
  }

  getColorRefTag(symmetryCard: SymmetryReference) {
    const colorRefTag =
      symmetryCard === this.selectedSymmetryReference ? this.categoryColorRef : "NORMAL";
    return colorRefTag;
  }

  getEdgeLineTextClass(symmetryCard: SymmetryReference) {
    return (
      StaticDomTags.EDGE_LINE_TEXT_CLASS +
      " " +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_COLOR_REF, this.getColorRefTag(symmetryCard))
    );
  }

  getEdgeLineArrowClass(symmetryCard: SymmetryReference) {
    return (
      StaticDomTags.EDGE_LINE_ARROW_CLASS +
      " " +
      StaticDomTags.makeClassTag(StaticDomTags.TAG_COLOR_REF, this.getColorRefTag(symmetryCard))
    );
  }
}
