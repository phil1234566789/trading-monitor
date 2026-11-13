-- Vollständige Positionen werden beim Import berechnet, nicht bei jedem Wochenwechsel.
create index if not exists mt5_deals_account_position on public.mt5_broker_deals(account_id,position_id);
create table public.mt5_statistics_positions (
 account_id uuid not null references public.mt5_accounts(id), position_id bigint not null,
 status text not null check(status in ('closed','open','excluded')),
 id text not null, symbol text, currency text, direction text, volume double precision,
 opened_at bigint, closed_at bigint, entry double precision, exit double precision,
 commission double precision not null default 0, net double precision not null default 0,commission_known boolean not null default false,
 entry_week date, close_day date, entry_hour integer, entry_weekday integer, outcome text,
 primary key(account_id,position_id)
);
alter table public.mt5_statistics_positions enable row level security;
revoke all on public.mt5_statistics_positions from public,anon,authenticated;
grant select on public.mt5_statistics_positions to service_role;
create index mt5_statistics_account_week on public.mt5_statistics_positions(account_id,entry_week,opened_at desc,id desc) where status='closed';
create index mt5_imported_statistics_account_week on public.mt5_imported_trades(account_id,
 (date_trunc('week',to_timestamp(opened_at/1000.0) at time zone 'Europe/Berlin')::date),opened_at desc,source_trade_id desc);
create table public.mt5_statistics_unallocated (
 account_id uuid not null references public.mt5_accounts(id),position_id bigint not null,currency text not null,amount double precision not null,
 primary key(account_id,position_id,currency)
);
alter table public.mt5_statistics_unallocated enable row level security;
revoke all on public.mt5_statistics_unallocated from public,anon,authenticated;
grant select on public.mt5_statistics_unallocated to service_role;

create function public.mt5_rebuild_statistics_position(p_account uuid,p_position bigint)
returns void language plpgsql security definer set search_path=public as $$
declare r record; costs record; first_deal record; s text; vol double precision; closed double precision;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_account::text||':'||p_position::text,0));
 delete from mt5_statistics_unallocated where account_id=p_account and position_id=p_position;
 select * into first_deal from mt5_broker_deals where account_id=p_account and position_id=p_position
  and type in(0,1) order by time_msc,ticket limit 1;
 if not found or p_position=0 then
  insert into mt5_statistics_unallocated(account_id,position_id,currency,amount)
   select account_id,position_id,currency,sum(profit+commission+swap+fee) from mt5_broker_deals
   where account_id=p_account and position_id=p_position and type in(4,7,8,9,10,11,12,15,16,17) group by account_id,position_id,currency;
  delete from mt5_statistics_positions where account_id=p_account and position_id=p_position;return;
 end if;
 select count(*) filter(where entry=0) ins,
  coalesce(sum(volume) filter(where entry=0),0) volume,
  coalesce(sum(volume) filter(where entry in(1,3)),0) closed,
  min(time_msc) filter(where entry=0) opened_at,max(time_msc) filter(where entry in(1,3)) closed_at,
  sum(price*volume) filter(where entry=0) entry_value,sum(price*volume) filter(where entry in(1,3)) exit_value,
  bool_or(entry=2 or (entry=0 and (type<>first_deal.type or symbol<>first_deal.symbol or currency<>first_deal.currency))
   or (entry in(1,3) and (type=first_deal.type or symbol<>first_deal.symbol or currency<>first_deal.currency))) invalid,
  sum(profit+commission+swap+fee) net,sum(commission) commission,
  bool_and(currency=first_deal.currency and symbol=first_deal.symbol) commission_known
 into r from mt5_broker_deals where account_id=p_account and position_id=p_position and type in(0,1);
 select coalesce(sum(profit+commission+swap+fee),0) net,
  coalesce(sum(commission+case when type in(7,8,9,10,11) then profit else 0 end),0) commission,
  coalesce(bool_or(currency<>first_deal.currency),false) invalid
 into costs from mt5_broker_deals where account_id=p_account and position_id=p_position and type in(4,7,8,9,10,11,12,15,16,17);
 vol:=r.volume;closed:=r.closed;
 s:=case when r.ins=0 or first_deal.entry<>0 or r.invalid then 'excluded'
  when closed<vol-1e-8 then 'open' when abs(vol-closed)>1e-8 or costs.invalid then 'excluded' else 'closed' end;
 insert into mt5_statistics_positions(account_id,position_id,status,id,symbol,currency,direction,volume,opened_at,closed_at,entry,exit,commission,net,commission_known,entry_week,close_day,entry_hour,entry_weekday,outcome)
 values(p_account,p_position,s,p_account::text||':'||p_position::text,first_deal.symbol,first_deal.currency,
  case when first_deal.type=0 then 'long' else 'short' end,vol,r.opened_at,r.closed_at,
  r.entry_value/nullif(vol,0),r.exit_value/nullif(closed,0),r.commission+costs.commission,r.net+costs.net,r.ins>0 and r.commission_known and not costs.invalid,
  date_trunc('week',to_timestamp(r.opened_at/1000.0) at time zone 'Europe/Berlin')::date,
  (to_timestamp(r.closed_at/1000.0) at time zone 'Europe/Berlin')::date,
  extract(hour from to_timestamp(r.opened_at/1000.0) at time zone 'Europe/Berlin')::integer,
  extract(isodow from to_timestamp(r.opened_at/1000.0) at time zone 'Europe/Berlin')::integer,
  case when floor(((r.net+costs.net)-(r.commission+costs.commission))*100+0.5)>1000 then 'win'
   when floor(((r.net+costs.net)-(r.commission+costs.commission))*100+0.5)< -1000 then 'loss' else 'breakeven' end)
 on conflict(account_id,position_id) do update set
  status=excluded.status,symbol=excluded.symbol,currency=excluded.currency,direction=excluded.direction,volume=excluded.volume,
  opened_at=excluded.opened_at,closed_at=excluded.closed_at,entry=excluded.entry,exit=excluded.exit,
  commission=excluded.commission,net=excluded.net,commission_known=excluded.commission_known,entry_week=excluded.entry_week,close_day=excluded.close_day,
  entry_hour=excluded.entry_hour,entry_weekday=excluded.entry_weekday,outcome=excluded.outcome;
