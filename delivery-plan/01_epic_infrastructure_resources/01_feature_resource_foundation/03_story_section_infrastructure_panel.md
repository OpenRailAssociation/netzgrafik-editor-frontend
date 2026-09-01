# Strecken-Infrastruktur

**Umsetzung:** Abschnittsdialog um einen eigenen Infrastruktur-Tab mit Gleisanzahl, Klasse, Geschwindigkeit, Elektrifizierung und OR-Mapping erweitern. Infrastruktur gehoert zur physisch gerichtungsunabhaengigen Kante $\{A,B\}$: Alle Zuglaufsections von A nach B oder B nach A verwenden denselben Ressourcendatensatz. Negative oder unrealistische Geschwindigkeit markieren.

**Test:** Component-Bindung, Persistenz, Validierung und richtungsunabhaengige gemeinsame Ressource. **UI:** Zwei Zuglaufsections zwischen denselben Knoten oeffnen; Aenderungen der einen Section muessen in der anderen sichtbar sein.

**Commit:** `feat(infrastructure): edit section resources in section dialog`