# Vergleichsvisualisierung und HMI

**Umsetzung:** Die existierende D3/SVG-Netzgrafik bleibt der Renderer. Delta-Status werden als CSS-Klassen an vorhandenen D3-Layern angewendet; entfernte Objekte liegen in einem eigenen, nicht editierbaren Referenz-Geisterlayer. Farbe wird nie allein verwendet: hinzugefuegt = gruener Vollstrich, veraendert = orange Kontur, entfernt = roter Strich mit Muster, unveraendert = grauer reduzierter Kontrast. Konflikte erhalten eine separate Warnmarkierung. Hover, Auswahl und rechte Detailansicht nutzen die vorhandenen DOM-Tags.

**Warum:** Stabiler Kontext und redundante visuelle Kodierung erlauben den Vergleich ohne die Orientierung im Netz zu verlieren. Die Koordinaten der Varianten bleiben unveraendert; Alignment erzeugt ausschliesslich eine temporare Darstellungsprojektion. Als Grundlage: Bach et al., *A Review of Dynamic Graph Visualization*, Computer Graphics Forum 33(1), 2014, DOI: https://doi.org/10.1111/cgf.12300.

**Bibliotheken:** D3 ist bereits Bestandteil des Editors und geeignet fuer datengetriebene SVG-Layer: https://github.com/d3/d3. Graphology bleibt eine moegliche Erweiterung fuer spaetere umfangreiche Graphmetriken, wird aber nicht fuer den ersten Delta-Core eingefuehrt: https://github.com/graphology/graphology. Cytoscape.js wird nicht parallel eingefuehrt, da ein zweiter Renderer die bestehende HMI fragmentieren wuerde: https://github.com/cytoscape/cytoscape.js.

**Test:** Renderer-Klassen, Layer-Reihenfolge, Tastatur-/Pointer-Auswahl und fehlende Editierbarkeit von Geisterobjekten. **UI:** Status an einem kleinen Beispielnetz pruefen, einschliesslich Farbe, Strichmuster, Detailpanel und Konfliktmarkierung.

**Commit:** `docs(comparison): define accessible graph comparison visual language`