end $$;

create function public.mt5_update_statistics_positions()
returns trigger language plpgsql security definer set search_path=public as $$
declare r record;
begin
 -- Ein Batch kann mehrere Deals derselben Position enthalten: nur einmal neu berechnen.
 if tg_op='UPDATE' then
  for r in select account_id,position_id from(select account_id,position_id from changed_deals union select account_id,position_id from previous_deals) affected order by account_id,position_id loop
   perform mt5_rebuild_statistics_position(r.account_id,r.position_id);
  end loop;
  return null;
 end if;
 for r in select distinct account_id,position_id from changed_deals order by account_id,position_id loop
  perform mt5_rebuild_statistics_position(r.account_id,r.position_id);
 end loop;
 return null;
end $$;
create trigger mt5_statistics_insert after insert on public.mt5_broker_deals referencing new table as changed_deals for each statement execute function public.mt5_update_statistics_positions();
create trigger mt5_statistics_update after update on public.mt5_broker_deals referencing old table as previous_deals new table as changed_deals for each statement execute function public.mt5_update_statistics_positions();
create trigger mt5_statistics_delete after delete on public.mt5_broker_deals referencing old table as changed_deals for each statement execute function public.mt5_update_statistics_positions();
do $$ declare r record;begin
 for r in select distinct account_id,position_id from public.mt5_broker_deals order by account_id,position_id loop
  perform public.mt5_rebuild_statistics_position(r.account_id,r.position_id);
 end loop;
end $$;

-- CSV-Netto bleibt unverändert; native Tickets und CSV-IDs teilen keinen Namensraum.
create view public.mt5_statistics_closed as
 select id,account_id,position_id,symbol,currency,direction,volume,opened_at,closed_at,entry,exit,commission,net,
  entry_week,close_day,entry_hour,entry_weekday,outcome,'broker'::text source,null::text source_trade_id,null::text source_file
 from public.mt5_statistics_positions where status='closed'
 union all
 select 'csv:'||account_id::text||':'||source_trade_id,account_id,null::bigint,symbol,currency,direction,volume,opened_at,closed_at,entry,exit,commission,net,
  date_trunc('week',to_timestamp(opened_at/1000.0) at time zone 'Europe/Berlin')::date,
  (to_timestamp(closed_at/1000.0) at time zone 'Europe/Berlin')::date,
  extract(hour from to_timestamp(opened_at/1000.0) at time zone 'Europe/Berlin')::integer,
  extract(isodow from to_timestamp(opened_at/1000.0) at time zone 'Europe/Berlin')::integer,
  case when floor((net-commission)*100+0.5)>1000 then 'win' when floor((net-commission)*100+0.5)< -1000 then 'loss' else 'breakeven' end,
  'csv',source_trade_id,source_file from public.mt5_imported_trades;
