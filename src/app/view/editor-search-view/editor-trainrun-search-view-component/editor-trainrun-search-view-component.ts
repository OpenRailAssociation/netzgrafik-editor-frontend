import {Component, ChangeDetectionStrategy, OnDestroy, OnInit} from "@angular/core";
import {FilterService} from "../../../services/ui/filter.service";
import {takeUntil} from "rxjs/operators";
import {Subject} from "rxjs";
import {Trainrun} from "../../../models/trainrun.model";
import {TrainrunService} from "../../../services/data/trainrun.service";
import {
  InformSelectedTrainrunClick,
  TrainrunSectionService,
} from "../../../services/data/trainrunsection.service";
import {UiInteractionService} from "../../../services/ui/ui.interaction.service";
import {FormControl} from "@angular/forms";
import {OrderedTrainrunNodeEntry} from "../../../services/data/trainrun.service";
import {NodeService} from "../../../services/data/node.service";
import {Vec2D} from "../../../utils/vec2D";

@Component({
  selector: "sbb-editor-trainrun-search-view-component",
  templateUrl: "./editor-trainrun-search-view-component.html",
  styleUrls: ["./editor-trainrun-search-view-component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class EditorTrainrunSearchViewComponent implements OnInit, OnDestroy {
  private static readonly FILTER_PANEL_ID = "cd-layout-filter";
  private static readonly MAX_AUTOCOMPLETE_RESULTS = 10;

  searchControl = new FormControl<string | Trainrun>("", {nonNullable: true});
  searchResults: Trainrun[] = [];
  orderedNodeEntries: OrderedTrainrunNodeEntry[] = [];
  startNode: OrderedTrainrunNodeEntry | undefined;
  endNode: OrderedTrainrunNodeEntry | undefined;
  startNodeHidden = false;
  endNodeHidden = false;
  readonly displayTrainrun = (value: string | Trainrun): string => this.getDisplayValue(value);

  private destroyed = new Subject<void>();
  allSearchableTrainruns: Trainrun[] = [];
  filteredTrainruns: Trainrun[] = [];
  remainingTrainrunResults = 0;

  constructor(
    private trainrunService: TrainrunService,
    private trainrunSectionService: TrainrunSectionService,
    private uiInteractionService: UiInteractionService,
    private filterService: FilterService,
    private nodeService: NodeService,
  ) {
    this.allSearchableTrainruns = this.trainrunService
      .getTrainruns()
      .filter((trainrun) => this.filterService.filterTrainrun(trainrun));
    this.updateFilteredTrainruns(this.searchControl.value);
  }

  ngOnInit(): void {
    this.trainrunService.trainruns
      .pipe(takeUntil(this.destroyed))
      .subscribe((trainruns: Trainrun[]) => {
        this.allSearchableTrainruns = trainruns.filter((trainrun) =>
          this.filterService.filterTrainrun(trainrun),
        );
        this.updateFilteredTrainruns(this.searchControl.value);
        this.orderedNodeEntries = this.updateOrderedNodeEntries();
        if (!this.trainrunService.getSelectedTrainrun()) {
          this.searchControl.setValue("");
        } else {
          const currentValue = this.searchControl.value;
          if (currentValue instanceof Trainrun) {
            if (this.trainrunService.getSelectedTrainrun().getId() !== currentValue.getId()) {
              this.searchControl.setValue(this.trainrunService.getSelectedTrainrun());
              this.search();
            }
          } else {
            this.searchControl.setValue(this.trainrunService.getSelectedTrainrun());
            this.search();
          }
        }
      });

    this.trainrunSectionService.trainrunSections.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.allSearchableTrainruns = this.trainrunService
        .getTrainruns()
        .filter((trainrun) => this.filterService.filterTrainrun(trainrun));
      this.updateFilteredTrainruns(this.searchControl.value);
      this.orderedNodeEntries = this.updateOrderedNodeEntries();
    });

    this.nodeService.nodes.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.orderedNodeEntries = this.updateOrderedNodeEntries();
    });

    this.filterService.filter.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.allSearchableTrainruns = this.trainrunService
        .getTrainruns()
        .filter((trainrun) => this.filterService.filterTrainrun(trainrun));
      this.updateFilteredTrainruns(this.searchControl.value);
      this.orderedNodeEntries = this.updateOrderedNodeEntries();
    });

    this.searchControl.valueChanges.pipe(takeUntil(this.destroyed)).subscribe((value) => {
      this.updateFilteredTrainruns(value);
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

  onSearch() {
    const selectedTrainrun = this.searchControl.value;
    this.search();
    if (selectedTrainrun instanceof Trainrun) {
      this.selectTrainrun(selectedTrainrun);
    }
  }

  selectTrainrun(trainrun: Trainrun): void {
    this.trainrunService.setTrainrunAsSelected(trainrun.getId());

    const firstEntry = this.trainrunService.getOrderedNodeEntriesForTrainrun(trainrun).at(0);
    if (firstEntry) {
      this.onOrderedNodeClick(firstEntry);
    }
  }

  isSelectedTrainrun(trainrun: Trainrun): boolean {
    return this.trainrunService.getSelectedTrainrun()?.getId() === trainrun.getId();
  }

  updateOrderedNodeEntries() {
    if (this.trainrunService.getSelectedTrainrun()) {
      const orderedEntries = this.trainrunService.getOrderedNodeEntriesForTrainrun(
        this.trainrunService.getSelectedTrainrun(),
      );
      this.startNode = orderedEntries.at(0);
      this.endNode = orderedEntries.at(-1);
      this.startNodeHidden = this.isNodeEntryHidden(this.startNode);
      this.endNodeHidden = this.isNodeEntryHidden(this.endNode);

      const visibleEntries: OrderedTrainrunNodeEntry[] = [];
      let hasHiddenNode = false;

      for (const entry of orderedEntries) {
        const node = this.nodeService.getNodeFromId(entry.nodeId);
        if (!node || !this.filterService.isNodeVisible(node)) {
          hasHiddenNode = true;
          continue;
        }

        if (hasHiddenNode && visibleEntries.length > 0) {
          const previousEntry = visibleEntries.at(-1);
          if (previousEntry) {
            previousEntry.hasGapAfter = true;
          }
        }

        visibleEntries.push({...entry});
        hasHiddenNode = false;
      }

      return visibleEntries;
    }
    this.startNode = undefined;
    this.endNode = undefined;
    this.startNodeHidden = false;
    this.endNodeHidden = false;
    return [];
  }

  private isNodeEntryHidden(entry: OrderedTrainrunNodeEntry | undefined): boolean {
    const node = entry ? this.nodeService.getNodeFromId(entry.nodeId) : undefined;
    return !!entry && (!node || !this.filterService.isNodeVisible(node));
  }

  private gotoTrainrunSection(sectionId: number): void {
    const ts = this.trainrunService.getSelectedTrainrun();
    const trainrunSection = this.trainrunSectionService.getTrainrunSectionFromId(sectionId);
    if (!trainrunSection) {
      return;
    }

    if (ts.getId() !== trainrunSection.getTrainrunId()) {
      this.trainrunService.setTrainrunAsSelected(trainrunSection.getTrainrunId());
    }
    const param: InformSelectedTrainrunClick = {
      trainrunSectionId: trainrunSection.getId(),
      open: false,
    };
    this.trainrunSectionService.clickSelectedTrainrunSection(param);
  }

  onOrderedNodeClick(entry: OrderedTrainrunNodeEntry): void {
    const node = this.nodeService.getNodeFromId(entry.nodeId);
    if (!node) {
      return;
    }

    if (entry.trainrunSectionId !== undefined) {
      this.gotoTrainrunSection(entry.trainrunSectionId);
    }

    const offset = this.getNetzgrafikOffsetForElementRightEdge(
      EditorTrainrunSearchViewComponent.FILTER_PANEL_ID,
    );
    this.uiInteractionService.gotoNode(node, offset);
  }

  getTrainrunSearchValue(trainrun: Trainrun): string {
    if (trainrun) {
      const category = trainrun.getCategoryShortName();
      const title = trainrun.getTitle();

      return `${category}${title}`.trim();
    }

    return "";
  }

  transformTrainrunName(trainrun: Trainrun): string {
    return this.getTrainrunSearchValue(trainrun);
  }

  transformNodeEntryName(entry: OrderedTrainrunNodeEntry): string {
    const node = this.nodeService.getNodeFromId(entry.nodeId);
    if (!node) {
      return `${entry.nodeId}`;
    }
    return this.filterService.isDisplayingNodesFullName()
      ? node.getFullName()
      : node.getBetriebspunktName();
  }

  private search(): void {
    const value = this.searchControl.value;
    if (value instanceof Trainrun) {
      this.searchResults = [value];
      return;
    }

    this.searchResults = this.filterTrainruns(value);

    if (this.searchResults.length === 1) {
      const trainrun = this.searchResults[0];
      this.searchControl.setValue(trainrun, {emitEvent: false});
      this.selectTrainrun(trainrun);
      return;
    }

    this.searchResults.sort((a, b) =>
      this.getTrainrunSearchValue(a).localeCompare(this.getTrainrunSearchValue(b)),
    );
  }

  private filterTrainruns(value: string | Trainrun): Trainrun[] {
    const searchTerm = this.getSearchTerm(value);
    if (!searchTerm) {
      return [];
    }

    return this.allSearchableTrainruns.filter((trainrun) =>
      this.matchesTrainrun(trainrun, searchTerm),
    );
  }

  private updateFilteredTrainruns(value: string | Trainrun): void {
    const matchingTrainruns = this.filterTrainruns(value).sort((a, b) =>
      this.getTrainrunSearchValue(a).localeCompare(this.getTrainrunSearchValue(b)),
    );
    this.filteredTrainruns = matchingTrainruns.slice(
      0,
      EditorTrainrunSearchViewComponent.MAX_AUTOCOMPLETE_RESULTS,
    );
    this.remainingTrainrunResults = Math.max(
      matchingTrainruns.length - this.filteredTrainruns.length,
      0,
    );
  }

  private getSearchTerm(value: string | Trainrun): string {
    const term = typeof value === "string" ? value.trim() : this.getTrainrunSearchValue(value);
    return term.toLocaleUpperCase();
  }

  private getDisplayValue(value: string | Trainrun): string {
    if (value instanceof Trainrun) {
      return this.getTrainrunSearchValue(value);
    }

    return value;
  }

  private matchesTrainrun(trainrun: Trainrun, searchTerm: string): boolean {
    const category = trainrun.getCategoryShortName().toLocaleUpperCase();
    const title = trainrun.getTitle().toLocaleUpperCase();
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
