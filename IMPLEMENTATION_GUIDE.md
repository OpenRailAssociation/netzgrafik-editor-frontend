# GTFS Filter Dialog - Implementierungsanleitung

## ✅ Status: Properties bereits hinzugefügt
Die folgenden Properties sind bereits im Component vorhanden (Zeilen 75-94):
- `gtfsFilterDialogVisible`
- `gtfsParsedData`
- `gtfsSelectedAgencies`
- `gtfsAgencySearchText`
- `gtfsFilteredAgencies`
- `gtfsSelectedCategories`
- `gtfsAvailableCategories`
- `gtfsLineFilter`

## ✅ Status: Hilfsfunktionen bereits hinzugefügt
Die folgenden Funktionen sind bereits im Component vorhanden (Zeilen ~1284-1460):
- `closeGtfsFilterDialog()`
- `onGtfsAgencySearch()`
- `addGtfsAgency(agency)`
- `removeGtfsAgency(agency)`
- `applyGtfsFiltersAndImport()` - KOMPLETT neu implementiert mit vollständiger Filter-Logik

## ⚠️ TODO: onLoadGTFS Function ersetzen

### Aktueller Stand:
Die `onLoadGTFS` Funktion (Zeilen ~310-676) macht momentan:
1. Datei laden
2. Parsen mit Filtern
3. Direkt in Netzgrafik konvertieren
4. Direkt importieren

### Neue Funktionalität:
Die Funktion soll ändern zu:
1. Datei laden
2. Parsen **OHNE** Agency/Category/Line Filter (nur Transport Mode)
3. Verfügbare Agencies und Kategorien extrahieren
4. Smart Defaults setzen (SBB, EC/IC/IR/RE/S)
5. **Filter-Dialog anzeigen**
6. (User wählt aus)
7. (applyGtfsFiltersAndImport wird aufgerufen when user clicks "Import starten")

### Vorgehensweise:
**Option 1: Manuelle Ersetzung (empfohlen)**
1. Öffne `editor-tools-view.component.ts`
2. Finde die `onLoadGTFS` Funktion (ca. Zeile 310)
3. Ersetze die gesamte Funktion (bis Zeile ~676) mit dem Inhalt aus:
   `NEW_ONLOADGTFS_FUNCTION.ts`

**Option 2: Automatische Ersetzung**
```bash
# Backup erstellen
cp src/app/view/editor-tools-view-component/editor-tools-view.component.ts src/app/view/editor-tools-view-component/editor-tools-view.component.ts.backup

# Dann manuell die Funktion zwischen den Zeilen 310-676 ersetzen
```

## ⚠️ TODO: HTML für Filter-Dialog hinzufügen

### Wo einfügen:
Öffne `editor-tools-view.component.html`

Füge den Inhalt aus `GTFS_FILTER_DIALOG.html` ein **NACH** dem GTFS Import Progress Overlay (ca. Zeile 385) und **VOR** `</sbb-accordion>`.

### Reihenfolge der Overlays:
```html
... Sidebar content ...

<!-- GTFS Import Progress Overlay (z-index: 10000) -->
<div *ngIf="gtfsImportOverlayVisible" ...>
  ...
</div>

<!-- GTFS Filter Dialog (z-index: 10001) - NEU HIER EINFÜGEN -->
<div *ngIf="gtfsFilterDialogVisible" ...>
  ...
</div>

</sbb-accordion>
```

## ⚠️ TODO: Sidebar-Filter entfernen (OPTIONAL)

Die folgenden Filter können aus der Sidebar entfernt werden, da sie jetzt im Dialog sind:

### In `editor-tools-view.component.html` (ca. Zeilen 220-270):

**Zu entfernen:**
1. Agency Filter Section (Textarea + Available Agencies)
2. Category Filter Section (Input field) 
3. Route/Line Name Filter Section (Textarea)

**Zu behalten:**
1. Transport Mode Filter (tram, metro, rail, bus, ferry)
2. Node Classification Filter (start, end, junction, major_stop, minor_stop)

### Beispiel-Änderung:
```html
<!-- BEHALTEN: Transport Mode Filter -->
<div style="...">
  <strong>Transport Mode Filter</strong>
  <label><input type="checkbox" [(ngModel)]="gtfsRouteTypeFilter.rail" /> Rail</label>
  ...
</div>

<!-- ENTFERNEN: Agency Filter -->
<!-- 
<div style="...">
  <strong>Agency Filter</strong>
  <textarea [(ngModel)]="gtfsAgencyFilterText" ...></textarea>
</div>
-->

<!-- ENTFERNEN: Category Filter -->
<!--
<div style="...">
  <strong>Category Filter</strong>
  <input [(ngModel)]="gtfsCategoryFilterText" ...>
</div>
-->

<!-- ENTFERNEN: Line Filter -->
<!--
<div style="...">
  <strong>Line Filter</strong>
  <textarea [(ngModel)]="gtfsRouteNameFilterText" ...></textarea>
</div>
-->

<!-- BEHALTEN: Node Classification Filter -->
<div style="...">
  <strong>Node Classification Filter</strong>
  <label><input type="checkbox" [(ngModel)]="gtfsNodeFilter.start" /> Start</label>
  ...
</div>
```

## 🧪 Testen

Nach der Implementierung:

1. **GTFS-Datei auswählen:**
   - Klicke auf "Import GTFS Data"
   - Wähle eine ZIP-Datei
   - Progress Overlay erscheint während Parsing

2. **Filter-Dialog erscheint:**
   - Zeigt verfügbare Agencies
   - Zeigt verfügbare Kategorien
   - Smart Defaults sind gesetzt:
     * Agency: "Schweizerische Bundesbahnen SBB" (falls vorhanden)
     * Kategorien: EC, IC, IR, RE, S (falls vorhanden)
     * Linien: leer

3. **Filter anpassen:**
   - Agencies: Suchen und als Chips hinzufügen/entfernen
   - Kategorien: Checkboxen aktivieren/deaktivieren
   - Linien: Text eingeben (z.B. "IR15, IC1")

4. **Import starten:**
   - Klick auf "✅ Import starten"
   - Progress Overlay zeigt Filterung und Konvertierung
   - Daten werden importiert

5. **Fehlerfälle testen:**
   - Zu große Datei (> 50 MB Warnung)
   - Keine passenden Daten nach Filterung
   - Abbrechen-Button

## 📋 Verwendete Dateien

1. `NEW_ONLOADGTFS_FUNCTION.ts` - Neue onLoadGTFS Funktion
2. `GTFS_FILTER_DIALOG.html` - HTML für Filter-Dialog
3. `GTFS_FILTER_DIALOG_CHANGES.md` - Übersicht der Änderungen
4. Diese Datei - Implementierungsanleitung

## 🎯 Ergebnis

Nach der Implementierung:

**Alter Workflow:**
1. Filter in Sidebar setzen → 2. Datei laden → 3. Import

**Neuer Workflow:**
1. Transport Mode in Sidebar setzen → 2. Datei laden → 3. **Dialog mit intelligenten Defaults** → 4. Filter anpassen → 5. Import starten

**Vorteile:**
- ✅ User sieht verfügbare Werte (Autocomplete)
- ✅ Smart Defaults (SBB, EC/IC/IR/RE/S)
- ✅ Bessere UX mit Chips für Agencies
- ✅ Übersichtlicher Dialog statt Sidebar-Overload
- ✅ Transport Mode & Node Filter bleiben in Sidebar (1st pass)
