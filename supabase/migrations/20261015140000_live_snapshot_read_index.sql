create table public.setup2_live_snapshot_index (
 id text primary key references public.setup2_live_snapshots(id) on delete cascade,
 snapshot_id text not null,instrument text not null,setup_key text not null,
 known_at timestamptz not null,evaluated_through timestamptz not null,captured_at timestamptz not null,
 configuration_id text not null,evaluation_mode text not null,direction text not null,
 entry_id text,dr_status text,dr_version text,has_observation boolean not null,has_history boolean not null
);
create index setup2_live_snapshot_index_capture on public.setup2_live_snapshot_index(captured_at,id);
create index setup2_live_snapshot_index_range on public.setup2_live_snapshot_index(setup_key,known_at,id);
create index setup2_live_snapshot_index_time on public.setup2_live_snapshot_index(known_at,id);
alter table public.setup2_live_snapshot_index enable row level security;
revoke all on public.setup2_live_snapshot_index from anon,authenticated,service_role;
grant select on public.setup2_live_snapshot_index to anon,authenticated,service_role;
create policy setup2_live_snapshot_index_read on public.setup2_live_snapshot_index for select to anon,authenticated using(true);

-- Die kleine Auswahlhilfe kopiert Fakten; Versionsbewertung und Originalbelege bleiben bei ihren bisherigen Lesern.
create function public.setup2_index_live_snapshot(source public.setup2_live_snapshots)
returns boolean language plpgsql set search_path=public as $$
begin
 insert into setup2_live_snapshot_index(id,snapshot_id,instrument,setup_key,known_at,evaluated_through,captured_at,
  configuration_id,evaluation_mode,direction,entry_id,dr_status,dr_version,has_observation,has_history)
 values(source.id,source.snapshot_id,source.instrument,source.setup_key,source.known_at,source.evaluated_through,source.captured_at,
  source.configuration_id,source.evaluation_mode,source.snapshot->>'direction',source.snapshot#>>'{entry,id}',
  source.snapshot#>>'{dealingRange,status}',source.snapshot#>>'{dealingRange,version}',
  exists(select 1 from jsonb_each(source.observation) e(k,v) where v<>'null'::jsonb),
  source.observation?'checklistHistory' and source.observation->'checklistHistory'<>'null'::jsonb)
 on conflict(id) do nothing;
 return found;
end $$;
revoke all on function public.setup2_index_live_snapshot(public.setup2_live_snapshots) from public,anon,authenticated,service_role;

create function public.setup2_index_live_snapshot_insert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform setup2_index_live_snapshot(new);
 return new;
end $$;
revoke all on function public.setup2_index_live_snapshot_insert() from public,anon,authenticated,service_role;
create trigger setup2_live_snapshot_index_insert after insert on public.setup2_live_snapshots
 for each row execute function public.setup2_index_live_snapshot_insert();

-- Erst nach leerer Folgeseite ist der Altbestand vollständig; Capturezeit stammt immer aus der Originalzeile.
create function public.setup2_backfill_live_snapshot_index(p_after_captured_at timestamptz default null,p_after_id text default null,p_limit integer default 64)
returns jsonb language plpgsql security definer set search_path=public as $$
declare source public.setup2_live_snapshots%rowtype; processed integer:=0; inserted integer:=0;
 last_at timestamptz:=p_after_captured_at; last_id text:=p_after_id;
begin
 if p_limit is null or p_limit<1 or p_limit>128 then raise exception 'Invalid live index batch';end if;
 if (p_after_captured_at is null)<>(p_after_id is null) then raise exception 'Invalid live index cursor';end if;
 for source in select * from setup2_live_snapshots
  where p_after_captured_at is null or (captured_at,id)>(p_after_captured_at,p_after_id)
  order by captured_at,id limit p_limit loop
  if setup2_index_live_snapshot(source) then inserted:=inserted+1;end if;
  processed:=processed+1;last_at:=source.captured_at;last_id:=source.id;
 end loop;
 return jsonb_build_object('processed',processed,'inserted',inserted,'next_captured_at',last_at,'next_id',last_id,'complete',processed=0);
end $$;
revoke all on function public.setup2_backfill_live_snapshot_index(timestamptz,text,integer) from public,anon,authenticated;
grant execute on function public.setup2_backfill_live_snapshot_index(timestamptz,text,integer) to service_role;
