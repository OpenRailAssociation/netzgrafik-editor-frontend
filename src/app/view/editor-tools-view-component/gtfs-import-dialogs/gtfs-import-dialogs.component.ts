import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnChanges,
  SimpleChanges,
  TemplateRef,
  ElementRef,
  ViewChild,
} from "@angular/core";
import {FormControl} from "@angular/forms";
import {Observable} from "rxjs";
import {map, startWith} from "rxjs/operators";
import {SbbTableDataSource} from "@sbb-esta/angular/table";
import {SbbChipInputEvent} from "@sbb-esta/angular/chips";
import {COMMA, ENTER} from "@angular/cdk/keycodes";

@Component({
  selector: "sbb-gtfs-import-dialogs",
  templateUrl: "./gtfs-import-dialogs.component.html",
  styleUrls: ["./gtfs-import-dialogs.component.scss"],
})
export class GtfsImportDialogsComponent implements OnInit, OnChanges {
  readonly separatorKeysCodes = [ENTER, COMMA];

  // Form controls for autocomplete input filtering
  agencyInputCtrl = new FormControl("");
  categoryInputCtrl = new FormControl("");
  lineInputCtrl = new FormControl("");

  // Observable filtered lists for autocomplete (async pipe)
  filteredAgencies$!: Observable<string[]>;
  filteredCategories$!: Observable<string[]>;
  filteredLines$!: Observable<string[]>;

  @Input() gtfsFilterDialogVisible = false;
  @Input() gtfsImportOverlayVisible = false;
  @Input() gtfsImportPhases: any[] = [];
  @Input() gtfsImportComplete = false;

  // Import summary data
  @Input() gtfsImportSummary: any = null;

  // Data sources for summary tables
  summaryDataSource: SbbTableDataSource<any> = new SbbTableDataSource([]);
  categoryDataSource: SbbTableDataSource<any> = new SbbTableDataSource([]);
  frequencyDataSource: SbbTableDataSource<any> = new SbbTableDataSource([]);
  labelDataSource: SbbTableDataSource<any> = new SbbTableDataSource([]);
  tripsDataSource: SbbTableDataSource<any> = new SbbTableDataSource([]);

  // Column definitions for summary tables
  summaryColumns: string[] = ["metric", "value"];
  categoryColumns: string[] = ["category", "count"];
  frequencyColumns: string[] = ["frequency", "count"];
  labelColumns: string[] = ["label", "count"];
  tripsColumns: string[] = [
    "tripId",
    "routeShortName",
    "tripHeadsign",
    "category",
    "frequency",
    "trainrunId",
  ];

  // Available data from light parse
  @Input() gtfsAvailableAgencies: string[] = [];
  @Input() gtfsAvailableCategories: string[] = [];
  @Input() gtfsAvailableRoutes: string[] = [];

  // Selected filters
  @Input() gtfsSelectedAgencies: string[] = [];
  @Input() gtfsSelectedCategories: string[] = [];
  @Input() gtfsSelectedLines: string[] = [];
  @Input() gtfsSelectedDate: string | null = null;

  // Note: Filtered lists are now computed as Observables (filteredAgencies$, etc.)

  // Warnings
  @Input() gtfsNoCategoriesWarning = false;
  @Input() gtfsNoLinesWarning = false;

  // Filters
  @Input() gtfsRouteTypeFilter: any;
  @Input() gtfsNodeFilter: any;

  // Service date range from GTFS calendar (min/max gültig)
  @Input() gtfsServiceDateRange: {startDate: string; endDate: string} | null = null;

  // Time sync tolerance for round-trip matching (in seconds)
  @Input() gtfsTimeSyncTolerance = 180;
  @Output() gtfsTimeSyncToleranceChange = new EventEmitter<number>();

  // Q6: Topology consolidation toggle
  @Input() gtfsEnableTopologyConsolidation = true;
  @Output() gtfsEnableTopologyConsolidationChange = new EventEmitter<boolean>();

  @Output() setSelectedDate = new EventEmitter<string>();

