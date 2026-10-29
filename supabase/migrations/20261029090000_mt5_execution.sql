-- Broker-Aufträge sind strikt privat: der bestehende öffentliche Anon-Key darf niemals handeln.
create table public.mt5_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 100),
  login bigint not null check (login > 0),
  server text not null check (length(server) between 1 and 100),
  mode text not null check (mode in ('demo','live')),
  credentials jsonb not null,
  created_at timestamptz not null default now(),
  unique(login,server)
);
create table public.mt5_execution_settings (
  id text primary key check (id = 'primary'),
  active_account_id uuid references public.mt5_accounts(id)
);
insert into public.mt5_execution_settings(id) values ('primary');
alter table public.mt5_accounts enable row level security;
alter table public.mt5_execution_settings enable row level security;
revoke all on public.mt5_accounts, public.mt5_execution_settings from anon, authenticated;
grant select, insert, update on public.mt5_accounts, public.mt5_execution_settings to service_role;
create table public.mt5_bridge_state (
  id text primary key check (id = 'primary'),
  snapshot jsonb not null,
  heartbeat_at timestamptz not null default now()
);
create table public.mt5_execution_orders (
  id uuid primary key,
  intent jsonb not null,
  status text not null default 'searching' check (status in
    ('searching','sending','executed','rejected','unknown','cancelled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  result jsonb,
  check (jsonb_typeof(intent) = 'object'),
  check ((intent->>'id')::uuid = id),
  check (expires_at > created_at and expires_at <= created_at + interval '1 hour')
);
create index mt5_execution_orders_active on public.mt5_execution_orders (status, created_at);
alter table public.mt5_bridge_state enable row level security;
alter table public.mt5_execution_orders enable row level security;
revoke all on public.mt5_bridge_state, public.mt5_execution_orders from anon, authenticated;
grant select, insert, update on public.mt5_bridge_state, public.mt5_execution_orders to service_role;
grant delete on public.mt5_bridge_state to service_role;

-- Ein atomares Versandrecht statt Lease-Retry: unklarer Ausgang blockiert weitere Tests.
create function public.mt5_begin_send(order_id uuid)
returns setof public.mt5_execution_orders
language plpgsql security invoker set search_path = public as $$
begin
  perform pg_advisory_xact_lock(29092026, 1);
  if exists (select 1 from public.mt5_execution_orders where status in ('sending','unknown')) then
    return;
  end if;
  return query update public.mt5_execution_orders
    set status = 'sending', updated_at = now()
    where id = order_id and status = 'searching' and expires_at > now()
      and exists (select 1 from public.mt5_execution_settings s join public.mt5_accounts a on a.id=s.active_account_id
        where s.id='primary' and a.login::text=intent->>'account_login' and a.server=intent->>'account_server')
      and exists (select 1 from public.mt5_bridge_state b where b.id='primary'
        and b.heartbeat_at > now()-interval '15 seconds'
        and b.snapshot->>'account_login'=intent->>'account_login'
        and b.snapshot->>'account_server'=intent->>'account_server'
        and b.snapshot->>'trade_allowed'='true')
    returning *;
end;
$$;
revoke all on function public.mt5_begin_send(uuid) from public, anon, authenticated;
grant execute on function public.mt5_begin_send(uuid) to service_role;

create function public.mt5_select_test_account(account_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  perform pg_advisory_xact_lock(29092026, 1);
  if exists (select 1 from public.mt5_execution_orders where status in ('searching','sending','unknown')) then
    raise exception 'active_orders_block_account_switch';
  end if;
  if account_id is not null and not exists(select 1 from public.mt5_accounts where id=account_id) then
    raise exception 'account_not_found';
  end if;
  update public.mt5_execution_settings set active_account_id=account_id where id='primary';
  delete from public.mt5_bridge_state where id='primary';
end;
$$;
revoke all on function public.mt5_select_test_account(uuid) from public, anon, authenticated;
grant execute on function public.mt5_select_test_account(uuid) to service_role;

create function public.mt5_enqueue_order(new_intent jsonb)
returns public.mt5_execution_orders language plpgsql security invoker set search_path=public as $$
declare inserted public.mt5_execution_orders;
begin
  perform pg_advisory_xact_lock(29092026, 1);
  if not exists (select 1 from public.mt5_execution_settings s join public.mt5_accounts a on a.id=s.active_account_id
    where s.id='primary' and a.login::text=new_intent->>'account_login' and a.server=new_intent->>'account_server') then
    raise exception 'account_changed';
  end if;
  insert into public.mt5_execution_orders(id,intent,expires_at)
    values ((new_intent->>'id')::uuid,new_intent,to_timestamp((new_intent->>'expires_sec')::double precision))
    returning * into inserted;
  return inserted;
end;
$$;
revoke all on function public.mt5_enqueue_order(jsonb) from public,anon,authenticated;
grant execute on function public.mt5_enqueue_order(jsonb) to service_role;
