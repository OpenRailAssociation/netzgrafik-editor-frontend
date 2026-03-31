// NEW onLoadGTFS Function
// Replace the entire onLoadGTFS function (from line ~310 to ~676) with this:

async onLoadGTFS(event: any) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  console.log('\n════════════════════════════════════════════');
  console.log('🚀 GTFS FILE SELECTED');
  console.log('════════════════════════════════════════════\n');
  console.log('📁 File:', file.name);
  console.log('📦 Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
  
  // Show overlay and start capturing console logs for parsing phase
  this.gtfsImportOverlayVisible = true;
  this.gtfsImportLogs = [];
  this.startCapturingConsoleLogs();
  
  try {
    // PHASE 1: Parse GTFS file (with transport mode filter only)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('PHASE 1: PARSING GTFS ZIP FILE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Convert transport mode filter to route_type números
    const allowedRouteTypes: number[] = [];
    if (this.gtfsRouteTypeFilter.tram) allowedRouteTypes.push(0);
    if (this.gtfsRouteTypeFilter.metro) allowedRouteTypes.push(1);
    if (this.gtfsRouteTypeFilter.rail) {
      allowedRouteTypes.push(2, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 117);
    }
    if (this.gtfsRouteTypeFilter.bus) allowedRouteTypes.push(3);
    if (this.gtfsRouteTypeFilter.ferry) allowedRouteTypes.push(4);
    
    console.log('🔍 Transport mode filter:', allowedRouteTypes);
    console.log('ℹ️  Parsing without agency/category/line filters (will be applied in dialog)...');
    
    // Parse GTFS (no agency filter yet)
    const gtfsData = await this.gtfsParserService.parseGTFSZip(file, allowedRouteTypes, []);
    
    console.log('\n✅ GTFS file parsed successfully!');
    console.log('📊 Available data:');
    console.log('  - Agencies:', gtfsData.allAgencies?.length || 0);
    console.log('  - Routes:', gtfsData.routes.length);
    console.log('  - Trips:', gtfsData.trips.length);
    console.log('  - Stops:', gtfsData.stops.length);
    
    // Stop capturing logs, hide overlay
    this.stopCapturingConsoleLogs();
    this.gtfsImportOverlayVisible = false;
    
    // PHASE 2: Extract available agencies and categories
    this.gtfsAvailableAgencies = (gtfsData.allAgencies || gtfsData.agencies || [])
      .map(a => a.agency_name)
      .filter((name, idx, arr) => arr.indexOf(name) === idx) // Unique
      .sort();
    
    // Extract categories from route_desc and route_short_name
    const categorySet = new Set<string>();
    gtfsData.routes.forEach(route => {
      // From route_desc
      const desc = (route.route_desc || '').trim().toUpperCase();
      if (desc && desc.length <= 3) {
        categorySet.add(desc);
      }
      // From route_short_name prefix (e.g., "IR15" → "IR")
      const shortName = (route.route_short_name || '').trim().toUpperCase();
      const match = shortName.match(/^([A-Z]{1,3})/);
      if (match) {
        categorySet.add(match[1]);
      }
    });
    this.gtfsAvailableCategories = Array.from(categorySet).sort();
    
    console.log('\n📋 Available agencies:', this.gtfsAvailableAgencies.length);
    console.log('   Sample:', this.gtfsAvailableAgencies.slice(0, 5));
    console.log('📋 Available categories:', this.gtfsAvailableCategories);
    
    // PHASE 3: Set smart defaults
    // Default agency: SBB if available, otherwise empty
    const sbbAgency = this.gtfsAvailableAgencies.find(a => 
      a.toUpperCase().includes('SBB') || 
      a.toUpperCase().includes('BUNDESBAHN') ||
      a.toUpperCase().includes('SCHWEIZERISCHE')
    );
    this.gtfsSelectedAgencies = sbbAgency ? [sbbAgency] : [];
    
    // Default categories: EC, IC, IR, RE, S (if available)
    this.gtfsSelectedCategories = {
      EC: false,
      IC: false,
      IR: false,
      RE: false,
      S: false,
    };
    ['EC', 'IC', 'IR', 'RE', 'S'].forEach(cat => {
      if (this.gtfsAvailableCategories.includes(cat)) {
        this.gtfsSelectedCategories[cat] = true;
      }
    });
    
    // Default line filter: empty
    this.gtfsLineFilter = '';
    
    // Initialize autocomplete
    this.gtfsAgencySearchText = '';
    this.gtfsFilteredAgencies = [...this.gtfsAvailableAgencies];
    
    console.log('\n✅ Smart defaults set:');
    console.log('  - Agencies:', this.gtfsSelectedAgencies);
    console.log('  - Categories:', Object.keys(this.gtfsSelectedCategories).filter(k => this.gtfsSelectedCategories[k]));
    
    // Store parsed data
    this.gtfsParsedData = gtfsData;
    
    // PHASE 4: Show filter dialog
    console.log('\n🎛️  Opening filter dialog...');
    this.gtfsFilterDialogVisible = true;
    
  } catch (error) {
    this.stopCapturingConsoleLogs();
    console.error('\n❌ ERROR PARSING GTFS:');
    console.error('Error:', error);
    
    let userMessage = '';
    if (error?.message?.includes('Invalid string length') || error?.message?.includes('out of memory')) {
      userMessage = 'Die GTFS-Datei ist zu groß für den Browser-Speicher. ' +
                   'Bitte verwenden Sie eine kleinere GTFS-Datei oder filtern Sie die Daten vor dem Import.';
    } else {
      userMessage = error?.message || String(error);
    }
    
    this.logger.error($localize`:@@app.view.editor-side-view.editor-tools-view-component.gtfs-error:Error importing GTFS data: ${userMessage}`);
  }

  // Reset input to allow importing same file again
  event.target.value = null;
}
