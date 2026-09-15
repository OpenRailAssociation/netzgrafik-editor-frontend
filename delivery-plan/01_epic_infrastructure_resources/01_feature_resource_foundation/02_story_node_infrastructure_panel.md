# Knoten-Infrastruktur

**Umsetzung:** Das Knotendetail zeigt und bearbeitet nur die Kapazitaet seiner referenzierten Ressource. Die Knoten-Auslastung bezieht ihre Daten ausschliesslich vom `InfrastructureService`: pro ausgerollter Fahrt wird `TrainrunSection`, Start, Ende, Gleisnummer und Kapazitaetsueberschreitung geliefert. Aenderungen an Knoten, Trainrun, TrainrunSection oder Resource loesen eine zentrale Neuberechnung des gesamten Netzes aus. Das Rendering berechnet keine eigenen Belegungen.

**Test:** Ueberlappende Aufenthalte erhalten konfliktfreie Gleisnummern mit minimaler Anzahl Gleise; bei Bedarf oberhalb `capacity` wird die Ueberschreitung markiert. Aenderungen von Takt, Taktlage, Kategorie, Richtung, Fahrzeit oder Kapazitaet aktualisieren die Belegung ohne erneutes Oeffnen der Ansicht. **UI:** Kapazitaet aendern und live pruefen, dass der Bedarf/Bestand am Knoten aktualisiert wird.

**Commit:** `refactor(analytics): render node occupation from infrastructure service`