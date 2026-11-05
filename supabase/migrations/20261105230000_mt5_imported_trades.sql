-- Geschlossene CSV-Tradezeilen sind keine nativen MT5-Deals und dürfen deren Tickets nicht erfinden.
create table public.mt5_imported_trades (
 id bigint generated always as identity primary key,
 account_id uuid not null references public.mt5_accounts(id),
 source_trade_id text not null check(length(source_trade_id) between 1 and 100),
 source_file text not null, source_hash text not null, imported_at timestamptz not null default now(),
 symbol text not null, currency text not null check(currency ~ '^[A-Z]{3,8}$'),
 opened_at bigint not null check(opened_at>0), closed_at bigint not null check(closed_at>=opened_at),
 entry double precision not null check(entry>0), exit double precision not null check(exit>0),
 direction text check(direction in ('long','short')),
 volume double precision not null check(volume>0),
 net double precision not null, commission double precision not null,
 source_row jsonb not null check(jsonb_typeof(source_row)='object'),
 unique(account_id,source_trade_id)
);
alter table public.mt5_imported_trades enable row level security;
revoke all on public.mt5_imported_trades from public,anon,authenticated;
grant select,insert,update on public.mt5_imported_trades to service_role;
grant usage,select on sequence public.mt5_imported_trades_id_seq to service_role;
