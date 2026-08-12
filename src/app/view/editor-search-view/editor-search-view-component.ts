import {Component} from "@angular/core";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";

@Component({
  selector: "sbb-editor-search-view-component",
  templateUrl: "./editor-search-view-component.html",
  styleUrls: ["./editor-search-view-component.scss"],
  standalone: false,
})
export class EditorSearchViewComponent {
  constructor(private uiInteractionService: UiInteractionService) {}
}
