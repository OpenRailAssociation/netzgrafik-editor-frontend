import {Component, Input, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {SbbDialog} from "@sbb-esta/angular/dialog";
import {CdkDragDrop, CdkDropList, CdkDropListGroup} from "@angular/cdk/drag-drop";
import {NodeService} from "../../../services/data/node.service";
import {TrainrunService} from "../../../services/data/trainrun.service";
import {LabelService} from "../../../services/data/label.service";
import {LabelGroupService} from "../../../services/data/labelgroup.service";
import {FilterService} from "../../../services/ui/filter.service";
import {LabelRef} from "../../../data-structures/business.data.structures";
import {LabelGroup} from "../../../models/labelGroup.model";
import {FilterableLabelDialogComponent} from "../../dialogs/filterable-labels-dialog/filterable-label-dialog.component";
import {Label} from "../../../models/label.model";
import {NoteService} from "../../../services/data/note.service";

@Component({
  selector: "sbb-label-drop-list-component",
  templateUrl: "./label-drop-list.component.html",
  styleUrls: ["./label-drop-list.component.scss"],
})
export class LabelDropListComponent implements OnInit, OnDestroy {
  @Input() componentLabelRef: string;

  @ViewChild(CdkDropListGroup) listGroup: CdkDropListGroup<CdkDropList>;
  @ViewChild(CdkDropList) placeholder: CdkDropList;

  public labelGroups: LabelGroup[];
  public target: CdkDropList;
  public targetIndex: number;
  public source: CdkDropList;
  public sourceIndex: number;
  private destroyed = new Subject<void>();

  constructor(
    private nodeService: NodeService,
    private trainrunService: TrainrunService,
    private noteService: NoteService,
    public labelService: LabelService,
    public labelGroupService: LabelGroupService,
    public filterService: FilterService,
    private readonly dialog: SbbDialog,
  ) {}

  ngOnInit(): void {
    this.labelGroups = this.labelGroupService.getLabelGroupsFromLabelRef(
      this.translateComponentLabelRef(),
    );

    this.labelGroupService.labelGroups.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.labelGroups = this.labelGroupService.getLabelGroupsFromLabelRef(
        this.translateComponentLabelRef(),
      );
    });

    this.labelService.labels.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.labelGroups = this.labelGroupService.getLabelGroupsFromLabelRef(
        this.translateComponentLabelRef(),
      );
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  translateComponentLabelRef(): LabelRef {
    if (this.componentLabelRef === "Trainrun") {
      return LabelRef.Trainrun;
    }
    if (this.componentLabelRef === "Note") {
      return LabelRef.Note;
    }
    return LabelRef.Node;
  }

  hasNoFilterableLabels(): boolean {
    return this.labelService.getLabelsFromLabelRef(this.translateComponentLabelRef()).length === 0;
  }

  onLabelClicked(labelId: number) {
    const labelObject = this.labelService.getLabelFromId(labelId);
    const callbackObject = {
      name: labelObject.getLabel(),
      dialogTitle:
        labelObject.getLabelRef() === LabelRef.Trainrun
          ? $localize`:@@app.view.editor-edit-tools-view-component.label-drop-list.trainruns:Trainruns`
          : labelObject.getLabelRef() === LabelRef.Note
            ? $localize`:@@app.view.editor-edit-tools-view-component.label-drop-list.notes:Notes`
            : $localize`:@@app.view.editor-edit-tools-view-component.label-drop-list.nodes:Nodes`,
      saveLabelCallback: (refLabel, updatedLabel) =>
        this.labelService.updateLabel(labelObject.getId(), updatedLabel),
      deleteLabelCallback: (refLabel) => {
        if (labelObject.getLabelRef() === LabelRef.Trainrun) {
          this.trainrunService.visibleTrainrunsDeleteLabel(refLabel);
        }
        if (labelObject.getLabelRef() === LabelRef.Note) {
          this.noteService.visibleNotesDeleteLabel(refLabel);
        }
        if (labelObject.getLabelRef() === LabelRef.Node) {
          this.nodeService.visibleNodesDeleteLabel(refLabel);
        }
      },
      transferLabelCallback: (refLabel) =>
        labelObject.getLabelRef() === LabelRef.Trainrun
          ? this.trainrunService.visibleTrainrunsSetLabel(refLabel)
          : labelObject.getLabelRef() === LabelRef.Note
            ? this.noteService.visibleNotesSetLabel(refLabel)
            : this.nodeService.visibleNodesSetLabel(refLabel),
    };
    FilterableLabelDialogComponent.open(this.dialog, callbackObject);
  }

  dropLabelElement(event: CdkDragDrop<Label[]>, labelId: number, grpId: number) {
    if (event.previousContainer === event.container) {
      return;
    } else {
      const movedLabelObject: Label = event.previousContainer.data[event.previousIndex];
      if (movedLabelObject.getLabelGroupId() !== grpId) {
        movedLabelObject.setLabelGroupId(grpId);
        this.labelService.labelUpdated();
        this.labelGroupService.labelGroupUpdated();
        return;
      }

      const labels = this.labelService.getLabelsFromLabelGroupId(grpId);
      const neighborLabel = event.container.data[0];
      if (neighborLabel === undefined) {
        movedLabelObject.setLabelGroupId(grpId);
        this.labelService.labelUpdated();
        return;
      }
      const labelIds = [];
      labels.forEach((el: Label) => {
        if (el.getId() !== movedLabelObject.getId()) {
          if (el.getId() === neighborLabel.getId()) {
            if (event.currentIndex === 0) {
              labelIds.push(movedLabelObject.getId());
              labelIds.push(el.getId());
            } else {
              labelIds.push(el.getId());
              labelIds.push(movedLabelObject.getId());
            }
          } else {
            labelIds.push(el.getId());
          }
        }
      });
      this.labelService.doUserDefinedLabelsOrdering(labelIds);
      this.labelService.labelUpdated();
      this.labelGroupService.labelGroupUpdated();
    }
  }

  onRemoveLabelGroup(labelGrpId: number) {
    this.labelGroupService.deleteLabelGroup(labelGrpId);
  }

  onCreateNewLabelGroup(labelGrpId: number) {
    const labelGroup = this.labelGroupService.getLabelGroup(labelGrpId);
    this.labelGroupService.createLabelGroup(labelGroup.getLabelRef());
  }

  isDefaultLabelGroup(labelGrpId: number) {
    const labelGroup = this.labelGroupService.getLabelGroup(labelGrpId);
    return (
      labelGrpId !== this.labelGroupService.getDefaultLabelGroup(labelGroup.getLabelRef()).getId()
    );
  }
}
