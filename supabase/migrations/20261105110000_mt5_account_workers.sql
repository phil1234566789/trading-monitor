-- Kontogebundene Worker behalten eigene Snapshots; primary bleibt für alte Clients lesbar.
alter table public.mt5_bridge_state drop constraint mt5_bridge_state_id_check;
alter table public.mt5_bridge_state add constraint mt5_bridge_state_id_check check(id='primary' or id ~ '^[0-9a-f-]{36}$');


create or replace function public.mt5_begin_send(order_id uuid)
returns setof public.mt5_execution_orders
language plpgsql security invoker set search_path = public as $$
declare candidate public.mt5_execution_orders;
begin
  perform pg_advisory_xact_lock(29092026, 1);
  select * into candidate from public.mt5_execution_orders where id=order_id;
  if exists (select 1 from public.mt5_execution_orders where status in ('sending','unknown') and intent->>'account_login'=candidate.intent->>'account_login' and intent->>'account_server'=candidate.intent->>'account_server') then
    return;
  end if;
  return query update public.mt5_execution_orders
    set status = 'sending', updated_at = now()
    where id = order_id and status = 'searching' and expires_at > now()
      and exists (select 1 from public.mt5_accounts a
        where not a.archived and a.login::text=intent->>'account_login' and a.server=intent->>'account_server')
      and exists (select 1 from public.mt5_bridge_state b where b.id=(select a.id::text from public.mt5_accounts a where a.login::text=intent->>'account_login' and a.server=intent->>'account_server')
        and b.heartbeat_at > now()-interval '15 seconds'
        and b.snapshot->>'account_login'=intent->>'account_login'
        and b.snapshot->>'account_server'=intent->>'account_server'
        and b.snapshot->>'trade_allowed'='true'
        and b.snapshot->>'execution_ready'='true'
        and (b.snapshot->'worker_error' is null or b.snapshot->'worker_error'='null'::jsonb))
    returning *;
end;
$$;

create or replace function public.mt5_enqueue_order(new_intent jsonb)
returns public.mt5_execution_orders language plpgsql security invoker set search_path=public as $$
declare inserted public.mt5_execution_orders;
begin
  perform pg_advisory_xact_lock(29092026, 1);
  if not exists (select 1 from public.mt5_accounts a
    where not a.archived and a.login::text=new_intent->>'account_login' and a.server=new_intent->>'account_server') then
    raise exception 'account_changed';
  end if;
  insert into public.mt5_execution_orders(id,intent,expires_at)
    values ((new_intent->>'id')::uuid,new_intent,to_timestamp((new_intent->>'expires_sec')::double precision))
    returning * into inserted;
  return inserted;
end;
$$;

create or replace function public.mt5_entry_guard_allowed(p_login bigint,p_server text) returns boolean
language sql security invoker set search_path=public as $$
 select not exists(select 1 from public.mt5_target_commands c join public.mt5_target_plans p on p.order_id=c.order_id where c.status in ('sending','unknown') and p.plan->>'account_login'=p_login::text and p.plan->>'account_server'=p_server)
 and not exists(select 1 from public.mt5_accounts a join public.mt5_daily_stops s on s.account_id=a.id
  where a.login=p_login and a.server=p_server and s.day=(now() at time zone 'Europe/Berlin')::date)
 and not exists(select 1 from public.mt5_accounts a join public.mt5_guard_commands c on c.account_id=a.id
  where a.login=p_login and a.server=p_server and c.status in ('pending','sending','unknown'))
 and exists(select 1 from public.mt5_bridge_state b where b.id=(select a.id::text from public.mt5_accounts a where a.login=p_login and a.server=p_server and not a.archived)
  and b.heartbeat_at>now()-interval '5 seconds'
  and b.snapshot->>'account_login'=p_login::text and b.snapshot->>'account_server'=p_server
  and b.snapshot->>'risk_guards_ready'='true' and b.snapshot->>'hedging'='true'
  and b.snapshot->>'currency'='USD' and b.snapshot->>'risk_error' is null
  and b.snapshot->'risk'->>'day'=to_char(now() at time zone 'Europe/Berlin','YYYY-MM-DD')
  and b.snapshot->'risk'->>'latched'='false'
  and (b.snapshot->'risk'->>'time')::double precision>=extract(epoch from now())-5
  and (b.snapshot->'risk'->>'time')::double precision<=extract(epoch from now())+1
  and (b.snapshot->'risk'->>'open_loss')::double precision<=0
  and (b.snapshot->'risk'->>'realized_net_day')::double precision+(b.snapshot->'risk'->>'open_loss')::double precision> -1000);
