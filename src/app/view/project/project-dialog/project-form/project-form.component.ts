import {Component, Input, OnInit} from "@angular/core";
import {UntypedFormControl, Validators} from "@angular/forms";
import {FormModel} from "../../../../utils/form-model";
import {COMMA, ENTER} from "@angular/cdk/keycodes";

@Component({
  selector: "sbb-project-form",
  templateUrl: "./project-form.component.html",
  styleUrls: ["./project-form.component.scss"],
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
  // email adresse validator: regex to match emails using the expression
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

export interface ProjectFormComponentModel {
  name: string;
  summary: string;
  description: string;
  writeUsers: string[];
  readUsers: string[];
}
