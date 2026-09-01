# Datenvertrag und Persistenz

**Umsetzung:** Optionale Knoten- und Streckenressourcen fuer Gleise, Klasse, Geschwindigkeit, Elektrifizierung, OR-Mapping, Quelle und Zeitpunkt. `ResourceDto`/`Resource` bleiben mit alten JSON-Dateien kompatibel.

**Test:** DTO-Round-trip mit allen Feldern und altes DTO ohne neue Felder. **UI:** nicht anwendbar.

**Commit:** `feat(infrastructure): persist optional node and section resources`