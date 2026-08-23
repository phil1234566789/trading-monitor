-- Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren" (PLAN-chart-objekte-forex.md),
-- Punkt 6 (Nebeneffekt aus Abschnitt 5) — pin_context.kind='m5_ob' nutzt jetzt dieselbe ob_zone_id-
-- FK wie 1H/4H-OB-Pins (kind='ob_zone'), statt eigener m5_ob_*-Rohdaten-Snapshot-Spalten. M5-OBs
-- werden seit Punkt 2/3 (Migration 20260822100000, find-or-create in ob_zones) sowieso schon für
-- trade_setups/trade_confirmations persistiert — ein gepinnter M5-OB braucht also keine
-- Sonderbehandlung mehr, "eine kanonische ob_zones-Zeile pro OB über alle Timeframes" gilt jetzt
-- auch fürs Pin-Schema.

-- 1) Bestehende m5_ob-Snapshots als ob_zones-Zeile sichern (gleiches Muster wie 20260822100000:
--    1:1-Übernahme der Snapshot-Werte, kein Re-Detect, on conflict do nothing).
insert into ob_zones (instrument, timeframe, direction, top, bottom, start_time)
select distinct pc.m5_ob_instrument, '5M', pc.m5_ob_direction, pc.m5_ob_top, pc.m5_ob_bottom, pc.m5_ob_start_time
from pin_context pc
where pc.kind = 'm5_ob'
on conflict (instrument, timeframe, start_time, direction) do nothing;

-- 2) pin_context-Zeilen auf kind='ob_zone' + ob_zone_id umstellen, Snapshot-Spalten leeren (der
--    CHECK-Constraint unten verlangt das).
update pin_context pc
set kind = 'ob_zone',
    ob_zone_id = oz.id,
    m5_ob_instrument = null,
    m5_ob_direction = null,
    m5_ob_top = null,
    m5_ob_bottom = null,
    m5_ob_start_time = null
from ob_zones oz
where pc.kind = 'm5_ob'
  and oz.instrument = pc.m5_ob_instrument
  and oz.timeframe = '5M'
  and oz.direction = pc.m5_ob_direction
  and oz.start_time = pc.m5_ob_start_time
  and oz.top = pc.m5_ob_top
  and oz.bottom = pc.m5_ob_bottom;

-- 3) kind-Check-Constraint ohne die m5_ob-Variante neu aufbauen (Name bleibt laniakea_context_*,
--    siehe 20260817120000_rename_laniakea_context_to_pin_context.sql-Kommentar: Tabellen-Rename
--    benennt Constraints/Indizes in Postgres nicht automatisch mit um).
alter table pin_context drop constraint laniakea_context_kind_check;
alter table pin_context add constraint laniakea_context_kind_check check (
  (kind = 'trade_position' and trade_position_id is not null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_liquidity_instrument is null and rsi_divergence_instrument is null) or
  (kind = 'ob_zone' and ob_zone_id is not null and trade_position_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_liquidity_instrument is null and rsi_divergence_instrument is null) or
  (kind = 'trade_setup' and trade_setup_id is not null and trade_position_id is null and ob_zone_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_liquidity_instrument is null and rsi_divergence_instrument is null) or
  (kind = 'trade_confirmation' and trade_confirmation_id is not null and trade_position_id is null and ob_zone_id is null and trade_setup_id is null and liquidity_level_id is null and m5_liquidity_instrument is null and rsi_divergence_instrument is null) or
  (kind = 'liquidity_level' and liquidity_level_id is not null and trade_position_id is null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and m5_liquidity_instrument is null and rsi_divergence_instrument is null) or
  (kind = 'm5_liquidity_level' and m5_liquidity_instrument is not null and m5_liquidity_timeframe is not null and m5_liquidity_direction is not null and m5_liquidity_price is not null and m5_liquidity_pivot_time is not null and
    trade_position_id is null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and rsi_divergence_instrument is null) or
  (kind = 'rsi_divergence' and rsi_divergence_instrument is not null and rsi_divergence_type is not null and rsi_divergence_from_time is not null and rsi_divergence_to_time is not null and rsi_divergence_from_price is not null and rsi_divergence_to_price is not null and rsi_divergence_from_rsi is not null and rsi_divergence_to_rsi is not null and
    trade_position_id is null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_liquidity_instrument is null)
);

-- 4) Alte m5_ob-Spalten/Index weg — ob_zone_id deckt jetzt auch M5 ab (unique index auf ob_zone_id
--    existiert schon seit 20260801130000_laniakea_context_ob_zones.sql, gilt unverändert für alle
--    Timeframes).
drop index laniakea_context_m5_ob_key;

alter table pin_context
  drop column m5_ob_instrument,
  drop column m5_ob_direction,
  drop column m5_ob_top,
  drop column m5_ob_bottom,
  drop column m5_ob_start_time;
