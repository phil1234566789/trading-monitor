-- Wirtschafts-News als No-Go fürs Trade-Setup-Cockpit (Chat 2026-07-26: "News-Api oder ich trad
-- halt von mir aus pro Woche die News per Hand ein" — Philip nutzt ForexFactory selbst, entschieden
-- gegen eine externe News-API fürs Erste, siehe project_tsc_anti_confluence-Memory). Philip schickt
-- einen ForexFactory-Screenshot (schon auf EUR/GBP/USD gefiltert), Claude liest die ROTEN
-- (High-Impact) Termine daraus ab und trägt sie per eigener Daten-Migration ein (siehe z.B.
-- 20260726120100_news_events_seed_2026-07-23.sql) — genau wie die bestehenden
-- Daten-Migrationen in diesem Ordner (20260705150000_seed_test_trade.sql etc.), NICHT über den
-- Browser/anon-Key. Deshalb NUR eine anon-READ-Policy unten, kein Schreibzugriff für anon (anders
-- als sessions/chart_colors/trading_schedules, die alle direkt aus dem Dashboard heraus
-- geschrieben werden).
--
-- Nur High-Impact (die roten FF-Icons) werden je überhaupt eingetragen — kein "impact"-Feld, weil
-- laut Philip explizit nur die roten zählen ("nur die roten"), keine gelben/orangen Zwischenstufen
-- geplant.
--
-- unique(event_time, currency, title) als Sicherheitsnetz gegen doppeltes Eintragen, falls sich
-- zwei Wochen-Screenshots mal überlappen (FF zeigt bei manchen Terminen z.B. am Monatsanfang die
-- Vorwoche noch mit an) — insert-Migrationen nutzen `on conflict ... do nothing`.
create table news_events (
  id uuid primary key default gen_random_uuid(),
  event_time timestamptz not null,
  currency text not null, -- 'EUR' | 'GBP' | 'USD' (die Instrumente hier sind nur EURUSD/GBPUSD)
  title text not null,
  created_at timestamptz not null default now(),
  unique (event_time, currency, title)
);

alter table news_events enable row level security;

create policy "news_events read for anon"
  on news_events for select
  to anon
  using (true);
