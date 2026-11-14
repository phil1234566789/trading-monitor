-- Expliziter Append-Vertrag; alte Run-Schreibfunktionen und Originalsnapshots bleiben unver�ndert.
create table public.trade_setup_simulation_appends (
  id text primary key check(length(id) between 1 and 128),
  run_id text not null references public.trade_setup_simulation_runs(id),
  from_time bigint not null,
  to_time bigint not null check(to_time>from_time),
  manifest jsonb not null check(jsonb_typeof(manifest)='object' and pg_column_size(manifest)<=1000000),
  request_hash text not null,
  created_at timestamptz not null default now(),
  unique(run_id,from_time)
);
create table public.trade_setup_simulation_continuations (
  append_id text not null references public.trade_setup_simulation_appends(id),
  kind text not null check(kind in ('setups','entries')),
  snapshot_id text not null,
  patch jsonb not null check(jsonb_typeof(patch)='object' and pg_column_size(patch)<=1000000),
  primary key(append_id,kind,snapshot_id)
);
alter table public.trade_setup_simulation_appends enable row level security;
alter table public.trade_setup_simulation_continuations enable row level security;
create policy simulation_appends_read on public.trade_setup_simulation_appends for select to anon,authenticated using(true);
create policy simulation_continuations_read on public.trade_setup_simulation_continuations for select to anon,authenticated using(true);
grant select on public.trade_setup_simulation_appends,public.trade_setup_simulation_continuations to anon,authenticated;

