-- Testdaten-Konsolidierung (Chat 2026-08-08, analog zu 20260731180000): die drei EURUSD-Short-Trades
-- vom 06.08. (trade_positions 65/66/67, Entries ~14:50-14:54 Berlin) waren beim Einpflegen aus dem
-- Broker-Export je 1:1 in eigene dealing_ranges (37/38/39) gewandert, gehören laut Philip aber
-- alle zur selben Idee. Merge auf 37 (der früheste/erste Entry), 38 und 39 werden geleert+gelöscht.

update trade_positions set dealing_range_id = 37 where id in (66, 67);
update trade_targets set dealing_range_id = 37 where dealing_range_id in (38, 39);

delete from dealing_ranges where id in (38, 39);
