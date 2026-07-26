-- Chat 2026-07-26: "könntest du die news der nächsten 10 wochen ... schonmal eintragen" — anders
-- als die bisherigen Seed-Migrationen (aus Philips ForexFactory-Screenshot abgetippt) kommen diese
-- Termine aus einer Web-Recherche (offizielle Kalender: federalreserve.gov/FOMC, ecb.europa.eu,
-- bankofengland.co.uk, BLS-Veröffentlichungstermine, ons.gov.uk), NICHT von ForexFactory selbst
-- (automatisiertes Abgreifen von forexfactory.com verstößt gegen deren ToS) — fachlich dieselben
-- Termine, die dort ebenfalls rot markiert wären. Zeitraum 26.07.2026 - 04.10.2026 (10 Wochen).
--
-- Abgedeckt: FOMC-Zinsentscheide + Pressekonferenz, US Non-Farm Payrolls, US CPI, EZB-Zinsentscheid
-- + Pressekonferenz, BoE-Zinsentscheid, UK CPI. NICHT abgedeckt (nicht recherchiert/verifiziert,
-- bei Bedarf nachtragen): Eurozone Flash-HICP, GDP-Prints, PMIs, Retail Sales — teils nicht
-- durchgängig FF-rot, teils Veröffentlichungstermin nicht sauber verifizierbar gewesen.
--
-- Alle Uhrzeiten UTC, umgerechnet aus der jeweiligen lokalen Zeitzone der Behörde (DST-Stand für
-- Juli-Oktober 2026 berücksichtigt: US = EDT/UTC-4 bis 1.11., UK = BST/UTC+1 und EU = CEST/UTC+2
-- bis 25.10.).
insert into news_events (event_time, currency, title) values
  -- FOMC-Sitzung 28.-29.07.2026 (federalreserve.gov) — Entscheid + Pressekonferenz am zweiten Tag,
  -- traditionell 14:00/14:30 ET.
  ('2026-07-29T18:00:00Z', 'USD', 'Federal Funds Rate'),
  ('2026-07-29T18:30:00Z', 'USD', 'FOMC Press Conference'),

  -- BoE MPC 30.07.2026 (bankofengland.co.uk/monetary-policy/upcoming-mpc-dates), Entscheid 12:00 London-Zeit.
  ('2026-07-30T11:00:00Z', 'GBP', 'BOE Interest Rate Decision'),

  -- US Employment Situation (Non-Farm Payrolls) 07.08.2026, 8:30 ET (BLS, erster Freitag im Monat).
  ('2026-08-07T12:30:00Z', 'USD', 'Non-Farm Payrolls'),

  -- US CPI (Juli-Daten) 12.08.2026, 8:30 ET (BLS).
  ('2026-08-12T12:30:00Z', 'USD', 'CPI (Consumer Price Index)'),

  -- UK CPI (Juli-Daten) 19.08.2026, 7:00 London-Zeit (ons.gov.uk).
  ('2026-08-19T06:00:00Z', 'GBP', 'UK CPI'),

  -- US Non-Farm Payrolls 04.09.2026, 8:30 ET.
  ('2026-09-04T12:30:00Z', 'USD', 'Non-Farm Payrolls'),

  -- EZB-Sitzung 10.09.2026 (ecb.europa.eu), 14:15/14:45 CEST — gleiches Format wie die schon
  -- eingetragenen Termine vom 23.07.2026.
  ('2026-09-10T12:15:00Z', 'EUR', 'Main Refinancing Rate'),
  ('2026-09-10T12:45:00Z', 'EUR', 'Monetary Policy Statement'),

  -- US CPI (August-Daten) 11.09.2026, 8:30 ET.
  ('2026-09-11T12:30:00Z', 'USD', 'CPI (Consumer Price Index)'),

  -- UK CPI (August-Daten) 16.09.2026, 7:00 London-Zeit.
  ('2026-09-16T06:00:00Z', 'GBP', 'UK CPI'),

  -- BoE MPC 17.09.2026, 12:00 London-Zeit.
  ('2026-09-17T11:00:00Z', 'GBP', 'BOE Interest Rate Decision'),

  -- US Non-Farm Payrolls 02.10.2026, 8:30 ET.
  ('2026-10-02T12:30:00Z', 'USD', 'Non-Farm Payrolls')
on conflict (event_time, currency, title) do nothing;
