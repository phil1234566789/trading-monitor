alter table public.pin_context add column live_snapshot_id text references public.setup2_live_snapshots(id);
do $$
declare old_rule text;
begin
 select pg_get_expr(conbin,conrelid) into strict old_rule from pg_constraint
  where conrelid='public.pin_context'::regclass and conname='laniakea_context_kind_check';
 alter table public.pin_context drop constraint laniakea_context_kind_check;
 execute format($check$
  alter table public.pin_context add constraint laniakea_context_kind_check check (
   ((%s) and live_snapshot_id is null)
   or (kind in ('simulation_dr','simulation_checkpoint','simulation_entry')
    and simulation_run_id is null and live_event_id is null and live_snapshot_id is not null
    and simulation_pin_key is not null and length(btrim(simulation_pin_key))>0
    and jsonb_typeof(simulation_context)='object'
    and coalesce(simulation_context->>'contextVersion','')='simulation-pin-context-v4'
    and coalesce(simulation_context->'source'->>'kind','')='live-watcher'
    and simulation_context->'source'->>'recordId'=live_snapshot_id
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
 $check$,old_rule);
end $$;
create function public.validate_snapshot_pin_source() returns trigger language plpgsql set search_path=public as $$
declare record public.setup2_live_snapshots%rowtype; source jsonb; entry jsonb; expected_view text;
begin
 if new.live_snapshot_id is null then return new; end if;
 select * into strict record from public.setup2_live_snapshots where id=new.live_snapshot_id;
 source:=new.simulation_context->'source';entry:=record.snapshot->'entry';
 expected_view:='live-watcher:'||to_char(record.known_at at time zone 'Europe/Berlin','YYYY-MM');
 if new.simulation_run_id is not null or new.live_event_id is not null
  or new.simulation_context->'runId' is distinct from 'null'::jsonb
  or new.simulation_context->>'kind' is distinct from new.kind
  or new.simulation_context->>'instrument' is distinct from record.instrument
  or new.simulation_context->>'direction' is distinct from record.snapshot->>'direction'
  or new.simulation_context->>'setupKey' is distinct from record.setup_key
  or new.simulation_context->>'snapshotId' is distinct from record.snapshot_id
  or new.simulation_context->'snapshotAt'->'unix' is distinct from record.snapshot->'knownAt'
  or source->>'recordId' is distinct from record.id or source ? 'eventId'
  or source->>'configurationId' is distinct from record.configuration_id
  or source->>'evaluationMode' is distinct from record.evaluation_mode
  or (source->>'capturedAt')::timestamptz is distinct from record.captured_at
  or (source->>'evaluatedThrough')::timestamptz is distinct from record.evaluated_through
  or (source->>'viewId' is distinct from expected_view and
    (record.evaluation_mode<>'catchup' or source->>'viewId' is distinct from expected_view||':catchup')) then
  raise exception 'Live pin identity does not match its original snapshot';
 end if;
 if new.kind='simulation_entry' then
  if jsonb_typeof(entry) is distinct from 'object' or new.simulation_entry_snapshot_id is distinct from record.snapshot_id
   or new.simulation_context->'entry'->>'id' is distinct from entry->>'id'
   or new.simulation_context->'entry'->>'entryId' is distinct from entry->>'id'
   or new.simulation_context->'entry'->'time'->'unix' is distinct from entry->'recognizedAt'
   or new.simulation_context->'entry'->'price' is distinct from entry->'price'
   or new.simulation_context->'entry'->'stops' is distinct from entry->'stops' then
   raise exception 'Live entry pin requires its exact original snapshot entry';
  end if;
 elsif new.kind in ('simulation_dr','simulation_checkpoint') then
  if new.simulation_snapshot_id is distinct from record.snapshot_id then raise exception 'Live DR snapshot identity mismatch';end if;
  if new.kind='simulation_checkpoint' and (length(coalesce(new.simulation_checkpoint_key,''))=0
   or new.simulation_context->'checkpoint'->>'key' is distinct from new.simulation_checkpoint_key) then
   raise exception 'Live checkpoint requires its named snapshot checkpoint';
  end if;
 else raise exception 'Unsupported live snapshot pin kind';
 end if;
 return new;
end $$;
create trigger pin_context_snapshot_source before insert or update on public.pin_context
 for each row execute function public.validate_snapshot_pin_source();
