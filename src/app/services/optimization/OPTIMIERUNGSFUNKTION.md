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

### Links: Director und benutzerdefinierte Steuerung

Standardmässig ist **Benutzerdefiniert** ausgeschaltet. Im Director-Modus wählst du eines von drei verständlich beschriebenen Profilen: Fahrplan stabilisieren, Anschlüsse verbessern oder Gleisbedarf reduzieren. Die ausgewählte Profilkarte enthält drei SBB-Aufklappfelder: **Weiche Ziele**, **Verbindliche Leitplanken** und **Details**. Es ist immer höchstens eines geöffnet; **Weiche Ziele** ist beim ersten Anzeigen geschlossen. Die Details erläutern gruppiert die Ziele und Leitplanken.

Mit **Benutzerdefiniert** schaltest du auf die direkte Steuerung um. Hier sind die beiden Abschnitte **Verbindliche Leitplanken** und **Weiche Ziele** ohne Aufklappfelder dauerhaft sichtbar; einen zusätzlichen Details-Bereich gibt es nicht:

- **Verbindliche Leitplanken** sind Bedingungen, die ein Vorschlag einhalten muss, wenn die Regel aktiviert ist. Die Checkbox schaltet eine Regel ein oder aus. Die Bereichsgrenze ist verpflichtend und kann nicht ausgeschaltet werden. Für die Gleisgrenze und die maximale Fahrzeitverlängerung erscheint bei aktiver Regel ein Zahlen-Stepper.
- **Weiche Ziele** sagen, welche gültigen Vorschläge bevorzugt werden. Du kannst Ziele ein- und ausschalten und ihre Reihenfolge durch Ziehen verändern. Mit Pfeil hoch/runter lässt sich ein Ziel auch per Tastatur verschieben.

In der Standard-Policy ist das Streckengleislimit mit **2 Gleisen** aktiv. Ebenfalls aktiv sind unter anderem User-Anschlüsse, Mindesthaltezeiten, Zeit- und Fahrzeit-Locks sowie Symmetrie. Die maximale Fahrzeitverlängerung ist standardmässig ausgeschaltet und auf 5 Minuten voreingestellt. Welche Regel tatsächlich gilt, hängt immer von der aktuellen Policy und ihrem Aktivschalter ab.

Die Symmetrieprüfung gilt für Hin- und Rückfahrten, nicht für Einwegzüge. Deren ungenutzte Gegenrichtungszeiten dürfen eine sonst gültige Verschiebung nicht ungültig machen, auch wenn am Abschnitt Symmetrieflags gesetzt sind.

Die Ziele decken minimale Zeitänderungen, mehr optionale Anschlüsse, kürzere Reisezeit sowie geringere Knoten- und Streckengleisnutzung ab. Im Director-Modus wird nach Ratings absteigend sortiert. Das Gewicht einer Rangposition ist `1 / 2^Rangposition`, beginnend bei 0. Gleiche Ratings teilen sich das Gewicht; danach wird die Rangposition um die Anzahl der gleich bewerteten Ziele übersprungen. Beispielsweise ergeben `5/10, 5/10, 3/10` die Gewichte `1, 1, 1/4`. Bei `10/10, 5/10, 3/10` sind es `1, 1/2, 1/4`. Diese Gewichte werden für die Suche und die Rangfolge der Vorschläge verwendet. In der benutzerdefinierten Steuerung sind die Prioritäten eindeutig; die Gewichte folgen der manuellen Reihenfolge mit `1, 1/2, 1/4` usw.

Director-Voreinstellung und benutzerdefinierte Steuerung haben getrennte Einstellungen für Leitplanken und Ziele. Ein Wechsel zwischen den Modi übernimmt keine Änderungen in den jeweils anderen Modus. Die ausgewählte Director-Voreinstellung, ihre angepassten Leitplanken und Ziele bleiben erhalten, wenn du zu **Benutzerdefiniert** wechselst und zurückkehrst.

**Auf Standard zurücksetzen** setzt beide Modi einschliesslich aller Profile, Leitplanken und Ziele zurück. **Einstellungen für die nächste Optimierung übernehmen** speichert anschliessend beide Konfigurationen gemeinsam im lokalen Browser-Speicher. Nach erneutem Öffnen oder Neuladen bleiben beide Stände erhalten.

