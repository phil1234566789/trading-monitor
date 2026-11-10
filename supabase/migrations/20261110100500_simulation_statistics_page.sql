-- Lange kausale Idea-IDs überschreiten schon bei 25 DRs das GET-URL-Limit; Schlüssel als POST-Parameter lesen.
create function public.read_simulation_statistics_page(p_run text,p_generation uuid,p_keys text[])
returns table(key text,summary jsonb) language plpgsql stable security invoker set search_path=pg_catalog as $$
begin
 if p_keys is null or cardinality(p_keys)>25 then raise exception 'Expected at most 25 DR keys'; end if;
 return query select r.key,r.summary from public.simulation_statistics_overview r
 where r.run_id=p_run and r.generation=p_generation and r.key=any(p_keys) order by r.key;
end $$;
revoke all on function public.read_simulation_statistics_page(text,uuid,text[]) from public;
grant execute on function public.read_simulation_statistics_page(text,uuid,text[]) to anon,authenticated;
notify pgrst,'reload schema';