create function public.append_trade_setup_simulation_run(
  run_id text, append_id text, expected_to bigint, next_to bigint,
  manifest jsonb, setups jsonb default '[]', entries jsonb default '[]', continuations jsonb default '[]'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare original jsonb; updated jsonb; prior public.trade_setup_simulation_appends%rowtype;
  request_hash text; item jsonb; snap jsonb; base jsonb; old_outcomes jsonb; kind text; at_time numeric; outcome jsonb;
begin
  if next_to<=expected_to or next_to>extract(epoch from now())::bigint
    or jsonb_typeof(manifest) is distinct from 'object'
    or manifest->>'version' is distinct from 'simulation-append-v1'
    or (manifest#>>'{window,from}')::bigint is distinct from expected_to
    or (manifest#>>'{window,to}')::bigint is distinct from next_to
    or coalesce(manifest->>'baseCheckpointHash','') !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(manifest->'inputHashes') is distinct from 'object'
    or jsonb_typeof(setups) is distinct from 'array'
    or jsonb_typeof(entries) is distinct from 'array'
    or jsonb_typeof(continuations) is distinct from 'array'
    or length(append_id) not between 1 and 128 then raise exception 'Invalid append request'; end if;
  if jsonb_array_length(setups)>100 or jsonb_array_length(entries)>100
    or jsonb_array_length(continuations)>1000 then raise exception 'Append batch exceeds atomic limit'; end if;
  if manifest->'inputHashes'='{}'::jsonb or exists(
    select 1 from jsonb_each_text(manifest->'inputHashes') h where coalesce(h.value,'') !~ '^[0-9a-f]{64}$'
  ) then raise exception 'Invalid append input hashes'; end if;
  request_hash:=encode(sha256(convert_to(jsonb_build_array(run_id,expected_to,next_to,manifest,setups,entries,continuations)::text,'UTF8')),'hex');
  select r.run into strict original from public.trade_setup_simulation_runs r
    where r.id=run_id for update;
  select * into prior from public.trade_setup_simulation_appends a where a.id=append_id;
  if found then
    if prior.run_id is distinct from run_id or prior.request_hash is distinct from request_hash then
      raise exception 'Append identity conflict';
    end if;
    return jsonb_build_object('id',append_id,'from',prior.from_time,'to',prior.to_time,'replayed',true);
  end if;
  if original->>'status'<>'complete' or (original->>'to')::bigint<>expected_to then
    raise exception 'Append horizon conflict';
  end if;
  if manifest->'configuration' is distinct from original->'configuration'
    or manifest->>'sourceHash' is distinct from original#>>'{provenance,sourceHash}'
    or manifest->>'setupVersion' is distinct from original->>'version'
    or manifest->>'baseRunHash' is distinct from encode(sha256(convert_to(original::text,'UTF8')),'hex')
    then raise exception 'Append base identity conflict'; end if;
  if (select count(*)<>count(distinct s->>'id') from jsonb_array_elements(setups) s)
    or (select count(*)<>count(distinct e#>>'{snapshot,id}') from jsonb_array_elements(entries) e)
    then raise exception 'Duplicate append records'; end if;
  for item in select value from jsonb_array_elements(setups) loop
    at_time:=(item->>'knownAt')::numeric;
    if at_time is null or at_time<expected_to or at_time>next_to
      or exists(select 1 from public.trade_setup_simulation_setups s where s.run_id=append_trade_setup_simulation_run.run_id and s.id=item->>'id')
      then raise exception 'Append attempts to replace an original setup'; end if;
  end loop;
  for item in select value from jsonb_array_elements(entries) loop
    at_time:=(item#>>'{snapshot,knownAt}')::numeric;
    if at_time is null or at_time<expected_to or at_time>next_to
      or exists(select 1 from public.trade_setup_simulation_entries e where e.run_id=append_trade_setup_simulation_run.run_id and e.id=item#>>'{snapshot,id}')
      then raise exception 'Append attempts to replace an original entry'; end if;
  end loop;
  if (select count(*)<>count(distinct (c->>'kind',c->>'snapshotId')) from jsonb_array_elements(continuations) c)
    then raise exception 'Duplicate continuation'; end if;
  for item in select value from jsonb_array_elements(continuations) loop
    kind:=item->>'kind'; snap:=item->'patch'; base:=null; old_outcomes:=null;
    if kind='setups' then
      select s.snapshot into base from public.trade_setup_simulation_setups s
        where s.run_id=append_trade_setup_simulation_run.run_id and s.id=item->>'snapshotId';
    elsif kind='entries' then
      select e.snapshot,e.outcomes into base,old_outcomes from public.trade_setup_simulation_entries e
        where e.run_id=append_trade_setup_simulation_run.run_id and e.id=item->>'snapshotId';
    end if;
    if base is null or jsonb_typeof(snap) is distinct from 'object'
      or exists(select 1 from jsonb_object_keys(snap) k where k not in ('rangeCourse','priceObservation','historyTail','outcomes'))
      or (snap ? 'outcomes' and kind<>'entries')
      then raise exception 'Invalid continuation record'; end if;
    -- Ein bereits abgeschlossener Ausgang bleibt unter demselben Snapshot unver�nderlich.
    if kind='entries' then
      old_outcomes:=coalesce((select c.patch->'outcomes'
        from public.trade_setup_simulation_continuations c
        join public.trade_setup_simulation_appends a on a.id=c.append_id
        where a.run_id=append_trade_setup_simulation_run.run_id and c.kind='entries'
          and c.snapshot_id=item->>'snapshotId' and c.patch ? 'outcomes'
        order by a.to_time desc limit 1),old_outcomes);
    end if;
    if snap ? 'outcomes' and (jsonb_typeof(snap->'outcomes') is distinct from 'array'
      or jsonb_array_length(snap->'outcomes')<>2
      or not snap->'outcomes' @> '[{"variant":"wide"},{"variant":"narrow"}]'::jsonb)
      then raise exception 'Invalid continuation outcomes'; end if;
    for outcome in select value from jsonb_array_elements(coalesce(snap->'outcomes','[]')) loop
      if outcome->>'entryId' is distinct from base->>'id'
        or outcome->>'entryTime' is distinct from base#>>'{entry,recognizedAt}'
        or outcome->>'status' is null or outcome->>'status' not in ('closed','open','ambiguous','notExecutable')
        or (outcome->>'evaluatedAt')::bigint is null or (outcome->>'evaluatedAt')::bigint>next_to
        or ((outcome->>'evaluatedAt')::bigint<expected_to and not old_outcomes @> jsonb_build_array(outcome))
        then raise exception 'Invalid continuation outcome identity or horizon'; end if;
    end loop;
    if snap ? 'outcomes' and exists (
      select 1 from jsonb_array_elements(old_outcomes) o
      where o->>'status' in ('closed','notExecutable')
        and not exists(select 1 from jsonb_array_elements(snap->'outcomes') n where n=o)
    ) then raise exception 'Completed outcome is immutable'; end if;
    if snap ? 'historyTail' and (jsonb_typeof(snap->'historyTail') is distinct from 'array'
      or exists(select 1 from jsonb_array_elements(snap->'historyTail') h
        where (h->>'knownAt')::numeric is null or (h->>'knownAt')::numeric<expected_to or (h->>'knownAt')::numeric>next_to))
      then raise exception 'Continuation history outside append'; end if;
    if snap ? 'rangeCourse' and ((snap#>>'{rangeCourse,lifecycle,evaluatedAt}')::numeric is null
      or (snap#>>'{rangeCourse,lifecycle,evaluatedAt}')::numeric<expected_to
      or (snap#>>'{rangeCourse,lifecycle,evaluatedAt}')::numeric>next_to
      or (snap->'rangeCourse')-'lifecycle' is distinct from (base->'rangeCourse')-'lifecycle'
      or snap#>>'{rangeCourse,setupKey}' is distinct from base->>'setupKey')
      then raise exception 'Invalid continuation lifecycle'; end if;
    if snap ? 'priceObservation' and ((snap#>>'{priceObservation,rawThrough}')::numeric is null
      or (snap#>>'{priceObservation,rawThrough}')::numeric<expected_to
      or (snap#>>'{priceObservation,rawThrough}')::numeric>next_to
      or exists(select 1 from unnest(array['version','validatedAt','validationPrice','direction','target1','target2','invalidation','setupKey']) k
        where snap#>array['priceObservation',k] is distinct from base#>array['priceObservation',k])
      or snap#>>'{priceObservation,setupKey}' is distinct from base->>'setupKey')
      then raise exception 'Invalid continuation price observation'; end if;
  end loop;
  insert into public.trade_setup_simulation_appends(id,run_id,from_time,to_time,manifest,request_hash)
    values(append_id,run_id,expected_to,next_to,manifest,request_hash);
  updated:=jsonb_set(original,'{to}',to_jsonb(next_to));
  updated:=jsonb_set(updated,'{provenance,appendHead}',jsonb_build_object('id',append_id,'from',expected_to,'to',next_to));
  updated:=jsonb_set(updated,'{coverage}',coalesce(updated->'coverage','{}') || jsonb_build_object(
    'appendWindows',coalesce(updated#>'{coverage,appendWindows}','[]') || jsonb_build_array(manifest->'window')));
  update public.trade_setup_simulation_runs r set run=updated where r.id=run_id;
  -- Bestehende Validierungen gelten weiter; die gesamte Ver�ffentlichung ist eine Transaktion.
  perform public.save_trade_setup_simulation_setups(run_id,setups);
  perform public.save_trade_setup_simulation_entries(run_id,entries);
  for item in select value from jsonb_array_elements(continuations) loop
    insert into public.trade_setup_simulation_continuations(append_id,kind,snapshot_id,patch)
      values(append_id,item->>'kind',item->>'snapshotId',item->'patch');
  end loop;
  return jsonb_build_object('id',append_id,'from',expected_to,'to',next_to,'replayed',false);
end;
$$;
revoke all on function public.append_trade_setup_simulation_run(text,text,bigint,bigint,jsonb,jsonb,jsonb,jsonb) from public;
grant execute on function public.append_trade_setup_simulation_run(text,text,bigint,bigint,jsonb,jsonb,jsonb,jsonb) to anon,authenticated;
create function public.simulation_append_base(run_id text) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',r.id,'to',r.run->'to','status',r.run->>'status',
   'runHash',encode(sha256(convert_to(r.run::text,'UTF8')),'hex'),'appendHead',r.run#>'{provenance,appendHead}')
 from public.trade_setup_simulation_runs r where r.id=run_id;
$$;
revoke all on function public.simulation_append_base(text) from public;
grant execute on function public.simulation_append_base(text) to anon,authenticated;
notify pgrst, 'reload schema';
;
