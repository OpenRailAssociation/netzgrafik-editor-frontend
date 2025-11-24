import {Component, OnDestroy, TemplateRef, ViewChild} from "@angular/core";
import {SbbDialog, SbbDialogConfig, SbbDialogPosition} from "@sbb-esta/angular/dialog";
import {Vec2D} from "../../../utils/vec2D";
import {Trainrun} from "../../../models/trainrun.model";
import {TrainrunService} from "../../../services/data/trainrun.service";
import {TrainrunSectionText} from "../../../data-structures/technical.data.structures";
import {TrainrunSectionService} from "../../../services/data/trainrunsection.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {GeneralViewFunctions} from "../../util/generalViewFunctions";
import {TrainrunsectionHelper} from "../../../services/util/trainrunsection.helper";
import {Node} from "../../../models/node.model";
import {Subject} from "rxjs";
import {takeUntil} from "rxjs/operators";
import {DataService} from "../../../services/data/data.service";
import {TrainrunFrequency} from "../../../data-structures/business.data.structures";

export enum TrainrunDialogType {
  TRAINRUN_DIALOG,
  TRAINRUN_SECTION_DIALOG,
  TRAINRUN_FILTERABLE_LABELS_DIALOG,
  TRAINRUN_ONEWAY_DIALOG,
}

export class TrainrunDialogParameter {
  public type: TrainrunDialogType;
  public position: Vec2D;
  public trainrunSectionText: TrainrunSectionText;
  public nodesOrdered: Node[];
  public offset: number;
  public forward: boolean;

  constructor(type: TrainrunDialogType, position: Vec2D) {
    this.type = type;
    this.position = position;
    this.nodesOrdered = [];
    this.offset = 0;
    this.forward = undefined;
  }

  setTrainrunSectionText(trainrunSectionText: TrainrunSectionText) {
    this.trainrunSectionText = trainrunSectionText;
  }

  setNodesOrdered(nodesOrdered: Node[]) {
    this.nodesOrdered = nodesOrdered;
  }

  setOffset(offset: number) {
    this.offset = offset;
  }

  setForward(forward: boolean) {
    this.forward = forward;
  }
}

@Component({
  selector: "sbb-trainrun-and-section-dialog",
  templateUrl: "./trainrun-and-section-dialog.component.html",
  styleUrls: ["./trainrun-and-section-dialog.component.scss"],
})
export class TrainrunAndSectionDialogComponent implements OnDestroy {
  @ViewChild("trainrunAndSectionEditorTabsViewTemplate", {static: true})
  trainrunAndSectionEditorTabsViewTemplate: TemplateRef<any>;

  public selectedTrainrun: Trainrun;
  public nextStopLeftNodeName: string;
  public nextStopRightNodeName: string;

  public data = null;

  private dialogRef = null;
  private dialogConfig = null;
  private dialogPos = null;
  private dialogMovementLastPosition: Vec2D = undefined;
  private trainrunSectionHelper: TrainrunsectionHelper;
  trainrunDialogParameter: TrainrunDialogParameter = undefined;

  private destroyed = new Subject<void>();

  constructor(
    public dialog: SbbDialog,
    private uiInteractionService: UiInteractionService,
    public trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private dataService: DataService,
  ) {
    this.trainrunService.trainruns.pipe(takeUntil(this.destroyed)).subscribe((trainrunList) => {
      if (!trainrunList.length) {
        this.closeDialog();
        return;
      }
    });

    this.uiInteractionService.trainrunDialog
      .pipe(takeUntil(this.destroyed))
      .subscribe((parameter) => {
        if (!parameter) {
          this.closeDialog();
          return;
        }

        this.data = parameter;
        const selectedTrainrunSection = this.trainrunSectionService.getSelectedTrainrunSection();
        this.selectedTrainrun = this.trainrunService.getSelectedTrainrun();
        this.trainrunSectionHelper = new TrainrunsectionHelper(this.trainrunService);

        const nextStopLeftNode = this.trainrunSectionHelper.getNextStopLeftNode(
          selectedTrainrunSection,
          parameter.nodesOrdered,
        );
        const nextStopRightNode = this.trainrunSectionHelper.getNextStopRightNode(
          selectedTrainrunSection,
          parameter.nodesOrdered,
        );

        this.nextStopLeftNodeName = nextStopLeftNode.getFullName();
        this.nextStopRightNodeName = nextStopRightNode.getFullName();
        this.openDialog(parameter);
      });
  }

