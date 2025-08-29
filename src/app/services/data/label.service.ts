import {Injectable, OnDestroy, EventEmitter} from "@angular/core";
import {BehaviorSubject, Subject} from "rxjs";
import {LogService} from "../../logger/log.service";
import {LabelDto, LabelRef} from "../../data-structures/business.data.structures";
import {Label} from "../../models/label.model";
import {LabelGroupService} from "./labelgroup.service";
import {LabelOperation, Operation, OperationType} from "src/app/models/operation.model";

@Injectable({
  providedIn: "root",
})
export class LabelService implements OnDestroy {
  labelSubject = new BehaviorSubject<Label[]>([]);
  readonly labels = this.labelSubject.asObservable();
  private labelStore: {labels: Label[]} = {labels: []}; // store the data in memory

  readonly operation = new EventEmitter<Operation>();

  private destroyed = new Subject<void>();

  constructor(
    private logService: LogService,
    private labelGroupService: LabelGroupService,
  ) {
    labelGroupService.setLabelService(this);
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  updateLabel(labelId: number, newLabelValue: string) {
    const labelObject = this.getLabelFromId(labelId);
    if (labelObject !== undefined) {
      labelObject.setLabel(newLabelValue);
    }
    this.labelUpdated();
    this.operation.emit(new LabelOperation(OperationType.update, labelObject));
  }

  doUserDefinedLabelsOrdering(labelIds: number[]) {
    const removedLabels = this.labelStore.labels.filter((el: Label) =>
      labelIds.includes(el.getId()),
    );
    const others = this.labelStore.labels.filter((el: Label) => !labelIds.includes(el.getId()));
    labelIds.forEach((labelId) => {
      const labelObject = removedLabels.find((el: Label) => el.getId() === labelId);
      others.push(labelObject);
    });
    this.labelStore.labels = others;
  }

  getLabelFromLabelAndLabelRef(label: string, labelRef: LabelRef): Label {
    return this.labelStore.labels.find(
      (el: Label) => el.getLabelRef() === labelRef && el.getLabel() === label,
    );
  }

  getLabelFromId(labelId: number) {
    return this.labelStore.labels.find((el: Label) => el.getId() === labelId);
  }

  deleteLabel(labelId: number) {
    const labelObject = this.getLabelFromId(labelId);
    if (labelObject !== undefined) {
      const groupId = labelObject.getLabelGroupId();
      this.labelStore.labels = this.labelStore.labels.filter((el: Label) => el.getId() !== labelId);
      if (
        this.labelStore.labels.find((el: Label) => el.getLabelGroupId() === groupId) === undefined
      ) {
        this.labelGroupService.deleteLabelGroup(groupId);
      }
      this.labelUpdated();
    }
  }

  getOrCreateLabel(label: string, labelRef: LabelRef): Label {
    const retLabel = this.getLabelFromLabelAndLabelRef(label, labelRef);
    if (retLabel !== undefined) {
      return retLabel;
    }
    return this.createLabel(label, labelRef);
  }

  setLabelData(labelsDto: LabelDto[]) {
    this.labelStore.labels = labelsDto.map((labelDto) => new Label(labelDto));
    this.labelUpdated();
  }

  clearLabel(labelIds: number[], labelIDCounterMap: Map<number, number>): number[] {
    const deletetLabelIds: number[] = [];
    if (labelIds !== null && labelIds.length > 0) {
      labelIds.forEach((labelId) => {
        if (labelIDCounterMap.get(labelId) === 1) {
          deletetLabelIds.push(labelId);
          this.labelStore.labels = this.labelStore.labels.filter(
            (label) => label.getId() !== labelId,
          );
        }
      });
    }
    return deletetLabelIds;
  }

  getDtos() {
    return this.labelStore.labels.map((label) => label.getDto());
  }

  labelUpdated() {
    this.labelSubject.next(Object.assign({}, this.labelStore).labels);
  }

  getTextLabelsFromIds(labelIds: number[]): string[] {
    return this.labelStore.labels
      .filter((labelObj) => labelIds.includes(labelObj.getId()))
      .map((labelObj) => labelObj.getLabel());
  }

  getLabelsFromIds(labelIds: number[]): Label[] {
    return Object.assign({}, this.labelStore).labels.filter((labelObj) =>
      labelIds.includes(labelObj.getId()),
    );
  }

  getLabelsFromLabelRef(labelRef: LabelRef): Label[] {
    return Object.assign({}, this.labelStore).labels.filter(
      (labelObj) => labelObj.getLabelRef() === labelRef,
    );
  }

  getLabelsFromLabelGroupId(labelGroupId: number): Label[] {
    return Object.assign({}, this.labelStore).labels.filter(
      (labelObj) => labelObj.getLabelGroupId() === labelGroupId,
    );
  }

  private createLabel(label: string, labelRef: LabelRef): Label {
    const newLabel: Label = new Label();
    newLabel.setLabel(label);
    newLabel.setLabelRef(labelRef);
    newLabel.setLabelGroupId(this.labelGroupService.getDefaultLabelGroup(labelRef).getId());
    this.labelStore.labels.push(newLabel);
    this.labelUpdated();
    return newLabel;
  }
}