revoke all on public.mt5_statistics_closed from public,anon,authenticated;
grant select on public.mt5_statistics_closed to service_role;

-- Ohne SET-Konfiguration kann PostgreSQL den Wochenfilter bis zu beiden Quellindizes durchreichen.
create function public.mt5_statistics_filtered(p_account_ids uuid[],p_asset text,p_currency text,p_from date,p_to date,p_outcomes text[])
returns setof public.mt5_statistics_closed language sql stable as $$
 select * from public.mt5_statistics_closed where account_id=any(p_account_ids)
 and (p_asset='' or symbol=p_asset) and (p_currency='' or currency=p_currency)
 and (p_from is null or close_day>=p_from) and (p_to is null or close_day<=p_to) and outcome=any(p_outcomes)
$$;
create function public.mt5_statistics_metrics(n bigint,pnl double precision,cost double precision,w bigint,l bigint,b bigint)
returns jsonb language sql immutable as $$
 select jsonb_build_object('count',n,'net',coalesce(pnl,0),'commission',coalesce(cost,0),'wins',w,'losses',l,'breakeven',b,
 'average',pnl/nullif(n,0),'winrate',100.0*w/nullif(w+l,0))
$$;

create function public.mt5_statistics_summary(p_account_ids uuid[],p_asset text default '',p_currency text default 'USD',p_from date default null,p_to date default null,p_outcomes text[] default array['win','loss','breakeven'],p_extreme_limit integer default 5,p_commission_positions jsonb default '[]')
returns jsonb language sql stable security definer set search_path=public as $$
 with f as materialized(select * from mt5_statistics_filtered(p_account_ids,p_asset,p_currency,p_from,p_to,p_outcomes)),
 totals as(select mt5_statistics_metrics(count(*),sum(net),sum(commission),count(*) filter(where outcome='win'),count(*) filter(where outcome='loss'),count(*) filter(where outcome='breakeven')) value from f),
 week_counts as(select entry_week,count(*) count from f group by entry_week),
 weeks as(select d::date key,d::date start,(d+interval '6 days')::date "end",extract(isoyear from d)::int "year",extract(week from d)::int number,coalesce(w.count,0) count
  from generate_series((select min(entry_week) from f),(select max(entry_week) from f),interval '1 week') d left join week_counts w on w.entry_week=d::date order by d desc),
 groups as(select dim,label,ord,mt5_statistics_metrics(count(*),sum(net),sum(commission),count(*) filter(where outcome='win'),count(*) filter(where outcome='loss'),count(*) filter(where outcome='breakeven')) metrics
  from f cross join lateral(values('asset',symbol,0),('hour',lpad(entry_hour::text,2,'0')||':00–'||lpad(entry_hour::text,2,'0')||':59',entry_hour),('weekday',(array['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'])[entry_weekday],entry_weekday)) dimensions(dim,label,ord)
  group by dim,label,ord),
 account_trades as(select account_id,currency,mt5_statistics_metrics(count(*),sum(net),sum(commission),count(*) filter(where outcome='win'),count(*) filter(where outcome='loss'),count(*) filter(where outcome='breakeven')) metrics from mt5_statistics_closed group by account_id,currency),
 account_costs as(select account_id,currency,sum(amount) amount from mt5_statistics_unallocated group by account_id,currency),
 account_totals as(select coalesce(t.account_id,c.account_id) account_id,coalesce(t.currency,c.currency) currency,
  coalesce(t.metrics,mt5_statistics_metrics(0,0,0,0,0,0))||jsonb_build_object('net',coalesce((t.metrics->>'net')::double precision,0)+coalesce(c.amount,0)) metrics
  from account_trades t full join account_costs c using(account_id,currency)),
 coverage as(select account_id from mt5_history_sync where last_full_at is not null union select account_id from mt5_imported_trades),
 fees as(select coalesce(sum(amount),0) value from mt5_statistics_unallocated where account_id=any(p_account_ids) and (p_currency='' or currency=p_currency))
 select jsonb_build_object('totals',(select value from totals),'weeks',coalesce((select jsonb_agg(to_jsonb(weeks)) from weeks),'[]'::jsonb),
 'groups',coalesce((select jsonb_object_agg(dim,rows) from(select dim,jsonb_agg(metrics||jsonb_build_object('label',label) order by case when dim='asset' then -(metrics->>'average')::double precision else ord end,case when dim='asset' then -(metrics->>'count')::bigint else 0 end,label) rows from groups group by dim) g),'{}'::jsonb),
 'extremes',jsonb_build_object('winners',coalesce((select jsonb_agg(to_jsonb(t)) from(select * from f where outcome='win' order by net desc,opened_at desc,id limit greatest(1,least(100,p_extreme_limit))) t),'[]'::jsonb),
 'losers',coalesce((select jsonb_agg(to_jsonb(t)) from(select * from f where outcome='loss' order by net,opened_at desc,id limit greatest(1,least(100,p_extreme_limit))) t),'[]'::jsonb)),
 'assets',coalesce((select jsonb_agg(symbol order by symbol) from(select distinct symbol from mt5_statistics_closed) a),'[]'::jsonb),
 'coverage',coalesce((select jsonb_agg(account_id) from coverage),'[]'::jsonb),
 'sync',coalesce((select jsonb_agg(to_jsonb(s)) from mt5_history_sync s),'[]'::jsonb),
 'latest',greatest((select max(synced_at) from mt5_history_sync where account_id=any(p_account_ids)),(select max(imported_at) from mt5_imported_trades where account_id=any(p_account_ids))),
 'account_totals',coalesce((select jsonb_agg(metrics||jsonb_build_object('account_id',account_id,'currency',currency)) from account_totals),'[]'::jsonb),
 'position_commissions',coalesce((select jsonb_agg(jsonb_build_object('account_id',s.account_id,'position_id',s.position_id,'commission',s.commission)) from mt5_statistics_positions s where commission_known and (status='open' or exists(select 1 from jsonb_to_recordset(p_commission_positions) as requested(account_id uuid,position_id bigint) where requested.account_id=s.account_id and requested.position_id=s.position_id))),'[]'::jsonb),
 'excluded',(select count(*) from mt5_statistics_positions where account_id=any(p_account_ids) and status='excluded'),'fees',(select value from fees))
