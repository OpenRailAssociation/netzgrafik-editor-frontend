import {Component, ElementRef, EventEmitter, Inject, Output, ViewChild} from "@angular/core";
import {DOCUMENT} from "@angular/common";

@Component({
  selector: "sbb-preview-button",
  templateUrl: "./preview-button.component.html",
  styleUrls: ["./preview-button.component.scss"],
})
export class PreviewButtonComponent {
  @Output()
  active = new EventEmitter<boolean>();

  @ViewChild("previewButton", {read: ElementRef})
  previewButton: ElementRef;

  isActive = false;

  constructor(@Inject(DOCUMENT) private document: Document) {}

  onMouseDown() {
    // lock the users pointer to always trigger the mouseup event
    this.previewButton.nativeElement.requestPointerLock();
    this.toggle(true);
  }

  onMouseUp() {
    this.document.exitPointerLock();
    this.toggle(false);
  }

  private toggle(isActive: boolean) {
    this.isActive = isActive;
    this.active.next(this.isActive);
  }
}
