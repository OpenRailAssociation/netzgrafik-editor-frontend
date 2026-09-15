# Externer Infrastrukturimport - Zurueckgestellt

## Status

Aktuell **nicht umsetzen und nicht ausliefern**. Das Infrastrukturmodell fuer Knoten und physische Kanten bleibt neutral und manuell pflegbar. Eine konkrete externe Datenquelle wird erst wieder angeschlossen, wenn der Importvertrag ueber Stammdaten oder Backend fachlich entschieden ist.

## Erprobter Prototyp

Ein OpenStreetMap-/Overpass-Prototyp wurde untersucht und wieder verworfen. Er enthielt einen Einstieg unter **Weitere Funktionen**, eine Vorschau mit Trefferstatus und einen expliziten Uebernehmen-Schritt. Die erprobte Zuordnungsreihenfolge war UIC, Betriebspunkt-Code, Fullname und Stadtname.

Die Untersuchung zeigte drei Gruende gegen eine direkte Auslieferung: Der oeffentliche Overpass-Dienst kann Timeouts und `504`-Antworten liefern, Bahnhofsattribute sind je Land uneinheitlich getaggt, und die fachliche Zuordnung ueber Code oder Name benoetigt einen kontrollierten Stammdatenvertrag statt stiller Heuristiken im Browser. Fuer die Schweiz wurde beispielsweise festgestellt, dass der Betriebspunkt in `railway:ref` statt in `ref` liegt und Bahnhöfe als Knoten, Wege oder Relationen modelliert sein koennen.

## Rezept fuer den geplanten Nachfolger

1. Einen versionierten, quellneutralen Import-DTO fuer Knoten- und physische Kantenressourcen definieren. Knoten werden ueber eine eindeutig dokumentierte Stammdatenkennung, Kanten ueber das normalisierte Knotenpaar $\{A,B\}$ zugeordnet.
2. Den jeweiligen Quelladapter ausserhalb der Komponenten implementieren, etwa fuer Stammdaten-CSV oder Backend. Der Adapter darf keine Editorservices und keine UI-Elemente kennen.
3. Eingabedaten gegen den DTO-Vertrag validieren und einen Importreport mit `bereit`, `mehrdeutig`, `ungueltig` oder `nicht zugeordnet` erzeugen.
4. Den Report in **Weitere Funktionen** in einer Vorschau zeigen. Der Benutzer waehlt explizit, welche Datensaetze uebernommen werden; vorhandene manuelle Werte erfordern eine zusaetzliche Bestaetigung.
5. Erst nach Bestaetigung die Daten ueber `ResourceService` an Knoten beziehungsweise alle Zuglaufsections derselben physischen Kante schreiben. Quelle und Aktualisierungszeitpunkt werden persistiert.
6. Tests: DTO-Validierung, Knoten- und Kantenidentitaet, Mehrdeutigkeiten, Vorschau ohne Mutation, explizites Uebernehmen, Ueberschreibwarnung und JSON-Round-trip.

Der Editor bleibt dabei ohne externen Netzwerkzugriff voll nutzbar.

## Test

Der externe Import ist zurueckgestellt. Regressionstests decken weiterhin das neutrale Ressourcenmodell, seine JSON-Persistenz und die Knoten-/Kantenbearbeitung ab.

## Commit

Kein `feat(infrastructure): import resources from overpass`, bis der Stammdaten-/Backendvertrag beschlossen ist.