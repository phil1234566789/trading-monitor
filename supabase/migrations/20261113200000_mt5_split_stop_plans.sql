-- TP und SL teilen sich eine Reservierung: ein Teilclose darf die andere Ausstiegsseite nicht verwaisen lassen.
alter table public.mt5_target_plans add column next_stop_index integer not null default 0 check(next_stop_index between 0 and 5);
alter table public.mt5_target_commands drop constraint mt5_target_commands_kind_check;
alter table public.mt5_target_commands add constraint mt5_target_commands_kind_check check(kind in('install','close','stop_close'));

create function public.mt5_rescale_exit_levels(p_levels jsonb,p_before numeric,p_after numeric,p_step numeric,p_min numeric)
returns jsonb language plpgsql immutable set search_path=public as $$
declare level jsonb; output jsonb:='[]'; amount numeric; used numeric:=0; covered numeric; i integer:=0; count integer;
begin
 if p_after=0 then return output; end if;
 if p_before<=0 or p_step<=0 or p_min<=0 or p_after<0 or p_after>p_before then raise exception 'invalid_exit_rescale'; end if;
 count=jsonb_array_length(p_levels);
 select least(p_after,floor((coalesce(sum((value->>'volume')::numeric),0)/p_before*p_after+0.000000001)/p_step)*p_step) into covered from jsonb_array_elements(p_levels);
 for level in select value from jsonb_array_elements(p_levels) loop
  i=i+1;
  amount=case when i=count then covered-used else floor(((level->>'volume')::numeric/p_before*p_after+0.000000001)/p_step)*p_step end;
  if i=count then
   while amount<p_min-0.000000001 and jsonb_array_length(output)>0 loop
    used=used-(output->-1->>'volume')::numeric;output=output-(jsonb_array_length(output)-1);amount=covered-used;
   end loop;
  end if;
  if amount>=p_min-0.000000001 then output=output||jsonb_build_array(jsonb_set(level,'{volume}',to_jsonb(amount)));used=used+amount; end if;
 end loop;
 return output;
