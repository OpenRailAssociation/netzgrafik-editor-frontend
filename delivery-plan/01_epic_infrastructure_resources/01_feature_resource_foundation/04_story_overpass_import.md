# Overpass-Import

**Umsetzung:** Testbaren Overpass-Client mit bewusster Einzel- und Bulk-Ausloesung. Fehler lassen Daten unveraendert; manuelle Daten duerfen nur nach Warnung ueberschrieben werden.

**Test:** HTTP-Mocks fuer Erfolg, leere Antwort, Fehler und Ueberschreibwarnung. **UI:** Einzelimport, manuelle Aenderung, erneuter Import mit Warnung.

**Commit:** `feat(infrastructure): import resources from overpass`