Eine Änderung an Ratings, Profil oder Regeln startet keine neue Suche. Vorhandene Ergebnisse werden als veraltet markiert; Regeländerungen prüfen zusätzlich ihre Gültigkeit erneut. Für neue Vorschläge muss **Optimieren** gestartet werden.

Neben **Optimieren** startet **Mit CP-SAT optimieren (TypeScript)** den alternativen
SAT-basierten Constraint-Solver. Beide verwenden dieselben Eingaben, Regeln und
Ergebnis-KPIs; das Result-Panel nennt das verwendete Verfahren. Die native Alternative
braucht weder WASM noch einen Server. Sie ist keine Google-OR-Tools-Portierung.
**Weiterrechnen** setzt die jeweilige Suchsession fort und ist nach vollständiger
Erschöpfung des endlichen CP-SAT-Modells deaktiviert.

### Rechts oben: Streckengleis-Übersicht (IST)

Beim Öffnen des Dialogs ist die kompakte Streckengleis-Übersicht ausgeklappt. Sie zeigt die gefilterten sichtbaren Abschnitte mit Start- und Zielknoten, maximaler Gleiszahl und Topologie der Ausgangslage. Die Tabelle lässt sich nach Start, Ziel oder Gleiszahl sortieren. Anfangs ist die Gleiszahl absteigend sortiert.

Nach einem Optimierungslauf klappt diese Übersicht zu und **Result** auf. Die Übersicht wird dabei nicht entfernt: Ihr Header bleibt erreichbar. Es kann jeweils nur eines der beiden Panels ausgeklappt sein; öffnest du das eine, klappt das andere zu.

Eine Zahl oder Linie wird rot markiert, wenn das Streckengleislimit aktiv ist und die erlaubte Gleiszahl überschritten wird. Ohne aktives Limit bleibt die normale Theme-Farbe erhalten.

### Result: Suchstand und Vorschläge

Das Result-Panel zeigt zuerst Informationen zum Lauf, zum Beispiel Iterationen, Laufzeit, Anzahl der Variablen und gegebenenfalls Gründe, warum Variablen fixiert sind. Wenn keine Lösung gefunden wurde, erscheint dort eine Meldung.

Wenn keine gültige Lösung vorliegt, fasst der standardmässig zugeklappte Analysebereich die Gründe zusammen. Überlastete Strecken zeigen das verletzte Streckengleislimit und eine Tabelle mit Zugkategorie/-nummer, Abschnitt von–nach, Hin- und Rückfahrzeiten sowie Markierungen für Zeit-Locks und Fahrzeit-Locks. Auswahlgrenzen und fehlender Verschiebungsspielraum werden als weitere Blockierungsursachen pro Abschnitt aufgeführt. Locks und Auswahlgrenzen sind Blockierungsursachen, keine Regelverletzungen. Strg+A wählt alle vom Filter erfassten Knoten, nicht nur den sichtbaren Bildschirmausschnitt.

Wenn solche unveränderbaren Konflikte keine gültige Lösung zulassen, startet zusätzlich eine zeitlich begrenzte Diagnosesuche über das gesamte sichtbare Netz. Sie lockert Zeit-Locks, Fahrzeit-Locks und Auswahlgrenzen, lässt die übrigen Regeln aber aktiv. Gefundene Vorschläge sind in der Tabelle als Diagnose gekennzeichnet und bleiben gegenüber dem ursprünglichen Suchmodell ungültig.

Die Vorschlagstabelle zeigt immer die Baseline (`arrow-right-medium`) und bis zu fünf gültige Varianten (`tick-medium`). Gültige und ungültige Varianten werden nicht durch Hintergrundfarben unterschieden. Bis zu fünf ungültige Alternativen bleiben standardmässig zugeklappt und lassen sich über „Ungültige Alternativen anzeigen“ zusätzlich anzeigen (`cross-tiny-small`); Diagnosevorschläge werden dabei priorisiert. Ohne gültige Lösung bleibt zunächst nur die Baseline sichtbar. Es entscheidet die gewichtete Soft-Zielfunktion; kleinere angezeigte Soft-Kosten sind besser. Die Baseline dient nur als Vergleich, nicht als zusätzlicher Vorschlag.

