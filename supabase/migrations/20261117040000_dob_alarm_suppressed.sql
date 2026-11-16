-- Alarmfenster (Philip): erkannt und protokolliert wird 02:00–22:00, gesendet nur im Alarmfenster. Ein Alarm außerhalb steht
-- als suppressed im Protokoll und wird nie nachgesendet.
alter table public.dob_alarm_events drop constraint dob_alarm_events_status_check;
alter table public.dob_alarm_events add constraint dob_alarm_events_status_check
  check (status in ('pending','sent','failed','uncertain','suppressed'));
