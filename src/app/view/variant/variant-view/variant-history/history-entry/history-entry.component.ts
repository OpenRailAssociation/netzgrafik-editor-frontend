import {Component, EventEmitter, Input, Output} from "@angular/core";

@Component({
  selector: "sbb-history-entry",
  templateUrl: "./history-entry.component.html",
  styleUrls: ["./history-entry.component.scss"],
  standalone: false,
})
export class HistoryEntryComponent {
  @Input() version?: string;
  @Input() actions?: HistoryEntryAction[];
  @Output() preview = new EventEmitter<boolean>();

  getAction(index: number): HistoryEntryAction | undefined {
    if (this.actions.length > index) {
      return this.actions[index];
    }
    return undefined;
  }
}

export interface HistoryEntryAction {
  name: string;
  onClick: () => void;
  icon?: string;
  disabled?: boolean;
}
