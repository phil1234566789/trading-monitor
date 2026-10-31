-- Teilziele sind private Finanzaufträge; ein unklarer Close bekommt niemals ein neues Versandrecht.
create table public.mt5_target_plans (
 order_id uuid primary key references public.mt5_execution_orders(id),
 revision uuid not null unique,
 plan jsonb not null,
 checkpoint jsonb not null,
 state text not null check(state in ('pending','sending','active','paused','unknown','completed')),
 next_index integer not null default 0 check(next_index between 0 and 5),
 reason text,
 updated_at timestamptz not null default now()
);
create table public.mt5_target_commands (
 id uuid primary key,
 order_id uuid not null references public.mt5_target_plans(order_id),
 revision uuid not null,
 kind text not null check(kind in ('install','close')),
 target_index integer not null,
 status text not null check(status in ('sending','executed','rejected','unknown')),
 result jsonb,
 created_at timestamptz not null default now()
);
alter table public.mt5_target_plans enable row level security;
alter table public.mt5_target_commands enable row level security;
revoke all on public.mt5_target_plans,public.mt5_target_commands from anon,authenticated;
grant select,insert,update on public.mt5_target_plans,public.mt5_target_commands to service_role;

-- Dieselbe Kontosperre gilt für Targets und die priorisierte Tagesnotbremse.
create function public.mt5_targets_guarded(p_login bigint,p_server text)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 if to_regclass('public.mt5_guard_commands') is not null then
  if exists(select 1 from public.mt5_guard_commands where status in ('sending','unknown')) then return true; end if;
 end if;
 if to_regclass('public.mt5_daily_stops') is not null then
  if exists(select 1 from public.mt5_daily_stops d join public.mt5_accounts a on a.id=d.account_id
    where a.login=p_login and a.server=p_server and d.day=timezone('Europe/Berlin',now())::date) then return true; end if;
 end if;
 return false;
end;
$$;
revoke all on function public.mt5_targets_guarded(bigint,text) from public,anon,authenticated;
grant execute on function public.mt5_targets_guarded(bigint,text) to service_role;

create function public.mt5_save_target_plan(p_order uuid,p_revision uuid,p_expected uuid,p_plan jsonb,p_checkpoint jsonb)
returns public.mt5_target_plans language plpgsql security invoker set search_path=public as $$
declare saved public.mt5_target_plans;
begin
 perform pg_advisory_xact_lock(29092026,1);
 select * into saved from public.mt5_target_plans where order_id=p_order for update;
 if public.mt5_targets_guarded((p_plan->>'account_login')::bigint,p_plan->>'account_server') then raise exception 'target_daily_stop'; end if;
 if saved.revision=p_revision then
  if saved.plan<>p_plan then raise exception 'target_revision_reused'; end if;
  return saved;
 end if;
 if saved.revision is distinct from p_expected then raise exception 'target_revision_changed'; end if;
 if saved.state in ('sending','unknown') or exists(select 1 from public.mt5_target_commands where status in ('sending','unknown')) then raise exception 'target_outcome_unresolved'; end if;
 if exists(select 1 from public.mt5_execution_orders where status in ('sending','unknown')) then raise exception 'target_outcome_unresolved'; end if;
 if not exists(select 1 from public.mt5_execution_settings s join public.mt5_accounts a on a.id=s.active_account_id
  where s.id='primary' and a.login::text=p_plan->>'account_login' and a.server=p_plan->>'account_server') then raise exception 'account_changed'; end if;
 insert into public.mt5_target_plans(order_id,revision,plan,checkpoint,state)
 values(p_order,p_revision,p_plan,p_checkpoint,'pending')
 on conflict(order_id) do update set revision=excluded.revision,plan=excluded.plan,checkpoint=excluded.checkpoint,state='pending',next_index=0,reason=null,updated_at=now()
 returning * into saved;
 return saved;
end;
$$;

