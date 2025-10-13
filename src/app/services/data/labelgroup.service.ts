import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Subject} from "rxjs";
import {LogService} from "../../logger/log.service";
import {LabelGroupDto, LabelRef} from "../../data-structures/business.data.structures";
import {LabelGroup} from "../../models/labelGroup.model";
import {LabelService} from "./label.service";
import {Label} from "../../models/label.model";

@Injectable({
  providedIn: "root",
})
export class LabelGroupService implements OnDestroy {
  labelGroupSubject = new BehaviorSubject<LabelGroup[]>([]);
  readonly labelGroups = this.labelGroupSubject.asObservable();
  private labelGroupStore: {labelGroups: LabelGroup[]} = {labelGroups: []}; // store the data in memory
  private destroyed = new Subject<void>();
  private labelService: LabelService = null;

  constructor(private logService: LogService) {}

  setLabelService(labelService: LabelService) {
    this.labelService = labelService;
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  setLabelGroupData(LabelGroupsDto: LabelGroupDto[]) {
    this.labelGroupStore.labelGroups = LabelGroupsDto.map(
      (labelGroupDto) => new LabelGroup(labelGroupDto),
    );
  }

  createLabelGroup(labelRef: LabelRef): LabelGroup {
    const retGroup = new LabelGroup();
    retGroup.setLabelRef(labelRef);
    this.labelGroupStore.labelGroups.push(retGroup);
    this.labelGroupUpdated();
    return retGroup;
  }

  labelGroupUpdated() {
    this.labelGroupSubject.next(Object.assign({}, this.labelGroupStore).labelGroups);
  }

  getLabelGroup(labelGroupId: number): LabelGroup {
    return this.labelGroupStore.labelGroups.find((grp: LabelGroup) => grp.getId() === labelGroupId);
  }

  getLabelGroupsFromLabelRef(labelRef: LabelRef): LabelGroup[] {
    return Object.assign({}, this.labelGroupStore).labelGroups.filter(
      (grp: LabelGroup) => grp.getLabelRef() === labelRef,
    );
  }

  getAutoCompleteLabels(objectLabels: string[], labelRef: LabelRef): string[] {
    const retLabels: string[] = [];
    this.getLabelGroupsFromLabelRef(labelRef).forEach((grp: LabelGroup) => {
      this.labelService.getLabelsFromLabelGroupId(grp.getId()).forEach((el: Label) => {
        if (objectLabels.find((s) => s === el.getLabel()) === undefined) {
          retLabels.push(el.getLabel());
        }
      });
    });
    return retLabels;
  }

  getDtos() {
    return this.labelGroupStore.labelGroups.map((labelGroup) => labelGroup.getDto());
  }

  isDefaultGroup(labelGroupId: number): boolean {
    if (this.labelGroupStore.labelGroups.length === 0) {
      return false;
    }
    const labelGroupObject = this.getLabelGroup(labelGroupId);
    if (labelGroupObject === undefined) {
      return false;
    }
    const firstElement = this.labelGroupStore.labelGroups.find(
      (grp) => grp.getLabelRef() === labelGroupObject.getLabelRef(),
    );
    return firstElement.getId() === labelGroupId;
  }

  getDefaultLabelGroup(labelRef: LabelRef): LabelGroup {
    let retGroup = this.labelGroupStore.labelGroups.find(
      (grp: LabelGroup) => grp.getLabelRef() === labelRef,
    );
    if (retGroup === undefined) {
      retGroup = new LabelGroup();
      retGroup.setLabelRef(labelRef);
      this.labelGroupStore.labelGroups.push(retGroup);
      this.labelGroupUpdated();
    }
    return retGroup;
  }

  deleteLabelGroup(labelGroupId: number) {
    if (this.isDefaultGroup(labelGroupId)) {
      return;
    }
    const labelGroupObject = this.getLabelGroup(labelGroupId);
    if (labelGroupObject === undefined) {
      return;
    }
    const defaultGrp = this.getDefaultLabelGroup(labelGroupObject.getLabelRef());
    this.labelService
      .getLabelsFromLabelGroupId(labelGroupId)
      .forEach((labelObject) => labelObject.setLabelGroupId(defaultGrp.getId()));
    this.labelGroupStore.labelGroups = this.labelGroupStore.labelGroups.filter(
      (grp: LabelGroup) => grp.getId() !== labelGroupId,
    );
    this.labelGroupUpdated();
  }
}
