-- Erlaubt '5M' als timeframe in liquidity_levels (Chat 2026-08-27, TSC-Neuaufbau) — dieselbe
-- Abkehr von "M5 wird nie persistiert" wie schon bei ob_zones (siehe
-- 20260809130000_ob_zones_allow_5m.sql), aus demselben Grund: eine TSC-Sweep-Bestätigung/-Target
-- auf M5 soll per echter liquidity_level_id mit dem bestehenden Chart-Objekt verknüpft werden
-- (findOrCreateLiquidityLevelId in tradeIntake.js), statt Richtung/Preis als eigenen Snapshot auf
-- trade_confirmations/trade_targets zu duplizieren — Philip: "ich will ehrlich gesagt, dass echte
-- Verknüpfungen stattfinden ... alle benötigten Informationen sollen im Chart-Objekt persistiert
-- sein". poi-watchers Live-Cron bleibt unverändert (erkennt weiterhin nur 1H/4H live, siehe
-- TIMEFRAMES in poi-watcher/index.ts) — 5M-Zeilen entstehen ausschließlich on-demand über den
-- Chart-Klick-Weg.
alter table liquidity_levels drop constraint liquidity_levels_timeframe_check;
alter table liquidity_levels add constraint liquidity_levels_timeframe_check check (timeframe in ('1H', '4H', '5M'));
