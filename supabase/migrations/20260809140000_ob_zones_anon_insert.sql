-- ob_zones war bisher anon-select-only (nur poi-watcher, per service_role, durfte schreiben) —
-- anders als der Rest des Schemas, das schon überall sonst dem permissiven Single-User-Anon-
-- Modell folgt (news_events/sessions/trading_schedules/dealing_ranges/trade_positions/...).
-- backfillObZones.ts (Chat 2026-08-09, historischer OB-Backfill fürs Lana-Backtesting) läuft wie
-- backfillForexCandles.ts mit dem anon-Key, kein service_role verfügbar für lokale Einmal-Scripts —
-- Insert deshalb freigegeben, angeglichen an den Rest des Schemas. poi-watcher selbst nutzt
-- weiterhin service_role, ändert sich nicht.
create policy "ob_zones insert for anon"
  on ob_zones for insert
  to anon
  with check (true);