$$;

create or replace function public.mt5_latch_daily_stop(p_account uuid,p_day date,p_reason text,p_snapshot jsonb)
returns void language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(29092026,1);
 if p_day<>(now() at time zone 'Europe/Berlin')::date then raise exception 'daily_day_changed';end if;
 if not exists(select 1 from public.mt5_accounts a
  where not a.archived and a.id=p_account and a.login::text=p_snapshot->>'account_login' and a.server=p_snapshot->>'account_server') then raise exception 'account_mismatch';end if;
 insert into public.mt5_daily_stops(account_id,day,reason,snapshot) values(p_account,p_day,p_reason,p_snapshot) on conflict do nothing;
 update public.mt5_execution_orders o set status='cancelled',updated_at=now(),result=jsonb_build_object('reason','daily_stop_latched')
  from public.mt5_accounts a where a.id=p_account and o.intent->>'account_login'=a.login::text and o.intent->>'account_server'=a.server and o.status='searching';
end;
$$;

create or replace function public.mt5_claim_guard(p_id uuid) returns setof public.mt5_guard_commands
language plpgsql security invoker set search_path=public as $$
declare busy boolean; candidate public.mt5_guard_commands;
begin
 perform pg_advisory_xact_lock(29092026,1);
 select * into candidate from public.mt5_guard_commands where id=p_id and status='pending';
 if not found then return;end if;
 -- Unklarheit an Position A darf den Notfallabbau von Position B nicht blockieren.
 if exists(select 1 from public.mt5_guard_commands c where c.account_id=candidate.account_id and c.kind=candidate.kind
  and c.ticket=candidate.ticket and c.status in ('sending','unknown')) then return;end if;
 if candidate.kind='close' and exists(select 1 from public.mt5_execution_orders o join public.mt5_accounts a on a.id=candidate.account_id
  where o.status in ('sending','unknown') and o.intent->>'account_login'=a.login::text and o.intent->>'account_server'=a.server
   and coalesce(o.result->>'position',o.result->>'order')=candidate.ticket::text) then return;end if;
 if candidate.kind='close' and to_regclass('public.mt5_target_commands') is not null then
  execute 'select exists(select 1 from public.mt5_target_commands c join public.mt5_target_plans p on p.order_id=c.order_id
   join public.mt5_accounts a on a.id=$2 where c.status in (''sending'',''unknown'')
    and p.plan->>''position''=$1 and p.plan->>''account_login''=a.login::text and p.plan->>''account_server''=a.server)'
   into busy using candidate.ticket::text,candidate.account_id;
  if busy then return;end if;
 end if;
 return query update public.mt5_guard_commands c set status='sending',updated_at=now()
  where c.id=p_id and c.status='pending' and exists(select 1 from public.mt5_accounts a join public.mt5_bridge_state b on b.id=a.id::text
   where not a.archived and a.id=c.account_id and b.heartbeat_at>now()-interval '15 seconds'
   and b.snapshot->>'account_login'=a.login::text and b.snapshot->>'account_server'=a.server)
  returning c.*;
end;
$$;

create or replace function public.mt5_save_target_plan(p_order uuid,p_revision uuid,p_expected uuid,p_plan jsonb,p_checkpoint jsonb)
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
 if saved.state in ('sending','unknown') or exists(select 1 from public.mt5_target_commands c join public.mt5_target_plans p on p.order_id=c.order_id where c.status in ('sending','unknown') and p.plan->>'account_login'=p_plan->>'account_login' and p.plan->>'account_server'=p_plan->>'account_server') then raise exception 'target_outcome_unresolved'; end if;
 if exists(select 1 from public.mt5_execution_orders where status in ('sending','unknown') and intent->>'account_login'=p_plan->>'account_login' and intent->>'account_server'=p_plan->>'account_server') then raise exception 'target_outcome_unresolved'; end if;
 if not exists(select 1 from public.mt5_accounts a
  where not a.archived and a.login::text=p_plan->>'account_login' and a.server=p_plan->>'account_server') then raise exception 'account_changed'; end if;
 insert into public.mt5_target_plans(order_id,revision,plan,checkpoint,state)
 values(p_order,p_revision,p_plan,p_checkpoint,'pending')
 on conflict(order_id) do update set revision=excluded.revision,plan=excluded.plan,checkpoint=excluded.checkpoint,state='pending',next_index=0,reason=null,updated_at=now()
 returning * into saved;
 return saved;
