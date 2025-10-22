/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from "@angular/core";
import {environment} from "../../../environments/environment";

/**
 * Different layout modes. Generally the layout contains (up to) 3 columns that are distributed over a 4 columns layout:
 * - filter (f)
 * - main (m)
 * - aside (a)
 *
 * They are generally ordered from left to right. Filter and/or aside might be hidden.
 *
 * This component needs to use full width of the screen.
 *
 * Anforderungen:
 * - rausschieben
 * - fluid vergrößern
 * - col-padding
 * - col-gap
 * - responsive
 * - overlay
 *
 * Varianten:
 * - angular animations -> problem: responsive
 * - flexbox nativ -> problem column gap
 *
 */

export enum LayoutMode {
  FILTER_ONLY = "filter-only",
  PERLENKETTE_ONLY = "perlenkette-only",
  DETAIL_ONLY = "detail-only",
  FILTER_AND_DETAIL = "filter-and-detail",
  FILTER_AND_PERLENKETTE = "filter-and-perlenkette",
  MAIN_FULL = "main-full",
}

@Component({
  selector: "sbb-column-layout",
  templateUrl: "./column-layout.component.html",
  styleUrls: ["./column-layout.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColumnLayoutComponent implements AfterViewInit {
  public LayoutModeEnum = LayoutMode;

  @Input()
  mode: LayoutMode = LayoutMode.MAIN_FULL;
  @Input()
  showAsideClose = false;
  @Input()
  showFilterClose = false;
  @Output()
  asideClosed = new EventEmitter<boolean>();
  @Output()
  filterClosed = new EventEmitter<boolean>();

  @Input()
  curtain = false;

  newView = true;

  ngAfterViewInit() {
    this.newView = false;
  }

  getLayoutContentStyle(): string {
    if (environment.disableBackend) {
      return "height: 100%;";
    }
    return "";
  }

  hideAside() {
    switch (this.mode) {
      case LayoutMode.FILTER_ONLY:
      case LayoutMode.MAIN_FULL:
        return true;
      default:
        return false;
    }
  }

  hideFilter() {
    switch (this.mode) {
      case LayoutMode.DETAIL_ONLY:
      case LayoutMode.PERLENKETTE_ONLY:
      case LayoutMode.MAIN_FULL:
        return true;
      default:
        return false;
    }
  }
}
