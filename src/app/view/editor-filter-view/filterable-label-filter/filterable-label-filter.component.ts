import {Component, Input, OnDestroy, OnInit} from "@angular/core";
import {FilterService} from "../../../services/ui/filter.service";
import {LabelRef} from "../../../data-structures/business.data.structures";
import {DataService} from "../../../services/data/data.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {LabelService} from "../../../services/data/label.service";
import {Label} from "../../../models/label.model";
import {takeUntil} from "rxjs/operators";
import {LabelGroupService} from "../../../services/data/labelgroup.service";
import {LabelGroup, LogicalFilterOperator} from "../../../models/labelGroup.model";
import {Subject} from "rxjs";
import {StaticDomTags} from "../../editor-main-view/data-views/static.dom.tags";

@Component({
  selector: "sbb-filterable-label-filter-view",
  templateUrl: "./filterable-label-filter.component.html",
  styleUrls: ["./filterable-label-filter.component.scss"],
})
export class FilterableLabelFilterComponent implements OnInit, OnDestroy {
  @Input() componentLabelRef: string;
  public filterableLabelGroups: LabelGroup[];
  private destroyed = new Subject<void>();

  constructor(
    public dataService: DataService,
    public uiInteractionService: UiInteractionService,
    public filterService: FilterService,
    public labelService: LabelService,
    public labelGroupService: LabelGroupService,
  ) {}

  ngOnInit(): void {
    this.labelGroupService.labelGroups.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.filterableLabelGroups = this.labelGroupService.getLabelGroupsFromLabelRef(
        this.translateComponentLabelRef(),
      );
    });

    this.labelService.labels.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.filterableLabelGroups = this.labelGroupService.getLabelGroupsFromLabelRef(
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

  getFilterLabels(): number[] {
    if (this.translateComponentLabelRef() === LabelRef.Node) {
      return this.filterService.getFilterNodeLabels();
    }
    if (this.translateComponentLabelRef() === LabelRef.Note) {
      return this.filterService.getFilterNoteLabels();
    }
    return this.filterService.getFilterTrainrunLabels();
  }

  onFilterableLabelChanged(labelObject: Label) {
    let filterLabels = this.getFilterLabels();
    if (filterLabels.find((filterLabel) => filterLabel === labelObject.getId()) !== undefined) {
      filterLabels = filterLabels.filter((filterLabel) => filterLabel !== labelObject.getId());
    } else {
      filterLabels.push(labelObject.getId());
    }
    if (this.translateComponentLabelRef() === LabelRef.Node) {
      this.filterService.setFilterNodeLabels(filterLabels);
    } else {
      if (this.translateComponentLabelRef() === LabelRef.Note) {
        this.filterService.setFilterNoteLabels(filterLabels);
      } else {
        this.filterService.setFilterTrainrunLabels(filterLabels);
      }
    }
  }

  isFilterFunctionOrEnabled(labelGroupObject: LabelGroup): boolean {
    return labelGroupObject.getLogicalFilterOperator() === LogicalFilterOperator.OR;
  }

  enableLogicalFilterOperatorAnd(labelGroupObject: LabelGroup) {
    labelGroupObject.enableLogicalFilterOperatorAnd();

    const filterLabels = this.getFilterLabels();
    const labelsObject = this.labelService.getLabelsFromLabelGroupId(labelGroupObject.getId());
    labelsObject.forEach((filterLabel: Label) => {
      if (!filterLabels.includes(filterLabel.getId())) {
        filterLabels.push(filterLabel.getId());
      }
    });
    if (this.translateComponentLabelRef() === LabelRef.Node) {
      this.filterService.setFilterNodeLabels(filterLabels);
    } else {
      if (this.translateComponentLabelRef() === LabelRef.Note) {
        this.filterService.setFilterNoteLabels(filterLabels);
      } else {
        this.filterService.setFilterTrainrunLabels(filterLabels);
      }
    }

    this.filterService.filterChanged();
  }

  enableLogicalFilterOperatorOr(labelGroupObject: LabelGroup) {
    labelGroupObject.enableLogicalFilterOperatorOr();

    let filterLabels = this.getFilterLabels();
    const labelsObject = this.labelService
      .getLabelsFromLabelGroupId(labelGroupObject.getId())
      .map((label: Label) => label.getId());
    filterLabels = filterLabels.filter((labelId: number) => !labelsObject.includes(labelId));
    if (this.translateComponentLabelRef() === LabelRef.Node) {
      this.filterService.setFilterNodeLabels(filterLabels);
    } else {
      this.filterService.setFilterTrainrunLabels(filterLabels);
    }

    this.filterService.filterChanged();
  }

  getLabelTooltip(labelObject: Label): string {
    const filterLabels = this.getFilterLabels();
    if (filterLabels.find((filterLabel) => filterLabel === labelObject.getId()) !== undefined) {
      return (
        labelObject.getLabel() +
        ": " +
        $localize`:@@app.view.editor-filter-view.filterable-label-filter.show:show`
      );
    }
    return (
      labelObject.getLabel() +
      ": " +
      $localize`:@@app.view.editor-filter-view.filterable-label-filter.hide:hide`
    );
  }

  isFilteringLabels(): boolean {
    if (this.translateComponentLabelRef() === LabelRef.Node) {
      return !this.filterService.isFilteringNodeLabels();
    }
    if (this.translateComponentLabelRef() === LabelRef.Note) {
      return !this.filterService.isFilteringNoteLabels();
    }
    return !this.filterService.isFilteringTrainrunLabels();
  }

  OnResetFilterableLabels() {
    this.labelGroupService
      .getLabelGroupsFromLabelRef(this.translateComponentLabelRef())
      .forEach((labelGrp: LabelGroup) => labelGrp.enableLogicalFilterOperatorOr());

    if (this.translateComponentLabelRef() === LabelRef.Node) {
      this.filterService.clearFilterNodeLabels();
    } else {
      if (this.translateComponentLabelRef() === LabelRef.Note) {
        this.filterService.clearFilterNoteLabels();
      } else {
        this.filterService.clearFilterTrainrunLabels();
      }
    }
  }

  getLabelClassname(labelObject: Label) {
    const tag = "TrainrunDialog FilterableLabel";
    const labels = this.getFilterLabels();
    if (labels.find((filterLabel) => filterLabel === labelObject.getId()) !== undefined) {
      return tag + " " + StaticDomTags.TAG_SELECTED;
    }
    return tag;
  }
}
