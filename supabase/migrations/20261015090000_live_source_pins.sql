-- Live-Pins gehören dem Originalereignis, nicht einem künstlichen Simulationslauf.
alter table public.pin_context add column live_event_id text references public.setup2_alarm_events(id);

do $$
declare old_rule text;
begin
 select pg_get_expr(conbin,conrelid) into strict old_rule from pg_constraint
  where conrelid='public.pin_context'::regclass and conname='laniakea_context_kind_check';
 alter table public.pin_context drop constraint laniakea_context_kind_check;
 execute format($check$
  alter table public.pin_context add constraint laniakea_context_kind_check check (
   ((%s) and live_event_id is null)
   or (kind in ('simulation_dr','simulation_checkpoint','simulation_entry')
    and simulation_run_id is null and live_event_id is not null
    and simulation_pin_key is not null and length(btrim(simulation_pin_key))>0
    and simulation_context is not null and jsonb_typeof(simulation_context)='object'
    and coalesce(simulation_context->>'contextVersion','')='simulation-pin-context-v3'
    and coalesce(simulation_context->'source'->>'kind','')='live-watcher'
    and simulation_context->'source'->>'eventId'=live_event_id
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

create function public.validate_live_pin_source() returns trigger language plpgsql set search_path=public as $$
declare event public.setup2_alarm_events%rowtype; expected_snapshot text;
begin
 if new.live_event_id is null then return new; end if;
 select * into event from public.setup2_alarm_events where id=new.live_event_id;
 if not found or event.kind<>'trading' or event.stage not in (1,2,3) or length(coalesce(event.setup_key,''))=0
  or length(coalesce(event.instrument,''))=0 or coalesce(event.direction,'') not in ('long','short') then
  raise exception 'Live pin requires an original trading event';
 end if;
 if new.simulation_run_id is not null
  or new.simulation_context->'runId' is distinct from 'null'::jsonb
  or new.simulation_context->>'kind' is distinct from new.kind
  or new.simulation_context->>'instrument' is distinct from event.instrument
  or new.simulation_context->>'direction' is distinct from event.direction
  or new.simulation_context->>'setupKey' is distinct from event.setup_key
  or new.simulation_context->'source'->>'eventId' is distinct from event.id
  or new.simulation_context->'source'->>'viewId' is distinct from
    'live-watcher:'||to_char(event.signal_at at time zone 'Europe/Berlin','YYYY-MM') then
  raise exception 'Live pin identity does not match its original event';
 end if;
 expected_snapshot:=case when event.stage=3 then event.payload->'entry'->>'id' else event.id end;
 if length(coalesce(expected_snapshot,''))=0 or new.simulation_context->>'snapshotId' is distinct from expected_snapshot then
  raise exception 'Live pin snapshot is missing or does not match its original event';
 end if;
 if new.kind='simulation_entry' then
  if event.stage<>3 or new.simulation_entry_snapshot_id is distinct from expected_snapshot
   or new.simulation_context->'entry'->>'id' is distinct from expected_snapshot
   or new.simulation_context->'entry'->>'entryId' is distinct from expected_snapshot
   or new.simulation_context->'entry'->'time'->'unix' is distinct from event.payload->'entry'->'recognizedAt'
   or new.simulation_context->'entry'->'price' is distinct from event.payload->'entry'->'price' then
   raise exception 'Live entry pin requires the exact original entry';
  end if;
 elsif new.kind in ('simulation_dr','simulation_checkpoint') then
  if new.simulation_snapshot_id is distinct from expected_snapshot then
   raise exception 'Live DR pin requires the original snapshot identity';
  end if;
  if new.kind='simulation_checkpoint' and (length(coalesce(new.simulation_checkpoint_key,''))=0
   or new.simulation_context->'checkpoint'->>'key' is distinct from new.simulation_checkpoint_key) then
   raise exception 'Live checkpoint pin requires a named original checkpoint';
  end if;
 else raise exception 'Unsupported live pin kind';
 end if;
 return new;
end $$;
create trigger pin_context_live_source before insert or update on public.pin_context
 for each row execute function public.validate_live_pin_source();
