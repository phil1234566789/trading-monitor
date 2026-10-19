-- Eine kritische Episode gehört zum gesamten Watcher, nicht zu Reporter, Instrument oder Fehlertext.
create table public.setup2_operational_incidents (
 id uuid primary key default gen_random_uuid(), opened_at timestamptz not null,
 last_seen_at timestamptz not null, healthy_since timestamptz, closed_at timestamptz,
 summary jsonb not null, healthy_watermarks jsonb,problem_event_id text unique references public.setup2_alarm_events(id),
 recovery_event_id text unique references public.setup2_alarm_events(id)
);
create unique index setup2_one_open_operational_incident on public.setup2_operational_incidents ((true)) where closed_at is null;
alter table public.setup2_operational_incidents enable row level security;
revoke all on public.setup2_operational_incidents from public,anon,authenticated;
grant all on public.setup2_operational_incidents to service_role;
alter table public.pushover_test_limits add column provider_error_since timestamptz;
alter table public.setup2_notification_outbox add column last_attempt_at timestamptz;
create function public.setup2_stamp_notification_attempt() returns trigger language plpgsql set search_path=public as $$
begin
 if new.attempts>old.attempts then new.last_attempt_at:=now(); end if;
 return new;
end $$;
create trigger setup2_stamp_notification_attempt before update on public.setup2_notification_outbox
 for each row execute function public.setup2_stamp_notification_attempt();

-- Alte Runner dürfen weiter diagnostizieren, aber keine ungeprüften Einzelprobleme versenden.
create function public.setup2_gate_operational_outbox() returns trigger
language plpgsql security definer set search_path=public as $$
declare event setup2_alarm_events;
begin
 select * into event from setup2_alarm_events where id=new.event_id;
 if event.kind='problem' and (coalesce(event.payload->>'category','')<>'operational-critical'
  or not exists(select 1 from setup2_operational_incidents where problem_event_id=event.id))
  or event.kind='recovery' and (coalesce(event.payload->>'category','')<>'operational-recovery'
  or not exists(select 1 from setup2_operational_incidents where recovery_event_id=event.id)) then return null; end if;
 return new;
end $$;
create trigger setup2_gate_operational_outbox before insert on public.setup2_notification_outbox
 for each row execute function public.setup2_gate_operational_outbox();
-- Historie bleibt erhalten; bereits wartender Altspam wird beim Release nicht nachgeliefert.
update public.setup2_notification_outbox o set status='suppressed',claim_until=null,retry_after=null
from public.setup2_alarm_events e where e.id=o.event_id and o.status in ('pending','claimed','failed')
 and (e.kind='problem' and coalesce(e.payload->>'category','')<>'operational-critical'
  or e.kind='recovery' and coalesce(e.payload->>'category','')<>'operational-recovery');

