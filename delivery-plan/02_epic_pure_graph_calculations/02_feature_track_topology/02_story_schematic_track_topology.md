# Schematische Gleis-Topologie

**Umsetzung:** Das Ergebnis des reinen Track Estimators im Infrastruktur-Tab einer physischen Kante A-B als kompakte SVG-Skizze rendern. Jedes Segment zeigt die aktuell benoetigte Spuranzahl als Breite oder parallele Linien: beispielsweise einspurig, kurz zweispurig, wieder einspurig, danach zwei-, drei-, vier-, zwei- und einspurig. Neben der Skizze steht eindeutig `Maximal 4 Spuren erforderlich`. Die Darstellung ist rein abgeleitet und nie editierbar.

**Test:** Renderer-Test mit der Folge `1-2-1-2-3-4-2-1`; Text muss das Maximum `4` liefern. UI: Abschnitts-Infrastruktur oeffnen, Skizze gegen bekannte Zuglaeufe pruefen und kontrollieren, dass alle Sections derselben Kante dieselbe Topologie zeigen.

**Commit:** `feat(analytics): render required physical edge topology`