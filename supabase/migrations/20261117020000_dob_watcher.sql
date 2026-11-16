-- DOB-Live-Watcher (supabase/functions/dob-watcher): jede Minute checkDobTradeSetup() auf dem Live-Fenster, Telegram-Alarm beim
-- OB2-Retest und beim Entry. Die Event-ID ist der Dedup-Schlüssel (dobAlarm.js); ein Insert-Konflikt heißt „schon gemeldet“.
create table public.dob_alarm_events (
  id text primary key,
  instrument text not null,
  phase text not null check (phase in ('ob2Retest','entry','stale','error','test')),
  setup_id text,
  direction text,
  signal_at timestamptz not null,
  detected_at timestamptz not null default now(),
  text text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','uncertain')),
  error text,
  sent_at timestamptz
);
create index dob_alarm_events_time on public.dob_alarm_events (signal_at desc);

-- Herzschlag je Instrument: letzter Lauf, Datenstand und Laufzeit, damit ein stiller Ausfall sichtbar ist.
create table public.dob_watcher_state (
  instrument text primary key,
  last_run_at timestamptz,
  evaluated_at timestamptz,
  last_m1_time timestamptz,
  runtime_ms integer,
  calc_ms integer,
  setups integer,
  rejected integer,
  skipped text,
  error text,
  updated_at timestamptz not null default now()
);

alter table public.dob_alarm_events enable row level security;
alter table public.dob_watcher_state enable row level security;
create policy dob_alarm_events_read on public.dob_alarm_events for select to anon, authenticated using (true);
create policy dob_watcher_state_read on public.dob_watcher_state for select to anon, authenticated using (true);
grant select on public.dob_alarm_events, public.dob_watcher_state to anon, authenticated;
grant all on public.dob_alarm_events, public.dob_watcher_state to service_role;

-- Gleicher Cron-Token wie setup2-notification-watch (Vault setup2_watch_token = Function-Secret SETUP2_WATCH_TOKEN).
select cron.schedule('dob-watcher', '* * * * *', $job$
  select net.http_post(
    url := 'https://vkphwtqcvqrkphksproj.supabase.co/functions/v1/dob-watcher',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'setup2_watch_token' limit 1)),
    body := '{}'::jsonb, timeout_milliseconds := 55000
  );
$job$);
