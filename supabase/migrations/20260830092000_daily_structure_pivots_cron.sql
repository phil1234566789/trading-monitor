-- Task "Market-Structure-Startpunkt: 1D-Periode-4-Pivots" — täglicher Cron für die neue
-- daily-structure-pivots-Funktion. UTC-Zeit empirisch verifiziert statt geraten (CLAUDE.md-Vorgabe
-- für diesen Task): ein Live-Fetch gegen die deployte forex-candles-Function am 2026-08-30
-- (curl .../forex-candles?symbol=GBPUSD&period=1D&count=5) zeigte D1-Kerzen mit Open-Zeitpunkt
-- durchgehend um 21:00 UTC (aktuell US-Sommerzeit/EDT, NY-Handelsschluss 17:00 EDT). Der
-- NY-Handelsschluss verschiebt sich mit der US-Zeitumstellung (EDT/EST) um eine Stunde auf
-- 22:00 UTC im Winter — 22:15 UTC liegt sicher NACH beiden möglichen Rollover-Zeitpunkten, der Cron
-- muss deshalb (anders als eine DST-genaue Erkennung) nicht selbst zeitzonen-aware sein. timeout
-- analog zu poi-watcher-5min (siehe 20260717170000_poi_watcher_cron_timeout.sql) — nur EIN
-- Instrument-Paar mit EINEM Batch-Request, daher deutlich kürzer als dessen 45s.
select cron.schedule(
  'daily-structure-pivots',
  '15 22 * * *',
  $$
  select net.http_post(
    url := 'https://vkphwtqcvqrkphksproj.supabase.co/functions/v1/daily-structure-pivots',
    headers := jsonb_build_object(
      'Authorization', 'Bearer sb_publishable_v88yE7w0wPJxR1xQmboJwA_cCx759_7',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
