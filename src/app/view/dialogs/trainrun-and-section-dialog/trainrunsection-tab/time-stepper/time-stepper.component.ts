import {Component, ElementRef, EventEmitter, Input, Output, ViewChild} from "@angular/core";

@Component({
  selector: "sbb-time-stepper",
  templateUrl: "./time-stepper.component.html",
  styleUrls: ["./time-stepper.component.scss"],
})
export class TimeStepperComponent {
  @Input() isDisplayed = true;
  @Input() containerClass: string;
  @Input() inputId: string;
  @Input() inputClass: string | string[];
  @Input() tabIndex: number;
  @Input() value: number;
  @Input() min: number = 0;

  @Output() valueChange = new EventEmitter<number>();
  @Output() changed = new EventEmitter<void>();
  @Output() decrement = new EventEmitter<void>();
  @Output() increment = new EventEmitter<void>();

  @ViewChild("inputElement") private inputElement: ElementRef<HTMLInputElement>;

  onValueChanged() {
    this.valueChange.emit(this.value);
    this.changed.emit();
  }

  focusAndSelectInput() {
    const nativeInput = this.inputElement?.nativeElement;
    if (nativeInput === undefined) {
      return;
    }
    setTimeout(() => {
      nativeInput.focus();
      nativeInput.select();
    }, 800);
  }
}
