# Gleisbelegungsrechner

**Umsetzung:** Pure Funktion aus Knoten, Zuglaeufen und optionaler Knotenressource. Ergebnis: konfliktfreie zeitliche Belegungsslots, eine zeitlich sortierte Belegungsprofilfolge `von-bis -> benoetigte Spuren`, Mindestbedarf als Maximum des Profils und optional Kapazitaet, Auslastung, `sufficient`/`tight`/`overloaded`. Das Profil wird spaeter im Knoten-Infrastrukturpanel als Gleisbelegung der Streckengrafik visualisiert.

**Test:** Parallele Aufenthalte, fehlende Ressource und Kapazitaetsgrenzen. **UI:** nicht anwendbar.

**Commit:** `refactor(analytics): extract pure node occupancy calculator`