import {Component, OnDestroy, OnInit} from "@angular/core";
import {FilterService} from "../../../services/ui/filter.service";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {Trainrun} from "../../../models/trainrun.model";
import {TrainrunService} from "../../../services/data/trainrun.service";
import {TrainrunSectionService} from "../../../services/data/trainrunsection.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {FormControl} from "@angular/forms";
import {
  LoadPerlenketteService,
  OrderedTrainrunNodeEntry,
} from "../../../perlenkette/service/load-perlenkette.service";
import {Node} from "../../../models/node.model";
import {Vec2D} from "../../../utils/vec2D";

@Component({
  selector: "sbb-editor-trainrun-search-view-component",
  templateUrl: "./editor-trainrun-search-view-component.html",
  styleUrls: ["./editor-trainrun-search-view-component.scss"],
  standalone: false,
})
export class EditorTrainrunSearchViewComponent implements OnInit, OnDestroy {
  private static readonly FILTER_PANEL_ID = "cd-layout-filter";

  searchControl = new FormControl<string | Trainrun | null>("");
  searchResults: Trainrun[] = [];
  orderedNodeEntries: OrderedTrainrunNodeEntry[] = [];
  readonly displayTrainrun = (value: string | Trainrun | null): string =>
    this.getDisplayValue(value);

  private destroyed = new Subject<void>();
  allSearchableTrainruns: Trainrun[] = [];
  filteredTrainruns: Trainrun[] = [];

  constructor(
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private uiInteractionService: UiInteractionService,
    private loadPerlenketteService: LoadPerlenketteService,
    private filterService: FilterService,
  ) {
    this.allSearchableTrainruns = this.trainrunService
      .getTrainruns()
      .filter((trainrun) => this.filterService.filterTrainrun(trainrun));
    this.filteredTrainruns = this.filterTrainruns(this.searchControl.value).sort((a, b) =>
      this.getTrainrunSearchValue(a).localeCompare(this.getTrainrunSearchValue(b)),
    );
  }

