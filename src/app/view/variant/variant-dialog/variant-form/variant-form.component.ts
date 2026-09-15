import {Component, Input, OnInit, ChangeDetectionStrategy} from "@angular/core";
import {CommonModule} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {SbbInputModule} from "@sbb-esta/angular/input";
import {SbbFormFieldModule} from "@sbb-esta/angular/form-field";
import {I18nModule} from "../../../../core/i18n/i18n.module";
import {FormModel} from "../../../../utils/form-model";
import {TranslatePipe} from "../../../../core/i18n/translate.pipe";
import {Validators} from "@angular/forms";

@Component({
  selector: "sbb-variant-form",
  templateUrl: "./variant-form.component.html",
  styleUrls: ["./variant-form.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    I18nModule,
    SbbInputModule,
    SbbFormFieldModule,
  ],
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
