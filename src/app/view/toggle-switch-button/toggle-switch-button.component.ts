import {Component, EventEmitter, Input, Output} from "@angular/core";

@Component({
  selector: "sbb-toggle-switch-button",
  templateUrl: "./toggle-switch-button.component.html",
  styleUrls: ["./toggle-switch-button.component.scss"],
})
export class ToggleSwitchButtonComponent {
  @Output() checkedChanged = new EventEmitter<boolean>();
  @Input() checked = false;
  @Input() labelFalse = "";
  @Input() labelTrue = "";
  @Input() tagNonDefault = false;
  @Input() disabled = false;

  onToggle(check: boolean): void {
    if (!this.labelTrue || !this.labelFalse) {
      this.onChange(!this.checked);
      return;
    }
    this.onChange(check);
  }

  onChange(isChecked: boolean): void {
    if (this.checked !== isChecked) {
      this.checked = isChecked;
      this.checkedChanged.next(this.checked);
    }
  }

  createCheckboxClassTag(): string {
    return (
      (!this.tagNonDefault ? "" : "non-default") +
      " " +
      (this.labelFalse ? "" : "only-one-label-true") +
      " " +
      (this.labelTrue ? "" : "only-one-label-false")
    );
  }

  createLabelCheckedTag(isTrueLabel: boolean): string {
    const base = "toggle-label" + (!this.tagNonDefault ? "" : " non-default");
    if (!this.labelTrue || !this.labelFalse) {
      return base;
    }
    return isTrueLabel === this.checked ? `${base} checked` : base;
  }
}