Der erste gültige Vorschlag wird nach dem Lauf automatisch ausgewählt. Ungültige Varianten werden niemals automatisch als Vorschau angewendet. Nach dem Einblenden und expliziten Auswählen können sie zum Vergleich angesehen werden. Das Übernehmen einer ungültigen Variante erfordert eine zusätzliche Bestätigung; die Verantwortung für die Abweichung vom Suchmodell liegt beim Anwender. Zuklappen einer ungültigen Vorschau stellt die Baseline wieder her. Die Auswahl ist mit `COLOR_Edit` umrandet, ohne die Statusfarbe zu überschreiben; Abbrechen stellt die Ausgangslage wieder her.

### Details: fünf Spalten pro Abschnitt

Die Streckengleis-Übersicht zeigt Abschnitte im Optimierungsbereich und standardmässig nur
Abschnitte mit veränderter Gleisbelegung. Dafür muss sich die maximale Gleiszahl oder die
Topologie mindestens eines Teilsegments unterscheiden. **Alle Abschnitte anzeigen** ergänzt
auch unveränderte Abschnitte innerhalb des Optimierungsbereichs und eine sortierbare, deaktivierte
Checkbox-Spalte **Gleisbelegung geändert**.

Die Tabelle enthält diese Spalten:

1. Abschnitt
2. Maximale Gleise vorher
3. Topologie vorher
4. Maximale Gleise nachher
5. Topologie nachher

Die Topologien stellen die vom Infrastruktur-Schätzer ermittelten Teilsegmente dar. Die Zahl „maximale Gleise“ ist die höchste Gleiszahl dieser Segmente. Eine Fahrplanänderung allein reicht nicht aus, um einen Abschnitt hier standardmässig anzuzeigen: Die Gleiszahl oder mindestens ein Teilsegment muss sich ebenfalls ändern.

Bei aktivem Streckengleislimit werden nur die überzähligen Gleislinien und die dazugehörige Zahl rot gezeichnet. Die Topologie nutzt sonst die zum Theme passende Standardfarbe. Für mehr als vier Gleise wird eine Zählbox statt vieler einzelner Linien verwendet.

### Fahrplananpassungen je Knoten

Unter der Abschnittstabelle gruppiert die Liste die Zeitänderungen nach Knoten. Innerhalb eines Knotens sind die Änderungen nach neuer Zeit und Zuglauf sortiert. Ein Klick oder das Anfahren einer Knotengruppe wählt den Knoten für die Analyse aus. Zugläufe lassen sich in der Liste hervorheben; die Hervorhebung wird auch an die Auslastungsanzeigen weitergegeben.

Rechts werden die bestehende Knotenauslastungs-Komponente und ihre zwei Zustände **Vorher** und **Nachher** gezeigt. Ihre Stundenumschaltung und Gleisbelegungsdarstellung kommen aus der vorhandenen `KnotenAuslastungViewComponent`; die Optimierung erfindet dafür keine eigene Anzeige. Knotengleis-Auslastung ist eine Anzeige und ein weiches Ziel, aber keine harte Knotengleisgrenze.

### Unten: Aktionen

- **Übernehmen** lässt die ausgewählte Vorschau im Fahrplan bestehen und erstellt einen Undo-Punkt. Danach kann die Änderung mit der normalen Undo-Funktion zurückgenommen werden.
- **Weiterrechnen** investiert ein weiteres Zeitbudget in denselben Suchlauf. Suchzustand und bisherige Vorschläge bleiben erhalten.
- **Abbrechen** verwirft die Vorschau und stellt die Ausgangszeiten wieder her.

## 3. Welche Komponente wofür zuständig ist

### `OptimizeTimetableDialogComponent`

Das ist die Steuerzentrale des Dialogs. Sie lädt den Bereich, verbindet den Director mit dem Service, hält den ausgewählten Vorschlag und aktualisiert die Tabellen. Wichtige Methoden sind:

- `openDialog()` setzt Auswahl, Filterbereich und Panel-Zustand für eine neue Dialogöffnung zurück.
- `optimize()` startet die Suche und versucht bei ausbleibenden Vorschlägen weitere Seeds.
- `optimizeCpSat()` startet den alternativen nativen TypeScript-CP-SAT-Solver im
  Unterordner [cp-sat](./cp-sat/). Er nutzt einen eigenen CDCL-Kern mit Constraint-Klauseln,
  keine OR-Tools-Portierung. Weitere Budgets und **Weiterrechnen** behalten die SAT-Session
  samt gelernten Klauseln. Eingaben, Policy, Endvalidierung und Ausgabe bleiben gemeinsam.
