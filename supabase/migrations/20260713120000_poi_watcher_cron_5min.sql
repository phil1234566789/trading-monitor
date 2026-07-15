-- Reduziert die poi-watcher-Frequenz von 1min auf 5min: reicht fuer M5-Genauigkeit beim
-- OB-Touch (siehe Live-Preis-Check in poi-watcher/index.ts), spart Cron/API-Aufrufe. Laeuft
-- bewusst weiter rund um die Uhr (nicht nur waehrend der Trading-Session) — die Session-
-- Beschraenkung passiert in der Function selbst (isTradingHours), damit ueber Nacht liegen-
-- gebliebene Touches beim naechsten Lauf still als "schon gesehen" markiert werden, statt
-- als Nachhol-Alarm-Schwall rauszugehen.
select cron.unschedule('poi-watcher-minute');

select cron.schedule(
  'poi-watcher-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://vkphwtqcvqrkphksproj.supabase.co/functions/v1/poi-watcher',
    headers := jsonb_build_object(
      'Authorization', 'Bearer sb_publishable_v88yE7w0wPJxR1xQmboJwA_cCx759_7',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
