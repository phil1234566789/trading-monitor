create table public.setup2_live_payloads (
 id text primary key check(id ~ '^[a-f0-9]{64}$'), payload jsonb not null
);
alter table public.setup2_live_payloads enable row level security;
revoke all on public.setup2_live_payloads from anon,authenticated,service_role;
grant select on public.setup2_live_payloads to anon,authenticated,service_role;
create policy setup2_payload_read on public.setup2_live_payloads for select to anon,authenticated using(true);
create table public.setup2_live_configurations (
 id text primary key check(id ~ '^[a-f0-9]{64}$'), configuration jsonb not null check(jsonb_typeof(configuration)='object'),
 captured_at timestamptz not null default clock_timestamp()
);
create table public.setup2_live_snapshots (
 id text primary key check(id ~ '^[a-f0-9]{64}$'), snapshot_id text not null,
 instrument text not null check(instrument in ('GBPUSD','EURUSD','XAUUSD')), setup_key text not null,
 known_at timestamptz not null, evaluated_through timestamptz not null check(evaluated_through>=known_at),
 captured_at timestamptz not null default clock_timestamp(),
 configuration_id text not null references public.setup2_live_configurations(id),
 evaluation_mode text not null check(evaluation_mode in ('live','catchup')),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'), observation jsonb not null check(jsonb_typeof(observation)='object'),
 check(coalesce(snapshot->>'id'=snapshot_id and snapshot->>'instrument'=instrument and snapshot->>'setupKey'=setup_key,false)),
 check(setup_key like instrument||':setup1:%'),
 check(snapshot ?& array['id','instrument','setupKey','knownAt','direction','checklist']),
 check(jsonb_typeof(snapshot->'knownAt')='number' and snapshot->'knownAt'<>'null'::jsonb),
 check(coalesce(jsonb_typeof(snapshot->'checklist')='object' and jsonb_typeof(snapshot->'checklist'->'checks')='object'
  and not(snapshot->'checklist' ?| array['$liveEvidenceRef','$liveEvidenceChunks']
   or snapshot->'checklist'->'checks' ?| array['$liveEvidenceRef','$liveEvidenceChunks']),false)),
 check(coalesce(snapshot->>'direction','') in ('long','short')),
 check(to_timestamp((snapshot->>'knownAt')::double precision)=known_at)
);
create index setup2_live_snapshots_capture on public.setup2_live_snapshots(captured_at,id);
create index setup2_live_snapshots_time on public.setup2_live_snapshots(known_at,id);
create index setup2_live_snapshots_range on public.setup2_live_snapshots(setup_key,evaluated_through,id);
create index setup2_live_snapshots_source on public.setup2_live_snapshots(snapshot_id,evaluated_through);
alter table public.setup2_live_configurations enable row level security;
alter table public.setup2_live_snapshots enable row level security;
revoke all on public.setup2_live_configurations,public.setup2_live_snapshots from anon,authenticated,service_role;
grant select on public.setup2_live_configurations,public.setup2_live_snapshots to anon,authenticated,service_role;
create policy setup2_configuration_read on public.setup2_live_configurations for select to anon,authenticated using(true);
create policy setup2_snapshot_read on public.setup2_live_snapshots for select to anon,authenticated using(true);

create function public.setup2_validate_evidence_value(value jsonb, ancestors text[] default '{}',new_ids text[] default null)
returns void language plpgsql set search_path=public as $$
declare child jsonb; ref text; part jsonb;
begin
 if jsonb_typeof(value)='object' and (value ? '$liveEvidenceRef' or value ? '$liveEvidenceChunks') then
  if (select count(*) from jsonb_object_keys(value))<>1 then raise exception 'Invalid live evidence reference';end if;
  if value ? '$liveEvidenceChunks' and jsonb_typeof(value->'$liveEvidenceChunks') is distinct from 'array' then
   raise exception 'Invalid live evidence chunks';
  end if;
  for child in select x from jsonb_array_elements(case when value ? '$liveEvidenceRef'
    then jsonb_build_array(value->'$liveEvidenceRef') else value->'$liveEvidenceChunks' end) x loop
   ref:=child#>>'{}';
   if jsonb_typeof(child) is distinct from 'string' or ref !~ '^[a-f0-9]{64}$' or ref=any(ancestors) then
    raise exception 'Invalid or cyclic live evidence reference';
   end if;
   select payload into part from setup2_live_payloads where id=ref;
   if not found then raise exception 'Missing live evidence payload';end if;
   if value ? '$liveEvidenceChunks' and jsonb_typeof(part) is distinct from 'array' then raise exception 'Invalid live evidence chunk payload';end if;
   if new_ids is null or ref=any(new_ids) then perform setup2_validate_evidence_value(part,ancestors||ref,new_ids);end if;
  end loop;
 elsif jsonb_typeof(value)='object' then
  for child in select v from jsonb_each(value) e(k,v) loop perform setup2_validate_evidence_value(child,ancestors,new_ids);end loop;
 elsif jsonb_typeof(value)='array' then
  for child in select v from jsonb_array_elements(value) e(v) loop perform setup2_validate_evidence_value(child,ancestors,new_ids);end loop;
 end if;
