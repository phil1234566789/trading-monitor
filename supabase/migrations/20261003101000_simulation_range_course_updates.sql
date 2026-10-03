-- Die Checkliste bleibt eingefroren; der separat berechnete DR-Verlauf darf
-- nach Tages-Checkpoints ergänzt werden. ON CONFLICT DO NOTHING verlor ihn.
create or replace function public.save_trade_setup_simulation_setups(run_id text, records jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare item jsonb; previous jsonb; course jsonb; horizon bigint;
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
    if course is not null then
      horizon:=(course->'lifecycle'->>'evaluatedAt')::bigint;
      if course->>'version' is distinct from 'first-validation-frozen-levels-m5-v1'
        or course->>'setupKey' is distinct from item->>'setupKey'
        or horizon is null or horizon <= (course->>'validatedAt')::bigint
        or not exists (select 1 from public.trade_setup_simulation_runs r
          where r.id=save_trade_setup_simulation_setups.run_id and horizon <= (r.run->>'to')::bigint)
        or not exists (select 1 from public.trade_setup_simulation_setups s
          where s.run_id=save_trade_setup_simulation_setups.run_id
            and s.snapshot->>'setupKey'=course->>'setupKey'
            and s.known_at=(course->>'validatedAt')::bigint
            and s.snapshot->'checklist'->'setup'->'primary'->>'direction'=course->>'direction'
            and s.snapshot->'checklist'->'setup'->'primary'->>'invalidation'=course->>'invalidation'
            and s.snapshot->'checklist'->'setup'->'primary'->'targetSelection'->>'selectedAt'=course->>'selectedAt'
            and s.snapshot->'checklist'->'setup'->'primary'->'targetSelection'->'target1'->>'price'=course->>'target1')
      then raise exception 'Invalid frozen range course'; end if;
      if previous->'rangeCourse' is not null
        and (previous->'rangeCourse')-'lifecycle' <> course-'lifecycle' then
        raise exception 'Range course levels are immutable';
      end if;
    end if;
    insert into public.trade_setup_simulation_setups as existing(run_id,id,instrument,direction,known_at,snapshot)
    values (run_id,item->>'id',item->>'instrument',item->>'direction',(item->>'knownAt')::bigint,item)
    on conflict on constraint trade_setup_simulation_setups_pkey do update
      set snapshot=jsonb_set(existing.snapshot,'{rangeCourse}',excluded.snapshot->'rangeCourse')
      where excluded.snapshot->'rangeCourse' is not null
        and coalesce((existing.snapshot->'rangeCourse'->'lifecycle'->>'evaluatedAt')::bigint,0)
          <= (excluded.snapshot->'rangeCourse'->'lifecycle'->>'evaluatedAt')::bigint;
  end loop;
end;
$$;
