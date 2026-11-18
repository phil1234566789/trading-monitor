-- dob_alarm_events wird Outbox: der Watcher protokolliert erst (pending) und sendet danach parallel. 'sending' ist der Claim gegen
-- überlappende Cron-Läufe; attempts begrenzt die markierte Wiederholung unklarer Zustellungen, outage_notified_at die Ausfallmeldung.
alter table public.dob_alarm_events drop constraint dob_alarm_events_status_check;
alter table public.dob_alarm_events add constraint dob_alarm_events_status_check
  check (status in ('pending','sending','sent','failed','uncertain','suppressed'));
alter table public.dob_alarm_events
  add column attempts integer not null default 0,
  add column last_attempt_at timestamptz,
  add column outage_notified_at timestamptz;
-- Bisherige Zeilen hatten genau einen Versuch.
-- Bisherige Zeilen hatten genau einen Versuch; ihre Ausfälle kennt Philip schon, keine nachträgliche Ausfallmeldung.
update public.dob_alarm_events set attempts=1,last_attempt_at=coalesce(sent_at,detected_at),
  outage_notified_at=case when status in ('failed','uncertain') then now() end where status in ('sent','failed','uncertain');
create index dob_alarm_events_open on public.dob_alarm_events (detected_at) where status in ('pending','sending','uncertain','failed');
