-- ob_zones hatte bisher nur SELECT (Ur-Migration)/INSERT (20260809140000)/DELETE (20260809150000)
-- für anon, nie UPDATE — fällt jetzt bei backfillObZones.ts' neuer correctMissedTouches()-
-- Korrekturpasse auf (Bug-Report Philip 2026-08-23: eine 4H-OB-Zone, die poi-watchers rollierendes
-- Live-Fenster strukturell nie wieder prüfen konnte, sollte rückwirkend auf touched=true korrigiert
-- werden — ohne diese Policy liefe das UPDATE ohne Fehler durch, ohne die Zeile tatsächlich zu
-- ändern, klassisches stilles RLS-Symptom, exakt wie schon bei liquidity_levels (20260823170000)
-- und davor trade_targets (20260809160000) erlebt).
-- Gleiches permissives Single-User-Modell wie die bestehenden Policies dieser Tabelle. poi-watcher
-- selbst nutzt weiterhin service_role, ändert sich nicht.
create policy "ob_zones anon update"
  on ob_zones for update
  to anon
  using (true)
  with check (true);
