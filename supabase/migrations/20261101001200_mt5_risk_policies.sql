-- Keine geratenen Challenge-Limits: dynamisches Sizing braucht eine bestätigte Tageskonfiguration.
create table public.mt5_risk_policies (
 account_id uuid primary key references public.mt5_accounts(id),
 revision uuid not null,
 day date not null,
 confirmed_balance double precision not null check(confirmed_balance>0),
 confirmed_equity double precision not null check(confirmed_equity>0),
 risk_base double precision not null check(risk_base>0),
 drawdown_floor double precision not null check(drawdown_floor>0),
 cost_buffer double precision not null check(cost_buffer>0),
 currency text not null check(currency='USD'),
 valid_until_sec bigint not null,
 source text not null check(length(source) between 1 and 500),
 confirmed_at timestamptz not null default now()
);
alter table public.mt5_risk_policies enable row level security;
revoke all on public.mt5_risk_policies from public,anon,authenticated;
grant select,insert,update on public.mt5_risk_policies to service_role;
