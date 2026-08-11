import {Component, Input, ChangeDetectionStrategy} from "@angular/core";
import {Observable} from "rxjs";

@Component({
  selector: "sbb-action-menu",
  templateUrl: "./action-menu.component.html",
  styleUrls: ["./action-menu.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ActionMenuComponent {
  @Input() actions?: Observable<SlotAction[]>;

  onActionClicked(action: SlotAction): void {
    action.action();
  }
}

export interface SlotAction {
  name: string;
  icon?: string;
  action: () => void;
}
