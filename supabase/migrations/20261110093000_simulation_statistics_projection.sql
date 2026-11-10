-- Abgeleitete Lesedaten bleiben getrennt von den unveränderlichen Forschungsbelegen.
create table public.simulation_statistics_sources (
 run_id text primary key references public.trade_setup_simulation_runs(id),
 revision bigint not null default 0,
 generation uuid,
 version integer,
 group_count integer
);
insert into public.simulation_statistics_sources(run_id) select id from public.trade_setup_simulation_runs;
create table public.simulation_statistics_ranges (
 run_id text not null references public.simulation_statistics_sources(run_id),
 generation uuid not null,
 key text not null,
 recognized_at double precision,
 summary jsonb not null check(jsonb_typeof(summary)='object'),
 results jsonb not null check(jsonb_typeof(results)='array'),
 orders jsonb not null check(jsonb_typeof(orders)='array'),
 detail jsonb not null check(jsonb_typeof(detail)='object'),
 primary key(run_id,generation,key)
);
alter table public.simulation_statistics_sources enable row level security;
alter table public.simulation_statistics_ranges enable row level security;
create policy statistics_sources_read on public.simulation_statistics_sources for select to anon,authenticated
 using(exists(select 1 from public.trade_setup_simulation_runs r where r.id=run_id));
create policy statistics_ranges_read on public.simulation_statistics_ranges for select to anon,authenticated
 using(exists(select 1 from public.simulation_statistics_sources s where s.run_id=simulation_statistics_ranges.run_id and s.generation=simulation_statistics_ranges.generation));
grant select on public.simulation_statistics_sources,public.simulation_statistics_ranges to anon,authenticated;

create function public.invalidate_simulation_statistics() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare target text;
begin
 if tg_op='UPDATE' and new is not distinct from old then return new; end if;
 if tg_table_name='trade_setup_simulation_runs' then target:=coalesce(new.id,old.id);
 else target:=coalesce(new.run_id,old.run_id); end if;
 insert into public.simulation_statistics_sources(run_id,revision) values(target,1)
 on conflict(run_id) do update set revision=simulation_statistics_sources.revision+1,generation=null,version=null,group_count=null;
 return coalesce(new,old);
end $$;
revoke all on function public.invalidate_simulation_statistics() from public;
create trigger simulation_statistics_run_changed after insert or update on public.trade_setup_simulation_runs
 for each row execute function public.invalidate_simulation_statistics();
create trigger simulation_statistics_setup_changed after insert or update or delete on public.trade_setup_simulation_setups
 for each row execute function public.invalidate_simulation_statistics();
create trigger simulation_statistics_entry_changed after insert or update or delete on public.trade_setup_simulation_entries
 for each row execute function public.invalidate_simulation_statistics();

create function public.stage_simulation_statistics(p_run text,p_generation uuid,p_revision bigint,p_records jsonb)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare item jsonb;
begin
 perform 1 from public.simulation_statistics_sources s join public.trade_setup_simulation_runs r on r.id=s.run_id
 where s.run_id=p_run and s.revision=p_revision and r.run->>'status'='complete' for update of s;
 if not found then raise exception 'Simulation source changed or is incomplete'; end if;
 if exists(select 1 from public.simulation_statistics_sources where run_id=p_run and generation=p_generation) then
  raise exception 'Published statistics generations are immutable'; end if;
 if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records)>25 or pg_column_size(p_records)>20000000 then
 raise exception 'Expected at most 25 bounded DR projections'; end if;
 for item in select value from jsonb_array_elements(p_records) loop
  if item->>'key' is null or item->'summary'->>'key' is distinct from item->>'key'
    or item->'summary'->'snapshot'->>'runId' is distinct from p_run
    or item->'detail'->>'key' is distinct from item->>'key'
    or jsonb_array_length(item->'results') is distinct from jsonb_array_length(item->'orders') then
    raise exception 'Invalid DR projection identity'; end if;
  insert into public.simulation_statistics_ranges values(p_run,p_generation,item->>'key',(item->>'recognizedAt')::double precision,
    item->'summary',item->'results',item->'orders',item->'detail')
  on conflict(run_id,generation,key) do update set recognized_at=excluded.recognized_at,summary=excluded.summary,
    results=excluded.results,orders=excluded.orders,detail=excluded.detail;
 end loop;
end $$;
create function public.publish_simulation_statistics(p_run text,p_generation uuid,p_revision bigint,p_count integer,p_version integer)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform 1 from public.simulation_statistics_sources s join public.trade_setup_simulation_runs r on r.id=s.run_id
 where s.run_id=p_run and s.revision=p_revision and r.run->>'status'='complete' for update of s;
 if not found then raise exception 'Simulation source changed or is incomplete'; end if;
 if p_version is distinct from 1 or p_count is null or p_count<0 or p_count<>(select count(*) from public.simulation_statistics_ranges where run_id=p_run and generation=p_generation) then
 raise exception 'Incomplete statistics projection'; end if;
 update public.simulation_statistics_sources set generation=p_generation,version=p_version,group_count=p_count where run_id=p_run;
 delete from public.simulation_statistics_ranges where run_id=p_run and generation<>p_generation;
end $$;
revoke all on function public.stage_simulation_statistics(text,uuid,bigint,jsonb) from public;
revoke all on function public.publish_simulation_statistics(text,uuid,bigint,integer,integer) from public;
grant execute on function public.stage_simulation_statistics(text,uuid,bigint,jsonb),public.publish_simulation_statistics(text,uuid,bigint,integer,integer) to anon,authenticated;
create view public.simulation_statistics_overview with(security_invoker=true) as
 select run_id,generation,key,recognized_at,summary,results,orders from public.simulation_statistics_ranges;
grant select on public.simulation_statistics_overview to anon,authenticated;
notify pgrst,'reload schema';
