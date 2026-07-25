-- Sessions (src/sessions.js, Chart-Hintergrundbänder) werden asset-spezifisch statt global
-- (Chat 2026-07-25: "getrennte Listen pro Asset" statt einer Session, die für mehrere Assets
-- gilt) — jede Session gehört jetzt zu genau einem Instrument, wird nur noch auf dessen Chart
-- gerendert/im Sessions-Modal angezeigt.
--
-- Zusätzlich ein "danger"-Level je Session (Chat: "die Sessions haben zusätzlich einen
-- Parameter, welcher sagt, wie gefährlich die Session ist?") — verbindet die neue
-- Handelszeiten-Seite (trading_schedules) mit dem bestehenden Sessions-Feature: statt eines
-- separaten Konzepts für "Vorsicht"/"verboten"-Zeitfenster (MMM-Session 10:30-13:00 GBPUSD/
-- EURUSD, 14:00-15:45 BTC "strengstens verboten") sind das einfach Sessions mit
-- danger='caution'/'forbidden'.
alter table sessions add column instrument text;
alter table sessions add column danger text not null default 'normal' check (danger in ('normal', 'caution', 'forbidden'));

-- Backfill der beiden bisher einzigen Sessions ("Asia", "MMM") auf GBPUSD — beide Labels sind
-- eindeutig Forex-Konzepte, letzter aktiver Chart laut .debug/metadata.json war GBPUSD. Bei
-- Bedarf über das (jetzt asset-scoped) Sessions-Modal für EURUSD manuell duplizieren.
update sessions set instrument = 'GBPUSD' where instrument is null;
alter table sessions alter column instrument set not null;

-- MMM ist exakt die 10:30-13:00-Vorsichtszeit aus dem Chat — direkt als "caution" seeden statt
-- Philip das manuell nachpflegen zu lassen.
update sessions set danger = 'caution' where label = 'MMM';
