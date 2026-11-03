# Zielbild: Fahrplanoptimierer schrittweise und messbar verbessern

## Ziel und unverhandelbare Regeln

Der Optimierer darf ausschliesslich Vorschläge ausgeben, die alle aktiven harten
Regeln erfüllen. Harte Regeln dürfen nicht gegen bessere weiche Zielwerte
aufgerechnet werden. Wenn keine gültige Lösung gefunden wird, muss der Optimierer
das klar melden und darf keinen fast gültigen Vorschlag anbieten. Erst danach
werden gültige Vorschläge anhand der weichen Ziele verglichen und sortiert.

Der Solver verändert bestehende Zugläufe und ihre Zeiten. Er plant keine neuen
Routen. Rechenzeit bleibt begrenzt und die Suche anytime-fähig: jeder zusätzliche
Rechenaufwand muss innerhalb des vorgegebenen Budgets zu verwertbaren gültigen
Vorschlägen führen. Das Produktziel ist „in wenigen Sekunden“ auch bei grossen
Netzgrafiken im Browser. Das UI bietet aktuell bis zu 4 Sekunden Suchbudget;
Vorbereitung und Endprüfung kommen momentan zusätzlich dazu. Der End-to-End-
Zielwert muss deshalb auf einem festgelegten Grossnetz-Benchmark gemessen werden.
Eine harte Echtzeitgarantie besteht noch nicht.

## Ist-Zustand im Repository

Die aktuelle Suche ist bereits ein schneller TypeScript-Hybrid:

- Inkrementelle Bewertung und Konfliktindizes vermeiden unnötige Neubewertungen.
- Konfliktorientierte Min-Conflicts-/Tabu-Schritte reparieren betroffene Variablen.
- Simulated Annealing erkundet alternative Zustände.
- LNS verändert nach Stagnation eine konfliktnahe Gruppe von Variablen.
- Ein begrenztes Pareto-Archiv hält gültige, nicht dominierte Lösungen.
- Die Suchsession kann mit demselben Zufallszustand, Tabu-Zustand und Archiv
  fortgesetzt werden.
- Automatische Folgeversuche starten mit dem besten internen Zustand des
  vorherigen Versuchs und einem neuen Seed, statt wieder beim Ausgangsfahrplan
  zu beginnen. Der Warmstart ist nicht zwingend bereits gültig.
- Kandidatenzusammenfassungen halten Halte- und Anschlussverletzungen
  inkrementell vor; `parts()` muss dafür nicht mehr alle Einträge linear
  aufsummieren. Lange Suchschleifen geben dem Browser ungefähr alle 16 ms
  Gelegenheit zur Verarbeitung.

Der Suchlauf archiviert nur Kandidaten ohne harte Verletzungen. Zusätzlich
filtert der Service ungültige Endvorschläge und prüft Anschlüsse unabhängig aus
den nativen Anschlussdaten. Weiche Ziele werden derzeit geometrisch gewichtet;
das ist keine strikt lexikografische Rangfolge. Ein repräsentativer
Grossnetz-Benchmark ist noch nicht vorhanden.

Die Suche ist eine Heuristik und beweist weder Optimalität noch, dass bei
ergebnisloser Suche keine gültige Lösung existiert.

## Anschlussregeln

1. Die aktive harte Anschlussregel setzt die Untergrenze immer auf die am Knoten
   konfigurierte Mindestumsteigezeit. Eine schon vorher zu kurze Wartezeit darf
   diese Grenze nicht absenken.
2. Es gibt keine implizite harte Obergrenze aus der bisherigen Wartezeit. Eine
   maximale zusätzliche Wartezeit wäre eine eigene, explizite Regel.
3. Die bisherige Wartezeit ist eine weiche Präferenz. Sie darf nur unter gültigen
   Lösungen optimiert werden.
4. Die Endvalidierung prüft die Mindestzeit aus den nativen Anschlussdaten und
   den vorgeschlagenen Zeiten, nicht aus derselben Intervallgrenze wie der
   Such-Evaluator.

## Director-Profile: Mehr Spielraum

