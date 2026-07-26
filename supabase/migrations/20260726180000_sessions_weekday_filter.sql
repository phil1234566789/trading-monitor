-- Bug-Report Philip 2026-07-26: "am WE werden mir Session-Indikatoren angezeigt, die spielen aber
-- ueberhaupt keine Rolle" — Sessions (src/sessions.js) liefen bisher taeglich ohne Wochentag-Konzept,
-- daher erschienen z.B. Asia/MMM auch samstags/sonntags, obwohl Forex dann geschlossen ist.
--
-- Neue Spalte "days" (0=So..6=Sa, wie JS Date#getDay()) steuert, an welchen lokalen Wochentagen eine
-- Session ueberhaupt STARTEN darf (siehe sessionOccurrences/daysOrAll in sessions.js). NULL = jeden
-- Tag (Altverhalten) — wichtig fuer BTC-Sessions, die bewusst NICHT eingeschraenkt werden (Crypto
-- handelt auch am WE).
alter table sessions add column days int[];

-- Bestehende Forex-Sessions (GBPUSD/EURUSD) auf Mo-Fr beschraenken — Philip: "alle FX-Sessions
-- automatisch auf Mo-Fr" statt das manuell pro Session im Sessions-Modal nachzupflegen.
update sessions set days = array[1, 2, 3, 4, 5] where instrument in ('GBPUSD', 'EURUSD');

-- Neue Weekend-Gap-Session (Chat 2026-07-26: "Von Fr 23:00 bis So 23:00, weil es auf GBPUSD
-- FOREXCOM auf TradingView auch so ist") — days=[5] (nur freitags), to_minutes = 23:00 + 48h
-- (4260 statt der ueblichen <1440), damit sessionOccurrences den vollen Fr23:00-So23:00-Bogen in
-- EINEM Vorkommen berechnet statt nur bis Mitternacht zu wrappen (siehe Kommentar bei
-- sessionOccurrences in sessions.js: to_minutes > from_minutes wird nicht als "Mitternacht-Wrap"
-- behandelt, sondern als absolute Minuten seit dem lokalen Tagesbeginn — funktioniert also auch
-- fuer Mehrtages-Spannen ohne Code-Aenderung). High/Low relevant, weil das die CME-Gap-Referenz ist.
insert into sessions (id, label, from_minutes, to_minutes, hex, alpha, high_low_relevant, instrument, danger, days)
values
  ('session-weekend-gap-gbpusd', 'Weekend Gap', 23 * 60, 23 * 60 + 48 * 60, '#787b86', 0.10, true, 'GBPUSD', 'normal', array[5]),
  ('session-weekend-gap-eurusd', 'Weekend Gap', 23 * 60, 23 * 60 + 48 * 60, '#787b86', 0.10, true, 'EURUSD', 'normal', array[5]);
