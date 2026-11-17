-- Kraftquelle-Zone (H1/H4) je Trade für die goldene Markierung beim Sprung aus /dob-statistik: Kanten und Start der Zone.
-- Rein additiv, nur v1/v2 befüllt; ohne Werte zeichnet der Chart nichts.
alter table public.dob_trade_setups add column source_zone_top double precision, add column source_zone_bottom double precision,
  add column source_zone_start bigint;
