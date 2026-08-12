import {Component, inject} from "@angular/core";
import {UiInteractionService} from "../../services/ui/ui.interaction.service";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {MainViewMode} from "./../filter-main-side-view/main-view-mode";
import {Node} from "../../models/node.model";
import {NodeService} from "../../services/data/node.service";
import {FormControl} from "@angular/forms";
import {Vec2D} from "../../utils/vec2D";

@Component({
  selector: "sbb-editor-search-view-component",
  templateUrl: "./editor-search-view-component.html",
  styleUrls: ["./editor-search-view-component.scss"],
  standalone: false,
})
export class EditorSearchViewComponent {
  private static readonly FILTER_PANEL_ID = "cd-layout-filter";

  searchControl = new FormControl<string | Node | null>("");
  searchResults: Node[] = [];
  readonly displayNode = (value: string | Node | null): string => this.getDisplayValue(value);

  mainViewMode: MainViewMode = MainViewMode.Netzgrafik;
  private destroyed = new Subject<void>();
  allSearchableNodes: Node[] = [];
  filteredNodes: Node[] = [];

  constructor(
    private uiInteractionService: UiInteractionService,
    private nodeService: NodeService,
  ) {
    this.nodeService.nodes.pipe(takeUntil(this.destroyed)).subscribe((nodes: Node[]) => {
      this.allSearchableNodes = nodes;
      this.filteredNodes = this.filterNodes(this.searchControl.value).sort((a, b) =>
        this.getNodeSearchValue(a).localeCompare(this.getNodeSearchValue(b)),
      );
    });
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
      this.filteredNodes = this.filterNodes(value).sort((a, b) =>
        this.getNodeSearchValue(a).localeCompare(this.getNodeSearchValue(b)),
      );
    });
  }

  get isNetzgrafikMode(): boolean {
    return this.mainViewMode === MainViewMode.Netzgrafik;
  }
  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  search() {
    if (this.searchControl.value instanceof Node) {
      this.searchResults = [this.searchControl.value];
      this.onSearchResultClick(this.searchControl.value);
      return;
    }

    this.searchResults = this.filterNodes(this.searchControl.value).sort((a, b) =>
      this.getNodeSearchValue(a).localeCompare(this.getNodeSearchValue(b)),
    );

    if (this.searchResults.length === 1) {
      this.onSearchResultClick(this.searchResults[0]);
    }
  }

  onSearchResultClick(node: Node): void {
    const offset = this.getNetzgrafikOffsetForElementRightEdge(
      EditorSearchViewComponent.FILTER_PANEL_ID,
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
    if (!searchTerm) {
      return this.allSearchableNodes.slice(0, 10);
    }

    return this.allSearchableNodes.filter((node) => this.matchesNode(node, searchTerm));
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

  getNetzgrafikOffsetForElementRightEdge(elementId: string): Vec2D {
    const element = document.getElementById(elementId);
    const offsetXPx = element?.getBoundingClientRect().right ?? 0;
    return this.uiInteractionService.getNetzgrafikOffsetFromScreenPx(offsetXPx, 0);
  }
}
