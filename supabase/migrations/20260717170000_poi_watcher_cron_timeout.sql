-- Bug gefunden: net.http_post() hat ein Default-Timeout von 5000ms (siehe net.http_post-
-- Signatur), ein echter poi-watcher-Lauf braucht aber ~17-18s (TLS-Handshake + mehrere
-- sequenzielle cTrader-Requests je Forex-Instrument + OKX fuer BTC). Folge: jede einzelne
-- Cron-Ausfuehrung der letzten Stunden wurde von pg_net nach 5s als "timed_out" abgebrochen
-- (siehe net._http_response, error_msg "Timeout of 5000 ms reached"), bevor der Lauf bis zum
-- Telegram-Versand kam — die Funktion lief im Hintergrund zwar zu Ende (daher kam der Alarm
-- ueberhaupt an), aber teils mehrere Zyklen zu spaet. Deutliches Ueberschreiten war Ursache
-- der ~20min Verzoegerung beim GBPUSD-Trade-Setup-Alarm, nicht eine Zeitzonen-Divergenz
-- (Kerzen-Zeiten selbst sind durchgehend korrektes UTC, siehe _shared/ctrader/client.ts).
select cron.unschedule('poi-watcher-5min');

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
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
  $$
);