create function public.mt5_claim_target(p_order uuid,p_revision uuid,p_id uuid,p_kind text,p_index integer)
returns boolean language plpgsql security invoker set search_path=public as $$
declare saved public.mt5_target_plans;
begin
 perform pg_advisory_xact_lock(29092026,1);
 select * into saved from public.mt5_target_plans where order_id=p_order for update;
 if public.mt5_targets_guarded((saved.plan->>'account_login')::bigint,saved.plan->>'account_server') then return false; end if;
 if saved.revision is distinct from p_revision or
  not ((p_kind='install' and saved.state='pending' and p_index=-1) or (p_kind='close' and saved.state='active' and saved.next_index=p_index and p_index<jsonb_array_length(saved.plan->'targets') and (saved.plan->>'native_tp')::numeric=0)) then return false; end if;
 if exists(select 1 from public.mt5_execution_orders where status in ('sending','unknown')) or
  exists(select 1 from public.mt5_target_commands where status in ('sending','unknown')) then return false; end if;
 if not exists(select 1 from public.mt5_execution_settings s join public.mt5_accounts a on a.id=s.active_account_id
  where s.id='primary' and a.login::text=saved.plan->>'account_login' and a.server=saved.plan->>'account_server') then return false; end if;
 insert into public.mt5_target_commands(id,order_id,revision,kind,target_index,status) values(p_id,p_order,p_revision,p_kind,p_index,'sending');
 update public.mt5_target_plans set state='sending',updated_at=now(),reason=null where order_id=p_order;
 return true;
end;
$$;

create function public.mt5_finish_target(p_id uuid,p_result jsonb)
returns boolean language plpgsql security invoker set search_path=public as $$
declare command public.mt5_target_commands; saved public.mt5_target_plans; expected numeric; state_after text;
begin
 perform pg_advisory_xact_lock(29092026,1);
 select * into command from public.mt5_target_commands where id=p_id for update;
 if command.id is null then return false; end if;
 if command.result is not null and command.result=p_result then return true; end if;
 if command.status not in ('sending','unknown') then return false; end if;
 select * into saved from public.mt5_target_plans where order_id=command.order_id for update;
 if saved.revision<>command.revision then return false; end if;
 state_after=case p_result->>'status' when 'executed' then 'active' when 'rejected' then 'paused' else 'unknown' end;
 if p_result->>'status'='executed' then
  expected=(saved.checkpoint->>'volume')::numeric-case when command.kind='close' then (saved.plan->'targets'->command.target_index->>'volume')::numeric else 0 end;
  if abs((p_result->>'remaining_volume')::numeric-expected)>0.00000001 or (p_result->>'sl')::numeric<>(saved.checkpoint->>'sl')::numeric or (p_result->>'tp')::numeric<>(saved.plan->>'native_tp')::numeric then raise exception 'target_result_mismatch'; end if;
  if expected=0 then state_after='completed'; end if;
  update public.mt5_target_plans set checkpoint=jsonb_build_object('volume',expected,'sl',(p_result->>'sl')::numeric,'tp',(p_result->>'tp')::numeric),
   next_index=next_index+case when command.kind='close' then 1 else 0 end where order_id=saved.order_id;
 end if;
 update public.mt5_target_commands set status=p_result->>'status',result=p_result where id=p_id;
 update public.mt5_target_plans set state=state_after,reason=p_result->>'reason',updated_at=now() where order_id=saved.order_id;
 return true;
end;
$$;
revoke all on function public.mt5_save_target_plan(uuid,uuid,uuid,jsonb,jsonb),public.mt5_claim_target(uuid,uuid,uuid,text,integer),public.mt5_finish_target(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.mt5_save_target_plan(uuid,uuid,uuid,jsonb,jsonb),public.mt5_claim_target(uuid,uuid,uuid,text,integer),public.mt5_finish_target(uuid,jsonb) to service_role;

create or replace function public.mt5_select_test_account(account_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(29092026,1);
 if exists(select 1 from public.mt5_execution_orders where status in ('searching','sending','unknown')) or
  exists(select 1 from public.mt5_target_plans where state in ('pending','active','sending','unknown')) then raise exception 'active_orders_block_account_switch'; end if;
 if account_id is not null and not exists(select 1 from public.mt5_accounts where id=account_id) then raise exception 'account_not_found'; end if;
 update public.mt5_execution_settings set active_account_id=account_id where id='primary';
 delete from public.mt5_bridge_state where id='primary';
end;
$$;
