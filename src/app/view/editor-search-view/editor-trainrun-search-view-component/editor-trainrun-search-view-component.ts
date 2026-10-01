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
import {Node} from "../../../models/node.model";
import {NodeService} from "../../../services/data/node.service";
import {Vec2D} from "../../../utils/vec2D";

@Component({
  selector: "sbb-editor-trainrun-search-view-component",
  templateUrl: "./editor-trainrun-search-view-component.html",
  styleUrls: ["./editor-trainrun-search-view-component.scss"],
  standalone: false,
})
export class EditorTrainrunSearchViewComponent implements OnInit, OnDestroy, OnChanges {
  private static readonly FILTER_PANEL_ID = "cd-layout-filter";

  @Input() resetSignal = 0;
  @Output() isEmptyChange = new EventEmitter<boolean>();

  searchControl = new FormControl<string | Trainrun | null>("");
  searchResults: Trainrun[] = [];
  orderedNodeEntries: OrderedTrainrunNodeEntry[] = [];
  readonly displayTrainrun = (value: string | Trainrun | null): string =>
    this.getDisplayValue(value);

  private destroyed = new Subject<void>();
  allSearchableTrainruns: Trainrun[] = [];
  filteredTrainruns: Trainrun[] = [];
  isDraggingResults = false;

  private dragStartY = 0;
  private dragStartScrollTop = 0;
  private activeResultsList: HTMLElement | null = null;

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

  onSearch() {
    this.search();
    if (this.searchResults.length === 1) {
      this.onSearchResultClick(this.searchControl.value as Trainrun);
    }
  }

  onSearchResultClick(trainrun: Trainrun): void {
    this.trainrunService.setTrainrunAsSelected(trainrun.getId());
    this.orderedNodeEntries = this.updateOrderedNodeEntries();
    if (this.orderedNodeEntries.length === 0) {
      return;
    }
    const firstEntry = this.orderedNodeEntries.at(0);
    if (firstEntry) {
      this.onOrderedNodeClick(firstEntry);
    }
  }

  updateOrderedNodeEntries() {
    if (this.trainrunService.getSelectedTrainrun()) {
      const data = this.trainrunService.getOrderedNodeEntriesForTrainrun(
        this.trainrunService.getSelectedTrainrun(),
      );
      console.log("Ordered Node Entries for Trainrun:", data);
      return data;
    }
    return [];
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

  transformNodeEntryName(entry: OrderedTrainrunNodeEntry): string {
    const node = this.nodeService.getNodeFromId(entry.nodeId);
    if (!node) {
      return `${entry.nodeId}`;
    }
    return this.transformNodeName(node);
  }

  private search() {
    if (this.searchControl.value instanceof Trainrun) {
      this.searchResults = [this.searchControl.value];
      this.trainrunService.setTrainrunAsSelected(this.searchResults[0].getId());
      this.orderedNodeEntries = this.updateOrderedNodeEntries();
      return;
    }

    this.searchResults = this.filterTrainruns(this.searchControl.value).sort((a, b) =>
      this.getTrainrunSearchValue(a).localeCompare(this.getTrainrunSearchValue(b)),
    );

    if (this.searchResults.length === 1) {
      const trainrun = this.searchResults[0];
      this.trainrunService.setTrainrunAsSelected(trainrun.getId());
      this.orderedNodeEntries = this.updateOrderedNodeEntries();
    }
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

  private clearSearch(): void {
    this.searchControl.setValue("");
    this.searchResults = [];
    this.orderedNodeEntries = [];
    this.trainrunService.unselectAllTrainruns();
    this.filteredTrainruns = this.filterTrainruns(this.searchControl.value).sort((a, b) =>
      this.getTrainrunSearchValue(a).localeCompare(this.getTrainrunSearchValue(b)),
    );
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
