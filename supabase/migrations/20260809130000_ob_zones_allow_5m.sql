-- Erlaubt '5M' als timeframe in ob_zones (Chat 2026-08-09: Lana braucht für Backtests einen
-- festen historischen Zeitpunkt — für einen fixen Zeitpunkt in der Vergangenheit bringt "live
-- neu berechnen" (bisheriges M5-Verhalten, siehe get_data_export's m5ObZones) keinen Vorteil
-- gegenüber einmal persistieren, nur mehr Wartezeit. Bewusste Abkehr von der bisherigen Regel
-- "M5 wird nie persistiert" (siehe CLAUDE.md) — NUR für den per Backfill-Script abgedeckten
-- historischen Zeitraum, poi-watchers Live-Cron bleibt unverändert (erkennt weiterhin nur 1H/4H
-- live, siehe TIMEFRAMES in poi-watcher/index.ts).
alter table ob_zones drop constraint ob_zones_timeframe_check;
alter table ob_zones add constraint ob_zones_timeframe_check check (timeframe in ('1H', '4H', '5M'));