- `continueOptimization()` verlängert die laufende Suchsession um das gewählte Zeitbudget.
- `runSearch()` prüft in langen Kandidatenschleifen etwa alle 16 ms, ob es dem Browser die Kontrolle zurückgeben muss. Fortschritt und Iterationen werden weiterhin höchstens alle 250 ms gemeldet; ein einzelner langsamer Evaluator-Aufruf kann die Pause überschreiten.
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

Während der Suche bewertet ein inkrementeller Evaluator Kandidaten, ohne jedes Mal das ganze Netz neu zu berechnen. Auch die Zusammenfassung der Halte- und Anschlussverletzungen wird inkrementell gepflegt; die Suche summiert diese Arrays nicht bei jedem getesteten Kandidaten erneut. Ein Konfliktindex priorisiert Probleme wie eine aktive Gleisüberschreitung oder eine verletzte Verbindung. Die Suche kombiniert drei Verfahren:

1. **Min-Conflicts mit Tabu-Suche** versucht zuerst, einen aktiven Konflikt zu verbessern. Die Tabu-Liste verhindert kurzfristige Rücksprünge in gerade verlassene Zustände.
2. **Simulated Annealing** probiert gelegentlich auch einen zunächst schlechter bewerteten Schritt. So kann die Suche aus einer lokalen Sackgasse herauskommen.
3. **Large-Neighborhood Search (LNS)** startet nach längerer Stagnation erneut von einer guten Lösung und verändert dafür mehrere Variablen in einem konfliktbezogenen Teilbereich.

Beide Verfahren sammeln geprüfte vollständige Zuweisungen in einem begrenzten Archiv mit bis zu 20 gültigen und 20 ungültigen Suchkandidaten. Auch verworfene Heuristik-Schritte bleiben für die Auswahl verfügbar. Alle archivierten Varianten werden exakt bewertet und höchstens fünf davon nach den gemeinsamen Soft-Kosten ausgegeben. Ein erster exakt gültiger Fahrplan wird bereits im Fortschritt gemeldet. Auch bei gültiger Baseline wird weiter nach besseren Soft-Zielen gesucht. Der Dialog verwendet genau ein konfiguriertes Budget, standardmässig 2.000 ms; Vorbereitung und Endprüfungen kommen dazu. Nur ohne freie Variablen oder bei vollständiger Enumeration endet die Suche früher. Weiterrechnen setzt Suchzustand und Archiv fort.

Gültige Alternativen stehen automatisch in der Tabelle; ungültige bleiben über den Einblendbutton verfügbar. Reparaturfortschritte erhalten fünf reservierte Plätze innerhalb der ungültigen Archivklasse. Exakt geprüfte Fortschrittskandidaten beider Klassen werden zusätzlich bis zur Endauswahl behalten. Beim Weiterrechnen aktualisiert sich die Liste während der Suche, ohne die Vorschau anzuwenden; mit der ersten gültigen Alternative verschwinden der Hinweis auf fehlende Machbarkeit und die ausgeklappten ungültigen Zeilen. Der User kann sie danach wieder explizit einblenden.

CP-SAT sucht zunächst mit den aktivierten harten Bewertungsregeln. Die harten Gleisrelationen verwenden denselben exakten Infrastruktur-Schätzer wie die Endvalidierung, nicht die näherungsweise Suchbewertung. Kandidaten werden inkrementell ausgewertet. Ist dieses Modell ausgeschöpft, enumeriert ein zweites Modell mit dem verbleibenden Budget auch ungültige Varianten. Locks, Auswahlgrenzen, Symmetriebindungen und Variablendomänen bleiben dabei erhalten. Ein Zeitablauf beweist keine Unlösbarkeit.

Eine aktive Anschlussregel erzwingt die konfigurierte Mindestumsteigezeit als absolute Untergrenze. Die bisherige Wartezeit begrenzt sie nicht nach oben; sie kann stattdessen als weiches Ziel „Bestehende Anschlusszeiten möglichst erhalten“ gewichtet werden.

