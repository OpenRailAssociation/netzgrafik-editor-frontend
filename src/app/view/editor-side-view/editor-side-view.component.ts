import {Component, EventEmitter, Output, ChangeDetectionStrategy} from "@angular/core";

@Component({
  selector: "sbb-editor-side-view",
  templateUrl: "./editor-side-view.component.html",
  styleUrls: ["./editor-side-view.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EditorSideViewComponent {
  @Output()
  closeSideView = new EventEmitter<void>();

  nodeDeleted() {
    this.closeSideView.emit();
  }
}
