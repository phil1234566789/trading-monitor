-- Die Filterbasis wird einmal vorbereitet; weder tausende HTTP-Seiten noch JSON-Arbeit pro Aufruf.
alter table public.simulation_statistics_sources add column index_data text check(octet_length(index_data)<=10000000);
create function public.clear_simulation_statistics_index() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
 if new.revision is distinct from old.revision or new.generation is distinct from old.generation then new.index_data:=null; end if;
 return new;
end $$;
revoke all on function public.clear_simulation_statistics_index() from public;
create trigger simulation_statistics_index_changed before update of revision,generation on public.simulation_statistics_sources
 for each row execute function public.clear_simulation_statistics_index();
create function public.save_simulation_statistics_index(p_run text,p_generation uuid,p_revision bigint,p_index text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 if p_index is null or octet_length(p_index)>10000000 or p_index !~ '^[A-Za-z0-9+/]+={0,2}$' then raise exception 'Invalid statistics index'; end if;
 update public.simulation_statistics_sources set index_data=p_index
 where run_id=p_run and generation=p_generation and revision=p_revision;
 if not found then raise exception 'Statistics source changed'; end if;
end $$;
revoke all on function public.save_simulation_statistics_index(text,uuid,bigint,text) from public;
grant execute on function public.save_simulation_statistics_index(text,uuid,bigint,text) to anon,authenticated;
notify pgrst,'reload schema';