Beide Profile **Mehr Spielraum – Häufige zuerst** und **Mehr Spielraum – Wichtige
zuerst** deaktivieren die Abfahrts-/Ankunfts-Locks und Fahrzeit-Locks. Sie
aktivieren die maximale Fahrzeitverlängerung mit **+5 Minuten pro Abschnitt**;
Fahrzeiten werden weiterhin nicht verkürzt. Die zwingende Auswahlgrenze und alle
übrigen aktiven harten Regeln bleiben bestehen. Beim Wechsel zu einem der
bisherigen Director-Profile werden die Zeit-Locks wieder aktiviert und die
+5-Minuten-Regel deaktiviert; ihr Standardwert bleibt 5.
Harte Regeln können im Director-Modus über Checkboxen individuell ein- und
ausgeschaltet werden. Die zwingende Auswahlgrenze bleibt gesperrt. Profilwechsel
setzen die profilspezifischen Lock-/Fahrzeit-Defaults; nach einer Anpassung
speichert **Auf Standard zurücksetzen** nicht automatisch, sondern der separate
Speichern-Knopf übernimmt die geänderte Policy für künftige Optimierungsläufe.

## Flatland: relevante Ideen und Grenzen

Li, Chen, Zheng, Chan, Harabor, Stuckey, Ma und Koenig beschreiben in
_Scalable Rail Planning and Replanning: Winning the 2020 Flatland Challenge_
einen MAPF-Solver für dynamische Multi-Agenten-Routenplanung. Das Gewinnerteam
kombiniert priorisierte Planung mit gruppenbasierter LNS und partieller
Neuberechnung; der veröffentlichte Lösungscode bietet unter anderem LNS- und
Parallel-LNS-Modi sowie adaptive Priorisierungs- und Nachbarschaftsstrategien.
Die Beispielkonfiguration des veröffentlichten Codes verwendet 200 Sekunden
für die initiale Planung, bis zu 3 Sekunden für Replanning und eine
LNS-Gruppengrösse von 5. Das ist keine Evidenz dafür, dass der gesamte Solver
grosse Netze in wenigen Sekunden löst; die Problemstellung und Ausführungsumgebung
unterscheiden sich deutlich von unserem Browser-Solver.

Die verlinkte Publikationsliste auf mapf.info wurde nicht vollständig gelesen
und ist selbst keine vollständige Bibliographie des MAPF-Feldes. Geprüft wurden
die thematisch passenden Einträge zu Flatland, Anytime-MAPF und LNS samt
verfügbaren Abstracts. Daraus ergeben sich zusätzliche, aber nicht direkt
übertragbare Hinweise:

- Phan et al. (2025) argumentieren, dass die Auswahl zwischen vielen
  Zerstörungsheuristiken selbst Suchzeit kostet. Ihr ADDRESS-Verfahren verwendet
  stattdessen einen delay-basierten Seed und erfolgsbasiertes Lernen für eine
  adaptive Nachbarschaft. Übertragbare Hypothese: lieber wenige, konfliktstarke
  Kandidatengruppen billig priorisieren als viele Operatoren blind ausprobieren.
- Chan et al. (2025) untersuchen parallele Destroy-/Repair-Operationen in
  DROP-LNS. Das setzt echte Parallelität voraus; Browser-Worker wären ein
  separater Architektur- und Serialisierungsaufwand, nicht automatisch ein
  schnellerer Solver.
- Phan et al. (2026) kombinieren strukturierte Prioritätsstrategien mit
  Online-Lernen zur Seed-Auswahl. Das ist eine spätere Vergleichsidee, kein
  erster Implementierungsschritt ohne Messdaten.

Übertragbar sind die Architekturideen: schnell eine Ausgangslösung erzeugen,
Konflikte priorisieren, nur betroffene Gruppen neu planen und Suchoperatoren
anhand ihres Erfolgs auswählen. Nicht direkt übertragbar sind das MAPF-
Rastermodell, Agentenpfade, Zeitschrittaktionen oder der Solver-Code. Unser
Problem hält Routen fest und verändert Zeitverschiebungen; deshalb werden keine
externen CP-SAT/MILP-, MAPF- oder Parallel-LNS-Komponenten eingebaut, solange
Benchmarks keinen Vorteil innerhalb des UI-Zeitbudgets zeigen.

