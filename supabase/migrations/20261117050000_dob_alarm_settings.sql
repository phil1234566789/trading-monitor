-- DOB-Setup-Alarm auf der Alarme-Seite: Schalter in alarm_settings (Vorgabe an) und Alarmfenster im bestehenden
-- trading_schedules.alarm_windows von XAUUSD (Vorgabe Mo–Fr 09:00–18:00 Berlin). Der poi-watcher sendet für XAU nicht
-- (sendTelegram: false), das Fenster war leer und gehört damit allein dem dob-watcher.
insert into public.alarm_settings (key, enabled) values ('dob_setup', true) on conflict (key) do nothing;
update public.trading_schedules set alarm_windows = '{"weekday":[[540,1080]],"saturday":[],"sunday":[]}'::jsonb
  where instrument = 'XAUUSD' and alarm_windows = '{"weekday":[],"saturday":[],"sunday":[]}'::jsonb;
