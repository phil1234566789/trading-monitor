-- Testdaten-Konsolidierung (Chat 2026-07-31, analog zur GBPUSD-Long-Merge vom selben Tag): die
-- GBPUSD-Short-Trades "Split-Entry Teil 1/2 von 2" (trade_positions 2/3, 27.07.2026 14:17/14:41)
-- waren beim ursprünglichen Backfill je 1:1 in eigene dealing_ranges (11/12) gewandert, obwohl sie
-- laut Philip dieselbe Idee sind — beide dealing_ranges sind ohnehin schon identisch (instrument/
-- direction/invalidation/trade_setup_id). Merge auf 11 (der frühere Entry), 12 wird geleert+gelöscht.

update trade_positions set dealing_range_id = 11 where id = 3;
update trade_targets set dealing_range_id = 11 where dealing_range_id = 12;

delete from dealing_ranges where id = 12;