## Performance- und Qualitätsmessung

Vor jedem Algorithmuswechsel wird die aktuelle Suche als Baseline festgehalten.
Alle Varianten verwenden identische Instanzen, Policies, Seeds und Zeitbudgets.
Mindestens zu messen sind:

- Anteil der Läufe mit mindestens einer gültigen Lösung; ungültige Vorschläge:
  immer null.
- beste weiche Zielwerte und Zeit bis zur ersten gültigen Lösung.
- Laufzeit, Iterationen und Evaluierungen pro Sekunde.
- Median sowie langsame/ungünstige Fälle und Vielfalt der Vorschläge.
- reproduzierbares Ergebnis pro Instanz und Seed.

Die nächste Algorithmusvariante wird nur übernommen, wenn sie im repräsentativen
Korpus gegenüber der Baseline messbar besser ist und das Zeitbudget zuverlässig
einhält. Ein einzelner guter Lauf und ein bekannter Methodenname reichen nicht,
um „state of the art“ oder einen generellen Qualitätsgewinn zu behaupten.

## Algorithmuskomponenten und aktuelle Heuristiken

Dieser Abschnitt beschreibt die implementierte Suche, nicht eine Garantie für
Optimalität. Die zentralen Stellen im Code sind
[`runSearch()`](./optimize-timetable.search.ts),
[`ConflictIndex`](./optimization-conflict-index.ts),
[`TimetableEvaluator`](./optimize-timetable.evaluator.ts),
[`buildProblem()`](./optimize-timetable.chains.ts) und die abschliessende
[`isSolutionValid()`-Prüfung](./optimize-timetable.service.ts).

### Zustandsmodell und Kandidaten

Der Solver legt für jede bewegliche Zeitkette eine ganzzahlige Verschiebung
`Δ` mit begrenzter Domäne an. Eine Kette umfasst Abschnitte eines Zuglaufs, die
durch Durchfahrten verbunden sind; Halte trennen Ketten. Eine Änderung von `Δ`
verschiebt damit zusammenhängende Ereigniszeiten, aber verändert nicht die
Route. Locks, Auswahlbereich und Netzgrenzen fixieren Variablen oder begrenzen
ihre Domäne. Optional können Fahrzeitverlängerungen eigene Variablen erhalten.

Der Evaluator hält den aktuellen Kandidatenzustand in typisierten Arrays. Bei
einer Änderung berechnet er nur abhängige Kanten, Halte, Anschlüsse und
Zuglauffahrzeiten neu. Die Kantenbelegung während der Suche ist ein schnelles
Surrogat; die Infrastruktur-Schätzung prüft Endvorschläge genauer. Die exakte
Knotengleis-Schätzung ist ein weiches Ziel und wird erst für Zustände ohne
aktive harte Verletzungen ausgeführt.

### Harte Regeln, weiche Ziele und Bewertung

Harte Regeln und weiche Ziele haben unterschiedliche Rollen:

- Harte Regeln umfassen je nach Policy unter anderem Gleislimit,
  Mindestumsteigezeit, Mindesthaltezeit, Symmetrie, Locks und Scope.
- Ein Suchzustand darf vorübergehend hart ungültig sein, damit die Suche aus
  einem ungültigen Fahrplan heraus reparieren kann. Er erhält dafür einen
  grossen Strafterm (`WEIGHT_HARD`); das ist nur Suchsteuerung.
- Ein Zustand wird nur dann ins Lösungarchiv übernommen, wenn sein
  Evaluator-Zähler `hard === 0` ist. Anschliessend verwirft der Service jeden
  Vorschlag, den die unabhängige Endvalidierung nicht bestätigt.
- Unter gültigen Zuständen vergleicht der gewichtete Score aktive weiche Ziele.
  Die Archivdominanz vergleicht diese Ziele zusätzlich als Pareto-Kriterien.
  Die gewichtete Suche ist keine streng lexikografische Optimierung.

Damit darf eine weiche Verbesserung niemals eine harte Regelverletzung in
einem ausgegebenen Vorschlag kompensieren. Ein Suchlauf ohne Vorschlag beweist
aber nicht, dass keine gültige Lösung existiert.

