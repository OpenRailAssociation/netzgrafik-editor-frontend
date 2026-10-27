# Optimierungsfunktion – Lern- und Bedienungsleitfaden

Dieses Dokument erklärt die **aktuelle Implementierung** der Fahrplanoptimierung in einfacher Sprache: was die Bedienelemente tun, welche Komponenten dahinterstehen und wie die Suche arbeitet. Es ergänzt die [Anforderungen](./OPTIMIZE_TIMETABLE.md) und den [Umsetzungsvorschlag](./UMSETZUNGSVORSCHLAG.md); bei Unterschieden ist der aktuelle Code massgebend.

## 1. Kurz erklärt

Die Optimierung verschiebt Abfahrts- und Ankunftszeiten in der bestehenden Netzgrafik. Sie ändert nicht automatisch eine Linie oder Route. Statt sofort etwas fest zu übernehmen, berechnet sie mehrere gültige Vorschläge. Du kannst einen Vorschlag auswählen, seine Auswirkungen ansehen und ihn erst danach übernehmen.

Der grobe Ablauf lautet:

**Dialog öffnen → Bereich und Regeln prüfen → Optimieren → Vorschlag wählen → Vorschau ansehen → Übernehmen oder Abbrechen.**

## 2. Der Dialog Schritt für Schritt

### Dialog öffnen und Bereich wählen

Der Dialog öffnet sich über `Ctrl+Q`, `q` oder `Q`. Ein ausgewählter Zuglauf bestimmt zuerst den Optimierungsbereich. Gibt es keinen ausgewählten Zuglauf, werden markierte Knoten verwendet. Ohne diese Auswahl gilt der gesamte aktuell sichtbare, also durch die Editorfilter eingeschränkte Netzbereich.

Die Auswahl begrenzt, wo Zeiten verändert werden dürfen. Kanten am Rand einer Knotenauswahl und Bereiche ausserhalb der Auswahl bleiben fix. Die aktuelle Auswahl wird beim Öffnen des Dialogs übernommen.

### Links: Optimization Director

Der Director enthält zwei Gruppen:

- **Harte Regeln** sind Bedingungen, die ein Vorschlag einhalten muss, wenn die Regel aktiviert ist. Die Checkbox schaltet eine Regel ein oder aus. Die Bereichsgrenze ist verpflichtend und kann nicht ausgeschaltet werden. Für die Gleisgrenze und die maximale Fahrzeitverlängerung erscheint bei aktiver Regel ein Zahlen-Stepper.
- **Weiche Ziele** sagen, welche gültigen Vorschläge bevorzugt werden. Du kannst Ziele ein- und ausschalten und ihre Reihenfolge durch Ziehen verändern. Mit Pfeil hoch/runter lässt sich ein Ziel auch per Tastatur verschieben.

In der Standard-Policy ist das Streckengleislimit mit **2 Gleisen** aktiv. Ebenfalls aktiv sind unter anderem User-Anschlüsse, Mindesthaltezeiten, Zeit- und Fahrzeit-Locks sowie Symmetrie. Die maximale Fahrzeitverlängerung ist standardmässig ausgeschaltet und auf 5 Minuten voreingestellt. Welche Regel tatsächlich gilt, hängt immer von der aktuellen Policy und ihrem Aktivschalter ab.

Die Ziele decken minimale Zeitänderungen, mehr optionale Anschlüsse, kürzere Reisezeit sowie geringere Knoten- und Streckengleisnutzung ab. Eine Änderung der Zielreihenfolge sortiert die bereits gefundenen Vorschläge neu; sie startet für sich allein keinen neuen Suchlauf.

**Policy speichern** erscheint, wenn die Einstellungen vom gespeicherten Stand abweichen. Erst dieser Knopf schreibt die Policy in den lokalen Browser-Speicher. **Ranking zurücksetzen** stellt die Standardreihenfolge und Aktivierung der weichen Ziele wieder her; es setzt nicht die harten Regeln zurück.

Eine Änderung an harten Regeln prüft die vorhandenen Vorschläge erneut. Sie sucht keine neuen Vorschläge. Für eine neue Suche muss **Optimieren** gestartet werden.

### Rechts oben: Streckengleis-Übersicht (IST)

Beim Öffnen des Dialogs ist die kompakte Streckengleis-Übersicht ausgeklappt. Sie zeigt die gefilterten sichtbaren Abschnitte mit Start- und Zielknoten, maximaler Gleiszahl und Topologie der Ausgangslage. Die Tabelle lässt sich nach Start, Ziel oder Gleiszahl sortieren. Anfangs ist die Gleiszahl absteigend sortiert.