  // Events
  @Output() closeFilterDialog = new EventEmitter<void>();
  @Output() applyFilters = new EventEmitter<void>();
  @Output() closeImportOverlay = new EventEmitter<void>();

  @Output() addAgency = new EventEmitter<string>();
  @Output() removeAgency = new EventEmitter<string>();

  @Output() addCategory = new EventEmitter<string>();
  @Output() removeCategory = new EventEmitter<string>();

  @Output() addLine = new EventEmitter<string>();
  @Output() removeLine = new EventEmitter<string>();

  // ViewChild for trips table pagination and sorting
  @ViewChild("tripsPaginator") tripsPaginator: any;
  @ViewChild("tripsSort") tripsSort: any;
  @ViewChild("lineInputEl") lineInputElement?: ElementRef<HTMLInputElement>;

  // Search filter for trips table
  tripsSearchFilter = new FormControl("");

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Setup observable filtered lists for autocomplete
    this.setupFilteredLists();

    // Setup trips table search filter
    this.tripsSearchFilter.valueChanges.subscribe((filterValue) => {
      this.tripsDataSource.filter = (filterValue || "").trim().toLowerCase();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Re-setup filtered lists when available data changes
    if (
      changes["gtfsAvailableAgencies"] ||
      changes["gtfsAvailableCategories"] ||
      changes["gtfsAvailableRoutes"]
    ) {
      this.setupFilteredLists();
    }

    // Chips sofort neu zeichnen wenn sich die Selektion ändert
    if (
      changes["gtfsSelectedAgencies"] ||
      changes["gtfsSelectedCategories"] ||
      changes["gtfsSelectedLines"]
    ) {
      this.cdr.markForCheck();
    }

    // Update summary tables when summary data changes
    if (changes["gtfsImportSummary"] && this.gtfsImportSummary) {
      this.updateSummaryTables();
    }
  }

  private updateSummaryTables(): void {
    if (!this.gtfsImportSummary) {
      return;
    }

    // Main summary table
    const summaryData = [
      {
        metric: $localize`:@@app.view.editor-side-view.gtfs-import-dialogs.summary-nodes:Anzahl Knoten`,
        value: this.gtfsImportSummary.nodes || 0,
      },
      {
        metric: $localize`:@@app.view.editor-side-view.gtfs-import-dialogs.summary-trainruns:Anzahl Züge`,
        value: this.gtfsImportSummary.trainruns || 0,
      },
      {
        metric: $localize`:@@app.view.editor-side-view.gtfs-import-dialogs.summary-sections:Anzahl Abschnitte`,
        value: this.gtfsImportSummary.sections || 0,
      },
      {
        metric: $localize`:@@app.view.editor-side-view.gtfs-import-dialogs.summary-roundtrip:Anzahl Round-Trip Züge`,
        value: this.gtfsImportSummary.roundTripCount || 0,
      },
      {
        metric: $localize`:@@app.view.editor-side-view.gtfs-import-dialogs.summary-oneway:Anzahl One-Way Züge`,
        value: this.gtfsImportSummary.oneWayCount || 0,
      },
    ];
    this.summaryDataSource = new SbbTableDataSource(summaryData);

    // Category summary table
    if (this.gtfsImportSummary.byCategory) {
      const categoryData = Object.entries(this.gtfsImportSummary.byCategory).map(
        ([category, count]) => ({
          category,
          count,
        }),
      );
      this.categoryDataSource = new SbbTableDataSource(categoryData);
    }

    // Frequency summary table
    if (this.gtfsImportSummary.byFrequency) {
      const minLabel = $localize`:@@app.view.editor-side-view.gtfs-import-dialogs.summary-minutes:min`;
      const frequencyData = Object.entries(this.gtfsImportSummary.byFrequency).map(
        ([frequency, count]) => ({
          frequency: frequency + " " + minLabel,
          count,
        }),
      );
      this.frequencyDataSource = new SbbTableDataSource(frequencyData);
    }

    // Label summary table
    if (this.gtfsImportSummary.byLabel) {
      const labelData = Object.entries(this.gtfsImportSummary.byLabel).map(([label, count]) => ({
        label,
        count,
      }));
      this.labelDataSource = new SbbTableDataSource(labelData);
    }

    // Trip details table
    if (this.gtfsImportSummary.tripDetails) {
      this.tripsDataSource = new SbbTableDataSource(this.gtfsImportSummary.tripDetails);
      this.tripsDataSource.paginator = this.tripsPaginator;
      this.tripsDataSource.sort = this.tripsSort;
    }
  }

  private setupFilteredLists(): void {
    // Agency autocomplete filter
    this.filteredAgencies$ = this.agencyInputCtrl.valueChanges.pipe(
      startWith(""),
      map((value) => this._filterList(this.gtfsAvailableAgencies, value)),
    );

    // Category autocomplete filter
    this.filteredCategories$ = this.categoryInputCtrl.valueChanges.pipe(
      startWith(""),
      map((value) => this._filterList(this.gtfsAvailableCategories, value)),
    );

    // Line autocomplete filter
    this.filteredLines$ = this.lineInputCtrl.valueChanges.pipe(
      startWith(""),
      map((value) => this._filterList(this.gtfsAvailableRoutes, value)),
    );
  }

  private _filterList(list: string[], filterValue: string | null): string[] {
    if (!filterValue) {
      return list;
    }
    const searchTerm = filterValue.toLowerCase();
    return list.filter((item) => item.toLowerCase().includes(searchTerm));
  }

  closeGtfsFilterDialog(): void {
    this.closeFilterDialog.emit();
  }

  applyGtfsFiltersAndImport(): void {
    this.applyFilters.emit();
  }

  closeGtfsImportOverlay(): void {
    this.closeImportOverlay.emit();
  }

  // Agency handlers (optionSelected from autocomplete)
  onAgencySelected(value: string): void {
    if (value && !this.gtfsSelectedAgencies.includes(value)) {
      this.addAgency.emit(value);
      this.agencyInputCtrl.setValue("");
      this.cdr.markForCheck();
    }
  }

  onRemoveAgency(agency: string): void {
    this.removeAgency.emit(agency);
    this.cdr.markForCheck();
  }

  // Category handlers (optionSelected from autocomplete)
  onCategorySelected(value: string): void {
    if (value && !this.gtfsSelectedCategories.includes(value)) {
      this.addCategory.emit(value);
      this.categoryInputCtrl.setValue("");
      this.cdr.markForCheck();
    }
  }

  onRemoveCategory(category: string): void {
    this.removeCategory.emit(category);
    this.cdr.markForCheck();
  }

  // Line handlers (optionSelected from autocomplete)
  onLineSelected(value: string): void {
    this.tryAddLine(value);
    this.resetLineInput();
  }

  onLineInputSubmit(event: KeyboardEvent): void {
    event.preventDefault();
    this.tryAddLine(this.lineInputCtrl.value || "");
    this.resetLineInput();
  }

  onLineInputBlur(): void {
    this.tryAddLine(this.lineInputCtrl.value || "");
    this.resetLineInput();
  }

  onLineTokenEnd(chipInputEvent: SbbChipInputEvent): void {
    this.tryAddLine(chipInputEvent.value || "");
    this.resetLineInput(chipInputEvent);
  }

  onRemoveLine(line: string): void {
    this.removeLine.emit(line);
    this.cdr.markForCheck();
  }

  onSelectedDateChange(date: string): void {
    this.setSelectedDate.emit(date);
  }

  private tryAddLine(rawValue: string): void {
    const value = (rawValue || "").trim();
    if (!value) {
      return;
    }

    if (!this.gtfsSelectedLines.includes(value)) {
      this.addLine.emit(value);
    }
  }

  private resetLineInput(chipInputEvent?: SbbChipInputEvent): void {
    chipInputEvent?.chipInput?.clear();
    this.lineInputCtrl.setValue("");
    if (this.lineInputElement?.nativeElement) {
      this.lineInputElement.nativeElement.value = "";
    }
    this.cdr.markForCheck();
  }
}