### Konfliktindex und Min-Conflicts-/Tabu-Schritte

Der [`ConflictIndex`](./optimization-conflict-index.ts) hält Konflikte für
überlastete Kanten, Mindestanschlüsse, Mindesthaltezeiten und – falls aktiviert –
Fahrzeitgrenzen. Jeder Konflikt verweist auf betroffene Zeitvariablen,
Zuglaufketten, Knoten und Kanten. Ein Heap liefert den Konflikt mit der höchsten
aktiven Priorität; nach einer Variablenänderung werden nur abhängige Konflikte
aktualisiert.

In etwa 85 % der normalen Suchentscheidungen wird dieser Konfliktpfad gewählt:

1. Betroffene bewegliche Variablen in rotierender Reihenfolge prüfen.
2. Nahe Werte der jeweiligen `Δ`-Domäne reversibel testen, derzeit höchstens
   fünf Minuten Abstand pro Schritt. Nach `±1` wird zusätzlich gezielt die
   `sectionHeadway`-Zeit der betroffenen Zugkategorie getestet, auch wenn sie
   grösser als fünf Minuten ist.
3. Bevorzugt einen Kandidaten übernehmen, der die Anzahl harter Verletzungen
   oder die Schwere des aktiven Konflikts reduziert. Bei Gleichstand entscheidet
   der Score.
4. Kurzfristige Rücksprünge mit einer Tabu-Frist von sieben Iterationen
   unterdrücken. Falls kein Konflikt verbessernder Schritt gefunden wird, kann
   ein nicht tabu bewerteter Fallback-Schritt gewählt werden.

Die Fünf-Minuten-Grenze beschränkt die Arbeit je Suchschritt, nicht die gesamte
Domäne: wiederholte Schritte und die Erkundungsphase können grössere
Verschiebungen erreichen.

### Simulated Annealing

Wenn der Konfliktpfad nicht gewählt wird, nimmt die Suche einen Schritt über
eine zufällige bewegliche Variable. In der Regel beträgt der Schritt eine Minute;
gelegentlich wird eine grössere Verschiebung gewählt. Verbesserungen werden
übernommen, Verschlechterungen mit einer temperaturabhängigen Wahrscheinlichkeit
`exp(-ΔScore / Temperatur)`. Die Temperatur fällt während des Zeitbudgets von
`5` auf `0.1`. So kann die Suche zeitweise einen schlechteren Zwischenzustand
zulassen. Es wird dabei weiterhin kein ungültiger Zustand ins Lösungarchiv
aufgenommen.

### Stagnations-Neustart: LNS-inspiriert, nicht ALNS

Nach mehr als 50 Iterationen ohne neue beste Lösung setzt die Suche beim besten
bisherigen Zustand an. Sie wählt zufällig drei bis sieben Variablen ohne
Wiederholung aus einer kleinen konfliktbezogenen Gruppe und verändert ihre
Werte. Neustarts liegen mindestens 50 Iterationen auseinander. Wenn kein
Konfliktanker existiert, kommt die Auswahl aus den beweglichen Variablen.

Das ist ein einfacher, begrenzter LNS-inspirierter Perturbationsschritt. Er
enthält weder mehrere konkurrierende Destroy-/Repair-Operatoren noch ein
adaptives Lernen ihrer Erfolgsraten; die aktuelle Implementierung ist daher
**kein ALNS**. Sie führt nach dem Zerstören auch keinen eigenen systematischen
Repair-Lauf aus – die reguläre Suche setzt danach fort.

### Archiv, Vorschläge und Weiterrechnen

Nur harte-regelkonforme, nicht dominierte Zustände kommen ins begrenzte Archiv.
Der Service wählt daraus höchstens vier Vorschläge und validiert diese erneut.
Der Seed, die Tabu-Fristen, Iteration und das Archiv bleiben bei „Weiterrechnen“
in derselben Suchsession erhalten. Die Schleife gibt dem Browser regelmässig
Gelegenheit zur Verarbeitung; das ist kooperatives Yielding, keine parallele
Worker-Ausführung.

