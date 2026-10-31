-- Ein Tages-Latch ist ein Ereignis, keine aus dem aktuellen PnL rückgerechnete Ansicht.
create table public.mt5_daily_stops(
 account_id uuid references public.mt5_accounts(id) not null,
 day date not null,
 reason text not null check(reason in ('daily_loss','broker_drawdown')),
 snapshot jsonb not null,
 latched_at timestamptz not null default now(),
 primary key(account_id,day)
);
create table public.mt5_guard_commands(
 id uuid primary key default gen_random_uuid(),
 account_id uuid references public.mt5_accounts(id) not null,
 day date not null,
 kind text not null check(kind in ('close','cancel')),
 ticket bigint not null check(ticket>0),
 symbol text not null,
 checkpoint jsonb not null,
 attempt integer not null default 0 check(attempt>=0),
 expected_volume numeric not null check(expected_volume>=0),
 status text not null default 'pending' check(status in ('pending','sending','executed','rejected','unknown')),
 result jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(account_id,day) references public.mt5_daily_stops(account_id,day),
 unique(account_id,day,kind,ticket,expected_volume,attempt)
);
alter table public.mt5_daily_stops enable row level security;
alter table public.mt5_guard_commands enable row level security;
revoke all on public.mt5_daily_stops,public.mt5_guard_commands from anon,authenticated;
grant select,insert,update on public.mt5_daily_stops,public.mt5_guard_commands to service_role;

create function public.mt5_entry_guard_allowed(p_login bigint,p_server text) returns boolean
language sql security invoker set search_path=public as $$
 select not exists(select 1 from public.mt5_target_commands where status in ('sending','unknown'))
 and not exists(select 1 from public.mt5_accounts a join public.mt5_daily_stops s on s.account_id=a.id
  where a.login=p_login and a.server=p_server and s.day=(now() at time zone 'Europe/Berlin')::date)
 and not exists(select 1 from public.mt5_accounts a join public.mt5_guard_commands c on c.account_id=a.id
  where a.login=p_login and a.server=p_server and c.status in ('pending','sending','unknown'))
 and exists(select 1 from public.mt5_bridge_state b where b.id='primary'
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
create function public.mt5_guard_entry_trigger() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(29092026,1);
 if new.status in ('searching','sending') and not public.mt5_entry_guard_allowed((new.intent->>'account_login')::bigint,new.intent->>'account_server') then
  raise exception 'daily_stop_latched';
 end if;
 return new;
end;
$$;
create trigger mt5_guard_new_entries before insert or update of status on public.mt5_execution_orders
 for each row execute function public.mt5_guard_entry_trigger();

create function public.mt5_latch_daily_stop(p_account uuid,p_day date,p_reason text,p_snapshot jsonb)
returns void language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(29092026,1);
 if p_day<>(now() at time zone 'Europe/Berlin')::date then raise exception 'daily_day_changed';end if;
 if not exists(select 1 from public.mt5_execution_settings s join public.mt5_accounts a on s.active_account_id=a.id
  where s.id='primary' and a.id=p_account and a.login::text=p_snapshot->>'account_login' and a.server=p_snapshot->>'account_server') then raise exception 'account_mismatch';end if;
 insert into public.mt5_daily_stops(account_id,day,reason,snapshot) values(p_account,p_day,p_reason,p_snapshot) on conflict do nothing;
 update public.mt5_execution_orders o set status='cancelled',updated_at=now(),result=jsonb_build_object('reason','daily_stop_latched')
  from public.mt5_accounts a where a.id=p_account and o.intent->>'account_login'=a.login::text and o.intent->>'account_server'=a.server and o.status='searching';
end;
$$;
create function public.mt5_claim_guard(p_id uuid) returns setof public.mt5_guard_commands
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
  where c.id=p_id and c.status='pending' and exists(select 1 from public.mt5_execution_settings s
   join public.mt5_accounts a on a.id=s.active_account_id join public.mt5_bridge_state b on b.id='primary'
   where s.id='primary' and a.id=c.account_id and b.heartbeat_at>now()-interval '15 seconds'
   and b.snapshot->>'account_login'=a.login::text and b.snapshot->>'account_server'=a.server)
  returning c.*;
end;
$$;
revoke all on function public.mt5_entry_guard_allowed(bigint,text),public.mt5_guard_entry_trigger(),public.mt5_latch_daily_stop(uuid,date,text,jsonb),public.mt5_claim_guard(uuid) from public,anon,authenticated;
grant execute on function public.mt5_entry_guard_allowed(bigint,text),public.mt5_guard_entry_trigger(),public.mt5_latch_daily_stop(uuid,date,text,jsonb),public.mt5_claim_guard(uuid) to service_role;

create function public.mt5_guard_account_switch() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(29092026,1);
 if new.active_account_id is distinct from old.active_account_id and exists(select 1 from public.mt5_guard_commands
  where account_id=old.active_account_id and status in ('pending','sending','unknown')) then raise exception 'guard_commands_block_account_switch';end if;
 return new;
end;
$$;
create trigger mt5_guard_account_switch before update of active_account_id on public.mt5_execution_settings
 for each row execute function public.mt5_guard_account_switch();
revoke all on function public.mt5_guard_account_switch() from public,anon,authenticated;
grant execute on function public.mt5_guard_account_switch() to service_role;