end;
$$;

create or replace function public.mt5_claim_target(p_order uuid,p_revision uuid,p_id uuid,p_kind text,p_index integer)
returns boolean language plpgsql security invoker set search_path=public as $$
declare saved public.mt5_target_plans;
begin
 perform pg_advisory_xact_lock(29092026,1);
 select * into saved from public.mt5_target_plans where order_id=p_order for update;
 if public.mt5_targets_guarded((saved.plan->>'account_login')::bigint,saved.plan->>'account_server') then return false; end if;
 if saved.revision is distinct from p_revision or
  not ((p_kind='install' and saved.state='pending' and p_index=-1) or (p_kind='close' and saved.state='active' and saved.next_index=p_index and p_index<jsonb_array_length(saved.plan->'targets') and (saved.plan->>'native_tp')::numeric=0)) then return false; end if;
 if exists(select 1 from public.mt5_execution_orders where status in ('sending','unknown') and intent->>'account_login'=saved.plan->>'account_login' and intent->>'account_server'=saved.plan->>'account_server') or
  exists(select 1 from public.mt5_target_commands c join public.mt5_target_plans p on p.order_id=c.order_id where c.status in ('sending','unknown') and p.plan->>'account_login'=saved.plan->>'account_login' and p.plan->>'account_server'=saved.plan->>'account_server') then return false; end if;
 if not exists(select 1 from public.mt5_accounts a
  where not a.archived and a.login::text=saved.plan->>'account_login' and a.server=saved.plan->>'account_server') then return false; end if;
 insert into public.mt5_target_commands(id,order_id,revision,kind,target_index,status) values(p_id,p_order,p_revision,p_kind,p_index,'sending');
 update public.mt5_target_plans set state='sending',updated_at=now(),reason=null where order_id=p_order;
 return true;
end;
$$;

create or replace function public.mt5_targets_guarded(p_login bigint,p_server text)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
 if to_regclass('public.mt5_guard_commands') is not null then
  if exists(select 1 from public.mt5_guard_commands c join public.mt5_accounts a on a.id=c.account_id where c.status in ('sending','unknown') and a.login=p_login and a.server=p_server) then return true; end if;
 end if;
 if to_regclass('public.mt5_daily_stops') is not null then
  if exists(select 1 from public.mt5_daily_stops d join public.mt5_accounts a on a.id=d.account_id
    where a.login=p_login and a.server=p_server and d.day=timezone('Europe/Berlin',now())::date) then return true; end if;
 end if;
 return false;
end;
$$;
-- Eine fehlende Versandantwort darf nicht zu einer neuen, doppelt handelbaren ID führen.
create or replace function public.mt5_abandon_order(new_intent jsonb)
returns public.mt5_execution_orders language plpgsql security invoker set search_path=public as $$
declare saved public.mt5_execution_orders;
begin
 perform pg_advisory_xact_lock(29092026,1);
 insert into public.mt5_execution_orders(id,intent,expires_at,status,result)
 values((new_intent->>'id')::uuid,new_intent,to_timestamp((new_intent->>'expires_sec')::double precision),'cancelled','{"reason":"unconfirmed_dispatch_abandoned"}'::jsonb)
 on conflict(id) do nothing;
 update public.mt5_execution_orders set status='cancelled',updated_at=now()
 where id=(new_intent->>'id')::uuid and status='searching'
 and intent->>'account_login'=new_intent->>'account_login' and intent->>'account_server'=new_intent->>'account_server';
 select * into saved from public.mt5_execution_orders where id=(new_intent->>'id')::uuid;
 return saved;
end $$;
revoke all on function public.mt5_abandon_order(jsonb) from public,anon,authenticated;
grant execute on function public.mt5_abandon_order(jsonb) to service_role;