## CBS, LNS/ALNS, VNS und exakte Solver: Entscheidung

### Conflict-Based Search (CBS)

Der Konfliktindex macht die bestehende Suche **konfliktorientiert**, aber das
Verfahren ist **kein CBS**. Klassisches CBS für MAPF baut einen Suchbaum:
Bei einem Agentenkonflikt verzweigt es in zusätzliche Einschränkungen für die
jeweiligen Agenten und lässt die betroffenen Einzelpfade neu planen.

Eine Fahrplan-Variante wäre denkbar: Bei einem Ressourcenkonflikt auf einer
Kante zwei Zugreihenfolgen verzweigen (Zug A vor B oder B vor A), die
entsprechenden Zeitbedingungen auf den betroffenen Ketten setzen und nur diese
Teilprobleme neu lösen. Für mehr als zwei Gleise entstehen jedoch
Mehrfachbelegungs- und Reihenfolgevarianten. Anschlüsse und Halte koppeln
zusätzliche Zugläufe; periodische Zeiten und feste Routen machen die
Low-Level-Neuplanung anders als MAPF-Pfadplanung. Ein vollständiger CBS-Baum
kann deshalb schnell wachsen und ist nicht automatisch schneller oder
vollständiger innerhalb des Browserbudgets.

**Empfehlung:** CBS nicht jetzt als zweiten Gesamtsolver einbauen. Zuerst eine
kleine, begrenzte CBS-ähnliche Reparatur für einen lokalen Konfliktcluster gegen
die aktuelle Suche benchmarken: identische Instanzen, Seeds und Budgets;
Feasibilitätsrate, Zeit bis zum ersten gültigen Vorschlag, End-to-End-Zeit und
Knoten-/Konfliktzahl messen. Nur bei reproduzierbarem Gewinn weiterentwickeln.
Der vorhandene Konfliktindex und die betroffenen Ketten sind dafür eine
Wiederverwendungsbasis.

### LNS, ALNS und VNS

- **LNS:** Ein einfacher LNS-inspirierter Neustart ist bereits implementiert.
  Nächster Vergleich ist nicht „LNS neu einführen“, sondern gezieltes
  Destroy/Repair ganzer konfliktbezogener Ketten oder Ressourcengruppen gegen
  den bestehenden Perturbationsschritt.
- **ALNS:** Erst dann prüfen, wenn wenige klar definierte Operatoren existieren.
  Adaptive Operatorwahl verursacht selbst Aufwand; sie ist nur sinnvoll, wenn
  ihr messbarer Qualitätsgewinn die Auswahlkosten übersteigt.
- **VNS:** Als eigenständige Variante benchmarken, etwa mit systematisch
  wachsenden Nachbarschaften statt zufälliger Störung. Nicht gleichzeitig mit
  ALNS einführen, damit der Effekt zuordenbar bleibt.

Reihenfolge: Baseline stabil messen, einen Operator nach dem anderen vergleichen,
danach gegebenenfalls adaptive Auswahl. Alle Varianten müssen dieselben harten
Validierungsregeln verwenden.

### Frequenzweise progressive Freischaltung

Das Profil **Mehr Spielraum – Häufige zuerst** schaltet die Variablen nach
aufsteigendem Taktabstand frei: zuerst die im Szenario häufigsten Zugläufe, danach
schrittweise seltenere. Das entspricht beispielsweise 15-, 20-, 30-, 60- und
120-Minuten-Takten, sofern diese Frequenzen im Szenario vorkommen. Häufige
Zugläufe erzeugen viele wiederkehrende Belegungen und können deshalb besonders
wichtig für Gleiskonflikte sein. Die Taktfrequenz ist aber keine zuverlässige
Rangfolge der betrieblichen Bedeutung; ein einzelner seltener Zug kann eine
entscheidende Konfliktursache sein.

