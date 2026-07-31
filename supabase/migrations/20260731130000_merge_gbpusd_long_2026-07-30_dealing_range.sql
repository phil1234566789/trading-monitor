-- Testdaten für die neue dealing_ranges/trade_positions-Aufteilung (Chat 2026-07-31): die drei
-- GBPUSD-Long-Trades vom 30.07.2026 (trade_positions 18/19/20) waren beim Backfill der vorigen
-- Migration je 1:1 in eine eigene dealing_range gewandert (18/19/20), gehören aber laut Philip
-- alle zur selben Idee. Merge auf dealing_range 18 (die früheste), 19+20 werden geleert und
-- gelöscht — Philip: invalidation/trade_setup_id bleiben null wie bisher, nichts Neues zu setzen.

update trade_positions set dealing_range_id = 18 where id in (19, 20);
update trade_targets set dealing_range_id = 18 where dealing_range_id = 20;

delete from dealing_ranges where id in (19, 20);
