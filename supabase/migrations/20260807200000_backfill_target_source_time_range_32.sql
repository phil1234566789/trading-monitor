-- Bug-Report Philip 2026-08-07: dealing_range #32 hat 3 Targets (1,15365 / 1,15448 / 1,15597),
-- aber keins zeichnet sich im Chart. Ursache: create_trade (MCP-Server) hat beim Insert nie
-- source_time gesetzt -- refreshTradeTargetLinksInternal in PriceChart.vue ueberspringt jedes
-- Target mit sourceTime==null komplett (siehe Migration 20260728140000_trade_targets_kind_and_source.sql).
-- Root-Cause-Fix in mcp-server/src/db.ts (createTrade setzt jetzt position.triggered_at als
-- source_time). Hier nur der Backfill fuer die 3 bereits bestehenden Targets dieser Range --
-- fruehester Entry der Range (Position #56, 2026-08-07T09:48:19+00:00) als Anker, seit dem die
-- Idee bestand.
update trade_targets
set source_time = '2026-08-07T09:48:19+00:00'
where dealing_range_id = 32 and source_time is null;
