# Datenvertrag und Persistenz

**Umsetzung:** `ResourceDto`/`Resource` enthalten in V1 ausschliesslich `id` und `capacity`. Knoten und Zuglaufsections verweisen ueber `resourceId` auf dieselbe Abstraktion. `capacity` bedeutet die Anzahl gleichzeitig nutzbarer Gleise. Alte JSON-Dateien mit weiteren Feldern bleiben lesbar; nicht mehr verwendete Felder werden nicht weiter persistiert.

**Test:** DTO-Round-trip mit `id` und `capacity`, altes DTO mit zusaetzlichen Feldern sowie Knoten- und Kantenreferenz auf eine Ressource. **UI:** nicht anwendbar.

**Commit:** `refactor(infrastructure): use capacity-only resource contract`