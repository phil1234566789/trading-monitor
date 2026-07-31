-- Box statt Linie für OB-Targets/-Bestätigungen (Chat 2026-07-31: Philip klickte einen 1H-OB als
-- Target, es zeichnete sich weder Linie noch Box im Chart, nur das Label — "WENN es leichter ist
-- die ganze OB zu zeichnen, dann tu das"). Bisher hielt trade_targets nur DIE NÄHERE Kante
-- (findClickedOBZone: nearEdge) fest, das reicht für eine Box nicht — braucht top UND bottom.
-- trade_confirmations hat range_low/range_high schon (für kind='fib'), trade_targets bekommt
-- dieselben zwei Spalten jetzt auch, wiederverwendet für kind='ob' (bottom/top der Zone).
alter table trade_targets
  add column range_low numeric,
  add column range_high numeric;

-- Backfill für den einen schon bestehenden OB-Target (id 20, dealing_range 18) — Zone in ob_zones
-- eindeutig über bottom+instrument+timeframe gefunden (id 2383101: top 1.33691, bottom 1.33647,
-- start_time exakt gleich dem gespeicherten source_time).
update trade_targets
set range_low = 1.33647, range_high = 1.33691
where id = 20;
