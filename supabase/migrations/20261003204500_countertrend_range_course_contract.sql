-- Der Countertrend speichert seinen Verlauf bereits beim ersten validierten Stand.
-- Beide Modellversionen prüfen weiterhin die unveränderlichen Levels ihrer Referenz.
create or replace function public.save_trade_setup_simulation_setups(run_id text, records jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare item jsonb; previous jsonb; course jsonb; reference jsonb; horizon numeric; is_countertrend boolean;
begin
  if jsonb_typeof(records) is distinct from 'array' or jsonb_array_length(records) > 100 then
    raise exception 'Expected at most 100 setup snapshots';
  end if;
  for item in select value from jsonb_array_elements(records) loop
    select s.snapshot into previous from public.trade_setup_simulation_setups s
      where s.run_id=save_trade_setup_simulation_setups.run_id and s.id=item->>'id' for update;
    if found and previous-'rangeCourse' <> item-'rangeCourse' then
      raise exception 'Setup snapshot is immutable';
    end if;
    course:=item->'rangeCourse';
    if course is not null and course <> 'null'::jsonb then
      horizon:=(course->'lifecycle'->>'evaluatedAt')::numeric;
      is_countertrend:=course->>'version'='countertrend-validation-t1-be-t2-v2';
      if course->>'version' is null or course->>'version' not in
          ('first-validation-frozen-levels-m5-v1','countertrend-validation-t1-be-t2-v2')
        or course->>'setupKey' is distinct from item->>'setupKey'
        or horizon is null or (course->>'validatedAt')::numeric is null
        or horizon < (course->>'validatedAt')::numeric
        or (not is_countertrend and horizon=(course->>'validatedAt')::numeric)
        or not exists(select 1 from public.trade_setup_simulation_runs r
          where r.id=save_trade_setup_simulation_setups.run_id and horizon <= (r.run->>'to')::numeric)
      then raise exception 'Invalid frozen range course'; end if;
      select s.snapshot into reference from public.trade_setup_simulation_setups s
        where s.run_id=save_trade_setup_simulation_setups.run_id
          and s.snapshot->>'setupKey'=course->>'setupKey'
          and (s.snapshot->>'knownAt')::numeric=(course->>'validatedAt')::numeric
          and (not is_countertrend or s.snapshot->'dealingRange'->>'status'='validated')
        order by s.id limit 1;
      -- Bootstrap ist nur am eigenen belegten Validierungszeitpunkt zulässig.
      if reference is null and is_countertrend
        and (item->>'knownAt')::numeric=(course->>'validatedAt')::numeric
        and item->'dealingRange'->>'status'='validated'
        and item->'dealingRange'->>'version'='countertrend-abcdef-v1'
        and item->'checklist'->>'model'='countertrend' then reference:=item; end if;
      if reference is null
        or reference->'checklist'->'setup'->'primary'->>'direction' is distinct from course->>'direction'
        or reference->'checklist'->'setup'->'primary'->>'invalidation' is distinct from course->>'invalidation'
        or reference->'checklist'->'setup'->'primary'->'targetSelection'->>'selectedAt' is distinct from course->>'selectedAt'
        or reference->'checklist'->'setup'->'primary'->'targetSelection'->'target1'->>'price' is distinct from course->>'target1'
        or (is_countertrend and (reference->'dealingRange'->>'version' is distinct from 'countertrend-abcdef-v1'
          or reference->'checklist'->>'model' is distinct from 'countertrend'
          or reference->'checklist'->'setup'->'primary'->'targetSelection'->>'status' is distinct from 'passed'
          or reference->'checklist'->'setup'->'primary'->'targetSelection'->'target2'->>'price' is distinct from course->>'target2'))
      then raise exception 'Invalid frozen range course'; end if;
      if previous->'rangeCourse' is not null and previous->'rangeCourse' <> 'null'::jsonb
        and (previous->'rangeCourse')-'lifecycle' <> course-'lifecycle' then
        raise exception 'Range course levels are immutable';
      end if;
    end if;
    insert into public.trade_setup_simulation_setups as existing(run_id,id,instrument,direction,known_at,snapshot)
    values(run_id,item->>'id',item->>'instrument',item->>'direction',(item->>'knownAt')::numeric::bigint,item)
    on conflict on constraint trade_setup_simulation_setups_pkey do update
      set snapshot=jsonb_set(existing.snapshot,'{rangeCourse}',excluded.snapshot->'rangeCourse')
      where excluded.snapshot->'rangeCourse' is not null and excluded.snapshot->'rangeCourse' <> 'null'::jsonb
        and coalesce((existing.snapshot->'rangeCourse'->'lifecycle'->>'evaluatedAt')::numeric,0)
          <= (excluded.snapshot->'rangeCourse'->'lifecycle'->>'evaluatedAt')::numeric;
  end loop;
end;
$$;
notify pgrst, 'reload schema';