Nach einem Optimierungslauf klappt diese Übersicht zu und **Result** auf. Die Übersicht wird dabei nicht entfernt: Ihr Header bleibt erreichbar. Es kann jeweils nur eines der beiden Panels ausgeklappt sein; öffnest du das eine, klappt das andere zu.

Eine Zahl oder Linie wird rot markiert, wenn das Streckengleislimit aktiv ist und die erlaubte Gleiszahl überschritten wird. Ohne aktives Limit bleibt die normale Theme-Farbe erhalten.

### Result: Suchstand und Vorschläge

Das Result-Panel zeigt zuerst Informationen zum Lauf, zum Beispiel Iterationen, Laufzeit, Anzahl der Variablen und gegebenenfalls Gründe, warum Variablen fixiert sind. Wenn keine Lösung gefunden wurde, erscheint dort eine Meldung.

Die Vorschlagstabelle enthält eine eigene Baseline-Zeile und bis zu vier erzeugte Vorschläge. Die Baseline ist nur der Vergleich mit dem ursprünglichen Fahrplan, kein Optimierungsvorschlag. Die erzeugten Vorschläge werden unter anderem als ausgewogen, mit minimaler Änderung, mit mehr Anschlüssen oder mit kürzerer Reisezeit ausgewählt. Es können weniger als vier erscheinen, wenn nicht genügend verschiedene passende Vorschläge gefunden wurden.

Der erste gültige Vorschlag wird nach dem Lauf automatisch ausgewählt. Ein Klick auf eine andere gültige Zeile wählt sie ebenfalls aus. Die ausgewählte Zeile ist mit `COLOR_Edit` umrandet. Sie wird als Vorschau in der Netzgrafik angezeigt; die Vorschau ist noch keine endgültige Übernahme.

### Details: fünf Spalten pro Abschnitt

Die Abschnittstabelle zeigt **Abschnitte mit Fahrplanänderungen** in dieser Reihenfolge:

1. Abschnitt
2. Maximale Gleise vorher
3. Topologie vorher
4. Maximale Gleise nachher
5. Topologie nachher

Die Topologien stellen die vom Infrastruktur-Schätzer ermittelten Teilsegmente dar. Die Zahl „maximale Gleise“ ist die höchste Gleiszahl dieser Segmente. Die Tabelle enthält nur Abschnitte, auf denen sich in der gewählten Lösung eine Zeit oder Fahrzeit ändert. Darum kann die Gleiszahl trotzdem gleich bleiben, zum Beispiel `2 → 2`: Der Fahrplan hat sich geändert, nicht aber der Spitzenwert der Gleise.

Bei aktivem Streckengleislimit werden nur die überzähligen Gleislinien und die dazugehörige Zahl rot gezeichnet. Die Topologie nutzt sonst die zum Theme passende Standardfarbe. Für mehr als vier Gleise wird eine Zählbox statt vieler einzelner Linien verwendet.

### Fahrplananpassungen je Knoten

Unter der Abschnittstabelle gruppiert die Liste die Zeitänderungen nach Knoten. Innerhalb eines Knotens sind die Änderungen nach neuer Zeit und Zuglauf sortiert. Ein Klick oder das Anfahren einer Knotengruppe wählt den Knoten für die Analyse aus. Zugläufe lassen sich in der Liste hervorheben; die Hervorhebung wird auch an die Auslastungsanzeigen weitergegeben.

Rechts werden die bestehende Knotenauslastungs-Komponente und ihre zwei Zustände **Vorher** und **Nachher** gezeigt. Ihre Stundenumschaltung und Gleisbelegungsdarstellung kommen aus der vorhandenen `KnotenAuslastungViewComponent`; die Optimierung erfindet dafür keine eigene Anzeige. Knotengleis-Auslastung ist eine Anzeige und ein weiches Ziel, aber keine harte Knotengleisgrenze.

### Unten: Aktionen

- **Übernehmen** lässt die ausgewählte Vorschau im Fahrplan bestehen und erstellt einen Undo-Punkt. Danach kann die Änderung mit der normalen Undo-Funktion zurückgenommen werden.
- **Weiterrechnen** startet mit einem neuen Seed einen weiteren Suchlauf. Wenn ein Vorschlag ausgewählt ist, beginnt die Suche mit dessen Assignment.
- **Abbrechen** verwirft die Vorschau und stellt die Ausgangszeiten wieder her.

## 3. Welche Komponente wofür zuständig ist

### `OptimizeTimetableDialogComponent`

Das ist die Steuerzentrale des Dialogs. Sie lädt den Bereich, verbindet den Director mit dem Service, hält den ausgewählten Vorschlag und aktualisiert die Tabellen. Wichtige Methoden sind:

- `openDialog()` setzt Auswahl, Filterbereich und Panel-Zustand für eine neue Dialogöffnung zurück.
- `optimize()` startet die Suche und versucht bei ausbleibenden Vorschlägen weitere Seeds.
- `continueOptimization()` setzt die Suche mit einem neuen Seed fort.
- `selectSolution()` wählt einen gültigen Vorschlag, startet die Vorschau und bereitet die Detailanalyse vor.
- `selectBaseline()` entfernt die Vorschau und zeigt wieder den Ausgangsfahrplan.
- `selectNode()` aktualisiert die Vorher-/Nachher-Auslastung für einen Knoten.
- `apply()` und `cancel()` übernehmen beziehungsweise verwerfen die Vorschau.
- `refreshTrackOverview()` berechnet oder aktualisiert die IST-Tabelle; `openTrackOverview()` und `openResultsPanel()` halten die beiden Panels gegenseitig exklusiv.

Dazugehörig: [Dialog-Logik](../../view/dialogs/optimize-timetable-dialog/optimize-timetable-dialog.component.ts), [Dialog-Template](../../view/dialogs/optimize-timetable-dialog/optimize-timetable-dialog.component.html) und [Dialog-Styles](../../view/dialogs/optimize-timetable-dialog/optimize-timetable-dialog.component.scss).

### `OptimizationDirectorComponent`

Diese Komponente rendert die harten Regeln und weichen Ziele. Sie verändert die Policy nicht still im Dialog, sondern sendet Änderungen über `policyChange` an die Dialog-Steuerzentrale. Checkboxen schalten Regeln und Ziele. Stepper ändern Grenzwerte. Drag-and-drop und Pfeiltasten ändern die Priorität der Ziele.

Quellcode: [Director-Logik](../../view/dialogs/optimize-timetable-dialog/optimization-director.component.ts) und [Director-Template](../../view/dialogs/optimize-timetable-dialog/optimization-director.component.html).

### `TrackTopologyComponent`

Der Renderer erhält eine Kante, deren Segmentdaten, das Gleislimit und dessen Aktivstatus. Er zeichnet daraus ein kompaktes SVG. Bei aktivem Limit färbt er belegte überzählige Gleise und die Zählbox-Zahl rot; freie Platzhalter bleiben gestrichelt. Die Standardfarbe kommt aus dem aktuellen Theme.

Quellcode: [Renderer-Logik](../../view/dialogs/optimize-timetable-dialog/track-topology/track-topology.component.ts), [Renderer-Template](../../view/dialogs/optimize-timetable-dialog/track-topology/track-topology.component.html).

### Services und Datenmodelle

- [OptimizeTimetableService](./optimize-timetable.service.ts) berechnet die Ausgangslage, startet die Suche, erstellt Vorschläge und prüft Kandidaten. `applySolution()` und `revertSolution()` schreiben beziehungsweise entfernen die Vorschau.
- [OptimizationPolicyService](./optimization-policy.service.ts) lädt, normalisiert und speichert die Regeln und Ziele im Browser-Speicher.
- [OptimizationPolicy](./optimization-policy.model.ts) beschreibt die IDs, Grenzwerte, Aktivierung und Prioritäten.
- [runSearch](./optimize-timetable.search.ts) führt die heuristische Suche durch. [ConflictIndex](./optimization-conflict-index.ts) hilft, Konflikte und betroffene Variablen zu finden.
- [OptimizationSolutionComparator](./optimization-solution-comparator.ts) sortiert gültige Vorschläge nach den aktivierten weichen Zielen.
- [OptimizeTimetable model](./optimize-timetable.model.ts) enthält die Eingaben, Ergebnisse, KPIs, Kanten und Zeitänderungen.
- [InfrastructureEstimatorService](../infrastructure/infrastructure-estimator.service.ts) liefert die Streckengleis-Segmente und die exakte Gleiszahl für die Anzeige und die abschliessende Prüfung.

## 4. Wie der Algorithmus arbeitet

Der Service baut aus den bestehenden Zugläufen, Abschnitten, Knoten und Regeln ein Suchproblem. Zusammenhängende Abschnitte zwischen Halten werden zu verschiebbaren Ketten zusammengefasst. Eine Variable beschreibt, um wie viele Minuten eine solche Kette verschoben wird. Locks, Bereichsgrenzen und die übrigen aktivierten harten Regeln schränken die möglichen Verschiebungen ein.

Während der Suche bewertet ein inkrementeller Evaluator Kandidaten, ohne jedes Mal das ganze Netz neu zu berechnen. Ein Konfliktindex priorisiert Probleme wie eine aktive Gleisüberschreitung oder eine verletzte Verbindung. Die Suche kombiniert drei Verfahren:

1. **Min-Conflicts mit Tabu-Suche** versucht zuerst, einen aktiven Konflikt zu verbessern. Die Tabu-Liste verhindert kurzfristige Rücksprünge in gerade verlassene Zustände.
2. **Simulated Annealing** probiert gelegentlich auch einen zunächst schlechter bewerteten Schritt. So kann die Suche aus einer lokalen Sackgasse herauskommen.
3. **Large-Neighborhood Search (LNS)** startet nach längerer Stagnation erneut von einer guten Lösung und verändert dafür mehrere Variablen in einem konfliktbezogenen Teilbereich.

Gültige, unterschiedliche und nicht dominierte Kandidaten landen in einem begrenzten Archiv. Daraus wählt der Service höchstens vier Vorschläge mit verschiedenen Schwerpunkten. Die Dialogsteuerung versucht beim ersten Optimieren bis zu drei Seeds, stoppt aber, sobald ein Vorschlag gefunden wurde oder keine Variablen beweglich sind. Ein einzelner Suchlauf hat standardmässig ein Budget von 1.000 ms. Die gesamte Aufrufzeit kann wegen Vorbereitung und exakter Nachprüfungen länger sein. Weiterrechnen startet einen neuen Lauf mit dem nächsten Seed.

Vor der Anzeige prüft der Service die Lösungen erneut. Die Streckengleise werden für geänderte Abschnitte mit dem Infrastruktur-Schätzer berechnet; aktive harte Regeln und Symmetrie werden geprüft. Die Suche ist eine Heuristik und beweist nicht, dass eine Lösung global optimal ist.

## 5. Stärken und Grenzen

### Was gut funktioniert

- Die Suche kann innerhalb eines begrenzten Zeitbudgets brauchbare Alternativen finden und mehrere unterschiedliche Vorschläge liefern.
- Sie arbeitet im Frontend mit bestehenden Netzgrafik-Modellen und benötigt keinen zusätzlichen Solver oder Backend-Dienst.
- Vorschau, Abbrechen und Übernehmen sind getrennt. Du kannst Änderungen prüfen, ohne sie sofort dauerhaft zu übernehmen.
- Der exakte Infrastruktur-Schätzer prüft die angezeigten Gleiswerte; die kompakte Topologie macht Unterschiede zwischen vorher und nachher sichtbar.
- Seed, Policy und Ergebnisrangfolge sind klar getrennt: Weiterrechnen sucht weiter, während ein Ändern der Soft-Ziel-Reihenfolge vorhandene Vorschläge neu sortiert.

### Was die Suche nicht verspricht

- Sie ist heuristisch: Sie garantiert weder die beste mögliche Lösung noch, dass in jedem Lauf eine Lösung gefunden wird.
- Ein Lauf hat standardmässig 1.000 ms Suchbudget. Grössere oder schwierige Netze können mehr Zeit benötigen oder weniger Vorschläge liefern.
- Es werden höchstens vier Vorschläge angezeigt, auch wenn das Archiv weitere Kandidaten enthält.
- Die Abschnittstabelle unter einer Lösung zeigt nur geänderte Abschnitte. Sie ist keine vollständige Liste aller unveränderten Kanten.
- Ein aktives Gleislimit wird hart geprüft. Wenn es deaktiviert ist, kann eine Lösung weiterhin eine hohe Gleiszahl haben; die Anzeige färbt sie dann nicht als Limitverletzung.
- „Weiterrechnen“ führt eine neue Suche aus, aber die Ergebnisse sind nicht garantiert besser.

## 6. Ausblick

Das sind mögliche nächste Schritte, keine bereits umgesetzten Funktionen:

- Dialog-Integrationstests für Panel-Exklusivität, Auswahl einer Variante, Vorschau, Abbrechen und Übernehmen.
- Benchmarks auf kleinen und grossen realen Netzen, damit Zeitbudget und Reaktionsverhalten besser eingeschätzt werden können.
- Eine Fortschrittsanzeige oder Ausführung in einem Web Worker, falls die Suche bei grossen Netzen die Oberfläche spürbar blockiert.
- Eine verständliche Begründung je Vorschlag: welche Konflikte beseitigt wurden und welche Kennzahlen sich dafür verschlechtert haben.
- Filter für die Detailtabelle, zum Beispiel nur Abschnitte über dem Limit oder nur Abschnitte mit geänderter Gleiszahl.

## 7. Wo du im Code weiterlesen kannst

Ein guter Einstieg ist die Dialog-Logik. Folge von dort `optimize()` zum Service, dann zu `runSearch()` und zum Evaluator. Für die sichtbare Darstellung gehe vom Dialog-Template zum Director oder `TrackTopologyComponent`. Die detaillierten Anforderungen und offenen Architekturfragen stehen weiterhin in [OPTIMIZE_TIMETABLE.md](./OPTIMIZE_TIMETABLE.md) und [UMSETZUNGSVORSCHLAG.md](./UMSETZUNGSVORSCHLAG.md).
