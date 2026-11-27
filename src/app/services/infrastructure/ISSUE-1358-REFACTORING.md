# Gleisschätzung: vom bestehenden Code zu reviewbaren PRs

## Ziel

Die Berechnung des Gleisbedarfs auf Strecken und der Gleisbelegung an Knoten
soll unabhängig von der Darstellung sein. Streckengrafik und Knotenauslastung
verwenden dieselben Berechnungen. Das verhindert abweichende Ergebnisse und
ermöglicht spätere Analysen. Variantenvergleich und Optimierung selbst sind
nicht Teil dieses Auftrags.

Die Lösung ist auf `aeg/refactoring_streckengrafik_complete` bereits
implementiert und wurde laut Autor umfangreich getestet. **Wir verwenden
Code, Tests und Diff zu `main` als Ausgangspunkt** und leiten daraus rückwärts
verständliche, einzeln überprüfbare Änderungen ab (Reverse Engineering).
Wir programmieren die Lösung nicht ohne Grund neu.

## 1. Ausgangslage sichern

Momentaufnahme vom 27. November 2026:

- [Issue #1358](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1358)
  ist offen;
  [PR #1379](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/pull/1379)
  ist ein offener Draft von diesem Branch nach `main`. Den Umgang mit dem
  bestehenden PR vor neuen PRs mit den Maintainern klären.
- `main` auf `e942a81b` wurde mit `9ed5c17a` in den Referenzbranch gemergt.
  Der frühere Hinweis, `main` sei 55 Commits entfernt, ist überholt.
- Der Wendezeit-Fix `819cd046` aus `main` ist enthalten. Eine weitere
  Korrektur der **Knotengleisbelegung bei 120 und 120+** samt Test liegt
  aktuell nur im lokalen Arbeitsbaum. Sie gehört noch nicht zu einem Commit;
  das gemeldete Beispiel ist visuell noch zu prüfen.
- Die vier gezielt ausgeführten Estimator-/Streckengrafik-Testdateien
  bestanden mit 38 Tests; der Build bestand. Das ist kein Nachweis, dass
  sämtliche Tests oder alle manuellen Fälle geprüft wurden.

Vor Beginn:

1. `main` und den Referenzbranch aktualisieren; deren Commit-IDs festhalten.
2. `git status --short --branch` prüfen. Lokale, gestagte und ungestagte
   Änderungen ausdrücklich erfassen und erhalten. Die 120/120+-Korrektur
   nach Prüfung in einen nachvollziehbaren Referenzstand übernehmen; nichts
   verwerfen oder als bereits veröffentlicht voraussetzen.
3. Bestehende Tests und manuelle Prüfungen mit Ergebnis dokumentieren.
   Fehlende Nachweise und offene Fehler als solche kennzeichnen.
4. Mit den Maintainern Review-Vorgehen, Merge-Strategie und Rolle von #1379
   abstimmen. Bis dahin keine neuen Issues oder PRs voraussetzen.

## 2. Bestehende Änderung verstehen

Den Diff immer gegen den **festgehaltenen aktuellen** `main` prüfen:

```bash
git diff --stat origin/main..HEAD
git diff origin/main..HEAD -- src/app/services/infrastructure
git diff --cached
git diff
git status --short
```

`origin/main..HEAD` zeigt nur committete Änderungen; gestagte, ungestagte und
unversionierte Dateien separat prüfen. Falls `main` weiterzieht, die Basis
aktualisieren und Auswirkungen auf den Diff erneut prüfen.

| Bereich | Was der bestehende Code tut | Wo nachsehen |
| --- | --- | --- |
| Streckenschätzung | Für eine gerichtete Kante entstehen normalisierte Segmente mit benötigter Gleiszahl. Gegenrichtung, Frequenz und Headway beeinflussen das Ergebnis. | [Estimator](./infrastructure-estimator.service.ts), [Abschnittstests](./infrastructure-estimator.service.spec.ts) |
| Knotenschätzung | Für einen Knoten entstehen periodische Belegungen mit Ankunft, Abfahrt, Headway und Gleiszuweisung. Wenden, Durchfahrten und One-way-Enden unterscheiden sich. | [Estimator](./infrastructure-estimator.service.ts), [Knotentests](./infrastructure-estimator.node-track.spec.ts) |
| Streckengrafik | `Sg6TrackService` ordnet die Ergebnisse sichtbaren Fahrten und Korridoren zu; Komponenten zeichnen Reservierungen und Transitlinien. | [Track-Service](../../streckengrafik/services/sg-6-track.service.ts), [Integrationstests](../../streckengrafik/services/streckengrafik.services.spec.ts), [Renderingtests](../../streckengrafik/components/train-run-node/trainrun-node.component.spec.ts) |
| Knotenauslastung | Dieselbe Knotenschätzung wird für Stundenfenster, Filter und Kapazitätsanzeige aufbereitet. | [Datenaufbereitung](../../view/knoten-auslastung-view/knoten.auslastung.data.preparation.ts), [Ansicht](../../view/knoten-auslastung-view/knoten-auslastung-view.component.ts) |

Für jeden Bereich im Diff festhalten: **vorher**, **nachher**, fachlicher
Grund, Tests, Abhängigkeiten und mögliche Verhaltensänderungen. Historische
Commits helfen beim Verständnis; ihre Grenzen sind keine verpflichtenden
PR-Grenzen. Konflikte zwischen Code, Tests, `main` und erwarteter Fachlichkeit
mit einer fachkundigen Person klären statt den Referenzcode blind zu übernehmen.

## 3. Änderungen in dieser Reihenfolge aufteilen

Jeder Schritt soll einen verständlichen Diff, einen überprüfbaren Nutzen und
passende Tests haben. Die Reihenfolge sind **Abhängigkeiten**, nicht
zwangsläufig genau sechs PRs oder sechs neue Issues.

| Schritt | Aufgabe und Grund | Fertig, wenn … |
| --- | --- | --- |
| **1. Streckenschätzer** | Abschnittsberechnung und Tests aus der Streckengrafik lösen. Dies schafft eine unabhängig prüfbare Grundlage. | Gerichtete Profile, One-way, asymmetrische Fahrzeiten, Headway und Fahrzeit über der Frequenz sind mit konkreten Ergebnissen getestet; bestehende Verbraucher funktionieren weiter. |
| **2. Knotenschätzer** | Belegungen, Wenden und Gleiszuweisung als gemeinsame Berechnung bereitstellen. | Zeiten, Headway und konfliktfreie Zuordnung sind getestet; Frequenzen 120 und 120+ einschliesslich Stundenwechsel sind abgesichert. |
| **3. Streckengrafik anbinden** | Beide Schätzergebnisse in Korridore, Streckenmodelle und Knotenreservierungen übertragen. | Filter, Richtung, Offsets und mehrere Zugvorkommen stimmen mit den Schätzergebnissen überein; #1375 ist geprüft. |
| **4. Knoten zeichnen** | Reservierungen, Headway und Transitlinien aus den übertragenen Daten rendern. | SVG-Tests und manuelle Prüfung decken Richtung, One-way und Teilpfade ab; #1376 und #795 sind geprüft. |
| **5. Knotenauslastung anbinden** | Knotenergebnisse in Stundenfenster und Kapazitätsanzeige übersetzen. | Filter, Fenstergrenzen, Headway, Kapazität und Stundenwechsel sind geprüft; #63 ist geprüft. |
| **6. Aufräumen** | Alte doppelte Berechnung und ungenutzte Felder erst nach Umstellung der Verbraucher entfernen. | Verwendungen sind geprüft; Tests, UI und Build bleiben funktionsfähig. |

Schritt 1 und 2 können nach Sicherung der Basis unabhängig vorbereitet werden.
Schritt 3 benötigt beide; Schritt 4 benötigt 3. Schritt 5 benötigt 2 und
kann parallel zu 3/4 vorbereitet werden. Schritt 6 folgt erst nach 3–5.

**Wichtig:** Der heutige Diff mischt diese Themen. Deshalb vor jedem PR den
zugehörigen Code **und seine Voraussetzungen** aus dem Referenzstand
herauslösen. Wenn ein Teilschritt allein nicht baut oder Nutzerverhalten
bricht, kleiner anders schneiden, zusammen mit seiner Voraussetzung liefern
oder die Maintainer über eine geeignete Zwischenlösung entscheiden lassen.
Keinen fehlerhaften Zwischenstand nach `main` mergen.

## 4. Wiederholbarer Ablauf pro PR

1. **Abgrenzen:** Arbeitsschritt, Base-Branch, betroffene Dateien und
   Abhängigkeiten nennen. Den entsprechenden Teil des vorhandenen Diffs
   untersuchen; spätere Änderungen auf `main` erhalten.
2. **Übernehmen:** Passende Code- und Teständerungen aus dem Referenzbranch
   auf einen neuen Branch übertragen. Historische Commits können helfen,
   werden aber wegen gemischter Änderungen nicht blind übernommen.
3. **Prüfen:** Zugehörige Tests und Build ausführen. Für korrigiertes
   Verhalten einen konkreten Regressionstest nachweisen oder ergänzen.
   UI-Verhalten bei Darstellungsänderungen auch manuell prüfen.
4. **PR erklären:** Zweck, vorher/nachher, Diff-Grenze, Abhängigkeiten,
   bekannte Änderungen, Tests mit Ergebnissen und offene Punkte angeben.
   Bei einem Stack den PR auf den direkten Vorgänger als Base richten.
5. **Menschlich reviewen:** Eine fachkundige Person prüft Code, Tests und
   gegebenenfalls die Darstellung. Findings beantworten und Checks nach
   Änderungen erneut ausführen. Automatische Tests oder KI-Review ersetzen
   dieses Review nicht.
6. **Integrieren:** Nur nach vereinbarter Freigabe und erfolgreichen Checks
   gemäss der mit Maintainern gewählten Strategie in Abschnitt 6.

Die [CODEOWNERS](../../../../.github/CODEOWNERS) nennen das Maintainer-Team.
Welche Approvals, CI-Regeln und Offenlegung von KI-Unterstützung tatsächlich
verlangt werden, ist mit den Maintainern zu klären;
[CONTRIBUTING](../../../../CONTRIBUTING.md) beschreibt die derzeit offene
Projektpolitik zu KI-Beiträgen. Keine konkreten Branch-Protection-Regeln
annehmen.

## 5. Abschlussprüfung

Vor dem letzten Merge auf dem **tatsächlich zu mergenden Stand**:

- [ ] Jeder Teil-Diff ist menschlich reviewt; offene Findings und bewusste
      Abweichungen sind geklärt oder mit Maintainer-Zustimmung dokumentiert.
- [ ] Automatisierte Nachweise für Abschnitts- und Knotenschätzung,
      Integration, Rendering und Knotenauslastung prüfen; fehlende spezifische
      Tests ergänzen und nicht als bereits vorhanden ausgeben.
- [ ] Die konkreten Fälle [#1375](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1375),
      [#1376](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1376),
      [#795](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/795)
      und [#63](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/63)
      sowie den
      [zweistündigen Wendezeitfall](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/pull/1379#issuecomment-6211729320)
      mit ihren Reproduktionen prüfen.
- [ ] 120 und 120+ an **beiden Endbahnhöfen** prüfen: Belegung endet bei der
      korrekten Abfahrt; Stunden- und Frequenzwechsel sowie Headway bleiben
      korrekt. Das gemeldete Beispiel zusätzlich visuell kontrollieren.
- [ ] Tests, Lint, Build und gegebenenfalls geforderte Browserprüfungen
      ausführen; Befehle, Ergebnisse und nicht ausführbare Checks im PR
      festhalten.

Repository-Befehle für die Gesamtprüfung:

```bash
npm test
npm run lint
npm run build
```

Einzelne Testdateien können vorab mit
`npm test -- --include=<pfad-zur-spec.ts>` ausgeführt werden. Eine erfolgreiche
Teilsuite ersetzt nicht die abschliessenden Checks.

Die [frühere ausführliche Fassung](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/blob/49a381a613c94f23c2b42f69af76c792f9bb1880/src/app/services/infrastructure/ISSUE-1358-REFACTORING.md)
enthält historische Commit- und Testtabellen, die Issue-Reproduktionen sowie
den bereitgestellten Excel-Auszug. Dessen widersprüchliche Werte sind nicht
alle durch aktuelle Tests bestätigt und dürfen nicht ungeprüft als Sollwerte
übernommen werden. Historische Angaben zu Branch- und PR-Stand dort nicht
als aktuell behandeln.

## 6. Einschätzung: Wie nach `main` integrieren?

| Variante | Vorteil | Risiko / Bedingung |
| --- | --- | --- |
| **A: Ein grosser PR direkt nach `main`** | Wenig organisatorischer Aufwand. | Grosser Gesamt-Diff erschwert menschliches Review und Fehlersuche. Für diese Änderung nicht empfohlen. |
| **B: Mehrere kleine PRs nacheinander nach `main`** | Jeder Merge ist separat überprüfbar; Fehler lassen sich einem kleinen Schritt zuordnen. Kein späterer Gesamt-Merge nötig. | Jeder Zwischenstand muss bauen, getestet und für Nutzer akzeptabel sein; abhängige Schritte korrekt sortieren. |
| **C: Kleine PRs in einen Refactoring-Branch, danach ein PR nach `main`** | Teil-Diffs sind früh reviewbar; `main` sieht keine unfertigen Zwischenstände. | Der letzte Merge bleibt ein grosser Gesamt-Diff. Teil-Reviews müssen erhalten und für Maintainer sichtbar sein; Gesamtintegration und aktuelles `main` trotzdem nochmals prüfen. |

**Empfehlung: Variante B, sofern die Maintainer sie freigeben und jeder
Zwischenstand sicher ist.** Zuerst mit den Schätzern beginnen, danach die
Verbraucher anbinden und zuletzt aufräumen. Für jeden PR Abschnitt 4
ausführen; nach jedem Merge nächsten Branch auf das aktuelle `main`
ausrichten, den Diff auf bereits übernommene Änderungen kontrollieren und
betroffene Checks erneut ausführen.

**Wenn sichere Zwischenstände nicht möglich oder von Maintainern nicht
gewünscht sind: Variante C.** Einen gemeinsamen Refactoring-Branch von
aktuellem `main` anlegen; kleine PRs in Abhängigkeitsreihenfolge dagegen
erstellen, menschlich reviewen und erst nach Freigabe integrieren. Vor dem
abschliessenden PR nach `main` die Einzel-PRs verlinken, Änderungen seit deren
Reviews ausweisen und die Abschlussprüfung aus Abschnitt 5 auf dem
Gesamtstand wiederholen. Den grossen finalen Diff nicht als Ersatz für die
Einzelreviews betrachten.

**Erster konkreter Schritt:** Maintainern diese beiden Varianten und den
Zuschnitt aus Abschnitt 3 vorlegen. Erst nach deren Entscheidung festlegen,
ob #1379 Referenz bleibt oder wie der Draft weiterverwendet wird; danach mit
Schritt 1 und der gesicherten Baseline beginnen.
