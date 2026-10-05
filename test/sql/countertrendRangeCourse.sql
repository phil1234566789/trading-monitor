-- Synthetische Speichervertragsprüfung, vollständig zurückgerollt.
-- Die neue Migration kann für den Test innerhalb derselben Transaktion vorangestellt werden.
do $$
declare run_key text:='test:countertrend-range-course-contract'; original jsonb; changed jsonb;
  course jsonb; check_key text; rejected boolean; dr_version text;
begin
  foreach dr_version in array array['countertrend-abcdef-v1','countertrend-abcdef-v2'] loop
  run_key:='test:countertrend-range-course-contract:'||dr_version;
  perform public.save_trade_setup_simulation_run(jsonb_build_object('id',run_key,'version','countertrend-entry-model-1-v9',
    'from',0,'to',1800,'evaluatedAt',1800,'status','complete','configuration',jsonb_build_object('setupModel','countertrend')));
  original:='{"id":"test:stand:600.613","setupKey":"test","instrument":"GBPUSD","direction":"short","knownAt":600.613,
    "dealingRange":{"version":"countertrend-abcdef-v1","status":"validated"},
    "checklist":{"model":"countertrend","setup":{"primary":{"direction":"short","invalidation":1.4,
      "targetSelection":{"status":"passed","selectedAt":600.613,"target1":{"price":1.2},"target2":{"price":1.1}}}}},
    "rangeCourse":{"version":"countertrend-validation-t1-be-t2-v2","setupKey":"test","validatedAt":600.613,
      "selectedAt":600.613,"direction":"short","invalidation":1.4,"target1":1.2,"target2":1.1,
      "lifecycle":{"evaluatedAt":600.613}}}'::jsonb;
  original:=jsonb_set(original,'{dealingRange,version}',to_jsonb(dr_version));
  perform public.save_trade_setup_simulation_setups(run_key,jsonb_build_array(original));
  changed:=jsonb_set(original,'{rangeCourse,lifecycle,evaluatedAt}','1200');
  perform public.save_trade_setup_simulation_setups(run_key,jsonb_build_array(changed));
  perform public.save_trade_setup_simulation_setups(run_key,jsonb_build_array(original));
  if (select snapshot->'rangeCourse'->'lifecycle'->>'evaluatedAt' from public.trade_setup_simulation_setups
    where run_id=run_key and id=original->>'id') <> '1200' then raise exception 'Horizon went backwards'; end if;
  for check_key in select unnest(array['target1','target2','invalidation','validatedAt','selectedAt','version','setupKey','direction']) loop
    course:=changed->'rangeCourse';
    course:=jsonb_set(course,array[check_key],case when check_key in ('version','setupKey','direction') then '"forged"'::jsonb else '42'::jsonb end);
    rejected:=false;
    begin
      perform public.save_trade_setup_simulation_setups(run_key,jsonb_build_array(jsonb_set(changed,'{rangeCourse}',course)));
    exception when others then
      if sqlerrm in ('Invalid frozen range course','Range course levels are immutable') then rejected:=true; else raise; end if;
    end;
    if not rejected then raise exception 'Accepted forged %',check_key; end if;
  end loop;
  changed:=jsonb_set(original,'{knownAt}','601');rejected:=false;
  begin perform public.save_trade_setup_simulation_setups(run_key,jsonb_build_array(changed));
  exception when others then if sqlerrm='Setup snapshot is immutable' then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'Changed initial snapshot accepted'; end if;
  changed:=jsonb_set(original,'{id}','"unvalidated"');
  changed:=jsonb_set(changed,'{setupKey}','"unvalidated"');changed:=jsonb_set(changed,'{rangeCourse,setupKey}','"unvalidated"');
  changed:=jsonb_set(changed,'{dealingRange,status}','"confirmed"');rejected:=false;
  begin perform public.save_trade_setup_simulation_setups(run_key,jsonb_build_array(changed));
  exception when others then if sqlerrm='Invalid frozen range course' then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'Unvalidated bootstrap accepted'; end if;
  foreach check_key in array array['missing','unsupported'] loop
    changed:=jsonb_set(original,'{id}',to_jsonb(check_key));
    changed:=jsonb_set(changed,'{setupKey}',to_jsonb(check_key));
    changed:=jsonb_set(changed,'{rangeCourse,setupKey}',to_jsonb(check_key));
    changed:=jsonb_set(changed,'{dealingRange,version}',case when check_key='missing' then 'null'::jsonb else '"future"'::jsonb end);
    rejected:=false;
    begin perform public.save_trade_setup_simulation_setups(run_key,jsonb_build_array(changed));
    exception when others then if sqlerrm='Invalid frozen range course' then rejected:=true; else raise; end if; end;
    if not rejected then raise exception 'Unsupported DR version accepted'; end if;
  end loop;
  end loop;
end $$;
select 'countertrend range course contract passed' as verification;
