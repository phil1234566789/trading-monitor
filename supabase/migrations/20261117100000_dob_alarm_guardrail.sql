-- Sperre aus dob_guardrails je Alarm-Ereignis (blockedZoneAge/blockedEntryHour), auch beim gesendeten Warn-Alarm „Entry in Sperrzeit“.
alter table public.dob_alarm_events add column if not exists guardrail text;