Das Profil **Mehr Spielraum – Wichtige zuerst** verwendet stattdessen
`TrainrunCategory.order` als Priorität. Ein kleinerer Zahlenwert wird zuerst
freigeschaltet: `order = 0`, danach `1` und so weiter. Die Reihenfolge stammt aus
den Kategorien der Netzgrafik-Metadaten. Sie ist im Datenmodell als
Darstellungsreihenfolge dokumentiert; in diesem Profil wird sie auf Wunsch des
Anwenders zusätzlich als Suchpriorität verwendet. Das Profil verändert oder
sortiert die Metadaten selbst nicht. Wenn die Metadaten zum Beispiel `EC`, `IC`,
`IR`, `RE`, `S`, `GEX`, `G` mit den Orders 0 bis 6 liefern, werden sie in genau
dieser Reihenfolge freigeschaltet. Welche Kategorie fachlich zuerst kommt,
bestimmt die Netzgrafik-Metadatenkonfiguration, nicht eine fest codierte
Rangliste im Solver.

Wichtig ist, die späteren Frequenzgruppen nicht aus dem Modell oder der
Validierung auszublenden. Auch in der ersten Phase müssen alle Züge in der
Belegungs- und Anschlussprüfung berücksichtigt werden. Zunächst werden nur
15-Minuten-Zugläufe bevorzugt verändert; wenn das nicht reicht, werden
20-Minuten-, dann 30-, 60- und 120-Minuten-Zugläufe als zusätzliche Kandidaten
freigeschaltet. Bereits freigeschaltete Variablen bleiben danach beweglich.
Eine finale Runde prüft und optimiert alle Frequenzgruppen gemeinsam.

So wird aus der Idee ein Warmstart beziehungsweise eine progressive
Nachbarschaft, keine Folge voneinander unabhängiger Teilfahrpläne. Würden frühere
Gruppen nach jeder Phase fixiert, könnte eine später einbezogene Gruppe eine
Änderung an einem 15-Minuten-Zug erfordern, die dann nicht mehr möglich wäre.
Falls eine Phase stagniert, muss die nächste Gruppe vorzeitig freigeschaltet
werden, statt das Zeitbudget auf einen Teilbereich zu beschränken.

Beide Profile verteilen das Suchbudget über ihre Prioritätsgruppen. Bereits
freigeschaltete Gruppen bleiben beweglich. Sämtliche Zugläufe bleiben von Anfang
an in der Belegungs-, Konflikt- und Endvalidierung. Das sind Suchheuristiken,
keine zusätzlichen harten Fahrplanregeln.

Im Profil **Wichtige zuerst** bleibt die erste Kategoriegruppe bei der bisherigen
Konfliktschrittweite von höchstens fünf Minuten. Für spätere Gruppen prüft die
Konfliktreparatur Kandidaten über deren ganzen zulässigen Variablenbereich.
Bei Zeitverschiebungen entspricht dieser Bereich höchstens einem halben Takt,
abgerundet auf ganze Minuten und wie bisher auf maximal 30 Minuten begrenzt.
Die Kandidaten werden weiterhin in aufsteigender Distanz zur aktuellen Lage
getestet; kleinere Konfliktverbesserungen haben damit Vorrang. Die bestehende
Bewertung **Minimale Änderungen** bleibt aktiv. Das erweitert die Suchweite,
nicht die zulässige Domäne, und garantiert keine kleinere Gesamtänderung.
Grössere Kandidatenmengen können innerhalb desselben Zeitbudgets weniger
Iterationen bedeuten; der Nutzen muss deshalb im Benchmark geprüft werden.

