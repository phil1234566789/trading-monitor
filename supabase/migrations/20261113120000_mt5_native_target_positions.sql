-- Eine manuelle Brokerposition ist eine Verwaltungsidentität, kein erfundener Ausführungsauftrag.
do $$
begin
 if exists(select 1 from public.mt5_target_plans group by plan->>'account_login',plan->>'account_server',plan->>'position' having count(*)>1)
 then raise exception 'target_position_migration_duplicate_plans'; end if;
 if exists(select 1 from public.mt5_target_plans p left join public.mt5_accounts a
  on a.login::text=p.plan->>'account_login' and a.server=p.plan->>'account_server'
  where a.id is null or coalesce(p.plan->>'position','')!~'^[1-9][0-9]*$')
 then raise exception 'target_position_migration_identity_unresolved'; end if;
end;
$$;
create table public.mt5_target_positions (
 id uuid primary key,
 account_id uuid not null references public.mt5_accounts(id),
 account_login bigint not null,
 account_server text not null,
 position_ticket bigint not null check(position_ticket>0),
 execution_order_id uuid unique references public.mt5_execution_orders(id),
 unique(account_login,account_server,position_ticket)
);
alter table public.mt5_target_positions enable row level security;
revoke all on public.mt5_target_positions from public,anon,authenticated;
grant select,insert,update on public.mt5_target_positions to service_role;

insert into public.mt5_target_positions(id,account_id,account_login,account_server,position_ticket,execution_order_id)
select p.order_id,a.id,a.login,a.server,(p.plan->>'position')::bigint,p.order_id
from public.mt5_target_plans p join public.mt5_accounts a
 on a.login::text=p.plan->>'account_login' and a.server=p.plan->>'account_server';
alter table public.mt5_target_plans drop constraint mt5_target_plans_order_id_fkey;
alter table public.mt5_target_plans add constraint mt5_target_plans_order_id_fkey
 foreign key(order_id) references public.mt5_target_positions(id);

create or replace function public.mt5_save_target_plan(p_order uuid,p_revision uuid,p_expected uuid,p_plan jsonb,p_checkpoint jsonb)
returns public.mt5_target_plans language plpgsql security invoker set search_path=public as $$
declare saved public.mt5_target_plans; subject public.mt5_target_positions; account public.mt5_accounts; execution public.mt5_execution_orders;
begin
 perform pg_advisory_xact_lock(29092026,1);
 select * into account from public.mt5_accounts a
 where not a.archived and a.login::text=p_plan->>'account_login' and a.server=p_plan->>'account_server';
 if account.id is null or (p_plan->>'account_id' is not null and account.id::text<>p_plan->>'account_id') then raise exception 'account_changed'; end if;
 select * into execution from public.mt5_execution_orders where id=p_order;
 if execution.id is not null and (execution.status<>'executed'
  or execution.intent->>'account_login'<>p_plan->>'account_login' or execution.intent->>'account_server'<>p_plan->>'account_server'
  or coalesce(execution.result->>'position',execution.result->>'order')<>p_plan->>'position') then raise exception 'target_position_changed'; end if;
 insert into public.mt5_target_positions(id,account_id,account_login,account_server,position_ticket,execution_order_id)
 values(p_order,account.id,account.login,account.server,(p_plan->>'position')::bigint,execution.id)
 on conflict(account_login,account_server,position_ticket) do update
 set execution_order_id=coalesce(mt5_target_positions.execution_order_id,excluded.execution_order_id)
 returning * into subject;
 if subject.account_id<>account.id then raise exception 'account_changed'; end if;
 -- order_id bleibt für den installierten VPS-Worker ein opaker Schlüssel, auch für manuelle Positionen.
 p_order=subject.id;
 p_plan=jsonb_set(p_plan,'{order_id}',to_jsonb(subject.id));
 select * into saved from public.mt5_target_plans where order_id=p_order for update;
 if public.mt5_targets_guarded(account.login,account.server) then raise exception 'target_daily_stop'; end if;
 if saved.revision=p_revision then
  if saved.plan<>p_plan then raise exception 'target_revision_reused'; end if;
  return saved;
 end if;
 if saved.revision is distinct from p_expected then raise exception 'target_revision_changed'; end if;
 if saved.state in ('sending','unknown') or exists(select 1 from public.mt5_target_commands c join public.mt5_target_plans p on p.order_id=c.order_id where c.status in ('sending','unknown') and p.plan->>'account_login'=p_plan->>'account_login' and p.plan->>'account_server'=p_plan->>'account_server') then raise exception 'target_outcome_unresolved'; end if;
 if exists(select 1 from public.mt5_execution_orders where status in ('sending','unknown') and intent->>'account_login'=p_plan->>'account_login' and intent->>'account_server'=p_plan->>'account_server') then raise exception 'target_outcome_unresolved'; end if;
 insert into public.mt5_target_plans(order_id,revision,plan,checkpoint,state)
 values(p_order,p_revision,p_plan,p_checkpoint,'pending')
 on conflict(order_id) do update set revision=excluded.revision,plan=excluded.plan,checkpoint=excluded.checkpoint,state='pending',next_index=0,reason=null,updated_at=now()
 returning * into saved;
 return saved;
end;
$$;
