-- Konflikte nennen nur die Beleg-ID und Feldnamen; Originalwerte bleiben geschützt.
create or replace function public.setup2_store_evidence_batch(p_instrument text,batch jsonb)
returns void language plpgsql set search_path=public as $$
declare item jsonb; config jsonb; config_id text; prior public.setup2_live_snapshots%rowtype; new_ids text[]; inserted_id text;
begin
  if jsonb_typeof(batch->'snapshots') is distinct from 'array' or jsonb_typeof(coalesce(batch->'payloads','[]'::jsonb)) is distinct from 'array'
   or jsonb_array_length(batch->'snapshots')+jsonb_array_length(coalesce(batch->'payloads','[]'::jsonb))=0 then
   raise exception 'Live evidence requires nonempty records';
  end if;
  config:=batch->'configuration'->'configuration'; config_id:=batch->'configuration'->>'id';
  if jsonb_typeof(config) is distinct from 'object' or config->>'instrument' is distinct from p_instrument then
   raise exception 'Live configuration instrument mismatch';
  end if;
  insert into setup2_live_configurations(id,configuration) values(config_id,config) on conflict(id) do nothing;
  if (select configuration from setup2_live_configurations where id=config_id) is distinct from config then
   raise exception 'Live configuration identity conflict';
  end if;
  new_ids:='{}';
  for item in select value from jsonb_array_elements(coalesce(batch->'payloads','[]'::jsonb)) loop
   inserted_id:=null;
   insert into setup2_live_payloads(id,payload) values(item->>'id',item->'payload') on conflict(id) do nothing returning id into inserted_id;
   if inserted_id is not null then new_ids:=array_append(new_ids,inserted_id);end if;
   if (select payload from setup2_live_payloads where id=item->>'id') is distinct from item->'payload' then
    raise exception 'Live payload identity conflict';
   end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(batch->'payloads','[]'::jsonb)) loop
   if item->>'id'=any(new_ids) then
    perform setup2_validate_evidence_value(item->'payload',array[item->>'id'],new_ids);
    new_ids:=array_remove(new_ids,item->>'id');
   end if;
  end loop;
  for item in select value from jsonb_array_elements(batch->'snapshots') loop
   perform setup2_validate_evidence_value(item->'snapshot','{}','{}');
   perform setup2_validate_evidence_value(item->'observation','{}','{}');
   if item->>'instrument' is distinct from p_instrument or (item ? 'configuration_id' and item->>'configuration_id' is distinct from config_id) then
    raise exception 'Live evidence identity mismatch';
   end if;
   insert into setup2_live_snapshots(id,snapshot_id,instrument,setup_key,known_at,evaluated_through,configuration_id,evaluation_mode,snapshot,observation)
   values(item->>'id',item->>'snapshot_id',p_instrument,item->>'setup_key',(item->>'known_at')::timestamptz,
    (item->>'evaluated_through')::timestamptz,config_id,item->>'evaluation_mode',item->'snapshot',item->'observation')
   on conflict(id) do nothing;
   select * into strict prior from setup2_live_snapshots where id=item->>'id';
   if prior.snapshot is distinct from item->'snapshot' or prior.observation is distinct from item->'observation'
    or prior.snapshot_id is distinct from item->>'snapshot_id' or prior.configuration_id is distinct from config_id
    or prior.evaluation_mode is distinct from item->>'evaluation_mode'
    or prior.known_at is distinct from (item->>'known_at')::timestamptz
    or prior.evaluated_through is distinct from (item->>'evaluated_through')::timestamptz then
    raise exception 'Live snapshot identity conflict' using detail=jsonb_build_object(
     'id',item->>'id','differingFields',(
      select jsonb_agg(key order by key) from jsonb_each(jsonb_build_object(
       'snapshot',item->'snapshot','observation',item->'observation',
       'snapshot_id',item->>'snapshot_id','configuration_id',config_id,
       'evaluation_mode',item->>'evaluation_mode',
       'known_at',(item->>'known_at')::timestamptz,
       'evaluated_through',(item->>'evaluated_through')::timestamptz))
      where to_jsonb(prior)->key is distinct from value))::text;
   end if;
  end loop;

end $$;
notify pgrst, 'reload schema';
