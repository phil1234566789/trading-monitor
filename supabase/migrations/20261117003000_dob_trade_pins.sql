-- Pins auf einzelne Trades der DOB-Statistik (/dob-statistik). Kein FK auf dob_trade_setups: das Befüllskript tauscht die Zeilen
-- je Lauf komplett aus, ein Cascade würde Philips Kommentare löschen. Der Schlüssel (Lauf + Setup-ID) bleibt über Neuberechnungen stabil,
-- der eingefrorene Kontext hält Entry/SL/TP/Ausgang vom Zeitpunkt des Pins fest.
alter table public.pin_context add column dob_trade_key text unique, add column dob_trade_context jsonb;

do $$
declare old_rule text;
begin
 select pg_get_expr(conbin,conrelid) into strict old_rule from pg_constraint
  where conrelid='public.pin_context'::regclass and conname='laniakea_context_kind_check';
 alter table public.pin_context drop constraint laniakea_context_kind_check;
 execute format($check$
  alter table public.pin_context add constraint laniakea_context_kind_check check (
   ((%s) and dob_trade_key is null and dob_trade_context is null)
   or (kind='dob_trade' and dob_trade_key is not null and jsonb_typeof(dob_trade_context)='object'
    and dob_trade_context->>'id'=dob_trade_key and dob_trade_context->>'run_id' is not null
    and octet_length(dob_trade_context::text)<=16384
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
