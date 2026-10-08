-- Entwarnung hat einen eigenen Typ und ausschließlich eine Telegram-Outbox.
alter table public.setup2_alarm_events drop constraint setup2_alarm_events_kind_check;
alter table public.setup2_alarm_events add constraint setup2_alarm_events_kind_check check(kind in ('trading','problem','recovery'));
alter table public.setup2_notification_outbox add column retry_after timestamptz;

create function public.setup2_unresolved_reported_problems()
returns table(id text,instrument text,signal_at timestamptz,reported_at timestamptz)
language sql stable security definer set search_path=public as $$
 select e.id,e.instrument,e.signal_at,o.provider_accepted_at
 from setup2_alarm_events e join setup2_notification_outbox o on o.event_id=e.id
 where e.kind='problem' and o.status='accepted' and o.provider_accepted_at is not null
 and coalesce(e.payload->>'category','')<>'range-warning'
 and coalesce(e.payload->>'message','') not like 'Suspendierte DRs %'
 and not exists (
  select 1 from setup2_alarm_events r join setup2_notification_outbox ro on ro.event_id=r.id
  where r.kind='recovery' and ro.channel='telegram' and ro.status='accepted'
  and coalesce(r.payload->'problemEventIds','[]'::jsonb) ? e.id
 )
$$;

create function public.setup2_recovery_healthy(p_reported_at timestamptz)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from setup2_live_state where enabled)
 and not exists(
  select 1 from setup2_live_state where enabled and (
   nullif(state->>'error','') is not null
   or coalesce((state->>'lastSuccessAt')::timestamptz,'-infinity')<=p_reported_at
   or coalesce((state->>'nextExpectedCheck')::timestamptz,'-infinity')
      +make_interval(secs=>greatest(120,2*coalesce((state->>'scanDurationMs')::numeric,0)/1000)::double precision)<now()
  )
 )
 and exists(select 1 from pushover_test_limits where id
  and watch_checked_at>now()-interval '150 seconds'
  and provider_checked_at>now()-interval '420 seconds' and provider_error is null)
$$;

create function public.setup2_prepare_recovery(p_healthy boolean)
returns text language plpgsql security definer set search_path=public as $$
declare problem record; problems jsonb; opened_at timestamptz; event_id text; inserted_id text;
begin
 if not p_healthy then return null; end if;
 perform pg_advisory_xact_lock(hashtext('setup2-recovery'));
 select * into problem from setup2_unresolved_reported_problems() order by reported_at desc,id desc limit 1;
 if not found or not setup2_recovery_healthy(problem.reported_at) then return null; end if;
 select jsonb_agg(id order by id),min(signal_at) into problems,opened_at from setup2_unresolved_reported_problems();
 event_id:='recovery:'||md5(problems::text);
 insert into setup2_alarm_events(id,signal_at,instrument,stage,kind,payload)
 values(event_id,now(),problem.instrument,0,'recovery',jsonb_build_object(
  'message','Watcher läuft wieder; kein Eingreifen nötig','incidentId',md5(problems::text),
  'problemEventIds',problems,'openedAt',opened_at,'reportedAt',problem.reported_at,'recoveredAt',now(),
  'marketChecks',(select jsonb_object_agg(instrument,state->>'lastSuccessAt') from setup2_live_state where enabled)))
 on conflict(id) do nothing returning id into inserted_id;
 if inserted_id is not null then insert into setup2_notification_outbox(event_id,channel) values(inserted_id,'telegram'); end if;
 return event_id;
end $$;

create function public.setup2_recovery_status(p_event_id text)
returns text language plpgsql security definer set search_path=public as $$
declare event setup2_alarm_events;
begin
 perform pg_advisory_xact_lock(hashtext('setup2-recovery'));
 select * into event from setup2_alarm_events where id=p_event_id and kind='recovery';
 if not found then return 'superseded'; end if;
 if exists(select 1 from setup2_unresolved_reported_problems() p where not (event.payload->'problemEventIds' ? p.id))
 then return 'superseded'; end if;
 return case when setup2_recovery_healthy((event.payload->>'reportedAt')::timestamptz) then 'ready' else 'waiting' end;
end $$;

-- Status im öffentlichen Protokoll und private Outbox ändern sich in derselben Transaktion.
create function public.setup2_recovery_delivery_log()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext('setup2-recovery'));
 update setup2_alarm_events set payload=payload||jsonb_build_object('delivery',jsonb_build_object(
  'channel',new.channel,'status',new.status,'attempts',new.attempts,'acceptedAt',new.provider_accepted_at,
  'error',new.error,'nextAttemptAt',new.retry_after))
 where id=new.event_id and kind='recovery';
 return new;
end $$;
create trigger setup2_recovery_delivery_log after insert or update on public.setup2_notification_outbox
 for each row execute function public.setup2_recovery_delivery_log();

create or replace function public.setup2_claim_notifications(p_limit integer default 10)
returns setof public.setup2_notification_outbox language plpgsql security definer set search_path=public as $$
begin
 update setup2_notification_outbox set status='uncertain',error='Sender stopped after claiming delivery'
 where status='claimed' and claim_until<now();
 return query update setup2_notification_outbox set status='claimed',attempts=attempts+1,claim_until=now()+interval '2 minutes'
 where id in (
  select o.id from setup2_notification_outbox o join setup2_alarm_events e on e.id=o.event_id
  where (o.status='pending' or (o.status='failed' and e.kind='recovery' and o.channel='telegram' and o.attempts<3))
   and (o.retry_after is null or o.retry_after<=now())
  order by o.id for update of o skip locked limit least(p_limit,20)
 ) returning *;
end $$;

revoke all on function public.setup2_unresolved_reported_problems(),public.setup2_recovery_healthy(timestamptz),
 public.setup2_prepare_recovery(boolean),public.setup2_recovery_status(text),public.setup2_recovery_delivery_log()
 from public,anon,authenticated;
grant execute on function public.setup2_unresolved_reported_problems(),public.setup2_recovery_healthy(timestamptz),
 public.setup2_prepare_recovery(boolean),public.setup2_recovery_status(text) to service_role;
