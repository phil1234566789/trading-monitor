-- Backfill: kind='pivot'-Bestätigungen/-Targets nachträglich mit ihrer liquidity_levels-Zeile
-- verknüpfen (Chat 2026-08-27, TSC-Neuaufbau: findOrCreateLiquidityLevelId lief bisher nie beim
-- Insert, siehe tradeIntake.js — jede bisherige Zeile blieb also unverlinkt). Matcht per
-- instrument+price+pivot_time gegen 1H/4H-Level, die poi-watcher unabhängig davon längst live
-- erkannt/persistiert hat (dieselben Zahlen, nur nie per FK verknüpft) — reiner Identitäts-Match,
-- kein Raten. limit 1 macht die Subquery bewusst zum Skalar, falls (theoretisch) mehr als eine
-- liquidity_levels-Zeile exakt denselben Preis/Zeitpunkt hätte. Kein Treffer -> Subquery liefert
-- NULL -> Spalte bleibt unverändert (war eh schon NULL), kein Sonderfall nötig.
--
-- 5M-Sweeps bleiben unverknüpft: poi-watcher erkennt/persistiert nie live auf M5 (siehe
-- 20260827120000_liquidity_levels_allow_5m.sql), für diese Zeilen existiert also keine passende
-- liquidity_levels-Zeile zum Nachträglich-Verlinken — nur künftig neu angelegte M5-Sweeps
-- bekommen ab jetzt direkt beim Insert eine. RAISE NOTICE pro Block, damit die tatsächliche
-- Trefferzahl im `db push`-Output sichtbar ist statt blind zu vertrauen.

-- Range-Ebene ("GO für die Idee").
do $$
declare
  affected int;
begin
  update trade_confirmations tc
  set liquidity_level_id = (
    select ll.id
    from liquidity_levels ll
    where ll.instrument = (select dr.instrument from dealing_ranges dr where dr.id = tc.dealing_range_id)
      and ll.price = tc.price
      and ll.pivot_time = tc.source_time
    order by ll.id
    limit 1
  )
  where tc.kind = 'pivot' and tc.liquidity_level_id is null and tc.dealing_range_id is not null
    and exists (
      select 1 from liquidity_levels ll
      where ll.instrument = (select dr.instrument from dealing_ranges dr where dr.id = tc.dealing_range_id)
        and ll.price = tc.price
        and ll.pivot_time = tc.source_time
    );
  get diagnostics affected = row_count;
  raise notice 'trade_confirmations (Range-Ebene) verlinkt: %', affected;
end $$;

-- Positions-Ebene ("GO für diesen Entry").
do $$
declare
  affected int;
begin
  update trade_confirmations tc
  set liquidity_level_id = (
    select ll.id
    from liquidity_levels ll
    where ll.instrument = (
        select dr.instrument
        from trade_positions tp
        join dealing_ranges dr on dr.id = tp.dealing_range_id
        where tp.id = tc.trade_position_id
      )
      and ll.price = tc.price
      and ll.pivot_time = tc.source_time
    order by ll.id
    limit 1
  )
  where tc.kind = 'pivot' and tc.liquidity_level_id is null and tc.trade_position_id is not null
    and exists (
      select 1 from liquidity_levels ll
      where ll.instrument = (
          select dr.instrument
          from trade_positions tp
          join dealing_ranges dr on dr.id = tp.dealing_range_id
          where tp.id = tc.trade_position_id
        )
        and ll.price = tc.price
        and ll.pivot_time = tc.source_time
    );
  get diagnostics affected = row_count;
  raise notice 'trade_confirmations (Positions-Ebene) verlinkt: %', affected;
end $$;

-- Targets (immer Range-Ebene).
do $$
declare
  affected int;
begin
  update trade_targets tt
  set liquidity_level_id = (
    select ll.id
    from liquidity_levels ll
    where ll.instrument = (select dr.instrument from dealing_ranges dr where dr.id = tt.dealing_range_id)
      and ll.price = tt.price
      and ll.pivot_time = tt.source_time
    order by ll.id
    limit 1
  )
  where tt.kind = 'pivot' and tt.liquidity_level_id is null
    and exists (
      select 1 from liquidity_levels ll
      where ll.instrument = (select dr.instrument from dealing_ranges dr where dr.id = tt.dealing_range_id)
        and ll.price = tt.price
        and ll.pivot_time = tt.source_time
    );
  get diagnostics affected = row_count;
  raise notice 'trade_targets verlinkt: %', affected;
end $$;
