-- Alte Health-Warnungen müssen derselben Fallwarnungsgrenze wie die Edgefunktion folgen.
create or replace function public.setup2_unresolved_reported_problems()
returns table(id text,instrument text,signal_at timestamptz,reported_at timestamptz)
language sql stable security definer set search_path=public as $$
 select e.id,e.instrument,e.signal_at,o.provider_accepted_at
 from setup2_alarm_events e join setup2_notification_outbox o on o.event_id=e.id
 where e.kind='problem' and o.status='accepted' and o.provider_accepted_at is not null
 and coalesce(e.payload->>'category','')<>'range-warning'
 and not (e.id like 'health:%' and (
  coalesce(e.payload->>'message','') ~ '^DR .+: Lifecycle-Historie fehlt oder ist lueckenhaft$'
  or coalesce(e.payload->>'message','') ~ '^Suspendierte DRs .+: Lifecycle-Historie konnte nicht ermittelt werden \(fehlend oder lückenhaft\)$'
 ))
 and not exists (
  select 1 from setup2_alarm_events r join setup2_notification_outbox ro on ro.event_id=r.id
  where r.kind='recovery' and ro.channel='telegram' and ro.status='accepted'
  and coalesce(r.payload->'problemEventIds','[]'::jsonb) ? e.id
 )
$$;

