import {Component, Input, OnInit} from "@angular/core";
import {FormModel} from "../../../../utils/form-model";
import {Validators} from "@angular/forms";

@Component({
  selector: "sbb-filterable-label-form",
  templateUrl: "./filterable-label-form.component.html",
  styleUrls: ["./filterable-label-form.component.scss"],
})
export class FilterableLabelFormComponent implements OnInit {
  @Input() model!: FormModel<FilterableLabelsFormComponentModel>;

  ngOnInit(): void {
    this.model.registerValidator("name", Validators.required);
  }

  onKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      this.onUpdate();
    }
  }

  onUpdate() {
    const updateLabelCallback = this.model.getControl("updateLabelCallback").value;
    updateLabelCallback(this.model.getControl("name").value);
  }
}

export interface FilterableLabelsFormComponentModel {
  name: string;
  dialogTitle: string;
  saveLabelCallback;
  deleteLabelCallback;
  transferLabelCallback;
  updateLabelCallback?;
}
