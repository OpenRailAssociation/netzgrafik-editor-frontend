import {Component, EventEmitter, Input, Output, ChangeDetectionStrategy} from "@angular/core";
import {SlotAction} from "../../action-menu/action-menu/action-menu.component";
import {Observable} from "rxjs";

@Component({
  selector: "sbb-card",
  templateUrl: "./card.component.html",
  styleUrls: ["./card.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CardComponent {
  @Input()
  title?: string;

  @Input()
  subtitle?: string;

  @Input()
  route?: string | (string | number)[];

  @Input()
  icon?: string;

  @Output()
  iconClick = new EventEmitter();

  @Input()
  actions?: Observable<SlotAction[]>;

  openLink(route: string | (string | number)[]) {
    const element: HTMLElement = document.getElementById(
      this.getCardComponentRouterLinkId(route),
    ) as HTMLElement;
    if (element) {
      element.click();
    }
  }

  stopPropagation(event$: MouseEvent) {
    event$.stopPropagation();
  }

  getCardComponentRouterLinkId(route: string | (string | number)[]): string {
    if (typeof route === "string") {
      return "CardComponentRouterLink_s_" + route;
    }
    return "CardComponentRouterLink_" + route.join("_");
  }
}