$$;

create function public.mt5_statistics_page(p_account_ids uuid[],p_asset text default '',p_currency text default 'USD',p_from date default null,p_to date default null,p_outcomes text[] default array['win','loss','breakeven'],p_week date default null,p_offset integer default 0,p_limit integer default 100)
returns jsonb language sql stable security definer set search_path=public as $$
 with f as materialized(select * from mt5_statistics_filtered(p_account_ids,p_asset,p_currency,p_from,p_to,p_outcomes) where entry_week=p_week),
 page as(select * from f order by opened_at desc,id desc limit greatest(1,least(100,p_limit)) offset greatest(0,p_offset))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page) order by opened_at desc,id desc) from page),'[]'::jsonb),'total',(select count(*) from f),
 'next_offset',case when greatest(0,p_offset)+(select count(*) from page)<(select count(*) from f) then greatest(0,p_offset)+(select count(*) from page) else null end)
$$;
create function public.mt5_statistics_series(p_account_ids uuid[],p_asset text default '',p_currency text default 'USD',p_from date default null,p_to date default null,p_outcomes text[] default array['win','loss','breakeven'],p_offset integer default 0,p_limit integer default 500)
returns jsonb language sql stable security definer set search_path=public as $$
 with f as materialized(select id,opened_at,closed_at,net,commission from mt5_statistics_filtered(p_account_ids,p_asset,p_currency,p_from,p_to,p_outcomes)),
 page as(select * from f order by closed_at,id limit greatest(1,least(500,p_limit)) offset greatest(0,p_offset))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page) order by closed_at,id) from page),'[]'::jsonb),
 'next_offset',case when greatest(0,p_offset)+(select count(*) from page)<(select count(*) from f) then greatest(0,p_offset)+(select count(*) from page) else null end)
$$;
revoke all on function public.mt5_rebuild_statistics_position(uuid,bigint),public.mt5_update_statistics_positions(),public.mt5_statistics_filtered(uuid[],text,text,date,date,text[]),public.mt5_statistics_metrics(bigint,double precision,double precision,bigint,bigint,bigint),public.mt5_statistics_summary(uuid[],text,text,date,date,text[],integer,jsonb),public.mt5_statistics_page(uuid[],text,text,date,date,text[],date,integer,integer),public.mt5_statistics_series(uuid[],text,text,date,date,text[],integer,integer) from public,anon,authenticated;
grant execute on function public.mt5_statistics_summary(uuid[],text,text,date,date,text[],integer,jsonb),public.mt5_statistics_page(uuid[],text,text,date,date,text[],date,integer,integer),public.mt5_statistics_series(uuid[],text,text,date,date,text[],integer,integer) to service_role;
