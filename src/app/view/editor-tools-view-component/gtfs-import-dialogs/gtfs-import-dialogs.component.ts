import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-gtfs-import-dialogs',
  templateUrl: './gtfs-import-dialogs.component.html',
  styleUrls: ['./gtfs-import-dialogs.component.scss']
})
export class GtfsImportDialogsComponent {
  @Input() gtfsFilterDialogVisible = false;
  @Input() gtfsImportOverlayVisible = false;
  @Input() gtfsDataIsLoading = false;
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
  
  // Search texts and filtered lists
  @Input() gtfsAgencySearchText = '';
  @Input() gtfsFilteredAgencies: string[] = [];
  @Input() gtfsCategorySearchText = '';
  @Input() gtfsFilteredCategories: string[] = [];
  @Input() gtfsLineSearchText = '';
  @Input() gtfsFilteredLines: string[] = [];
  
  // Filters
  @Input() gtfsRouteTypeFilter: any;
  @Input() gtfsNodeFilter: any;
  
  // Events
  @Output() closeFilterDialog = new EventEmitter<void>();
  @Output() applyFilters = new EventEmitter<void>();
  @Output() closeImportOverlay = new EventEmitter<void>();
  
  @Output() agencySearch = new EventEmitter<void>();
  @Output() addAgency = new EventEmitter<string>();
  @Output() removeAgency = new EventEmitter<string>();
  
  @Output() categorySearch = new EventEmitter<void>();
  @Output() addCategory = new EventEmitter<string>();
  @Output() removeCategory = new EventEmitter<string>();
  
  @Output() lineSearch = new EventEmitter<void>();
  @Output() addLine = new EventEmitter<string>();
  @Output() removeLine = new EventEmitter<string>();
  
  closeGtfsFilterDialog(): void {
    this.closeFilterDialog.emit();
  }
  
  applyGtfsFiltersAndImport(): void {
    this.applyFilters.emit();
  }
  
  closeGtfsImportOverlay(): void {
    this.closeImportOverlay.emit();
  }
  
  onGtfsAgencySearch(): void {
    this.agencySearch.emit();
  }
  
  addGtfsAgency(agency: string): void {
    this.addAgency.emit(agency);
  }
  
  removeGtfsAgency(agency: string): void {
    this.removeAgency.emit(agency);
  }
  
  onGtfsCategorySearch(): void {
    this.categorySearch.emit();
  }
  
  addGtfsCategory(category: string): void {
    this.addCategory.emit(category);
  }
  
  removeGtfsCategory(category: string): void {
    this.removeCategory.emit(category);
  }
  
  onGtfsLineSearch(): void {
    this.lineSearch.emit();
  }
  
  addGtfsLine(line: string): void {
    this.addLine.emit(line);
  }
  
  removeGtfsLine(line: string): void {
    this.removeLine.emit(line);
  }
}
