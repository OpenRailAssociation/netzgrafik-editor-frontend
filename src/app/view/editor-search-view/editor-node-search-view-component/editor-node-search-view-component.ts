import {Component, ChangeDetectionStrategy, OnDestroy, OnInit} from "@angular/core";
import {FilterService} from "../../../services/ui/filter.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {Node} from "../../../models/node.model";
import {NodeService} from "../../../services/data/node.service";
import {FormControl} from "@angular/forms";
import {Vec2D} from "../../../utils/vec2D";
import {GeneralViewFunctions} from "../../util/generalViewFunctions";

@Component({
  selector: "sbb-editor-node-search-view-component",
  templateUrl: "./editor-node-search-view-component.html",
  styleUrls: ["./editor-node-search-view-component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EditorNodeSearchViewComponent implements OnInit, OnDestroy {
  private static readonly FILTER_PANEL_ID = "cd-layout-filter";
  private static readonly MAX_AUTOCOMPLETE_RESULTS = 20;

  searchControl = new FormControl<string | Node>("", {nonNullable: true});
  searchResults: Node[] = [];
  readonly GeneralViewFunctions = GeneralViewFunctions;
  readonly displayNode = (value: Node): string => this.getDisplayValue(value);

  private destroyed = new Subject<void>();
  allSearchableNodes: Node[] = [];
  filteredNodes: Node[] = [];
  remainingNodeResults = 0;

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
    this.searchControl.valueChanges.pipe(takeUntil(this.destroyed)).subscribe((value) => {
      this.updateFilteredNodes(value);
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  clearSearch(): void {
    this.searchControl.setValue("");
    this.searchResults = [];
  }

  onSearch(): void {
    this.search();

    if (this.searchResults.length === 1 && typeof this.searchControl.value === "string") {
      this.onSearchResultClick(this.searchResults[0]);
    }
  }

  search(): void {
    const value = this.searchControl.value;
    if (value instanceof Node) {
      this.searchResults = [value];
      this.onSearchResultClick(value);
      return;
    }

    this.searchResults = value.trim() ? this.filterNodes(value) : [];
  }

  onSearchResultClick(node: Node): void {
    this.searchControl.setValue(node, {emitEvent: false});
    const offset = this.getNetzgrafikOffsetForElementRightEdge(
      EditorNodeSearchViewComponent.FILTER_PANEL_ID,
    );
    this.uiInteractionService.gotoNode(node, offset);
  }

  private filterNodes(value: string | Node): Node[] {
    const searchTerm = this.getSearchTerm(value);
    return this.allSearchableNodes
      .filter((node) => this.matchesNode(node, searchTerm))
      .sort((a, b) =>
        GeneralViewFunctions.getNodeDisplayName(a).localeCompare(
          GeneralViewFunctions.getNodeDisplayName(b),
        ),
      );
  }

  private updateFilteredNodes(value: string | Node): void {
    const searchTerm = this.getSearchTerm(value);
    const matchingNodes = searchTerm !== "" ? this.filterNodes(value) : [];
    this.filteredNodes = matchingNodes.slice(
      0,
      EditorNodeSearchViewComponent.MAX_AUTOCOMPLETE_RESULTS,
    );
    this.remainingNodeResults = Math.max(matchingNodes.length - this.filteredNodes.length, 0);
  }

  private getSearchTerm(value: string | Node): string {
    const term =
      typeof value === "string" ? value.trim() : GeneralViewFunctions.getNodeDisplayName(value);
    return term.toLocaleUpperCase();
  }

  private getDisplayValue(value: string | Node): string {
    if (value instanceof Node) {
      return GeneralViewFunctions.getNodeDisplayName(value);
    }

    return value;
  }

  private matchesNode(node: Node, searchTerm: string): boolean {
    const betriebspunktName = node.getBetriebspunktName().toLocaleUpperCase();
    const fullName = node.getFullName().toLocaleUpperCase();
    const compactLabel = GeneralViewFunctions.getNodeDisplayName(node).toLocaleUpperCase();

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
}