  ngOnInit(): void {
    this.trainrunService.trainruns
      .pipe(takeUntil(this.destroyed))
      .subscribe((trainruns: Trainrun[]) => {
        this.allSearchableTrainruns = trainruns.filter((trainrun) =>
          this.filterService.filterTrainrun(trainrun),
        );
        this.filteredTrainruns = this.filterTrainruns(this.searchControl.value).sort((a, b) =>
          this.getTrainrunSearchValue(a).localeCompare(this.getTrainrunSearchValue(b)),
        );
        this.orderedNodeEntries = this.updateOrderedNodeEntries();
        if (!this.trainrunService.getSelectedTrainrun()) {
          this.searchControl.setValue(null);
        }
      });

    this.trainrunSectionService.trainrunSections.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.allSearchableTrainruns = this.trainrunService
        .getTrainruns()
        .filter((trainrun) => this.filterService.filterTrainrun(trainrun));
      this.filteredTrainruns = this.filterTrainruns(this.searchControl.value).sort((a, b) =>
        this.getTrainrunSearchValue(a).localeCompare(this.getTrainrunSearchValue(b)),
      );
      this.orderedNodeEntries = this.updateOrderedNodeEntries();
    });

    this.filterService.filter.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.allSearchableTrainruns = this.trainrunService
        .getTrainruns()
        .filter((trainrun) => this.filterService.filterTrainrun(trainrun));
      this.filteredTrainruns = this.filterTrainruns(this.searchControl.value).sort((a, b) =>
        this.getTrainrunSearchValue(a).localeCompare(this.getTrainrunSearchValue(b)),
      );
      this.orderedNodeEntries = this.updateOrderedNodeEntries();
    });

    this.searchControl.valueChanges.pipe(takeUntil(this.destroyed)).subscribe((value) => {
      this.filteredTrainruns = this.filterTrainruns(value).sort((a, b) =>
        this.getTrainrunSearchValue(a).localeCompare(this.getTrainrunSearchValue(b)),
      );
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  search() {
    if (this.searchControl.value instanceof Trainrun) {
      this.searchResults = [this.searchControl.value];
      this.onSearchResultClick(this.searchControl.value);
      return;
    }

    this.searchResults = this.filterTrainruns(this.searchControl.value).sort((a, b) =>
      this.getTrainrunSearchValue(a).localeCompare(this.getTrainrunSearchValue(b)),
    );

    if (this.searchResults.length === 1) {
      this.onSearchResultClick(this.searchResults[0]);
    }
  }

  onSearchResultClick(trainrun: Trainrun): void {
    this.trainrunService.setTrainrunAsSelected(trainrun.getId());
    this.orderedNodeEntries = this.updateOrderedNodeEntries();
    const firstNode = this.orderedNodeEntries.at(0)?.node;
    if (firstNode) {
      const offset = this.getNetzgrafikOffsetForElementRightEdge(
        EditorTrainrunSearchViewComponent.FILTER_PANEL_ID,
      );
      this.uiInteractionService.gotoNode(firstNode, offset);
    }
  }

  updateOrderedNodeEntries() {
    if (this.trainrunService.getSelectedTrainrun()) {
      return this.loadPerlenketteService.getOrderedNodeEntriesForTrainrun(
        this.trainrunService.getSelectedTrainrun(),
      );
    }
    return [];
  }

  onOrderedNodeClick(node: Node): void {
    const offset = this.getNetzgrafikOffsetForElementRightEdge(
      EditorTrainrunSearchViewComponent.FILTER_PANEL_ID,
    );
    this.uiInteractionService.gotoNode(node, offset);
  }

  getTrainrunSearchValue(trainrun: Trainrun): string {
    if (trainrun) {
      const category = trainrun.getCategoryShortName() ?? "";
      const title = trainrun.getTitle() ?? "";

      return `${category}${title}`.trim();
    }

    return "";
  }

  transformTrainrunName(trainrun: Trainrun): string {
    return this.getTrainrunSearchValue(trainrun);
  }

  transformNodeName(node: Node): string {
    const betriebspunktName = node.getBetriebspunktName() ?? "";
    const fullName = node.getFullName() ?? "";
    return `${betriebspunktName} (${fullName})`;
  }

  private filterTrainruns(value: string | Trainrun | null): Trainrun[] {
    const searchTerm = this.getSearchTerm(value);
    if (!searchTerm) {
      return this.allSearchableTrainruns.slice(0, 10);
    }

    return this.allSearchableTrainruns.filter((trainrun) =>
      this.matchesTrainrun(trainrun, searchTerm),
    );
  }

  private getSearchTerm(value: string | Trainrun | null): string {
    if (typeof value === "string") {
      return value.trim().toLocaleUpperCase();
    }

    if (value instanceof Trainrun) {
      return this.getTrainrunSearchValue(value).toLocaleUpperCase();
    }

    return "";
  }

  private getDisplayValue(value: string | Trainrun | null): string {
    if (value instanceof Trainrun) {
      return this.getTrainrunSearchValue(value);
    }

    return value ?? "";
  }

  private matchesTrainrun(trainrun: Trainrun, searchTerm: string): boolean {
    const category = (trainrun.getCategoryShortName() ?? "").toLocaleUpperCase();
    const title = (trainrun.getTitle() ?? "").toLocaleUpperCase();
    const compactLabel = this.getTrainrunSearchValue(trainrun).toLocaleUpperCase();

    return (
      category.includes(searchTerm) ||
      title.includes(searchTerm) ||
      compactLabel.includes(searchTerm)
    );
  }

  private getNetzgrafikOffsetForElementRightEdge(elementId: string): Vec2D {
    const element = document.getElementById(elementId);
    const offsetXPx = element?.getBoundingClientRect().right ?? 0;
    return this.uiInteractionService.getNetzgrafikOffsetFromScreenPx(offsetXPx, 0);
  }
}
