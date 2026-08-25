import {Component, EventEmitter, Input, Output, ChangeDetectionStrategy} from "@angular/core";

@Component({
  selector: "sbb-language-selector",
  templateUrl: "./language-selector.component.html",
  styleUrls: ["./language-selector.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class LanguageSelectorComponent {
  @Input() currentLanguage!: string;

  // Additional CSS class(es) applied to the inner sbb-select, so callers can
  // style/position this component differently depending on where it's used
  // (e.g. inside the user menu vs. directly in the header for standalone mode).
  @Input() variantClass = "";

  @Output() readonly languageChange = new EventEmitter<string>();

  onSelectionChange(value: string): void {
    this.languageChange.emit(value);
  }
}
