-- Getrennte Zeitpunkte: ein frischer MT5-Kontostand bestätigt keine neue EOD-Trailing-Grenze.
create table public.mt5_account_balances (
 account_id uuid primary key references public.mt5_accounts(id),
 balance double precision, equity double precision, currency text,
 positions integer check(positions>=0), balance_at timestamptz, balance_source text,
 loss_floor double precision, target double precision,
 limits_at timestamptz, limits_source text,
 check(target is null or loss_floor is null or target>loss_floor)
);
alter table public.mt5_account_balances enable row level security;
revoke all on public.mt5_account_balances from anon,authenticated;
grant select,insert,update on public.mt5_account_balances to service_role;

create function public.mt5_remember_account_balance() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.snapshot->>'worker_error' is not null
  or jsonb_typeof(new.snapshot->'balance') is distinct from 'number'
  or jsonb_typeof(new.snapshot->'equity') is distinct from 'number' then return new; end if;
 insert into public.mt5_account_balances(account_id,balance,equity,currency,positions,balance_at,balance_source)
 select a.id,(new.snapshot->>'balance')::double precision,(new.snapshot->>'equity')::double precision,
  new.snapshot->>'currency',jsonb_array_length(new.snapshot->'positions'),new.heartbeat_at,'MT5-Worker'
 from public.mt5_accounts a
 where a.login::text=new.snapshot->>'account_login' and a.server=new.snapshot->>'account_server'
 on conflict(account_id) do update set balance=excluded.balance,equity=excluded.equity,currency=excluded.currency,
  positions=excluded.positions,balance_at=excluded.balance_at,balance_source=excluded.balance_source
 where mt5_account_balances.balance_at is null or excluded.balance_at>mt5_account_balances.balance_at;
 return new;
end $$;
revoke all on function public.mt5_remember_account_balance() from public,anon,authenticated;
create trigger mt5_remember_account_balance after insert or update on public.mt5_bridge_state
 for each row execute function public.mt5_remember_account_balance();
