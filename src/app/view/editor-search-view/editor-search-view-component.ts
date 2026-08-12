import {Component} from "@angular/core";

@Component({
  selector: "sbb-editor-search-view-component",
  templateUrl: "./editor-search-view-component.html",
  styleUrls: ["./editor-search-view-component.scss"],
  standalone: false,
})
export class EditorSearchViewComponent {
  resetSignal = 0;
  nodeSearchEmpty = true;
  trainrunSearchEmpty = true;

  constructor() {}

  allSearchFieldsEmpty(): boolean {
    return this.nodeSearchEmpty && this.trainrunSearchEmpty;
  }

  onResetAllSearchFields(): void {
    this.resetSignal += 1;
  }

  onNodeSearchEmptyChange(isEmpty: boolean): void {
    this.nodeSearchEmpty = isEmpty;
  }

  onTrainrunSearchEmptyChange(isEmpty: boolean): void {
    this.trainrunSearchEmpty = isEmpty;
  }
}