  hasLongTrainrunName(): boolean {
    return true;

    const name =
      this.selectedTrainrun.getCategoryShortName() + " " + this.selectedTrainrun.getTitle();
    return name.length > 20;
  }

  static getDialogConfig(
    parameter: TrainrunDialogParameter,
    trainrunFrequency: TrainrunFrequency[],
  ): SbbDialogConfig {
    const width = 630;
    let height = 405;
    if (trainrunFrequency.length > 6) {
      height += 32;
    }
    const dialogConfig = new SbbDialogConfig();

    const xPosition = parameter.position.getX();
    const yPosition = parameter.position.getY();
    const topLeft = GeneralViewFunctions.calcDialogTopLeftScreenCoordinate(
      new Vec2D(xPosition, yPosition),
      new Vec2D(width, height),
    );
    dialogConfig.position = {
      top: topLeft.getY() + "px",
      left: topLeft.getX() + "px",
    };

    dialogConfig.width = width + "px";
    dialogConfig.minWidth = dialogConfig.width;
    dialogConfig.maxWidth = dialogConfig.width;
    dialogConfig.height = height + "px";
    dialogConfig.minHeight = dialogConfig.height;
    dialogConfig.maxHeight = dialogConfig.height;
    dialogConfig.panelClass = "";
    dialogConfig.id = "TrainrunTabViewDialogId";
    return dialogConfig;
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  openDialog(parameter: TrainrunDialogParameter) {
    this.trainrunDialogParameter = parameter;
    this.dialogConfig = TrainrunAndSectionDialogComponent.getDialogConfig(
      parameter,
      this.dataService.getTrainrunFrequencies(),
    );
    this.dialogRef = this.dialog.open(
      this.trainrunAndSectionEditorTabsViewTemplate,
      this.dialogConfig,
    );
    this.dialogPos = {
      bottom: parseInt(this.dialogConfig.position.top, 10) + parseInt(this.dialogConfig.height, 10),
      left: parseInt(this.dialogConfig.position.left, 10),
      right: parseInt(this.dialogConfig.position.left, 10) + parseInt(this.dialogConfig.width, 10),
      top: parseInt(this.dialogConfig.position.top, 10),
    };
  }

  onMouseUp(event: MouseEvent) {
    this.dialogMovementLastPosition = undefined;
  }

  onMouseDown(event: MouseEvent) {
    if (event.buttons === 1) {
      const eventTarget = event.target as HTMLElement;
      const clName = eventTarget.className.split(" ")[0];
      if (
        clName === "sbb-tab-labels" ||
        clName === "TrainrunTabGroup" ||
        clName === "moveButtonLayer0" ||
        clName === "moveButtonLayer1"
      ) {
        this.dialogMovementLastPosition = new Vec2D(event.screenX, event.screenY);
      }
    }
  }

  onMouseMove(event: MouseEvent) {
    if (event.buttons === 1) {
      if (this.dialogMovementLastPosition !== undefined) {
        const newLayer = new Vec2D(event.screenX, event.screenY);
        const movement = Vec2D.sub(newLayer, this.dialogMovementLastPosition);
        this.dialogMovementLastPosition = newLayer;
        this.dialogPos.top += movement.getY();
        this.dialogPos.bottom += movement.getY();
        this.dialogPos.left += movement.getX();
        this.dialogPos.right += movement.getX();
        this.dialogRef.updatePosition(this.convertDialogPos(this.dialogPos));
        event.preventDefault();
      }
    }
  }

  closeDialog() {
    if (this.dialogRef !== null) {
      this.dialogRef.close();
    }
  }

  private convertDialogPos(dialogPos: SbbDialogPosition): SbbDialogPosition {
    return {
      bottom: dialogPos.bottom + "px",
      left: dialogPos.left + "px",
      right: dialogPos.right + "px",
      top: dialogPos.top + "px",
    };
  }
}
