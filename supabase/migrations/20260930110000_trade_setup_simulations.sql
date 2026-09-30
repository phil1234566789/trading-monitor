-- Forschungsdaten bleiben unabhängig von Journal und TSC. Öffentliche App-Schreiber
-- dürfen nur begrenzte, versionierte Batches über diese Funktionen ergänzen.
create table public.trade_setup_simulation_runs (
  id text primary key check (length(id) between 1 and 512),
  run jsonb not null,
  check (run->>'id' = id),
  check (run->>'status' in ('running','complete','failed')),
  check (jsonb_typeof(run->'configuration') = 'object'),
  check (length(run->>'version') > 0),
  check ((run->>'from')::bigint < (run->>'to')::bigint),
  check (pg_column_size(run) <= 1000000)
);
create table public.trade_setup_simulation_setups (
  run_id text not null references public.trade_setup_simulation_runs(id),
  id text not null check (length(id) between 1 and 1024),
  instrument text not null check (instrument in ('GBPUSD','EURUSD','XAUUSD')),
  direction text not null check (direction in ('long','short')),
  known_at bigint not null,
  snapshot jsonb not null check (pg_column_size(snapshot) <= 1000000),
  primary key (run_id,id)
);
create table public.trade_setup_simulation_entries (
  run_id text not null references public.trade_setup_simulation_runs(id),
  id text not null check (length(id) between 1 and 1024),
  instrument text not null check (instrument in ('GBPUSD','EURUSD','XAUUSD')),
  direction text not null check (direction in ('long','short')),
  entry_time bigint not null,
  evaluated_at bigint not null check (evaluated_at >= entry_time),
  snapshot jsonb not null check (pg_column_size(snapshot) <= 1000000),
  outcomes jsonb not null check (jsonb_typeof(outcomes) = 'array' and jsonb_array_length(outcomes) = 2 and pg_column_size(outcomes) <= 100000),
  primary key (run_id,id)
);
create index trade_setup_simulation_entries_time on public.trade_setup_simulation_entries(run_id,instrument,entry_time);
alter table public.trade_setup_simulation_runs enable row level security;
alter table public.trade_setup_simulation_setups enable row level security;
alter table public.trade_setup_simulation_entries enable row level security;
create policy simulation_runs_read on public.trade_setup_simulation_runs for select to anon,authenticated using (true);
create policy simulation_setups_read on public.trade_setup_simulation_setups for select to anon,authenticated using (true);
create policy simulation_entries_read on public.trade_setup_simulation_entries for select to anon,authenticated using (true);
grant select on public.trade_setup_simulation_runs, public.trade_setup_simulation_setups, public.trade_setup_simulation_entries to anon,authenticated;

create function public.save_trade_setup_simulation_run(run jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if run->>'id' is null or run->>'version' is null or run->>'evaluatedAt' is null
    or run->>'from' is null or run->>'to' is null or run->>'status' is null
    or jsonb_typeof(run->'configuration') is distinct from 'object' then
    raise exception 'Missing run identity or evaluation time';
  end if;
  insert into public.trade_setup_simulation_runs as existing(id,run) values (run->>'id',run)
  on conflict(id) do update set run = excluded.run
    where (excluded.run->>'evaluatedAt')::bigint >= (existing.run->>'evaluatedAt')::bigint
      and excluded.run->'configuration' = existing.run->'configuration'
      and excluded.run->>'version' = existing.run->>'version'
      and excluded.run->>'from' = existing.run->>'from'
      and excluded.run->>'to' = existing.run->>'to'
      and not (existing.run->>'status' = 'complete' and excluded.run->>'status' = 'running');
end;
$$;

create function public.save_trade_setup_simulation_setups(run_id text, records jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare item jsonb;
begin
  if jsonb_typeof(records) is distinct from 'array' or jsonb_array_length(records) > 100 then
    raise exception 'Expected at most 100 setup snapshots';
  end if;
  for item in select value from jsonb_array_elements(records) loop
    insert into public.trade_setup_simulation_setups(run_id,id,instrument,direction,known_at,snapshot)
    values (run_id,item->>'id',item->>'instrument',item->>'direction',(item->>'knownAt')::bigint,item)
    on conflict do nothing;
  end loop;
end;
$$;

create function public.save_trade_setup_simulation_entries(run_id text, records jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare item jsonb; snap jsonb; results jsonb; outcome jsonb; previous jsonb; evaluated bigint;
begin
  if jsonb_typeof(records) is distinct from 'array' or jsonb_array_length(records) > 100 then
    raise exception 'Expected at most 100 entries';
  end if;
  for item in select value from jsonb_array_elements(records) loop
    snap := item->'snapshot'; results := item->'outcomes';
    if jsonb_typeof(results) is distinct from 'array' or jsonb_array_length(results) <> 2
      or not results @> '[{"variant":"wide"},{"variant":"narrow"}]'::jsonb then
      raise exception 'Both alternative stop variants are required';
    end if;
    evaluated := null;
    for outcome in select value from jsonb_array_elements(results) loop
      if outcome->>'entryId' is distinct from snap->>'id'
        or outcome->>'entryTime' is distinct from snap->'entry'->>'recognizedAt'
        or outcome->>'status' is null or outcome->>'status' not in ('closed','open','ambiguous','notExecutable')
        or outcome->>'evaluatedAt' is null then raise exception 'Invalid simulation outcome'; end if;
      if evaluated is not null and evaluated <> (outcome->>'evaluatedAt')::bigint then
        raise exception 'Both variants need the same evaluation horizon';
      end if;
      evaluated := (outcome->>'evaluatedAt')::bigint;
    end loop;
    select e.snapshot into previous from public.trade_setup_simulation_entries e
      where e.run_id = save_trade_setup_simulation_entries.run_id and e.id = snap->>'id';
    if found and previous <> snap then raise exception 'Entry snapshot is immutable'; end if;
    insert into public.trade_setup_simulation_entries as existing(run_id,id,instrument,direction,entry_time,evaluated_at,snapshot,outcomes)
    values (run_id,snap->>'id',snap->>'instrument',snap->>'direction',(snap->'entry'->>'recognizedAt')::bigint,evaluated,snap,results)
    on conflict on constraint trade_setup_simulation_entries_pkey do update set
      outcomes = excluded.outcomes, evaluated_at = excluded.evaluated_at
    where excluded.evaluated_at >= existing.evaluated_at and excluded.snapshot = existing.snapshot
      and not exists (select 1 from jsonb_array_elements(existing.outcomes) old_result
        join jsonb_array_elements(excluded.outcomes) new_result on old_result->>'variant' = new_result->>'variant'
        where old_result->>'status' = 'closed' and new_result->>'status' <> 'closed');
  end loop;
end;
$$;
revoke all on function public.save_trade_setup_simulation_run(jsonb) from public;
revoke all on function public.save_trade_setup_simulation_setups(text,jsonb) from public;
revoke all on function public.save_trade_setup_simulation_entries(text,jsonb) from public;
grant execute on function public.save_trade_setup_simulation_run(jsonb) to anon,authenticated;
grant execute on function public.save_trade_setup_simulation_setups(text,jsonb) to anon,authenticated;
grant execute on function public.save_trade_setup_simulation_entries(text,jsonb) to anon,authenticated;
notify pgrst, 'reload schema';
