-- Rückwirkende Korrektur von trade_setups #105 nach dem detectSetupObs-Bugfix (Chat 2026-07-27:
-- "das ist die FVG, nicht die M5-OB") — die Zeile wurde noch mit der alten (zu weiten) Box
-- berechnet: top=c1.low, bottom=cur.high. Echte M5-Kerzen (GBPUSD, per forex-candles/Twelve Data
-- nachgeladen) für den betroffenen Zeitraum:
--   c1      13:45 UTC  low=1.33161 high=1.33185
--   impulse 13:50 UTC  low=1.33143 high=1.33183  (= ob_start_time, unverändert)
--   cur     13:55 UTC  low=1.33094 high=1.33158
-- Alte Box (c1.low bis cur.high) = 1.33161–1.33158 (bestätigt exakt die bisherigen DB-Werte).
-- Neue, korrekte Box (c1.low bis impulse.high, wie detectSetupObs jetzt rechnet) = 1.33161–1.33183.
update trade_setups
set ob_top = 1.33183,
    ob_bottom = 1.33161
where id = 105;

-- setup_entry/invalidation der beiden verlinkten GBPUSD-Trades (Migration
-- 20260727200000_link_gbpusd_trades_to_setup.sql) folgen derselben Ableitung wie tradeIntake.js:
-- bärisch (short) -> Entry = Unterkante, Invalidation = Oberkante.
update signals
set setup_entry = 1.33161,
    invalidation = 1.33183
where trade_setup_id = 105;
