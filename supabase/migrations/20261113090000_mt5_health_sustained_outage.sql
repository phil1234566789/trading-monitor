-- Kurze Timeouts bleiben Diagnose; erst ein zweistuendiger Dauerausfall rechtfertigt einen Push.
create or replace function public.mt5_record_health(p_key text,p_code text,p_detail jsonb)
returns public.mt5_health_incidents language plpgsql security invoker set search_path=public as $$
declare current_issue public.mt5_health_incidents;
begin
 perform pg_advisory_xact_lock(29092026,2);
 select * into current_issue from mt5_health_incidents where resolved_at is null;
 if p_key is null then
  update mt5_health_incidents set resolved_at=now() where resolved_at is null;
  return null;
 end if;
 if current_issue.id is not null then
  -- Wechselnde Fehler waehrend desselben Ausfalls setzen weder Wartezeit noch Versand zurueck.
  update mt5_health_incidents set issue_key=p_key,code=p_code,detail=p_detail
   where id=current_issue.id returning * into current_issue;
  return current_issue;
 end if;
 insert into mt5_health_incidents(issue_key,code,detail) values(p_key,p_code,p_detail) returning * into current_issue;
 insert into mt5_health_deliveries(incident_id,channel) values(current_issue.id,'pushover'),(current_issue.id,'telegram');
 return current_issue;
end $$;

create or replace function public.mt5_claim_health_notifications(p_limit integer default 4)
returns setof public.mt5_health_deliveries language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(29092026,2);
 update mt5_health_deliveries set status='uncertain',error='delivery_interrupted'
 where status='claimed' and last_attempt_at<now()-interval '2 minutes';
 return query update mt5_health_deliveries set status='claimed',last_attempt_at=now(),attempts=attempts+1
 where id in (select d.id from mt5_health_deliveries d join mt5_health_incidents i on i.id=d.incident_id
  where i.resolved_at is null and i.opened_at<=now()-interval '2 hours'
   and (d.status='pending' or d.status='failed' and d.attempts<3 and d.last_attempt_at<now()-interval '1 minute')
  order by d.last_attempt_at nulls first for update of d skip locked limit least(greatest(p_limit,1),10)) returning *;
end $$;