**Messstand:** Nach Erweiterung der Suchweite wurde die Standalone-Demo mit
einem 1-s-Budget erneut verglichen. Die Kategorievariante fand keinen gültigen
Vorschlag (1.071 s End-to-End, 190 Iterationen, 6'239 Kandidatenbewertungen);
auch die Baseline fand keinen (1.101 s, 202 Iterationen, 5'666 Bewertungen).
Beide starteten mit 24 Kanten über dem Gleislimit. Selbst die Baseline mit
3.5-s-Budget fand keinen gültigen Vorschlag. Die grössere Suchweite hat den
Feasibilitätsengpass in diesem Benchmark also nicht gelöst. Ein Qualitätsgewinn
ist nicht belegt; die Profile müssen auf Netzen mit unterschiedlichen
Frequenzen, Metadatenreihenfolgen und grösseren Instanzen weiter verglichen
werden.

### MILP, CP-SAT und andere exakte Verfahren

**MILP, CP-SAT, PESP-SAT oder ein externer Solver werden derzeit nicht als
Produktivsolver im Browser implementiert.** Sie würden zusätzliche
Solver-Abhängigkeiten, Modellierungsaufwand und Laufzeit-/Paketkosten einführen;
ein Optimalitätsbeweis ist für das interaktive Ziel nicht erforderlich und
garantiert keine schnelle Antwort.

Falls später ein Nutzen belegt werden soll, können exakte Verfahren zunächst
offline als Referenz für kleine Testinstanzen dienen oder als begrenzter lokaler
Reparaturschritt untersucht werden. Ein solcher Test wäre getrennt von der
Browser-Produktivsuche und müsste nachweislich in das Zeitbudget passen. Die
Literaturangabe zu MILP in den Quellen ist Hintergrund, kein Implementierungs-
auftrag.

## Umsetzung in Etappen

### A. Korrektheit und kostengünstige Beschleunigung

- Mindestumsteigezeit absolut erzwingen und unabhängig endvalidieren.
- Bestehende Anschlusswartezeit als weiches Ziel führen.
- Evaluator-Zusammenfassungen inkrementell pflegen, damit Kandidatenprüfungen
  nicht bei jedem Schritt sämtliche Halte und Anschlüsse erneut durchlaufen.

### B. Reproduzierbare Baseline

- Kleine, mittlere und grosse reale Fahrpläne mit festen Policies und Seeds
  zusammenstellen.
- Eingabe, Policy, Seed, Budget, Laufzeit, Iterationen, Gültigkeit und Zielwerte
  für jeden Lauf protokollieren.
- Profiling auf den heissesten Evaluator- und Konfliktindex-Pfaden durchführen.

### C. Schnelle Suchoperatoren benchmarken

- Den vorhandenen LNS-inspirierten Neustart mit konfliktbezogenem
  Destroy/Repair vergleichen.
- Eine begrenzte CBS-ähnliche lokale Reparatur und eine VNS-Variante einzeln
  gegen die Baseline testen.
- Flatland-inspirierte partielle Neuberechnung und adaptive Operatorwahl nur
  dann ergänzen, wenn die Messung einen Gewinn zeigt.
- ALNS erst vergleichen, wenn einfache Operatoren einzeln messbar bewertet sind.
- Exakte lokale Reparatur oder Worker-Ausführung nur nach Messung des Bedarfs
  und unter Einhaltung des interaktiven Zeitbudgets prüfen.

## Stand dieser Umsetzung

Der inkrementelle Evaluator hält Konfliktzahlen und Anschlussabweichungen
laufend vor. Die teure Knotengleis-Schätzung wird nur für harte-regelkonforme
Zustände berechnet; für solche Zustände werden betroffene Knoten aktualisiert.
Exakte Schätzungen werden pro Knoten in einem begrenzten LRU-Cache wiederverwendet.
Der Konfliktschritt testet zunächst nur Verschiebungen bis fünf Minuten; grössere
Änderungen können über mehrere Suchschritte erreicht werden. Die finale
Infrastruktur- und Regelvalidierung bleibt unverändert und entscheidet weiterhin
über die Ausgabe.

Der erste reproduzierbare Benchmark nutzt die Standalone-Demo mit 51 Knoten,
23 Zugläufen und 204 Abschnitten. Mit der Standard-Policy blieb die Laufzeit bei
1 s Suchbudget ungefähr bei 1.07–1.13 s und bei 3.5 s Suchbudget bei rund
3.58 s. Die harte Gleisregel startete mit 24 überlasteten Kanten; keiner der
Standardläufe fand innerhalb des Budgets einen gültigen Vorschlag. Ohne die harte
Gleisregel fand der Test vier Vorschläge, aber der beste hatte weiterhin
22 überlastete Kanten. Das zeigt, dass die Gleis-Feasibilität der aktuelle
Engpass ist; es beweist weder Unlösbarkeit noch eine Verbesserung für grosse
Netze. Die Demo ist kein Grossnetz-Korpus.

Die Operatorvarianten und ein repräsentativer Korpus bleiben offen. Vor einer
Behauptung von „state of the art“ oder einer Freigabe müssen insbesondere
Feasibilitätsrate und Zeit bis zum ersten gültigen Vorschlag auf realistischen
grossen Instanzen steigen. Ergebnisse und Laufzeit dürfen nicht voneinander
getrennt berichtet werden.

## Quellen

- [Li et al. (2021), _Scalable Rail Planning and Replanning: Winning the 2020
  Flatland Challenge_](https://doi.org/10.1609/icaps.v31i1.15994)
- J. Li, Z. Chen, Y. Zheng, S.-H. Chan, D. Harabor, P. J. Stuckey, H. Ma and
  S. Koenig, _Scalable Rail Planning and Replanning: Winning the 2020 Flatland
  Challenge_, ICAPS, pp. 477–485, 2021.
- [Gewinnerlösung und README](https://github.com/Jiaoyang-Li/Flatland/tree/Flatland2020_solution)
- [Phan et al. (2025), _Anytime MAPF with an Adaptive Delay-Based Heuristic_](https://mapf.info/index.php/Main.SKoen25c)
- [Chan et al. (2025), _Operation Parallelism in LNS for Anytime MAPF_](https://mapf.info/index.php/Main.SKoen25z)
- [Phan et al. (2026), _Truncated Counterfactual Learning for Anytime MAPF_](https://mapf.info/index.php/Main.SKoen26b)
- [Cacchiani et al. (2014), Echtzeit-Re-Scheduling: Modelle und Algorithmen](https://doi.org/10.1016/j.trb.2014.01.009)
- [Fischetti & Monaci (2017), MILP für Echtzeit-Re-Scheduling](https://doi.org/10.1016/j.ejor.2017.04.057)

## Abkürzungen und Begriffe

- **ALNS — Adaptive Large Neighborhood Search:** LNS mit mehreren Destroy-/Repair-Operatoren,
  deren Auswahl anhand ihres bisherigen Erfolgs angepasst wird.
- **CBS — Conflict-Based Search:** Suchverfahren, das Konflikte in einem Suchbaum durch
  Verzweigungen mit zusätzlichen Einschränkungen auflöst. Die vorhandene Konfliktsuche ist
  kein CBS.
- **CP-SAT:** Constraint-Programming-Solver mit SAT-basierter Suche; hier nur als möglicher
  Offline-Vergleich erwähnt.
- **ICAPS — International Conference on Automated Planning and Scheduling:** Konferenz, auf
  der die erwähnte Flatland-Arbeit publiziert wurde.
- **LNS — Large Neighborhood Search:** Grossnachbarschaftssuche. „Large“ bedeutet, dass pro
  Suchschritt mehrere Variablen oder Entscheidungen verändert werden; LNS steht nicht für
  „Local Neighborhood Search“.
- **LRU — Least Recently Used:** Cache-Strategie, bei der der am längsten nicht verwendete
  Eintrag zuerst entfernt wird.
- **MAPF — Multi-Agent Path Finding:** Routenplanung für mehrere Agenten mit
  Ressourcenkonflikten, etwa gleichzeitiger Belegung eines Rasterfelds.
- **MILP — Mixed-Integer Linear Programming:** gemischt-ganzzahlige lineare Optimierung.
- **PESP — Periodic Event Scheduling Problem:** periodisches Ereignisplanungsproblem; ein
  verwandtes Modell für Fahrplanzeiten, aber nicht identisch mit der vollständigen
  Netzgrafik-Optimierung.
- **PESP-SAT:** SAT-basierte Modellierung eines PESP.
- **SAT — Boolean Satisfiability:** Erfüllbarkeit einer aussagenlogischen Formel.
- **UI — User Interface:** Benutzeroberfläche.
- **VNS — Variable Neighborhood Search:** systematische Suche, die zwischen unterschiedlich
  grossen oder strukturierten Nachbarschaften wechselt.
- **Δ (Delta):** ganzzahlige Zeitverschiebung einer optimierbaren Zuglaufkette.
- **et al.:** lateinisch für „und weitere“; Kurzform in Literaturangaben mit mehreren Autoren.
