-- Aus Philips ForexFactory-Screenshot (Woche 23.-30.07.2026, Filter EUR/GBP/USD) — nur die beiden
-- ROTEN (High-Impact) Termine, alles andere (gelb/orange) laut Philip explizit uninteressant.
-- Anzeige-Zeiten im Screenshot sind Europe/Berlin (CEST, UTC+2 im Juli) — siehe Chat 2026-07-26.
insert into news_events (event_time, currency, title) values
  ('2026-07-23T12:15:00Z', 'EUR', 'Main Refinancing Rate'),
  ('2026-07-23T12:45:00Z', 'EUR', 'Monetary Policy Statement')
on conflict (event_time, currency, title) do nothing;
