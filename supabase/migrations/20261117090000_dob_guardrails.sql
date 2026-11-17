-- Sperr-Konfiguration des DOB-Setups je Instrument (src/dobGuardrails.js): gesperrte Entry-Zeitfenster (Berlin-Minuten [von, bis),
-- über Mitternacht erlaubt), gesperrte Monate (1–12) und Mindestalter der Kraftquelle-Zone bis zum Retest. Gelesen von der
-- Statistikseite und dem dob-watcher. Default = nichts gesperrt. Neue Tabelle, rein additiv.
create table public.dob_guardrails (
  instrument text primary key,
  blocked_entry_windows jsonb not null default '[]'::jsonb check (jsonb_typeof(blocked_entry_windows) = 'array'),
  blocked_months smallint[] not null default '{}' check (blocked_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]),
  min_zone_age_seconds bigint check (min_zone_age_seconds is null or min_zone_age_seconds >= 0),
  updated_at timestamptz not null default now()
);

-- Schreibzugriff für anon wie trading_schedules/alarm_settings: die Statistikseite speichert direkt aus dem Browser.
alter table public.dob_guardrails enable row level security;
create policy dob_guardrails_read on public.dob_guardrails for select to anon, authenticated using (true);
create policy dob_guardrails_write on public.dob_guardrails for all to anon using (true) with check (true);

insert into public.dob_guardrails (instrument) values ('XAUUSD') on conflict (instrument) do nothing;
