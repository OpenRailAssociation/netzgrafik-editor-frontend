import {Component, Input, ChangeDetectionStrategy} from "@angular/core";
import {SlotAction} from "../../action-menu/action-menu/action-menu.component";
import {Observable} from "rxjs";

@Component({
  selector: "sbb-slot",
  templateUrl: "./slot.component.html",
  styleUrls: ["./slot.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class SlotComponent {
  @Input() title?: string;
  @Input() actions?: Observable<SlotAction[]>;
}
