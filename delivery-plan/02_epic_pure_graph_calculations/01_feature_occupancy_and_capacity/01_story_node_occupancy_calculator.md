# Gleisbelegungsrechner

**Umsetzung:** Pure Funktion ausschliesslich aus `Node`, `Trainrun`, `TrainrunSection` und `Resource`. Sie bestimmt aus Takt, Haltezeiten, Zugfolgezeiten, Uebergaengen und Endpunktbelegungen die zyklisch ausgerollten Reservierungen. Jede Reservierung wird dem niedrigsten freien Gleis zugeteilt. Das Ergebnis pro Knoten ist `TrainrunSection, startMinute, endMinute, trackNumber`; die Zahl verwendeter Gleise ist damit minimal und konfliktfrei. Der Analysehorizont ist mindestens 60 Minuten und erweitert sich auf die gemeinsame Taktperiode, begrenzt auf 24 Stunden.

**Test:** Parallele Aufenthalte, Nicht-Halt, Endpunktbelegung, Takt-Ausrollung, fehlende Ressource und Kapazitaetsgrenzen. **UI:** nicht anwendbar.

**Commit:** `refactor(analytics): extract domain-only node track allocator`