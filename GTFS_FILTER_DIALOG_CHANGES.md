# GTFS Filter Dialog - Implementation Plan

## Required Changes

### 1. Component Properties (already added)

- gtfsFilterDialogVisible
- gtfsParsedData
- gtfsSelectedAgencies (chip input)
- gtfsAgencySearchText
- gtfsFilteredAgencies
- gtfsSelectedCategories (EC, IC, IR, RE, S)
- gtfsAvailableCategories
- gtfsLineFilter

### 2. onLoadGTFS Function - Replace entire function to:

- Parse GTFS with transport mode filter only
- Extract available agencies and categories
- Set smart defaults (SBB, EC/IC/IR/RE/S)
- Show filter dialog

### 3. New Functions to Add:

- closeGtfsFilterDialog()
- onGtfsAgencySearch()
- addGtfsAgency(agency)
- removeGtfsAgency(agency)
- applyGtfsFiltersAndImport() - applies selected filters and proceeds with import

### 4. HTML Changes:

- Remove agency, category, line filters from sidebar
- Keep transport mode & node classification in sidebar
- Add new filter dialog modal with:
  - Agency chips + autocomplete
  - Category checkboxes
  - Line text input
  - Apply & Cancel buttons

### 5. Implementation Steps:

1. Replace onLoadGTFS to parse and show dialog
2. Add helper functions for dialog
3. Move filter application logic to applyGtfsFiltersAndImport
4. Update HTML to show dialog instead of sidebar filters
