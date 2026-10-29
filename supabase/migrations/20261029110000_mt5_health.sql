-- Fehleralarme bleiben privat und getrennt von Broker-Auftraegen.
alter table public.mt5_execution_settings add column health_checked_at timestamptz;
create table public.mt5_health_incidents (
 id uuid primary key default gen_random_uuid(),
 issue_key text not null check(length(issue_key)<=300),
 code text not null check(length(code)<=80), detail jsonb not null default '{}',
 opened_at timestamptz not null default now(),resolved_at timestamptz
);
create unique index mt5_one_active_incident on public.mt5_health_incidents((true)) where resolved_at is null;
create table public.mt5_health_deliveries (
 id uuid primary key default gen_random_uuid(),incident_id uuid not null references public.mt5_health_incidents(id),
 channel text not null check(channel in ('pushover','telegram')),
 status text not null default 'pending' check(status in ('pending','claimed','accepted','failed','uncertain')),
 attempts integer not null default 0,last_attempt_at timestamptz,accepted_at timestamptz,error text,
 unique(incident_id,channel)
);
alter table public.mt5_health_incidents enable row level security;
alter table public.mt5_health_deliveries enable row level security;
revoke all on public.mt5_health_incidents,public.mt5_health_deliveries from anon,authenticated;
grant select,insert,update on public.mt5_health_incidents,public.mt5_health_deliveries to service_role;

create function public.mt5_record_health(p_key text,p_code text,p_detail jsonb)
returns public.mt5_health_incidents language plpgsql security invoker set search_path=public as $$
declare current_issue public.mt5_health_incidents;
begin
 perform pg_advisory_xact_lock(29092026,2);
 select * into current_issue from mt5_health_incidents where resolved_at is null;
 if p_key is null then
  update mt5_health_incidents set resolved_at=now() where resolved_at is null;
  return null;
 end if;
 if current_issue.id is not null and current_issue.issue_key=p_key then return current_issue;end if;
 update mt5_health_incidents set resolved_at=now() where resolved_at is null;
 insert into mt5_health_incidents(issue_key,code,detail) values(p_key,p_code,p_detail) returning * into current_issue;
 insert into mt5_health_deliveries(incident_id,channel) values(current_issue.id,'pushover'),(current_issue.id,'telegram');
 return current_issue;
end $$;
create function public.mt5_claim_health_notifications(p_limit integer default 4)
returns setof public.mt5_health_deliveries language plpgsql security invoker set search_path=public as $$
begin
 -- Providerannahme nach Prozessabbruch ist unklar: nie blind erneut senden.
 update mt5_health_deliveries set status='uncertain',error='delivery_interrupted'
 where status='claimed' and last_attempt_at<now()-interval '2 minutes';
 return query update mt5_health_deliveries set status='claimed',last_attempt_at=now(),attempts=attempts+1
 where id in (select d.id from mt5_health_deliveries d
  where d.status='pending' or d.status='failed' and d.attempts<3 and d.last_attempt_at<now()-interval '1 minute'
  order by d.last_attempt_at nulls first for update skip locked limit least(greatest(p_limit,1),10)) returning *;
end $$;
revoke all on function public.mt5_record_health(text,text,jsonb),public.mt5_claim_health_notifications(integer) from public,anon,authenticated;
grant execute on function public.mt5_record_health(text,text,jsonb),public.mt5_claim_health_notifications(integer) to service_role;

create or replace function public.mt5_begin_send(order_id uuid)
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
        and b.snapshot->>'trade_allowed'='true'
        and b.snapshot->>'execution_ready'='true'
        and (b.snapshot->'worker_error' is null or b.snapshot->'worker_error'='null'::jsonb))
    returning *;
end;
$$;

-- Cron-Transport nutzt den bereits privat hinterlegten internen Watch-Token.
select cron.schedule('mt5-health','* * * * *',$job$
 select net.http_post(
 url := 'https://vkphwtqcvqrkphksproj.supabase.co/functions/v1/mt5-health',
 headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='setup2_watch_token' limit 1)),
 body := '{}'::jsonb,timeout_milliseconds := 55000
 );
$job$);
