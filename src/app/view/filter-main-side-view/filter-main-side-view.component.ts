import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from "@angular/core";
import {LayoutMode} from "../column-layout/column-layout.component";
import {EditorMainViewComponent} from "../editor-main-view/editor-main-view.component";
import {DataService} from "../../services/data/data.service";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {takeUntil} from "rxjs/operators";
import {Subject, timer} from "rxjs";
import {MainViewMode} from "./main-view-mode";
import {NodeService} from "../../services/data/node.service";

export enum FilterWindowType {
  VARIANT_INFO = "variant-info",
  EDITOR_FILTER = "editor-filter",
  PROPERTIES = "properties",
  EDIT_TOOLS = "edit-tools",
  TOOLS = "tools",
}

@Component({
  selector: "sbb-filter-main-side-view",
  templateUrl: "./filter-main-side-view.component.html",
  styleUrls: ["./filter-main-side-view.component.scss"],
})
export class FilterMainSideViewComponent implements OnInit, OnDestroy {
  @ViewChild("editor")
  editor: EditorMainViewComponent;

  mode = LayoutMode.MAIN_FULL;
  type: FilterWindowType | null = null;

  showToggleAside = true;
  showToggleFilter = true;
  mainViewMode: MainViewMode = MainViewMode.Netzgrafik;
  private destroyed = new Subject<void>();

  constructor(
    private dataService: DataService,
    private uiInteractionService: UiInteractionService,
    private nodeService: NodeService,
    public filterMainSideViewElement: ElementRef,
  ) {}

  get showVariantInfo(): boolean {
    return this.type === FilterWindowType.VARIANT_INFO;
  }

  get showEditorFilter(): boolean {
    return this.type === FilterWindowType.EDITOR_FILTER;
  }

  get showEditorEditTools(): boolean {
    return this.type === FilterWindowType.EDIT_TOOLS;
  }

  get showEditorTools(): boolean {
    return this.type === FilterWindowType.TOOLS;
  }

  get showEditorProperties(): boolean {
    return this.type === FilterWindowType.PROPERTIES;
  }

  get showDetail(): boolean {
    return this.mode === LayoutMode.DETAIL_ONLY || this.mode === LayoutMode.FILTER_AND_DETAIL;
  }

  get showPerlenkette(): boolean {
    return (
      this.mode === LayoutMode.PERLENKETTE_ONLY || this.mode === LayoutMode.FILTER_AND_PERLENKETTE
    );
  }

