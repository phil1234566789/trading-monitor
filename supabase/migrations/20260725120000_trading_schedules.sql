-- Handelszeiten pro Instrument (neue "Handelszeiten"-Seite im Dashboard, neben "Alarme") —
-- Auslöser: Philip bekam am Samstag einen Telegram-Alarm (GBPUSD), obwohl am WE kein Forex
-- gehandelt wird. isTradingHours() im poi-watcher prüfte bisher NUR die Uhrzeit, nie den
-- Wochentag (Twelve Data liefert auch am WE weiter Candles, siehe Chat 2026-07-25). Diese
-- Tabelle ist ab jetzt die EINE Quelle für "wann darf gehandelt/alarmiert werden" — sowohl für
-- den poi-watcher (alarm_windows, siehe supabase/functions/poi-watcher/index.ts) als auch für
-- die Anzeige im Dashboard (trading_windows).
--
-- Bewusst NUR Mo-Fr/Samstag/Sonntag-Gruppen statt 7 individueller Wochentage (Chat 2026-07-25:
-- "die werden sich echt kaum ändern", und jedes bisher genannte Beispiel folgt exakt diesem
-- Mo-Fr+Sa+So-Schema) — eine volle 7-Tage-Matrix wäre YAGNI für Daten, die praktisch nie pro
-- einzelnem Wochentag divergieren.
--
-- trading_windows: wann ein TRADE ERÖFFNET werden darf (reine Referenz/Dokumentation bisher,
-- noch von keinem Code gelesen).
-- alarm_windows: wann der poi-watcher tatsächlich Telegram-Nachrichten verschicken darf —
-- bewusst SEPARAT von trading_windows (Chat: "Alarme müssen rechtzeitig kommen, damit ich mich
-- vorbereiten kann" / "ein Alarm um 18 Uhr bringt mir nichts mehr" — Vorlauf vor und Cutoff
-- knapp vor dem eigentlichen Handelsfenster-Ende, nicht deckungsgleich).
--
-- Format je Spalte: {"weekday": [[fromMin,toMin], ...], "saturday": [...], "sunday": [...]}
-- (Minuten seit Mitternacht, LOKALE Zeit Europe/Berlin, DST-aware wie überall sonst im Repo —
-- siehe CLAUDE.md "Trading-hours / timezone handling"). Leeres Array = an diesem Tag kein
-- Handel/Alarm.
create table trading_schedules (
  instrument text primary key,
  trading_windows jsonb not null,
  alarm_windows jsonb not null,
  notes text,
  updated_at timestamptz not null default now()
);

create trigger trading_schedules_set_updated_at
  before update on trading_schedules
  for each row
  execute function set_updated_at();

-- Schreibzugriff für anon (wie chart_colors/alarm_settings/sessions) — das Dashboard speichert
-- direkt aus dem Browser, unkritisch da keine sensiblen Daten.
alter table trading_schedules enable row level security;

create policy "trading_schedules read for anon"
  on trading_schedules for select
  to anon
  using (true);

create policy "trading_schedules write for anon"
  on trading_schedules for all
  to anon
  using (true)
  with check (true);

-- Seed mit den am 2026-07-25 vorgegebenen Werten (Chat: "für die folgenden trading zeiten...").
insert into trading_schedules (instrument, trading_windows, alarm_windows, notes) values
  (
    'GBPUSD',
    '{"weekday": [[480, 1080]], "saturday": [], "sunday": []}',
    '{"weekday": [[420, 1065]], "saturday": [], "sunday": []}',
    '10:30-13:00 (MMM-Session) nur mit zusätzlichen Bestätigungen handeln — siehe "danger"-Flag der MMM-Session auf dem Chart (Sessions-Modal).'
  ),
  (
    'EURUSD',
    '{"weekday": [[480, 1080]], "saturday": [], "sunday": []}',
    '{"weekday": [[420, 1065]], "saturday": [], "sunday": []}',
    '10:30-13:00 (MMM-Session) nur mit zusätzlichen Bestätigungen handeln — siehe "danger"-Flag der MMM-Session auf dem Chart (Sessions-Modal).'
  ),
  (
    'XAUUSD',
    '{"weekday": [[840, 1080]], "saturday": [], "sunday": []}',
    '{"weekday": [], "saturday": [], "sunday": []}',
    'Noch nicht live getradet und noch keine Datenquelle/Kerzen im Repo angebunden — nur zur Referenz vorgemerkt, alarm_windows bewusst leer.'
  ),
  (
    'BTC-USDT',
    '{"weekday": [[420, 660], [1080, 1320]], "saturday": [], "sunday": [[420, 660], [1080, 1320]]}',
    '{"weekday": [[420, 660], [1080, 1320]], "saturday": [], "sunday": [[420, 660], [1080, 1320]]}',
    'Samstag nie. Sonntag: Trade nur eröffnen, wenn alle Bestätigungen passen — Alarme bleiben aber an (gleiche Fenster wie Mo-Fr). 14:00-15:45 strengstens verboten (täglich) — als eigene "forbidden"-Session auf dem Chart abbilden, nicht Teil dieser Fenster (liegt ohnehin außerhalb).'
  );
