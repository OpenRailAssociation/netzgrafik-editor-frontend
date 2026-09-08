# Automatische Delta-Aktualisierung

**Umsetzung:** Delta-Report bei jeder aktiven Modellaenderung neu berechnen; Entladen setzt Vergleichszustand zurueck.

**Test:** Aktive Mutation aktualisiert Report; Entladen liefert keinen Vergleich. **UI:** Referenz laden, Knoten oder Zuglauf aendern, Anzahl pruefen und Referenz entladen.

**Commit:** `feat(comparison): refresh delta report on active changes`