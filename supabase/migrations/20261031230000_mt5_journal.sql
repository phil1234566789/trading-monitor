-- Brokerdaten dürfen trotz der bisherigen öffentlichen Journal-Policies nicht anonym lesbar sein.
alter table public.trade_positions add column broker_private boolean not null default false;
alter table public.trade_positions add column account_currency text check(account_currency ~ '^[A-Z]{3,8}$');
create policy broker_position_private on public.trade_positions as restrictive for all to anon,authenticated
 using (not broker_private) with check (not broker_private);

create table public.mt5_journal_links (
 account_id uuid not null references public.mt5_accounts(id),
 account_server text not null,
 broker_position_id bigint not null check(broker_position_id>0),
 trade_position_id bigint not null unique references public.trade_positions(id) on delete restrict,
 created_at timestamptz not null default now(),
 primary key(account_id,account_server,broker_position_id)
);
create table public.trade_journal_comments (
 id uuid primary key,
 trade_position_id bigint not null references public.trade_positions(id) on delete cascade,
 kind text not null check(kind in ('statement','observation','hypothesis')),
 body text not null check(length(trim(body)) between 1 and 6000),
 source text not null check(length(trim(source)) between 1 and 300),
 occurred_at timestamptz not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index trade_journal_comments_position on public.trade_journal_comments(trade_position_id,created_at,id);
alter table public.mt5_journal_links enable row level security;
alter table public.trade_journal_comments enable row level security;
revoke all on public.mt5_journal_links,public.trade_journal_comments from public,anon,authenticated;
grant select,insert,update,delete on public.mt5_journal_links,public.trade_journal_comments to service_role;

create function public.import_mt5_journal(p_account uuid,p_server text,p_broker bigint,p_range bigint,
 p_symbol text,p_position jsonb,p_synced_at timestamptz,p_existing bigint default null,p_trading_account bigint default null)
 returns bigint language plpgsql set search_path=public as $$
declare existing_id bigint; target_id bigint; dr public.dealing_ranges; broker_mode text;
begin
 -- Der Schlüssel sperrt auch zwei gleichzeitige Erstimporte, bevor eine Link-Zeile existiert.
 perform pg_advisory_xact_lock(hashtextextended(p_account::text||':'||p_server||':'||p_broker::text,0));
 select mode into broker_mode from mt5_accounts where id=p_account and server=p_server;
 if not found then raise exception 'account_mismatch'; end if;
 -- Zwischen Lesen der Deals und Import darf kein anderer Historienabgleich begonnen haben.
 perform 1 from mt5_history_sync where account_id=p_account and not in_progress and last_error is null
  and last_full_at is not null and synced_at=p_synced_at for share;
 if not found then raise exception 'broker_history_changed'; end if;
 select trade_position_id into existing_id from mt5_journal_links
  where account_id=p_account and account_server=p_server and broker_position_id=p_broker;
 if found then
  if not exists(select 1 from trade_positions where id=existing_id and dealing_range_id=p_range)
   or (p_existing is not null and p_existing<>existing_id) then raise exception 'position_already_linked'; end if;
  return existing_id;
 end if;
 select * into dr from dealing_ranges where id=p_range for update;
 if not found or dr.instrument<>p_symbol or dr.direction<>p_position->>'direction' then raise exception 'range_mismatch'; end if;
 if p_existing is not null then
  perform 1 from trade_positions where id=p_existing and dealing_range_id=p_range for update;
  if not found then raise exception 'position_mismatch'; end if;
  target_id:=p_existing;
 else
  if exists(select 1 from trade_positions where dealing_range_id=p_range and not broker_private)
   then raise exception 'existing_position_required'; end if;
  insert into trade_positions(dealing_range_id,source,broker_private) values(p_range,case when broker_mode='live' then 'live' else 'paper' end,true) returning id into target_id;
 end if;
 update trade_positions set broker_private=true,
  source=case when broker_mode='live' then 'live' else 'paper' end,
  entry_price=(p_position->>'entry_price')::numeric,stop_loss=coalesce((p_position->>'stop_loss')::numeric,stop_loss),
  exit_price=(p_position->>'exit_price')::numeric,triggered_at=(p_position->>'triggered_at')::timestamptz,
  exit_time=(p_position->>'exit_time')::timestamptz,size=(p_position->>'size')::numeric,
  net_pl=(p_position->>'net_pl')::numeric,commission=(p_position->>'commission')::numeric,account_currency=p_position->>'account_currency',
  outcome=p_position->>'outcome',r_multiple=null,trading_account_id=coalesce(p_trading_account,trading_account_id) where id=target_id;
 insert into mt5_journal_links values(p_account,p_server,p_broker,target_id,now());
 return target_id;
end $$;
revoke all on function public.import_mt5_journal(uuid,text,bigint,bigint,text,jsonb,timestamptz,bigint,bigint) from public,anon,authenticated;
grant execute on function public.import_mt5_journal(uuid,text,bigint,bigint,text,jsonb,timestamptz,bigint,bigint) to service_role;
