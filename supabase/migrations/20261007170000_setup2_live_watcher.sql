create table public.setup2_live_state (
 instrument text primary key check (instrument in ('GBPUSD','EURUSD','XAUUSD')),
 enabled boolean not null default false, lease_owner text, lease_until timestamptz,
 state jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table public.setup2_alarm_events (
 id text primary key, signal_at timestamptz not null, detected_at timestamptz not null default now(),
 instrument text not null, stage integer not null check(stage between 0 and 3), setup_key text,
 direction text, kind text not null check(kind in ('trading','problem')),
 payload jsonb not null default '{}'::jsonb, missed_reason text
);
create index setup2_alarm_events_time on public.setup2_alarm_events(signal_at desc);
create table public.setup2_notification_outbox (
 id bigint generated always as identity primary key,
 event_id text not null references public.setup2_alarm_events(id), channel text not null check(channel in ('pushover','telegram')),
 status text not null default 'pending' check(status in ('pending','claimed','accepted','failed','uncertain','suppressed')),
 attempts integer not null default 0, claim_until timestamptz, error text, provider_accepted_at timestamptz,
 unique(event_id,channel)
);
create table public.pushover_test_limits (
 id boolean primary key default true check(id), window_start timestamptz not null default now(),
 attempts integer not null default 0, last_test_at timestamptz,
 watch_checked_at timestamptz,provider_checked_at timestamptz,provider_error text
);
insert into public.pushover_test_limits(id) values(true);
insert into public.setup2_live_state(instrument) values('GBPUSD'),('EURUSD');
alter table public.setup2_live_state enable row level security;
alter table public.setup2_alarm_events enable row level security;
alter table public.setup2_notification_outbox enable row level security;
alter table public.pushover_test_limits enable row level security;
-- Browser bekommt Gesundheit nur durch die bereinigte, lesende Edge-Route; keine Lease-Daten.
revoke all on public.setup2_live_state,public.setup2_alarm_events,public.setup2_notification_outbox,public.pushover_test_limits from anon,authenticated;
grant select on public.setup2_alarm_events to anon,authenticated;
create policy setup2_event_read on public.setup2_alarm_events for select to anon,authenticated using(true);
grant all on public.setup2_live_state,public.setup2_alarm_events,public.setup2_notification_outbox,public.pushover_test_limits to service_role;
grant usage,select on sequence public.setup2_notification_outbox_id_seq to service_role;

create function public.setup2_acquire_lease(p_instrument text,p_owner text,p_seconds integer default 180)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update setup2_live_state set lease_owner=p_owner,lease_until=now()+make_interval(secs=>least(greatest(p_seconds,10),900))
 where instrument=p_instrument and enabled and (lease_until is null or lease_until<now() or lease_owner=p_owner);
 return found;
end $$;
create function public.setup2_checkpoint(p_instrument text,p_owner text,p_state jsonb,p_events jsonb default '[]')
returns void language plpgsql security definer set search_path=public as $$
declare e jsonb; inserted_id text;
begin
 update setup2_live_state set state=p_state,updated_at=now(),lease_until=null,lease_owner=null
 where instrument=p_instrument and lease_owner=p_owner and lease_until>now();
 if not found then raise exception 'Watcher lease expired'; end if;
 for e in select value from jsonb_array_elements(p_events) loop
  inserted_id:=null;
  insert into setup2_alarm_events(id,signal_at,instrument,stage,setup_key,direction,kind,payload,missed_reason)
  values(e->>'id',(e->>'signal_at')::timestamptz,p_instrument,(e->>'stage')::integer,e->>'setup_key',e->>'direction',e->>'kind',coalesce(e->'payload','{}'),e->>'missed_reason')
  on conflict(id) do nothing returning id into inserted_id;
  if inserted_id is not null then
   insert into setup2_notification_outbox(event_id,channel)
   values(inserted_id,case when e->>'missed_reason' is not null then 'telegram' else 'pushover' end);
  end if;
 end loop;
end $$;
create function public.pushover_reserve_test(p_valid boolean) returns boolean
language plpgsql security definer set search_path=public as $$
declare r pushover_test_limits; permitted boolean;
begin
 select * into r from pushover_test_limits where id=true for update;
 if now()-r.window_start>=interval '1 minute' then r.window_start:=now(); r.attempts:=0; end if;
 permitted:=r.attempts<5 and p_valid and (r.last_test_at is null or now()-r.last_test_at>=interval '1 minute');
 update pushover_test_limits set window_start=r.window_start,attempts=r.attempts+1,
 last_test_at=case when permitted then now() else r.last_test_at end where id=true;
 return permitted;
end $$;
create function public.setup2_claim_notifications(p_limit integer default 10)
returns setof public.setup2_notification_outbox language plpgsql security definer set search_path=public as $$
begin
 -- Ein Timeout kann bereits beim Provider angekommen sein. Nie blind nochmals senden.
 update setup2_notification_outbox set status='uncertain',error='Sender stopped after claiming delivery'
 where status='claimed' and claim_until<now();
 return query update setup2_notification_outbox set status='claimed',attempts=attempts+1,claim_until=now()+interval '2 minutes'
 where id in (select id from setup2_notification_outbox where status='pending' order by id for update skip locked limit least(p_limit,20)) returning *;
end $$;
create function public.setup2_record_problem(p_id text,p_instrument text,p_payload jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare inserted_id text;
begin
 insert into setup2_alarm_events(id,signal_at,instrument,stage,kind,payload)
 values(p_id,now(),p_instrument,0,'problem',p_payload) on conflict(id) do nothing returning id into inserted_id;
 if inserted_id is not null then insert into setup2_notification_outbox(event_id,channel) values(inserted_id,'pushover'); end if;
end $$;
revoke all on function public.setup2_acquire_lease(text,text,integer),public.setup2_checkpoint(text,text,jsonb,jsonb),public.pushover_reserve_test(boolean),public.setup2_claim_notifications(integer),public.setup2_record_problem(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.setup2_acquire_lease(text,text,integer),public.setup2_checkpoint(text,text,jsonb,jsonb),public.pushover_reserve_test(boolean),public.setup2_claim_notifications(integer),public.setup2_record_problem(text,text,jsonb) to service_role;

select cron.schedule('setup2-notification-watch','* * * * *',$job$
 select net.http_post(
 url := 'https://vkphwtqcvqrkphksproj.supabase.co/functions/v1/setup2-notification-watch',
 headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='setup2_watch_token' limit 1)),
 body := '{}'::jsonb,timeout_milliseconds := 55000
 );
$job$);
