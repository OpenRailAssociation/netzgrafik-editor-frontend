# Vergleichsstate und Referenzimport

**Umsetzung:** Vergleichsstate mit Referenz-DTO, Aktivierung, Filtern und Suchbegriff. JSON laden, deserialisieren und als passive, nicht editierbare Datenstruktur speichern. Die vorhandenen servicebasierten Observable-Stores werden verwendet; keine zweite Store-Architektur.

**Test:** Gueltige Referenz, ungueltiges JSON, fehlende Pflichtdaten und Read-only-Status. **UI:** Referenz laden und aktive Variante weiter bearbeiten.

**Commit:** `feat(comparison): load read-only reference variant`