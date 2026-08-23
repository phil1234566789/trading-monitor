-- liquidity_levels hatte bisher nur SELECT (Ur-Migration)/INSERT (20260823130000) für anon, nie
-- UPDATE — fiel erst bei backfillLiquidityLevels.ts' neuer correctMissedTouches()-Korrekturpasse
-- auf (Bug-Report Philip 2026-08-23: ein Feb-Pivot, den poi-watchers rollierendes Live-Fenster
-- strukturell nie wieder prüfen konnte, sollte rückwirkend auf touched=true korrigiert werden —
-- das UPDATE lief ohne Fehler durch, "corrected"-Zähler stieg, aber die Zeile blieb unverändert,
-- klassisches stilles RLS-Symptom, exakt wie schon bei trade_targets (20260809160000) erlebt).
-- Gleiches permissives Single-User-Modell wie die bestehenden Policies dieser Tabelle. poi-watcher
-- selbst nutzt weiterhin service_role, ändert sich nicht.
create policy "liquidity_levels anon update"
  on liquidity_levels for update
  to anon
  using (true)
  with check (true);