Vor der Anzeige prüft der Service die Varianten erneut. Die Mindestumsteigezeit wird unabhängig aus den nativen Anschlussdaten und den vorgeschlagenen Zeiten validiert. Die Streckengleise werden für geänderte Abschnitte mit dem Infrastruktur-Schätzer berechnet; weitere aktive harte Regeln und Symmetrie werden geprüft. Verletzungen setzen `valid: false`, statt die Variante zu verwerfen. Nur gültige Varianten dürfen übernommen werden. Das Ranking beweist kein globales Optimum.

Das Suchbudget der fünf Stufen beträgt 4, 8, 16, 32 und 64 Sekunden. Eine automatische Diagnosesuche kann zusätzlich bis zur Hälfte des gewählten Budgets benötigen; Vorbereitungszeit und exakte Nachprüfungen kommen ebenfalls dazu. Ein End-to-End-Ziel ist nicht garantiert.

## 5. Stärken und Grenzen

### Was gut funktioniert

- Die Suche kann innerhalb eines begrenzten Zeitbudgets brauchbare Alternativen finden und mehrere unterschiedliche Vorschläge liefern.
- Sie arbeitet im Frontend mit bestehenden Netzgrafik-Modellen und benötigt keinen zusätzlichen Solver oder Backend-Dienst.
- Vorschau, Abbrechen und Übernehmen sind getrennt. Du kannst Änderungen prüfen, ohne sie sofort dauerhaft zu übernehmen.
- Der exakte Infrastruktur-Schätzer prüft die angezeigten Gleiswerte; die kompakte Topologie macht Unterschiede zwischen vorher und nachher sichtbar.
- Seed, Policy und Ergebnisrangfolge sind klar getrennt: Weiterrechnen sucht weiter, während ein Ändern der Soft-Ziel-Reihenfolge vorhandene Vorschläge neu sortiert.

### Was die Suche nicht verspricht

- Sie ist heuristisch: Sie garantiert weder die beste mögliche Lösung noch, dass in jedem Lauf eine Lösung gefunden wird.
- Ein Dialoglauf hat standardmässig 2.000 ms Suchbudget. Grössere oder schwierige Netze können mehr Zeit benötigen oder weniger Vorschläge liefern.
- Es werden höchstens fünf gültige Vorschläge automatisch und bis zu fünf ungültige Alternativen auf ausdrücklichen Wunsch angezeigt.
- Die Abschnittstabelle unter einer Lösung zeigt nur geänderte Abschnitte. Sie ist keine vollständige Liste aller unveränderten Kanten.
- Ein aktives Gleislimit wird hart geprüft. Wenn es deaktiviert ist, kann eine Lösung weiterhin eine hohe Gleiszahl haben; die Anzeige färbt sie dann nicht als Limitverletzung.
- „Weiterrechnen“ sucht im bestehenden Suchzustand weiter; ein besserer Vorschlag ist dennoch nicht garantiert.

## 6. Ausblick

Das sind mögliche nächste Schritte, keine bereits umgesetzten Funktionen:

- Dialog-Integrationstests für Panel-Exklusivität, Auswahl einer Variante, Vorschau, Abbrechen und Übernehmen.
- Benchmarks auf kleinen und grossen realen Netzen, damit Zeitbudget und Reaktionsverhalten besser eingeschätzt werden können.
- Eine Fortschrittsanzeige oder Ausführung in einem Web Worker, falls die Suche bei grossen Netzen die Oberfläche spürbar blockiert.
- Eine verständliche Begründung je Vorschlag: welche Konflikte beseitigt wurden und welche Kennzahlen sich dafür verschlechtert haben.
- Filter für die Detailtabelle, zum Beispiel nur Abschnitte über dem Limit oder nur Abschnitte mit geänderter Gleiszahl.

## 7. Wo du im Code weiterlesen kannst

Ein guter Einstieg ist die Dialog-Logik. Folge von dort `optimize()` zum Service, dann zu `runSearch()` und zum Evaluator. Für die sichtbare Darstellung gehe vom Dialog-Template zum Director oder `TrackTopologyComponent`. Die detaillierten Anforderungen und offenen Architekturfragen stehen weiterhin in [OPTIMIZE_TIMETABLE.md](./OPTIMIZE_TIMETABLE.md) und [UMSETZUNGSVORSCHLAG.md](./UMSETZUNGSVORSCHLAG.md).