  ngOnInit(): void {
    this.uiInteractionService.nodeStammdatenWindow
      .pipe(takeUntil(this.destroyed))
      .subscribe((open: boolean) => {
        if (open) {
          if (
            this.mode === LayoutMode.MAIN_FULL ||
            this.mode === LayoutMode.DETAIL_ONLY ||
            this.mode === LayoutMode.PERLENKETTE_ONLY
          ) {
            this.setMode(LayoutMode.DETAIL_ONLY);
          } else {
            this.setMode(LayoutMode.FILTER_AND_DETAIL);
          }
        } else {
          if (this.mode === LayoutMode.DETAIL_ONLY) {
            this.setMode(LayoutMode.MAIN_FULL);
          } else if (this.mode === LayoutMode.FILTER_AND_DETAIL) {
            this.setMode(LayoutMode.FILTER_ONLY);
          }
        }
      });
    this.uiInteractionService.filterWindow
      .pipe(takeUntil(this.destroyed))
      .subscribe((type: FilterWindowType | null) => {
        this.type = type;
        if (type) {
          if (this.mode === LayoutMode.MAIN_FULL || this.mode === LayoutMode.FILTER_ONLY) {
            this.setMode(LayoutMode.FILTER_ONLY);
          } else if (this.mode === LayoutMode.DETAIL_ONLY) {
            this.setMode(LayoutMode.FILTER_AND_DETAIL);
          } else if (this.mode === LayoutMode.PERLENKETTE_ONLY) {
            this.setMode(LayoutMode.FILTER_AND_PERLENKETTE);
          }
        } else {
          if (this.mode === LayoutMode.FILTER_ONLY) {
            this.setMode(LayoutMode.MAIN_FULL);
          } else if (this.mode === LayoutMode.FILTER_AND_DETAIL) {
            this.setMode(LayoutMode.DETAIL_ONLY);
          } else if (this.mode === LayoutMode.FILTER_AND_PERLENKETTE) {
            this.setMode(LayoutMode.PERLENKETTE_ONLY);
          }
        }
      });
    this.uiInteractionService.perlenketteWindow
      .pipe(takeUntil(this.destroyed))
      .subscribe((open: boolean) => {
        if (open) {
          if (
            this.mode === LayoutMode.MAIN_FULL ||
            this.mode === LayoutMode.PERLENKETTE_ONLY ||
            this.mode === LayoutMode.DETAIL_ONLY
          ) {
            this.setMode(LayoutMode.PERLENKETTE_ONLY);
          } else {
            this.setMode(LayoutMode.FILTER_AND_PERLENKETTE);
          }
        } else {
          if (this.mode === LayoutMode.PERLENKETTE_ONLY) {
            this.setMode(LayoutMode.MAIN_FULL);
          } else if (this.mode === LayoutMode.FILTER_AND_PERLENKETTE) {
            this.setMode(LayoutMode.FILTER_ONLY);
          }
        }
      });
    this.uiInteractionService.printGraphik.pipe(takeUntil(this.destroyed)).subscribe(() => {
      timer(250).subscribe(() => {
        print();
      });
    });
    this.uiInteractionService.streckengrafikWindow
      .pipe(takeUntil(this.destroyed))
      .subscribe((mainViewMode: MainViewMode) => {
        this.mainViewMode = mainViewMode;
      });
    this.uiInteractionService.originDestinationWindow
      .pipe(takeUntil(this.destroyed))
      .subscribe((mainViewMode: MainViewMode) => {
        this.mainViewMode = mainViewMode;
      });

    this.dataService.triggerViewUpdate();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  setMode(mode: string) {
    this.mode = mode as LayoutMode;
  }

  asideClosed() {
    if (this.mode === LayoutMode.DETAIL_ONLY) {
      this.nodeService.unselectAllNodes();
      this.setMode(LayoutMode.MAIN_FULL);
    } else if (this.mode === LayoutMode.PERLENKETTE_ONLY) {
      this.setMode(LayoutMode.MAIN_FULL);
    } else if (this.mode === LayoutMode.FILTER_AND_DETAIL) {
      this.nodeService.unselectAllNodes();
      this.setMode(LayoutMode.FILTER_ONLY);
    } else if (this.mode === LayoutMode.FILTER_AND_PERLENKETTE) {
      this.setMode(LayoutMode.FILTER_ONLY);
    }
  }

  filterClosed() {
    if (this.mode === LayoutMode.FILTER_ONLY) {
      this.setMode(LayoutMode.MAIN_FULL);
    } else if (this.mode === LayoutMode.FILTER_AND_DETAIL) {
      this.setMode(LayoutMode.DETAIL_ONLY);
    } else if (this.mode === LayoutMode.FILTER_AND_PERLENKETTE) {
      this.setMode(LayoutMode.PERLENKETTE_ONLY);
    }
    this.uiInteractionService.closeFilter();
  }

  isMainView() {
    return this.mainViewMode === MainViewMode.Netzgrafik;
  }

  isStreckengrafik() {
    return this.mainViewMode === MainViewMode.Streckengrafik;
  }

  isOriginDestination() {
    return this.mainViewMode === MainViewMode.OriginDestination;
  }

  correctZoomFactor(): string {
    // Empirical observation: For devicePixelRatio of 1.5, no zoom adjustment is needed.
    // The reason is unclear, but tests confirm this works reliably.
    if (window.devicePixelRatio === 1.5) {
      return "";
    }
    return "zoom: 1.0;";
  }

}