end $$;
revoke all on function public.mt5_rescale_exit_levels(jsonb,numeric,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.mt5_rescale_exit_levels(jsonb,numeric,numeric,numeric,numeric) to service_role;

alter function public.mt5_save_target_plan(uuid,uuid,uuid,jsonb,jsonb) rename to mt5_save_target_plan_before_stops;
create function public.mt5_save_target_plan(p_order uuid,p_revision uuid,p_expected uuid,p_plan jsonb,p_checkpoint jsonb)
returns public.mt5_target_plans language plpgsql security invoker set search_path=public as $$
declare previous public.mt5_target_plans; saved public.mt5_target_plans;
begin
 perform pg_advisory_xact_lock(29092026,1);
 select p.* into previous from mt5_target_plans p join mt5_target_positions s on s.id=p.order_id
 where s.account_login::text=p_plan->>'account_login' and s.account_server=p_plan->>'account_server' and s.position_ticket::text=p_plan->>'position';
 if previous.plan->>'risk_basis_sl' is not null and previous.plan->'risk_basis_sl' is distinct from p_plan->'risk_basis_sl' then raise exception 'stop_risk_basis_changed'; end if;
 if previous.plan ? 'stops' and not p_plan ? 'stops' then raise exception 'stop_plan_refresh_required'; end if;
 saved=public.mt5_save_target_plan_before_stops(p_order,p_revision,p_expected,p_plan,p_checkpoint);
 if saved.revision<>p_revision then raise exception 'target_revision_changed'; end if;
 if previous.revision is distinct from saved.revision then
  update mt5_target_plans set next_stop_index=0 where order_id=saved.order_id returning * into saved;
 end if;
 return saved;
end $$;
revoke all on function public.mt5_save_target_plan(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.mt5_save_target_plan(uuid,uuid,uuid,jsonb,jsonb) to service_role;

create or replace function public.mt5_claim_target(p_order uuid,p_revision uuid,p_id uuid,p_kind text,p_index integer)
returns boolean language plpgsql security invoker set search_path=public as $$
declare saved public.mt5_target_plans;
begin
 perform pg_advisory_xact_lock(29092026,1);
 select * into saved from mt5_target_plans where order_id=p_order for update;
 if public.mt5_targets_guarded((saved.plan->>'account_login')::bigint,saved.plan->>'account_server') then return false; end if;
 if saved.revision is distinct from p_revision or not(
  (p_kind='install' and saved.state='pending' and p_index=-1) or
  (p_kind='close' and saved.state='active' and saved.next_index=p_index and p_index<jsonb_array_length(saved.plan->'targets') and (saved.plan->>'native_tp')::numeric=0) or
  (p_kind='stop_close' and saved.state='active' and saved.next_stop_index=p_index and p_index<jsonb_array_length(saved.plan->'stops') and (saved.checkpoint->>'sl')::numeric=(saved.plan->>'native_sl')::numeric)
 ) then return false; end if;
 if exists(select 1 from mt5_execution_orders where status in('sending','unknown') and intent->>'account_login'=saved.plan->>'account_login' and intent->>'account_server'=saved.plan->>'account_server') or
  exists(select 1 from mt5_target_commands c join mt5_target_plans p on p.order_id=c.order_id where c.status in('sending','unknown') and p.plan->>'account_login'=saved.plan->>'account_login' and p.plan->>'account_server'=saved.plan->>'account_server') then return false; end if;
 if not exists(select 1 from mt5_accounts a where not a.archived and a.login::text=saved.plan->>'account_login' and a.server=saved.plan->>'account_server') then return false; end if;
 insert into mt5_target_commands(id,order_id,revision,kind,target_index,status) values(p_id,p_order,p_revision,p_kind,p_index,'sending');
 update mt5_target_plans set state='sending',updated_at=now(),reason=null where order_id=p_order;
 return true;
end $$;

create or replace function public.mt5_finish_target(p_id uuid,p_result jsonb)
returns boolean language plpgsql security invoker set search_path=public as $$
declare command public.mt5_target_commands; saved public.mt5_target_plans; expected numeric; before_volume numeric; expected_sl numeric; state_after text; leg text; opposite text; opposite_index integer; resized jsonb;
begin
 perform pg_advisory_xact_lock(29092026,1);
 select * into command from mt5_target_commands where id=p_id for update;
 if command.id is null then return false; end if;
 if command.result is not null and command.result=p_result then return true; end if;
 if command.status not in('sending','unknown') then return false; end if;
 select * into saved from mt5_target_plans where order_id=command.order_id for update;
 if saved.revision<>command.revision then return false; end if;
 state_after=case p_result->>'status' when 'executed' then 'active' when 'rejected' then 'paused' else 'unknown' end;
 if p_result->>'status'='executed' then
  leg=case when command.kind='stop_close' then 'stops' else 'targets' end;
  before_volume=(saved.checkpoint->>'volume')::numeric;
  expected=before_volume-case when command.kind<>'install' then (saved.plan->leg->command.target_index->>'volume')::numeric else 0 end;
  expected_sl=case when command.kind='install' then coalesce((saved.plan->>'native_sl')::numeric,(saved.checkpoint->>'sl')::numeric) else (saved.checkpoint->>'sl')::numeric end;
  if not p_result ?& array['remaining_volume','sl','tp'] or expected is null or expected<0 or
   abs((p_result->>'remaining_volume')::numeric-expected)>0.00000001 or (p_result->>'sl')::numeric<>expected_sl or (p_result->>'tp')::numeric<>(saved.plan->>'native_tp')::numeric or
   (command.kind<>'install' and coalesce((p_result->>'deal')::numeric,0)<=0) then raise exception 'target_result_mismatch'; end if;
  if expected=0 then state_after='completed'; end if;
  if saved.plan ? 'stops' and command.kind<>'install' then
   opposite=case when command.kind='stop_close' then 'targets' else 'stops' end;
   opposite_index=case when command.kind='stop_close' then saved.next_index else saved.next_stop_index end;
   select coalesce(jsonb_agg(value order by ord),'[]') into resized from jsonb_array_elements(saved.plan->opposite) with ordinality as a(value,ord) where ord>opposite_index;
   resized=public.mt5_rescale_exit_levels(resized,before_volume,expected,(saved.plan->>'volume_step')::numeric,(saved.plan->>'minimum_volume')::numeric);
   saved.plan=jsonb_set(saved.plan,array[opposite],resized);
  end if;
  update mt5_target_plans set plan=saved.plan,checkpoint=jsonb_build_object('volume',expected,'sl',(p_result->>'sl')::numeric,'tp',(p_result->>'tp')::numeric),
   next_index=case when command.kind='close' then next_index+1 when command.kind='stop_close' then 0 else next_index end,
   next_stop_index=case when command.kind='stop_close' then next_stop_index+1 when command.kind='close' and saved.plan ? 'stops' then 0 else next_stop_index end
  where order_id=saved.order_id;
 end if;
 update mt5_target_commands set status=p_result->>'status',result=p_result where id=p_id;
 update mt5_target_plans set state=state_after,reason=p_result->>'reason',updated_at=now() where order_id=saved.order_id;
 return true;
end $$;

create index mt5_deals_exit_cost_sample on mt5_broker_deals(account_id,symbol,time_msc desc) where type in(0,1) and entry in(1,3);
create function public.mt5_position_forecast_costs(p_account uuid,p_position bigint,p_symbol text)
returns jsonb language sql stable security invoker set search_path=public as $$
 with entry_cost as(
  select sum(commission+fee) costs,sum(volume) volume,bool_and(currency='USD') valid_currency from mt5_broker_deals
  where account_id=p_account and position_id=p_position and symbol=p_symbol and entry=0 and type in(0,1)
 ), exits as(
  select commission,fee,volume,time_msc,currency from mt5_broker_deals
  where account_id=p_account and symbol=p_symbol and type in(0,1) and entry in(1,3) order by time_msc desc,ticket desc limit 100
 ) select jsonb_build_object('entry_costs',case when e.valid_currency and not exists(select 1 from mt5_broker_deals where account_id=p_account and position_id=p_position and type not in(0,1) and profit+commission+fee<>0) then e.costs else null end,
  'entry_volume',e.volume,'estimated_exit_costs_per_lot',(select sum(commission+fee)/nullif(sum(volume),0) from exits where currency='USD'),
  'exit_sample_at',(select max(time_msc) from exits)) from entry_cost e;
$$;
revoke all on function public.mt5_position_forecast_costs(uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.mt5_position_forecast_costs(uuid,bigint,text) to service_role;
