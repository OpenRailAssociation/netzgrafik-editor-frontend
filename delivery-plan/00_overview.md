# Variantenvergleich und Streckengrafik

Struktur: `nummer_epic_name/nummer_feature_name/nummer_story_name.md`. Jede Story ist eine einzeln testbare Commit-Grenze. Reine Daten- und Berechnungsstories haben keinen manuellen UI-Test.

## 00 - Vergleichsgrundlage

Dieses Epic definiert die fachlich korrekte, skalierbare Vergleichsmethode und eine klare, im Editor verankerte Visualisierung.

1. [Evidenzbasierter Delta-Algorithmus](00_epic_comparison_foundation/01_feature_comparison_architecture/01_story_evidence_based_delta_algorithm.md): Legt die indexierte Fachobjektzuordnung, Komplexitaet und Fehlerbehandlung fest.
2. [Vergleichsvisualisierung und HMI](00_epic_comparison_foundation/02_feature_visual_comparison_design/01_story_comparison_visual_language.md): Beschreibt Layer, Statussprache, Interaktion und Literaturgrundlage.

## 01 - Infrastrukturressourcen

Dieses Epic schafft optionale, persistierte Daten fuer reale Kapazitaeten und deren bewusste Erfassung oder Import.

1. [Datenvertrag und Persistenz](01_epic_infrastructure_resources/01_feature_resource_foundation/01_story_data_contract_and_persistence.md): Fuehrt das rueckwaertskompatible Ressourcenmodell ein.
2. [Knoten-Infrastruktur](01_epic_infrastructure_resources/01_feature_resource_foundation/02_story_node_infrastructure_panel.md): Macht Bahnhofsgleise im Knotendetail bearbeitbar.
3. [Strecken-Infrastruktur](01_epic_infrastructure_resources/01_feature_resource_foundation/03_story_section_infrastructure_panel.md): Macht die gemeinsamen Attribute jeder physischen Kante A-B in einem eigenen Tab bearbeitbar.
4. [Externer Infrastrukturimport - Zurueckgestellt](01_epic_infrastructure_resources/01_feature_resource_foundation/04_story_overpass_import.md): Dokumentiert den verworfenen Overpass-Prototyp und den neutralen Stammdaten-/Backend-Nachfolger.

## 02 - Reine Streckengrafikberechnungen

Dieses Epic trennt fachliche Berechnungen von Angular und Datenservices, damit sie wiederverwendbar vergleichbar sind.

1. [Gleisbelegungsrechner](02_epic_pure_graph_calculations/01_feature_occupancy_and_capacity/01_story_node_occupancy_calculator.md): Berechnet zeitlichen Gleisbedarf pro Knoten.
2. [Gleisbelegungsadapter](02_epic_pure_graph_calculations/01_feature_occupancy_and_capacity/02_story_node_occupancy_adapter.md): Erhaelt die bisherige Anzeige ueber den neuen Rechner.
3. [Track Estimator](02_epic_pure_graph_calculations/02_feature_track_topology/01_story_track_estimator.md): Ermittelt den Gleisbedarf von Streckenabschnitten.
4. [Kapazitaetskonflikte](02_epic_pure_graph_calculations/03_feature_conflict_detection/01_story_capacity_conflicts.md): Meldet Bedarf oberhalb vorhandener Infrastruktur.

## 03 - Delta-Core

Dieses Epic liefert die wiederverwendbare Vergleichsmaschine und fachliche Identitaeten ohne technische IDs.

1. [Generischer Delta-Core](03_epic_delta_core/01_feature_generic_comparison/01_story_generic_delta_core.md): Vergleicht beliebige Objektlisten ohne Seiteneffekte.
2. [Fachliche Identitaeten](03_epic_delta_core/02_feature_business_identity/01_story_business_identity_strategies.md): Ordnet Knoten, Zuglaeufe und Abschnitte fachlich zu.
3. [Netzgrafik-Reports](03_epic_delta_core/03_feature_graph_delta_reports/01_story_graph_object_reports.md): Erstellt detaillierte Deltas fuer alle Netzgrafikobjekte.

## 04 - Referenzvariante und State

Dieses Epic laedt eine passive Referenz und aktualisiert ihre Vergleichsergebnisse bei aktiven Aenderungen.

1. [Vergleichsstate und Referenzimport](04_epic_reference_variant_state/01_feature_reference_loading/01_story_reference_state_and_import.md): Speichert eine schreibgeschuetzte Referenz im bestehenden Datenfluss.
2. [Automatische Delta-Aktualisierung](04_epic_reference_variant_state/02_feature_delta_refresh/01_story_automatic_delta_refresh.md): Haelt den Vergleich ohne manuelles Aktualisieren aktuell.

## 05 - Vergleichsanalytics

Dieses Epic bindet den Vergleich in die Analytics ein und stellt Unterschiede in einer gemeinsamen Grafikgeometrie dar.

1. [Einstieg und Statistik](05_epic_comparison_analytics/01_feature_analytics_summary/01_story_comparison_entry_and_statistics.md): Fuegt die Kategorie und Management-Zahlen hinzu.
2. [Suche, Filter und Details](05_epic_comparison_analytics/02_feature_search_filter_details/01_story_filters_search_and_delta_details.md): Macht Aenderungen auffindbar und erklaerbar.
3. [Vergleichsgeometrie](05_epic_comparison_analytics/03_feature_layout_alignment/01_story_shared_comparison_geometry.md): Richtet Varianten nur fuer die Darstellung aus.
4. [Delta- und Konfliktvisualisierung](05_epic_comparison_analytics/04_feature_svg_visualization/01_story_delta_and_conflict_visualization.md): Zeigt Statusfarben, Geisterobjekte und Konflikte.

## 06 - O/D-Matrixvergleich

Dieses Epic demonstriert den Delta-Core an einem ersten KPI mit Reisezeit, Umstieg und Erreichbarkeit.

1. [Reine O/D-Berechnung](06_epic_od_matrix_comparison/01_feature_pure_od_calculation/01_story_pure_origin_destination_calculation.md): Entkoppelt die O/D-Logik vom Anwendungszustand.
2. [O/D-Delta und Darstellung](06_epic_od_matrix_comparison/02_feature_od_delta_visualization/01_story_od_comparison_and_display.md): Vergleicht und visualisiert die KPI-Ergebnisse.