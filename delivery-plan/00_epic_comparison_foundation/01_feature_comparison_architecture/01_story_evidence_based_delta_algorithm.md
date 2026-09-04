# Evidenzbasierter Delta-Algorithmus

**Umsetzung:** Der Kern verwendet keine allgemeine Graph-Isomorphie und keinen vollstaendigen Graph Edit Distance als Laufzeitpfad. Er erstellt fuer aktive und Referenzvariante Hash-Indizes aus fachlichen Schluesseln und vergleicht nur zugeordnete Objekte, Attribute und geordnete Haltfolgen. Damit bleibt der Vergleich bei $O(|V| + |E| + |T|)$ fuer Knoten, Abschnitte und Zuglaeufe. Unsichere Identitaeten werden explizit als Konflikt gemeldet, statt still falsch zuzuordnen.

**Warum:** Exakte Graph-Edit-Distance ist fuer allgemeine Graphen teuer; die stabilen Bahndomaenen-Schluessel liefern hier einen nachvollziehbaren und skalierbaren Vergleich. Siehe Bunke, *On a relation between graph edit distance and maximum common subgraph*, Pattern Recognition Letters 18(8), 1997, DOI: https://doi.org/10.1016/S0167-8655(97)00060-3. DeltaCon ist lediglich eine spaetere Option fuer globale Aehnlichkeits-KPIs, nicht fuer Objektzuordnung: Koutra et al., SDM 2013, DOI: https://doi.org/10.1137/1.9781611972832.21.

**Test:** Grosse synthetische Netze mit fester Laufzeitobergrenze, gleiche Fachobjekte mit verschiedenen IDs, mehrdeutige Namen und geaenderte Haltfolge. **UI:** nicht anwendbar.

**Commit:** `docs(comparison): define scalable delta architecture`