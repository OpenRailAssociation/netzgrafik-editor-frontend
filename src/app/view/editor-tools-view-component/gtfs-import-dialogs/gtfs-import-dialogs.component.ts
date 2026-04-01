import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-gtfs-import-dialogs',
  templateUrl: './gtfs-import-dialogs.component.html',
  styleUrls: ['./gtfs-import-dialogs.component.scss']
})
export class GtfsImportDialogsComponent implements OnInit, OnChanges {
  // Form controls for autocomplete input filtering
  agencyInputCtrl = new FormControl('');
  categoryInputCtrl = new FormControl('');
  lineInputCtrl = new FormControl('');
  
  // Observable filtered lists for autocomplete (async pipe)
  filteredAgencies$!: Observable<string[]>;
  filteredCategories$!: Observable<string[]>;
  filteredLines$!: Observable<string[]>;
  
  @Input() gtfsFilterDialogVisible = false;
  @Input() gtfsImportOverlayVisible = false;
  @Input() gtfsImportLogs: string[] = [];
  @Input() gtfsImportPhases: any[] = [];
  @Input() gtfsImportComplete = false;
  
  // Available data from light parse
  @Input() gtfsAvailableAgencies: string[] = [];
  @Input() gtfsAvailableCategories: string[] = [];
  @Input() gtfsAvailableRoutes: string[] = [];
  
  // Selected filters
  @Input() gtfsSelectedAgencies: string[] = [];
  @Input() gtfsSelectedCategories: string[] = [];
  @Input() gtfsSelectedLines: string[] = [];
  
  // Note: Filtered lists are now computed as Observables (filteredAgencies$, etc.)
  
  // Warnings
  @Input() gtfsNoCategoriesWarning = false;
  @Input() gtfsNoLinesWarning = false;
  
  // Filters
  @Input() gtfsRouteTypeFilter: any;
  @Input() gtfsNodeFilter: any;
  
  // Time sync tolerance for round-trip matching (in seconds)
  @Input() gtfsTimeSyncTolerance = 150;
  @Output() gtfsTimeSyncToleranceChange = new EventEmitter<number>();
  
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
  
  ngOnInit(): void {
    // Setup observable filtered lists for autocomplete
    this.setupFilteredLists();
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    // Re-setup filtered lists when available data changes
    if (changes['gtfsAvailableAgencies'] || changes['gtfsAvailableCategories'] || changes['gtfsAvailableRoutes']) {
      this.setupFilteredLists();
    }
  }
  
  private setupFilteredLists(): void {
    // Agency autocomplete filter
    this.filteredAgencies$ = this.agencyInputCtrl.valueChanges.pipe(
      startWith(''),
      map(value => this._filterList(this.gtfsAvailableAgencies, value))
    );
    
    // Category autocomplete filter
    this.filteredCategories$ = this.categoryInputCtrl.valueChanges.pipe(
      startWith(''),
      map(value => this._filterList(this.gtfsAvailableCategories, value))
    );
    
    // Line autocomplete filter
    this.filteredLines$ = this.lineInputCtrl.valueChanges.pipe(
      startWith(''),
      map(value => this._filterList(this.gtfsAvailableRoutes, value))
    );
  }
  
  private _filterList(list: string[], filterValue: string | null): string[] {
    if (!filterValue) {
      return list;
    }
    const searchTerm = filterValue.toLowerCase();
    return list.filter(item => item.toLowerCase().includes(searchTerm));
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
      this.agencyInputCtrl.setValue('');
    }
  }
  
  onRemoveAgency(agency: string): void {
    this.removeAgency.emit(agency);
  }
  
  // Category handlers (optionSelected from autocomplete)
  onCategorySelected(value: string): void {
    if (value && !this.gtfsSelectedCategories.includes(value)) {
      this.addCategory.emit(value);
      this.categoryInputCtrl.setValue('');
    }
  }
  
  onRemoveCategory(category: string): void {
    this.removeCategory.emit(category);
  }
  
  // Line handlers (optionSelected from autocomplete)
  onLineSelected(value: string): void {
    if (value && !this.gtfsSelectedLines.includes(value)) {
      this.addLine.emit(value);
      this.lineInputCtrl.setValue('');
    }
  }
  
  onRemoveLine(line: string): void {
    this.removeLine.emit(line);
  }
}
