-- Pin-Schlüssel laufunabhängig: derselbe Trade (Instrument, Richtung, Entry-Zeit, Entry, SL) trägt seinen Pin in jedem Lauf (v1, v2 …).
-- Additiv: der bisherige Zweig (Schlüssel = Zeilen-ID mit Lauf) bleibt gültig, damit ein noch offener alter Frontend-Stand weiter speichern kann.
do $$
declare old_rule text;
begin
 select pg_get_expr(conbin,conrelid) into strict old_rule from pg_constraint
  where conrelid='public.pin_context'::regclass and conname='laniakea_context_kind_check';
 alter table public.pin_context drop constraint laniakea_context_kind_check;
 execute format($check$
  alter table public.pin_context add constraint laniakea_context_kind_check check (
   (%s)
   or (kind='dob_trade' and dob_trade_key is not null and jsonb_typeof(dob_trade_context)='object'
    and dob_trade_context->>'trade_key'=dob_trade_key and octet_length(dob_trade_context::text)<=16384
    and dob_pin_key is null and dob_context is null and trade_setup_source_snapshot_id is null
    and trade_position_id is null and ob_zone_id is null and trade_setup_id is null
    and trade_confirmation_id is null and liquidity_level_id is null
    and m5_liquidity_instrument is null and rsi_divergence_instrument is null
    and simulation_run_id is null and simulation_snapshot_id is null and simulation_entry_snapshot_id is null
    and simulation_checkpoint_key is null and simulation_variant is null and simulation_pin_key is null
    and simulation_context is null and live_event_id is null and live_snapshot_id is null)
  )
 $check$,old_rule);
end $$;
