import {Component, EventEmitter, Input, Output} from "@angular/core";

@Component({
  selector: "sbb-toggle-switch-button",
  templateUrl: "./toggle-switch-button.component.html",
  styleUrls: ["./toggle-switch-button.component.scss"],
})
export class ToggleSwitchButtonComponent {
  @Output() checkedChanged = new EventEmitter<boolean>();
  @Input() checked = false;
  @Input() labelFalse: string = "";
  @Input() labelTrue: string = "";

  onToggle(check: boolean) {
    if (!this.labelTrue || !this.labelFalse) {
      this.onChange(!this.checked);
      return;
    }
    this.onChange(check);
  }

  onChange(isChecked: boolean) {
    if (this.checked !== isChecked) {
      this.checked = isChecked;
      this.checkedChanged.next(this.checked);
    }
  }

  createCheckboxClassTag(): string {
    if (!this.labelFalse) {
      return "only-one-label-true";
    }
    if (!this.labelTrue) {
      return "only-one-label-false";
    }
    return "";
  }

  createLabelCheckedTag(isTrueLabel: boolean): string {
    const base = "toggle-label";
    if (!this.labelTrue || !this.labelFalse) {
      return base;
    }
    return isTrueLabel === this.checked ? `${base} checked` : base;
  }
}
