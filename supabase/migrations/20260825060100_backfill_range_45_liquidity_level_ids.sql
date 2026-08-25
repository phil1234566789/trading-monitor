-- Backfill für Dealing Range #45 (EURUSD Short, 21.08.2026, Laniakea-Testlauf 2026-08-24/25):
-- die drei kind='pivot'-Einträge (trade_confirmations #55, trade_targets #60/#61) wurden VOR der
-- liquidity_level_id-Konsolidierung (siehe 20260825060000) mit rohem price/source_time angelegt.
-- Legt die entsprechenden liquidity_levels-Zeilen nachträglich per Upsert an (dieselbe
-- instrument/timeframe/direction/pivot_time-Kombination, die findOrCreateLiquidityLevelId künftig
-- auch live verwendet) und verlinkt die drei bestehenden Zeilen darauf.

insert into liquidity_levels (instrument, timeframe, direction, price, pivot_time, touched, end_time)
values
  ('EURUSD', '1H', 'high', 1.17106, '2026-08-20T10:00:00+00:00', true, '2026-08-21T09:10:00+00:00'),
  ('EURUSD', '1H', 'low', 1.16867, '2026-08-21T07:00:00+00:00', true, '2026-08-21T12:35:00+00:00'),
  ('EURUSD', '1H', 'low', 1.16691, '2026-08-20T16:00:00+00:00', true, '2026-08-21T14:35:00+00:00')
on conflict (instrument, timeframe, direction, pivot_time)
do update set touched = excluded.touched, end_time = excluded.end_time;

update trade_confirmations set liquidity_level_id = (
  select id from liquidity_levels where instrument = 'EURUSD' and timeframe = '1H' and direction = 'high' and pivot_time = '2026-08-20T10:00:00+00:00'
) where id = 55;

update trade_targets set liquidity_level_id = (
  select id from liquidity_levels where instrument = 'EURUSD' and timeframe = '1H' and direction = 'low' and pivot_time = '2026-08-21T07:00:00+00:00'
) where id = 60;

update trade_targets set liquidity_level_id = (
  select id from liquidity_levels where instrument = 'EURUSD' and timeframe = '1H' and direction = 'low' and pivot_time = '2026-08-20T16:00:00+00:00'
) where id = 61;
