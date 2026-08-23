-- liquidity_levels war bisher anon-select-only (nur poi-watcher, per service_role, durfte
-- schreiben) — gleiches Muster wie ob_zones vor 20260809140000_ob_zones_anon_insert.sql.
-- backfillLiquidityLevels.ts (Bug-Report Philip 2026-08-23: ein Level vom Februar 2026 konnte
-- nicht gepinnt werden, weil poi-watchers rollierendes Live-Fenster nie so weit zurückreicht)
-- läuft wie backfillObZones.ts mit dem anon-Key, kein service_role verfügbar für lokale
-- Einmal-Scripts — Insert deshalb freigegeben, angeglichen an den Rest des Schemas. poi-watcher
-- selbst nutzt weiterhin service_role, ändert sich nicht.
create policy "liquidity_levels insert for anon"
  on liquidity_levels for insert
  to anon
  with check (true);
