-- Integrationstest auf einem vorhandenen fertigen DR-Verlauf; alle Änderungen
-- werden zurückgerollt. npx supabase db query --linked --file test/sql/simulationRangeCourse.sql
begin;
do $$
declare original jsonb; changed jsonb; selected_run text; rejected boolean; horizon bigint;
begin
  select run_id,snapshot into selected_run,original from public.trade_setup_simulation_setups
    where snapshot ? 'rangeCourse' limit 1;
  if original is null then raise exception 'A completed range course is required'; end if;
  perform public.save_trade_setup_simulation_setups(selected_run,jsonb_build_array(original));
  changed:=original-'rangeCourse';
  perform public.save_trade_setup_simulation_setups(selected_run,jsonb_build_array(changed));
  if not exists(select 1 from public.trade_setup_simulation_setups where run_id=selected_run
    and id=original->>'id' and snapshot=original) then raise exception 'Checkpoint removed course'; end if;
  changed:=jsonb_set(original,'{knownAt}',to_jsonb((original->>'knownAt')::bigint+60));
  rejected:=false;
  begin
    perform public.save_trade_setup_simulation_setups(selected_run,jsonb_build_array(changed));
  exception when others then
    if sqlerrm='Setup snapshot is immutable' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'Historical snapshot mutation accepted'; end if;
  horizon:=(original->'rangeCourse'->'lifecycle'->>'evaluatedAt')::bigint;
  changed:=jsonb_set(original,'{rangeCourse,lifecycle,evaluatedAt}',to_jsonb(horizon-60));
  perform public.save_trade_setup_simulation_setups(selected_run,jsonb_build_array(changed));
  if (select snapshot from public.trade_setup_simulation_setups where run_id=selected_run
    and id=original->>'id')<>original then raise exception 'Course horizon moved backwards'; end if;
  changed:=jsonb_set(original,'{rangeCourse,target1}',to_jsonb(42));
  rejected:=false;
  begin
    perform public.save_trade_setup_simulation_setups(selected_run,jsonb_build_array(changed));
  exception when others then
    if sqlerrm='Invalid frozen range course' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'Frozen target mutation accepted'; end if;
end $$;
select 'simulation range course persistence passed' as verification;
rollback;
