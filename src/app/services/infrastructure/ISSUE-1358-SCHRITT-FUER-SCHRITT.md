# Issue #1358: Schritt für Schritt in kleinen PRs nach main

## Was ist der Plan?

Der grosse [Draft-PR #1379](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/pull/1379)
enthält bereits die gewünschte Lösung, ist aber für ein einzelnes Review zu
gross. Wir behalten diesen Code als **Referenz** und übertragen ihn
schrittweise in kleinere PRs. Jeder PR wird einzeln gegen `main` eröffnet,
menschlich geprüft und nach Freigabe gemergt. Erst danach beginnt der nächste
Schritt auf dem aktualisierten `main`.

**Ziel:** Am Ende ist die Lösung von heute inklusive Tests und Fehlerkorrekturen
auf `main`. Neuere Änderungen auf `main` bleiben ebenfalls erhalten. Wir
entfernen keine Funktion nur deshalb, weil ein alter Commit sie nicht enthält.
Die [Übersicht](./ISSUE-1358-REFACTORING.md) erklärt Motivation und Architektur.

> **Wichtig:** Das ist ein ausführbarer Vorschlag, keine Garantie, dass alle
> Diffs bereits fertig getrennt sind. Die vorhandenen Änderungen greifen
> teilweise ineinander. Vor jedem Merge muss der Zwischenstand funktionieren;
> wenn das nicht gelingt, mit den Maintainern den Schnitt ändern.

## Begriffe

- **`main`:** gemeinsamer Hauptbranch; hierhin sollen die kleinen PRs.
- **Referenzbranch:** `aeg/refactoring_streckengrafik_complete`; dort liegt
  die bisherige Gesamtlösung. Er wird nicht gelöscht oder umgeschrieben.
- **Arbeitsbranch:** neuer Branch für genau einen kleinen PR, erstellt vom
  jeweils aktuellen `origin/main`.
- **Diff:** Unterschiede zwischen zwei Ständen. Ein Reviewer prüft im PR
  den Diff des Arbeitsbranches zu `main`.
- **PR / Pull Request:** Vorschlag auf GitHub, einen Arbeitsbranch nach
  `main` zu übernehmen. Merge erfolgt erst nach menschlichem Review und
  den erforderlichen Checks.

## 0. Vor dem ersten PR

### 0.1 Maintainer um Zustimmung bitten

Schreibe im bestehenden Issue oder Draft-PR sinngemäss:

> Der aktuelle PR ist zu gross für ein gutes Review. Ich möchte seine
> bestehende Lösung in kleine, nacheinander nach `main` gerichtete PRs
> aufteilen. Jeder Zwischenstand soll funktionieren und getestet sein.
> Ist dieser Zuschnitt und dieses Vorgehen für euch passend? Soll #1379
> währenddessen als Referenz offen bleiben? Welche Reviews und CI-Checks
> erwartet ihr, und wie soll KI-Unterstützung offengelegt werden?

Warte auf die Antwort, bevor du den bestehenden PR schliesst oder die
Aufteilung als beschlossen behandelst. `CODEOWNERS` nennt das Maintainer-Team;
die tatsächlich erforderliche Anzahl Approvals und die Merge-Methode müssen
geklärt werden.

### 0.2 Ausgangsstände festhalten

Stand dieses Plans am 27. November 2026:

| Stand | Commit | Bedeutung |
| --- | --- | --- |
| `main` | `e942a81bec8d71b46455a721220b4777bebc47db` | Ausgangspunkt der Aufteilung zum Zeitpunkt der Planung. |
| Referenz | `5eda0ac0d94ac984c76dd06e07b6a42902c6f211` | Heutige Gesamtlösung inklusive 120/120+-Wendezeit-Fix und Tests. |

Der Referenzcommit ist bereits gepusht. Er ist der feste Vergleichsstand,
auch wenn später auf dem Referenzbranch weitergearbeitet wird. Falls weitere
Fixes hinzukommen, müssen sie ausdrücklich in den Plan aufgenommen und
gereviewt werden. Der Wendezeitfall wurde automatisiert getestet; eine
visuelle Prüfung des gemeldeten Beispiels steht noch aus.

Im Terminal im Repository:

```bash
git status --short --branch
git fetch origin main
git log -1 --oneline origin/main
git log -1 --oneline 5eda0ac0
git diff --stat origin/main 5eda0ac0
```

`git fetch` lädt den aktuellen Stand, ohne deinen Arbeitsbranch zu ändern.
Wenn `git status` Änderungen zeigt: **nicht überschreiben oder verwerfen**.
Zuerst klären, wohin sie gehören. Die Commit-ID von `main` und die
Testergebnisse als Ausgangslage notieren. `main` kann sich später ändern;
vor jedem neuen PR erneut aktualisieren.

### 0.3 Testbasis prüfen

Auf dem Referenzstand die folgenden vorhandenen Tests sowie den Build
ausführen; Befehl und Ergebnis festhalten:

```bash
npm test -- --include=src/app/services/infrastructure/infrastructure-estimator.service.spec.ts --include=src/app/services/infrastructure/infrastructure-estimator.node-track.spec.ts --include=src/app/streckengrafik/services/streckengrafik.services.spec.ts --include=src/app/streckengrafik/components/train-run-node/trainrun-node.component.spec.ts
npm run build
```

Der gezielte Testlauf bestand zuletzt mit 38 Tests; das ersetzt keinen neuen
Lauf auf dem festgehaltenen Stand. Benötigt ein Test Chrome oder fehlen
Pakete, den Fehler dokumentieren und die Umgebung gemäss Repository-Anleitung
einrichten. Nicht ausgeführte Tests sind nicht bestanden.

## 1. Vorgeschlagene PR-Reihenfolge

Die Dateinamen sind Orientierung im **Referenzstand**, nicht die Anweisung,
ganze Dateien ungeprüft zu kopieren. Tests und Voraussetzungen gehören jeweils
zum PR. Kleine Unterschiede in der endgültigen PR-Anzahl sind in Ordnung.

### PR 1 — Streckenschätzer samt Testdaten bereitstellen

**Warum zuerst?** Die neue Berechnung kann unabhängig getestet werden,
während die bisherige Streckengrafik weiter funktioniert.

- Die benötigten Teile von
  [infrastructure-estimator.service.ts](./infrastructure-estimator.service.ts)
  übernehmen: `TrackSegmentEstimate`, `estimateSectionTracks` und deren
  notwendige Hilfen. Nicht schon den gesamten Knoten-Estimator mitkopieren.
- [Abschnittstests](./infrastructure-estimator.service.spec.ts) und ihre
  [Testdaten](../../../integration-testing/test-data/testNetzugrafikTrackEstimator.json)
  samt [Fixture-Helfer](../../../integration-testing/netzgrafik.unit.testing.track.estimator.ts)
  übernehmen. Die grosse JSON-Datei im PR erklären; falls sie das Review
  erschwert, mit den Maintainern einen separaten Testdaten-PR vereinbaren.
- **Noch nicht** die bestehende Anzeige auf die neue Berechnung umstellen.
- **Abnahme:** Tests für gerichtete Profile, One-way, unterschiedliche
  Fahrzeiten und den 62/60-Minuten-Fall bestehen; alter Datenfluss und Build
  bleiben funktionsfähig.

### PR 2 — Streckengrafik an Streckenschätzer anschliessen

**Warum jetzt?** Erst nach der getesteten Berechnung den tatsächlichen
Verbraucher umstellen.

- In [sg-6-track.service.ts](../../streckengrafik/services/sg-6-track.service.ts)
  nur die Abschnittsschätzung und ihre Zuordnung zu `TrackData` übernehmen.
  Die bisherige **Knoten**berechnung zunächst erhalten.
- Korridororientierung, sichtbare Abschnitte und Segmentgrenzen prüfen;
  passende Tests aus
  [streckengrafik.services.spec.ts](../../streckengrafik/services/streckengrafik.services.spec.ts)
  übernehmen oder gezielt ergänzen.
- **Abnahme:** Die Streckengrafik nutzt die neue Abschnittsschätzung;
  Knotenanzeige und vorhandene Interaktionen funktionieren weiterhin.

### PR 3 — Knotenschätzer bereitstellen

**Warum separat?** Wendezeiten, periodische Belegungen und Gleiszuweisung
haben eigene fachliche Regeln und sollen ohne SVG geprüft werden können.

- Im Estimator `NodeTrackEstimate`, `NodeTrackOccupancy`,
  `estimateNodeTracks` und zugehörige Hilfen übernehmen. Notwendige
  `MathUtils`-Methoden aus [math.ts](../../utils/math.ts) ergänzen, ohne
  vorhandenes `clamp` aus `main` zu entfernen.
- [Knotentests](./infrastructure-estimator.node-track.spec.ts) einschliesslich
  des Fixes aus `5eda0ac0` übernehmen.
- Vorläufig bleibt die alte Knotenanzeige aktiv; keine unvollständige
  Umstellung der UI.
- **Abnahme:** A1-Gleiszuweisungen, Headway, konfliktfreie Belegungen,
  One-way, kurze und zu kurze Wenden sowie 120/120+ an beiden Enden sind
  getestet. Falls dieser Diff zu gross ist, mit Maintainern einen kleineren
  Schnitt mit jeweils ausführbaren Tests festlegen; keine halbfertige
  Berechnung als abgeschlossen ausgeben.

### PR 4 — Reservierungsmodell vorbereiten

**Warum?** Der neue Estimator liefert konkrete Reservierungen; das bestehende
Rendering auf `main` erwartet noch andere Daten.

- Die benötigten Reservierungstypen und Lookup-Funktionen aus
  [sg-trainrun-node.ts](../../streckengrafik/model/streckengrafik-model/sg-trainrun-node.ts)
  und zugehörige Modelltests **additiv** übernehmen.
- Vorhandene Felder und Aufrufer zunächst erhalten; die bestehende Anzeige
  darf durch leere neue Daten nicht verschwinden.
- **Abnahme:** Alte Anzeige unverändert, neues Modell gezielt getestet.
  Alte Felder erst nach Umstellung und Prüfung ihrer Verwendungen entfernen.

### PR 5 — Knotenschätzung und Rendering gemeinsam umstellen

**Warum zusammen?** Auf `main` zeichnet
`train-run-item.component.html` noch ohne Reservierungs-Input. Der
Referenzstand erzeugt Reservierungen in `Sg6TrackService` und rendert sie
über Item- und Node-Komponenten. Nur eine Seite umzustellen kann die Anzeige
brechen.

- Knotenreservierungen in
  [sg-6-track.service.ts](../../streckengrafik/services/sg-6-track.service.ts)
  aus `estimateNodeTracks` übernehmen und nach Fahrt, Abschnitt und Offset
  zuordnen.
- Die zusammengehörenden Änderungen in
  [train-run-item](../../streckengrafik/components/train-run-item/),
  [train-run-node](../../streckengrafik/components/train-run-node/),
  dem Modell und den Integrationstests übertragen.
- One-way-Richtung aus
  [sg-1-load-trainrun-item.service.ts](../../streckengrafik/services/sg-1-load-trainrun-item.service.ts)
  übernehmen, soweit für die tatsächliche Darstellung erforderlich; spätere
  unabhängige Vereinfachungen bleiben für PR 7.
- **Abnahme:** Ankunft, Abfahrt, Headway, Transitlinien und zugeordnetes
  Gleis stimmen bei Vorwärts-, Rückwärts-, One-way- und Teilpfaden. Fälle
  [#1375](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1375),
  [#1376](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1376)
  und [#795](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/795)
  mit Reproduktion und Tests prüfen. 120/120+ auch visuell prüfen.
- **Falls zu gross:** Mit den Maintainern eine explizite, testbare
  Übergangslösung vereinbaren und danach entfernen. Kein stiller Fallback
  und keine Trennung, bei der `main` eine kaputte Knotenanzeige erhält.

### PR 6 — Knotenauslastung umstellen

**Warum?** Die zweite Ansicht soll dieselben Knotenbelegungen verwenden.
Sie benötigt PR 3; nach PR 5 ist auch der visuelle Vergleich möglich.

- Änderungen in
  [knoten-auslastung-view](../../view/knoten-auslastung-view/),
  zugehörige Texte in DE/EN/FR und notwendige Tests übernehmen.
- Zwei Stunden, Fenstergrenzen, Filter, Headway, Kapazität und
  Stundenumschaltung prüfen; für
  [#63](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/63)
  und den
  [zweistündigen Wendezeitfall](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/pull/1379#issuecomment-6211729320)
  konkrete Regressionen nachweisen oder ergänzen.
- **Abnahme:** Knotenauslastung und Streckengrafik sind anhand gleicher Daten
  fachlich konsistent; Tests und manuelle Prüfungen sind dokumentiert.

### PR 7 und falls nötig weitere — Altes entfernen und vereinfachen

**Warum zuletzt?** Erst jetzt können alte Daten und Berechnungen ohne Verlust
der beiden Verbraucher entfernt werden.

- Verbleibende Unterschiede der Services `sg-1` bis `sg-8`, Modelle, Slider
  und Tests einzeln mit dem Referenz-Diff vergleichen. Nur zusammengehörende
  Änderungen pro PR übernehmen.
- Vor jeder Löschung Verwendungen suchen und die zugehörigen Tests ausführen.
  Grosse Löschungen nach Verantwortung auf mehrere PRs verteilen.
- **Abnahme:** Keine doppelte alte Schätzung oder ungenutzten Übergangsfelder
  bleiben; Auswahl, Filter, Slider, Rendering und Tests funktionieren.

### Letzter Schritt — Vollständigkeit nachweisen

Keine stillen Lücken: Die Referenz enthält auch Änderungen an Übersetzungen,
Fixtures, Modellen und Tests. Alle Dateien aus
`git diff --name-status origin/main 5eda0ac0` durchgehen und jedem Unterschied
zuordnen: bereits übernommen, notwendige Anpassung wegen neuerem `main`,
bewusst nicht übernommen mit Begründung oder noch offen. Dokumente separat
betrachten. Offene fachliche Unterschiede verhindern die Abnahme.

## 2. So erstellst du jeden PR

Diese Schritte für jeden PR wiederholen. **Beginne den nächsten erst, wenn
der vorherige auf `main` gemergt ist.** Beispiel für PR 1:

1. **Arbeitsbaum prüfen und `main` aktualisieren:**

   ```bash
   git status --short --branch
   git fetch origin main
   git log -1 --oneline origin/main
   ```

   Wenn Änderungen angezeigt werden, zuerst sichern oder zuordnen; nicht
   fortfahren, bis ein sauberer Ausgangspunkt vorhanden ist.

2. **Neuen Arbeitsbranch direkt von aktuellem `main` erstellen:**

   ```bash
   git switch -c refactor/1358-01-section-estimator origin/main
   ```

   Für spätere PRs einen neuen, passenden Namen verwenden, z. B.
   `refactor/1358-02-section-integration`. Existiert ein Name bereits,
   zuerst dessen Inhalt prüfen, statt ihn zu überschreiben.

3. **Referenz ansehen und nur den vorgesehenen Teil übernehmen:**

   ```bash
   git diff origin/main 5eda0ac0 -- src/app/services/infrastructure/infrastructure-estimator.service.ts
   ```

   Passe den Pfad an den jeweiligen Schritt an. In VS Code kannst du die
   Unterschiede ebenfalls vergleichen und passende Änderungen mit ihren Tests
   übertragen. Eine neue Datei oder ein historischer Commit kann mehrere
   Schritte enthalten: nicht pauschal alles kopieren oder cherry-picken.
   Bei Konflikten oder unklarer Fachlichkeit stoppen und Hilfe einholen.

4. **Prüfen und Diff kontrollieren:**

   ```bash
   git status --short
   git diff --stat
   git diff
   npm test -- --include=src/app/services/infrastructure/infrastructure-estimator.service.spec.ts
   npm run build
   ```

   Der Testbefehl ist das Beispiel für PR 1; später die tatsächlich betroffenen
   Specs einsetzen. Pro PR zusätzlich die von Maintainern verlangten Checks
   ausführen. Fehler beheben oder offen melden; nicht als erfolgreich ausgeben.

5. **Änderungen für den Commit auswählen:**

   ```bash
   git add -p
   git status --short
   git diff --cached
   ```

   `git add -p` fragt für vorhandene Dateien nach einzelnen Änderungsteilen.
   **Neue Dateien** zusätzlich ausdrücklich mit `git add <dateipfad>` auswählen.
   Vor dem Commit prüfen, dass nur dieser PR vorgemerkt ist. Keine fremden
   lokalen Änderungen mit aufnehmen.

6. **Commit und Push:** Für PR 1 zum Beispiel:

   ```bash
   git commit -m "refactor: add section track estimator"
   git push -u origin refactor/1358-01-section-estimator
   ```

7. **Auf GitHub PR öffnen:** Base `main`, Compare der gerade gepushte
   Arbeitsbranch. Issue #1358 verlinken, aber noch nicht mit `Closes #1358`
   schliessen. PR-Text: Zweck, Vorher/Nachher, Abhängigkeiten, Tests und
   Ergebnisse, manuelle Prüfungen, bekannte Abweichungen sowie Link zum
   Referenzbranch. Menschliches Review anfordern.

8. **Nach Review:** Kommentare beantworten, Korrekturen auf denselben Branch
   committen und pushen; Tests bei Bedarf erneut ausführen. Erst nach
   Freigabe und erfolgreichen Pflicht-Checks gemäss Maintainer-Vorgaben
   mergen lassen. Den Merge auf GitHub bestätigen, danach für den nächsten
   PR wieder bei Schritt 1 beginnen.

## 3. Finale Abnahme

Wenn alle PRs gemergt sind:

```bash
git status --short --branch
git fetch origin main
git diff --name-status origin/main 5eda0ac0
git diff origin/main 5eda0ac0 -- src/app/services/infrastructure src/app/streckengrafik src/app/view/knoten-auslastung-view src/app/utils/math.ts src/assets/i18n src/integration-testing
```

Jeden verbleibenden Unterschied prüfen und dokumentieren. Eine leere Diff-Liste
allein beweist keine fachliche Gleichheit; umgekehrt können spätere
`main`-Änderungen einen gerechtfertigten Unterschied erzeugen. Das heutige
Referenzverhalten und seine Tests dürfen nicht unbemerkt fehlen.

Für die Tests auf den tatsächlich gemergten Stand wechseln: Nur bei sauberem
Arbeitsbaum den folgenden neuen Prüfbranch von `origin/main` erstellen. Falls
der Name bereits existiert, einen anderen wählen und den bestehenden Branch
nicht überschreiben.

```bash
git switch -c refactor/1358-final-check origin/main
npm test
npm run lint
npm run build
```

Zusätzlich die gemeldeten UI-Fälle, insbesondere beide 120/120+-Endbahnhöfe,
Filter und Knotenauslastung, manuell prüfen. Testergebnisse, ungeklärte
Abweichungen und alle Teil-PRs im Parent-Issue dokumentieren. Erst wenn
Vollständigkeit und menschliche Freigabe bestätigt sind, #1358 nach
Absprache abschliessen.
