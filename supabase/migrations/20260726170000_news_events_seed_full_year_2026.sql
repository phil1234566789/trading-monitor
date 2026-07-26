-- Chat 2026-07-26: "trag doch bitte gleich die News vom ganzen Jahr ein. auch für die vergangenen
-- Monate zum backtesten" — erweitert die Web-recherchierte Vorgänger-Migration
-- (20260726160000_news_events_seed_next_10_weeks.sql) auf das komplette Kalenderjahr 2026
-- (01.01.-31.12.), inklusive bereits vergangener Monate. Gleiche Quellen/Kategorien wie dort:
-- FOMC (federalreserve.gov), EZB (ecb.europa.eu), BoE (bankofengland.co.uk), US NFP + US CPI
-- (BLS-Veröffentlichungskalender), UK CPI (ons.gov.uk) — NICHT ForexFactory selbst (ToS). Bereits
-- vorhandene Zeilen (23.07./29.07./30.07./07.08./12.08./19.08./04.09./10.09./11.09./16.09./17.09./
-- 02.10.2026) werden hier nicht wiederholt, `on conflict do nothing` fängt versehentliche
-- Überschneidungen trotzdem ab.
--
-- DST-Umrechnung ist bewusst PRO EINZELTERMIN geprüft, nicht pauschal — US/UK/EU wechseln an
-- unterschiedlichen Tagen (US: 8. März / 1. November; UK+EU: 29. März / 25. Oktober 2026), ein
-- fixer Offset für "Winter" oder "Sommer" hätte Termine nah an diesen Umstellungen falsch berechnet.
--
-- Zwei Termine mit geringerer Quellen-Sicherheit als der Rest (unten einzeln kommentiert): der
-- Non-Farm-Payrolls-Termin am 11.02. (ursprünglich für den 06.02. geplant, wegen einer
-- Haushaltssperre verschoben) und die NFP-Termine für November/Dezember, die nur über die
-- "erster Freitag im Monat"-Regel + eine Aggregator-Quelle bestätigt sind, nicht direkt von bls.gov
-- (dessen Seite hat automatisierte Abfragen mit HTTP 403 geblockt).
insert into news_events (event_time, currency, title) values

  -- === Januar 2026 ===
  ('2026-01-09T13:30:00Z', 'USD', 'Non-Farm Payrolls'), -- EST (UTC-5)
  ('2026-01-13T13:30:00Z', 'USD', 'CPI (Consumer Price Index)'),
  ('2026-01-21T07:00:00Z', 'GBP', 'UK CPI'), -- GMT
  ('2026-01-28T19:00:00Z', 'USD', 'Federal Funds Rate'), -- FOMC 27.-28.01., Entscheid 2. Tag, EST
  ('2026-01-28T19:30:00Z', 'USD', 'FOMC Press Conference'),

  -- === Februar 2026 ===
  ('2026-02-05T12:00:00Z', 'GBP', 'BOE Interest Rate Decision'), -- GMT
  ('2026-02-05T13:15:00Z', 'EUR', 'Main Refinancing Rate'), -- EZB 04.-05.02., CET
  ('2026-02-05T13:45:00Z', 'EUR', 'Monetary Policy Statement'),
  -- Ursprünglich für 06.02. geplant, wegen einer Haushaltssperre ("federal service suspension")
  -- auf den 11.02. verschoben — für Backtesting ist das TATSÄCHLICHE Veröffentlichungsdatum
  -- relevant, nicht der ursprüngliche Plan.
  ('2026-02-11T13:30:00Z', 'USD', 'Non-Farm Payrolls'), -- EST, verschoben von 06.02.
  ('2026-02-13T13:30:00Z', 'USD', 'CPI (Consumer Price Index)'),
  ('2026-02-18T07:00:00Z', 'GBP', 'UK CPI'),

  -- === März 2026 ===
  -- NFP vor dem US-DST-Wechsel (08.03.) -> noch EST; CPI danach -> schon EDT.
  ('2026-03-06T13:30:00Z', 'USD', 'Non-Farm Payrolls'), -- EST
  ('2026-03-11T12:30:00Z', 'USD', 'CPI (Consumer Price Index)'), -- EDT
  ('2026-03-18T18:00:00Z', 'USD', 'Federal Funds Rate'), -- FOMC 17.-18.03., EDT
  ('2026-03-18T18:30:00Z', 'USD', 'FOMC Press Conference'),
  ('2026-03-19T12:00:00Z', 'GBP', 'BOE Interest Rate Decision'), -- vor UK/EU-DST-Wechsel (29.03.) -> GMT
  ('2026-03-19T13:15:00Z', 'EUR', 'Main Refinancing Rate'), -- CET
  ('2026-03-19T13:45:00Z', 'EUR', 'Monetary Policy Statement'),
  ('2026-03-25T07:00:00Z', 'GBP', 'UK CPI'), -- GMT

  -- === April 2026 ===
  -- Ab hier UK/EU auf CEST/BST (seit 29.03.), US auf EDT (seit 08.03.).
  ('2026-04-03T12:30:00Z', 'USD', 'Non-Farm Payrolls'),
  ('2026-04-10T12:30:00Z', 'USD', 'CPI (Consumer Price Index)'),
  ('2026-04-22T06:00:00Z', 'GBP', 'UK CPI'),
  ('2026-04-29T18:00:00Z', 'USD', 'Federal Funds Rate'), -- FOMC 28.-29.04.
  ('2026-04-29T18:30:00Z', 'USD', 'FOMC Press Conference'),
  ('2026-04-30T11:00:00Z', 'GBP', 'BOE Interest Rate Decision'), -- BST
  ('2026-04-30T12:15:00Z', 'EUR', 'Main Refinancing Rate'), -- CEST
  ('2026-04-30T12:45:00Z', 'EUR', 'Monetary Policy Statement'),

  -- === Mai 2026 ===
  ('2026-05-08T12:30:00Z', 'USD', 'Non-Farm Payrolls'),
  ('2026-05-12T12:30:00Z', 'USD', 'CPI (Consumer Price Index)'),
  ('2026-05-20T06:00:00Z', 'GBP', 'UK CPI'),

  -- === Juni 2026 ===
  ('2026-06-05T12:30:00Z', 'USD', 'Non-Farm Payrolls'),
  ('2026-06-10T12:30:00Z', 'USD', 'CPI (Consumer Price Index)'),
  ('2026-06-11T12:15:00Z', 'EUR', 'Main Refinancing Rate'), -- EZB 11.06., CEST
  ('2026-06-11T12:45:00Z', 'EUR', 'Monetary Policy Statement'),
  ('2026-06-17T18:00:00Z', 'USD', 'Federal Funds Rate'), -- FOMC 16.-17.06.
  ('2026-06-17T18:30:00Z', 'USD', 'FOMC Press Conference'),
  ('2026-06-17T06:00:00Z', 'GBP', 'UK CPI'),
  ('2026-06-18T11:00:00Z', 'GBP', 'BOE Interest Rate Decision'), -- BST

  -- === Juli 2026 (vor dem 23.07., der schon in der DB steht) ===
  -- NFP fiel wegen des 4.-Juli-Feiertags auf Donnerstag statt Freitag.
  ('2026-07-02T12:30:00Z', 'USD', 'Non-Farm Payrolls'),
  ('2026-07-14T12:30:00Z', 'USD', 'CPI (Consumer Price Index)'),
  ('2026-07-22T06:00:00Z', 'GBP', 'UK CPI'),

  -- === September 2026 (nur FOMC — NFP/EZB/US-CPI/UK-CPI/BoE für September stehen schon aus der
  -- 10-Wochen-Migration in der DB) ===
  ('2026-09-16T18:00:00Z', 'USD', 'Federal Funds Rate'), -- FOMC 15.-16.09., EDT
  ('2026-09-16T18:30:00Z', 'USD', 'FOMC Press Conference'),

  -- === Oktober 2026 ===
  -- CPI/FOMC vor dem US-DST-Ende (01.11.) -> noch EDT; UK CPI vor UK/EU-DST-Ende (25.10.) -> noch BST.
  ('2026-10-14T12:30:00Z', 'USD', 'CPI (Consumer Price Index)'),
  ('2026-10-21T06:00:00Z', 'GBP', 'UK CPI'),
  ('2026-10-28T18:00:00Z', 'USD', 'Federal Funds Rate'), -- FOMC 27.-28.10.
  ('2026-10-28T18:30:00Z', 'USD', 'FOMC Press Conference'),
  ('2026-10-29T13:15:00Z', 'EUR', 'Main Refinancing Rate'), -- EZB 29.10., nach EU-DST-Ende -> CET
  ('2026-10-29T13:45:00Z', 'EUR', 'Monetary Policy Statement'),

  -- === November 2026 ===
  -- Ab hier US wieder EST (seit 01.11.), UK/EU wieder GMT/CET (seit 25.10.).
  -- NFP-Termine hier (06.11., 04.12.) nur über die "1. Freitag im Monat"-Regel + eine
  -- Aggregator-Quelle bestätigt, NICHT direkt von bls.gov (blockt automatisierte Abfragen) —
  -- etwas geringere Sicherheit als der Rest dieser Migration.
  ('2026-11-05T12:00:00Z', 'GBP', 'BOE Interest Rate Decision'), -- GMT
  ('2026-11-06T13:30:00Z', 'USD', 'Non-Farm Payrolls'), -- EST
  ('2026-11-10T13:30:00Z', 'USD', 'CPI (Consumer Price Index)'),
  ('2026-11-18T07:00:00Z', 'GBP', 'UK CPI'), -- GMT

  -- === Dezember 2026 ===
  ('2026-12-04T13:30:00Z', 'USD', 'Non-Farm Payrolls'), -- EST, siehe Hinweis oben
  ('2026-12-09T19:00:00Z', 'USD', 'Federal Funds Rate'), -- FOMC 08.-09.12., EST
  ('2026-12-09T19:30:00Z', 'USD', 'FOMC Press Conference'),
  ('2026-12-10T13:30:00Z', 'USD', 'CPI (Consumer Price Index)'),
  ('2026-12-16T07:00:00Z', 'GBP', 'UK CPI'), -- GMT
  ('2026-12-17T12:00:00Z', 'GBP', 'BOE Interest Rate Decision'), -- GMT
  ('2026-12-17T13:15:00Z', 'EUR', 'Main Refinancing Rate'), -- EZB 17.12., CET
  ('2026-12-17T13:45:00Z', 'EUR', 'Monetary Policy Statement')
on conflict (event_time, currency, title) do nothing;
