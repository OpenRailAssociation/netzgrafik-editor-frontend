# GTFS Import Feature

## Overview

The GTFS (General Transit Feed Specification) import feature allows you to import public transit timetable data directly into the Netzgrafik-Editor. This feature is particularly useful for:

- Importing Swiss public transport data from [Open Transport Data](https://opentransportdata.swiss/)
- Converting GTFS schedules into visual network graphics
- Creating regular timetable patterns from real-world transit data

## How to Use

### 1. Obtain GTFS Data

Download GTFS data in ZIP format from sources such as:

- [Swiss GTFS 2026 Data](https://data.opentransportdata.swiss/dataset/timetable-2026-gtfs2020)
- [GTFS Cookbook](https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/)

### 2. Import GTFS Data

1. Open the Netzgrafik-Editor
2. Navigate to the tools panel (right side)
3. Expand the "GTFS" section
4. Click the "Import GTFS data" button
5. Select the GTFS ZIP file from your computer
6. Wait for the import process to complete

### 3. Import Process

The import process consists of three main steps:

1. **Parsing** - The ZIP file is extracted and GTFS CSV files are parsed
2. **Converting** - GTFS data is converted to Netzgrafik format:
   - Stops → Nodes (stations)
   - Trips → Trainruns
   - Stop times → Trainrun sections
3. **Importing** - The converted data is loaded into the editor

## GTFS Files Used

The importer processes the following GTFS files:

- **stops.txt** - Station/stop information (location, name)
- **routes.txt** - Transit route information (line names, types)
- **trips.txt** - Individual trip instances
- **stop_times.txt** - Timing information for each stop on each trip
- **calendar.txt** (optional) - Service schedule patterns

## Conversion Details

### Coordinate Transformation

GTFS uses WGS84 latitude/longitude coordinates, which are converted to canvas coordinates:

- Center point: approximately Switzerland's geographic center (46.8°N, 8.2°E)
- Scale factor: 15,000 (adjustable)
- Y-axis is inverted for proper display

### Trip Pattern Recognition

The converter identifies trip patterns by:

- Grouping trips with identical stop sequences
- Selecting representative trips from each pattern
- Limiting the number of imported patterns (default: 10 per route)

### Station Code Generation

Station codes (BP) are generated from:

- Original GTFS stop_id (if ≤ 8 characters)
- Abbreviation from stop name (initials or truncated name)

### Time Handling

- GTFS times (HH:MM:SS) are converted to minutes since midnight
- Only the minute portion (0-59) is stored in Netzgrafik format
- Travel times are calculated between consecutive stops

## Import Options

The following options can be configured in the code (future UI controls planned):

- **maxTripsPerRoute** (default: 10) - Maximum number of trip patterns to import per route
- **minStopsPerTrip** (default: 3) - Minimum stops required for a trip to be imported
- **onlyRegularService** (future) - Filter for regular weekday services only

## Known Limitations

1. **Simplified Data Model**
   - The Netzgrafik model is optimized for periodic timetables
   - Not all GTFS details (calendars, exceptions, etc.) are preserved

2. **Coordinate Approximation**
   - Geographic coordinates are simplified to 2D canvas positions
   - Manual adjustment of node positions may be needed for optimal visualization

3. **Pattern Selection**
   - Only a subset of trips are imported (to avoid overwhelming the editor)
   - Manual review and selection of relevant patterns is recommended

4. **No Round-trip Detection**
   - Imported trainruns are marked as ONE_WAY
   - Round trips must be manually configured

## Next Steps After Import

After importing GTFS data:

1. **Review Station Positions** - Adjust node positions for better visualization
2. **Configure Haltezeiten** - Set appropriate stop times for each station category
3. **Add Transitions** - Define passenger connections within stations
4. **Add Connections** - Define transfers between different trainruns
5. **Filter Data** - Use labels and filters to focus on specific routes or regions
6. **Create Symmetry** - Adjust times to create symmetric timetable patterns if desired

## Technical Architecture

### Services

- **GTFSParserService** (`gtfs-parser.service.ts`)
  - Parses GTFS ZIP files using JSZip
  - Extracts and parses CSV files using PapaParse
  - Provides interfaces for GTFS data structures

- **GTFSConverterService** (`gtfs-converter.service.ts`)
  - Converts GTFS data to Netzgrafik format
  - Handles coordinate transformation
  - Identifies trip patterns
  - Generates station codes

### Data Flow

```
GTFS ZIP File
    ↓
GTFSParserService.parseGTFSZip()
    ↓
GTFSData (stops, routes, trips, stop_times)
    ↓
GTFSConverterService.convertToNetzgrafik()
    ↓
NetzgrafikDto (nodes, trainruns, trainrunSections)
    ↓
DataService.loadNetzgrafikDto()
    ↓
Editor Display
```

## Dependencies

- **jszip** - ZIP file parsing
- **papaparse** - CSV parsing (already used in the project)

## Troubleshooting

### "Error importing GTFS data"

Check the browser console for detailed error messages. Common issues:

- Invalid ZIP file format
- Missing required GTFS files (stops.txt, routes.txt, trips.txt, stop_times.txt)
- Corrupted CSV data

### "No data imported"

Ensure that:

- The GTFS data contains trips with at least 3 stops
- The ZIP file is properly formatted GTFS data
- The files are encoded in UTF-8

### "Nodes overlap or are positioned incorrectly"

The coordinate transformation may need adjustment:

- Manually reposition nodes after import
- Consider adjusting SCALE_FACTOR in the converter service

## Future Enhancements

Planned improvements:

- UI controls for import options (max trips, filters, etc.)
- Better pattern recognition (identify regular intervals)
- Calendar-based service filtering
- Round-trip detection
- Improved coordinate projection for different geographic regions
- Support for asymmetric timetables
- Direct API integration with Open Transport Data

## References

- [GTFS Specification](https://gtfs.org/schedule/reference/)
- [Open Transport Data Switzerland](https://opentransportdata.swiss/)
- [Netzgrafik-Editor Documentation](../README.md)
