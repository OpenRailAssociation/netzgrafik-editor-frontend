import {Component, Input, OnInit, ChangeDetectionStrategy} from "@angular/core";
import {FormModel} from "../../../../utils/form-model";
import {Validators} from "@angular/forms";

@Component({
  selector: "sbb-variant-form",
  templateUrl: "./variant-form.component.html",
  styleUrls: ["./variant-form.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class VariantFormComponent implements OnInit {
  @Input() model!: FormModel<VariantFormComponentModel>;

  ngOnInit(): void {
    this.model.registerValidator("name", Validators.required);
  }
}

export type VariantFormComponentModel = {
  name: string;
};
