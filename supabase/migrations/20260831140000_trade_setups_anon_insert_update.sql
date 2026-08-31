-- trade_setups war bisher anon-select-only (nur poi-watcher, per service_role, durfte schreiben) —
-- gleiches Muster wie ob_zones/liquidity_levels vor ihren jeweiligen anon-insert/-update-Policies
-- (20260809140000/20260823180000 bzw. 20260823130000). Fällt jetzt bei Task "Pin-Kontext: live
-- erkannte Trade-Setup-Box pinnen können" auf (Bug-Report Philip: "ich kann keine trade-setups
-- anpinnen") — findOrCreateTradeSetupId (src/tradeIntake.js) legt eine noch nicht von poi-watcher
-- persistierte Setup-Zeile per Upsert selbst an, lief mit dem anon-Key bisher gegen
-- "new row violates row-level security policy" (42501). Ein Upsert braucht sowohl INSERT (neue
-- Zeile) als auch UPDATE (ON CONFLICT-Zweig, falls poi-watcher inzwischen selbst geschrieben hat) —
-- ohne UPDATE liefe der Konflikt-Zweig sonst still ohne Fehler durch, ohne die Zeile tatsächlich zu
-- ändern (dasselbe stille RLS-Symptom wie bei ob_zones/liquidity_levels/trade_targets dokumentiert).
-- Gleiches permissives Single-User-Modell wie der Rest des Schemas. poi-watcher selbst nutzt
-- weiterhin service_role, ändert sich nicht.
create policy "trade_setups insert for anon"
  on trade_setups for insert
  to anon
  with check (true);

create policy "trade_setups anon update"
  on trade_setups for update
  to anon
  using (true)
  with check (true);
