import {Component, Input, OnInit, ChangeDetectionStrategy} from "@angular/core";
import {CommonModule} from "@angular/common";
import {UntypedFormControl, Validators, FormsModule, ReactiveFormsModule} from "@angular/forms";
import {COMMA, ENTER} from "@angular/cdk/keycodes";
import {SbbChipsModule} from "@sbb-esta/angular/chips";
import {SbbFormFieldModule} from "@sbb-esta/angular/form-field";
import {SbbInputModule} from "@sbb-esta/angular/input";
import {SbbTextareaModule} from "@sbb-esta/angular/textarea";
import {SbbTooltipModule} from "@sbb-esta/angular/tooltip";
import {FormModel} from "../../../../utils/form-model";
import {I18nModule} from "../../../../core/i18n/i18n.module";

@Component({
  selector: "sbb-project-form",
  templateUrl: "./project-form.component.html",
  styleUrls: ["./project-form.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    CommonModule,
    I18nModule,
    FormsModule,
    ReactiveFormsModule,
    SbbChipsModule,
    SbbFormFieldModule,
    SbbInputModule,
    SbbTextareaModule,
    SbbTooltipModule,
  ],
})
export class ProjectFormComponent implements OnInit {
  @Input() model!: FormModel<ProjectFormComponentModel>;

  readonly separatorKeysCodes = [ENTER, COMMA];

  ngOnInit(): void {
    this.model.registerValidator("name", Validators.required);
    this.model.registerValidator("writeUsers", userIdsAsEmailValidator);
    this.model.registerValidator("readUsers", userIdsAsEmailValidator);
  }

  onLabelsFocusoutWrite() {
    const keyboardEvent = new KeyboardEvent("keydown", {
      code: "Enter",
      key: "Enter",
      charCode: 13,
      keyCode: 13,
      view: window,
      bubbles: true,
    });
    document.getElementById("userWriteInput").dispatchEvent(keyboardEvent);
  }

  onLabelsFocusoutRead() {
    const keyboardEvent = new KeyboardEvent("keydown", {
      code: "Enter",
      key: "Enter",
      charCode: 13,
      keyCode: 13,
      view: window,
      bubbles: true,
    });
    document.getElementById("userReadeInput").dispatchEvent(keyboardEvent);
  }
}

export const userIdsAsEmailValidator = (control: UntypedFormControl) => {
  if (!control) {
    return null;
  }
  const userIds: string[] = control.value;
  // email address validator: regex to match emails using the expression
  const invalidEmailPattern = userIds.filter((id) => {
    const retVal = id.match(
      /^([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)|(u|ue|e)\d+$/,
    );
    if (retVal === null) {
      return true;
    }
    return retVal[0] !== id;
  });

  if (invalidEmailPattern.length === 0) {
    return null;
  }
  return {invalidUserIdAsEmails: invalidEmailPattern.join(", ")};
};

export type ProjectFormComponentModel = {
  name: string;
  summary: string;
  description: string;
  writeUsers: string[];
  readUsers: string[];
};
