-- Brokerhistorie bleibt hinter dem privaten MMT-Zugriff; niemals über den öffentlichen Journal-Key.
alter table public.mt5_accounts add column archived boolean not null default false;
create table public.mt5_broker_deals (
 id bigint generated always as identity primary key,
 account_id uuid not null references public.mt5_accounts(id),
 ticket bigint not null check(ticket>0), position_id bigint not null check(position_id>=0),
 time_msc bigint not null check(time_msc>0), type integer not null, entry integer not null,
 symbol text not null check(length(symbol)<=64), volume double precision not null check(volume>=0),
 price double precision not null check(price>=0), profit double precision not null,
 commission double precision not null, swap double precision not null, fee double precision not null,
 currency text not null check(currency ~ '^[A-Z]{3,8}$'),
 unique(account_id,ticket)
);
create index mt5_deals_account_time on public.mt5_broker_deals(account_id,time_msc);
create table public.mt5_history_sync (
 account_id uuid primary key references public.mt5_accounts(id),
 complete_until_sec bigint, last_full_at timestamptz, synced_at timestamptz,
 last_error text, currency text, in_progress boolean not null default false
);
alter table public.mt5_broker_deals enable row level security;
alter table public.mt5_history_sync enable row level security;
revoke all on public.mt5_broker_deals,public.mt5_history_sync from public,anon,authenticated;
grant select,insert,update on public.mt5_broker_deals,public.mt5_history_sync to service_role;
grant usage,select on sequence public.mt5_broker_deals_id_seq to service_role;
