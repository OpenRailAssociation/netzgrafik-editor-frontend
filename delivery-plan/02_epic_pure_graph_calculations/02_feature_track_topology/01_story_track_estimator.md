# Track Estimator

**Umsetzung:** Pure Funktion fuer die physische, richtungsunabhaengige Kante $\{A,B\}$ aus zwei Knoten, Zuglaeufen und optionaler Streckenressource. Ergebnis: Richtung, Taktfolge, Mindestgleise sowie eine geordnete Topologiefolge `Startposition-Endposition -> benoetigte Spuren`. Die maximale Spurzahl der Folge ist der fachlich benoetigte Ausbauwert der Kante; optional folgt ein Kapazitaetsvergleich.

**Test:** Gegenrichtung, ein-, zwei-, mehrgleisig und keine Ressource. **UI:** nicht anwendbar.

**Commit:** `refactor(analytics): extract pure track estimator`