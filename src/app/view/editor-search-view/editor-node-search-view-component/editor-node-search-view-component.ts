import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from "@angular/core";
import {FilterService} from "../../../services/ui/filter.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {MainViewMode} from "../../filter-main-side-view/main-view-mode";
import {Node} from "../../../models/node.model";
import {NodeService} from "../../../services/data/node.service";
import {FormControl} from "@angular/forms";
import {Vec2D} from "../../../utils/vec2D";

@Component({
  selector: "sbb-editor-node-search-view-component",
  templateUrl: "./editor-node-search-view-component.html",
  styleUrls: ["./editor-node-search-view-component.scss"],
  standalone: false,
})
export class EditorNodeSearchViewComponent implements OnInit, OnDestroy, OnChanges {
  private static readonly FILTER_PANEL_ID = "cd-layout-filter";

  @Input() resetSignal = 0;
  @Output() isEmptyChange = new EventEmitter<boolean>();

  searchControl = new FormControl<string | Node | null>("");
  searchResults: Node[] = [];
  readonly displayNode = (value: string | Node | null): string => this.getDisplayValue(value);

  mainViewMode: MainViewMode = MainViewMode.Netzgrafik;
  private destroyed = new Subject<void>();
  allSearchableNodes: Node[] = [];
  filteredNodes: Node[] = [];
  isDraggingResults = false;

  private dragStartY = 0;
  private dragStartScrollTop = 0;
  private activeResultsList: HTMLElement | null = null;

  constructor(
    private uiInteractionService: UiInteractionService,
    private nodeService: NodeService,
    private filterService: FilterService,
  ) {
    this.nodeService.nodes.pipe(takeUntil(this.destroyed)).subscribe((nodes: Node[]) => {
      this.allSearchableNodes = nodes.filter((node) => this.filterService.filterNode(node));
      this.updateFilteredNodes(this.searchControl.value);
    });

    this.filterService.filter.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.allSearchableNodes = this.nodeService
        .getNodes()
        .filter((node) => this.filterService.filterNode(node));
      this.updateFilteredNodes(this.searchControl.value);
    });

    this.allSearchableNodes = this.nodeService
      .getNodes()
      .filter((node) => this.filterService.filterNode(node));
    this.updateFilteredNodes(this.searchControl.value);
  }

  ngOnInit(): void {
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

    this.searchControl.valueChanges.pipe(takeUntil(this.destroyed)).subscribe((value) => {
      this.updateFilteredNodes(value);
      this.emitIsEmptyState();
    });

    this.emitIsEmptyState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["resetSignal"] && !changes["resetSignal"].firstChange) {
      this.clearSearch();
    }
  }

  ngOnDestroy(): void {
    this.stopDragScroll();
    this.destroyed.next();
    this.destroyed.complete();
  }

  onResultListMouseDown(event: MouseEvent, listElement: HTMLElement): void {
    if (event.button !== 0) {
      return;
    }

    // Dragging is enabled only if the list can actually scroll.
    if (listElement.scrollHeight <= listElement.clientHeight) {
      return;
    }

    this.isDraggingResults = true;
    this.activeResultsList = listElement;
    this.dragStartY = event.clientY;
    this.dragStartScrollTop = listElement.scrollTop;
    event.preventDefault();
  }

  @HostListener("document:mousemove", ["$event"])
  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.isDraggingResults || !this.activeResultsList) {
      return;
    }

    const deltaY = event.clientY - this.dragStartY;
    this.activeResultsList.scrollTop = this.dragStartScrollTop + deltaY;
  }

  @HostListener("document:mouseup")
  onDocumentMouseUp(): void {
    this.stopDragScroll();
  }

  get isNetzgrafikMode(): boolean {
    return this.mainViewMode === MainViewMode.Netzgrafik;
  }

  search() {
    if (this.searchControl.value instanceof Node) {
      this.searchResults = [this.searchControl.value];
      this.onSearchResultClick(this.searchControl.value);
      return;
    }

    this.searchResults = this.filterNodes(this.searchControl.value);

    if (this.searchResults.length === 1) {
      this.onSearchResultClick(this.searchResults[0]);
    }
  }

  onSearchResultClick(node: Node): void {
    const offset = this.getNetzgrafikOffsetForElementRightEdge(
      EditorNodeSearchViewComponent.FILTER_PANEL_ID,
    );
    this.uiInteractionService.gotoNode(node, offset);
  }

  getNodeSearchValue(node: Node): string {
    if (node) {
      const betriebspunktName = node.getBetriebspunktName() ?? "";
      const fullName = node.getFullName() ?? "";

      return `${betriebspunktName} (${fullName})`;
    }

    return "";
  }

  transformNodeName(node: Node): string {
    if (node) {
      const betriebspunktName = node.getBetriebspunktName() ?? "";
      const fullName = node.getFullName() ?? "";
      const formattedBetriebspunktName =
        betriebspunktName.length > 8
          ? `${betriebspunktName.slice(0, 5)}...`
          : betriebspunktName.padEnd(8, " ");

      return `${formattedBetriebspunktName} ${fullName}`;
    }
    return "";
  }

  private filterNodes(value: string | Node | null): Node[] {
    const searchTerm = this.getSearchTerm(value);
    const nodes = searchTerm
      ? this.allSearchableNodes.filter((node) => this.matchesNode(node, searchTerm))
      : [...this.allSearchableNodes];

    return nodes.sort((a, b) =>
      this.getNodeSearchValue(a).localeCompare(this.getNodeSearchValue(b)),
    );
  }

  private updateFilteredNodes(value: string | Node | null): void {
    this.filteredNodes = this.filterNodes(value).slice(0, 10);
  }

  private getSearchTerm(value: string | Node | null): string {
    if (typeof value === "string") {
      return value.trim().toLocaleUpperCase();
    }

    if (value instanceof Node) {
      return this.getNodeSearchValue(value).toLocaleUpperCase();
    }

    return "";
  }

  private getDisplayValue(value: string | Node | null): string {
    if (value instanceof Node) {
      return this.getNodeSearchValue(value);
    }

    return value ?? "";
  }

  private matchesNode(node: Node, searchTerm: string): boolean {
    const betriebspunktName = (node.getBetriebspunktName() ?? "").toLocaleUpperCase();
    const fullName = (node.getFullName() ?? "").toLocaleUpperCase();
    const compactLabel = this.getNodeSearchValue(node).toLocaleUpperCase();

    return (
      betriebspunktName.includes(searchTerm) ||
      fullName.includes(searchTerm) ||
      compactLabel.includes(searchTerm)
    );
  }

  private getNetzgrafikOffsetForElementRightEdge(elementId: string): Vec2D {
    const element = document.getElementById(elementId);
    const offsetXPx = element?.getBoundingClientRect().right ?? 0;
    return this.uiInteractionService.getNetzgrafikOffsetFromScreenPx(offsetXPx, 0);
  }

  private clearSearch(): void {
    this.stopDragScroll();
    this.searchControl.setValue("");
    this.searchResults = [];
    this.updateFilteredNodes(this.searchControl.value);
    this.emitIsEmptyState();
  }

  private emitIsEmptyState(): void {
    const value = this.searchControl.value;
    const isEmpty = value === null || (typeof value === "string" && value.trim() === "");
    this.isEmptyChange.emit(isEmpty);
  }

  private stopDragScroll(): void {
    this.isDraggingResults = false;
    this.activeResultsList = null;
  }
}
