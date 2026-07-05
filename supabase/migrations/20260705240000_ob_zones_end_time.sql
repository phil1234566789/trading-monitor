-- touched_at/invalidated_at (Wanduhr-Zeit, wann der Cron es bemerkt hat) war der falsche
-- Ansatz fuers Chart-Rendering: gebraucht wird die Kerzen-Zeit, ab der die Zone nicht mehr
-- weiterwaechst (das berechnet detectOrderBlocks() schon selbst als `endTime`, wurde aber
-- nie persistiert). Ersetzt durch `end_time` — direkt aus der Zonen-Erkennung uebernommen,
-- keine Wanduhr-Herleitung mehr noetig. touched_at/invalidated_at (erst diese Session
-- eingefuehrt, nie sinnvoll genutzt) werden wieder entfernt.
alter table ob_zones
  add column end_time timestamptz,
  drop column touched_at,
  drop column invalidated_at;
