-- Task "Market-Structure-Startpunkt: 1D-Periode-4-Pivots" — 1D-Kerzen werden ab jetzt persistiert
-- (neue daily-structure-pivots-Edge-Function, siehe 20260830091000_daily_structure_pivots.sql),
-- bisher schloss forex_candles' bar-CHECK-Constraint (Migration 20260809120000) '1D' explizit aus
-- ("1D-Fetches bleiben reine Live-Reads"). Label bleibt "1D" (Großbuchstabe D), wie in
-- timeframes.js/PERIOD_MAP, nicht "1d".
alter table forex_candles drop constraint forex_candles_bar_check;
alter table forex_candles add constraint forex_candles_bar_check check (bar in ('5m', '1h', '4h', '1D'));