end $$;
revoke all on function public.setup2_validate_evidence_value(jsonb,text[],text[]) from public,anon,authenticated;
grant execute on function public.setup2_validate_evidence_value(jsonb,text[],text[]) to service_role;

create function public.setup2_checkpoint_with_evidence(p_instrument text,p_owner text,p_state jsonb,p_events jsonb,p_evidence jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare batch jsonb; item jsonb; config jsonb; config_id text; prior public.setup2_live_snapshots%rowtype; new_ids text[]; inserted_id text;
begin
 if jsonb_typeof(p_evidence) is distinct from 'array' or jsonb_array_length(p_evidence)=0 then
  raise exception 'Live evidence requires nonempty batches';
 end if;
 -- Dieselbe Transaktion: weder Marktfortschritt ohne Beleg noch Beleg ohne gültige Lease.
 perform public.setup2_checkpoint(p_instrument,p_owner,p_state,p_events);
 for batch in select value from jsonb_array_elements(p_evidence) loop
  if jsonb_typeof(batch->'snapshots') is distinct from 'array' or jsonb_array_length(batch->'snapshots')=0 then
   raise exception 'Live evidence requires nonempty snapshots';
  end if;
  config:=batch->'configuration'->'configuration'; config_id:=batch->'configuration'->>'id';
  if jsonb_typeof(config) is distinct from 'object' or config->>'instrument' is distinct from p_instrument then
   raise exception 'Live configuration instrument mismatch';
  end if;
  insert into setup2_live_configurations(id,configuration) values(config_id,config) on conflict(id) do nothing;
  if (select configuration from setup2_live_configurations where id=config_id) is distinct from config then
   raise exception 'Live configuration identity conflict';
  end if;
  new_ids:='{}';
  for item in select value from jsonb_array_elements(coalesce(batch->'payloads','[]'::jsonb)) loop
   inserted_id:=null;
   insert into setup2_live_payloads(id,payload) values(item->>'id',item->'payload') on conflict(id) do nothing returning id into inserted_id;
   if inserted_id is not null then new_ids:=array_append(new_ids,inserted_id);end if;
   if (select payload from setup2_live_payloads where id=item->>'id') is distinct from item->'payload' then
    raise exception 'Live payload identity conflict';
   end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(batch->'payloads','[]'::jsonb)) loop
   if item->>'id'=any(new_ids) then
    perform setup2_validate_evidence_value(item->'payload',array[item->>'id'],new_ids);
    new_ids:=array_remove(new_ids,item->>'id');
   end if;
  end loop;
  for item in select value from jsonb_array_elements(batch->'snapshots') loop
   perform setup2_validate_evidence_value(item->'snapshot','{}','{}');
   perform setup2_validate_evidence_value(item->'observation','{}','{}');
   if item->>'instrument' is distinct from p_instrument or (item ? 'configuration_id' and item->>'configuration_id' is distinct from config_id) then
    raise exception 'Live evidence identity mismatch';
   end if;
   insert into setup2_live_snapshots(id,snapshot_id,instrument,setup_key,known_at,evaluated_through,configuration_id,evaluation_mode,snapshot,observation)
   values(item->>'id',item->>'snapshot_id',p_instrument,item->>'setup_key',(item->>'known_at')::timestamptz,
    (item->>'evaluated_through')::timestamptz,config_id,item->>'evaluation_mode',item->'snapshot',item->'observation')
   on conflict(id) do nothing;
   select * into strict prior from setup2_live_snapshots where id=item->>'id';
   if prior.snapshot is distinct from item->'snapshot' or prior.observation is distinct from item->'observation'
    or prior.snapshot_id is distinct from item->>'snapshot_id' or prior.configuration_id is distinct from config_id
    or prior.evaluation_mode is distinct from item->>'evaluation_mode'
    or prior.known_at is distinct from (item->>'known_at')::timestamptz
    or prior.evaluated_through is distinct from (item->>'evaluated_through')::timestamptz then
    raise exception 'Live snapshot identity conflict';
   end if;
  end loop;
 end loop;
end $$;
revoke all on function public.setup2_checkpoint_with_evidence(text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.setup2_checkpoint_with_evidence(text,text,jsonb,jsonb,jsonb) to service_role;
