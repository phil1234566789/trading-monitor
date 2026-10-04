-- Der Analysekontext bleibt unabhängig von späteren Laufständen eingefroren.
alter table public.pin_context
  add column simulation_run_id text references public.trade_setup_simulation_runs(id),
  add column simulation_snapshot_id text,
  add column simulation_entry_snapshot_id text,
  add column simulation_checkpoint_key text,
  add column simulation_variant text check (simulation_variant in ('wide','narrow','both')),
  add column simulation_pin_key text unique,
  add column simulation_context jsonb;

-- Bestehende Chart-Arten behalten exakt ihren bisherigen Referenz-Check.
do $$
declare chart_check text;
begin
  select pg_get_expr(conbin,conrelid) into strict chart_check from pg_constraint
    where conrelid='public.pin_context'::regclass and conname='laniakea_context_kind_check';
  alter table public.pin_context drop constraint laniakea_context_kind_check;
  execute format($check$
    alter table public.pin_context add constraint laniakea_context_kind_check check (
      ((%s) and simulation_run_id is null and simulation_snapshot_id is null
        and simulation_entry_snapshot_id is null and simulation_checkpoint_key is null
        and simulation_variant is null and simulation_pin_key is null and simulation_context is null)
      or (kind in ('simulation_dr','simulation_checkpoint','simulation_entry')
        and simulation_run_id is not null and simulation_pin_key is not null
        and simulation_context is not null and jsonb_typeof(simulation_context)='object'
        and trade_position_id is null and ob_zone_id is null and trade_setup_id is null
        and trade_confirmation_id is null and liquidity_level_id is null
        and m5_liquidity_instrument is null and rsi_divergence_instrument is null
        and ((kind='simulation_dr' and simulation_snapshot_id is not null
          and simulation_entry_snapshot_id is null and simulation_checkpoint_key is null and simulation_variant is null)
          or (kind='simulation_checkpoint' and simulation_snapshot_id is not null
            and simulation_entry_snapshot_id is null and simulation_checkpoint_key is not null and simulation_variant is null)
          or (kind='simulation_entry' and simulation_snapshot_id is null
            and simulation_entry_snapshot_id is not null and simulation_checkpoint_key is null and simulation_variant is not null)))
    )
  $check$,chart_check);
end $$;
create index pin_context_simulation_run on public.pin_context(simulation_run_id);
create index pin_context_simulation_features on public.pin_context using gin(simulation_context jsonb_path_ops);
