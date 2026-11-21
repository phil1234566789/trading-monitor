-- Generische Pin-Art für Chartobjekte ohne eigene Tabelle (src/chartObjectRegistry.js): neue Objektarten (zuerst
-- Liquidität 2.0) brauchen danach keine Migration mehr. Rein additiv: bestehende Zeilen und FK-Arten bleiben unverändert.
alter table public.pin_context
 add column chart_object_type text,
 add column chart_object_key text,
 add column chart_object_instrument text,
 add column chart_object_timeframe text,
 add column chart_object_snapshot jsonb;

-- Konfliktziel von addPinChartObject (ein Pin je Objekt). Gelesen wird über den bestehenden Pin-Fetch, kein neuer Filter.
create unique index pin_context_chart_object_key on public.pin_context (chart_object_type, chart_object_key);

do $$
declare old_rule text;
begin
 select pg_get_expr(conbin,conrelid) into strict old_rule from pg_constraint
  where conrelid='public.pin_context'::regclass and conname='laniakea_context_kind_check';
 alter table public.pin_context drop constraint laniakea_context_kind_check;
 execute format($check$
  alter table public.pin_context add constraint laniakea_context_kind_check check (
   ((%s) and chart_object_type is null and chart_object_key is null and chart_object_instrument is null
    and chart_object_timeframe is null and chart_object_snapshot is null)
   or (kind='chart_object' and chart_object_type ~ '^[a-z0-9_]+$' and length(chart_object_key)>0
    and chart_object_instrument is not null and chart_object_timeframe is not null
    and jsonb_typeof(chart_object_snapshot)='object' and octet_length(chart_object_snapshot::text)<=16384
    and dob_pin_key is null and dob_context is null and dob_trade_key is null and dob_trade_context is null
    and trade_setup_source_snapshot_id is null
    and trade_position_id is null and ob_zone_id is null and trade_setup_id is null
    and trade_confirmation_id is null and liquidity_level_id is null
    and m5_liquidity_instrument is null and rsi_divergence_instrument is null
    and simulation_run_id is null and simulation_snapshot_id is null and simulation_entry_snapshot_id is null
    and simulation_checkpoint_key is null and simulation_variant is null and simulation_pin_key is null
    and simulation_context is null and live_event_id is null and live_snapshot_id is null)
  )
 $check$,old_rule);
end $$;
