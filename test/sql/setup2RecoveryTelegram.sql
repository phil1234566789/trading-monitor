insert into setup2_live_state(instrument,enabled,state) values('GBPUSD',true,jsonb_build_object(
 'lastSuccessAt',now()-interval '30 seconds','lastProcessAt',now(),'nextExpectedCheck',now()+interval '1 minute','scanDurationMs',80000));
insert into pushover_test_limits(id,watch_checked_at,provider_checked_at) values(true,now(),now());
insert into setup2_alarm_events(id,signal_at,instrument,stage,kind,payload) values
 ('p1',now()-interval '2 minutes','GBPUSD',0,'problem','{"message":"runner timeout"}'),
 ('p2',now()-interval '2 minutes','GBPUSD',0,'problem','{"message":"second timeout"}'),
 ('warning',now()-interval '2 minutes','GBPUSD',0,'problem','{"category":"range-warning"}');
insert into setup2_notification_outbox(event_id,channel,status,provider_accepted_at) values
 ('p1','pushover','accepted',now()-interval '1 minute'),
 ('p2','pushover','failed',null),
 ('warning','pushover','accepted',now()-interval '1 minute');

do $$ begin
 if setup2_prepare_recovery(false) is not null then raise exception 'unhealthy recovery'; end if;
 if setup2_prepare_recovery(true)<>('recovery:'||md5('["p1"]'::jsonb::text)) then raise exception 'accepted problem required'; end if;
 perform setup2_prepare_recovery(true);
 if (select count(*) from setup2_alarm_events where kind='recovery')<>1 then raise exception 'duplicate recovery'; end if;
 if setup2_recovery_status(('recovery:'||md5('["p1"]'::jsonb::text)))<>'ready' then raise exception 'healthy recovery not ready'; end if;
 if (select payload->'problemEventIds' from setup2_alarm_events where id=('recovery:'||md5('["p1"]'::jsonb::text)))<>'["p1"]'::jsonb then raise exception 'unsent/warning covered'; end if;
 if (select channel from setup2_notification_outbox where event_id=('recovery:'||md5('["p1"]'::jsonb::text)))<>'telegram' then raise exception 'recovery channel'; end if;
end $$;

update setup2_notification_outbox set status='failed',attempts=1,retry_after=now()-interval '1 second' where event_id=('recovery:'||md5('["p1"]'::jsonb::text));
do $$ begin
 if not exists(select 1 from setup2_claim_notifications(2) where event_id=('recovery:'||md5('["p1"]'::jsonb::text)) and attempts=2) then raise exception 'definitive rejection not retried'; end if;
 if (select payload->'delivery'->>'status' from setup2_alarm_events where id=('recovery:'||md5('["p1"]'::jsonb::text)))<>'claimed' then raise exception 'protocol status missing'; end if;
end $$;
update setup2_notification_outbox set status='failed',attempts=3 where event_id=('recovery:'||md5('["p1"]'::jsonb::text));
do $$ begin
 if exists(select 1 from setup2_claim_notifications(2) where event_id=('recovery:'||md5('["p1"]'::jsonb::text))) then raise exception 'unlimited retries'; end if;
end $$;
update setup2_notification_outbox set status='accepted',provider_accepted_at=now(),error=null where event_id=('recovery:'||md5('["p1"]'::jsonb::text));
do $$ begin
 if exists(select 1 from setup2_unresolved_reported_problems()) then raise exception 'accepted recovery not covering incident'; end if;
 if (select payload->'delivery'->>'acceptedAt' from setup2_alarm_events where id=('recovery:'||md5('["p1"]'::jsonb::text))) is null then raise exception 'accepted time missing'; end if;
end $$;

-- Eine verspätete Annahme mit identischem Zeitstempel bleibt über die Problem-ID erhalten.
update setup2_notification_outbox set status='accepted',provider_accepted_at=now()-interval '1 minute' where event_id='p2';
do $$ begin
 if setup2_prepare_recovery(true)<>('recovery:'||md5('["p2"]'::jsonb::text)) then raise exception 'late accepted problem lost'; end if;
end $$;
insert into setup2_alarm_events(id,signal_at,instrument,stage,kind,payload) values('p0',now()-interval '2 minutes','GBPUSD',0,'problem','{}');
insert into setup2_notification_outbox(event_id,channel,status,provider_accepted_at) values('p0','pushover','accepted',now()-interval '70 seconds');
do $$ begin
 if setup2_recovery_status('recovery:'||md5('["p2"]'::jsonb::text))<>'superseded' then raise exception 'late older acceptance not invalidating queued recovery'; end if;
 if setup2_prepare_recovery(true)<>('recovery:'||md5('["p0", "p2"]'::jsonb::text)) then raise exception 'late older acceptance trapped by old event ID'; end if;
end $$;
insert into setup2_alarm_events(id,signal_at,instrument,stage,kind,payload) values('p3',now()-interval '1 minute','GBPUSD',0,'problem','{}');
insert into setup2_notification_outbox(event_id,channel,status,provider_accepted_at) values('p3','pushover','accepted',now()-interval '40 seconds');
do $$ begin
 if setup2_recovery_status(('recovery:'||md5('["p2"]'::jsonb::text)))<>'superseded' then raise exception 'new fault not suppressing old recovery'; end if;
 if setup2_prepare_recovery(true)<>('recovery:'||md5('["p0", "p2", "p3"]'::jsonb::text)) then raise exception 'new incident missing'; end if;
 if (select jsonb_array_length(payload->'problemEventIds') from setup2_alarm_events where id=('recovery:'||md5('["p0", "p2", "p3"]'::jsonb::text)))<>3 then raise exception 'unaccepted recovery lost old problem'; end if;
end $$;

update setup2_notification_outbox set status='uncertain' where event_id=('recovery:'||md5('["p0", "p2", "p3"]'::jsonb::text));
do $$ begin
 perform setup2_prepare_recovery(true);
 if (select count(*) from setup2_alarm_events where id=('recovery:'||md5('["p0", "p2", "p3"]'::jsonb::text)))<>1 then raise exception 'uncertain duplicated'; end if;
 if exists(select 1 from setup2_claim_notifications(20) where event_id=('recovery:'||md5('["p0", "p2", "p3"]'::jsonb::text))) then raise exception 'unknown provider acceptance resent'; end if;
end $$;
update setup2_live_state set state=state||jsonb_build_object('lastSuccessAt',now()-interval '5 minutes','lastProcessAt',now());
do $$ begin
 if setup2_recovery_status(('recovery:'||md5('["p0", "p2", "p3"]'::jsonb::text)))<>'waiting' then raise exception 'process ping counted as recovery'; end if;
 if setup2_prepare_recovery(true) is not null then raise exception 'old success allowed recovery'; end if;
end $$;
update setup2_live_state set state=state||jsonb_build_object('lastSuccessAt',now(),'error','FXCM feed failed');
do $$ begin if setup2_prepare_recovery(true) is not null then raise exception 'feed fault allowed recovery'; end if; end $$;
update setup2_live_state set state=state-'error';
update pushover_test_limits set provider_error='provider rejected';
do $$ begin if setup2_prepare_recovery(true) is not null then raise exception 'provider fault allowed recovery'; end if; end $$;
update pushover_test_limits set provider_error=null,watch_checked_at=now()-interval '4 minutes';
do $$ begin if setup2_prepare_recovery(true) is not null then raise exception 'old independent cron allowed recovery'; end if; end $$;
select 'T68_ISOLATED_SQL_LIFECYCLE_PASSED' as result;