create function public.setup2_update_operational_incident(p_critical boolean,p_recovery_ready boolean,p_summary jsonb,p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path=public as $$
declare episode setup2_operational_incidents; event_id text; recovered_id text; reported_at timestamptz;
 initial jsonb; progress boolean;
begin
 if jsonb_typeof(p_summary) is distinct from 'object' or octet_length(p_summary::text)>20000
  or jsonb_typeof(p_summary->'instruments') is distinct from 'array'
  or jsonb_array_length(p_summary->'instruments')>3 or p_now is null then raise exception 'Invalid operational report'; end if;
 perform pg_advisory_xact_lock(hashtext('setup2-global-operational-incident'));
 select * into episode from setup2_operational_incidents where closed_at is null for update;
 if p_critical then
  if episode.id is null then
   insert into setup2_operational_incidents(opened_at,last_seen_at,summary) values(p_now,p_now,p_summary) returning * into episode;
   event_id:='operational:'||episode.id::text;
   insert into setup2_alarm_events(id,signal_at,instrument,stage,kind,payload)
   values(event_id,p_now,'GBPUSD',0,'problem',p_summary||jsonb_build_object(
    'category','operational-critical','incidentId',episode.id,'openedAt',p_now));
   update setup2_operational_incidents set problem_event_id=event_id where id=episode.id;
   insert into setup2_notification_outbox(event_id,channel) values(event_id,'pushover');
  else
   event_id:=episode.problem_event_id;
   update setup2_operational_incidents set last_seen_at=p_now,summary=p_summary,healthy_since=null,healthy_watermarks=null where id=episode.id;
  end if;
  return jsonb_build_object('incidentId',episode.id,'eventId',event_id,'state','critical');
 end if;
 if episode.id is null then return null; end if;
 select payload into initial from setup2_alarm_events where id=episode.problem_event_id;
 select o.provider_accepted_at into reported_at from setup2_notification_outbox o
  where o.event_id=episode.problem_event_id and o.status='accepted' and o.provider_accepted_at is not null
  order by o.provider_accepted_at limit 1;
 -- Prozess-Pings und Retryzeiten allein beweisen keine wiederhergestellte Marktbeobachtung.
 progress:=exists(select 1 from jsonb_array_elements(p_summary->'instruments') row where (row->>'enabled')::boolean)
  and not exists(select 1 from jsonb_array_elements(p_summary->'instruments') row where (row->>'enabled')::boolean and (
   coalesce((row->>'lastSuccessAt')::timestamptz,'-infinity')<=coalesce(reported_at,episode.opened_at)
   or coalesce((row->>'marketWatermark')::timestamptz,'-infinity')<=coalesce((
    select old->>'marketWatermark' from jsonb_array_elements(initial->'instruments') old
    where old->>'instrument'=row->>'instrument' limit 1)::timestamptz,'-infinity')));
 if not p_recovery_ready or not progress then
  update setup2_operational_incidents set last_seen_at=p_now,summary=p_summary,healthy_since=null,healthy_watermarks=null where id=episode.id;
  return jsonb_build_object('incidentId',episode.id,'state','recovering');
 end if;
 if episode.healthy_since is null then
  update setup2_operational_incidents set healthy_since=p_now,healthy_watermarks=p_summary->'instruments',last_seen_at=p_now,summary=p_summary where id=episode.id;
 elsif p_now>=episode.healthy_since+interval '2 minutes' and not exists(
  select 1 from jsonb_array_elements(p_summary->'instruments') row where (row->>'enabled')::boolean and (
   coalesce((row->>'lastSuccessAt')::timestamptz,'-infinity')<=episode.healthy_since
   or coalesce((row->>'marketWatermark')::timestamptz,'-infinity')<=coalesce((
    select old->>'marketWatermark' from jsonb_array_elements(episode.healthy_watermarks) old
    where old->>'instrument'=row->>'instrument' limit 1)::timestamptz,'-infinity'))) then
  if reported_at is not null then
   recovered_id:='operational-recovery:'||episode.id::text;
   insert into setup2_alarm_events(id,signal_at,instrument,stage,kind,payload)
   values(recovered_id,p_now,'GBPUSD',0,'recovery',jsonb_build_object('category','operational-recovery',
    'incidentId',episode.id,'problemEventIds',jsonb_build_array(episode.problem_event_id),
    'openedAt',episode.opened_at,'reportedAt',reported_at,'recoveredAt',p_now));
   update setup2_operational_incidents set recovery_event_id=recovered_id where id=episode.id;
   insert into setup2_notification_outbox(event_id,channel) values(recovered_id,'telegram');
  end if;
  update setup2_operational_incidents set closed_at=p_now,last_seen_at=p_now,summary=p_summary,recovery_event_id=recovered_id where id=episode.id;
 end if;
 return jsonb_build_object('incidentId',episode.id,'state','recovering');
end $$;

create function public.setup2_operational_incident_status(p_event_id text)
returns text language sql stable security definer set search_path=public as $$
 select case when exists(select 1 from setup2_operational_incidents where problem_event_id=p_event_id and closed_at is null) then 'critical'
  when exists(select 1 from setup2_operational_incidents where closed_at is null or problem_event_id=p_event_id) then 'superseded'
  when exists(select 1 from setup2_operational_incidents where recovery_event_id=p_event_id and closed_at is not null) then 'ready'
  else 'waiting' end;
$$;
revoke all on function public.setup2_gate_operational_outbox(),public.setup2_stamp_notification_attempt(),
 public.setup2_update_operational_incident(boolean,boolean,jsonb,timestamptz),public.setup2_operational_incident_status(text)
 from public,anon,authenticated;
grant execute on function public.setup2_update_operational_incident(boolean,boolean,jsonb,timestamptz),
 public.setup2_operational_incident_status(text) to service_role;
notify pgrst,'reload schema';
